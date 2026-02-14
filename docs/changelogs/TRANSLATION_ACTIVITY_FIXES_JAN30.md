# Translation Activity Fixes - January 30, 2026

## Summary

Fixed two critical issues with the translation activity and provided complete implementation guide for audio recording feature.

---

## ✅ Issue 1: Activity Not Saved After Generation

### Problem
Translation activities were not saved to the database after generation, making them impossible to reopen from history.

### Root Cause
The `/api/activity/translation/{language}` endpoint was missing the `db.log_activity()` call that other activities (reading, writing, speaking) use.

### Solution
Added immediate save to `backend/main.py` lines ~1145-1200:

```python
# Save activity immediately after generation
activity_data_json = json.dumps(activity)
db.log_activity(
    language,
    'translation',
    0.0,  # Score is 0 until completed
    activity_data_json
)
print(f"✓ Translation activity saved immediately after generation for {language}")
```

Also added:
- Error checking for activity generation failures
- Word extraction from sentences for dictionary population
- words_used data in API response

### Impact
- ✅ Translation activities now appear in history immediately after generation
- ✅ Can reopen activities from history
- ✅ Dictionary populates with words from activity
- ✅ Consistent behavior with other activity types

---

## ✅ Issue 2: Language Names Not in Native Script

### Problem
Despite previous transliteration fixes, language names still displayed in English (e.g., "Hindi" instead of "हिंदी").

### Root Cause
The backend was generating `language_display` fields as English names. The frontend was fetching transliterations (Latin script), but not native script renderings.

### Solution
Added native language name mapping in `backend/api_client.py` lines ~2618-2640:

```python
LANGUAGE_NATIVE_NAMES = {
    'hindi': 'हिंदी',
    'telugu': 'తెలుగు',
    'kannada': 'ಕನ್ನಡ',
    'tamil': 'தமிழ்',
    'urdu': 'اردو',
    'bengali': 'বাংলা',
    'marathi': 'मराठी',
    'gujarati': 'ગુજરાતી',
    'malayalam': 'മലയാളം',
    'punjabi': 'ਪੰਜਾਬੀ',
    'english': 'English',
    'spanish': 'Español',
    'french': 'Français',
    'german': 'Deutsch',
    'italian': 'Italiano',
    'portuguese': 'Português',
    'russian': 'Русский',
    'japanese': '日本語',
    'korean': '한국어',
    'chinese': '中文',
    'arabic': 'العربية',
}
```

Post-processing logic (lines ~2697-2705):
```python
# Post-process sentences to ensure language_display is in native script
if result.get('sentences'):
    for sentence in result['sentences']:
        lang_code = sentence.get('language', '').lower()
        if lang_code in LANGUAGE_NATIVE_NAMES:
            sentence['language_display'] = LANGUAGE_NATIVE_NAMES[lang_code]
            print(f"Set language_display for {lang_code} to {LANGUAGE_NATIVE_NAMES[lang_code]}")
```

### Impact
- ✅ Language names now display in their native scripts
- ✅ Hindi shows as "हिंदी" not "Hindi"
- ✅ Telugu shows as "తెలుగు" not "Telugu"
- ✅ Works for 21 supported languages
- ✅ Transliterations (Latin script) still show below when toggle is on
- ✅ Consistent across language badge, sentence overview, and all UI

---

## 🚧 Issue 3: Audio Recording Option (TODO)

### Problem
Users can only type translations. Need ability to record audio for each sentence.

### Status
**Implementation guide provided** in `TRANSLATION_AUDIO_RECORDING_IMPLEMENTATION.md`

### Scope
- Toggle between text input and audio recording per sentence
- Record separate audio clips for each sentence
- Send audio to Gemini 2.5 Flash for transcription
- Grade transcribed translations
- Display audio playback in submission cards

### Files Prepared
Frontend changes started:
- ✅ Added imports: `useRecording`, `AudioPlayer`, audio-related UI labels
- ✅ Added state: `inputMode`, `sentenceRecordings`, `recordingStates`
- ✅ Added refs: `recordingRefs`, `audioRefs`

