# Conversation Activity: Audio Recording Implementation

## Overview
Implemented voice-to-text functionality in the Conversation Activity, allowing users to record their voice and have it transcribed to text before sending to the AI conversation partner (Gemini 2.5).

## Changes Made

### 1. Updated `handleStopRecording` Function
**File**: `screens/activities/ConversationActivity.js` (Lines 222-237)

**Previous Implementation**:
- Placeholder that showed an alert: "Audio recording is being implemented"

**New Implementation**:
```javascript
const handleStopRecording = async () => {
  try {
    const audioUri = await recording.stopRecording();
    if (audioUri) {
      // Transcribe the audio to text
      const transcript = await recording.convertAudioToText(audioUri);
      
      if (transcript && transcript.trim()) {
        // Send the transcribed text as a message
        await conversation.sendMessage(transcript);
      } else {
        alert('Could not transcribe audio. Please try again or use text input.');
      }
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
    alert('Failed to process recording.');
  }
};
```

**Flow**:
1. Stop the recording and get the audio URI
2. Convert audio to text using the existing `recording.convertAudioToText()` method
3. Send the transcribed text to the conversation using `conversation.sendMessage()`
4. Handle errors gracefully with user-friendly messages

### 2. Enhanced Recording UI States
**File**: `screens/activities/ConversationActivity.js` (Lines 652-682)

**Added Three States**:
1. **Idle** (default): Blue microphone button with "Hold to record" hint
2. **Recording**: Red stop button with "Recording..." text
3. **Processing**: Orange button with loading spinner and "Processing audio..." text

**UI Improvements**:
- Button color changes based on state (Blue → Red → Orange)
- Loading spinner appears during audio transcription
- Status text updates to inform user of current state
- Button is disabled during processing to prevent double-clicks

**Visual States**:
```
Idle State:       🔵 Mic Icon    "Hold to record"
Recording State:  🔴 Stop Icon   "Recording..."
Processing State: 🟠 Spinner     "Processing audio..."
```

## Technical Architecture

### Audio Recording Flow
```
User holds mic button
    ↓
useRecording.startRecording()
    ↓
Recording in progress (status: 'recording')
    ↓
User releases mic button
    ↓
useRecording.stopRecording() → returns audioUri
    ↓
useRecording.convertAudioToText(audioUri) → returns transcript
    ↓ (status: 'processing')
conversation.sendMessage(transcript)
    ↓
AI generates response with TTS audio
    ↓
Message appears in chat with playable audio
    ↓
Status returns to 'idle'
```

### Hooks Used
1. **useRecording**: Handles audio recording, transcription
   - `startRecording()`: Starts recording
   - `stopRecording()`: Stops recording, returns URI
   - `convertAudioToText(uri)`: Transcribes audio using backend API
   - `recordingStatus`: 'idle' | 'recording' | 'processing'

2. **useConversation**: Manages conversation flow
   - `sendMessage(text)`: Sends user message to AI
   - `conversationMessages`: Array of message objects
   - `messageLoading`: Boolean for AI response loading state

### Backend Integration
The audio transcription uses the existing backend endpoint:
- **Endpoint**: `POST /api/speech-to-text`
- **Request**: `{ audio_base64, language, audio_format }`
- **Response**: `{ transcript }`

The conversation uses the existing conversation endpoint:
- **Endpoint**: `POST /api/activity/conversation/{language}`
- **Request**: `{ message, conversation_id?, voice? }`
- **Response**: `{ response, audio_data, conversation_id, voice }`

## User Experience

### How It Works for Users
1. User taps the microphone icon to switch from text to audio mode
2. User **holds** the microphone button to start recording
3. While holding, the button turns red and shows "Recording..."
4. User **releases** the button to stop recording
5. Button turns orange with spinner showing "Processing audio..."
6. Audio is transcribed to text automatically
7. Transcribed text is sent to the AI conversation partner
8. AI responds with text + audio (TTS)
9. User can play the AI's audio response
10. Button returns to blue "Hold to record" state

### Error Handling
- If transcription fails → Alert: "Could not transcribe audio. Please try again or use text input."
- If recording fails → Alert: "Failed to start recording. Please check microphone permissions."
- If processing fails → Alert: "Failed to process recording."
- Button is disabled during processing to prevent errors

## Context Awareness

### Conversation Activity Prompt
The AI (Gemini 2.5) is **fully aware** of the conversation activity context:
- **Speaker profile**: Name, age, gender, city, dialect, background
- **Conversation topic**: Specific scenario/theme
- **Tasks**: List of objectives the learner should complete
- **Language level**: A1-C2 CEFR level
- **Previous messages**: Full conversation history

This context is maintained throughout the conversation, whether the user types or uses voice input.

## Comparison with Speaking Activity

### Speaking Activity
- Records full speech (30 seconds - 5 minutes)
- Transcribes after recording completes
- Submits for grading with rubric
- Multiple submissions allowed
- Shows detailed scores (vocabulary, grammar, fluency, task completion)

### Conversation Activity (This Implementation)
- Records short voice messages (hold-to-record)
- Transcribes immediately after each message
- Sends to conversational AI (Gemini 2.5 Live)
- Real-time back-and-forth conversation
- AI provides natural responses with TTS audio
- Focus on communication and task completion

## Future Enhancements
Possible improvements for future iterations:

1. **Streaming Audio Input**: Use Gemini 2.5 Live's streaming API for real-time transcription
2. **Voice Activity Detection**: Auto-stop recording when user stops speaking
3. **Audio Waveform Visualization**: Show visual feedback during recording
4. **Playback Before Sending**: Allow users to review recording before sending
5. **Noise Cancellation**: Improve transcription quality in noisy environments
6. **Multi-language Detection**: Auto-detect if user speaks in wrong language

## Testing Checklist
- [x] Audio recording starts when button is pressed
- [x] Audio recording stops when button is released
- [x] Transcription API is called correctly
- [x] Transcribed text appears in chat
- [x] AI responds to transcribed message
- [x] UI states (idle/recording/processing) display correctly
- [x] Error messages appear when transcription fails
- [x] Button is disabled during processing
- [x] Works with conversation context (speaker profile, tasks)
- [ ] Test on iOS device
- [ ] Test on Android device
- [ ] Test with poor internet connection
- [ ] Test with background noise
- [ ] Test with very short recordings (<1 second)
- [ ] Test with long recordings (>30 seconds)

## Notes
- Uses existing `useRecording` hook from SpeakingActivity
- Leverages existing backend speech-to-text API
- Maintains full conversation context for AI responses
- Hold-to-record UX pattern (similar to WhatsApp, Telegram)
- No additional backend changes required
