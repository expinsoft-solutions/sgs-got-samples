import sqlite3

conn = sqlite3.connect("stem_splitter.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

for tid in [383, 400, 403, 438]:
    cur.execute("SELECT id, artist, title, album, bpm, key, spotify_track_id, thumbnail_url FROM tracks WHERE id=?", (tid,))
    r = cur.fetchone()
    print("id=" + str(r["id"]) + "  artist=" + str(r["artist"]) + "  title=" + str(r["title"]))
    print("  album=" + str(r["album"]) + "  bpm=" + str(r["bpm"]) + "  key=" + str(r["key"]))
    print("  spotify_id=" + str(r["spotify_track_id"]))
    print()

conn.close()
