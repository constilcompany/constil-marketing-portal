import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def check_invoices():
    # Only get counts per user
    url = f"{SUPABASE_URL}/rest/v1/invoices?select=user_id"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            counts = {}
            for item in data:
                uid = item.get('user_id')
                counts[uid] = counts.get(uid, 0) + 1
            print("Invoices per User ID:")
            for uid, count in counts.items():
                print(f" - {uid}: {count} invoices")
    except Exception as e:
        print(f"Error checking invoices: {e}")

if __name__ == "__main__":
    check_invoices()
