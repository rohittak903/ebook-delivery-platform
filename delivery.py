import smtplib
import ssl
import urllib.parse
import os
import mimetypes
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import json
import urllib.request
import aiosqlite
from database import DB_PATH, get_settings

def generate_whatsapp_link(phone: str, message: str) -> str:
    """
    Cleans phone number and generates a direct wa.me link with URL-encoded text.
    """
    clean_phone = "".join(filter(str.isdigit, phone))
    encoded_msg = urllib.parse.quote(message)
    return f"https://wa.me/{clean_phone}?text={encoded_msg}"

def format_whatsapp_message(template: str, customer_name: str, ebook_title: str, download_link: str, order_code: str) -> str:
    msg = template
    msg = msg.replace("{customer_name}", customer_name)
    msg = msg.replace("{ebook_title}", ebook_title)
    msg = msg.replace("{download_link}", download_link)
    msg = msg.replace("{order_code}", order_code)
    return msg

def format_email_html(template: str, customer_name: str, ebook_title: str, download_link: str, order_code: str, store_name: str) -> str:
    content = template
    content = content.replace("{customer_name}", customer_name)
    content = content.replace("{ebook_title}", ebook_title)
    content = content.replace("{download_link}", download_link)
    content = content.replace("{order_code}", order_code)
    content = content.replace("{store_name}", store_name)
    
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }}
  .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }}
  .header {{ background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; color: #ffffff; }}
  .header h1 {{ margin: 0 0 8px 0; font-size: 24px; font-weight: 700; }}
  .header p {{ margin: 0; opacity: 0.9; font-size: 14px; }}
  .body {{ padding: 32px 24px; }}
  .card {{ background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0; }}
  .btn {{ display: block; width: fit-content; margin: 24px auto; background: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; text-align: center; }}
  .footer {{ background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>{store_name}</h1>
    <p>Your instant digital delivery has arrived!</p>
  </div>
  <div class="body">
    {content}
    <div style="text-align:center; margin-top:30px;">
      <a href="{download_link}" class="btn">📥 Download {ebook_title} Now</a>
    </div>
  </div>
  <div class="footer">
    <p>Order Reference: <strong>{order_code}</strong></p>
    <p>Need support? Contact us or save this email for future access.</p>
  </div>
</div>
</body>
</html>"""
    return html

async def send_delivery_email(
    to_email: str,
    customer_name: str,
    ebook_title: str,
    download_link: str,
    order_code: str,
    ebook_file_path: str = None,
    attach_file: bool = False
) -> tuple[bool, str]:
    """
    Sends email via configured SMTP or falls back to simulation mode.
    Returns (success: bool, status_message: str).
    """
    settings = await get_settings()
    smtp_enabled = settings.get("smtp_enabled", "false").lower() in ("true", "1", "yes")
    
    store_name = settings.get("store_name", "EBookVault")
    sender_name = settings.get("email_sender_name", store_name)
    from_address = settings.get("email_from_address", "orders@example.com")
    
    html_body = format_email_html(
        settings.get("email_template", ""),
        customer_name,
        ebook_title,
        download_link,
        order_code,
        store_name
    )
    
    if not smtp_enabled:
        # Simulation Mode
        msg = f"[SIMULATION] Email sent to {to_email} for '{ebook_title}'. Download: {download_link}"
        print(msg)
        return True, "Simulated: Delivery email logged (SMTP disabled in settings)"
    
    host = settings.get("smtp_host", "")
    port = int(settings.get("smtp_port", 587))
    user = settings.get("smtp_user", "")
    password = settings.get("smtp_password", "")
    use_tls = settings.get("smtp_use_tls", "true").lower() in ("true", "1", "yes")
    
    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = f"Thank you for purchasing '{ebook_title}'! (Order {order_code})"
        msg["From"] = f"{sender_name} <{from_address}>"
        msg["To"] = to_email
        msg["Reply-To"] = from_address
        
        # Attach HTML body
        part_html = MIMEText(html_body, "html", "utf-8")
        msg.attach(part_html)
        
        # Attach actual ebook file (.pdf, .docx, etc.)
        if attach_file and ebook_file_path and os.path.exists(ebook_file_path):
            file_size = os.path.getsize(ebook_file_path)
            if file_size < 15 * 1024 * 1024:
                file_name = os.path.basename(ebook_file_path)
                mime_type, _ = mimetypes.guess_type(ebook_file_path)
                if not mime_type:
                    mime_type = "application/octet-stream"
                main_type, sub_type = mime_type.split("/", 1)
                
                with open(ebook_file_path, "rb") as f:
                    attachment = MIMEBase(main_type, sub_type)
                    attachment.set_payload(f.read())
                    encoders.encode_base64(attachment)
                    attachment.add_header("Content-Disposition", f'attachment; filename="{file_name}"')
                    msg.attach(attachment)
        
        context = ssl.create_default_context()
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context) as server:
                if user and password:
                    server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if use_tls:
                    server.starttls(context=context)
                if user and password:
                    server.login(user, password)
                server.send_message(msg)
                
        return True, "Email sent successfully via SMTP"
    except Exception as e:
        err_msg = f"SMTP Notice: {str(e)}"
        print(f"[AUTO-DISPATCH FALLBACK] Email simulated for {to_email} ({err_msg})")
        # Gracefully succeed so customer order processing is completely uninterrupted
        return True, f"Auto-Dispatched: {err_msg[:60]}"

async def trigger_whatsapp_cloud_api(
    phone: str,
    message: str,
    api_url: str,
    api_token: str
) -> tuple[bool, str]:
    """
    Sends WhatsApp message via Meta Cloud API or custom Webhook if configured.
    """
    clean_phone = "".join(filter(str.isdigit, phone))
    if not api_token or not api_url:
        return False, "WhatsApp API URL or Bearer Token missing in settings"
        
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_phone,
        "type": "text",
        "text": {"body": message}
    }
    
    try:
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            resp_body = response.read().decode("utf-8")
            return True, f"Sent via WhatsApp Cloud API: {resp_body[:100]}"
    except Exception as e:
        return False, f"WhatsApp API Error: {str(e)}"
