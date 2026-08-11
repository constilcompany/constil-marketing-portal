import json
import urllib.request
import sqlite3

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

SQLITE_USER_ID = "e4282086cb4c4e68a6b759e8e12a57c8"
SUPABASE_USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

def post_to_supabase(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates" # Upsert if possible
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), method='POST', headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            print(f" ✅ Pushed to {table}")
    except Exception as e:
        print(f" ❌ Error pushing to {table}: {e}")

def migrate():
    conn = sqlite3.connect('db.sqlite3')
    cursor = conn.cursor()

    # 1. Update Profile (authentication_registartion)
    cursor.execute("SELECT first_name, last_name, email FROM authentication_registartion WHERE id=?", (SQLITE_USER_ID,))
    user = cursor.fetchone()
    if user:
        profile_data = {
            "user_id": SUPABASE_USER_ID,
            "full_name": f"{user[0]} {user[1]}".strip(),
            "email": user[2]
        }
        # profiles uses user_id as PK, we use PATCH or POST with upsert
        post_to_supabase("profiles", profile_data)

    # 2. Update Company Profile
    cursor.execute("SELECT company_legal_name, company_email, company_phone, address, logo FROM authentication_companyprofilemodel WHERE user_id=?", (SQLITE_USER_ID,))
    comp = cursor.fetchone()
    if comp:
        comp_data = {
            "user_id": SUPABASE_USER_ID,
            "company_name": comp[0],
            "company_email": comp[1],
            "company_phone": comp[2],
            "address": comp[3],
            "logo_url": comp[4]
        }
        post_to_supabase("company_profiles", comp_data)

    # 3. Products
    cursor.execute("SELECT name, description, price, ref FROM products_product WHERE user_id=?", (SQLITE_USER_ID,))
    for row in cursor.fetchall():
        post_to_supabase("products", {
            "user_id": SUPABASE_USER_ID,
            "name": row[0],
            "description": row[1],
            "price": float(row[2]),
            "ref": row[3]
        })

    # 4. Clients
    cursor.execute("SELECT name, address, phone, email FROM clients_client WHERE user_id=?", (SQLITE_USER_ID,))
    for row in cursor.fetchall():
        post_to_supabase("clients", {
            "user_id": SUPABASE_USER_ID,
            "name": row[0],
            "address": row[1],
            "phone": row[2],
            "email": row[3]
        })

    conn.close()

if __name__ == "__main__":
    migrate()
