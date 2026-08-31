import aiosqlite
import os
import sys
import shutil
import hashlib
import json
import tempfile
from datetime import datetime

# Serverless DB Path Handling (Vercel has read-only root, /tmp is writable)
def get_db_path():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    default_db = os.path.join(base_dir, "store.db")
    
    # Check if directory is writable (Vercel / Lambda root is read-only)
    is_writable = False
    try:
        test_file = os.path.join(base_dir, ".write_test")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
        is_writable = True
    except Exception:
        is_writable = False
        
    if is_writable and not os.environ.get("VERCEL") and not os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return default_db
    else:
        tmp_dir = tempfile.gettempdir()
        try:
            os.makedirs(tmp_dir, exist_ok=True)
        except Exception:
            pass
        tmp_db = os.path.join(tmp_dir, "store.db")
        if not os.path.exists(tmp_db) and os.path.exists(default_db):
            try:
                shutil.copy2(default_db, tmp_db)
            except Exception:
                pass
        return tmp_db

DB_PATH = get_db_path()

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS ebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    author TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    sale_price REAL,
    category TEXT NOT NULL,
    cover_image TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_format TEXT NOT NULL,
    file_size_bytes INTEGER DEFAULT 0,
    sample_text TEXT,
    sample_file_path TEXT,
    google_books_url TEXT,
    kindle_url TEXT,
    apple_books_url TEXT,
    is_featured BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    downloads_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bundles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    badge_text TEXT DEFAULT '🔥 BUNDLE SAVER',
    price REAL NOT NULL,
    sale_price REAL NOT NULL,
    ebook_ids TEXT NOT NULL, -- JSON array string e.g. "[1, 2]"
    cover_image TEXT,
    is_featured BOOLEAN DEFAULT 1,
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'flat'
    discount_value REAL NOT NULL,
    min_order_amount REAL DEFAULT 0,
    max_uses INTEGER DEFAULT 1000,
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ebook_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    rating INTEGER NOT NULL DEFAULT 5,
    title TEXT,
    review_text TEXT NOT NULL,
    is_verified_buyer BOOLEAN DEFAULT 1,
    is_ai_generated BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'approved', -- 'approved', 'pending', 'hidden'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ebook_id) REFERENCES ebooks(id)
);

CREATE TABLE IF NOT EXISTS otp_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_whatsapp TEXT NOT NULL,
    ebook_id INTEGER NOT NULL,
    ebook_title TEXT NOT NULL,
    amount REAL NOT NULL,
    original_amount REAL,
    coupon_code TEXT,
    currency TEXT DEFAULT 'INR',
    payment_status TEXT DEFAULT 'completed',
    payment_method TEXT DEFAULT 'razorpay',
    access_token TEXT UNIQUE NOT NULL,
    token_expires_at DATETIME,
    email_status TEXT DEFAULT 'pending',
    email_error TEXT,
    whatsapp_status TEXT DEFAULT 'ready',
    whatsapp_error TEXT,
    download_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(ebook_id) REFERENCES ebooks(id)
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT DEFAULT '',
    auth_provider TEXT DEFAULT 'purchase',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    order_code TEXT,
    transaction_ref TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hero_slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    badge_text TEXT,
    cta_text TEXT DEFAULT 'Explore Collection',
    cta_url TEXT DEFAULT '#bestsellers',
    desktop_image TEXT,
    mobile_image TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""

