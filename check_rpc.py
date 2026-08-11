import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def check_rpc():
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Common names for helper functions that run SQL
    rpcs = ['exec_sql', 'run_sql', 'query', 'apply_rls']
    
    for rpc in rpcs:
        print(f"Trying RPC: {rpc}...")
        url = f"{SUPABASE_URL}/rest/v1/rpc/{rpc}"
        data = {"sql": "SELECT 1"}
        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), method='POST', headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                print(f"✅ Found working RPC: {rpc}!")
                return rpc
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f" - {rpc} doesn't exist.")
            else:
                print(f" - {rpc} returned error {e.code}: {e.read().decode('utf-8')}")
        except Exception as e:
            print(f" - Error: {e}")
    return None

if __name__ == "__main__":
    check_rpc()
