import sqlite3
import os

db_path = 'app.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(0)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
try:
    cursor.execute("SELECT username, deleted_at FROM deleted_account_audits ORDER BY deleted_at DESC LIMIT 5")
    rows = cursor.fetchall()
    print("Recent Deletions in Audit Log:")
    for row in rows:
        print(f" - {row[0]} deleted at {row[1]}")
except Exception as e:
    print(f"Error querying audit log: {e}")
finally:
    conn.close()
