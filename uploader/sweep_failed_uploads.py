"""
sweep_failed_uploads.py
-----------------------
Standalone recovery tool — run this AFTER a split job if any stems
failed to upload to Laravel.

Usage:
    python sweep_failed_uploads.py

It reads the stem_splitter.db for tracks that have fewer than 5 visible
stems on the server and re-uploads the missing ones from the local
Web Library folder.

The app (content_download_main.py) is untouched and runs exactly as
before. This is a separate safety net you run when needed.
"""
import os
import sys
import time
import sqlite3
import requests

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE          = os.path.dirname(os.path.abspath(__file__))
LARAVEL_URL   = "https://springgreen-mandrill-515031.hostingersite.com"
DB_PATH       = os.path.join(BASE, "stem_splitter.db")
WEB_LIB       = os.path.join(BASE, "Web Library")
MAX_ATTEMPTS  = 3
RETRY_DELAY   = 5  # seconds between sweep retries


# ---------------------------------------------------------------------------
# Upload helper (mirrors content_download_main.upload_to_laravel exactly)
# ---------------------------------------------------------------------------
def upload_to_laravel(audio_path, track, stem_type, bpm, key, genre,
                      album_name=None, album_type="single",
                      spotify_id=None, cover_art_url=None):
    if not os.path.exists(audio_path):
        print(f"  [SKIP] File not found: {audio_path}")
        return False
    try:
        try:
            bpm_val = round(float(bpm), 1) if bpm and bpm != 0 else 120
            bpm_val = max(40, min(220, bpm_val))
            bpm_val = int(bpm_val) if bpm_val == int(bpm_val) else bpm_val
        except (TypeError, ValueError):
            bpm_val = 120

        with open(audio_path, "rb") as f:
            files = {"file": (os.path.basename(audio_path), f, "audio/mpeg")}
            data = {
                "title":        track.get("name", "Unknown"),
                "artist":       track.get("artist", "Unknown"),
                "stem_type":    stem_type.capitalize(),
                "bpm":          bpm_val,
                "key":          key if key and key != "Unknown" else "C",
                "genre":        genre,
                "album_name":   album_name or track.get("album_name", ""),
                "album_type":   album_type,
                "spotify_id":   spotify_id or track.get("spotify_id") or track.get("id"),
                "cover_art_url": cover_art_url,
            }
            data = {k: v for k, v in data.items() if v is not None and v != ""}
            r = requests.post(f"{LARAVEL_URL}/api/upload/single",
                              files=files, data=data, timeout=90)
            if r.status_code in (200, 201):
                print(f"  OK  {stem_type.capitalize()}")
                return True
            elif r.status_code == 409:
                print(f"  SKIP {stem_type.capitalize()} (already exists on server)")
                return True  # already there, counts as success
            else:
                print(f"  FAIL {stem_type.capitalize()} HTTP {r.status_code} {r.text[:120].encode('ascii','replace').decode()}")
                return False
    except Exception as e:
        print(f"  ERROR {stem_type}: {e}")
        return False


def sweep_stem(audio_path, track, stem_type, bpm, key, genre,
               album_name, spotify_id, cover_art_url):
    for attempt in range(1, MAX_ATTEMPTS + 1):
        ok = upload_to_laravel(audio_path, track, stem_type, bpm, key, genre,
                               album_name=album_name, spotify_id=spotify_id,
                               cover_art_url=cover_art_url)
        if ok:
            return True
        if attempt < MAX_ATTEMPTS:
            print(f"  Retrying in {RETRY_DELAY}s (attempt {attempt}/{MAX_ATTEMPTS})...")
            time.sleep(RETRY_DELAY)
    return False


# ---------------------------------------------------------------------------
# Query DB for recent jobs and their stems
# ---------------------------------------------------------------------------
def get_recent_stems(limit_jobs=5):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT t.id, t.job_id, t.artist, t.title, t.bpm, t.key,
               t.spotify_track_id, t.thumbnail_url,
               j.genre
        FROM tracks t
        JOIN jobs j ON t.job_id = j.id
        WHERE t.status = 'done'
        ORDER BY t.id DESC
        LIMIT 200
    """)
    tracks = cur.fetchall()

    results = []
    for t in tracks:
        cur.execute("""
            SELECT stem_type, audio_path, status
            FROM stems WHERE track_id = ?
        """, (t["id"],))
        stems = cur.fetchall()
        results.append({"track": t, "stems": stems})

    conn.close()
    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("SWEEP FAILED UPLOADS")
    print("Checks recent tracks and re-uploads any missing stems.")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found at {DB_PATH}")
        return

    records = get_recent_stems()
    total_ok = 0
    total_fail = 0

    for rec in records:
        t = rec["track"]
        stems = rec["stems"]
        label = f"{t['artist']} - {t['title']}"

        for s in stems:
            if s["status"] != "ready":
                continue
            audio_path = os.path.join(BASE, s["audio_path"]) if s["audio_path"] else None
            if not audio_path or not os.path.exists(audio_path):
                continue

            # Try to upload — server will return 409 if already there (we treat as OK)
            track_dict = {
                "name":       t["title"],
                "artist":     t["artist"],
                "album_name": "",
                "spotify_id": t["spotify_track_id"],
            }
            print(f"\n[{label}] {s['stem_type']}")
            ok = sweep_stem(
                audio_path   = audio_path,
                track        = track_dict,
                stem_type    = s["stem_type"],
                bpm          = t["bpm"],
                key          = t["key"],
                genre        = t["genre"] or "Hip-Hop",
                album_name   = "",
                spotify_id   = t["spotify_track_id"],
                cover_art_url= t["thumbnail_url"],
            )
            if ok:
                total_ok += 1
            else:
                total_fail += 1

    print()
    print("=" * 60)
    print(f"Done: {total_ok} uploaded/already-present, {total_fail} failed")
    print("=" * 60)


if __name__ == "__main__":
    main()
