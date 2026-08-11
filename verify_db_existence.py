import json
import urllib.request
import uuid

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def test_insert():
    # Try inserting a dummy profile to see if it exists
    url = f"{SUPABASE_URL}/rest/v1/company_profiles"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    # We need a valid user_id. Let's try to get one from profiles
    try:
        req_u = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/profiles?select=user_id&limit=1", headers=headers)
        with urllib.request.urlopen(req_u) as resp_u:
            users = json.loads(resp_u.read().decode("utf-8"))
            if users:
                user_id = users[0]['user_id']
                payload = {
                    "user_id": user_id,
                    "company_name": "Test Company"
                }
                req_i = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), method='POST', headers=headers)
                with urllib.request.urlopen(req_i) as resp_i:
                    print("Successfully verified: company_profiles is accessible and accepts inserts!")
            else:
                print("No users found to test profile insert.")
    except Exception as e:
        print(f"Verification failed: {e}")

if __name__ == "__main__":
    test_insert()
