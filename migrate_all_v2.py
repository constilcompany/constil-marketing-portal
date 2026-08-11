import sqlite3
import json
import urllib.request
import urllib.error
import time

# --- CONFIGURATION ---
SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"
TARGET_USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

def supabase_request(endpoint, method="POST", data=None):
    url = f"{SUPABASE_URL}/{endpoint}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        req.data = json.dumps(data).encode("utf-8")
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f"HTTP Error {e.code} on {endpoint}: {body}")
        return None
    except Exception as e:
        print(f"Error on {endpoint}: {e}")
        return None

def migrate():
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.cursor()
    
    # 1. Migrate Clients
    print("Migrating clients...")
    cursor.execute("SELECT id, name, email, phone, address FROM clients_client")
    clients = cursor.fetchall()
    client_map = {} # sqlite_id -> supabase_id
    
    for c_id, name, email, phone, address in clients:
        payload = {
            "user_id": TARGET_USER_ID,
            "name": name,
            "email": email,
            "phone": phone,
            "address": address
        }
        res = supabase_request("rest/v1/clients", data=payload)
        if res and len(res) > 0:
            client_map[c_id] = res[0]['id']

    # 2. Migrate Products
    print("Migrating products...")
    cursor.execute("SELECT id, name, description, price FROM products_product")
    products = cursor.fetchall()
    product_map = {}
    
    for p_id, name, desc, price in products:
        payload = {
            "user_id": TARGET_USER_ID,
            "name": name,
            "description": desc,
            "unit_price": float(price or 0)
        }
        res = supabase_request("rest/v1/products", data=payload)
        if res and len(res) > 0:
            product_map[p_id] = res[0]['id']

    # 3. Migrate Invoices
    print("Migrating invoices...")
    cursor.execute("SELECT id, invoice_number, payment_terms, invoice_date, total_amount, template_number FROM invoices_invoice")
    invoices = cursor.fetchall()
    invoice_map = {}
    
    for i_id, num, terms, date, total, template in invoices:
        # Find client from first item
        cursor.execute("SELECT client_id FROM invoices_invoiceitem WHERE invoice_id = ? LIMIT 1", (i_id,))
        item_client = cursor.fetchone()
        c_id = item_client[0] if item_client else None

        payload = {
            "user_id": TARGET_USER_ID,
            "invoice_number": num,
            "payment_terms": terms,
            "invoice_date": date,
            "total_amount": float(total or 0),
            "template_number": template or 1,
            "client_id": client_map.get(c_id)
        }
        res = supabase_request("rest/v1/invoices", data=payload)
        if res and len(res) > 0:
            invoice_map[i_id] = res[0]['id']

    # 4. Migrate Invoice Items
    print("Migrating invoice items...")
    cursor.execute("SELECT quantity, price, description, invoice_id, product_id, client_id FROM invoices_invoiceitem")
    items = cursor.fetchall()
    for qty, price, desc, i_id, p_id, c_id in items:
        if i_id not in invoice_map: continue
        payload = {
            "invoice_id": invoice_map[i_id],
            "name": desc or "Item",
            "quantity": qty,
            "price": float(price or 0),
            "product_id": product_map.get(p_id),
            "client_id": client_map.get(c_id)
        }
        supabase_request("rest/v1/invoice_items", data=payload)

    # 5. Migrate Estimates
    print("Migrating estimates...")
    cursor.execute("SELECT id, estimate_number, payment_terms, estimate_date, total_amount, template_number FROM estimates_estimates")
    estimates = cursor.fetchall()
    estimate_map = {}
    
    for e_id, num, terms, date, total, template in estimates:
        # Find client from first item
        cursor.execute("SELECT client_id FROM estimates_estimatesitem WHERE estimate_id = ? LIMIT 1", (e_id,))
        item_client = cursor.fetchone()
        c_id = item_client[0] if item_client else None

        payload = {
            "user_id": TARGET_USER_ID,
            "estimate_number": num,
            "payment_terms": terms,
            "estimate_date": date,
            "total_amount": float(total or 0),
            "template_number": template or 1,
            "client_id": client_map.get(c_id)
        }
        res = supabase_request("rest/v1/estimates", data=payload)
        if res and len(res) > 0:
            estimate_map[e_id] = res[0]['id']

    # 6. Migrate Estimate Items
    print("Migrating estimate items...")
    cursor.execute("SELECT quantity, price, description, estimate_id, product_id, client_id FROM estimates_estimatesitem")
    items = cursor.fetchall()
    for qty, price, desc, e_id, p_id, c_id in items:
        if e_id not in estimate_map: continue
        payload = {
            "estimate_id": estimate_map[e_id],
            "name": desc or "Item",
            "quantity": qty,
            "price": float(price or 0),
            "product_id": product_map.get(p_id),
            "client_id": client_map.get(c_id)
        }
        supabase_request("rest/v1/estimate_items", data=payload)

    # 7. Migrate AI Estimates
    print("Migrating AI estimates...")
    cursor.execute("SELECT id, name, client_id FROM estimates_aiestimate")
    ai_ests = cursor.fetchall()
    ai_map = {}
    for a_id, name, c_id in ai_ests:
        payload = {
            "user_id": TARGET_USER_ID,
            "project_name": name,
            "status": "completed",
            "client_id": client_map.get(c_id)
        }
        res = supabase_request("rest/v1/ai_estimates", data=payload)
        if res and len(res) > 0:
            ai_map[a_id] = res[0]['id']

    # 8. Migrate AI Results
    print("Migrating AI results...")
    cursor.execute("SELECT estimate_id, output_json, status FROM estimates_aiestimateresult")
    results = cursor.fetchall()
    for a_id, data, status in results:
        if a_id not in ai_map: continue
        payload = {
            "ai_estimate_id": ai_map[a_id],
            "result_data": data,
            "status": "completed"
        }
        supabase_request("rest/v1/ai_estimate_results", data=payload)

    print("--- MIGRATION FINISHED SUCCESSFULLY ---")
    conn.close()

if __name__ == "__main__":
    migrate()
