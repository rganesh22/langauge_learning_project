# Gemini 2.5 Live Integration - Next Steps

## ✅ Completed (Backend)

1. **Architecture Planning** (`GEMINI_LIVE_INTEGRATION_PLAN.md`)
   - Full WebSocket protocol design
   - Audio format specifications (PCM 16-bit, 16/24kHz)
   - Component architecture

2. **Backend Infrastructure**
   - `backend/gemini_live_client.py` - Gemini Live API wrapper (377 lines)
   - `backend/websocket_conversation.py` - WebSocket server with session management (467 lines)
   - `backend/main.py` - WebSocket endpoint at `/ws/conversation/live`
   - `backend/db.py` - Database helper `update_conversation_messages()`
   - `backend/requirements.txt` - Added `websockets==12.0`

## ✅ Completed (Frontend Hook)

3. **useGeminiLive Hook** (`screens/activities/shared/hooks/useGeminiLive.js`)
   - WebSocket connection management
   - Recording state management
   - Audio queue and playback
   - Status tracking (disconnected/connecting/connected/error)
   - AI status tracking (idle/listening/thinking/speaking)
   - Methods: `connect()`, `disconnect()`, `startRecording()`, `stopRecording()`, `sendAudioFile()`, `sendText()`

## 🔄 Current Limitations

The `useGeminiLive` hook has a **major limitation**: expo-av's `Audio.Recording` doesn't support real-time audio chunk streaming. It only provides access to the complete recording after stopping.

**What this means:**
- ❌ Cannot stream audio while recording (true real-time)
- ✅ Can send complete recording after user stops (batch mode)

**This affects the UX:**
- User records their message → stops recording → audio sent → AI responds
- NOT: User speaks → AI hears in real-time → AI interrupts/responds live

## 🎯 Next Steps (Choose Your Path)

### Option A: Quick MVP (Batch Mode) - 2-4 hours

Use the existing `useGeminiLive` hook with batch recording:

1. **Update ConversationActivity.js**
   - Add toggle switch: "Use Live Mode" (on/off)
   - Import `useGeminiLive` hook
   - When Live Mode ON:
     - Use `geminiLive.connect()` on conversation start
     - Replace recording button to use `geminiLive.startRecording()` / `geminiLive.stopRecording()`
     - Call `geminiLive.sendAudioFile()` after stopping
     - Display AI status indicator
   - When Live Mode OFF:
     - Use existing STT/TTS flow (current implementation)

2. **UI Updates**
   - Add connection status indicator (connected/disconnected badge)
   - Add AI status indicator (listening 🎤 / thinking 🤔 / speaking 🗣️)
   - Show toggle switch at top of chat
   - Update recording button text based on mode

3. **Testing**
   - Test WebSocket connection
   - Test audio recording → sending → playback
   - Test error handling
   - Test conversation saving

**Pros:**
- Works with existing expo-av
- No additional dependencies
- Can implement today
- Allows A/B testing between modes

**Cons:**
- Not true real-time (batch processing)
- User must wait for complete recording
- AI cannot interrupt or respond mid-speech

---

### Option B: True Real-Time Streaming - 8-16 hours

Implement native audio streaming for true real-time experience:

1. **Choose Native Audio Solution**
   - **Option B1**: Use `react-native-audio-waveform` (has streaming support)
   - **Option B2**: Write custom native module (iOS/Android)
   - **Option B3**: Use `react-native-live-audio-stream`

2. **Update useGeminiLive Hook**
   - Replace `Audio.Recording` with streaming solution
   - Implement chunk-based streaming
   - Add audio buffer management
   - Handle backpressure (audio chunks faster than network)

3. **Update Backend**
   - May need to adjust chunk size handling
   - May need buffering on server side

4. **Testing & Optimization**
   - Test audio quality
   - Test latency
   - Test network interruptions
   - Optimize chunk size

**Pros:**
- True real-time experience
- AI can interrupt/respond naturally
- Better conversation flow
- Modern UX

**Cons:**
- Requires native modules
- More complex implementation
- More testing needed
- Potential compatibility issues

---

## 🚀 Recommended: Start with Option A

**Why:**
1. **Validate the concept first** - Make sure backend works, WebSocket is stable
2. **User testing** - See if batch mode is "good enough" for your users
3. **Incremental improvement** - Can upgrade to Option B later
4. **Lower risk** - Keep old mode as fallback

**Implementation Plan (Option A):**

### Step 1: Add Toggle to ConversationActivity.js (30 mins)

