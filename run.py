import os
import sys
import subprocess
import uvicorn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, "store.db")

def main():
    print("=" * 60)
    print("  [*] Starting Ebook Store & Instant Delivery Platform")
    print("=" * 60)
    
    # Check if database exists, if not seed samples
    if not os.path.exists(DB_FILE):
        print("[+] Initializing database & generating sample ebooks...")
        subprocess.run([sys.executable, os.path.join(BASE_DIR, "seed_samples.py")], check=True)
    
    print("\n[+] Server is starting:")
    print("   -> Local Storefront:  http://localhost:8000")
    print("   -> Mobile Storefront: http://192.168.31.90:8000 (Open on phone)")
    print("   -> Admin Dashboard:   http://localhost:8000/admin.html")
    print("   -> Default Admin:     admin / admin123")
    print("=" * 60 + "\n")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

if __name__ == "__main__":
    main()
