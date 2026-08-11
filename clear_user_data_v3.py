import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

def get_list(table, user_field="user_id"):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{user_field}=eq.{USER_ID}&select=id"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            return [str(item['id']) for item in data]
    except:
        return []

def delete_by_id(table, id_list, id_field="id"):
    if not id_list: return
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    ids_str = ",".join(id_list)
    url = f"{SUPABASE_URL}/rest/v1/{table}?{id_field}=in.({ids_str})"
    req = urllib.request.Request(url, method='DELETE', headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            print(f" ✅ Cleared {len(id_list)} records from {table}")
    except Exception as e:
        print(f" ❌ Failed to clear {table}: {e}")

def run_cleanup():
    invoice_ids = get_list("invoices")
    estimate_ids = get_list("estimates")
    ai_estimate_ids = get_list("ai_estimates")
    
    print(f"Found {len(invoice_ids)} invoices, {len(estimate_ids)} estimates, {len(ai_estimate_ids)} ai_estimates")
    
    # 1. Clear Invoices children
    if invoice_ids:
        # We don't know the item IDs, but we can delete by invoice_id
        delete_by_id("invoice_items", invoice_ids, "invoice_id")
        delete_by_id("invoice_pdfs", invoice_ids, "invoice_id")
        delete_by_id("invoice_mails", invoice_ids, "invoice_id")
        delete_by_id("invoice_template_locks", invoice_ids, "invoice_id")
        delete_by_id("ai_invoices", invoice_ids, "invoice_id")
        # Now clear parent
        delete_by_id("invoices", invoice_ids)

    # 2. Clear Estimates children
    if estimate_ids:
        delete_by_id("estimate_items", estimate_ids, "estimate_id")
        delete_by_id("estimate_pdfs", estimate_ids, "estimate_id")
        delete_by_id("estimate_mails", estimate_ids, "estimate_id")
        delete_by_id("estimate_template_locks", estimate_ids, "estimate_id")
        delete_by_id("estimates", estimate_ids)
        
    # 3. Clear AI Estimates
    if ai_estimate_ids:
        delete_by_id("ai_estimate_results", ai_estimate_ids, "ai_estimate_id")
        delete_by_id("ai_estimates", ai_estimate_ids)
        
    # 4. Clear generic
    delete_by_id("products", [USER_ID], "user_id")
    delete_by_id("clients", [USER_ID], "user_id")

if __name__ == "__main__":
    run_cleanup()
