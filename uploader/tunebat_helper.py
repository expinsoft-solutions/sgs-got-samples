"""
tunebat_helper.py

Lookup strategy:
  1. ReccoBeats API  — batch call, fast, no browser
  2. SongBPM scraper — direct page scrape, no Cloudflare

Public API:
    batch_get_bpm_key(tracks) -> {track_id: (bpm, key)}
    get_bpm_key(track_name, artist_name, track_id, retries=2) -> (bpm, key)
    get_bpm_key_from_audio(audio_path) -> (bpm, key)  [stub]
"""

from __future__ import annotations

import os
import re
import time
from typing import Tuple

import requests
from bs4 import BeautifulSoup


# ─────────────────────────── ReccoBeats ────────────────────────────

RECCO_URL = "https://api.reccobeats.com/v1/audio-features"
TIMEOUT   = 10

_PITCH_CLASS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _key_label(key: int, mode: int) -> str:
    if key < 0 or key > 11:
        return "Unknown"
    quality = "major" if mode == 1 else "minor"
    return f"{_PITCH_CLASS[key]} {quality}"


RECCO_CHUNK_SIZE = 30


def _reccobeats_batch(track_ids: list, retries: int = 2) -> dict:
    """Fetch BPM/Key for multiple track IDs, chunked into groups of 30."""
    results = {tid: (0, "Unknown") for tid in track_ids}
    chunks = [track_ids[i:i + RECCO_CHUNK_SIZE] for i in range(0, len(track_ids), RECCO_CHUNK_SIZE)]
    print(f"🎵 [ReccoBeats] Batch lookup: {len(track_ids)} tracks ({len(chunks)} chunk(s))")

    for chunk_num, chunk in enumerate(chunks, 1):
        ids_param = ",".join(chunk)
        if len(chunks) > 1:
            print(f"   📦 Chunk {chunk_num}/{len(chunks)} ({len(chunk)} tracks)")
        for attempt in range(1, retries + 1):
            try:
                resp = requests.get(RECCO_URL, params={"ids": ids_param}, timeout=TIMEOUT * 2)
                resp.raise_for_status()
                data = resp.json()
                content = data.get("content") or []
                if not content:
                    print(f"   ⚠️  No results returned (attempt {attempt}/{retries})")
                    if attempt < retries:
                        time.sleep(2)
                    continue

                matched = 0
                for track in content:
                    tid = track.get("id") or track.get("spotifyId") or track.get("spotify_id")
                    if not tid or tid not in results:
                        continue
                    bpm, key = _parse_recco_track(track)
                    results[tid] = (bpm, key)
                    if bpm != 0 or key != "Unknown":
                        matched += 1
                        print(f"   ✅ {tid}: BPM={bpm}  Key={key}")

                # Positional fallback if no IDs returned
                if matched == 0 and content:
                    for i, track in enumerate(content):
                        if i >= len(chunk):
                            break
                        tid = chunk[i]
                        bpm, key = _parse_recco_track(track)
                        results[tid] = (bpm, key)
                        if bpm != 0 or key != "Unknown":
                            print(f"   ✅ {tid}: BPM={bpm}  Key={key}")

                break  # chunk succeeded, move to next

            except requests.exceptions.Timeout:
                print(f"   ⏰ Chunk {chunk_num} timed out (attempt {attempt}/{retries})")
            except requests.exceptions.HTTPError as e:
                print(f"   ❌ HTTP error: {e} (attempt {attempt}/{retries})")
            except Exception as e:
                print(f"   ❌ Unexpected error: {e} (attempt {attempt}/{retries})")

            if attempt < retries:
                time.sleep(2)

    return results


def _parse_recco_track(track: dict) -> Tuple[int, str]:
    bpm = 0
    key = "Unknown"
    try:
        bpm = int(round(float(track.get("tempo") or 0)))
    except (ValueError, TypeError):
        pass
    key_int  = track.get("key", -1)
    mode_int = track.get("mode", 1)
    if key_int is not None and key_int >= 0:
        key = _key_label(int(key_int), int(mode_int))
    return bpm, key


def _reccobeats(track_id: str, retries: int = 2) -> Tuple[int, str]:
    res = _reccobeats_batch([track_id], retries=retries)
    return res.get(track_id, (0, "Unknown"))


# ─────────────────────────── SongBPM Scraper ───────────────────────

_SONGBPM_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Maps SongBPM key strings (including Unicode sharp/flat) to standard names
_KEY_NORMALIZE = {
    "C": "C", "C#": "C#", "Db": "C#", "D": "D", "D#": "D#", "Eb": "D#",
    "E": "E", "F": "F", "F#": "F#", "Gb": "F#", "G": "G", "G#": "G#",
    "Ab": "G#", "A": "A", "A#": "A#", "Bb": "A#", "B": "B",
    # Unicode sharp/flat variants
    "C\u266f/D\u266d": "C#", "D\u266f/E\u266d": "D#", "F\u266f/G\u266d": "F#",
    "G\u266f/A\u266d": "G#", "A\u266f/B\u266d": "A#",
    # Sometimes appears as just the sharp letter
    "C\u266f": "C#", "D\u266f": "D#", "F\u266f": "F#",
    "G\u266f": "G#", "A\u266f": "A#",
}


