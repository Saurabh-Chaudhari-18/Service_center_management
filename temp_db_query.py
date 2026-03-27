import sqlite3
import csv
import os

try:
    db_path = os.path.join(os.getcwd(), 'Backend', 'db.sqlite3')
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [t[0] for t in cur.fetchall()]
    
    target_table = None
    for tbl in tables:
        if 'inventory_item' in tbl.lower() or 'inventoryitem' in tbl.lower():
            target_table = tbl
            break
            
    if target_table:
        cur.execute(f"SELECT name, sku FROM {target_table} WHERE branch_id IS NOT NULL LIMIT 4")
        items = cur.fetchall()
        
        if not items:
            cur.execute(f"SELECT name, sku FROM {target_table} LIMIT 4")
            items = cur.fetchall()

        out_path = os.path.join(os.getcwd(), 'sample_purchase_real.csv')
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['Name', 'SKU', 'Quantity', 'Unit Price'])
            for idx, item in enumerate(items, 1):
                writer.writerow([item[0], item[1] if item[1] else '', 5, 200.50])
        print("success:", out_path)
        print("Items included:", [i[0] for i in items])
    else:
        print("Inventory table not found! Tables:", tables)
except Exception as e:
    print("Error:", e)
