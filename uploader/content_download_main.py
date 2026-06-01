# File: content_download_main.py
"""Main channel stem processor with advanced audio mixing.

High-quality stem separation and processing:
- Acapella (vocals only)
- Drums (percussion)
- Instrumental (other + drums + bass combined with loudness normalization)

Features:
- Uses htdemucs_ft model for best quality
- Proper stem mixing with normalization
- Consistent loudness across all stems
"""

from __future__ import annotations

import os
import shutil
import time
import threading
import requests

# Fully serialises Laravel uploads — only one stem uploads at a time across all
# concurrent tracks. Eliminates MySQL deadlocks entirely. File upload is I/O-bound
# so the throughput cost of serialising is negligible.
_LARAVEL_SEM = threading.Semaphore(1)


# def upload_to_laravel(audio_path, track, stem_type, bpm, key, genre):
#     """Upload single stem to Laravel API"""
#     laravel_url = "https://puristic-filmily-bula.ngrok-free.dev"
    
#     if not os.path.exists(audio_path):
#         return
    
#     try:
#         bpm_int = int(float(bpm)) if bpm and bpm != 0 else 120
#         if bpm_int < 40 or bpm_int > 220:
#             bpm_int = 120
        
#         key_value = key if key and key != "Unknown" else "C"
#         genre_value = genre if genre else "Hip Hop"
#         stem_type_value = stem_type.capitalize()
        
#         with open(audio_path, 'rb') as f:
#             files = {'file': (os.path.basename(audio_path), f, 'audio/mpeg')}
#             data = {
#                 'title': track.get('name', 'Unknown'),
#                 'artist': track.get('artist', 'Unknown'),
#                 'stem_type': stem_type_value,
#                 'bpm': bpm_val,
#                 'key': key_value,
#                 'genre': genre_value
#             }
            
#             response = requests.post(f"{laravel_url}/api/upload/single", files=files, data=data, timeout=60)
            
#             if response.status_code in (200, 201):
#                 print(f"✅ [LARAVEL] Uploaded {stem_type_value}")
#             else:
#                 print(f"❌ [LARAVEL] {stem_type_value} failed: {response.status_code}")
#     except Exception as e:
#         print(f"❌ [LARAVEL] {stem_type} error: {e}")
     
     
def complete_job(job_id: str, total_queued: int, server_url: str = None):
    """
    Tell the server the batch is done and how many stems were queued.
    Triggers zip rebuild per genre.
    """
    url = server_url or "https://springgreen-mandrill-515031.hostingersite.com"
    try:
        response = requests.post(
            f"{url}/api/vault/jobs/{job_id}/complete",
            json={"total_queued": total_queued},
            timeout=30,
        )
        if response.status_code == 200:
            data = response.json()
            print(f"✅ [JOB] {job_id} complete — {data.get('stemCount',0)} stems, {data.get('zipJobsQueued',0)} zip jobs queued")
        else:
            print(f"⚠️ [JOB] complete returned {response.status_code}: {response.text[:200]}")
    except Exception as e:
        print(f"⚠️ [JOB] complete call failed: {e}")


def upload_to_laravel(audio_path, track, stem_type, bpm, key, genre,
                      album_name=None, album_type='single', release_date=None,
                      specific_genre=None, job_id=None,
                      spotify_id=None, cover_art_url=None, is_free=False):
    """
    Upload single stem to Laravel API.
    RAISES on any failure — caller is responsible for retries.
    No internal try/except so the retry loop in process_stem actually works.
    """
    laravel_url = "https://springgreen-mandrill-515031.hostingersite.com"

    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # BPM — keep decimal precision (e.g. 75.5, 88.4)
    try:
        bpm_val = round(float(bpm), 1) if bpm and bpm != 0 else 120
        if bpm_val < 40 or bpm_val > 220:
            bpm_val = 120
        bpm_val = int(bpm_val) if bpm_val == int(bpm_val) else bpm_val
    except (TypeError, ValueError):
        bpm_val = 120

    key_value = key if key and key != "Unknown" else "C"
    genre_value = genre if genre else "Hip Hop"
    stem_type_value = stem_type.capitalize()

    # cover_art_url must be an HTTPS URL — never a local path
    resolved_cover_url = cover_art_url or track.get('img') or track.get('cover_art_url')
    if resolved_cover_url and not str(resolved_cover_url).startswith("http"):
        resolved_cover_url = track.get('img') or track.get('cover_art_url') or None

    with open(audio_path, 'rb') as audio_f:
        files = {'file': (os.path.basename(audio_path), audio_f, 'audio/mpeg')}
        data = {
            'title': track.get('name', 'Unknown'),
            'artist': track.get('artist', 'Unknown'),
            'stem_type': stem_type_value,
            'bpm': bpm_val,
            'key': key_value,
            'genre': genre_value,
            'album_name': album_name or track.get('album_name', track.get('name', 'Unknown')),
            'album_type': album_type or track.get('album_type', 'single'),
            'release_date': release_date or track.get('release_date'),
            'specific_genre': track.get('spotify_genre') or specific_genre or track.get('specific_genre', genre_value),
            'job_id': job_id or track.get('job_id'),
            'spotify_id': spotify_id or track.get('spotify_id') or track.get('id'),
            'cover_art_url': resolved_cover_url,
            'is_free': is_free or track.get('is_free', False),
        }
        data = {k: v for k, v in data.items() if v is not None and v != ''}

        response = requests.post(
            f"{laravel_url}/api/upload/single",
            files=files,
            data=data,
            timeout=60,
        )

    if response.status_code in (200, 201):
        print(f"✅ [LARAVEL] Uploaded {stem_type_value}")
        if resolved_cover_url:
            print(f"   cover_art_url sent: {resolved_cover_url}")
        return  # success — only clean exit

    # All non-success responses raise so process_stem's retry loop handles them
    raise Exception(f"HTTP {response.status_code}: {response.text[:300]}")


