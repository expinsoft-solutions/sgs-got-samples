import sqlite3

conn = sqlite3.connect("stem_splitter.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

targets = [
    ("De La Soul", "Can U Keep a Secret"),
    ("De La Soul", "Me Myself and I"),
    ("Erick Sermon", "Bomdigi"),
    ("Freddie Gibbs", "I Still Love H.E.R"),
]

for artist, title in targets:
    cur.execute("""
        SELECT t.id, t.job_id, t.spotify_track_id, t.artist, t.title, t.bpm, t.key,
               t.status, t.thumbnail_url,
               j.genre, j.session_id
        FROM tracks t
        JOIN jobs j ON t.job_id = j.id
        WHERE t.artist LIKE ? AND t.title LIKE ?
        ORDER BY t.id DESC
    """, ("%" + artist + "%", "%" + title + "%"))
    rows = cur.fetchall()
    print("=== " + artist + " - " + title + " ===")
    if not rows:
        print("  NOT FOUND")
    for r in rows:
        print("  track.id=" + str(r["id"]) + "  job=" + str(r["job_id"]) +
              "  spotify_id=" + str(r["spotify_track_id"]) +
              "  bpm=" + str(r["bpm"]) + "  key=" + str(r["key"]) +
              "  status=" + str(r["status"]) + "  genre=" + str(r["genre"]))
        print("  session=" + str(r["session_id"]))
        print("  thumb=" + str(r["thumbnail_url"]))

        # Find stems for this track
        cur.execute("""
            SELECT stem_type, audio_path, status FROM stems WHERE track_id = ?
        """, (r["id"],))
        stems = cur.fetchall()
        if stems:
            for s in stems:
                print("    stem=" + str(s["stem_type"]) + "  path=" + str(s["audio_path"]) + "  status=" + str(s["status"]))
        else:
            print("    (no stems recorded)")
    print()

conn.close()
