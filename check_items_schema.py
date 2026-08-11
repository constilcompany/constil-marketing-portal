import json
import urllib.request

SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def check_items_schema():
    url = f"{SUPABASE_URL}/rest/v1/"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            definitions = data.get('definitions', {})
            
            for table in ["invoice_items", "estimate_items"]:
                if table in definitions:
                    properties = definitions[table].get('properties', {})
                    print(f"Columns in {table}:")
                    for prop in properties.keys():
                        print(f" - {prop}")
                else:
                    print(f"{table} not found.")
    except Exception as e:
        print(f"Error checking schemas: {e}")

if __name__ == "__main__":
    check_items_schema()
