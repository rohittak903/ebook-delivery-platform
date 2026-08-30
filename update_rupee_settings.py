import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "store.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Update settings
settings_to_update = {
    "store_currency": "₹",
    "currency_code": "INR",
    "support_email": "rohittak903@gmail.com",
    "email_from_address": "rohittak903@gmail.com",
    "email_sender_name": "Rohit Tak (EBookVault)",
    "smtp_user": "rohittak903@gmail.com",
    "email_template": "<h2>Thank you for purchasing {ebook_title}!</h2><p>Dear {customer_name},</p><p>Thank you for purchasing from us! Your ebook <strong>{ebook_title}</strong> is ready for instant download and is also attached to this email.</p><p><a href=\"{download_link}\" style=\"background:#4f46e5;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;\">Download {ebook_title}</a></p><p><strong>Order ID:</strong> {order_code}</p><p>Thank you for your trust and happy reading!<br/>Best regards,<br/><strong>Rohit Tak</strong></p>",
    "whatsapp_template": "Hello {customer_name}! 🎉\n\nThank you for purchasing *{ebook_title}*!\n\n📥 You can download your ebook instantly here:\n{download_link}\n\n🧾 Order ID: {order_code}\n\nIf you need any help, reply to this message. Enjoy reading!"
}

for key, val in settings_to_update.items():
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, val))

# Update sample ebook prices to standard INR amounts
sample_prices = [
    (299.0, 199.0, "mastering-python-ai-automation%"),
    (499.0, 299.0, "modern-solopreneur-blueprint%"),
    (399.0, 249.0, "zero-to-financial-freedom%"),
    (349.0, 199.0, "freelancer-mastery-high-ticket%")
]

for price, sale_price, slug_pat in sample_prices:
    cursor.execute("UPDATE ebooks SET price = ?, sale_price = ? WHERE slug LIKE ?", (price, sale_price, slug_pat))

conn.commit()
conn.close()
print("[OK] Updated SQLite database settings to Rupee and sender rohittak903@gmail.com successfully!")
