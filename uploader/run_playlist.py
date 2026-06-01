"""
run_playlist.py — Download Spotify playlist/track → demucs → upload

Usage:
  .venv/bin/python run_playlist.py <spotify_url> <genre> [options]

Examples:
  .venv/bin/python run_playlist.py https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd "Hip-Hop"
  .venv/bin/python run_playlist.py https://open.spotify.com/track/3ee8Jmje8o58CHK0QCFQM6 "R&B"
  .venv/bin/python run_playlist.py https://open.spotify.com/playlist/... "Trap" --server https://sgs-demo.ariusautomation.com
  .venv/bin/python run_playlist.py https://open.spotify.com/playlist/... "Jazz" --concurrent 2 --job my-batch-01

Options:
  --server     API base URL (default: http://localhost:7626)
  --concurrent Max parallel tracks (default: 1)
  --job        Custom job ID (default: auto-generated)
  --limit      Max tracks to process (default: all)
"""

import argparse, os, sys, time
from dotenv import load_dotenv
load_dotenv()

parser = argparse.ArgumentParser(description="Spotify → demucs → upload pipeline")
parser.add_argument("url",        help="Spotify playlist or track URL")
parser.add_argument("genre",      help="Genre tag (e.g. 'Hip-Hop')")
parser.add_argument("--server",   default="http://localhost:7626", help="API base URL")
parser.add_argument("--concurrent", type=int, default=1, help="Max concurrent tracks")
parser.add_argument("--job",      default=None, help="Job ID (default: auto)")
parser.add_argument("--limit",    type=int, default=None, help="Max tracks to process")
args = parser.parse_args()

JOB_ID = args.job or f"playlist-{int(time.time())}"

import spotipy, requests
from spotipy.oauth2 import SpotifyClientCredentials

sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id=os.getenv("SPOTIFY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIFY_CLIENT_SECRET"),
))

# ── Resolve URL → track list ──────────────────────────────────────────────────
tracks = []

if "/playlist/" in args.url:
    print("=== Fetching playlist tracks ===")
    playlist_id = args.url.split("/playlist/")[-1].split("?")[0]
    offset = 0
    while True:
        results = sp.playlist_tracks(playlist_id, offset=offset, limit=100)
        items = results["items"]
        if not items:
            break
        for item in items:
            t = item.get("track")
            if not t or not t.get("id"):
                continue
            tracks.append(t)
        offset += len(items)
        if not results["next"]:
            break

elif "/track/" in args.url:
    print("=== Fetching single track ===")
    track_id = args.url.split("/track/")[-1].split("?")[0]
    tracks = [sp.track(track_id)]

elif "/album/" in args.url:
    print("=== Fetching album tracks ===")
    album_id = args.url.split("/album/")[-1].split("?")[0]
    results = sp.album_tracks(album_id, limit=50)
    track_ids = [t["id"] for t in results["items"]]
    tracks = [sp.track(tid) for tid in track_ids]

else:
    print("ERROR: URL must be a Spotify playlist, track, or album URL")
    sys.exit(1)

if args.limit:
    tracks = tracks[:args.limit]

print(f"  {len(tracks)} track(s) to process")
for i, t in enumerate(tracks[:5], 1):
    print(f"  {i}. {t['artists'][0]['name']} — {t['name']}")
if len(tracks) > 5:
    print(f"  ... and {len(tracks) - 5} more")

# ── Build track_info dicts ────────────────────────────────────────────────────
track_infos = []
for t in tracks:
    track_infos.append({
        "id":           t["id"],
        "name":         t["name"],
        "artist":       t["artists"][0]["name"],
        "album_name":   t["album"]["name"],
        "album_type":   t["album"]["album_type"],
        "release_date": t["album"]["release_date"],
        "img":          t["album"]["images"][0]["url"] if t["album"]["images"] else None,
        "spotify_id":   t["id"],
        "isrc":         t.get("external_ids", {}).get("isrc"),
        "tempo":        0,
        "key":          "Unknown",
    })

print(f"\n=== Pipeline ===")
print(f"  Genre:      {args.genre}")
print(f"  Job ID:     {JOB_ID}")
print(f"  Server:     {args.server}")
print(f"  Concurrent: {args.concurrent}")
print()

# ── Patch upload functions to use args.server ─────────────────────────────────
import content_download_main

_orig_upload = content_download_main.upload_to_server
def _patched_upload(audio_path, track, stem_type, bpm, key, genre, **kwargs):
    kwargs["server_url"] = args.server
    return _orig_upload(audio_path, track, stem_type, bpm, key, genre, **kwargs)
content_download_main.upload_to_server = _patched_upload

_orig_complete = content_download_main.complete_job
def _patched_complete(job_id, total_queued, server_url=None):
    return _orig_complete(job_id, total_queued, server_url=args.server)
content_download_main.complete_job = _patched_complete

# ── Run ───────────────────────────────────────────────────────────────────────
from dispatch_download import process_all_tracks

start = time.time()

process_all_tracks(
    track_ids=[t["id"] for t in track_infos],
    selected_channels=["web_library"],
    args={
        "genre":   args.genre,
        "job_id":  JOB_ID,
        "channel": "web_library",
        "yt":      False,
    },
    session_id=JOB_ID,
    max_concurrent=args.concurrent,
    per_track_args={t["id"]: {"track_info": t} for t in track_infos},
)

elapsed = time.time() - start
print(f"\n=== Done in {elapsed/60:.1f} min ===")

# ── Complete job ──────────────────────────────────────────────────────────────
print(f"\n=== Completing job {JOB_ID} ===")
try:
    res = requests.post(
        f"{args.server}/api/vault/jobs/{JOB_ID}/complete",
        json={"total_queued": len(track_infos) * 5},
        timeout=30,
    )
    data = res.json()
    print(f"  {res.status_code}: stems={data.get('stemCount',0)}, zipJobs={data.get('zipJobsQueued',0)}, reviewMode={data.get('reviewMode')}")
except Exception as e:
    print(f"  complete job failed: {e}")
