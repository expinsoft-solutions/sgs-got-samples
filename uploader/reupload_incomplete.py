"""
Targeted re-upload for 4 incomplete tracks (missing stems on Laravel server).
Uses pre-built MP3s already on disk — no Demucs, no download.
Genre = Hip-Hop, channel = weblibrary.
"""
import os
import time
import requests

LARAVEL_URL = "https://springgreen-mandrill-515031.hostingersite.com"
BASE = r"C:\Users\songo\Desktop\Sample Split 2027\Samples Split 2027"

# ---------------------------------------------------------------------------
# upload_to_laravel (inline copy — avoids content_download_main.py imports)
# ---------------------------------------------------------------------------
def upload_to_laravel(audio_path, track, stem_type, bpm, key, genre,
                      album_name=None, album_type="single", release_date=None,
                      specific_genre=None, job_id=None,
                      spotify_id=None, cover_art_url=None, is_free=False):
    if not os.path.exists(audio_path):
        print("  MISSING FILE: " + audio_path)
        return False
    try:
        try:
            bpm_val = round(float(bpm), 1) if bpm and bpm != 0 else 120
            if bpm_val < 40 or bpm_val > 220:
                bpm_val = 120
            bpm_val = int(bpm_val) if bpm_val == int(bpm_val) else bpm_val
        except (TypeError, ValueError):
            bpm_val = 120

        key_value = key if key and key != "Unknown" else "C"
        genre_value = genre if genre else "Hip-Hop"
        stem_type_value = stem_type.capitalize()

        resolved_cover_url = cover_art_url or track.get("img") or track.get("cover_art_url")
        if resolved_cover_url and not str(resolved_cover_url).startswith("http"):
            resolved_cover_url = None

        with open(audio_path, "rb") as audio_f:
            files = {"file": (os.path.basename(audio_path), audio_f, "audio/mpeg")}
            data = {
                "title": track.get("name", "Unknown"),
                "artist": track.get("artist", "Unknown"),
                "stem_type": stem_type_value,
                "bpm": bpm_val,
                "key": key_value,
                "genre": genre_value,
                "album_name": album_name or track.get("album_name", track.get("name", "Unknown")),
                "album_type": album_type or track.get("album_type", "single"),
                "release_date": release_date or track.get("release_date"),
                "specific_genre": specific_genre or genre_value,
                "job_id": job_id,
                "spotify_id": spotify_id or track.get("spotify_id") or track.get("id"),
                "cover_art_url": resolved_cover_url,
                "is_free": is_free,
            }
            data = {k: v for k, v in data.items() if v is not None and v != ""}

            response = requests.post(
                LARAVEL_URL + "/api/upload/single",
                files=files, data=data, timeout=90
            )
            if response.status_code in (200, 201):
                print("  OK  " + stem_type_value)
                return True
            elif response.status_code == 500 and "Deadlock" in response.text:
                raise Exception("Deadlock: " + response.text[:120])
            else:
                print("  FAIL " + stem_type_value + " HTTP " + str(response.status_code) + " " + response.text[:300].encode('ascii', errors='replace').decode())
                return False
    except Exception as e:
        print("  ERROR " + stem_type + " → " + str(e))
        return False


def upload_stem_with_retry(audio_path, track, stem_type, bpm, key, genre,
                            album_name, spotify_id, cover_art_url, max_attempts=3):
    for attempt in range(1, max_attempts + 1):
        try:
            ok = upload_to_laravel(
                audio_path, track, stem_type, bpm, key, genre,
                album_name=album_name,
                album_type="single",
                specific_genre=genre,
                spotify_id=spotify_id,
                cover_art_url=cover_art_url,
            )
            if ok:
                return True
            if attempt < max_attempts:
                print("    retrying in 5s (attempt " + str(attempt) + "/" + str(max_attempts) + ")..."  )
                time.sleep(5)
        except Exception as e:
            if "Deadlock" in str(e) and attempt < max_attempts:
                print("    Deadlock — retrying in " + str(attempt * 3) + "s...")
                time.sleep(attempt * 3)
            else:
                print("    gave up: " + str(e))
                return False
    return False


