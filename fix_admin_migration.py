import sqlite3
import json
import urllib.request
import urllib.error

# --- CONFIGURATION ---
SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

SQLITE_USER_ID = "e4282086cb4c4e68a6b759e8e12a57c8"
SUPABASE_USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

def supabase_request(endpoint, method="GET", data=None):
    url = f"{SUPABASE_URL}/{endpoint}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Error: {e}")
        return None

def fix():
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.cursor()
    
    # Map SQLite client IDs to Supabase client IDs
    print("Mapping clients...")
    cursor.execute("SELECT id, name FROM clients_client WHERE user_id = ?", (SQLITE_USER_ID,))
    clients = cursor.fetchall()
    client_map = {}
    for c_id, name in clients:
        existing = supabase_request(f"rest/v1/clients?user_id=eq.{SUPABASE_USER_ID}&name=eq.{urllib.parse.quote(name)}&select=id")
        if existing:
            client_map[c_id] = existing[0]['id']

    # 1. FIX INVOICES
    print("Fixing invoices...")
    url = f"rest/v1/invoices?user_id=eq.{SUPABASE_USER_ID}&select=id,invoice_number"
    invoices = supabase_request(url)
    if invoices:
        for inv in invoices:
            num = inv['invoice_number']
            inv_id = inv['id']
            
            # Find in SQLite
            cursor.execute("SELECT id, total_amount FROM invoices_invoice WHERE user_id = ? AND invoice_number = ?", (SQLITE_USER_ID, num))
            row = cursor.fetchone()
            if row:
                sq_id, total = row
                # Find client from items
                cursor.execute("SELECT client_id FROM invoices_invoiceitem WHERE invoice_id = ? LIMIT 1", (sq_id,))
                c_row = cursor.fetchone()
                
                payload = {"total": float(total or 0)}
                if c_row and c_row[0] in client_map:
                    payload["client_id"] = client_map[c_row[0]]
                
                supabase_request(f"rest/v1/invoices?id=eq.{inv_id}", method="PATCH", data=payload)
                print(f" - Fixed invoice: {num}")

    # 2. FIX ESTIMATES
    print("\nFixing estimates...")
    url = f"rest/v1/estimates?user_id=eq.{SUPABASE_USER_ID}&select=id,estimate_number"
    estimates = supabase_request(url)
    if estimates:
        for est in estimates:
            num = est['estimate_number']
            est_id = est['id']
            
            # Find in SQLite
            cursor.execute("SELECT id, total_amount FROM estimates_estimates WHERE user_id = ? AND estimate_number = ?", (SQLITE_USER_ID, num))
            row = cursor.fetchone()
            if row:
                sq_id, total = row
                # Find client from items
                cursor.execute("SELECT client_id FROM estimates_estimatesitem WHERE estimate_id = ? LIMIT 1", (sq_id,))
                c_row = cursor.fetchone()
                
                payload = {"total": float(total or 0)}
                if c_row and c_row[0] in client_map:
                    payload["client_id"] = client_map[c_row[0]]
                
                supabase_request(f"rest/v1/estimates?id=eq.{est_id}", method="PATCH", data=payload)
                print(f" - Fixed estimate: {num}")

    conn.close()
    print("\nFixup finished.")

if __name__ == "__main__":
    fix()
