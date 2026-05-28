"""
Local upload test — points at localhost:7626 (npm run dev:api must be running).
Usage: python test_upload.py
"""
import os
import requests
import urllib.request

LOCAL = "http://localhost:7626"
TEST_FILE = "test.mp3"

# Download a small sample MP3 if not present
if not os.path.exists(TEST_FILE):
    print("Downloading test MP3...")
    urllib.request.urlretrieve(
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        TEST_FILE
    )
    print(f"Saved {TEST_FILE}")

JOB_ID = "test-job-001"

# ── Test 1: single upload ─────────────────────────────────────────────────────
print("\n--- TEST 1: single upload ---")
with open(TEST_FILE, 'rb') as f:
    r = requests.post(
        f"{LOCAL}/api/upload/single",
        files={'file': (TEST_FILE, f, 'audio/mpeg')},
        data={
            'title':     'Test Song',
            'artist':    'Test Artist',
            'stem_type': 'Acapella',
            'bpm':       120,
            'key':       'C Maj',
            'genres':    'Hip-Hop',
            'job_id':    JOB_ID,
        },
        timeout=30,
    )
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")

# ── Test 2: duplicate detection ───────────────────────────────────────────────
print("\n--- TEST 2: duplicate (same title/artist/type) ---")
with open(TEST_FILE, 'rb') as f:
    r = requests.post(
        f"{LOCAL}/api/upload/single",
        files={'file': (TEST_FILE, f, 'audio/mpeg')},
        data={
            'title':     'Test Song',
            'artist':    'Test Artist',
            'stem_type': 'Acapella',
            'bpm':       120,
            'key':       'C Maj',
            'genres':    'Hip-Hop',
            'job_id':    JOB_ID,
        },
        timeout=30,
    )
print(f"Status: {r.status_code}  (expect 409)")
print(f"Response: {r.json()}")

# ── Test 3: complete job ──────────────────────────────────────────────────────
print("\n--- TEST 3: complete job ---")
r = requests.post(
    f"{LOCAL}/api/vault/jobs/{JOB_ID}/complete",
    json={"total_queued": 1},
    timeout=30,
)
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")

# ── Test 4: list stems ────────────────────────────────────────────────────────
print("\n--- TEST 4: list stems ---")
r = requests.get(f"{LOCAL}/api/stems?limit=5", timeout=10)
print(f"Status: {r.status_code}")
data = r.json()
print(f"Total: {data.get('pagination', {}).get('total')}")
for s in data.get('stems', [])[:3]:
    print(f"  {s['artist']} - {s['title']} [{s['stemType']}]")
