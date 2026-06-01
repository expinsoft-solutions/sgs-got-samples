"""
test_pipeline.py — Test full pipeline: Spotify → yt-dlp → demucs → upload

Usage:
  .venv/bin/python test_pipeline.py

Edit CONFIG below before running.
"""

import os
import sys
import time

# ── CONFIG ────────────────────────────────────────────────────────────────────

SPOTIFY_TRACK_URL = "https://open.spotify.com/track/3ee8Jmje8o58CHK0QCFQM6"  # Drake - Rich Flex
GENRE             = "Hip-Hop"
JOB_ID            = f"test-job-{int(time.time())}"
SERVER_URL        = "http://localhost:7626"   # local API
# SERVER_URL      = "https://sgs-demo.ariusautomation.com"  # production

# ── RUN ───────────────────────────────────────────────────────────────────────

from dotenv import load_dotenv
load_dotenv()

import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

print("=== Fetching track info from Spotify ===")
sp = spotipy.Spotify(auth_manager=SpotifyClientCredentials(
    client_id=os.getenv("SPOTIFY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIFY_CLIENT_SECRET"),
))

track_id = SPOTIFY_TRACK_URL.split("/track/")[-1].split("?")[0]
track = sp.track(track_id)
track_info = {
    "id":           track["id"],
    "name":         track["name"],
    "artist":       track["artists"][0]["name"],
    "album_name":   track["album"]["name"],
    "album_type":   track["album"]["album_type"],
    "release_date": track["album"]["release_date"],
    "img":          track["album"]["images"][0]["url"] if track["album"]["images"] else None,
    "spotify_id":   track["id"],
    "tempo":        0,
    "key":          "Unknown",
}
print(f"  Track: {track_info['artist']} — {track_info['name']}")
print(f"  Album: {track_info['album_name']} ({track_info['album_type']})")

print("\n=== Running dispatch (yt-dlp → demucs → upload) ===")
print(f"  Genre:  {GENRE}")
print(f"  Job ID: {JOB_ID}")
print(f"  Server: {SERVER_URL}")
print()

# Monkey-patch upload_to_server to use our SERVER_URL
import content_download_main
_original = content_download_main.upload_to_server
def _patched(audio_path, track, stem_type, bpm, key, genre, **kwargs):
    kwargs["server_url"] = SERVER_URL
    return _original(audio_path, track, stem_type, bpm, key, genre, **kwargs)
content_download_main.upload_to_server = _patched

from dispatch_download import process_all_tracks

results = process_all_tracks(
    track_ids=[track_info["id"]],
    selected_channels=["web_library"],
    args={
        "genre":    GENRE,
        "job_id":   JOB_ID,
        "channel":  "web_library",
        "yt":       False,   # no YouTube upload
    },
    session_id=JOB_ID,
    max_concurrent=1,
    per_track_args={
        track_info["id"]: {"track_info": track_info}
    },
)

print("\n=== Completing job ===")
import requests
res = requests.post(
    f"{SERVER_URL}/api/vault/jobs/{JOB_ID}/complete",
    json={"total_queued": 5},
    timeout=30,
)
print(f"  Status: {res.status_code}")
print(f"  Response: {res.json()}")

print("\n=== Done ===")
