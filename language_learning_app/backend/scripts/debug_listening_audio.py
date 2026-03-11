#!/usr/bin/env python3
"""
Debug script: run listening activity generation and print whether audio was embedded.
Run from backend dir: python scripts/debug_listening_audio.py
Requires: DB with vocabulary for the language, GEMINI_API_KEY set.
"""
import os
import sys

# Run from language_learning_app so backend is a package (python -m backend.scripts.debug_listening_audio)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app_dir = os.path.dirname(backend_dir)
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)
os.chdir(app_dir)

def main():
    from backend.api_client import generate_unified_activity
    from backend.db import get_words_for_activity
    from backend.config import DB_PATH

    language = 'hindi'
    print(f"Using language: {language}")
    print(f"DB path: {DB_PATH}")
    print(f"DB exists: {os.path.exists(DB_PATH)}")

    try:
        word_bank = get_words_for_activity(language, learned_limit=50, learning_limit=20)
    except Exception as e:
        print(f"get_words_for_activity failed: {e}")
        word_bank = [{'english_word': 'test', 'translation': 'परीक्षण', 'id': 1}]

    if not word_bank:
        print("No word bank - using minimal mock")
        word_bank = [{'english_word': 'hello', 'translation': 'नमस्ते', 'id': 1}]

    required = word_bank[:3] if len(word_bank) >= 3 else word_bank
    print(f"Word bank size: {len(word_bank)}, required: {len(required)}")

    print("Calling generate_unified_activity(listening, ...)...")
    try:
        activity = generate_unified_activity(
            activity_type='listening',
            word_bank=word_bank,
            language=language,
            required_learning_words=required,
            user_cefr_level='A1',
            session_id=None,
            progress_store=None,
            custom_topic='History',
            user_interests=None,
        )
    except Exception as e:
        print(f"generate_unified_activity raised: {e}")
        import traceback
        traceback.print_exc()
        return

    if activity.get('_error'):
        print(f"Activity error: {activity.get('_error')}")
        return

    # Check for transcript with audio
    has_audio = False
    for section in activity.get('sections', []):
        for item in section.get('items', []):
            if item.get('type') == 'transcript':
                b64 = item.get('audio_base64') or item.get('audioBase64')
                if b64:
                    has_audio = True
                    print(f"  OK: transcript item {item.get('item_id')} has audio_base64 ({len(b64)} chars)")
                else:
                    print(f"  MISSING: transcript item {item.get('item_id')} has NO audio_base64")
                break

    print(f"\nTTS status: {activity.get('_tts_status', 'not set')}")
    if activity.get('_tts_error'):
        print(f"TTS error: {activity.get('_tts_error')}")
    print(f"Has audio on transcript: {has_audio}")
    print(f"Prompt length: {len(activity.get('_prompt', ''))}")
    print(f"Raw response length: {len(activity.get('_raw_response', ''))}")

    # Print first 500 chars of dialogue if present
    for section in activity.get('sections', []):
        for item in section.get('items', []):
            if item.get('type') == 'transcript':
                d = item.get('dialogue', [])
                print(f"  Dialogue lines: {len(d)}")
                if d:
                    print(f"  First line keys: {list(d[0].keys())}")
                    print(f"  First line sample: {str(d[0])[:200]}")
                break

if __name__ == '__main__':
    main()
