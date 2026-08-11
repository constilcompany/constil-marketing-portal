import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3Njk5NDIsImV4cCI6MjA4NjM0NTk0Mn0.Uf-7y4OWh2sYEqit7p6dZ4FzO7oV6fT_uB-hYfAnS6Y"

def test_rls():
    # Try fetching with ANON KEY without user token
    url = f"{SUPABASE_URL}/rest/v1/invoices?select=count"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            print(f"Fetch with ANON key returned: {data}")
    except Exception as e:
        print(f"Error testing RLS: {e}")

if __name__ == "__main__":
    test_rls()