DEFAULT_SETTINGS = {
    "store_name": "QELVORIA",
    "store_tagline": "Premium Digital Publishing & Ebook Bundles by Raja Rohit Tak",
    "store_currency": "₹",
    "currency_code": "INR",
    "support_email": "rohittak903@gmail.com",
    "support_whatsapp": "+919035630901",
    "email_sender_name": "QELVORIA Publishing (Raja Rohit Tak)",
    "email_from_address": "rohittak903@gmail.com",
    "smtp_enabled": "false",
    "smtp_host": "smtp.gmail.com",
    "smtp_port": "587",
    "smtp_user": "rohittak903@gmail.com",
    "smtp_password": "",
    "smtp_use_tls": "true",
    "bank_account_no": "110076462071",
    "bank_ifsc": "CNRB0002614",
    "bank_name": "Canara Bank",
    "bank_holder_name": "ROHIT TAK",
    "razorpay_enabled": "true",
    "razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID", "rzp_live_TVwW1GpXBFloh7"),
    "razorpay_key_secret": os.environ.get("RAZORPAY_KEY_SECRET", "VN4EU5sjf9zgttRSswGwLmFh"),
    "upi_id": "9035630901@superyes",
    "upi_name": "ROHIT TAK",
    "upi_qr_image": "/uploads/qr/rohit_upi_qr.jpg",
    "announcement_enabled": "true",
    "announcement_text": "🎉 Welcome to QELVORIA: Use coupon code ROHIT20 for 20% OFF! Instant delivery.",
    "announcement_coupon": "ROHIT20",
    "announcement_link": "/#catalog",
    "social_instagram": "https://instagram.com",
    "social_youtube": "https://youtube.com",
    "social_twitter": "https://x.com",
    "social_linkedin": "https://linkedin.com",
    "social_facebook": "",
    "social_telegram": "",
    "social_whatsapp": "https://wa.me/919035630901",
    "whatsapp_mode": "direct_link",
    "whatsapp_api_url": "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages",
    "whatsapp_api_token": "",
    "whatsapp_template": "Hello {customer_name}! 🎉\n\nThank you for purchasing *{ebook_title}* from *QELVORIA*!\n\n📥 You can download your ebook instantly here:\n{download_link}\n\n🧾 Order ID: {order_code}\n\nThank you for choosing QELVORIA by Raja Rohit Tak! Enjoy reading!",
    "email_template": "<h2>Thank you for purchasing from QELVORIA!</h2><p>Dear {customer_name},</p><p>Thank you for purchasing <strong>{ebook_title}</strong> from QELVORIA. Your digital copy is ready for instant download and is attached to this email.</p><p><a href=\"{download_link}\" style=\"background:#0f172a;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;\">📥 Download {ebook_title}</a></p><p><strong>Order ID:</strong> {order_code}</p><p>Best regards,<br/><strong>Raja Rohit Tak</strong><br/>QELVORIA Publishing</p>"
}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

async def get_db():
    db = await aiosqlite.connect(DB_PATH, timeout=30.0)
    db.row_factory = aiosqlite.Row
    return db