Backend changes needed:
- Update translation grading endpoint to accept audio
- Add audio transcription with Gemini
- Return transcripts in grading response

### Complete Guide
See `TRANSLATION_AUDIO_RECORDING_IMPLEMENTATION.md` for:
- Full function implementations
- UI component code
- Style definitions
- Backend endpoint modifications
- Testing checklist

---

## Files Modified

### 1. backend/main.py
**Lines Modified**: ~1034-1200

**Changes**:
- Added immediate save after translation generation
- Added error checking for activity generation
- Extract words from sentences for dictionary
- Return words_used in API response

**Before**:
```python
activity = api_client.generate_translation_activity(...)
if not activity:
    raise HTTPException(...)
return {"activity": activity, "api_details": {...}}
```

**After**:
```python
activity = api_client.generate_translation_activity(...)
if not activity:
    raise HTTPException(...)

# Check for errors
if activity.get('_error'):
    raise HTTPException(...)

# Save immediately
db.log_activity(language, 'translation', 0.0, json.dumps(activity))

# Extract words
words_used_data = extract_words_from_sentences(...)
activity['_words_used_data'] = words_used_data

return {"activity": activity, "words_used": words_used_data, "api_details": {...}}
```

### 2. backend/api_client.py
**Lines Modified**: ~2606-2720

**Changes**:
- Added LANGUAGE_NATIVE_NAMES dictionary (21 languages)
- Post-process sentences to set native language names
- Added logging for conversions

**Before**:
```python
def generate_translation_activity(...):
    # ... generate activity
    result = parse_json_response(response_text, is_truncated)
    result['id'] = f"translation_{target_language}_{int(time.time())}"
    return result
```

**After**:
```python
def generate_translation_activity(...):
    LANGUAGE_NATIVE_NAMES = {
        'hindi': 'हिंदी',
        'telugu': 'తెలుగు',
        # ... 19 more
    }
    
    # ... generate activity
    result = parse_json_response(response_text, is_truncated)
    
    # Post-process for native names
    if result.get('sentences'):
        for sentence in result['sentences']:
            lang_code = sentence.get('language', '').lower()
            if lang_code in LANGUAGE_NATIVE_NAMES:
                sentence['language_display'] = LANGUAGE_NATIVE_NAMES[lang_code]
    
    result['id'] = f"translation_{target_language}_{int(time.time())}"
    return result
```

### 3. screens/activities/TranslationActivity.js
**Lines Modified**: 1-80 (imports and state setup)

**Changes**:
- Added imports for recording functionality
- Added audio-related state variables
- Prepared for audio recording feature

**New Imports**:
```javascript
import { useRecording } from './shared/hooks/useRecording';
import { AudioPlayer } from './shared/components';
import { 
  getInputMethodLabel,
  getTextInputModeLabel,
  getAudioInputModeLabel,
  getStartRecordingLabel,
  getStopRecordingLabel,
  getProcessingAudioLabel,
  getRecordAgainLabel,
} from '../../constants/ui_labels';
```

**New State**:
```javascript
const [inputMode, setInputMode] = useState('text');
const [sentenceRecordings, setSentenceRecordings] = useState({});
const [recordingStates, setRecordingStates] = useState({});
const recordingRefs = useRef({});
const [audioStates, setAudioStates] = useState({});
const audioRefs = useRef({});
```

---

## Testing Results

### ✅ Issue 1: Activity Save
- [x] Generated translation activity
- [x] Verified saved to database immediately (score=0.0)
- [x] Activity appears in history
- [x] Can reopen from history
- [x] Dictionary populated with extracted words
- [x] No errors in backend logs

### ✅ Issue 2: Native Language Names
- [x] Generated activity with Hindi sentences
- [x] Language name shows "हिंदी" (not "Hindi")
- [x] Transliteration "Hindi" appears below when toggle is on
- [x] Works in language badge
- [x] Works in sentence overview list
- [x] Tested with multiple languages (Hindi, Telugu, Kannada)
- [x] Backend logs show conversions: "Set language_display for hindi to हिंदी"

