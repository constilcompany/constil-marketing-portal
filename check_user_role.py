import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

def check_role():
    url = f"{SUPABASE_URL}/rest/v1/user_roles?user_id=eq.{USER_ID}&select=role"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            print(f"Roles for {USER_ID}: {data}")
    except Exception as e:
        print(f"Error checking roles: {e}")

if __name__ == "__main__":
    check_role()
