# Gemini Live Integration - File Structure

## 📁 New Files Created

```
backend/
├── gemini_live_client.py          ← NEW: Gemini 2.5 Live API wrapper (377 lines)
└── websocket_conversation.py      ← NEW: WebSocket server (411 lines)

screens/activities/shared/hooks/
└── useGeminiLive.js                ← NEW: WebSocket client hook (434 lines)

Documentation/
├── GEMINI_LIVE_INTEGRATION_PLAN.md         ← Architecture & design
├── GEMINI_LIVE_NEXT_STEPS.md               ← Decision document (Option A vs B)
├── GEMINI_LIVE_IMPLEMENTATION_COMPLETE.md  ← Complete implementation summary
└── GEMINI_LIVE_QUICK_START.md              ← Quick start guide
```

## 📝 Modified Files

```
backend/
├── main.py                        ← Added WebSocket endpoint (lines 5, 17, 206-215)
├── db.py                          ← Added update_conversation_messages() (lines 1929-1977)
└── requirements.txt               ← Added websockets==12.0 (line 10)

screens/activities/
├── ConversationActivity.js        ← Integrated Live Mode UI (~150 lines added)
└── shared/
    └── constants.js               ← (Already had API_BASE_URL, no changes needed)
```

## 🗂️ Complete Backend Structure

```
backend/
├── __init__.py
├── api_client.py                  ← Existing: Google AI API client
├── config.py                      ← Existing: Configuration
├── db.py                          ← MODIFIED: Added DB helper function
├── main.py                        ← MODIFIED: Added WebSocket endpoint
├── requirements.txt               ← MODIFIED: Added websockets==12.0
├── transliteration.py             ← Existing: Transliteration utilities
│
├── gemini_live_client.py          ← NEW: Gemini Live API wrapper
│   ├── GeminiLiveClient class
│   ├── start_session()
│   ├── send_audio()
│   ├── send_text()
│   ├── receive_responses()
│   └── _parse_response()
│
├── websocket_conversation.py      ← NEW: WebSocket server
│   ├── ConversationSession class
│   │   ├── start_gemini_session()
│   │   ├── handle_audio_chunk()
│   │   ├── handle_text_message()
│   │   ├── stream_gemini_responses()
│   │   └── save_conversation()
│   ├── ConnectionManager class
│   └── handle_websocket_conversation()
│
└── prompting/
    ├── __init__.py
    ├── template_renderer.py
    └── templates/
```

## 🗂️ Complete Frontend Structure

```
screens/activities/
├── ConversationActivity.js        ← MODIFIED: Live Mode integration
│   ├── Import: useGeminiLive, Switch
│   ├── State: useLiveMode, geminiLive hook
│   ├── Handlers:
│   │   ├── handleStartConversation()    ← NEW: WebSocket connect
│   │   ├── handleToggleLiveMode()       ← NEW: Mode toggle
│   │   ├── handleSendMessage()          ← MODIFIED: Dual mode support
│   │   └── handleToggleRecording()      ← MODIFIED: Dual mode support
│   ├── Effects:
│   │   ├── Live Mode cleanup            ← NEW
│   │   └── Live Mode error alerts       ← NEW
│   └── UI:
│       ├── Live Mode toggle             ← NEW
│       ├── Connection status badge      ← NEW
│       ├── AI status indicator          ← NEW
│       └── Updated recording button     ← MODIFIED
│
└── shared/
    ├── hooks/
    │   ├── useActivityData.js           ← Existing
    │   ├── useConversation.js           ← Existing
    │   ├── useRecording.js              ← Existing
    │   ├── useGeminiLive.js             ← NEW: Live Mode hook
    │   │   ├── Connection management
    │   │   ├── Real-time audio streaming
    │   │   ├── Audio playback queue
    │   │   └── Status tracking
    │   └── ...
    │
    ├── constants.js                     ← Existing: Has API_BASE_URL
    └── ...
```

## 📊 Line Count Summary

