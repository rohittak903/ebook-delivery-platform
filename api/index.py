import os
import sys
import asyncio

# Ensure root directory is in Python path for Vercel
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from database import init_db
from main import app

# Ensure tables and default settings are initialized in serverless environment
try:
    asyncio.run(init_db())
except Exception as e:
    print(f"Vercel DB Init: {e}")