# ---------------------------------------------------------------------------
# Track definitions (from stem_splitter.db, all status=ready on disk)
# ---------------------------------------------------------------------------
TRACKS = [
    {
        "track": {
            "name": "Can U Keep a Secret",
            "artist": "De La Soul",
            "album_name": "3 Feet High and Rising",
        },
        "bpm": 99.0,
        "key": "A# minor",
        "genre": "Hip-Hop",
        "spotify_id": "2ZvAAapW3yAaVdmGfiJyJI",
        "cover_art_url": "https://i.scdn.co/image/ab67616d0000b27343693c2f01ae89613c880ed5",
        "stems": {
            "Acapella":     r"Web Library\Hip Hop\Acapella\De La Soul - Can U Keep a Secret Acapella [BPM 99 A# minor]\De La Soul - Can U Keep a Secret Acapella [BPM 99 A# minor].mp3",
            "Drums":        r"Web Library\Hip Hop\Drums\De La Soul - Can U Keep a Secret Drums [BPM 99]\De La Soul - Can U Keep a Secret Drums [BPM 99].mp3",
            "Bass":         r"Web Library\Hip Hop\Bass\De La Soul - Can U Keep a Secret Bass [BPM 99 A# minor]\De La Soul - Can U Keep a Secret Bass [BPM 99 A# minor].mp3",
            "Melody":       r"Web Library\Hip Hop\Melody\De La Soul - Can U Keep a Secret Melody [BPM 99 A# minor]\De La Soul - Can U Keep a Secret Melody [BPM 99 A# minor].mp3",
            "Instrumental": r"Web Library\Hip Hop\Instrumental\De La Soul - Can U Keep a Secret Instrumental\De La Soul - Can U Keep a Secret Instrumental.mp3",
        },
    },
    {
        "track": {
            "name": "Me Myself and I",
            "artist": "De La Soul",
            "album_name": "3 Feet High and Rising",
        },
        "bpm": 115.0,
        "key": "D minor",
        "genre": "Hip-Hop",
        "spotify_id": "792UwI6utk5DMQUT1KXa5E",
        "cover_art_url": "https://i.scdn.co/image/ab67616d0000b27343693c2f01ae89613c880ed5",
        "stems": {
            "Acapella":     r"Web Library\Hip Hop\Acapella\De La Soul - Me Myself and I Acapella [BPM 115 D minor]\De La Soul - Me Myself and I Acapella [BPM 115 D minor].mp3",
            "Drums":        r"Web Library\Hip Hop\Drums\De La Soul - Me Myself and I Drums [BPM 115]\De La Soul - Me Myself and I Drums [BPM 115].mp3",
            "Bass":         r"Web Library\Hip Hop\Bass\De La Soul - Me Myself and I Bass [BPM 115 D minor]\De La Soul - Me Myself and I Bass [BPM 115 D minor].mp3",
            "Melody":       r"Web Library\Hip Hop\Melody\De La Soul - Me Myself and I Melody [BPM 115 D minor]\De La Soul - Me Myself and I Melody [BPM 115 D minor].mp3",
            "Instrumental": r"Web Library\Hip Hop\Instrumental\De La Soul - Me Myself and I Instrumental [BPM 115 D minor]\De La Soul - Me Myself and I Instrumental [BPM 115 D minor].mp3",
        },
    },
    {
        "track": {
            "name": "Bomdigi",
            "artist": "Erick Sermon",
            "album_name": "Double Or Nothing",
        },
        "bpm": 90.0,
        "key": "C# major",
        "genre": "Hip-Hop",
        "spotify_id": "6tRh6OfYIZbZhq6uQVBaF3",
        "cover_art_url": "https://i.scdn.co/image/ab67616d0000b2736f441dc52f0ab41753d22138",
        "stems": {
            "Acapella":     r"Web Library\Hip Hop\Acapella\Erick Sermon - Bomdigi Acapella [BPM 90 C# major]\Erick Sermon - Bomdigi Acapella [BPM 90 C# major].mp3",
            "Drums":        r"Web Library\Hip Hop\Drums\Erick Sermon - Bomdigi Drums [BPM 90]\Erick Sermon - Bomdigi Drums [BPM 90].mp3",
            "Bass":         r"Web Library\Hip Hop\Bass\Erick Sermon - Bomdigi Bass [BPM 90 C# major]\Erick Sermon - Bomdigi Bass [BPM 90 C# major].mp3",
            "Melody":       r"Web Library\Hip Hop\Melody\Erick Sermon - Bomdigi Melody [BPM 90 C# major]\Erick Sermon - Bomdigi Melody [BPM 90 C# major].mp3",
            "Instrumental": r"Web Library\Hip Hop\Instrumental\Erick Sermon - Bomdigi Instrumental [BPM 90 C# major]\Erick Sermon - Bomdigi Instrumental [BPM 90 C# major].mp3",
        },
    },
    {
        "track": {
            "name": "I Still Love H.E.R.",
            "artist": "Freddie Gibbs",
            "album_name": "Alfredo 2",
        },
        "bpm": 110.0,
        "key": "C# major",
        "genre": "Hip-Hop",
        "spotify_id": "3MkzhFS21pIGreE1G6Sds2",
        "cover_art_url": "https://i.scdn.co/image/ab67616d0000b273e098f51a1a2ebb827dc6099a",
        "stems": {
            "Acapella":     r"Web Library\Hip Hop\Acapella\Freddie Gibbs - I Still Love H.E.R. Acapella\Freddie Gibbs - I Still Love H.E.R. Acapella.mp3",
            "Drums":        r"Web Library\Hip Hop\Drums\Freddie Gibbs - I Still Love H.E.R. Drums [BPM 110]\Freddie Gibbs - I Still Love H.E.R. Drums [BPM 110].mp3",
            "Bass":         r"Web Library\Hip Hop\Bass\Freddie Gibbs - I Still Love H.E.R. Bass [BPM 110 C# major]\Freddie Gibbs - I Still Love H.E.R. Bass [BPM 110 C# major].mp3",
            "Melody":       r"Web Library\Hip Hop\Melody\Freddie Gibbs - I Still Love H.E.R. Melody\Freddie Gibbs - I Still Love H.E.R. Melody.mp3",
            "Instrumental": r"Web Library\Hip Hop\Instrumental\Freddie Gibbs - I Still Love H.E.R. Instrumental\Freddie Gibbs - I Still Love H.E.R. Instrumental.mp3",
        },
    },
]

