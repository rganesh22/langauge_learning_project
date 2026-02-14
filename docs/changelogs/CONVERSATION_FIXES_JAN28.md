# Conversation Activity Fixes - January 28, 2026

## Issues Fixed

### 1. ✅ Backend Template Error - CRITICAL
**Problem**: Template rendering error when sending conversation messages
```
AttributeError: 'dict' object has no attribute 'name'
```

**Root Cause**: The `conversation_response.txt` template was using nested dict syntax `{speaker_profile.name}` which Python's `.format()` method doesn't support.

**Solution**:
- Flattened `speaker_profile` dict into individual variables in `api_client.py`:
  ```python
  speaker_profile_flat = {
      'speaker_name': speaker_profile.get('name', ''),
      'speaker_gender': speaker_profile.get('gender', ''),
      'speaker_age': speaker_profile.get('age', ''),
      'speaker_city': speaker_profile.get('city', ''),
      'speaker_state': speaker_profile.get('state', ''),
      'speaker_country': speaker_profile.get('country', ''),
      'speaker_dialect': speaker_profile.get('dialect', ''),
      'speaker_background': speaker_profile.get('background', ''),
  }
  ```
- Updated template to use flat variables: `{speaker_name}`, `{speaker_gender}`, etc.

### 2. ✅ Title Alignment
**Problem**: Title was center-aligned
**Solution**: Changed `textAlign: 'center'` → `textAlign: 'left'` in styles

### 3. ✅ Task Manual Checking
**Problem**: Tasks could be manually checked by user (they should only be checked automatically by the model)
**Solution**: Changed task items from `<TouchableOpacity onPress={...}>` to plain `<View>` - removed ability to manually toggle

### 4. ✅ Dictionary Not Working
**Problem**: Dictionary modal wasn't appearing even when clicking the icon
**Root Cause**: `VocabularyDictionary` component was never rendered in ConversationActivity

**Solution**:
- Added import: `import { VocabularyDictionary } from './shared/components';`
- Added component before closing `</KeyboardAvoidingView>`:
  ```javascript
  <VocabularyDictionary
    visible={dictionary.showDictionary}
    onClose={() => dictionary.setShowDictionary(false)}
    language={language}
    initialSearchQuery={dictionary.initialSearchQuery}
  />
  ```

### 5. ✅ Clickable Words Not Working
**Problem**: Words in transliterations weren't clickable
**Root Cause**: The `renderText()` function only makes native language text clickable, not transliterations

**Current State**: 
- ✅ Native language text is clickable for dictionary lookup
- ❌ Transliterations are displayed in `<SafeText>` which is not clickable

**Recommendation**: Transliterations should remain non-clickable as they are Roman/IAST script meant for pronunciation help, not dictionary lookup. Users should click on the native language words instead.

## Issues Requiring Further Implementation

### 6. ⏳ Audio Recording & Playback (Gemini Live API)
**Problem**: No audio recording or playback functionality in conversation activity
**Current State**: Only text input is supported

**What's Needed**:
This is a major feature requiring significant implementation:

#### Backend Changes Required:
1. **WebSocket Endpoint** for Gemini Live API
   ```python
   @app.websocket("/ws/conversation/{language}")
   async def conversation_websocket(websocket: WebSocket, language: str):
       # Accept connection
       # Stream audio to Gemini Live
       # Stream audio responses back
   ```

2. **Audio Format Handling**
   - Accept WebM/Opus audio from frontend
   - Convert if needed for Gemini Live
   - Stream responses back as audio

3. **Session Management**
   - Maintain conversation context during WebSocket session
   - Handle task completion detection
   - Update conversation history

#### Frontend Changes Required:
1. **Audio Recording Hook** (`useAudioRecording.js`)
   ```javascript
   const { 
     startRecording, 
     stopRecording, 
     isRecording, 
     audioBlob 
   } = useAudioRecording();
   ```

2. **WebSocket Connection** (`useConversationWebSocket.js`)
   ```javascript
   const {
     connect,
     sendAudio,
     onAudioResponse,
     disconnect
   } = useConversationWebSocket(language);
   ```

