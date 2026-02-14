# Speaking Activity: Direct Audio Submission Update

## Overview
Complete overhaul of the speaking activity to use direct audio input with Gemini 2.0 Flash, eliminating the speech-to-text step and enabling 5-minute recordings with audio playback controls.

## Major Changes

### 1. Backend Changes

#### `backend/main.py`
- **Updated `SpeakingGradingRequest` model**:
  - Changed from `user_transcript: str` to `audio_base64: str`
  - Added `audio_format: Optional[str] = 'webm'`
  - Now accepts audio data directly instead of transcript

- **Updated `grade_speaking_activity()` endpoint**:
  - Decodes base64 audio
  - Calls new `grade_speaking_activity_with_audio()` function
  - Returns `user_transcript` field (transcribed by Gemini)

#### `backend/api_client.py`
- **New function: `grade_speaking_activity_with_audio()`**:
  - Saves audio to temporary file
  - Uploads to Gemini using `genai.upload_file()`
  - Uses **Gemini 2.0 Flash Experimental** (supports multimodal audio+text)
  - Waits for file processing (max 60s)
  - Sends audio + prompt together to model
  - Cleans up temporary files after processing
  - Returns grading with transcript from Gemini

#### `backend/prompting/templates/speaking_grading.txt`
- Added instruction for audio input handling
- Added `user_transcript` field to JSON response format
- Gemini now transcribes and grades audio in one step

### 2. Frontend Changes

#### `screens/activities/shared/hooks/useRecording.js`
- **Changed recording duration**: 60s → **5 minutes (300,000ms)**
- **Added audio playback state**:
  - `sound`, `isPlaying`, `playbackPosition`, `playbackDuration`
- **New playback functions**:
  - `loadAudio(audioUri)` - Load audio file
  - `togglePlayback()` - Play/pause
  - `seekAudio(positionMs)` - Seek to position
  - `replayAudio()` - Restart from beginning
  - `unloadAudio()` - Clean up
- Uses expo-av Audio.Sound for playback with status updates

#### `screens/activities/shared/hooks/useGrading.js`
- **Updated `submitSpeaking()` signature**: 
  - From: `(activity, transcript, audioUri)`
  - To: `(activity, audioUri, audioBase64)`
- **New request structure**:
  - Sends `audio_base64` instead of `user_transcript`
  - Includes `audio_format: 'webm'`
- **Stores audio with submissions**:
  - `audio_base64` field preserved for playback
  - `transcript` comes from Gemini's response
- Logs audio data as '[AUDIO DATA]' in debug (avoids massive logs)

#### `screens/activities/SpeakingActivity.js`
- **Added imports**: `Platform`, `* as FileSystem`, `AudioPlayer`
- **Updated timer display**: Shows countdown from 5 minutes
  - `"Xs remaining (5:00 max)"`
- **New `handleSubmit()` implementation**:
  - Converts audio to base64 (Web and Native)
  - Calls `grading.submitSpeaking()` with audio data
  - No more speech-to-text step
- **Added AudioPlayer component**:
  - Shows after recording stops
  - Play/pause/seek controls
  - Integrates with `recording.togglePlayback()`, etc.
- **Updated submission cards**:
  - Shows AudioPlayer for each submission (if `audio_base64` exists)
  - Displays transcript from Gemini below audio
  - Full playback controls per submission

#### New Styles
```javascript
audioPlayerBox: {
  marginTop: 16,
  padding: 16,
  backgroundColor: '#F8F8F8',
  borderRadius: 12,
}
```

### 3. Flow Comparison

#### OLD FLOW:
1. User records audio → 2. Stop recording → 3. Speech-to-text API → 4. Show transcript → 5. Submit transcript to backend → 6. Gemini grades text → 7. Show results

#### NEW FLOW:
1. User records audio (up to 5 min) → 2. Stop recording → 3. Audio player appears → 4. User submits audio → 5. Backend uploads to Gemini → 6. **Gemini transcribes + grades audio** → 7. Show transcript + results

## Key Features

### ✅ Implemented:
1. **5-minute recordings** with countdown timer
2. **Direct audio grading** via Gemini 2.0 Flash
3. **Audio playback controls** (play/pause/seek/replay)
4. **Automatic transcription** by Gemini
5. **AudioPlayer in main UI** after recording
6. **AudioPlayer in submission cards** (with audio_base64)
7. **Database persistence** with audio data
8. **Auto-stop at 5 minutes** with notification

### ⚠️ Known Limitations:
1. **Submission audio playback** shows placeholder alert (needs per-submission audio state management)
2. **Text input mode** disabled (shows alert to use audio)
3. **Audio format** hardcoded to 'webm' (could auto-detect)

## Testing Checklist

- [ ] Record audio up to 5 minutes
- [ ] Verify countdown timer displays correctly
- [ ] Test auto-stop at 5 minutes
- [ ] Verify audio playback after recording
- [ ] Submit audio and check backend logs for upload
- [ ] Verify Gemini returns transcript
- [ ] Check grading results display
- [ ] Verify submission cards show audio player
- [ ] Test database persistence (reopen activity)
- [ ] Test with different languages (Kannada, Telugu, etc.)

## API Costs
- **Gemini 2.0 Flash**: $0.15 per 1M input tokens, $0.60 per 1M output tokens
- Audio files are uploaded and processed by Gemini
- Much more expensive than text-only, but provides accurate grading of actual pronunciation

## Future Enhancements
1. Implement per-submission audio playback (manage multiple Sound instances)
2. Add audio waveform visualization
3. Support multiple audio formats auto-detection
4. Add re-record button without clearing previous attempt
5. Show transcription progress indicator
6. Add pitch/tone analysis from Gemini feedback
