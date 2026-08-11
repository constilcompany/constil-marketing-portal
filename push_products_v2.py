import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"
USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

def push_all_products():
    with open('products_data.json', 'r') as f:
        data = json.load(f)
    
    final_payload = []
    for p in data:
        final_payload.append({
            "user_id": USER_ID,
            "ref": p["ref"],
            "name": p["name"],
            "description": p["description"],
            "price": float(p["price"]),
            "extra_info": p.get("extra_info")
        })
    
    url = f"{SUPABASE_URL}/rest/v1/products"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    chunk_size = 10
    for i in range(0, len(final_payload), chunk_size):
        chunk = final_payload[i:i + chunk_size]
        req = urllib.request.Request(url, data=json.dumps(chunk).encode('utf-8'), method='POST', headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                print(f" ✅ Pushed chunk {i//chunk_size + 1}")
        except Exception as e:
            print(f" ❌ Error pushing chunk {i//chunk_size + 1}: {e}")

if __name__ == "__main__":
    push_all_products()
