import sqlite3
import json
import urllib.request
import urllib.error
import time

# --- CONFIGURATION ---
SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"
TARGET_USER_ID = "47f3d024-2cd0-4dc9-b2ef-3a2301618667"

def supabase_request(endpoint, method="POST", data=None):
    url = f"{SUPABASE_URL}/{endpoint}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        req.data = json.dumps(data).encode("utf-8")
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f"HTTP Error {e.code} on {endpoint}: {body}")
        return None
    except Exception as e:
        print(f"Error on {endpoint}: {e}")
        return None

def migrate_ai():
    conn = sqlite3.connect("db.sqlite3")
    cursor = conn.cursor()
    
    # Pre-load client mapping
    cursor.execute("SELECT id, email FROM clients_client")
    clients = cursor.fetchall()
    client_map = {}
    for c_id, email in clients:
        res = supabase_request(f"rest/v1/clients?email=eq.{email}&select=id", method="GET")
        if res and len(res) > 0:
            client_map[c_id] = res[0]['id']

    # 7. Migrate AI Estimates
    print("Migrating AI estimates (Final Retry)...")
    cursor.execute("SELECT id, name, client_id FROM estimates_aiestimate")
    ai_ests = cursor.fetchall()
    ai_map = {}
    for a_id, name, c_id in ai_ests:
        payload = {
            "user_id": TARGET_USER_ID,
            "name": name,
            "status": "completed",
            "client_id": client_map.get(c_id),
            "created_at": "now()"
        }
        res = supabase_request("rest/v1/ai_estimates", data=payload)
        if res and len(res) > 0:
            ai_map[a_id] = res[0]['id']

    # 8. Migrate AI Results
    print("Migrating AI results (Final Retry)...")
    cursor.execute("SELECT estimate_id, output_json, page_number FROM estimates_aiestimateresult")
    results = cursor.fetchall()
    for a_id, data, p_num in results:
        if a_id not in ai_map: continue
        payload = {
            "ai_estimate_id": ai_map[a_id],
            "output_json": json.loads(data or "{}"),
            "page_number": p_num or 1
        }
        supabase_request("rest/v1/ai_estimate_results", data=payload)

    print("--- ALL MIGRATIONS FINISHED SUCCESSFULLY ---")
    conn.close()

if __name__ == "__main__":
    migrate_ai()
