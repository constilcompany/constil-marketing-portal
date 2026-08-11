import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def check_columns(table):
    # We can get columns by fetching one row with select=* and checking keys
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit=1"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Prefer": "count=exact"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data:
                print(f"Columns in {table}:")
                for col in data[0].keys():
                    print(f" - {col}")
            else:
                print(f"Table {table} is empty, cannot check columns easily via REST.")
    except Exception as e:
        print(f"Error checking {table}: {e}")

if __name__ == "__main__":
    check_columns("invoice_items")
    check_columns("company_profiles")
    check_columns("user_credit_wallets")