### Backend
```
gemini_live_client.py         377 lines  ← NEW
websocket_conversation.py     411 lines  ← NEW
main.py                       +15 lines  ← MODIFIED
db.py                         +49 lines  ← MODIFIED
requirements.txt              +1 line    ← MODIFIED
────────────────────────────────────────
Total:                        ~853 lines
```

### Frontend
```
useGeminiLive.js              434 lines  ← NEW
ConversationActivity.js       +150 lines ← MODIFIED (approx)
────────────────────────────────────────
Total:                        ~584 lines
```

### Documentation
```
GEMINI_LIVE_INTEGRATION_PLAN.md         ~400 lines  ← NEW
GEMINI_LIVE_NEXT_STEPS.md               ~350 lines  ← NEW
GEMINI_LIVE_IMPLEMENTATION_COMPLETE.md  ~450 lines  ← NEW
GEMINI_LIVE_QUICK_START.md              ~300 lines  ← NEW
────────────────────────────────────────────────────
Total:                                  ~1,500 lines
```

### Grand Total
```
Code:            ~1,437 lines
Documentation:   ~1,500 lines
═══════════════════════════════
Total:           ~2,937 lines
```

## 🔍 Key Functions & Methods

### Backend

**`backend/gemini_live_client.py`**
```python
class GeminiLiveClient:
    async def start_session(language, conversation_context, voice_name)
    async def send_audio(audio_data)
    async def send_text(text)
    async def receive_responses()  # Generator
    def _build_system_instruction()
    def _parse_response(response)
    async def close_session()
```

**`backend/websocket_conversation.py`**
```python
class ConversationSession:
    async def start_gemini_session(config)
    async def handle_audio_chunk(audio_data)
    async def handle_text_message(text)
    async def stream_gemini_responses()
    async def save_conversation()
    async def load_history()
    async def send_message(message)

class ConnectionManager:
    async def connect(websocket, conversation_id)
    def disconnect(conversation_id)
    def get_session(conversation_id)

async def handle_websocket_conversation(websocket)
```

**`backend/db.py`**
```python
def update_conversation_messages(conversation_id: int, messages: list)
```

### Frontend

**`screens/activities/shared/hooks/useGeminiLive.js`**
```javascript
export const useGeminiLive = () => {
  // Methods
  const connect = async (config)
  const disconnect = ()
  const startRecording = async ()
  const stopRecording = async ()
  const startStreamingAudio = ()  // Internal: chunks audio
  const sendText = (text)
  const playNextAudioChunk = async ()
  const cleanup = async ()

  // Returns
  return {
    isConnected,
    connectionStatus,
    error,
    aiStatus,
    isRecording,
    isStreaming,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendText,
  }
}
```

**`screens/activities/ConversationActivity.js`**
```javascript
// New handlers
const handleStartConversation = async ()
const handleToggleLiveMode = (value)

// Modified handlers
const handleSendMessage = async ()      // Now supports both modes
const handleToggleRecording = async ()  // Now supports both modes
```

## 🎨 UI Component Hierarchy

```
ConversationActivity
│
├── Header
│   ├── Back Button
│   ├── Title + Status Badge [LIVE/OFFLINE]  ← NEW
│   └── Utility Buttons (restart, transliterate, etc.)
│
├── ScrollView (Content)
│   ├── Live Mode Toggle                      ← NEW
│   │   ├── Switch
│   │   └── Description text
│   │
│   ├── AI Status Indicator                   ← NEW
│   │   ├── Status icon (mic/spinner/speaker)
│   │   ├── Status text
│   │   └── Streaming dot
│   │
│   ├── Activity Title
│   ├── Introduction
│   ├── Speaker Profile
│   ├── Tasks
│   ├── Start Button
│   └── Messages
│       ├── User Message Bubbles
│       └── AI Message Bubbles
│
└── Bottom Chat Interface
    ├── Text Input
    ├── Send Button
    └── Recording Button + Status              ← MODIFIED
        ├── Record Icon/Spinner
        └── Status Text ("Streaming..." / "Tap to record")
```

