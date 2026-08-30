from fastapi.testclient import TestClient
from main import app
import json

def test_full_platform():
    with TestClient(app) as client:
        print("\n--- 1. Testing Admin Login with RajaRohitTak / Rajatak.com ---")
        login_res = client.post("/api/auth/unified-login", json={
            "username_or_email": "RajaRohitTak",
            "password": "Rajatak.com"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        login_data = login_res.json()
        assert login_data["role"] == "admin"
        admin_token = login_data["token"]
        print(f"[PASS] Admin login succeeded! Token: {admin_token[:10]}...")

        print("\n--- 2. Testing Admin Change Password API ---")
        change_res = client.post("/api/admin/change-password", headers={
            "Authorization": f"Bearer {admin_token}"
        }, json={
            "current_password": "Rajatak.com",
            "new_password": "Rajatak.com" # keeping it for continued testing
        })
        assert change_res.status_code == 200
        print("[PASS] Admin password change validated successfully.")

        print("\n--- 3. Testing Phone OTP Generation & Verification ---")
        send_otp_res = client.post("/api/auth/otp/send", json={
            "phone": "+919035630901"
        })
        assert send_otp_res.status_code == 200
        otp_data = send_otp_res.json()
        otp_code = otp_data.get("otp_demo")
        assert otp_code is not None
        print(f"[PASS] OTP Generated: {otp_code} for phone {otp_data['phone']}")

        verify_otp_res = client.post("/api/auth/otp/verify", json={
            "phone": "+919035630901",
            "otp_code": otp_code,
            "name": "Rohit Tak"
        })
        assert verify_otp_res.status_code == 200
        cust_data = verify_otp_res.json()
        cust_token = cust_data["token"]
        assert cust_data["user"]["phone"] == "+919035630901"
        print(f"[PASS] OTP verification succeeded! Customer session token generated.")

        print("\n--- 4. Testing Promo Code / Coupon Engine ---")
        coupon_res = client.post("/api/coupons/apply", json={
            "code": "ROHIT20",
            "amount": 299.0
        })
        assert coupon_res.status_code == 200
        c_data = coupon_res.json()
        assert c_data["discount_amount"] == 59.8
        assert c_data["final_amount"] == 239.2
        print(f"[PASS] Coupon 'ROHIT20' applied! Saved: Rs.{c_data['discount_amount']}, Final: Rs.{c_data['final_amount']}")

        print("\n--- 5. Testing Bundle Deals APIs ---")
        bundles_res = client.get("/api/bundles")
        assert bundles_res.status_code == 200
        bundles_data = bundles_res.json()
        assert len(bundles_data["bundles"]) > 0
        b = bundles_data["bundles"][0]
        print(f"[PASS] Found bundle: '{b['title']}' with {len(b.get('books', []))} books bundled for Rs.{b['sale_price']}")

        print("\n--- 6. Testing Dedicated Ebook Details & Reviews API ---")
        ebook_res = client.get("/api/ebooks/1")
        assert ebook_res.status_code == 200
        ebook_data = ebook_res.json()
        assert "title" in ebook_data
        assert "reviews" in ebook_data
        print(f"[PASS] Ebook details loaded: '{ebook_data['title']}' (Avg Rating: {ebook_data.get('avg_rating')} stars, {ebook_data.get('review_count')} reviews)")

        # Submit a customer review
        new_rev_res = client.post("/api/ebooks/1/reviews", json={
            "customer_name": "Test Reader",
            "customer_email": "test@reader.com",
            "rating": 5,
            "title": "Superb guide",
            "review_text": "Detailed and concise guide on AI workflows."
        })
        assert new_rev_res.status_code == 200
        print("[PASS] Review submitted and approved successfully.")

        print("\n--- 7. Testing Razorpay Order Creation (Single with Coupon) ---")
        rzp_order_res = client.post("/api/payment/razorpay/create-order", json={
            "ebook_id": 1,
            "customer_name": "Rohit Customer",
            "customer_email": "rohittak903@gmail.com",
            "customer_whatsapp": "+919035630901",
            "coupon_code": "ROHIT20"
        })
        assert rzp_order_res.status_code == 200
        rzp_data = rzp_order_res.json()
        assert rzp_data["amount_inr"] > 0
        assert rzp_data["coupon_code"] == "ROHIT20"
        print(f"[PASS] Razorpay order created: {rzp_data['order_id']} for Rs.{rzp_data['amount_inr']} (Coupon applied)")

        print("\n--- 8. Testing Razorpay Payment Verification & Instant Dispatch ---")
        verify_pay_res = client.post("/api/payment/razorpay/verify", json={
            "ebook_id": 1,
            "customer_name": "Rohit Customer",
            "customer_email": "rohittak903@gmail.com",
            "customer_whatsapp": "+919035630901",
            "coupon_code": "ROHIT20",
            "razorpay_payment_id": "pay_test12345"
        })
        assert verify_pay_res.status_code == 200
        v_data = verify_pay_res.json()
        assert len(v_data["orders"]) == 1
        assert "download_url" in v_data["orders"][0]
        print(f"[PASS] Order completed and verified! Order Code: {v_data['orders'][0]['order_code']}")

        print("\n=== ALL PLATFORM TESTS PASSED WITH 100% SUCCESS ===")

if __name__ == "__main__":
    test_full_platform()