def upload_to_server(audio_path, track, stem_type, bpm, key, genre,
                     album_name=None, album_type='single', release_date=None,
                     specific_genre=None, job_id=None,
                     spotify_id=None, cover_art_url=None, is_free=False,
                     server_url=None):
    """
    Upload single stem to the new SGS API (Fastify).
    Drop-in replacement for upload_to_laravel.
    RAISES on failure — caller handles retries.
    """
    base_url = server_url or "https://yourdomain.com"  # update to production domain

    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    try:
        bpm_val = round(float(bpm), 1) if bpm and bpm != 0 else 120
        if bpm_val < 40 or bpm_val > 220:
            bpm_val = 120
        bpm_val = int(bpm_val) if bpm_val == int(bpm_val) else bpm_val
    except (TypeError, ValueError):
        bpm_val = 120

    key_value = key if key and key != "Unknown" else "C Maj"
    genre_value = genre if genre else "Hip-Hop"
    stem_type_value = stem_type.capitalize()

    resolved_cover_url = cover_art_url or track.get('img') or track.get('cover_art_url')
    if resolved_cover_url and not str(resolved_cover_url).startswith("http"):
        resolved_cover_url = track.get('img') or track.get('cover_art_url') or None

    with open(audio_path, 'rb') as audio_f:
        files = {'file': (os.path.basename(audio_path), audio_f, 'audio/mpeg')}
        data = {
            'title':         track.get('name', 'Unknown'),
            'artist':        track.get('artist', 'Unknown'),
            'stem_type':     stem_type_value,
            'bpm':           bpm_val,
            'key':           key_value,
            'genres':        genre_value,   # new API uses 'genres' (accepts single or CSV)
            'album_name':    album_name or track.get('album_name', track.get('name', 'Unknown')),
            'album_type':    album_type or track.get('album_type', 'single'),
            'release_date':  release_date or track.get('release_date'),
            'job_id':        job_id or track.get('job_id'),
            'cover_art_url': resolved_cover_url,
        }
        data = {k: v for k, v in data.items() if v is not None and v != ''}

        response = requests.post(
            f"{base_url}/api/upload/single",
            files=files,
            data=data,
            timeout=60,
        )

    if response.status_code in (200, 201):
        resp = response.json()
        print(f"✅ [SGS] Uploaded {stem_type_value} — stem id: {resp.get('stem', {}).get('id', '?')}")
        return

    if response.status_code == 409:
        resp = response.json()
        print(f"⚠️ [SGS] Duplicate skipped: {resp.get('message', '')}")
        return  # duplicate is not a failure

    raise Exception(f"HTTP {response.status_code}: {response.text[:300]}")


def _safe_component(name: str, max_len: int = 60) -> str:
    """
    Sanitize a path component for Windows:
    - remove forbidden characters
    - trim trailing dots/spaces
    - keep the trailing bracket block ("[BPM …]") when truncating so BPM/Key stay visible
    - hard-limit length so paths don't blow past MAX_PATH
    """
    bad_chars = '<>:"/\\|?*'
    for ch in bad_chars:
        name = name.replace(ch, "")
    name = name.strip().strip(".")
    if len(name) <= max_len:
        return name

    # Preserve the trailing bracket section (e.g., "[BPM 83.5 A major]") when trimming
    if "[" in name and "]" in name and name.rfind("[") < name.rfind("]"):
        prefix, bracket = name.rsplit("[", 1)
        bracket = "[" + bracket  # restore the split bracket
        prefix = prefix.rstrip()

        # Leave space for a separator before the bracket if possible
        reserve = len(bracket) + 1  # +1 for space
        if reserve >= max_len:
            # Fallback: if the bracket itself is too long, hard trim
            return (bracket[: max_len - 1] + "]").rstrip()

        prefix_budget = max_len - reserve
        trimmed_prefix = prefix[:prefix_budget].rstrip()
        return f"{trimmed_prefix} {bracket}".strip()

    # No recognizable bracket block; simple truncation
    return name[:max_len].rstrip()

