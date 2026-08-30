import io
import sys
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("\n--- 1. Testing Store Info & Canara Bank Settlement ---")
    res = client.get("/api/store-info")
    assert res.status_code == 200, f"Failed store-info: {res.text}"
    info = res.json()
    assert info.get("bank_account_no") == "110076462071"
    assert info.get("bank_ifsc") == "CNRB0002614"
    assert info.get("bank_name") == "Canara Bank"
    print(f"[OK] Bank Configured: {info['bank_name']} (A/C: {info['bank_account_no']}, IFSC: {info['bank_ifsc']}, Holder: {info['bank_holder_name']})")

    print("\n--- 2. Testing Hero Slides (Public & Admin) ---")
    res = client.get("/api/hero-slides")
    assert res.status_code == 200
    slides = res.json().get("slides", [])
    assert len(slides) > 0
    print(f"[OK] Public Hero Slides loaded: {len(slides)} active banner(s)")

    print("\n--- 3. Testing Unified Login (Admin & Customer) ---")
    admin_login_res = client.post("/api/auth/unified-login", json={"username_or_email": "admin", "password": "admin123"})
    assert admin_login_res.status_code == 200
    admin_data = admin_login_res.json()
    assert admin_data["role"] == "admin"
    admin_token = admin_data["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"[OK] Unified Login (Admin): role={admin_data['role']}, redirect={admin_data['redirect']}")

    # Customer signup & login
    client.post("/api/customer/signup", json={"name": "Rohit Mobile User", "email": "mobile.user@example.com", "phone": "+919876543210", "password": "securepassword123"})
    cust_res = client.post("/api/auth/unified-login", json={"username_or_email": "mobile.user@example.com", "password": "securepassword123"})
    assert cust_res.status_code == 200
    print(f"[OK] Unified Login (Customer): {cust_res.json()['user']['name']}")

    print("\n--- 4. Testing Razorpay Order Creation & Verification ---")
    res = client.get("/api/ebooks")
    ebooks = res.json().get("ebooks", [])
    assert len(ebooks) > 0
    
    # Create Razorpay order
    rzp_order_payload = {
        "ebook_id": ebooks[0]["id"],
        "customer_name": "Rohit Mobile User",
        "customer_email": "mobile.user@example.com",
        "customer_whatsapp": "+919876543210"
    }
    res = client.post("/api/payment/razorpay/create-order", json=rzp_order_payload)
    assert res.status_code == 200, f"Failed Razorpay create-order: {res.text}"
    rzp_order = res.json()
    assert "order_id" in rzp_order
    assert rzp_order["amount"] > 0
    print(f"[OK] Razorpay Order Created: {rzp_order['order_id']} for INR {rzp_order['amount_inr']} ({rzp_order['amount']} paise)")

    # Verify Razorpay order & deliver
    rzp_verify_payload = {
        "ebook_id": ebooks[0]["id"],
        "customer_name": "Rohit Mobile User",
        "customer_email": "mobile.user@example.com",
        "customer_whatsapp": "+919876543210",
        "razorpay_payment_id": "pay_test_123456",
        "razorpay_order_id": rzp_order["order_id"]
    }
    res = client.post("/api/payment/razorpay/verify", json=rzp_verify_payload)
    assert res.status_code == 200, f"Failed Razorpay verify: {res.text}"
    verify_res = res.json()
    assert verify_res["success"] is True
    print(f"[OK] Razorpay Verified & Dispatched: Order {verify_res['orders'][0]['order_code']} -> {verify_res['orders'][0]['download_url']}")

    print("\n--- 5. Testing Customers CRM in Admin Panel ---")
    res = client.get("/api/admin/customers", headers=admin_headers)
    assert res.status_code == 200
    customers = res.json().get("customers", [])
    assert len(customers) > 0
    print(f"[OK] Admin Customers CRM: {len(customers)} registered customer(s) found.")
    for c in customers[:2]:
        print(f"   * {c['name']} ({c['email']}) -> Orders: {c['total_orders']}, Total Spent: INR {c['total_spent']}")

    print("\n" + "=" * 60)
    print("ALL COMPREHENSIVE PLATFORM TESTS (RAZORPAY, HERO SLIDES, CRM) PASSED!")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    run_tests()
