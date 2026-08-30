import os
import hmac
import hashlib
import json
from fastapi.testclient import TestClient
from main import app, get_razorpay_keys

def test_razorpay_integration():
    print("=== TESTING RAZORPAY STANDARD WEB CHECKOUT INTEGRATION ===")
    
    with TestClient(app) as client:
        # 1. Test Client Keys
        key_id, key_secret = get_razorpay_keys()
        print(f"[PASS] Razorpay Configured Key ID: {key_id}")
        assert key_id == "rzp_live_TVwW1GpXBFloh7"
        assert key_secret == "VN4EU5sjf9zgttRSswGwLmFh"
        
        # Get active book ID
        eb_res = client.get("/api/ebooks")
        ebooks = eb_res.json().get("ebooks", [])
        test_eid = ebooks[0]["id"] if ebooks else 6

        # 2. Test Create Order API
        order_payload = {
            "ebook_id": test_eid,
            "customer_name": "Rohit Tester",
            "customer_email": "test_reader@qelvoria.com",
            "customer_whatsapp": "+919035630901"
        }
        res = client.post("/api/create-order", json=order_payload)
        assert res.status_code == 200, f"Order creation failed: {res.text}"
        order_data = res.json()
        print(f"[PASS] Order created via POST /api/create-order: {order_data['order_id']} for Rs.{order_data['amount_inr']}")
        assert order_data["amount"] >= 100
        assert order_data["currency"] == "INR"
        assert order_data["key_id"] == "rzp_live_TVwW1GpXBFloh7"
        
        order_id = order_data["order_id"]
        payment_id = "pay_test_9035630901_rzp"
        
        # 3. Test Signature Mismatch (Tampered Signature -> Expect 400)
        invalid_sig_payload = {
            "ebook_id": test_eid,
            "customer_name": "Rohit Tester",
            "customer_email": "test_reader@qelvoria.com",
            "customer_whatsapp": "+919035630901",
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": "invalid_fake_tampered_signature_12345"
        }
        tamper_res = client.post("/api/verify-payment", json=invalid_sig_payload)
        assert tamper_res.status_code == 400, "Tampered signature should return 400"
        print("[PASS] Tampered payment signature was strictly rejected with 400 Bad Request!")
        
        # 4. Test Genuine HMAC-SHA256 Signature Verification
        msg = f"{order_id}|{payment_id}"
        valid_signature = hmac.new(
            key_secret.encode("utf-8"),
            msg.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        valid_sig_payload = {
            "ebook_id": test_eid,
            "customer_name": "Rohit Tester",
            "customer_email": "test_reader@qelvoria.com",
            "customer_whatsapp": "+919035630901",
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_signature
        }
        verify_res = client.post("/api/verify-payment", json=valid_sig_payload)
        assert verify_res.status_code == 200, f"Valid signature verification failed: {verify_res.text}"
        verify_data = verify_res.json()
        print(f"[PASS] Valid signature verified! Order code: {verify_data['orders'][0]['order_code']}")
        print(f"[PASS] Instant download link generated: {verify_data['orders'][0]['download_url']}")
        
        # Cleanup test order & test customer from DB so live dashboard is never polluted
        import sqlite3
        con = sqlite3.connect("store.db")
        con.execute("DELETE FROM orders WHERE customer_email = 'test_reader@qelvoria.com'")
        con.execute("DELETE FROM customers WHERE email = 'test_reader@qelvoria.com'")
        con.commit()
        con.close()

        print("\n=== ALL RAZORPAY STANDARD CHECKOUT TESTS PASSED 100% ===")

if __name__ == "__main__":
    test_razorpay_integration()
