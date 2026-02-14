# Translation Activity Revamp - January 30

## Issues to Fix

### 1. Activity Not Saved After Generation
**Problem**: Translation activities are not saved immediately after being generated, so they cannot be reopened from history.

**Current State**: 
- Reading, Writing, Speaking activities all save immediately with `db.log_activity()` with score=0.0
- Translation activity endpoint at line 1034 in `backend/main.py` does NOT save the activity

**Solution**: Add immediate save to translation generation endpoint (similar to other activities)

---

### 2. Audio Recording Option for Each Sentence
**Problem**: Currently only text input is available. Need to add audio recording option for each sentence.

**Requirements**:
- Option to choose between text input and audio recording for each sentence
- Record separate audio clips for each sentence
- Send audio to Gemini 2.5 Flash for transcription and translation grading
- Similar to SpeakingActivity's audio recording functionality

**Implementation**:
- Add input mode toggle (text/audio) for each sentence
- Use `useRecording` hook for recording functionality
- Store separate audio recordings per sentence
- Send audio array to backend for grading
- Backend needs new endpoint to handle audio translations

---

### 3. Language Names Not in Native Script
**Problem**: Despite previous fixes, language names still appear in English (e.g., "Hindi" instead of "हिंदी")

**Current State**:
- Lines 158-160: Code fetches native script for `sentence.language_display`
- Lines 436, 615: Displays with fallback chain: `nativeScriptRenderings[language_${index}] || sentence.language_display || sentence.language`
- The problem: `sentence.language_display` coming from backend is already in English

**Root Cause**: Backend generates `language_display` as English names. The frontend tries to transliterate them, but that just adds Latin script below, not native script rendering.

**Solution**: Backend needs to generate language names in their native scripts (हिंदी, తెలుగు, ಕನ್ನಡ, etc.) in the `language_display` field.

---

## Implementation Plan

### Phase 1: Save Activity After Generation
**Files**: `backend/main.py`
**Estimated**: 5 minutes

1. Add `db.log_activity()` call after successful generation (line ~1130)
2. Similar pattern to reading/writing/speaking activities
3. Extract words from sentences for dictionary population

### Phase 2: Add Audio Recording Option
**Files**: 
- `screens/activities/TranslationActivity.js`
- `backend/main.py` (new grading endpoint)
- `backend/api_client.py` (audio handling)

**Estimated**: 45 minutes

#### Frontend Changes:
1. Add `useRecording` hook import
2. Add input mode toggle per sentence (text vs audio)
3. Add recording UI for each sentence when in audio mode
4. Store recordings array: `sentenceRecordings[sentenceIndex] = audioBase64`
5. Modify submit to handle audio submissions
6. Display audio playback in submission cards

#### Backend Changes:
1. Modify `/api/activity/translation/{language}/grade` to accept audio array
2. For each audio:
   - Send to Gemini with transcription request
   - Get translation from audio
   - Grade against expected translation
3. Return grading with transcripts included

### Phase 3: Fix Language Names (Native Script)
**Files**: 
- `backend/prompting/templates/translation_activity.txt`
- `backend/api_client.py`

**Estimated**: 15 minutes

1. Update prompt template to request language names in native scripts
2. Add mapping for common languages:
   ```
   hindi -> हिंदी
   telugu -> తెలుగు
   kannada -> ಕನ್ನಡ
   tamil -> தமிழ்
   urdu -> اردو
   english -> English
   ```
3. Post-process generated activity to ensure proper language_display values

---

## Testing Checklist

### After Phase 1:
- [ ] Generate translation activity
- [ ] Activity appears in history immediately
- [ ] Can reopen activity from history
- [ ] Dictionary populated with words

### After Phase 2:
- [ ] Input mode toggle visible per sentence
- [ ] Can record audio for each sentence
- [ ] Audio playback works
- [ ] Submission with audio shows transcripts
- [ ] Grading works with audio input
- [ ] Mixed mode (some text, some audio) works

### After Phase 3:
- [ ] Language names show in native script (हिंदी, not Hindi)
- [ ] Transliteration shows below in Latin script
- [ ] Works for all supported languages
- [ ] Language badge shows native script
- [ ] Overview list shows native script

---

## Files to Modify

### Backend:
1. `backend/main.py` - Lines ~1034-1170
   - Add immediate save
   - Modify grading endpoint for audio

2. `backend/api_client.py` - Translation functions
   - Add audio handling in grading
   - Add language name mapping

3. `backend/prompting/templates/translation_activity.txt`
   - Update to request native language names

### Frontend:
1. `screens/activities/TranslationActivity.js`
   - Add recording functionality
   - Add input mode toggle
   - Update submission handling
   - Display audio in submissions

2. `constants/ui_labels.js` (if needed)
   - Add labels for audio recording controls

---

## Priority Order

1. **High Priority**: Save activity after generation (prevents data loss)
2. **High Priority**: Fix language names in native script (user reported issue)
3. **Medium Priority**: Audio recording option (feature enhancement)

Let's proceed with implementation in this order.