async def init_db():
    async with aiosqlite.connect(DB_PATH, timeout=30.0) as db:
        try:
            await db.execute("PRAGMA journal_mode=WAL;")
            await db.execute("PRAGMA busy_timeout=10000;")
        except Exception:
            pass
        await db.executescript(CREATE_TABLES_SQL)
        
        # Migrations for existing columns in ebooks
        try:
            await db.execute("ALTER TABLE ebooks ADD COLUMN google_books_url TEXT")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE ebooks ADD COLUMN kindle_url TEXT")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE ebooks ADD COLUMN apple_books_url TEXT")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE orders ADD COLUMN original_amount REAL")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE orders ADD COLUMN coupon_code TEXT")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE customers ADD COLUMN auth_provider TEXT DEFAULT 'local'")
        except Exception:
            pass
        try:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS admin_sessions (
                    token TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            """)
        except Exception:
            pass

        # Seed default settings if missing
        for key, val in DEFAULT_SETTINGS.items():
            await db.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, val)
            )
            
        await db.execute("UPDATE settings SET value = '₹' WHERE key = 'store_currency' AND (value = '₹100' OR value LIKE '%100%' OR length(value) > 3)")
        await db.execute("DELETE FROM orders WHERE customer_email IN ('test_reader@qelvoria.com', 'test@qelvoria.com', 'john.doe@example.com', 'priya.sharma@example.com', 'customer@example.com', 'mobile.user@example.com')")
        await db.execute("DELETE FROM customers WHERE email IN ('test_reader@qelvoria.com', 'test@qelvoria.com', 'john.doe@example.com', 'priya.sharma@example.com', 'customer@example.com', 'mobile.user@example.com') OR email LIKE '%@phone.ebookvault.com'")
            
        # Seed & Upsert Admin User (Username: RajaRohitTak / Password: Rajatak.com)
        admin_pass_hash = hash_password("Rajatak.com")
        await db.execute(
            "INSERT INTO admins (id, username, password_hash) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash",
            ("RajaRohitTak", admin_pass_hash)
        )

        # Starter ebooks are managed directly via Admin Panel (no auto-seeding)

        # Seed sample coupons if empty
        async with db.execute("SELECT COUNT(*) FROM coupons") as cursor:
            coupon_count = (await cursor.fetchone())[0]
            if coupon_count == 0:
                await db.execute("""
                    INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_uses, is_active)
                    VALUES 
                    ('ROHIT20', 'percentage', 20.0, 0, 1000, 1),
                    ('WELCOME50', 'flat', 50.0, 150, 1000, 1),
                    ('FLAT100', 'flat', 100.0, 250, 1000, 1),
                    ('VIP10', 'percentage', 10.0, 0, 500, 1)
                """)

        # Seed sample bundles if empty or fix empty ebook_ids
        async with db.execute("SELECT id FROM ebooks ORDER BY id ASC LIMIT 2") as book_cursor:
            real_books = await book_cursor.fetchall()
            if len(real_books) >= 2:
                valid_ids = json.dumps([real_books[0][0], real_books[1][0]])
                async with db.execute("SELECT COUNT(*) FROM bundles") as cursor:
                    bundle_count = (await cursor.fetchone())[0]
                    if bundle_count == 0:
                        await db.execute("""
                            INSERT INTO bundles (title, slug, description, badge_text, price, sale_price, ebook_ids, cover_image, is_featured, is_active, sort_order)
                            VALUES (?, 'ai-solopreneur-super-bundle', 'Get both the Python AI Automation Guide and Solopreneur Blueprint at a massive 45% discount! Includes all PDF and Word docs with lifetime updates.', '⚡ 45% OFF MEGA PACK', 498.0, 269.0, ?, '/uploads/covers/python-ai-cover.jpg', 1, 1, 1)
                        """, ("AI & Solopreneur Ultimate Master Bundle (2-in-1)", valid_ids))
                    else:
                        await db.execute("UPDATE bundles SET ebook_ids = ? WHERE id = 1", (valid_ids,))

        # Seed sample reviews if empty
        async with db.execute("SELECT COUNT(*) FROM reviews") as cursor:
            review_count = (await cursor.fetchone())[0]
            if review_count == 0:
                async with db.execute("SELECT id FROM ebooks ORDER BY id ASC LIMIT 2") as book_cursor:
                    sample_books = await book_cursor.fetchall()
                    for bk in sample_books:
                        bkid = bk[0]
                        await db.execute("""
                            INSERT INTO reviews (ebook_id, customer_name, customer_email, rating, title, review_text, is_verified_buyer, is_ai_generated, status)
                            VALUES 
                            (?, 'Vikramaditya S.', 'vikram.s@example.com', 5, 'Exceptional Quality & Clear Steps', 'Delivered to my WhatsApp within 5 seconds of paying via GPay. The PDF and Word templates saved me weeks of work.', 1, 0, 'approved'),
                            (?, 'Ananya Sharma', 'ananya.sh@example.com', 5, 'Highly Recommended!', 'Extremely practical frameworks. I downloaded both PDF and DOCX to study on iPad and laptop.', 1, 1, 'approved'),
                            (?, 'Rohan Mehta', 'rohan.m@example.com', 5, 'Worth Every Rupee', 'The best digital guide I have purchased. The instant email and WhatsApp delivery is super smooth.', 1, 1, 'approved')
                        """, (bkid, bkid, bkid))

        # Seed sample hero slides if empty
        async with db.execute("SELECT COUNT(*) FROM hero_slides") as cursor:
            count = (await cursor.fetchone())[0]
            if count == 0:
                await db.execute("""
                    INSERT INTO hero_slides (title, subtitle, badge_text, cta_text, cta_url, desktop_image, mobile_image, sort_order)
                    VALUES 
                    (
                        'Master In-Demand Skills & Accelerate Your Career',
                        'Download actionable PDF and Word guides in seconds. Instant automated delivery to Email and WhatsApp.',
                        '🔥 Best Seller Spotlight',
                        'Explore Best Sellers',
                        '#bestsellers',
                        '/uploads/covers/python-ai-cover.jpg',
                        '/uploads/covers/python-ai-cover.jpg',
                        1
                    ),
                    (
                        'The Solopreneur Blueprint 2026',
                        'Step-by-step systems to build high-margin digital businesses and freelance agencies.',
                        '⭐ Highly Rated Guide',
                        'Get Your Copy (₹199)',
                        '#catalog',
                        '/uploads/covers/solopreneur-cover.jpg',
                        '/uploads/covers/solopreneur-cover.jpg',
                        2
                    )
                """)

        await db.commit()

async def get_settings() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT key, value FROM settings") as cursor:
            rows = await cursor.fetchall()
            return {row["key"]: row["value"] for row in rows}

async def update_setting(key: str, value: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value)
        )
        await db.commit()
