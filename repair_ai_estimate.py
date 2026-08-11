import json
import urllib.request
import re

URL = "https://avppbvsxayehguepyjkb.supabase.co/rest/v1/ai_estimate_results?ai_estimate_id=eq.cb45c914-95c5-4ff9-870f-61109ac3ead9"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2cHBidnN4YXllaGd1ZXB5amtiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAzMzk2MiwiZXhwIjoyMDkyNjA5OTYyfQ.IjIDpaxklgfczNpmHlrKAThnGzlECeMwtv9QodFPwZk"

def get_data():
    req = urllib.request.Request(f"{URL}&select=*", headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())[0]

def parse_markdown_tables(text):
    if not text: return []
    if isinstance(text, (dict, list)): text = json.dumps(text)
    
    lines = text.split('\n')
    all_tables_list = []
    current_table_lines = []
    
    def process_table(table_lines):
        if len(table_lines) < 3: return None
        if '---' not in table_lines[1]: return None
        
        headers = [h.strip() for h in table_lines[0].strip('|').split('|') if h.strip()]
        rows = []
        for line in table_lines[2:]:
            if '|' not in line: break
            cols = [c.strip() for c in line.strip('|').split('|')]
            row_dict = {}
            for i, h in enumerate(headers):
                if i < len(cols):
                    row_dict[h] = cols[i]
                else:
                    row_dict[h] = ""
            if any(row_dict.values()):
                rows.append(row_dict)
        
        if not rows: return None

        # Find title
        table_str = "\n".join(table_lines[:3])
        pos = text.find(table_str)
        title = "ESTIMATION TABLE"
        if pos > 0:
            pre_text = text[:pos].strip().split('\n')
            # 1. Look for ## Headers first (up to 50 lines back)
            for line in reversed(pre_text[-50:]):
                l = line.strip()
                if l.startswith('##'):
                    title = l.strip('# ').upper()
                    break
            # 2. Only if no ## found, check for **bold** (closer fallback)
            if title == "ESTIMATION TABLE":
                for line in reversed(pre_text[-5:]):
                    l = line.strip()
                    if l.startswith('**'):
                        title = l.strip('* ').strip(':').upper()
                        break
        
        return {"table_name": title, "headers": headers, "rows": rows}

    for line in lines:
        if line.strip().startswith('|'):
            current_table_lines.append(line)
        else:
            if current_table_lines:
                res = process_table(current_table_lines)
                if res: all_tables_list.append(res)
                current_table_lines = []
    
    if current_table_lines:
        res = process_table(current_table_lines)
        if res: all_tables_list.append(res)
        
    return all_tables_list

def update_data(record_id, tables_list, original_output_json):
    update_url = f"https://avppbvsxayehguepyjkb.supabase.co/rest/v1/ai_estimate_results?id=eq.{record_id}"
    formatted_tables = []
    colors = ["blue", "green", "orange", "yellow"]
    for i, t in enumerate(tables_list):
        t_name = t["table_name"]
        if "DIVISION" in t_name: t_name = "DRYWALL DIVISION"
        if "FINANCIAL" in t_name or "SUMMARY" in t_name: t_name = "FINANCIAL SUMMARY"
        
        formatted_tables.append({
            "table_name": t_name,
            "headers": t["headers"],
            "rows": t["rows"],
            "color": colors[i % len(colors)],
            "description": f"Extracted from {t['table_name']}"
        })
        
    new_tables_json = { "tables": formatted_tables }
    original_output_json["tables_json"] = new_tables_json
    data = json.dumps({"output_json": original_output_json}).encode('utf-8')
    req = urllib.request.Request(update_url, data=data, method='PATCH', headers={
        'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'
    })
    with urllib.request.urlopen(req) as r:
        print(f" ✅ Successfully updated {len(tables_list)} tables")

if __name__ == "__main__":
    record = get_data()
    oj = record.get('output_json', {})
    if isinstance(oj, str): oj = json.loads(oj)
    
    e_text = oj.get('estimate_text', '')
    if not e_text:
        om = record.get('output_markdown', '')
        if isinstance(om, str) and om.startswith('{'):
             try: om = json.loads(om); e_text = "\n".join(om.get('chunk_texts', []))
             except: e_text = om
        elif isinstance(om, dict):
             e_text = "\n".join(om.get('chunk_texts', []))
        else:
             e_text = om
             
    tables = parse_markdown_tables(e_text)
    print(f"Found {len(tables)} tables.")
    if tables:
        update_data(record['id'], tables, oj)