from typing import Any, Dict, List, Optional

try:
    from moviepy import AudioFileClip, ColorClip, CompositeVideoClip, ImageClip
    MOVIEPY_AVAILABLE = True
    MOVIEPY_IMPORT_ERROR: Optional[Exception] = None
    print(" moviepy available — MP4 rendering enabled")
except ModuleNotFoundError as exc:
    AudioFileClip = ColorClip = ImageClip = None
    MOVIEPY_AVAILABLE = False
    MOVIEPY_IMPORT_ERROR = exc
    print(f" moviepy not available: {exc}")
    print("   Install via: pip install moviepy")
    print("   Requires: ffmpeg (install separately if missing)")
from mutagen.easyid3 import EasyID3
from mutagen.id3 import COMM, ID3, TIT2
from mutagen.mp3 import MP3
from pydub import AudioSegment

from branding_utils import add_intro_card, apply_moviepy_resize
from content_base import (
    ContentBase,
    DEFAULT_DESCRIPTION,
    DEFAULT_TAGS,
    format_bpm_label,
    normalize_genre,
)
from shared_state import get_progress, set_progress
from stem_processor import StemProcessor
from tiktok_uploader import TikTokUploader

# Register custom comment tag once.
if "comment" not in EasyID3.valid_keys:
    EasyID3.RegisterTXXXKey("comment", "comment")


