import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"
USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

profile_data = {
    "first_name": "Bethel Stone",
    "last_name": "LLC",
    "full_name": "Bethel Stone LLC",
    "company_name": "Bethel Stone LLC",
    "email": "admin@bethelstonecorp.com",
    "phone": "12078066602",
    "address": "19B Nason street,",
    "zip_code": "04073",
    "city": "Sanford",
    "state": "Maine",
    "country": "United States",
    "avatar_url": "https://paybue-invoice-estimation.s3.amazonaws.com/dummy/user.png"
}

def update_profile():
    url = f"{SUPABASE_URL}/rest/v1/profiles?user_id=eq.{USER_ID}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # We use PATCH to update existing record
    req = urllib.request.Request(url, data=json.dumps(profile_data).encode('utf-8'), method='PATCH', headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            print(f" ✅ Profile updated for {USER_ID}")
    except Exception as e:
        print(f" ❌ Error updating profile: {e}")

if __name__ == "__main__":
    update_profile()
