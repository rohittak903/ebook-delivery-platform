import aiosqlite
import os
import sys
import shutil
import hashlib
import json
from datetime import datetime

# Serverless DB Path Handling (Vercel has read-only root, /tmp is writable)
DEFAULT_DB = os.path.join(os.path.dirname(__file__), "store.db")
if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    TMP_DB = "/tmp/store.db"
    if not os.path.exists(TMP_DB) and os.path.exists(DEFAULT_DB):
        shutil.copy2(DEFAULT_DB, TMP_DB)
    DB_PATH = TMP_DB
else:
    DB_PATH = DEFAULT_DB

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
    is_featured BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    downloads_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    currency TEXT DEFAULT 'USD',
    payment_status TEXT DEFAULT 'completed',
    payment_method TEXT DEFAULT 'instant_demo',
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
    password_hash TEXT NOT NULL,
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
"""

DEFAULT_SETTINGS = {
    "store_name": "EBookVault - Instant Digital Delivery",
    "store_tagline": "Premium Ebooks Delivered Instantly to Your Email & WhatsApp",
    "store_currency": "₹",
    "currency_code": "INR",
    "support_email": "rohittak903@gmail.com",
    "support_whatsapp": "+919876543210",
    "email_sender_name": "Rohit Tak (EBookVault)",
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
    "razorpay_key_id": "rzp_live_9035630901",
    "razorpay_key_secret": "",
    "upi_id": "9035630901@superyes",
    "upi_name": "ROHIT TAK",
    "upi_qr_image": "/uploads/qr/rohit_upi_qr.jpg",
    "whatsapp_mode": "direct_link",
    "whatsapp_api_url": "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages",
    "whatsapp_api_token": "",
    "whatsapp_template": "Hello {customer_name}! 🎉\n\nThank you for purchasing *{ebook_title}*!\n\n📥 You can download your ebook instantly here:\n{download_link}\n\n🧾 Order ID: {order_code}\n\nIf you need any help, reply to this message. Enjoy reading!",
    "email_template": "<h2>Thank you for purchasing {ebook_title}!</h2><p>Dear {customer_name},</p><p>Thank you for purchasing from us! Your ebook <strong>{ebook_title}</strong> is ready for instant download and is also attached to this email.</p><p><a href=\"{download_link}\" style=\"background:#4f46e5;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;\">📥 Download {ebook_title}</a></p><p><strong>Order ID:</strong> {order_code}</p><p>Thank you for your trust and happy reading!<br/>Best regards,<br/><strong>Rohit Tak</strong></p>"
}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(CREATE_TABLES_SQL)
        
        # Seed default settings if missing
        for key, val in DEFAULT_SETTINGS.items():
            await db.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, val)
            )
            
        # Seed default admin user (admin / admin123)
        default_admin_hash = hash_password("admin123")
        await db.execute(
            "INSERT OR IGNORE INTO admins (id, username, password_hash) VALUES (1, ?, ?)",
            ("admin", default_admin_hash)
        )

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
