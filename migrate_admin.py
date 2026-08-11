import sqlite3
import json
import urllib.request
import urllib.error
import time

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
        # Skip duplicates (409 Conflict)
        if e.code == 409:
            return {"error": "duplicate"}
        print(f"HTTP Error: {e.code} - {body}")
        return {"error": body}
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

def migrate():
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.cursor()
    
    # 1. CLIENTS
    print("Migrating clients...")
    cursor.execute("SELECT id, name, email, phone, address FROM clients_client WHERE user_id = ?", (SQLITE_USER_ID,))
    clients = cursor.fetchall()
    client_map = {} # sqlite_id -> supabase_id
    
    for c_id, name, email, phone, address in clients:
        # Check if exists
        existing = supabase_request(f"rest/v1/clients?user_id=eq.{SUPABASE_USER_ID}&name=eq.{urllib.parse.quote(name)}&select=id")
        if existing and isinstance(existing, list) and len(existing) > 0:
            client_map[c_id] = existing[0]['id']
            print(f" - Client exists: {name}")
            continue
            
        payload = {
            "user_id": SUPABASE_USER_ID,
            "name": name,
            "email": email,
            "phone": phone,
            "address": address
        }
        res = supabase_request("rest/v1/clients", method="POST", data=payload)
        if res and isinstance(res, list) and len(res) > 0:
            client_map[c_id] = res[0]['id']
            print(f" - Imported client: {name}")

    # 2. PRODUCTS
    print("\nMigrating products...")
    cursor.execute("SELECT id, name, description, price FROM products_product WHERE user_id = ?", (SQLITE_USER_ID,))
    products = cursor.fetchall()
    product_map = {}
    
    for p_id, name, desc, price in products:
        existing = supabase_request(f"rest/v1/products?user_id=eq.{SUPABASE_USER_ID}&name=eq.{urllib.parse.quote(name)}&select=id")
        if existing and isinstance(existing, list) and len(existing) > 0:
            product_map[p_id] = existing[0]['id']
            print(f" - Product exists: {name}")
            continue
            
        payload = {
            "user_id": SUPABASE_USER_ID,
            "name": name,
            "description": desc,
            "price": float(price or 0)
        }
        res = supabase_request("rest/v1/products", method="POST", data=payload)
        if res and isinstance(res, list) and len(res) > 0:
            product_map[p_id] = res[0]['id']
            print(f" - Imported product: {name}")

    # 3. INVOICES
    print("\nMigrating invoices...")
    cursor.execute("SELECT id, invoice_number, payment_terms, invoice_date, due_date, total_amount, template_number, notes FROM invoices_invoice WHERE user_id = ?", (SQLITE_USER_ID,))
    invoices = cursor.fetchall()
    
    for i_id, num, terms, date, due, total, template, notes in invoices:
        existing = supabase_request(f"rest/v1/invoices?user_id=eq.{SUPABASE_USER_ID}&invoice_number=eq.{num}&select=id")
        if existing and isinstance(existing, list) and len(existing) > 0:
            new_inv_id = existing[0]['id']
            print(f" - Invoice exists: {num}")
        else:
            payload = {
                "user_id": SUPABASE_USER_ID,
                "invoice_number": num,
                "payment_terms": terms,
                "invoice_date": date,
                "due_date": due,
                "total_amount": float(total or 0),
                "template_number": template,
                "notes": notes
            }
            res = supabase_request("rest/v1/invoices", method="POST", data=payload)
            if res and isinstance(res, list) and len(res) > 0:
                new_inv_id = res[0]['id']
                print(f" - Imported invoice: {num}")
            else:
                continue

        # Migrate Items for this invoice
        cursor.execute("SELECT quantity, price, discount_key, tax_key, product_id, description FROM invoices_invoiceitem WHERE invoice_id = ?", (i_id,))
        items = cursor.fetchall()
        for qty, prc, disc, tax, prod_id, desc in items:
            # Check if item exists (simple check by name/desc)
            item_exists = supabase_request(f"rest/v1/invoice_items?invoice_id=eq.{new_inv_id}&name=eq.{urllib.parse.quote(desc or '')}&select=id")
            if item_exists and isinstance(item_exists, list) and len(item_exists) > 0:
                continue
                
            item_payload = {
                "invoice_id": new_inv_id,
                "name": desc or "",
                "quantity": qty,
                "price": float(prc or 0),
                "discount_key": bool(disc),
                "tax_key": bool(tax)
            }
            if prod_id and prod_id in product_map:
                item_payload["product_id"] = product_map[prod_id]
            
            supabase_request("rest/v1/invoice_items", method="POST", data=item_payload)

    # 4. ESTIMATES
    print("\nMigrating estimates...")
    cursor.execute("SELECT id, estimate_number, payment_terms, estimate_date, due_date, total_amount, template_number, notes FROM estimates_estimates WHERE user_id = ?", (SQLITE_USER_ID,))
    estimates = cursor.fetchall()
    
    for e_id, num, terms, date, due, total, template, notes in estimates:
        existing = supabase_request(f"rest/v1/estimates?user_id=eq.{SUPABASE_USER_ID}&estimate_number=eq.{num}&select=id")
        if existing and isinstance(existing, list) and len(existing) > 0:
            new_est_id = existing[0]['id']
            print(f" - Estimate exists: {num}")
        else:
            payload = {
                "user_id": SUPABASE_USER_ID,
                "estimate_number": num,
                "payment_terms": terms,
                "estimate_date": date,
                "due_date": due,
                "total_amount": float(total or 0),
                "template_number": template,
                "notes": notes
            }
            res = supabase_request("rest/v1/estimates", method="POST", data=payload)
            if res and isinstance(res, list) and len(res) > 0:
                new_est_id = res[0]['id']
                print(f" - Imported estimate: {num}")
            else:
                continue

        # Items
        cursor.execute("SELECT quantity, price, discount_key, tax_key, product_id, description FROM estimates_estimatesitem WHERE estimate_id = ?", (e_id,))
        items = cursor.fetchall()
        for qty, prc, disc, tax, prod_id, desc in items:
            item_exists = supabase_request(f"rest/v1/estimate_items?estimate_id=eq.{new_est_id}&name=eq.{urllib.parse.quote(desc or '')}&select=id")
            if item_exists and isinstance(item_exists, list) and len(item_exists) > 0:
                continue
            item_payload = {
                "estimate_id": new_est_id,
                "name": desc or "",
                "quantity": qty,
                "price": float(prc or 0),
                "discount_key": bool(disc),
                "tax_key": bool(tax)
            }
            if prod_id and prod_id in product_map:
                item_payload["product_id"] = product_map[prod_id]
            supabase_request("rest/v1/estimate_items", method="POST", data=item_payload)

    # 5. AI ESTIMATES
    print("\nMigrating AI estimates...")
    cursor.execute("SELECT id, name, address, description, client_id FROM estimates_aiestimate WHERE user_id = ?", (SQLITE_USER_ID,))
    ai_ests = cursor.fetchall()
    
    for a_id, name, addr, desc, c_id in ai_ests:
        existing = supabase_request(f"rest/v1/ai_estimates?user_id=eq.{SUPABASE_USER_ID}&name=eq.{urllib.parse.quote(name or '')}&select=id")
        if existing and isinstance(existing, list) and len(existing) > 0:
            new_ai_id = existing[0]['id']
            print(f" - AI Estimate exists: {name}")
        else:
            payload = {
                "user_id": SUPABASE_USER_ID,
                "name": name or "Unnamed AI Estimate",
                "address": addr,
                "description": desc
            }
            if c_id and c_id in client_map:
                payload["client_id"] = client_map[c_id]
            
            res = supabase_request("rest/v1/ai_estimates", method="POST", data=payload)
            if res and isinstance(res, list) and len(res) > 0:
                new_ai_id = res[0]['id']
                print(f" - Imported AI estimate: {name}")
            else:
                continue

        # Results
        cursor.execute("SELECT id, page_number, status, credits_deducted, output_json, output_markdown FROM estimates_aiestimateresult WHERE estimate_id = ?", (a_id,))
        results = cursor.fetchall()
        for r_id, pg, status, creds, o_json, o_md in results:
            res_exists = supabase_request(f"rest/v1/ai_estimate_results?ai_estimate_id=eq.{new_ai_id}&page_number=eq.{pg}&select=id")
            if res_exists and isinstance(res_exists, list) and len(res_exists) > 0:
                continue
                
            res_payload = {
                "ai_estimate_id": new_ai_id,
                "page_number": pg,
                "output_json": json.loads(o_json) if o_json else None,
                "output_markdown": o_md
            }
            supabase_request("rest/v1/ai_estimate_results", method="POST", data=res_payload)

    print("\nMigration for admin@bethelstonecorp.com finished.")
    conn.close()

if __name__ == "__main__":
    migrate()