```javascript
// Add import
import { useGeminiLive } from './shared/hooks/useGeminiLive';

// Add state
const [useLiveMode, setUseLiveMode] = useState(false);
const geminiLive = useGeminiLive();

// Add toggle UI in header
<View style={styles.modeToggle}>
  <Text style={styles.modeToggleLabel}>Live Mode</Text>
  <Switch
    value={useLiveMode}
    onValueChange={setUseLiveMode}
    disabled={conversation.conversationMessages.length > 0}
  />
</View>
```

### Step 2: Connect on Conversation Start (15 mins)

```javascript
const handleStartConversation = async () => {
  if (useLiveMode) {
    await geminiLive.connect({
      conversation_id: activityData.activity.id,
      language: language,
      voice_name: conversation.selectedVoice || 'Kore',
    });
  }
  // Existing conversation start logic...
};
```

### Step 3: Update Recording Handlers (45 mins)

```javascript
const handleToggleRecording = async () => {
  if (useLiveMode) {
    if (geminiLive.isRecording) {
      await geminiLive.stopRecording();
      await geminiLive.sendAudioFile();
    } else {
      await geminiLive.startRecording();
    }
  } else {
    // Existing recording logic...
  }
};
```

### Step 4: Update UI Indicators (30 mins)

```javascript
// Connection status badge
{useLiveMode && (
  <View style={[styles.statusBadge, { 
    backgroundColor: geminiLive.isConnected ? '#4CAF50' : '#F44336' 
  }]}>
    <Text style={styles.statusBadgeText}>
      {geminiLive.isConnected ? 'Connected' : 'Disconnected'}
    </Text>
  </View>
)}

// AI status indicator
{useLiveMode && geminiLive.isConnected && (
  <View style={styles.aiStatusContainer}>
    <Text style={styles.aiStatusText}>
      {geminiLive.aiStatus === 'listening' && '🎤 Listening...'}
      {geminiLive.aiStatus === 'thinking' && '🤔 Thinking...'}
      {geminiLive.aiStatus === 'speaking' && '🗣️ Speaking...'}
    </Text>
  </View>
)}
```

### Step 5: Handle Cleanup (15 mins)

```javascript
useEffect(() => {
  return () => {
    if (useLiveMode) {
      geminiLive.disconnect();
    }
  };
}, [useLiveMode]);
```

### Step 6: Testing (1-2 hours)

1. Start conversation with Live Mode OFF → test old flow works
2. Start conversation with Live Mode ON → test WebSocket connects
3. Record audio → test audio sends to backend
4. Wait for AI response → test audio plays back
5. Test multiple messages back and forth
6. Test error handling (disconnect during recording)
7. Test conversation saving
8. Test navigation away and back

---

## 📝 Files to Modify (Option A)

1. **screens/activities/ConversationActivity.js**
   - Add import: `useGeminiLive`
   - Add state: `useLiveMode`, `geminiLive` hook
   - Add UI: Mode toggle switch, status badges
   - Update: `handleStartConversation`, `handleToggleRecording`, cleanup
   - Lines to change: ~50-100 lines total

2. **screens/activities/shared/hooks/useGeminiLive.js** (already created)
   - No changes needed for MVP
   - May need to update backend URL (line 31) to your server IP

3. **Backend** (already complete)
   - No changes needed
   - Just need to restart uvicorn to pick up new code

---

## 🐛 Known Issues to Address

1. **Backend URL Hardcoded**
   - `useGeminiLive.js` line 31: `const backendUrl = 'ws://192.168.1.100:5001';`
   - **Fix**: Move to environment variable or config file

2. **Audio Format Compatibility**
   - expo-av produces WAV files, backend expects raw PCM
   - **Fix**: May need audio conversion on client or server

3. **Error Messages**
   - Hook sets error state but UI doesn't display it
   - **Fix**: Add error alert/toast in ConversationActivity

4. **Conversation Saving**
   - Need to ensure messages are saved when using Live Mode
   - **Fix**: Call conversation saving after each exchange

---

## 🎓 What You'll Learn

By implementing Option A, you'll:
- ✅ Validate the entire WebSocket infrastructure
- ✅ Test Gemini 2.5 Live API integration
- ✅ Get user feedback on the experience
- ✅ Identify bottlenecks and issues
- ✅ Decide if Option B is worth the effort

---

## 🚦 Ready to Start?

**Confirm you want Option A (Quick MVP)** and I'll:
1. Update ConversationActivity.js with mode toggle
2. Add all necessary UI components
3. Wire up the useGeminiLive hook
4. Add error handling
5. Test the integration

Or if you prefer **Option B (True Real-Time)**, let me know and I'll research the best native audio streaming solution for React Native + Expo.

**Your decision:** Which path do you want to take?
