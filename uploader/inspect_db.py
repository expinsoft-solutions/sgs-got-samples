import sqlite3, json

conn = sqlite3.connect("stem_splitter.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)
print()

for t in tables:
    cur.execute("PRAGMA table_info(" + t + ")")
    cols = cur.fetchall()
    print("--- " + t + " ---")
    for c in cols:
        print("  " + str(c[1]) + " (" + str(c[2]) + ")")
    print()
