import csv
import json
import urllib.request
import urllib.error

# --- CONFIGURATION ---
SUPABASE_URL = "https://avppbvsxayehguepyjkb.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"
CSV_FILE = "credit_packages-export-2026-04-24_21-53-16.csv"

def supabase_post(endpoint, data):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    req = urllib.request.Request(url, method="POST", data=json.dumps(data).encode("utf-8"), headers=headers)
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.read().decode('utf-8')}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def import_csv():
    print(f"Importing {CSV_FILE}...")
    with open(CSV_FILE, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=';')
        batch = []
        for row in reader:
            # Type conversions
            cleaned_row = {}
            for k, v in row.items():
                if v == "":
                    cleaned_row[k] = None
                elif v.lower() == "true":
                    cleaned_row[k] = True
                elif v.lower() == "false":
                    cleaned_row[k] = False
                elif k in ["price", "credit_amount", "trial_days", "invoice_credits", "estimate_credits", "ai_estimate_credits", "trial_invoice_credits", "trial_estimate_credits", "trial_ai_estimate_credits", "duration_days"]:
                    try:
                        cleaned_row[k] = float(v) if "." in v else int(v)
                    except:
                        cleaned_row[k] = v
                else:
                    cleaned_row[k] = v
            batch.append(cleaned_row)
        
        if batch:
            success = supabase_post("credit_packages", batch)
            if success:
                print(f"Successfully imported {len(batch)} packages.")
            else:
                print("Failed to import packages.")

if __name__ == "__main__":
    import_csv()
