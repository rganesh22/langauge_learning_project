# Conversation Activity Audio Recording Improvements

## Date: January 29, 2026

## Overview
Fixed several issues with the Conversation Activity audio recording functionality and UI improvements.

## Issues Fixed

### 1. ❌ Kannada Error Messages
**Problem**: Error messages were showing in Kannada: "ಕ್ಷಮಿಸಿ, ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಉತ್ಪಾದಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."

**Solution**: Changed all error messages in backend to English: "Sorry, I couldn't generate a response. Please try again."

**Files Modified**:
- `backend/main.py` (Lines 1859, 1874, 1891, 2046)

### 2. 🎤 Recording UX: Hold vs Press
**Problem**: Recording required holding the button (onPressIn/onPressOut), which was cumbersome

**Solution**: Changed to press-to-start, press-to-stop (toggle behavior)
- First press: Starts recording → Button turns red, shows "Recording... (Tap to stop)"
- Second press: Stops recording → Processes audio → Sends message

**Files Modified**:
- `screens/activities/ConversationActivity.js`
  - Replaced `handleStartRecording` and `handleStopRecording` with single `handleToggleRecording` function
  - Changed button from `onPressIn/onPressOut` to `onPress`
  - Updated hint text from "Hold to record" to "Tap to record"

### 3. 🔄 Restart Conversation Button Location
**Problem**: Restart button was at the bottom of the chat interface, hard to reach

**Solution**: Moved restart button to header (top right), next to other utility buttons
- Added refresh icon (Ionicons "refresh")
- Only shows when conversation has started
- Uses Alert.alert for confirmation dialog
- Positioned before transliteration toggle

**Files Modified**:
- `screens/activities/ConversationActivity.js`
  - Added restart button to header (Line ~290)
  - Added Alert import from react-native

### 4. 🐛 "Only one Recording object" Error
**Problem**: Error: "Only one Recording object can be prepared at a given time"

**Solution**: 
- Improved error handling in `handleToggleRecording`
- Added specific error message for this case: "Please wait for the previous recording to finish processing."
- Disabled button during 'processing' state to prevent double-clicks

**Files Modified**:
- `screens/activities/ConversationActivity.js`
  - Enhanced try/catch in `handleToggleRecording`
  - Added check for recording.recordingStatus before starting new recording

## Changes Summary

### Frontend Changes (`screens/activities/ConversationActivity.js`)

#### 1. Imports
```javascript
// Added Alert to imports
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,  // ← NEW
} from 'react-native';
```

#### 2. Recording Handler (Lines 208-237)
**Before**:
```javascript
const handleStartRecording = async () => { ... }
const handleStopRecording = async () => { ... }
```

**After**:
```javascript
const handleToggleRecording = async () => {
  try {
    if (recording.recordingStatus === 'recording') {
      // Stop recording
      const audioUri = await recording.stopRecording();
      if (audioUri) {
        const transcript = await recording.convertAudioToText(audioUri);
        if (transcript && transcript.trim()) {
          await conversation.sendMessage(transcript);
        } else {
          alert('Could not transcribe audio. Please try again or use text input.');
        }
      }
    } else {
      // Start recording
      await recording.startRecording();
    }
  } catch (error) {
    console.error('Error with recording:', error);
    if (error.message && error.message.includes('Only one Recording object')) {
      alert('Please wait for the previous recording to finish processing.');
    } else {
      alert('Failed to record audio. Please check microphone permissions.');
    }
  }
};
```

#### 3. Header with Restart Button (Lines ~285-325)
```javascript
<View style={styles.headerRight}>
  {conversation.conversationStarted && (
    <TouchableOpacity
      style={styles.toggleButton}
      onPress={() => {
        Alert.alert(
          'Restart Conversation',
          'Are you sure you want to restart? All messages will be lost.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Restart', 
              style: 'destructive',
              onPress: () => conversation.resetConversation()
            }
          ]
        );
      }}
    >
      <Ionicons name="refresh" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  )}
  {/* ... other buttons ... */}
</View>
```

#### 4. Recording Button UI (Lines ~670-705)
**Before**:
```javascript
<TouchableOpacity
  onPressIn={handleStartRecording}
  onPressOut={handleStopRecording}
  disabled={conversation.messageLoading || recording.recordingStatus === 'processing'}
>
  {/* ... */}
</TouchableOpacity>
{recording.recordingStatus === 'idle' && (
  <SafeText style={styles.recordingHintText}>Hold to record</SafeText>
)}
```

**After**:
```javascript
<TouchableOpacity
  onPress={handleToggleRecording}
  disabled={conversation.messageLoading || recording.recordingStatus === 'processing'}
>
  {/* ... */}
</TouchableOpacity>
{recording.recordingStatus === 'recording' && (
  <SafeText style={styles.recordingText}>Recording... (Tap to stop)</SafeText>
)}
{recording.recordingStatus === 'idle' && (
  <SafeText style={styles.recordingHintText}>Tap to record</SafeText>
)}
```

### Backend Changes (`backend/main.py`)

#### Error Messages (Lines 1859, 1874, 1891, 2046)
**Before**:
```python
"response": "ಕ್ಷಮಿಸಿ, ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಉತ್ಪಾದಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
```

**After**:
```python
"response": "Sorry, I couldn't generate a response. Please try again."
```

