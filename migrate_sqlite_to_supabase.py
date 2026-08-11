import sqlite3
import json
import urllib.request
import urllib.error
import time

# --- CONFIGURATION ---
SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def supabase_request(endpoint, method="GET", data=None, is_auth=False):
    url = f"{SUPABASE_URL}/{endpoint}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    if is_auth:
        url = f"{SUPABASE_URL}/auth/v1/{endpoint}"

    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        req.data = json.dumps(data).encode("utf-8")
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

def migrate():
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.cursor()
    
    user_map = {} # sqlite_id -> supabase_id
    
    # 1. MIGRATE USERS
    print("Migrating users...")
    cursor.execute("SELECT id, name, last_name, email, company_name FROM authentication_registartion")
    users = cursor.fetchall()
    
    for u_id, f_name, l_name, email, company in users:
        print(f" - Importing user: {email}")
        
        # Check if user already exists in Supabase to avoid duplicates
        # We can list users and search by email
        existing = supabase_request(f"admin/users", method="GET", is_auth=True)
        new_id = None
        if existing and 'users' in existing:
            for u in existing['users']:
                if u['email'] == email:
                    new_id = u['id']
                    print(f"   > User already exists: {new_id}")
                    break
        
        if not new_id:
            payload = {
                "email": email,
                "password": "TemporaryPassword123!",
                "email_confirm": True,
                "user_metadata": {
                    "full_name": f"{f_name} {l_name}",
                    "company_name": company
                }
            }
            res = supabase_request("admin/users", method="POST", data=payload, is_auth=True)
            if res and 'id' in res:
                new_id = res['id']
            else:
                print(f"   ! Failed to create user {email}")
                continue

        user_map[u_id] = new_id
        
        # Upsert Profile
        profile_data = {
            "user_id": new_id,
            "first_name": f_name,
            "last_name": l_name,
            "email": email,
            "company_name": company,
            "full_name": f"{f_name} {l_name}"
        }
        supabase_request("rest/v1/profiles", method="POST", data=profile_data)
        
        # Upsert User Role
        role_data = {"user_id": new_id, "role": "user"}
        supabase_request("rest/v1/user_roles", method="POST", data=role_data)

    # Save mapping for safety
    with open("migration_user_map.json", "w") as f:
        json.dump(user_map, f)

    # 2. MIGRATE CLIENTS
    print("Migrating clients...")
    cursor.execute("SELECT id, name, email, phone, address, user_id FROM clients_client")
    clients = cursor.fetchall()
    client_map = {}
    
    for c_id, name, email, phone, address, u_id in clients:
        if u_id not in user_map: continue
        payload = {
            "user_id": user_map[u_id],
            "name": name,
            "email": email,
            "phone": phone,
            "address": address
        }
        res = supabase_request("rest/v1/clients?select=id", method="POST", data=payload)
        if res and isinstance(res, list) and len(res) > 0:
            client_map[c_id] = res[0]['id']

    # 3. MIGRATE PRODUCTS
    print("Migrating products...")
    cursor.execute("SELECT id, name, description, price, user_id FROM products_product")
    products = cursor.fetchall()
    product_map = {}
    
    for p_id, name, desc, price, u_id in products:
        if u_id not in user_map: continue
        payload = {
            "user_id": user_map[u_id],
            "name": name,
            "description": desc,
            "price": float(price or 0)
        }
        res = supabase_request("rest/v1/products?select=id", method="POST", data=payload)
        if res and isinstance(res, list) and len(res) > 0:
            product_map[p_id] = res[0]['id']

    # 4. MIGRATE INVOICES
    print("Migrating invoices...")
    cursor.execute("SELECT id, invoice_number, payment_terms, invoice_date, total_amount, user_id, template_number FROM invoices_invoice")
    invoices_data = cursor.fetchall()
    invoice_map = {}
    
    for i_id, num, terms, date, total, u_id, template in invoices_data:
        if u_id not in user_map: continue
        payload = {
            "user_id": user_map[u_id],
            "invoice_number": num,
            "payment_terms": terms,
            "invoice_date": date,
            "total_amount": float(total or 0),
            "template_number": template
        }
        res = supabase_request("rest/v1/invoices?select=id", method="POST", data=payload)
        if res and isinstance(res, list) and len(res) > 0:
            invoice_map[i_id] = res[0]['id']

    # 5. MIGRATE INVOICE ITEMS
    print("Migrating invoice items...")
    cursor.execute("SELECT quantity, price, discount_key, tax_key, invoice_id, product_id, description FROM invoices_invoiceitem")
    inv_items = cursor.fetchall()
    
    for qty, price, disc_k, tax_k, i_id, prod_id, desc in inv_items:
        if i_id not in invoice_map: continue
        payload = {
            "invoice_id": invoice_map[i_id],
            "name": desc,
            "quantity": qty,
            "price": float(price or 0),
            "discount_key": bool(disc_k),
            "tax_key": bool(tax_k)
        }
        supabase_request("rest/v1/invoice_items", method="POST", data=payload)

    # 6. MIGRATE ESTIMATES
    print("Migrating estimates...")
    cursor.execute("SELECT id, estimate_number, payment_terms, estimate_date, total_amount, user_id, template_number FROM estimates_estimates")
    estimates_data = cursor.fetchall()
    estimate_map = {}
    
    for e_id, num, terms, date, total, u_id, template in estimates_data:
        if u_id not in user_map: continue
        payload = {
            "user_id": user_map[u_id],
            "estimate_number": num,
            "payment_terms": terms,
            "estimate_date": date,
            "total_amount": float(total or 0),
            "template_number": template
        }
        res = supabase_request("rest/v1/estimates?select=id", method="POST", data=payload)
        if res and isinstance(res, list) and len(res) > 0:
            estimate_map[e_id] = res[0]['id']

    # 7. MIGRATE ESTIMATE ITEMS
    print("Migrating estimate items...")
    cursor.execute("SELECT quantity, price, discount_key, tax_key, estimate_id, product_id, description FROM estimates_estimatesitem")
    est_items = cursor.fetchall()
    
    for qty, price, disc_k, tax_k, e_id, prod_id, desc in est_items:
        if e_id not in estimate_map: continue
        payload = {
            "estimate_id": estimate_map[e_id],
            "name": desc,
            "quantity": qty,
            "price": float(price or 0),
            "discount_key": bool(disc_k),
            "tax_key": bool(tax_k)
        }
        supabase_request("rest/v1/estimate_items", method="POST", data=payload)

    print("MIGRATION COMPLETE.")
    conn.close()

    print("MIGRATION COMPLETE.")
    conn.close()

if __name__ == "__main__":
    migrate()