### 🚧 Issue 3: Audio Recording
Not yet implemented. Complete implementation guide provided in:
`TRANSLATION_AUDIO_RECORDING_IMPLEMENTATION.md`

---

## Visual Impact

### Before:
```
Sentence 1 of 18
━━━━━━━━━━━━━
┌─────────────┐
│   English   │  ← English text
└─────────────┘

Sentence 2 of 18
━━━━━━━━━━━━━
┌─────────────┐
│    Hindi    │  ← English text
└─────────────┘
```

### After:
```
Sentence 1 of 18
━━━━━━━━━━━━━
┌─────────────┐
│   English   │  ← English (native)
│   English   │  ← Transliteration
└─────────────┘

Sentence 2 of 18
━━━━━━━━━━━━━
┌─────────────┐
│   हिंदी     │  ← Native script ✨
│   Hindi     │  ← Transliteration
└─────────────┘
```

---

## API Response Changes

### Before:
```json
{
  "activity": {
    "sentences": [
      {
        "language": "hindi",
        "language_display": "Hindi",  // ← English
        "text": "मैं स्कूल जाता हूं।"
      }
    ]
  }
}
```

### After:
```json
{
  "activity": {
    "sentences": [
      {
        "language": "hindi",
        "language_display": "हिंदी",  // ← Native script ✨
        "text": "मैं स्कूल जाता हूं।"
      }
    ]
  },
  "words_used": [
    {
      "id": 123,
      "word": "school",
      "kannada": "ಶಾಲೆ",
      "transliteration": "śāle",
      "word_class": "noun"
    }
  ]
}
```

---

## Backend Logs

### Activity Save:
```
Generating translation activity for kannada (level: A2)
Other languages: {'hindi': 'A1', 'telugu': 'A1'}
Sentence distribution: {'hindi': 12, 'telugu': 6}
✓ Translation activity saved immediately after generation for kannada
```

### Language Name Conversion:
```
Set language_display for hindi to हिंदी
Set language_display for telugu to తెలుగు
Set language_display for english to English
```

---

## Related Documentation

1. **TRANSLATION_ACTIVITY_REVAMP_JAN30.md** - Initial planning document
2. **TRANSLATION_AUDIO_RECORDING_IMPLEMENTATION.md** - Complete audio feature guide
3. **TRANSLATION_ACTIVITY.md** - Original feature documentation
4. **FLASHCARD_AND_TRANSLATION_FIXES_JAN30.md** - Previous translation fixes

---

## Next Steps

### Immediate (Ready to Use)
✅ Translation activities now save properly
✅ Language names display in native scripts
✅ Frontend prepared for audio recording

### Future (When Needed)
🚧 Implement audio recording functionality following the complete guide in `TRANSLATION_AUDIO_RECORDING_IMPLEMENTATION.md`

---

## Verification Commands

```bash
# Check if activities are being saved
sqlite3 vocabulary.db "SELECT id, language, activity_type, score, datetime(completed_at) 
FROM activity_history 
WHERE activity_type='translation' 
ORDER BY completed_at DESC LIMIT 5;"

# Verify language names in saved activities
sqlite3 vocabulary.db "SELECT json_extract(activity_data, '$.sentences[0].language_display') 
FROM activity_history 
WHERE activity_type='translation' 
ORDER BY completed_at DESC LIMIT 1;"
```

Expected output:
```
हिंदी
```
(Not "Hindi")

---

## Success Criteria

- [x] Translation activities saved immediately after generation
- [x] Activities appear in history with score=0.0
- [x] Can reopen activities from history
- [x] Dictionary populated with words from sentences
- [x] Language names display in native scripts (हिंदी, తెలుగు, ಕನ್ನಡ)
- [x] Transliterations show below when toggle enabled
- [x] No errors in backend or frontend
- [x] Works across all sentence views (badge, overview, chips)
- [x] Frontend prepared for audio recording (imports, state, refs added)

All criteria met! ✅
