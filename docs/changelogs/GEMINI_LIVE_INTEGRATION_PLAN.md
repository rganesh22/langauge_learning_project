# Gemini 2.5 Live WebSocket Integration Plan

## Architecture Overview

### Flow Comparison

**Current Flow (STT/TTS)**:
```
User Audio → STT API → Text → Gemini Text API → Text → TTS API → Audio
```

**New Flow (Gemini Live)**:
```
User Audio → WebSocket → Gemini Live API → WebSocket → Audio
```

## Components to Implement

### 1. Backend WebSocket Server
**File**: `backend/websocket_conversation.py`
- WebSocket endpoint for real-time audio streaming
- Manages Gemini Live API connection
- Handles audio chunks (PCM format)
- Manages conversation state and context

### 2. Gemini Live API Client
**File**: `backend/gemini_live_client.py`
- Connects to Gemini 2.5 Live via gRPC/WebSocket
- Sends audio chunks
- Receives audio responses
- Maintains conversation context

### 3. Frontend WebSocket Client
**File**: `screens/activities/shared/hooks/useGeminiLive.js`
- Connects to backend WebSocket
- Streams audio from microphone
- Receives and plays audio responses
- Manages connection lifecycle

### 4. Audio Processing Utilities
**File**: `screens/activities/shared/utils/audioProcessing.js`
- Convert audio to PCM format
- Handle audio chunking
- Manage audio playback queue

## Implementation Steps

### Phase 1: Backend WebSocket Infrastructure
1. Install dependencies: `websockets`, `google-genai` (for Live API)
2. Create WebSocket endpoint in FastAPI
3. Implement audio chunk handling
4. Add conversation context management

### Phase 2: Gemini Live Integration
1. Set up Gemini 2.5 Live API credentials
2. Implement bidirectional streaming
3. Handle system instructions (conversation context)
4. Manage voice selection

### Phase 3: Frontend WebSocket Client
1. Create useGeminiLive hook
2. Implement audio streaming from microphone
3. Add audio playback for responses
4. Handle connection states

### Phase 4: UI Updates
1. Update ConversationActivity to use WebSocket
2. Add real-time indicators (speaking, listening, thinking)
3. Show connection status
4. Handle errors gracefully

### Phase 5: Testing & Optimization
1. Test latency and audio quality
2. Implement reconnection logic
3. Add fallback to STT/TTS if WebSocket fails
4. Optimize audio buffering

## Technical Details

### Audio Format
- **Input**: PCM 16-bit, 16kHz mono
- **Output**: PCM 16-bit, 24kHz mono (Gemini Live default)

### WebSocket Protocol
```json
// Client → Server
{
  "type": "audio_chunk",
  "data": "base64_encoded_pcm",
  "conversation_id": "uuid",
  "is_final": false
}

// Server → Client
{
  "type": "audio_response",
  "data": "base64_encoded_pcm",
  "text": "transcribed_text",
  "is_final": true
}

// Server → Client (status)
{
  "type": "status",
  "status": "listening|thinking|speaking",
  "message": "AI is thinking..."
}
```

### Gemini Live API Configuration
```python
generation_config = {
    "response_modalities": ["AUDIO"],
    "speech_config": {
        "voice_config": {
            "prebuilt_voice_config": {
                "voice_name": "Kore"  # or other voices
            }
        }
    }
}
```

## Dependencies

### Backend
```txt
websockets==12.0
google-genai>=1.0.0  # For Gemini Live
```

### Frontend
```json
{
  "expo-av": "latest",  // Already installed
  "react-native-webrtc": "latest"  // For audio streaming
}
```

## Files to Create/Modify

### New Files
1. `backend/websocket_conversation.py` - WebSocket server
2. `backend/gemini_live_client.py` - Gemini Live API wrapper
3. `screens/activities/shared/hooks/useGeminiLive.js` - WebSocket client hook
4. `screens/activities/shared/utils/audioProcessing.js` - Audio utilities

### Modified Files
1. `backend/main.py` - Add WebSocket route
2. `backend/requirements.txt` - Add new dependencies
3. `screens/activities/ConversationActivity.js` - Use new hook
4. `package.json` - Add audio streaming dependencies

## Timeline Estimate
- **Phase 1**: 2-3 hours (Backend WebSocket)
- **Phase 2**: 2-3 hours (Gemini Live integration)
- **Phase 3**: 3-4 hours (Frontend client)
- **Phase 4**: 2-3 hours (UI updates)
- **Phase 5**: 2-3 hours (Testing)
- **Total**: 11-16 hours

## Let's Begin! 🚀
