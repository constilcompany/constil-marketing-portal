import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def test_insert():
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    try:
        # Get a user first
        req_u = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/profiles?select=user_id&limit=1", headers=headers)
        with urllib.request.urlopen(req_u) as resp_u:
            users = json.loads(resp_u.read().decode("utf-8"))
            if users:
                user_id = users[0]['user_id']
                # Try to get existing profile first to see columns
                req_g = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/company_profiles?limit=1", headers=headers)
                try:
                    with urllib.request.urlopen(req_g) as resp_g:
                        print("Table 'company_profiles' exists!")
                except urllib.error.HTTPError as e:
                    print(f"GET Error: {e.read().decode('utf-8')}")
            else:
                print("No users found.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_insert()
