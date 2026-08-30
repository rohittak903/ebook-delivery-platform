import asyncio
import aiosqlite
from database import DB_PATH

async def update_brand():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT INTO settings (key, value) VALUES ('store_name', 'QELVORIA') ON CONFLICT(key) DO UPDATE SET value = 'QELVORIA'")
        await db.execute("INSERT INTO settings (key, value) VALUES ('store_tagline', 'Premium Digital Publishing & Ebooks by Raja Rohit Tak') ON CONFLICT(key) DO UPDATE SET value = 'Premium Digital Publishing & Ebooks by Raja Rohit Tak'")
        await db.execute("INSERT INTO settings (key, value) VALUES ('email_sender_name', 'QELVORIA Publishing (Raja Rohit Tak)') ON CONFLICT(key) DO UPDATE SET value = 'QELVORIA Publishing (Raja Rohit Tak)'")
        await db.commit()
        print("[OK] Brand name updated to QELVORIA in database settings!")

if __name__ == "__main__":
    asyncio.run(update_brand())