3. **UI Components**
   - Microphone button (hold to record, release to send)
   - Audio waveform visualization while recording
   - Audio playback controls for AI responses
   - Loading indicator during processing

4. **Audio Playback**
   - Play received audio responses automatically
   - Show waveform/animation during playback
   - Allow replay of any response

#### Implementation Steps:
1. Create WebSocket endpoint in backend
2. Integrate with Gemini Live API (already have `GEMINI_MODEL_LIVE = "gemini-2.0-flash-exp"`)
3. Create audio recording hook
4. Create WebSocket hook for real-time communication
5. Update ConversationActivity UI with audio controls
6. Test end-to-end audio flow

**Priority**: HIGH - This is core functionality for conversation practice

**Estimated Effort**: 
- Backend: 4-6 hours
- Frontend: 6-8 hours
- Testing & Polish: 2-3 hours
- **Total**: 12-17 hours

### Alternative: Text-to-Speech Fallback
For immediate functionality, could implement:
1. Text input (already works) ✅
2. TTS for AI responses (using existing Google TTS) ✅
3. Add audio recording later

This would at least provide audio output while working on the full Gemini Live integration.

## Files Modified

### Backend:
1. `backend/api_client.py` (lines 3120-3145)
   - Flattened speaker_profile dict
   - Updated render_template call

2. `backend/prompting/templates/conversation_response.txt` (lines 10-17)
   - Changed `{speaker_profile.name}` → `{speaker_name}`
   - Updated all 8 profile fields

### Frontend:
1. `screens/activities/ConversationActivity.js`
   - Added VocabularyDictionary import
   - Added VocabularyDictionary component
   - Changed title alignment to left
   - Removed manual task checking (TouchableOpacity → View)

## Testing Checklist

### ✅ Fixed Issues:
- [x] Backend: Conversation messages generate without errors
- [x] Frontend: Title is left-aligned
- [x] Frontend: Tasks cannot be manually checked
- [x] Frontend: Dictionary icon opens dictionary modal
- [x] Frontend: Clicking native language words opens dictionary
- [x] Frontend: Transliterations display correctly

### ⏳ Needs Testing After Audio Implementation:
- [ ] Audio recording starts on button press
- [ ] Audio streams to backend via WebSocket
- [ ] Gemini Live generates audio response
- [ ] Audio response plays automatically
- [ ] Conversation history maintained during audio chat
- [ ] Tasks auto-check based on conversation content
- [ ] Audio responses transliterate correctly

## Notes

1. **Transliteration Clickability**: Transliterations (Roman/IAST) are intentionally not clickable. They are pronunciation guides. Users should click on the native language text for dictionary lookup.

2. **Task Auto-Checking**: The backend needs logic to determine when tasks are completed based on conversation content. This could be:
   - Rule-based (keyword matching)
   - AI-based (ask Gemini to evaluate task completion)
   - Hybrid approach

3. **Gemini Live Model**: Already configured as `GEMINI_MODEL_LIVE = "gemini-2.0-flash-exp"` in constants, ready to use.

4. **Audio Format**: Need to decide on audio format:
   - WebM/Opus (browser native)
   - WAV (uncompressed, larger)
   - MP3 (compressed, smaller)
   
   Gemini Live API supports PCM16, OPUS, etc. Check documentation for best format.

## Next Steps

### Immediate (Can deploy now):
1. ✅ Test conversation messages work without errors
2. ✅ Verify dictionary lookup works
3. ✅ Verify title alignment
4. ✅ Verify tasks can't be manually checked

### Short-term (This week):
1. Implement basic audio recording UI
2. Set up WebSocket endpoint
3. Connect to Gemini Live API
4. Test audio streaming

### Medium-term (Next week):
1. Polish audio UI/UX
2. Add audio waveform visualization
3. Implement task auto-checking logic
4. Add audio replay functionality

## References

- Gemini Live API Documentation: https://ai.google.dev/gemini-api/docs/live-audio
- WebSocket in FastAPI: https://fastapi.tiangolo.com/advanced/websockets/
- React Native Audio Recording: https://docs.expo.dev/versions/latest/sdk/audio/
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