def _normalize_key(raw: str) -> str:
    """Convert SongBPM key string to standard 'X major/minor' format."""
    raw = raw.strip()
    return _KEY_NORMALIZE.get(raw, raw)


def _clean_title(title: str) -> str:
    """Strip Spotify-added suffixes that won't appear on SongBPM."""
    suffixes = [
        r'\s*-\s*bonus track',
        r'\s*-\s*extended version',
        r'\s*-\s*extended',
        r'\s*-\s*remix',
        r'\s*-\s*remaster(?:ed)?(?:\s+\d{4})?',
        r'\s*-\s*radio edit',
        r'\s*-\s*single version',
        r'\s*-\s*album version',
        r'\s*-\s*explicit',
        r'\s*\(bonus track\)',
        r'\s*\(extended version\)',
        r'\s*\(remaster(?:ed)?(?:\s+\d{4})?\)',
    ]
    result = title
    for s in suffixes:
        result = re.sub(s, '', result, flags=re.IGNORECASE).strip()
    return result


def _make_slug(text: str) -> str:
    """Convert text to SongBPM URL slug."""
    text = text.lower().strip()
    # a.k.a → aka
    text = re.sub(r"a\.k\.a\.?", "aka", text)
    # Apostrophe immediately before / → drop it (Greatdayndamornin'/ → Greatdayndamornin/)
    text = re.sub(r"['\u2019\u2018\u02bc](?=/)", "", text)
    # Remaining apostrophes → hyphen (don't → don-t)
    text = re.sub(r"['\u2019\u2018\u02bc]", "-", text)
    # Dots removed (m.A.A.d → maad)
    text = text.replace(".", "")
    # " - " → "---"
    text = re.sub(r"\s+-\s+", "---", text)
    # / → "-"
    text = re.sub(r"/", "-", text)
    # Remove parens but keep content
    text = re.sub(r"[()]", "", text)
    # Remove other special chars → space
    text = re.sub(r"[^a-z0-9\s-]", " ", text)
    text = re.sub(r"\s+", "-", text.strip())
    # Collapse 4+ hyphens → ---
    text = re.sub(r"-{4,}", "---", text)
    # Collapse exactly 2 hyphens → 1 (preserve ---)
    text = re.sub(r"(?<!-)-{2}(?!-)", "-", text)
    text = text.strip("-")
    return text


def _songbpm_parse(resp) -> Tuple[int, str]:
    """Parse BPM and Key from a SongBPM song page response."""
    resp.encoding = "utf-8"
    soup = BeautifulSoup(resp.text, "html.parser")
    text = soup.get_text(" ", strip=True)

    bpm = 0
    m = re.search(r'Tempo\s*\(BPM\)\s*(\d{2,3})', text)
    if not m:
        m = re.search(r'(\d{2,3})\s*BPM', text)
    if m:
        bpm = int(m.group(1))

    key = "Unknown"
    key_m = re.search(r'Key\s+([\w#\u266f\u266d/]+)', text)
    if key_m:
        raw_key  = key_m.group(1).strip()
        key_name = _normalize_key(raw_key)
        mode = "major"
        mode_m = re.search(r'with a .+? key and a (major|minor) mode', text)
        if mode_m:
            mode = mode_m.group(1)
        key = f"{key_name} {mode}"

    return bpm, key


def _songbpm_search(track_name: str, artist_name: str) -> Tuple[int, str]:
    """Search songbpm.com via POST when direct URL 404s. Works from home IPs."""
    clean = _clean_title(track_name)
    clean = re.sub(r'\s*[\(\[]?feat\..*?[\)\]]?\s*$', '', clean, flags=re.IGNORECASE).strip()
    query = f"{artist_name} {clean}"
    print(f"   🔍 [SongBPM Search] {query}")
    try:
        session = requests.Session()
        session.headers.update(_SONGBPM_HEADERS)

        # Single homepage hit — gets cookies + CSRF token
        home = session.get("https://songbpm.com/", timeout=10)
        home.encoding = "utf-8"
        csrf_soup = BeautifulSoup(home.text, "html.parser")
        csrf_meta = csrf_soup.find("meta", {"name": "csrf-token"})
        if csrf_meta:
            session.headers["X-CSRF-Token"] = csrf_meta.get("content", "")
        session.headers["Content-Type"] = "application/x-www-form-urlencoded"
        session.headers["Origin"] = "https://songbpm.com"
        session.headers["Referer"] = "https://songbpm.com/"

        resp = session.post(
            "https://songbpm.com/searches",
            data={"query": query},
            timeout=15,
            allow_redirects=True,
        )
        resp.encoding = "utf-8"

        if resp.status_code != 200:
            print(f"   ❌ Search returned {resp.status_code}")
            return 0, "Unknown"

        soup = BeautifulSoup(resp.text, "html.parser")
        artist_lower = artist_name.lower().replace(" ", "-")

        # Find song links — prefer ones matching the artist slug
        links = [
            a["href"] for a in soup.find_all("a", href=True)
            if a["href"].startswith("/@") and a["href"].count("/") == 2
        ]

        # Try artist-matching link first, then fall back to first result
        ordered = sorted(links, key=lambda h: (0 if artist_lower in h else 1))

        for href in ordered[:3]:
            song_url = f"https://songbpm.com{href}"
            print(f"   ↩️  Trying result: {song_url}")
            r2 = session.get(song_url, timeout=10)
            if r2.status_code == 200:
                bpm, key = _songbpm_parse(r2)
                if bpm != 0 or key != "Unknown":
                    return bpm, key

    except Exception as e:
        print(f"   ❌ SongBPM search error: {e}")
    return 0, "Unknown"


