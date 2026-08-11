import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def check_exists(table):
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    try:
        req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{table}?limit=0", headers=headers)
        with urllib.request.urlopen(req) as resp:
            print(f"✅ Table '{table}' exists.")
    except urllib.error.HTTPError as e:
        print(f"❌ Table '{table}' missing/inaccessible: {e.code}")

if __name__ == "__main__":
    check_exists("taxes")
    check_exists("discounts")
    check_exists("invoice_item_taxes")
    check_exists("estimate_item_taxes")
    check_exists("profiles_with_stats")