# ---------------------------------------------------------------------------
# Run uploads
# ---------------------------------------------------------------------------
total_ok = 0
total_fail = 0
failed_list = []

for entry in TRACKS:
    track = entry["track"]
    label = track["artist"] + " - " + track["name"]
    print()
    print("=" * 60)
    print("TRACK: " + label)
    print("=" * 60)

    for stem_type, rel_path in entry["stems"].items():
        audio_path = os.path.join(BASE, rel_path)
        print("[" + stem_type + "]")
        ok = upload_stem_with_retry(
            audio_path=audio_path,
            track=track,
            stem_type=stem_type,
            bpm=entry["bpm"],
            key=entry["key"],
            genre=entry["genre"],
            album_name=track.get("album_name"),
            spotify_id=entry["spotify_id"],
            cover_art_url=entry["cover_art_url"],
        )
        if ok:
            total_ok += 1
        else:
            total_fail += 1
            failed_list.append(label + " / " + stem_type)
        time.sleep(0.5)  # slight pause between stems

print()
print("=" * 60)
print("DONE: " + str(total_ok) + " uploaded, " + str(total_fail) + " failed")
if failed_list:
    print("Failed:")
    for f in failed_list:
        print("  - " + f)
else:
    print("All stems uploaded successfully.")
print("=" * 60)
