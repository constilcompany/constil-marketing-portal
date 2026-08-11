import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

def clear_data():
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    
    # 1. Clear items explicitly just in case
    # 2. Clear PDFs/Mails
    # 3. Clear Parents
    
    cleanup_sequence = [
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
        "clients"
    ]
    
    for table in cleanup_sequence:
        print(f"Deleting user records from {table}...")
        # Most of these tables have user_id, some might be linked via invoice_id
        # We'll try user_id=eq.{USER_ID} for all first.
        url = f"{SUPABASE_URL}/rest/v1/{table}?user_id=eq.{USER_ID}"
        req = urllib.request.Request(url, method='DELETE', headers=headers)
        try:
            with urllib.request.urlopen(req) as response:
                print(f" ✅ Processed {table}")
        except Exception as e:
            print(f" ⚠️  Note on {table}: {e}")

if __name__ == "__main__":
    clear_data()