def _songbpm(track_name: str, artist_name: str) -> Tuple[int, str]:
    """
    Scrape songbpm.com — no Cloudflare, no API key.
    1. Try direct URL: songbpm.com/@{artist-slug}/{song-slug}
    2. On 404, fall back to search: songbpm.com/{artist}+{title}
    """
    artist_slug = _make_slug(artist_name)
    full_slug   = _make_slug(track_name)
    # Strip feat. and Spotify suffixes for cleaner slug
    clean_title = _clean_title(track_name)
    clean_title = re.sub(r'\s*[\(\[]?feat\..*?[\)\]]?\s*$', '', clean_title, flags=re.IGNORECASE).strip()
    clean_slug  = _make_slug(clean_title)

    slugs = []
    if clean_slug and clean_slug != full_slug:
        slugs.append(clean_slug)
    if full_slug:
        slugs.append(full_slug)

    for slug in slugs:
        url = f"https://songbpm.com/@{artist_slug}/{slug}"
        print(f"🎵 [SongBPM] Trying: {url}")
        try:
            resp = requests.get(url, headers=_SONGBPM_HEADERS, timeout=10)
            if resp.status_code == 404:
                print(f"   ↩️  404 — trying next slug")
                continue
            resp.raise_for_status()
            bpm, key = _songbpm_parse(resp)
            if bpm != 0 or key != "Unknown":
                print(f"   ✅ BPM={bpm}  Key={key}")
                return bpm, key
            print(f"   ⚠️  Page loaded but no BPM/Key parsed")
        except requests.exceptions.HTTPError:
            continue
        except Exception as e:
            print(f"   ❌ SongBPM error: {e}")

    # All direct slugs failed — use search
    print(f"   ↩️  Direct URL failed — trying search...")
    bpm, key = _songbpm_search(track_name, artist_name)
    if bpm != 0 or key != "Unknown":
        print(f"   ✅ BPM={bpm}  Key={key}")
        return bpm, key

    print(f"   ⚠️  [SongBPM] Not found: {artist_name} - {track_name}")
    return 0, "Unknown"


# ─────────────────────────── Public API ────────────────────────────

def batch_get_bpm_key(
    tracks: list,  # list of (track_name, artist_name, track_id)
) -> dict:        # returns {track_id: (bpm, key)}
    """
    Phase 1: ONE batch call to ReccoBeats for all tracks.
    Phase 2: SongBPM scraper for misses.
    """
    track_ids = [tid for _, _, tid in tracks]
    track_map = {tid: (name, artist) for name, artist, tid in tracks}

    print(f"\n🔍 [BATCH] Phase 1 — ReccoBeats batch lookup for {len(tracks)} tracks...")
    results = _reccobeats_batch(track_ids, retries=2)

    misses = [
        (track_map[tid][0], track_map[tid][1], tid)
        for tid, (bpm, key) in results.items()
        if bpm == 0 and key == "Unknown"
    ]

    if misses:
        print(f"\n🔎 [BATCH] Phase 2 — SongBPM for {len(misses)} track(s)...")
        for track_name, artist_name, track_id in misses:
            bpm, key = _songbpm(track_name, artist_name)
            results[track_id] = (bpm, key)
            time.sleep(0.5)  # polite delay

    return results


def get_bpm_key(
    track_name: str,
    artist_name: str,
    track_id: str,
    retries: int = 2,
) -> Tuple[int, str]:
    """ReccoBeats first, SongBPM fallback."""
    bpm, key = _reccobeats(track_id, retries=retries)
    if bpm != 0 or key != "Unknown":
        return bpm, key
    print("   ↩️  ReccoBeats empty — trying SongBPM...")
    return _songbpm(track_name, artist_name)


def get_bpm_key_from_audio(audio_path: str) -> Tuple[int, str]:
    """Stub — values are set before audio download, never overwrite them."""
    print(f"[BPM/Key] Skipping local analysis — values already set ({audio_path})")
    return 0, "Unknown"
