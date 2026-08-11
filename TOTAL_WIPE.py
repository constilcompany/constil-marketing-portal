import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def clear_everything():
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    
    # Tables to wipe completely (Order matters for foreign keys)
    tables = [
        "invoice_item_taxes",
        "invoice_item_discounts",
        "invoice_items",
        "invoice_pdfs",
        "invoice_mails",
        "invoice_template_locks",
        "ai_invoices",
        "invoices",
        
        "estimate_item_taxes",
        "estimate_item_discounts",
        "estimate_items",
        "estimate_pdfs",
        "estimate_mails",
        "estimate_template_locks",
        "ai_estimate_results",
        "ai_estimates",
        
        "products",
        "clients",
        "taxes",
        "discounts"
    ]
    
    # We use a filter that is always true to clear all rows if simple DELETE is blocked
    # Or just hit the endpoint with DELETE and no filter (Supabase requires a filter if not configured otherwise)
    # The safest filter is "id=neq.00000000-0000-0000-0000-000000000000"
    
    for table in tables:
        print(f"Wiping table {table}...")
        url = f"{SUPABASE_URL}/rest/v1/{table}?id=neq.00000000-0000-0000-0000-000000000000"
        req = urllib.request.Request(url, method='DELETE', headers=headers)
        try:
            with urllib.request.urlopen(req) as response:
                print(f" ✅ Wiped {table}")
        except Exception as e:
            # Maybe it doesn't have 'id' column? Try another common filter
            try:
                url_alt = f"{SUPABASE_URL}/rest/v1/{table}?created_at=neq.1970-01-01"
                req_alt = urllib.request.Request(url_alt, method='DELETE', headers=headers)
                with urllib.request.urlopen(req_alt) as response:
                    print(f" ✅ Wiped {table} (using alternate filter)")
            except:
                print(f" ⚠️ Failed to wipe {table}: {e}")

if __name__ == "__main__":
    clear_everything()