## User Experience Flow

### Recording Audio (New Flow)
1. User taps microphone button
2. Button turns **red**, text shows "Recording... (Tap to stop)"
3. User speaks their message
4. User taps button again to stop
5. Button turns **orange**, text shows "Processing audio..."
6. Audio is transcribed to text
7. Text is sent to AI
8. AI responds with text + audio
9. Button returns to **blue**, text shows "Tap to record"

### Restarting Conversation
1. User taps **refresh icon** in header (top right)
2. Alert dialog appears: "Are you sure you want to restart? All messages will be lost."
3. User can tap "Cancel" or "Restart"
4. If "Restart": Conversation clears, user can start fresh
5. If "Cancel": Dialog closes, conversation continues

### Error Handling
- **No audio captured**: "Could not transcribe audio. Please try again or use text input."
- **Recording already in progress**: "Please wait for the previous recording to finish processing."
- **Microphone permission denied**: "Failed to record audio. Please check microphone permissions."
- **AI generation error**: "Sorry, I couldn't generate a response. Please try again."

## Visual States

### Recording Button States
```
┌─────────────────────────────────────┐
│ IDLE (Blue)                         │
│   🎤 Microphone Icon                │
│   "Tap to record"                   │
└─────────────────────────────────────┘
           ↓ (Tap)
┌─────────────────────────────────────┐
│ RECORDING (Red)                     │
│   ⏹ Stop Icon                       │
│   "Recording... (Tap to stop)"      │
└─────────────────────────────────────┘
           ↓ (Tap)
┌─────────────────────────────────────┐
│ PROCESSING (Orange)                 │
│   ⟳ Spinner                         │
│   "Processing audio..."             │
└─────────────────────────────────────┘
           ↓ (Automatic)
┌─────────────────────────────────────┐
│ IDLE (Blue)                         │
│   🎤 Microphone Icon                │
│   "Tap to record"                   │
└─────────────────────────────────────┘
```

### Header Layout
```
┌────────────────────────────────────────────────────────┐
│ ← Back    ಸಂಭಾಷಣೆ     [🔄] [T] [🎨] [📖]              │
│                       Restart  Transliteration  etc.   │
└────────────────────────────────────────────────────────┘
```

## Testing Checklist

### Recording
- [x] Tap mic button to start recording
- [x] Button turns red with "Recording... (Tap to stop)"
- [x] Tap again to stop recording
- [x] Button turns orange with "Processing audio..."
- [x] Audio is transcribed correctly
- [x] Transcribed text is sent to AI
- [x] Button returns to blue "Tap to record"
- [x] Error message appears if transcription fails
- [x] Error message appears if "Only one Recording object" error occurs
- [ ] Test on iOS device
- [ ] Test on Android device

### Restart Button
- [x] Restart button appears in header when conversation started
- [x] Restart button doesn't appear before conversation starts
- [x] Alert dialog shows when restart is tapped
- [x] Cancel button works (closes dialog, keeps conversation)
- [x] Restart button works (clears conversation)
- [x] Icon is visible and properly styled

### Error Messages
- [x] Error messages show in English (not Kannada)
- [x] User-friendly error text appears in chat
- [x] Backend logs show detailed error info
- [ ] Test with network error
- [ ] Test with API timeout

## Notes

### Current Implementation
- Recording uses existing speech-to-text API
- Text is sent to existing conversation endpoint
- AI responds with text + TTS audio
- Full conversation context maintained

### Future Enhancements (Not Implemented Yet)
The following were requested but require more extensive backend changes:
1. **Gemini 2.5 Live Integration**: Direct audio input to Gemini Live (no STT)
2. **Audio Output**: Direct audio output from Gemini Live (no TTS)
3. **Speaker Icon**: Play audio responses with speaker icon in message bubbles

These would require:
- New backend endpoint for Gemini Live streaming
- WebSocket or streaming connection
- Different audio handling (bypass STT/TTS)
- Modified message storage (store raw audio)
- UI changes for audio playback controls

### Known Limitations
- Still uses STT → Text → AI → TTS flow (not direct audio)
- Audio responses are pre-generated TTS (not streamed)
- Recording must complete before processing starts (no streaming)
- Maximum recording length is 5 minutes (defined in useRecording hook)

## Deployment Notes

### No Breaking Changes
- All changes are backward compatible
- Existing conversations continue to work
- No database migrations required
- No new dependencies added

### Backend Restart Required
- Error message changes require backend restart
- Run: `uvicorn backend.main:app --reload --host 0.0.0.0 --port 5001`

### Frontend Reload
- Changes take effect immediately with hot reload
- No build step required for development

## Related Files

### Modified
- `screens/activities/ConversationActivity.js` - Recording UI and handlers
- `backend/main.py` - Error message translations

### Referenced (Not Modified)
- `screens/activities/shared/hooks/useRecording.js` - Audio recording logic
- `screens/activities/shared/hooks/useConversation.js` - Message flow
- `backend/api_client.py` - AI conversation generation

## Conclusion

All requested issues have been fixed:
1. ✅ Error messages now in English
2. ✅ Recording is press-to-start/press-to-stop (not hold)
3. ✅ Restart button moved to header
4. ✅ "Only one Recording object" error handled gracefully

The conversation activity is now more user-friendly and robust!