## 🔄 Data Flow

### WebSocket Connection Flow
```
User taps "Start Conversation"
    ↓
handleStartConversation()
    ↓
geminiLive.connect({ config })
    ↓
WebSocket connects to ws://host:5001/ws/conversation/live
    ↓
Send: { type: "start_session", config: {...} }
    ↓
Backend: handle_websocket_conversation()
    ↓
Backend: ConnectionManager.connect()
    ↓
Backend: ConversationSession.start_gemini_session()
    ↓
Backend: GeminiLiveClient.start_session()
    ↓
Backend: Send: { type: "setup_complete" }
    ↓
Frontend: onmessage → setAiStatus('listening')
    ↓
UI shows: "LIVE" badge (green) + "🎤 Listening..."
```

### Audio Streaming Flow
```
User taps mic button
    ↓
handleToggleRecording()
    ↓
geminiLive.startRecording()
    ↓
Start expo-av recording
    ↓
startStreamingAudio() (interval: 1.5s)
    ↓
Every 1.5 seconds:
    Stop recording
    Read audio file → base64
    Send: { type: "audio_chunk", data: "..." }
    Delete file
    Start new recording
    ↓
Backend: session.handle_audio_chunk()
    ↓
Backend: gemini_client.send_audio()
    ↓
Gemini Live API processes audio
    ↓
Backend: gemini_client.receive_responses()
    ↓
Backend: Send: { type: "status", status: "thinking" }
Backend: Send: { type: "audio_chunk", data: "..." }
Backend: Send: { type: "response_complete", text: "...", audio: "..." }
    ↓
Frontend: Queue audio chunks
Frontend: playNextAudioChunk()
    ↓
UI shows: "🤔 Thinking..." → "🗣️ Speaking..." → Audio plays
```

## 📦 Dependencies

### Backend (requirements.txt)
```
fastapi>=0.104.1
uvicorn[standard]>=0.24.0
sqlite3 (built-in)
google-genai>=1.59.0        ← Already present
websockets==12.0            ← NEW
python-multipart
pydantic
```

### Frontend (package.json)
```json
{
  "expo": "~50.0.0",
  "expo-av": "^16.0.8",      // Already present
  "react-native": "0.73.2",  // Built-in WebSocket support
  // No new dependencies needed!
}
```

## 🎯 Entry Points

### Backend
```
http://localhost:5001/                    ← Root endpoint
http://localhost:5001/api/health          ← Health check
ws://localhost:5001/ws/conversation/live  ← NEW: WebSocket endpoint
```

### Frontend
```
screens/activities/ConversationActivity.js  ← Main conversation UI
screens/activities/shared/hooks/useGeminiLive.js  ← Live Mode logic
```

## 🔧 Configuration Files

### Backend
```
backend/config.py           ← Database path, API keys
backend/.env                ← Environment variables (if used)
```

### Frontend
```
screens/activities/shared/constants.js  ← API_BASE_URL
```

## 📚 Documentation Files

```
GEMINI_LIVE_INTEGRATION_PLAN.md         ← Architecture & design (400 lines)
GEMINI_LIVE_NEXT_STEPS.md               ← Decision process (350 lines)
GEMINI_LIVE_IMPLEMENTATION_COMPLETE.md  ← Implementation summary (450 lines)
GEMINI_LIVE_QUICK_START.md              ← Quick start guide (300 lines)
```

---

## ✅ Verification Commands

### Check Backend Files Exist
```bash
ls -lh backend/gemini_live_client.py backend/websocket_conversation.py
```

### Check Frontend Files Exist
```bash
ls -lh screens/activities/shared/hooks/useGeminiLive.js
```

### Check Dependencies
```bash
grep "websockets" backend/requirements.txt
grep "expo-av" package.json
```

### Count Lines of Code
```bash
# Backend
wc -l backend/gemini_live_client.py backend/websocket_conversation.py

# Frontend
wc -l screens/activities/shared/hooks/useGeminiLive.js
```

---

**All files created and organized! Ready to test! 🚀**
