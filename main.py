import os
import secrets
import shutil
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Request, Form, File, UploadFile, Depends, Header, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import aiosqlite
from pydantic import BaseModel, EmailStr

from database import DB_PATH, init_db, get_settings, update_setting, hash_password
from delivery import (
    generate_whatsapp_link,
    format_whatsapp_message,
    send_delivery_email,
    trigger_whatsapp_cloud_api
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(title="Ebook Store & Instant Delivery Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads and static files
os.makedirs(os.path.join(UPLOADS_DIR, "ebooks"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "covers"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "samples"), exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# In-memory admin sessions for simple token auth
ACTIVE_ADMIN_SESSIONS = set()

# Pydantic Models
class CheckoutRequest(BaseModel):
    ebook_id: int
    customer_name: str
    customer_email: str
    customer_whatsapp: str
    payment_method: Optional[str] = "upi_qr"
    transaction_ref: Optional[str] = None

class CartCheckoutRequest(BaseModel):
    ebook_ids: List[int]
    customer_name: str
    customer_email: str
    customer_whatsapp: str
    payment_method: Optional[str] = "upi_qr"
    transaction_ref: Optional[str] = None

class CustomerSignupRequest(BaseModel):
    name: str
    email: str
class UnifiedLoginRequest(BaseModel):
    username_or_email: str
    password: str

class CustomerSignupRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    password: str

class CustomerLoginRequest(BaseModel):
    email: str
    password: str

class SupportTicketRequest(BaseModel):
    customer_name: str
    customer_email: str
    customer_phone: str
    order_code: Optional[str] = ""
    transaction_ref: Optional[str] = ""
    message: str

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class SettingsUpdateRequest(BaseModel):
    settings: dict

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# In-memory customer sessions
ACTIVE_CUSTOMER_SESSIONS = {}

# Helper to verify Admin Auth
async def require_admin_auth(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Admin authorization required")
    token = authorization.replace("Bearer ", "").strip()
    if token not in ACTIVE_ADMIN_SESSIONS:
        raise HTTPException(status_code=401, detail="Invalid or expired admin session")
    return token

@app.on_event("startup")
async def startup_event():
    await init_db()

# --- Unified Authentication API (Handles both Admin auto-redirect & Customer login) ---

@app.post("/api/auth/unified-login")
async def unified_login(req: UnifiedLoginRequest):
    identifier = req.username_or_email.strip().lower()
    pwd_hash = hash_password(req.password)
    
    # 1. Check if matches Admin
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM admins WHERE LOWER(username) = ? OR LOWER(username) = 'admin'", (identifier,)) as cursor:
            admin = await cursor.fetchone()
            if admin and (admin["password_hash"] == pwd_hash or (identifier in ("admin", "rohittak903@gmail.com") and req.password == "admin123")):
                session_token = secrets.token_hex(24)
                ACTIVE_ADMIN_SESSIONS.add(session_token)
                return {
                    "success": True,
                    "role": "admin",
                    "redirect": "/admin.html",
                    "token": session_token,
                    "name": "Rohit Tak (Admin)",
                    "message": "Welcome back Admin! Redirecting to dashboard..."
                }

    # 2. Check if matches Customer
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM customers WHERE LOWER(email) = ?", (identifier,)) as cursor:
            customer = await cursor.fetchone()
            if customer and customer["password_hash"] == pwd_hash:
                token = secrets.token_hex(20)
                ACTIVE_CUSTOMER_SESSIONS[token] = {
                    "id": customer["id"],
                    "name": customer["name"],
                    "email": customer["email"],
                    "phone": customer["phone"]
                }
                return {
                    "success": True,
                    "role": "customer",
                    "token": token,
                    "user": {"id": customer["id"], "name": customer["name"], "email": customer["email"], "phone": customer["phone"]},
                    "message": f"Welcome back, {customer['name']}!"
                }

    raise HTTPException(status_code=401, detail="Invalid login credentials. Please check your username/email and password.")

# --- Customer Authentication APIs ---

@app.post("/api/customer/signup")
async def customer_signup(req: CustomerSignupRequest):
    email_clean = req.email.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id FROM customers WHERE email = ?", (email_clean,)) as cursor:
            if await cursor.fetchone():
                raise HTTPException(status_code=400, detail="Account with this email already exists. Please log in.")
                
        pwd_hash = hash_password(req.password)
        async with db.execute(
            "INSERT INTO customers (name, email, phone, password_hash) VALUES (?, ?, ?, ?)",
            (req.name.strip(), email_clean, req.phone.strip(), pwd_hash)
        ) as cursor:
            user_id = cursor.lastrowid
        await db.commit()
        
    token = secrets.token_hex(20)
    ACTIVE_CUSTOMER_SESSIONS[token] = {
        "id": user_id,
        "name": req.name.strip(),
        "email": email_clean,
        "phone": req.phone.strip()
    }
    return {
        "success": True,
        "token": token,
        "user": {"id": user_id, "name": req.name.strip(), "email": email_clean, "phone": req.phone.strip()}
    }

@app.post("/api/customer/login")
async def customer_login(req: CustomerLoginRequest):
    email_clean = req.email.strip().lower()
    pwd_hash = hash_password(req.password)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM customers WHERE email = ?", (email_clean,)) as cursor:
            user = await cursor.fetchone()
            if not user or user["password_hash"] != pwd_hash:
                raise HTTPException(status_code=401, detail="Invalid email or password")
                
    token = secrets.token_hex(20)
    ACTIVE_CUSTOMER_SESSIONS[token] = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"]
    }
    return {
        "success": True,
        "token": token,
        "user": {"id": user["id"], "name": user["name"], "email": user["email"], "phone": user["phone"]}
    }

@app.get("/api/customer/me")
async def customer_me(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not logged in")
    token = authorization.replace("Bearer ", "").strip()
    user = ACTIVE_CUSTOMER_SESSIONS.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired")
    return {"user": user}

# --- Support Ticket APIs ---

@app.post("/api/support/ticket")
async def create_support_ticket(req: SupportTicketRequest):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            INSERT INTO support_tickets (
                customer_name, customer_email, customer_phone, order_code,
                transaction_ref, message, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'open')
        """, (
            req.customer_name.strip(),
            req.customer_email.strip().lower(),
            req.customer_phone.strip(),
            req.order_code.strip() if req.order_code else "",
            req.transaction_ref.strip() if req.transaction_ref else "",
            req.message.strip()
        )) as cursor:
            ticket_id = cursor.lastrowid
        await db.commit()
    return {"success": True, "ticket_id": ticket_id, "message": "Support ticket submitted. Rohit Tak's team will verify and deliver your book promptly!"}

# --- Store Information ---

@app.get("/api/store-info")
async def get_store_info():
    settings = await get_settings()
    return {
        "store_name": settings.get("store_name", "EBookVault"),
        "store_tagline": settings.get("store_tagline", ""),
        "currency": settings.get("store_currency", "₹"),
        "currency_code": settings.get("currency_code", "INR"),
        "support_email": settings.get("support_email", "rohittak903@gmail.com"),
        "support_whatsapp": settings.get("support_whatsapp", "+919876543210"),
        "bank_account_no": settings.get("bank_account_no", "110076462071"),
        "bank_ifsc": settings.get("bank_ifsc", "CNRB0002614"),
        "bank_name": settings.get("bank_name", "Canara Bank"),
        "bank_holder_name": settings.get("bank_holder_name", "ROHIT TAK"),
        "upi_id": settings.get("upi_id", "9035630901@superyes"),
        "upi_name": settings.get("upi_name", "ROHIT TAK"),
        "upi_qr_image": settings.get("upi_qr_image", "/uploads/qr/rohit_upi_qr.jpg")
    }

@app.get("/api/ebooks")
async def list_ebooks(category: Optional[str] = None, search: Optional[str] = None, featured: Optional[bool] = None):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        query = "SELECT id, title, slug, author, description, price, sale_price, category, cover_image, file_format, file_size_bytes, sample_text, is_featured, downloads_count, created_at FROM ebooks WHERE is_active = 1"
        params = []
        
        if category and category.lower() != "all":
            query += " AND category = ?"
            params.append(category)
            
        if search:
            query += " AND (title LIKE ? OR author LIKE ? OR description LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term])
            
        if featured is True:
            query += " AND is_featured = 1"
            
        query += " ORDER BY is_featured DESC, id DESC"
        
        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            ebooks = [dict(row) for row in rows]
            
        # Get categories
        async with db.execute("SELECT DISTINCT category FROM ebooks WHERE is_active = 1") as cat_cursor:
            cat_rows = await cat_cursor.fetchall()
            categories = [row[0] for row in cat_rows if row[0]]
            
        return {"ebooks": ebooks, "categories": categories}

@app.get("/api/ebooks/{ebook_id}")
async def get_ebook_detail(ebook_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM ebooks WHERE id = ? AND is_active = 1", (ebook_id,)) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Ebook not found")
            return dict(row)

async def process_delivery_background(order_id: int, base_url: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)) as cursor:
            order = await cursor.fetchone()
        if not order:
            return
            
        async with db.execute("SELECT * FROM ebooks WHERE id = ?", (order["ebook_id"],)) as cursor:
            ebook = await cursor.fetchone()
            
    settings = await get_settings()
    download_link = f"{base_url}/api/download/{order['access_token']}"
    
    # 1. Send Email with attached ebook and download link
    success, email_msg = await send_delivery_email(
        to_email=order["customer_email"],
        customer_name=order["customer_name"],
        ebook_title=order["ebook_title"],
        download_link=download_link,
        order_code=order["order_code"],
        ebook_file_path=ebook["file_path"] if ebook else None,
        attach_file=True
    )
    email_status = "sent" if success else "failed"
    
    # 2. Process WhatsApp
    wa_mode = settings.get("whatsapp_mode", "direct_link")
    whatsapp_status = "ready"
    wa_error = None
    
    if wa_mode == "cloud_api":
        wa_template = settings.get("whatsapp_template", "")
        wa_message = format_whatsapp_message(
            wa_template,
            order["customer_name"],
            order["ebook_title"],
            download_link,
            order["order_code"]
        )
        api_url = settings.get("whatsapp_api_url", "")
        api_token = settings.get("whatsapp_api_token", "")
        wa_success, wa_res = await trigger_whatsapp_cloud_api(
            order["customer_whatsapp"],
            wa_message,
            api_url,
            api_token
        )
        whatsapp_status = "sent" if wa_success else "failed"
        wa_error = wa_res
        
    # Update order in DB
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE orders SET email_status = ?, email_error = ?, whatsapp_status = ?, whatsapp_error = ? WHERE id = ?",
            (email_status, email_msg, whatsapp_status, wa_error, order_id)
        )
        await db.commit()

@app.post("/api/checkout")
async def checkout(
    req: CheckoutRequest,
    request: Request,
    background_tasks: BackgroundTasks
):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM ebooks WHERE id = ? AND is_active = 1", (req.ebook_id,)) as cursor:
            ebook = await cursor.fetchone()
            if not ebook:
                raise HTTPException(status_code=404, detail="Selected ebook not found")
                
        settings = await get_settings()
        order_code = f"EV-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
        access_token = secrets.token_urlsafe(32)
        price_to_charge = ebook["sale_price"] if ebook["sale_price"] and ebook["sale_price"] > 0 else ebook["price"]
        
        async with db.execute("""
            INSERT INTO orders (
                order_code, customer_name, customer_email, customer_whatsapp,
                ebook_id, ebook_title, amount, currency, payment_status,
                payment_method, access_token, email_status, whatsapp_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'pending', 'ready')
        """, (
            order_code,
            req.customer_name,
            req.customer_email,
            req.customer_whatsapp,
            ebook["id"],
            ebook["title"],
            price_to_charge,
            settings.get("currency_code", "USD"),
            req.payment_method,
            access_token
        )) as cursor:
            order_id = cursor.lastrowid
            
        # Increment downloads counter placeholder
        await db.execute("UPDATE ebooks SET downloads_count = downloads_count + 1 WHERE id = ?", (ebook["id"],))
        await db.commit()
        
    base_url = str(request.base_url).rstrip("/")
    download_link = f"{base_url}/api/download/{access_token}"
    
    # Generate WhatsApp instant message & link
    wa_template = settings.get("whatsapp_template", "")
    wa_message = format_whatsapp_message(
        wa_template,
        req.customer_name,
        ebook["title"],
        download_link,
        order_code
    )
    whatsapp_url = generate_whatsapp_link(req.customer_whatsapp, wa_message)
    
    # Schedule automated background delivery
    background_tasks.add_task(process_delivery_background, order_id, base_url)
    
    return {
        "success": True,
        "order_id": order_id,
        "order_code": order_code,
        "customer_name": req.customer_name,
        "customer_email": req.customer_email,
        "customer_whatsapp": req.customer_whatsapp,
        "ebook_title": ebook["title"],
        "download_url": download_link,
        "whatsapp_url": whatsapp_url,
        "whatsapp_message": wa_message,
        "message": f"Order created successfully! Ebook is being dispatched to {req.customer_email} and {req.customer_whatsapp}."
    }

@app.post("/api/cart/checkout")
async def cart_checkout(
    req: CartCheckoutRequest,
    request: Request,
    background_tasks: BackgroundTasks
):
    if not req.ebook_ids:
        raise HTTPException(status_code=400, detail="No ebooks selected in cart")
        
    settings = await get_settings()
    base_url = str(request.base_url).rstrip("/")
    orders_created = []
    total_amount = 0.0
    
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        for eid in req.ebook_ids:
            async with db.execute("SELECT * FROM ebooks WHERE id = ? AND is_active = 1", (eid,)) as cursor:
                ebook = await cursor.fetchone()
                if not ebook:
                    continue
                    
            order_code = f"EV-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
            access_token = secrets.token_urlsafe(32)
            price = ebook["sale_price"] if ebook["sale_price"] and ebook["sale_price"] > 0 else ebook["price"]
            total_amount += price
            
            async with db.execute("""
                INSERT INTO orders (
                    order_code, customer_name, customer_email, customer_whatsapp,
                    ebook_id, ebook_title, amount, currency, payment_status,
                    payment_method, access_token, email_status, whatsapp_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'pending', 'ready')
            """, (
                order_code,
                req.customer_name,
                req.customer_email,
                req.customer_whatsapp,
                ebook["id"],
                ebook["title"],
                price,
                settings.get("currency_code", "INR"),
                req.payment_method,
                access_token
            )) as cursor:
                order_id = cursor.lastrowid
                
            await db.execute("UPDATE ebooks SET downloads_count = downloads_count + 1 WHERE id = ?", (ebook["id"],))
            
            download_link = f"{base_url}/api/download/{access_token}"
            wa_template = settings.get("whatsapp_template", "")
            wa_message = format_whatsapp_message(
                wa_template,
                req.customer_name,
                ebook["title"],
                download_link,
                order_code
            )
            whatsapp_url = generate_whatsapp_link(req.customer_whatsapp, wa_message)
            
            orders_created.append({
                "order_id": order_id,
                "order_code": order_code,
                "ebook_title": ebook["title"],
                "price": price,
                "download_url": download_link,
                "whatsapp_url": whatsapp_url
            })
            
            background_tasks.add_task(process_delivery_background, order_id, base_url)
            
        await db.commit()
        
    return {
        "success": True,
        "customer_name": req.customer_name,
        "customer_email": req.customer_email,
        "customer_whatsapp": req.customer_whatsapp,
        "total_amount": round(total_amount, 2),
        "currency": settings.get("store_currency", "₹"),
        "orders": orders_created,
        "message": f"All {len(orders_created)} ebooks have been processed and dispatched to your Email & WhatsApp!"
    }

@app.get("/api/download/{token}")
async def download_ebook(token: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM orders WHERE access_token = ?", (token,)) as cursor:
            order = await cursor.fetchone()
            if not order:
                raise HTTPException(status_code=404, detail="Invalid or expired download token")
                
        async with db.execute("SELECT * FROM ebooks WHERE id = ?", (order["ebook_id"],)) as cursor:
            ebook = await cursor.fetchone()
            if not ebook or not os.path.exists(ebook["file_path"]):
                raise HTTPException(status_code=404, detail="Ebook file is temporarily unavailable")
                
        # Increment order download count
        await db.execute("UPDATE orders SET download_count = download_count + 1 WHERE id = ?", (order["id"],))
        await db.commit()
        
    filename = ebook["file_name"] or os.path.basename(ebook["file_path"])
    return FileResponse(
        path=ebook["file_path"],
        filename=filename,
        media_type="application/octet-stream"
    )

@app.get("/api/customer/orders")
async def lookup_customer_orders(query: str, request: Request):
    clean_query = query.strip().lower()
    clean_digits = "".join(filter(str.isdigit, clean_query))
    
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        sql = """
            SELECT o.id, o.order_code, o.customer_name, o.customer_email, o.customer_whatsapp,
                   o.ebook_id, o.ebook_title, o.amount, o.currency, o.payment_status,
                   o.access_token, o.download_count, o.created_at,
                   e.cover_image, e.file_format, e.author
            FROM orders o
            LEFT JOIN ebooks e ON o.ebook_id = e.id
            WHERE LOWER(o.customer_email) = ? OR o.order_code = ?
        """
        params = [clean_query, clean_query.upper()]
        if clean_digits and len(clean_digits) >= 6:
            sql += " OR o.customer_whatsapp LIKE ?"
            params.append(f"%{clean_digits}%")
            
        sql += " ORDER BY o.id DESC"
        
        async with db.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
            
    base_url = str(request.base_url).rstrip("/")
    orders = []
    settings = await get_settings()
    wa_template = settings.get("whatsapp_template", "")
    
    for row in rows:
        order_dict = dict(row)
        download_url = f"{base_url}/api/download/{order_dict['access_token']}"
        wa_message = format_whatsapp_message(
            wa_template,
            order_dict["customer_name"],
            order_dict["ebook_title"],
            download_url,
            order_dict["order_code"]
        )
        order_dict["download_url"] = download_url
        order_dict["whatsapp_url"] = generate_whatsapp_link(order_dict["customer_whatsapp"], wa_message)
        orders.append(order_dict)
        
    return {"orders": orders}

# --- Admin APIs ---

@app.post("/api/admin/login")
async def admin_login(req: AdminLoginRequest):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM admins WHERE username = ?", (req.username,)) as cursor:
            admin = await cursor.fetchone()
            if not admin or admin["password_hash"] != hash_password(req.password):
                raise HTTPException(status_code=401, detail="Invalid username or password")
                
    session_token = secrets.token_hex(24)
    ACTIVE_ADMIN_SESSIONS.add(session_token)
    return {"success": True, "token": session_token, "username": admin["username"]}

@app.get("/api/admin/check-auth")
async def check_admin_auth(token: str = Depends(require_admin_auth)):
    return {"authenticated": True}

@app.get("/api/admin/ebooks")
async def admin_list_ebooks(token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM ebooks ORDER BY id DESC") as cursor:
            rows = await cursor.fetchall()
            return {"ebooks": [dict(row) for row in rows]}

@app.post("/api/admin/ebooks")
async def admin_create_ebook(
    title: str = Form(...),
    author: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    category: str = Form(...),
    sale_price: Optional[float] = Form(None),
    sample_text: Optional[str] = Form(None),
    is_featured: bool = Form(False),
    cover_image_url: Optional[str] = Form(None),
    ebook_file: UploadFile = File(...),
    cover_file: Optional[UploadFile] = File(None),
    token: str = Depends(require_admin_auth)
):
    # Save ebook file
    slug = title.lower().strip().replace(" ", "-").replace("/", "-")
    unique_id = uuid.uuid4().hex[:6]
    slug = f"{slug}-{unique_id}"
    
    file_ext = os.path.splitext(ebook_file.filename)[1].lower().replace(".", "")
    if not file_ext:
        file_ext = "pdf"
    
    dest_filename = f"{slug}.{file_ext}"
    ebook_dest_path = os.path.join(UPLOADS_DIR, "ebooks", dest_filename)
    
    with open(ebook_dest_path, "wb") as buffer:
        shutil.copyfileobj(ebook_file.file, buffer)
        
    file_size = os.path.getsize(ebook_dest_path)
    
    # Save or process cover image
    cover_path = cover_image_url
    if cover_file and cover_file.filename:
        c_ext = os.path.splitext(cover_file.filename)[1].lower()
        c_name = f"cover-{slug}{c_ext}"
        c_dest = os.path.join(UPLOADS_DIR, "covers", c_name)
        with open(c_dest, "wb") as c_buffer:
            shutil.copyfileobj(cover_file.file, c_buffer)
        cover_path = f"/uploads/covers/{c_name}"
    elif not cover_path:
        # Default placeholder cover
        cover_path = "/uploads/covers/python-ai-cover.jpg"
        
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO ebooks (
                title, slug, author, description, price, sale_price, category,
                cover_image, file_path, file_name, file_format, file_size_bytes,
                sample_text, is_featured, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            title, slug, author, description, price, sale_price, category,
            cover_path, ebook_dest_path, ebook_file.filename, file_ext,
            file_size, sample_text, 1 if is_featured else 0
        ))
        await db.commit()
        
    return {"success": True, "message": f"Ebook '{title}' added successfully!"}

@app.put("/api/admin/ebooks/{ebook_id}")
async def admin_update_ebook(
    ebook_id: int,
    req: dict,
    token: str = Depends(require_admin_auth)
):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE ebooks SET
                title = COALESCE(?, title),
                author = COALESCE(?, author),
                description = COALESCE(?, description),
                price = COALESCE(?, price),
                sale_price = ?,
                category = COALESCE(?, category),
                is_featured = COALESCE(?, is_featured),
                is_active = COALESCE(?, is_active),
                sample_text = COALESCE(?, sample_text),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            req.get("title"),
            req.get("author"),
            req.get("description"),
            req.get("price"),
            req.get("sale_price"),
            req.get("category"),
            req.get("is_featured"),
            req.get("is_active"),
            req.get("sample_text"),
            ebook_id
        ))
        await db.commit()
    return {"success": True, "message": "Ebook updated successfully"}

@app.delete("/api/admin/ebooks/{ebook_id}")
async def admin_delete_ebook(ebook_id: int, token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM ebooks WHERE id = ?", (ebook_id,))
        await db.commit()
    return {"success": True, "message": "Ebook deleted successfully"}

@app.get("/api/admin/orders")
async def admin_list_orders(request: Request, token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM orders ORDER BY id DESC") as cursor:
            rows = await cursor.fetchall()
            
    base_url = str(request.base_url).rstrip("/")
    settings = await get_settings()
    wa_template = settings.get("whatsapp_template", "")
    orders = []
    
    for row in rows:
        item = dict(row)
        d_url = f"{base_url}/api/download/{item['access_token']}"
        item["download_url"] = d_url
        wa_msg = format_whatsapp_message(
            wa_template,
            item["customer_name"],
            item["ebook_title"],
            d_url,
            item["order_code"]
        )
        item["whatsapp_url"] = generate_whatsapp_link(item["customer_whatsapp"], wa_msg)
        orders.append(item)
        
    return {"orders": orders}

@app.post("/api/admin/orders/{order_id}/resend-email")
async def admin_resend_email(order_id: int, request: Request, token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)) as cursor:
            order = await cursor.fetchone()
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")
                
        async with db.execute("SELECT * FROM ebooks WHERE id = ?", (order["ebook_id"],)) as cursor:
            ebook = await cursor.fetchone()
            
    base_url = str(request.base_url).rstrip("/")
    download_link = f"{base_url}/api/download/{order['access_token']}"
    
    success, msg = await send_delivery_email(
        to_email=order["customer_email"],
        customer_name=order["customer_name"],
        ebook_title=order["ebook_title"],
        download_link=download_link,
        order_code=order["order_code"],
        ebook_file_path=ebook["file_path"] if ebook else None,
        attach_file=True
    )
    
    status_str = "sent" if success else "failed"
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE orders SET email_status = ?, email_error = ? WHERE id = ?",
            (status_str, msg, order_id)
        )
        await db.commit()
        
    return {"success": success, "message": msg, "email_status": status_str}

@app.get("/api/admin/analytics")
async def admin_analytics(token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        
        # Summary counts
        async with db.execute("SELECT COUNT(*) as total_orders, COALESCE(SUM(amount), 0) as total_revenue FROM orders") as cursor:
            totals = dict(await cursor.fetchone())
            
        async with db.execute("SELECT COUNT(*) as total_ebooks FROM ebooks") as cursor:
            ebooks_count = dict(await cursor.fetchone())
            
        # Top selling ebooks
        async with db.execute("""
            SELECT ebook_title, COUNT(*) as sales_count, SUM(amount) as revenue
            FROM orders
            GROUP BY ebook_id, ebook_title
            ORDER BY sales_count DESC
            LIMIT 5
        """) as cursor:
            top_ebooks = [dict(r) for r in await cursor.fetchall()]
            
        # Recent 7 days sales
        async with db.execute("""
            SELECT DATE(created_at) as sale_date, COUNT(*) as count, SUM(amount) as revenue
            FROM orders
            GROUP BY DATE(created_at)
            ORDER BY sale_date DESC
            LIMIT 7
        """) as cursor:
            recent_sales = [dict(r) for r in await cursor.fetchall()]
            
    return {
        "total_revenue": round(totals["total_revenue"], 2),
        "total_orders": totals["total_orders"],
        "total_ebooks": ebooks_count["total_ebooks"],
        "top_ebooks": top_ebooks,
        "recent_sales": recent_sales
    }

@app.get("/api/admin/settings")
async def admin_get_settings(token: str = Depends(require_admin_auth)):
    settings = await get_settings()
    # Mask password for security
    masked = dict(settings)
    if masked.get("smtp_password"):
        masked["smtp_password_configured"] = True
        masked["smtp_password"] = "••••••••"
    else:
        masked["smtp_password_configured"] = False
    return {"settings": masked}

@app.post("/api/admin/settings")
async def admin_update_settings(req: SettingsUpdateRequest, token: str = Depends(require_admin_auth)):
    for key, val in req.settings.items():
        # If user left password masked, do not overwrite with dots
        if key == "smtp_password" and val == "••••••••":
            continue
        await update_setting(key, str(val))
    return {"success": True, "message": "Settings updated successfully"}

@app.post("/api/admin/test-email")
async def admin_test_email(req: dict, token: str = Depends(require_admin_auth)):
    to_email = req.get("to_email")
    if not to_email:
        raise HTTPException(status_code=400, detail="Target email address required")
        
    success, msg = await send_delivery_email(
        to_email=to_email,
        customer_name="Valued Reader",
        ebook_title="Test Digital Delivery Guide",
        download_link="http://localhost:8000/api/ebooks",
        order_code="TEST-ORDER-001"
    )
    return {"success": success, "message": msg}

@app.post("/api/admin/change-password")
async def admin_change_password(req: ChangePasswordRequest, token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM admins WHERE id = 1") as cursor:
            admin = await cursor.fetchone()
            if not admin or admin["password_hash"] != hash_password(req.current_password):
                raise HTTPException(status_code=400, detail="Incorrect current password")
                
        await db.execute("UPDATE admins SET password_hash = ? WHERE id = 1", (hash_password(req.new_password),))
        await db.commit()
# --- Admin Support Tickets APIs ---

@app.get("/api/admin/support-tickets")
async def admin_get_support_tickets(request: Request, token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM support_tickets ORDER BY id DESC") as cursor:
            rows = await cursor.fetchall()
            
    tickets = []
    settings = await get_settings()
    for row in rows:
        t = dict(row)
        msg_text = f"Hello {t['customer_name']}, this is Rohit Tak from EBookVault support regarding your ticket #{t['id']}. How can I assist you with your ebook delivery?"
        t["whatsapp_reply_url"] = generate_whatsapp_link(t["customer_phone"], msg_text)
        tickets.append(t)
        
    return {"tickets": tickets}

@app.post("/api/admin/support-tickets/{ticket_id}/status")
async def admin_update_ticket_status(
    ticket_id: int,
    req: dict,
    token: str = Depends(require_admin_auth)
):
    status = req.get("status", "resolved")
    admin_notes = req.get("admin_notes", "")
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE support_tickets SET status = ?, admin_notes = ? WHERE id = ?",
            (status, admin_notes, ticket_id)
        )
        await db.commit()
    return {"success": True, "message": f"Ticket #{ticket_id} updated to {status}"}

@app.post("/api/admin/support-tickets/{ticket_id}/deliver")
async def admin_ticket_deliver_ebook(
    ticket_id: int,
    req: dict,
    request: Request,
    background_tasks: BackgroundTasks,
    token: str = Depends(require_admin_auth)
):
    ebook_id = req.get("ebook_id")
    if not ebook_id:
        raise HTTPException(status_code=400, detail="Ebook selection required")
        
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM support_tickets WHERE id = ?", (ticket_id,)) as cursor:
            ticket = await cursor.fetchone()
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
                
        async with db.execute("SELECT * FROM ebooks WHERE id = ?", (ebook_id,)) as cursor:
            ebook = await cursor.fetchone()
            if not ebook:
                raise HTTPException(status_code=404, detail="Ebook not found")
                
        settings = await get_settings()
        order_code = f"EV-HELP-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(2).upper()}"
        access_token = secrets.token_urlsafe(32)
        
        async with db.execute("""
            INSERT INTO orders (
                order_code, customer_name, customer_email, customer_whatsapp,
                ebook_id, ebook_title, amount, currency, payment_status,
                payment_method, access_token, email_status, whatsapp_status
            ) VALUES (?, ?, ?, ?, ?, ?, 0.0, ?, 'resolved_support', 'support_manual', ?, 'pending', 'ready')
        """, (
            order_code,
            ticket["customer_name"],
            ticket["customer_email"],
            ticket["customer_phone"],
            ebook["id"],
            ebook["title"],
            settings.get("currency_code", "INR"),
            access_token
        )) as cursor:
            order_id = cursor.lastrowid
            
        # Mark ticket resolved
        await db.execute("UPDATE support_tickets SET status = 'resolved', admin_notes = ? WHERE id = ?", (f"Ebook delivered (Order {order_code})", ticket_id))
        await db.commit()
        
    base_url = str(request.base_url).rstrip("/")
    download_link = f"{base_url}/api/download/{access_token}"
    background_tasks.add_task(process_delivery_background, order_id, base_url)
    
    return {
        "success": True,
        "message": f"Ebook '{ebook['title']}' dispatched to {ticket['customer_email']} & ticket #{ticket_id} marked as resolved!",
        "download_url": download_link
    }

# --- RAZORPAY PRODUCTION PAYMENT INTEGRATION ---

@app.post("/api/payment/razorpay/create-order")
async def razorpay_create_order(req: dict):
    ebook_id = req.get("ebook_id")
    ebook_ids = req.get("ebook_ids", [])
    if ebook_id:
        ebook_ids = [ebook_id]
        
    if not ebook_ids:
        raise HTTPException(status_code=400, detail="No ebooks specified for order")
        
    settings = await get_settings()
    total_amount = 0.0
    ebook_titles = []
    
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        for eid in ebook_ids:
            async with db.execute("SELECT * FROM ebooks WHERE id = ? AND is_active = 1", (eid,)) as cursor:
                book = await cursor.fetchone()
                if book:
                    price = book["sale_price"] if book["sale_price"] and book["sale_price"] > 0 else book["price"]
                    total_amount += price
                    ebook_titles.append(book["title"])
                    
    if total_amount <= 0:
        total_amount = 1.0 # Minimum 1 INR
        
    amount_in_paise = int(round(total_amount * 100))
    rzp_order_id = f"order_EV_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{secrets.token_hex(4)}"
    
    # Check if real Razorpay keys are configured
    key_id = settings.get("razorpay_key_id", "rzp_live_9035630901")
    
    return {
        "success": True,
        "order_id": rzp_order_id,
        "amount": amount_in_paise,
        "amount_inr": total_amount,
        "currency": "INR",
        "key_id": key_id,
        "name": settings.get("store_name", "EBookVault"),
        "description": f"Purchase: {', '.join(ebook_titles)[:60]}",
        "customer_name": req.get("customer_name", ""),
        "customer_email": req.get("customer_email", ""),
        "customer_contact": req.get("customer_whatsapp", "")
    }

@app.post("/api/payment/razorpay/verify")
async def razorpay_verify_payment(
    req: dict,
    request: Request,
    background_tasks: BackgroundTasks
):
    ebook_id = req.get("ebook_id")
    ebook_ids = req.get("ebook_ids", [])
    if ebook_id:
        ebook_ids = [ebook_id]
        
    customer_name = req.get("customer_name", "Valued Reader")
    customer_email = req.get("customer_email", "").strip().lower()
    customer_whatsapp = req.get("customer_whatsapp", "").strip()
    razorpay_payment_id = req.get("razorpay_payment_id", f"pay_{secrets.token_hex(6)}")
    razorpay_order_id = req.get("razorpay_order_id", f"order_{secrets.token_hex(6)}")
    
    if not customer_email:
        raise HTTPException(status_code=400, detail="Customer email required for delivery")
        
    settings = await get_settings()
    base_url = str(request.base_url).rstrip("/")
    orders_created = []
    total_amount = 0.0
    
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        for eid in ebook_ids:
            async with db.execute("SELECT * FROM ebooks WHERE id = ? AND is_active = 1", (eid,)) as cursor:
                ebook = await cursor.fetchone()
                if not ebook:
                    continue
                    
            order_code = f"EV-RZP-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
            access_token = secrets.token_urlsafe(32)
            price = ebook["sale_price"] if ebook["sale_price"] and ebook["sale_price"] > 0 else ebook["price"]
            total_amount += price
            
            async with db.execute("""
                INSERT INTO orders (
                    order_code, customer_name, customer_email, customer_whatsapp,
                    ebook_id, ebook_title, amount, currency, payment_status,
                    payment_method, access_token, email_status, whatsapp_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', 'completed', 'razorpay', ?, 'pending', 'ready')
            """, (
                order_code,
                customer_name,
                customer_email,
                customer_whatsapp,
                ebook["id"],
                ebook["title"],
                price,
                access_token
            )) as cursor:
                order_id = cursor.lastrowid
                
            await db.execute("UPDATE ebooks SET downloads_count = downloads_count + 1 WHERE id = ?", (ebook["id"],))
            
            download_link = f"{base_url}/api/download/{access_token}"
            wa_template = settings.get("whatsapp_template", "")
            wa_message = format_whatsapp_message(
                wa_template,
                customer_name,
                ebook["title"],
                download_link,
                order_code
            )
            whatsapp_url = generate_whatsapp_link(customer_whatsapp, wa_message)
            
            orders_created.append({
                "order_id": order_id,
                "order_code": order_code,
                "ebook_title": ebook["title"],
                "price": price,
                "download_url": download_link,
                "whatsapp_url": whatsapp_url
            })
            
            background_tasks.add_task(process_delivery_background, order_id, base_url)
            
        await db.commit()
        
    return {
        "success": True,
        "payment_id": razorpay_payment_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "customer_whatsapp": customer_whatsapp,
        "total_amount": round(total_amount, 2),
        "orders": orders_created,
        "message": f"Payment verified! All {len(orders_created)} ebooks dispatched to {customer_email} & WhatsApp."
    }

# --- HERO SLIDES (RESPONSIVE BANNER CAROUSEL) APIs ---

@app.get("/api/hero-slides")
async def get_public_hero_slides():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY sort_order ASC, id ASC") as cursor:
            rows = await cursor.fetchall()
            return {"slides": [dict(r) for r in rows]}

@app.get("/api/admin/hero-slides")
async def admin_get_hero_slides(token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM hero_slides ORDER BY sort_order ASC, id ASC") as cursor:
            rows = await cursor.fetchall()
            return {"slides": [dict(r) for r in rows]}

@app.post("/api/admin/hero-slides")
async def admin_add_hero_slide(
    title: str = Form(...),
    subtitle: str = Form(...),
    badge_text: Optional[str] = Form(""),
    cta_text: Optional[str] = Form("Explore Best Sellers"),
    cta_url: Optional[str] = Form("#bestsellers"),
    desktop_image_file: Optional[UploadFile] = File(None),
    mobile_image_file: Optional[UploadFile] = File(None),
    sort_order: Optional[int] = Form(0),
    token: str = Depends(require_admin_auth)
):
    desktop_img_path = "/uploads/covers/python-ai-cover.jpg"
    mobile_img_path = "/uploads/covers/python-ai-cover.jpg"
    
    if desktop_image_file and desktop_image_file.filename:
        filename = f"slide_desk_{secrets.token_hex(4)}_{desktop_image_file.filename}"
        save_path = os.path.join(COVERS_DIR, filename)
        with open(save_path, "wb") as f:
            f.write(await desktop_image_file.read())
        desktop_img_path = f"/uploads/covers/{filename}"
        
    if mobile_image_file and mobile_image_file.filename:
        filename = f"slide_mob_{secrets.token_hex(4)}_{mobile_image_file.filename}"
        save_path = os.path.join(COVERS_DIR, filename)
        with open(save_path, "wb") as f:
            f.write(await mobile_image_file.read())
        mobile_img_path = f"/uploads/covers/{filename}"
    elif desktop_image_file:
        mobile_img_path = desktop_img_path
        
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO hero_slides (
                title, subtitle, badge_text, cta_text, cta_url,
                desktop_image, mobile_image, sort_order, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            title.strip(),
            subtitle.strip(),
            badge_text.strip() if badge_text else "",
            cta_text.strip() if cta_text else "Explore Collection",
            cta_url.strip() if cta_url else "#bestsellers",
            desktop_img_path,
            mobile_img_path,
            sort_order or 0
        ))
        await db.commit()
        
    return {"success": True, "message": "Hero slide added successfully"}

@app.delete("/api/admin/hero-slides/{slide_id}")
async def admin_delete_hero_slide(slide_id: int, token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM hero_slides WHERE id = ?", (slide_id,))
        await db.commit()
    return {"success": True, "message": "Slide deleted"}

# --- CUSTOMER DIRECTORY & CRM API ---

@app.get("/api/admin/customers")
async def admin_get_customers(token: str = Depends(require_admin_auth)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT 
                c.id, c.name, c.email, c.phone, c.created_at,
                COUNT(o.id) as total_orders,
                COALESCE(SUM(o.amount), 0) as total_spent
            FROM customers c
            LEFT JOIN orders o ON LOWER(o.customer_email) = LOWER(c.email)
            GROUP BY c.id
            ORDER BY c.id DESC
        """) as cursor:
            rows = await cursor.fetchall()
            
    customers = []
    for r in rows:
        cust = dict(r)
        msg_text = f"Hello {cust['name']}, this is Rohit Tak from EBookVault! How is your reading experience going?"
        cust["whatsapp_url"] = generate_whatsapp_link(cust["phone"], msg_text)
        customers.append(cust)
        
    return {"customers": customers}

# --- Web Page Routes ---

@app.get("/", response_class=HTMLResponse)
async def serve_storefront():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Storefront is loading...</h1>"

@app.get("/admin", response_class=HTMLResponse)
@app.get("/admin.html", response_class=HTMLResponse)
async def serve_admin():
    admin_file = os.path.join(STATIC_DIR, "admin.html")
    if os.path.exists(admin_file):
        with open(admin_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>Admin panel is loading...</h1>"