class Content_download_main(ContentBase):
    """Prepare acapella, drums, and instrumental stems for the main channel.
    
    Stem mapping:
    - Acapella: vocals only
    - Drums: percussion instruments
    - Instrumental: other + drums + bass (full instruments without vocals)
    """

    # Max length for folder/file base names. Long titles will drop BPM/Key
    # and, if still too long, get trimmed with "..."
    MAX_FOLDER_TITLE_CHARS = 120

    STEM_DEFINITIONS: Dict[str, Dict[str, object]] = {
        # Acapella: vocals stem directly from model
        "Acapella": {
            "stem_key": "acapella",
            "sources": ["vocals.mp3"],
            "mix": False,
            "description": "Vocals-only stem"
        },
        # Drums: percussion directly from model
        "Drums": {
            "stem_key": "drums",
            "sources": ["drums.mp3"],
            "mix": False,
            "description": "Drums/percussion stem"
        },
        # Bass: bass stem directly from model
        "Bass": {
            "stem_key": "bass",
            "sources": ["bass.mp3"],
            "mix": False,
            "description": "Bass-only stem"
        },
        # Melody: other/melody stem directly from model
        "Melody": {
            "stem_key": "melody",
            "sources": ["other.mp3"],
            "mix": False,
            "description": "Melody/other instruments stem"
        },
        # Instrumental: combination of other + drums + bass (no vocals)
        "Instrumental": {
            "stem_key": "instrumental",
            "sources": ["other.mp3", "drums.mp3", "bass.mp3"],
            "mix": True,
            "description": "Full instrumental (other + drums + bass)"
        },
    }

    def __init__(self, args: Dict):
        super().__init__(args)
        self.track_info = args.get("track_info", {})
        self.stem_base_path = args.get("stem_base_path", "")
        self.selected_genre = normalize_genre(args.get("genre"))
        self.genre_folder = self._sanitize_folder_name(self.selected_genre)
        self.trim_track = args.get("trim_track", False)
        self.trim_length = args.get("trim_length", 72)
        self.thumbnail_map: Dict[str, str] = {}

    # ------------------------------------------------------------------
    # Progress helpers (same structure as other processors)
    # ------------------------------------------------------------------
    def incremental_progress(self, message, step_index, total_steps, metadata=None):
        progress_data = get_progress(self.session_id) or {}
        meta = progress_data.get("meta", {})
        completed = meta.get("completed", 0)
        total = meta.get("total", 1)
        base = (completed / total) * 100 if total else 0
        step_size = 100 / total / total_steps if total_steps else 0
        step_percent = base + step_index * step_size

    def _sanitize_filename(self, name: str) -> str:
        """
        Sanitize filename while preserving hyphens, spaces, and brackets.
        Only removes truly problematic characters for file systems.
        """
        import re

        # Remove only truly problematic characters: \ / : * ? " < > |
        cleaned = re.sub(r"[\\/:*?\"<>|]+", " ", name or "")
        # Collapse multiple spaces but preserve single spaces
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
        return cleaned or "Untitled"

    def _build_folder_title(
        self,
        artist: str,
        title: str,
        stem_type: str,
        bpm: str,
        key: str,
    ) -> str:
        """
        Build folder title in format: Artist - Song StemType [BPM Key]
        Example: "Sean Kingston - Beautiful Girls Acapella [130 C♯ minor]"

        If the formatted title would exceed the safe component length (60 chars),
        drop the BPM/Key bracket so the folder preserves more of the long track
        name while stem files keep their BPM/Key metadata.
        """
        MAX_FOLDER_COMPONENT = 60  # Matches _safe_component default for path parts

        # Clean artist and title (keep spaces, just trim)
        artist_clean = artist.strip()
        title_clean = title.strip()

        # Format stem type (title case, spaces)
        stem_display = stem_type.replace("_", " ").title()

        # Build base: Artist - Song StemType
        base = f"{artist_clean} - {title_clean} {stem_display}"

        # Build bracket content: [BPM Key] or [BPM] for drums
        bracket_parts = [f"BPM {bpm}"]
        if stem_type.lower() != "drums" and key and key != "Unknown":
            bracket_parts.append(key)

        bracket = f" [{' '.join(bracket_parts)}]"

        # Prefer keeping BPM/Key, but drop them if the component would be too long
        with_bracket = self._sanitize_filename(base + bracket)
        without_bracket = self._sanitize_filename(base)

        if len(with_bracket) > MAX_FOLDER_COMPONENT:
            folder_title = without_bracket
        else:
            folder_title = with_bracket

        return folder_title

    def _tag_stem(self, file_path: str, stem_type: str, bpm: str, key: str) -> None:
        """
        Write ID3 tags for exported stems.
        Section 3 rules: Drums = BPM only, all others = BPM + Key
        """
        # Section 3: Drums gets BPM only, others get BPM + Key
        if stem_type.lower() == "drums":
            comment_text = f"BPM: {bpm}"
        else:
            key_text = key if key and key != "Unknown" else ""
            if key_text:
                comment_text = f"BPM: {bpm}, Key: {key_text}"
            else:
                comment_text = f"BPM: {bpm}"

        try:
            audio = EasyID3(file_path)
            audio["title"] = f"{stem_type} stem"
            audio["comment"] = comment_text
            audio.save()
        except Exception:
            audio = MP3(file_path, ID3=ID3)
            if audio.tags is None:
                audio.add_tags()
            audio.tags.add(
                COMM(
                    encoding=3,
                    lang="eng",
                    desc="Comment",
                    text=comment_text,
                )
            )
            audio.save()
            audio.tags.add(TIT2(encoding=3, text=f"{stem_type} stem"))
            audio.tags.add(COMM(encoding=3, lang="eng", desc="desc", text=comment_text))
            audio.save()

    def _render_video(
        self,
        audio_path: str,
        thumb_path: Optional[str],
        stem_type: str,
        bpm: str,
        key: str,
        artist: str,
        track_title: str,
    ) -> Optional[str]:
        if not MOVIEPY_AVAILABLE:
            error_hint = "pip install moviepy"
            detail = f" ({MOVIEPY_IMPORT_ERROR})" if MOVIEPY_IMPORT_ERROR else ""
            print(
                f" Cannot render {stem_type} video: moviepy not available{detail}\n"
                f"   Install: {error_hint}\n"
                f"   Also need: ffmpeg (install separately if missing)"
            )
            return None

        try:
            if not os.path.exists(audio_path):
                print(f" Audio file not found: {audio_path}")
                return None
            
            channel = self.channel_label
            genre = self.genre_folder
            stem_display = stem_type.replace("_", " ").title()

            # Build a safe, shortened folder/file name so Windows paths don't explode
            folder_title = self._build_folder_title(artist, track_title, stem_type, bpm, key)
            safe_folder = _safe_component(folder_title, max_len=60)
            safe_filename = f"{safe_folder}.mp4"

            out_dir = os.path.join("MP4", channel, genre, stem_display, safe_folder)
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, safe_filename)

            print(f"🎬 Rendering video for {stem_type}...")
            print(f"   Audio: {audio_path}")
            print(f"   Output: {out_path}")
            
            audio_clip = AudioFileClip(audio_path)
            print(f"   Duration: {audio_clip.duration}s")
            
            # Section 2: Enhanced branding with watermark and stem icon
            branded_clip = add_intro_card(audio_clip.duration, channel, thumb_path, stem_type)
            if not branded_clip:
                thumb = thumb_path if thumb_path and os.path.exists(thumb_path) else None
                if thumb:
                    print(f"   Using thumbnail: {thumb}")
                    thumb_clip = ImageClip(thumb).with_duration(audio_clip.duration)
                    thumb_clip = apply_moviepy_resize(thumb_clip, new_size=(720, 720))
                    thumb_clip = thumb_clip.with_position("center")
                    background = ColorClip(
                        size=(1280, 720), color=(0, 0, 0), duration=audio_clip.duration
                    )
                    branded_clip = CompositeVideoClip(
                        [background, thumb_clip], size=(1280, 720)
                    )
                else:
                    print(f"   No thumbnail, using solid background")
                    branded_clip = ColorClip(
                        size=(1280, 720), color=(0, 0, 0), duration=audio_clip.duration
                    )
            
            # Ensure branding is applied even if add_intro_card didn't add it
            # Add watermark and stem icon to the final clip
            from branding_utils import add_watermark, add_stem_icon
            if branded_clip:
                watermarked = add_watermark(branded_clip, channel, audio_clip.duration)
                if watermarked:
                    branded_clip = watermarked
                if stem_type:
                    iconed = add_stem_icon(branded_clip, stem_type, audio_clip.duration)
                    if iconed:
                        branded_clip = iconed

            final_video = branded_clip.with_audio(audio_clip)
            print(f"   Writing MP4...")
            final_video.write_videofile(
        out_path,
        fps=0.01,              # ultra-low FPS prevents frame-per-second rendering
        codec="libx264",
        audio_codec="aac",
        preset="ultrafast",
        threads=4,
    )

            print(f" ✓ Video rendered: {out_path}")
            return out_path
        except Exception as exc:
            print(f" ✗ Failed to render {stem_type} video: {exc}")
            import traceback
            traceback.print_exc()
            return None

    def _mix_sources(self, source_paths: List[str]) -> Optional[AudioSegment]:
        """
        Combine multiple stems using advanced mixing with loudness normalization.
        apply_fade is skipped in web-library / fast mode — fades add CPU work and
        serve no purpose for stems downloaded to a library (only useful for video).
        """
        if not source_paths:
            return None

        channel = self.args.get("channel", "")
        is_web_library = channel in ("web_library", "weblibrary")
        fast_mode = not self.args.get("yt", False) and not self.args.get("render_videos", False)
        use_fade = not (fast_mode or is_web_library)

        mixed = StemProcessor.mix_stems(
            stem_paths=source_paths,
            target_loudness=-1.0,
            apply_fade=use_fade,
        )
        return mixed

    def _prepare_audio(self, base_folder: str, config: Dict[str, object]) -> Optional[str]:
        print(f"\n🎧 Preparing audio: {config.get('stem_key')}")
        print(f"   stem_base_path: {self.stem_base_path}")
        print(f"   exists: {os.path.isdir(self.stem_base_path) if self.stem_base_path else 'N/A'}")
        
        sources = [os.path.join(self.stem_base_path, name) for name in config.get("sources", [])]
        print(f"   Looking for sources: {config.get('sources')}")
        
        missing = [path for path in sources if not os.path.exists(path)]
        if missing:
            print(f"   ⚠ Missing: {missing}")
            if os.path.isdir(self.stem_base_path):
                print(f"   📁 Files in stem_base_path: {os.listdir(self.stem_base_path)}")
            if config.get("mix"):
                return None
            if len(missing) == len(sources):
                return None
            sources = [p for p in sources if os.path.exists(p)]
        else:
            print(f"   ✓ All sources found")

        stem_key = str(config.get("stem_key", "stem"))

        # Use a safe, shortened file name so Windows paths don't explode
        raw_base = os.path.basename(base_folder)
        safe_base = _safe_component(raw_base, max_len=60)

        audio_path = os.path.join(base_folder, f"{safe_base}.mp3")
        os.makedirs(base_folder, exist_ok=True)

        try:
            if config.get("mix"):
                print(f"   🎚️ Mixing {len(sources)} sources...")
                segment = self._mix_sources(sources)
                if segment is None:
                    print("   ✗ Failed to mix sources")
                    return None
                print(f"   ✓ Mixed and exporting: {audio_path}")
                segment.export(audio_path, format="mp3")
            else:
                print(f"   Copying {sources[0]} to {audio_path}")
                shutil.copy(sources[0], audio_path)
                print(f"   ✓ Copied: {audio_path}")
        except Exception as exc:
            print(f"   ✗ Failed to prepare audio for {stem_key}: {exc}")
            import traceback
            traceback.print_exc()
            return None

        if os.path.exists(audio_path):
            print(f"   ✓ Audio ready: {audio_path} ({os.path.getsize(audio_path)} bytes)")
            return audio_path
        else:
            print(f"   ✗ Audio file not created")
            return None

    def process_stem(
        self,
        stem_type: str,
        config: Dict[str, object],
        track: Dict[str, Any],
        thumb_path: Optional[str],
        step_offset: float,
        total_steps: int,
    ) -> bool:
        print(f"\n{'='*60}")
        print(f"Processing Stem: {stem_type}")
        print(f"{'='*60}")
        
        bpm = format_bpm_label(track.get("tempo", 0))
        key = track.get("key", "Unknown")
        artist = track.get("artist", "Unknown Artist")
        title = track.get("name", "Unknown Track")
        channel = self.channel_label

        meta = self.build_meta(stem_type, channel, track)

        # Build a short, safe folder name for the track
        folder_title = self._build_folder_title(artist, title, stem_type, bpm, key)
        safe_folder = _safe_component(folder_title, max_len=60)

        base_folder = os.path.join(
            channel,
            self.genre_folder,
            stem_type,
            safe_folder,
        )
                
        print(f"Artist: {artist}")
        print(f"Title: {title}")
        print(f"Channel: {channel}")
        print(f"BPM: {bpm} | Key: {key}")

        self.incremental_progress(
            f"🎧 Preparing {stem_type} audio...",
            step_offset,
            total_steps,
            meta,
        )
        audio_path = self._prepare_audio(base_folder, config)
        if not audio_path:
            self.update_progress(f" {stem_type} audio unavailable", meta)
            return False


        if not isinstance(audio_path, str):
            print(f"❌ ERROR: audio_path is {type(audio_path)}, expected str")
            print(f"   audio_path value: {audio_path}")
            # Try to extract path if it's a dict
            if isinstance(audio_path, dict) and 'path' in audio_path:
                audio_path = audio_path['path']
            elif isinstance(audio_path, dict) and 'audio_path' in audio_path:
                audio_path = audio_path['audio_path']
            else:
                print(f"   Cannot fix, skipping upload")
                return False
    
    
        if audio_path and os.path.exists(audio_path):
            # _LARAVEL_SEM limits concurrent uploads — prevents MySQL deadlocks
            # caused by multiple tracks uploading simultaneously.
            with _LARAVEL_SEM:
                for attempt in range(1, 6):  # up to 5 attempts
                    try:
                        upload_to_server(
                            audio_path,
                            track,
                            stem_type,
                            bpm,
                            key,
                            self.selected_genre,
                            album_name=track.get('album_name'),
                            album_type=track.get('album_type', 'single'),
                            release_date=track.get('release_date'),
                            job_id=self.args.get('job_id'),
                            cover_art_url=track.get('img') or track.get('cover_art_url'),
                        )
                        break  # success
                    except Exception as e:
                        is_deadlock = "Deadlock" in str(e)
                        if attempt < 5:
                            wait = attempt * 3 if is_deadlock else attempt * 2
                            label = "Deadlock" if is_deadlock else "Error"
                            print(f"   ⚠️ [{label}] {stem_type} upload attempt {attempt}/5 — retrying in {wait}s: {e}")
                            time.sleep(wait)
                        else:
                            # All 5 attempts exhausted — log clearly, do NOT silently continue
                            print(f"   ❌ [SGS] {stem_type} UPLOAD FAILED after 5 attempts — stem will be missing from library!")
                            print(f"      Track: {track.get('artist')} — {track.get('name')}")
                            print(f"      Error: {e}")
                    
        if self.trim_track:
            audio_path = self.trim_audio(audio_path, self.trim_length)

        self.incremental_progress(
            f"🏷️ Tagging {stem_type} metadata...",
            step_offset + 0.2,
            total_steps,
            meta,
        )
        self._tag_stem(audio_path, stem_type, bpm, key)

        # Section 4: Fast Mode - Skip video rendering, branding, thumbnails when Upload=OFF
        # Web Library is audio-only (Laravel upload) — never needs MP4s
        channel = self.args.get("channel", "")
        is_web_library = channel in ("web_library", "weblibrary")
        upload_enabled = self.args.get("yt", False)
        render_videos = upload_enabled or self.args.get("render_videos", False)
        fast_mode = not render_videos or is_web_library

        if is_web_library and render_videos:
            print(f"[WEB LIBRARY] Skipping video rendering — audio-only channel")
        
        if fast_mode:
            print(f"[FAST MODE] Skipping video rendering, branding, thumbnails for {stem_type}")
            self.incremental_progress(
                f"⏩ Fast Mode: Skipping video rendering for {stem_type}...",
                step_offset + 0.4,
                total_steps,
                meta,
            )
            # Fast Mode: Just save audio, no video
            stem_key = str(config.get("stem_key", stem_type.lower()))
            # Store audio path instead of video path for fast mode
            self.video_paths[stem_key] = audio_path
            
            self.incremental_progress(
                f"✓ Fast Mode: {stem_type} audio ready",
                step_offset + 0.6,
                total_steps,
                meta,
            )
            return True
        else:
            # Enhanced Mode: Full video rendering with branding
            self.incremental_progress(
                f"🎬 Rendering {stem_type} video...",
                step_offset + 0.4,
                total_steps,
                meta,
            )
            video_path = self._render_video(audio_path, thumb_path, stem_type, bpm, key, artist, title)
            if not video_path:
                if not MOVIEPY_AVAILABLE:
                    self.update_progress(
                        " moviepy not installed; install with `pip install moviepy` to render videos",
                        meta,
                    )
                else:
                    self.update_progress(f" Failed to render {stem_type} video", meta)
                return False

            stem_key = str(config.get("stem_key", stem_type.lower()))
            self.video_paths[stem_key] = video_path
            if thumb_path:
                self.thumbnail_map[stem_key] = thumb_path

            self.incremental_progress(
                f"☁️ Syncing {stem_type} assets...",
                step_offset + 0.6,
                total_steps,
                meta,
            )
            self.upload_to_ec2_if_needed(base_folder)
            return True

    def upload_batch_to_youtube(self, track: Dict[str, Any]):
        """Upload all stems to YouTube with metadata and per-channel comments."""
        if not (self.args.get("yt") and self.video_paths):
            return

        artist = track.get("artist", "Unknown Artist")
        title = track.get("name", "Unknown Track")
        bpm = format_bpm_label(track.get("tempo", 0))
        key = track.get("key", "Unknown")

        key_text = str(key).strip() if key else ""

        # Build titles with artist, track name, stem type, and BPM/Key
        # Section 3: Drums = BPM only, others = BPM + Key
        # BPM label comes before the number
        title_map = {
            "acapella": f"{artist} - {title} Acapella [BPM {bpm}{(' ' + key_text) if key_text else ''}]",
            "drums": f"{artist} - {title} Drums [BPM {bpm}]",
            "bass": f"{artist} - {title} Bass [BPM {bpm}{(' ' + key_text) if key_text else ''}]",
            "melody": f"{artist} - {title} Melody [BPM {bpm}{(' ' + key_text) if key_text else ''}]",
            "instrumental": f"{artist} - {title} Instrumental [BPM {bpm}{(' ' + key_text) if key_text else ''}]",
        }

        # Merge default tags with artist/title/stem types
        tags = list({
            *DEFAULT_TAGS,
            artist,
            title,
            "acapella",
            "drums",
            "instrumental",
        })

        # Use provided description or DEFAULT_DESCRIPTION
        description = self.args.get("description") or DEFAULT_DESCRIPTION

        # Get per-channel comment (if available)
        comments_map = self.args.get("comments", {})
        channel_key = self.args.get("channel", "")
        comment = comments_map.get(channel_key) if comments_map else None

        # Privacy defaults to "public"
        privacy = self.args.get("privacy", "public")

        from yt_video_multi import upload_all_stems

        self.update_progress(" Uploading main channel stems to YouTube...", {"artist": artist})
        upload_all_stems(
            stem_files=self.video_paths,
            title_map=title_map,
            description=description,
            tags=tags,
            category_id="10",
            playlist=self.args.get("playlist"),
            privacy=privacy,
            publish_at=self.args.get("publish_at"),
            tz=self.args.get("tz", "America/Chicago"),
            made_for_kids=self.args.get("made_for_kids", False),
            lang="en",
            thumbnail_map=self.thumbnail_map,
            comment=comment,  # Per-channel comment support
            dry_run=self.args.get("dry_run", False),
            channel_override=self.args.get("channel"),
        )

    def upload_batch_to_tiktok(self, track: Dict[str, Any]):
        """Upload all stems to TikTok with metadata and per-stem captions."""
        if not self.video_paths:
            return

        artist = track.get("artist", "Unknown Artist")
        title = track.get("name", "Unknown Track")
        bpm = format_bpm_label(track.get("tempo", 0))
        key = track.get("key", "Unknown")

        key_text = str(key).strip() if key else ""

        try:
            uploader = TikTokUploader()
            if not uploader.is_authenticated():
                self.update_progress(" TikTok not authenticated — skipping TikTok upload", {"artist": artist})
                return

            # Merge default tags
            tags = list({
                *DEFAULT_TAGS,
                artist,
                title,
                "acapella",
                "drums",
                "instrumental",
            })

            description = self.args.get("description", DEFAULT_DESCRIPTION)
            comments_map = self.args.get("comments", {})
            channel_key = self.args.get("channel", "")
            comment = comments_map.get(channel_key) if comments_map else None

            self.update_progress(" Uploading stems to TikTok...", {"artist": artist})

            # Upload each stem as separate TikTok video
            for stem_type, video_path in self.video_paths.items():
                if not os.path.exists(video_path):
                    print(f" Skipping TikTok upload for {stem_type} — file not found")
                    continue

                stem_title = f"{artist} - {title} {stem_type.title()} [BPM {bpm}{(' ' + key_text) if key_text else ''}]"
                
                print(f" [TikTok] Uploading {stem_type}...")
                video_id = uploader.upload_video(
                    video_path=video_path,
                    title=stem_title,
                    description=description,
                    tags=tags,
                    thumbnail_path=self.thumbnail_map.get(stem_type)
                )

                if video_id and comment:
                    print(f" [TikTok] Posting comment on {video_id}...")
                    uploader.post_comment(video_id, comment)

                self.update_progress(f" {stem_type.title()} uploaded to TikTok", {"artist": artist})

        except Exception as e:
            self.update_progress(f" TikTok batch upload failed: {e}", {"artist": artist})

    def download(self, track_id: str):
        track = self.track_info or self.get_track_info(track_id)
        if not track:
            self.fail_progress_with_meta(" track_info unavailable", "Acapella", self.channel_label, {"id": track_id})
            return

        if not self.stem_base_path or not os.path.isdir(self.stem_base_path):
            self.fail_progress_with_meta(" stem_base_path missing", "Acapella", self.channel_label, track)
            return

        total_steps = 2 + len(self.STEM_DEFINITIONS) * 4
        self.progress_with_meta("🔍 Preparing main channel stems...", 1, total_steps, "Acapella", self.channel_label, track)

        bpm = format_bpm_label(track.get("tempo", 0))
        key = track.get("key", "Unknown")
        artist = track.get("artist", "Unknown Artist")
        title = track.get("name", "Unknown Track")

        # Always fetch thumbnail — needed for Laravel cover_art_url even in fast mode.
        # Video rendering (MP4) is still skipped in fast mode; thumbnail is just
        # stored locally and its URL passed through to the API.
        self.progress_with_meta(" Fetching thumbnail...", 2, total_steps, "Acapella", self.channel_label, track)
        thumb_path = self.download_thumbnail(
            track.get("img") or track.get("cover_art_url"),
            artist=artist,
            title=title,
            bpm=bpm,
            key=key,
        )
        if thumb_path:
            print(f"   ✓ Thumbnail ready: {thumb_path}")
        else:
            print(f"   ⚠ Thumbnail unavailable — cover art will use Spotify URL directly")

        upload_enabled = self.args.get("yt", False)
        render_videos = upload_enabled or self.args.get("render_videos", False)
        fast_mode = not render_videos

        processed_any = False
        selected_stems_map = self.args.get("selected_stems", {})
        channel_key = self.args.get("channel", "")
        selected_stems_for_channel = selected_stems_map.get(channel_key, list(self.STEM_DEFINITIONS.keys()))

        # Count stems that will actually be uploaded for this track
        stems_to_upload = [
            st for st in self.STEM_DEFINITIONS
            if st.lower() in [s.lower() for s in selected_stems_for_channel]
        ]

        for idx, (stem_type, config) in enumerate(self.STEM_DEFINITIONS.items(), start=1):
            stem_lower = stem_type.lower()
            if stem_lower not in [s.lower() for s in selected_stems_for_channel]:
                print(f" Skipping {stem_type} (not selected for {channel_key})")
                continue
            base_step = 2 + (idx - 1) * 4 + 1
            success = self.process_stem(stem_type, config, track, thumb_path, base_step, total_steps)
            processed_any = processed_any or success

        # Notify server the job batch is complete + how many stems were sent
        job_id = self.args.get('job_id')
        if job_id and processed_any:
            complete_job(job_id, total_queued=len(stems_to_upload))

        if not processed_any:
            self.fail_progress_with_meta(" No stems were processed for the main channel", "Acapella", self.channel_label, track)
            return

        # Check if we should create MP4s even without upload
        # MP4s are created in Enhanced Mode (yt=True) or if render_videos flag is set
        render_videos = self.args.get("yt", False) or self.args.get("render_videos", False)
        
        if not render_videos and not self.args.get("yt"):
            meta = self.build_meta("Acapella", self.channel_label, track)
            self.update_progress(" Skipping YouTube upload and video rendering (yt flag disabled)", meta)
        elif self.args.get("yt"):
            self.upload_batch_to_youtube(track)
        else:
            meta = self.build_meta("Acapella", self.channel_label, track)
            self.update_progress(" Videos created but skipping YouTube upload", meta)

        if self.args.get("tiktok"):
            self.upload_batch_to_tiktok(track)

        self.progress_with_meta(" Main channel stems complete!", total_steps, total_steps, "Acapella", self.channel_label, track)
        self.mark_complete_with_meta(" Main channel upload ready", "Acapella", self.channel_label, track)


# Helper to normalize resize availability across environments
def _clip_resize(clip, *args, **kwargs):
    return apply_moviepy_resize(clip, *args, **kwargs)