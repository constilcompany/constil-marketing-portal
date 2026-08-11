import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

EMAIL_TO_CLEAR = "admin@bethelstonecorp.com"

def get_user_id():
    # Try profiles table
    url = f"{SUPABASE_URL}/rest/v1/profiles?email=eq.{EMAIL_TO_CLEAR}&select=user_id"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data:
                return data[0]['user_id']
    except Exception as e:
        print(f"Error getting user_id: {e}")
    return None

def clear_data(user_id):
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    
    tables = ["invoices", "estimates", "ai_estimates", "products", "clients"]
    
    for table in tables:
        print(f"Deleting from {table}...")
        url = f"{SUPABASE_URL}/rest/v1/{table}?user_id=eq.{user_id}"
        req = urllib.request.Request(url, method='DELETE', headers=headers)
        try:
            with urllib.request.urlopen(req) as response:
                print(f" ✅ Cleared {table}")
        except Exception as e:
            print(f" ❌ Failed to clear {table}: {e}")

if __name__ == "__main__":
    uid = get_user_id()
    if uid:
        print(f"Found user_id: {uid}")
        clear_data(uid)
    else:
        print(f"User with email {EMAIL_TO_CLEAR} not found in profiles.")
