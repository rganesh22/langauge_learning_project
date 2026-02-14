# Quick Start Guide: Gemini Live Mode

## 🚀 Getting Started in 5 Minutes

### Step 1: Update Backend URL (30 seconds)

Find your computer's IP address:
```bash
# On macOS/Linux:
ipconfig getifaddr en0

# On Windows:
ipconfig | findstr IPv4
```

Edit `screens/activities/shared/constants.js`:
```javascript
export const API_BASE_URL = 'http://YOUR_IP_HERE:5001';
// Example: 'http://192.168.1.100:5001'
```

### Step 2: Install Backend Dependencies (1 minute)

```bash
cd backend
pip3 install -r requirements.txt
```

Key dependency added:
- `websockets==12.0` ✅

### Step 3: Start Backend (30 seconds)

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 5001
```

Look for:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:5001
```

### Step 4: Start Frontend (1 minute)

```bash
npx expo start
```

Press:
- `a` for Android
- `i` for iOS
- `w` for Web (but WebSocket may not work on web)

### Step 5: Test Live Mode (2 minutes)

1. **Navigate**: Go to Activity → Conversation
2. **Enable Live Mode**: Toggle "🎙️ Real-Time Live Mode" ON
3. **Select Topic**: Choose any conversation topic
4. **Start**: Tap "Start Conversation"
5. **Wait**: Look for green "LIVE" badge in header
6. **Record**: Tap mic button, speak, tap stop
7. **Listen**: AI will respond with audio!

---

## 🎯 Expected Behavior

### Connection Flow
```
User taps "Start Conversation"
    ↓
[Connecting...] (status badge appears)
    ↓
[LIVE] ✅ (green badge)
    ↓
AI Status: "🎤 Listening..."
    ↓
User taps mic
    ↓
"🔴 Streaming... (Tap to stop)"
    ↓
User taps stop
    ↓
AI Status: "🤔 Thinking..."
    ↓
AI Status: "🗣️ Speaking..."
    ↓
[AI audio plays]
    ↓
AI Status: "🎤 Listening..." (ready for next message)
```

### What You'll See

**Header:**
- Title with "LIVE" badge (green when connected)

**Content Area:**
- Live Mode toggle (before starting)
- AI Status indicator (listening/thinking/speaking)
- Streaming dot (red when actively recording)

**Bottom:**
- Recording button with status text
- Text input (also works in Live Mode)

---

## 🐛 Troubleshooting

### Backend Won't Start

**Error:** `ModuleNotFoundError: No module named 'websockets'`
```bash
pip3 install websockets==12.0
```

**Error:** `Port 5001 already in use`
```bash
# Kill existing process
lsof -ti:5001 | xargs kill -9
```

### Frontend Can't Connect

**Symptom:** "OFFLINE" badge stays red

**Check 1:** Backend is running
```bash
curl http://localhost:5001/api/health
# Should return: {"status": "ok"}
```

**Check 2:** IP address is correct
```bash
# Check what IP the backend shows:
# Look for: "Uvicorn running on http://0.0.0.0:5001"
# Use that IP in constants.js
```

**Check 3:** Firewall allows connections
```bash
# On macOS, check System Settings → Network → Firewall
# On Windows, check Windows Defender Firewall
```

**Check 4:** Mobile device on same WiFi network

### Recording Doesn't Start

**Symptom:** Mic button doesn't respond

**Check 1:** Microphone permissions
```
iOS: Settings → YourApp → Microphone → ON
Android: Settings → Apps → YourApp → Permissions → Microphone → Allow
```

**Check 2:** expo-av installed
```bash
expo install expo-av
```

### No Audio Playback

**Symptom:** AI responds but no sound

**Check 1:** Volume is up
**Check 2:** Silent mode is OFF (iOS)
**Check 3:** Check backend logs for errors
```bash
tail -f backend_current.log
```

### WebSocket Disconnects

**Symptom:** "LIVE" → "OFFLINE" randomly

**Possible causes:**
- Network interruption
- Backend crashed (check logs)
- Mobile device went to sleep
- Firewall blocking WebSocket

**Solution:**
- Tap "Restart Conversation" to reconnect
- Check backend logs for errors
- Keep app in foreground during testing

---

## 📊 Debug Mode

### Enable Verbose Logging

**Frontend:** Open browser console (if testing on web) or React Native Debugger

**Backend:** Check logs:
```bash
tail -f backend_current.log | grep -i "websocket\|gemini"
```

### Test WebSocket Directly

```bash
# Install wscat if needed:
npm install -g wscat

# Connect to WebSocket:
wscat -c ws://localhost:5001/ws/conversation/live

# Should see connection open, then send:
{"type":"start_session","config":{"conversation_id":1,"language":"kannada"}}
```

---

## 🎓 Understanding the Logs

### Backend Logs

**Good:**
```
[WebSocket] New connection from XXX
[WebSocket] Session started for conversation 123
[WebSocket] Audio chunk received: 1234 bytes
[WebSocket] Sending audio chunk to frontend
```

**Bad:**
```
[WebSocket] Error: Connection closed unexpectedly
[WebSocket] Error handling audio chunk: ...
ERROR: Failed to connect to Gemini Live API
```

### Frontend Console

**Good:**
```
Connecting to WebSocket: ws://192.168.1.100:5001/ws/conversation/live
WebSocket connected
Session setup complete
AI status: listening
```

**Bad:**
```
WebSocket error: ...
Error connecting to WebSocket: ...
Failed to start recording: ...
```

---

## 🎨 Customization

### Change Chunk Size

In `useGeminiLive.js`, line 259:
```javascript
}, 1500); // Send chunks every 1.5 seconds
```

Reduce for lower latency (but more network overhead):
```javascript
}, 1000); // 1 second chunks
}, 500);  // 0.5 second chunks
```

### Change Voice

In `handleStartConversation()`:
```javascript
voice_name: conversation.selectedVoice || 'Kore',
```

Available voices:
- `'Puck'` - Warm, friendly
- `'Charon'` - Deep, authoritative  
- `'Kore'` - Neutral, clear
- `'Fenrir'` - Energetic
- `'Aoede'` - Soft, melodic

### Disable Classic Mode

In `ConversationActivity.js`, remove the toggle:
```javascript
const [useLiveMode, setUseLiveMode] = useState(true); // Always ON
```

---

## ✅ Success Checklist

- [ ] Backend starts without errors
- [ ] Frontend connects to backend (test with REST API first)
- [ ] Mobile device on same WiFi as backend
- [ ] IP address correct in constants.js
- [ ] Can start conversation in Classic Mode (old way works)
- [ ] Can toggle Live Mode switch
- [ ] "LIVE" badge appears when connected
- [ ] Can record audio (mic permissions granted)
- [ ] Audio streams to backend (check logs)
- [ ] AI responds (thinking... → speaking...)
- [ ] Audio plays back
- [ ] Can send multiple messages
- [ ] Conversation saves to history

---

## 🆘 Still Having Issues?

### Check System Requirements

- Node.js 16+
- Python 3.9+
- Expo SDK 50
- iOS 13+ or Android 8+
- Google Gemini API key configured

### Verify Dependencies

```bash
# Backend:
pip3 list | grep -i "websockets\|fastapi\|google-genai"

# Should show:
# websockets     12.0
# fastapi        0.x.x
# google-genai   1.59.0
```

```bash
# Frontend:
cat package.json | grep -i "expo-av"

# Should show:
# "expo-av": "^16.0.8"
```

### Test Components Individually

1. **Backend REST API:**
   ```bash
   curl http://localhost:5001/api/health
   ```

2. **Backend WebSocket:**
   ```bash
   wscat -c ws://localhost:5001/ws/conversation/live
   ```

3. **Frontend Recording:**
   - Test in Classic Mode first
   - If Classic Mode works, Live Mode should work

4. **Network:**
   ```bash
   # From mobile device browser:
   http://YOUR_IP:5001/api/health
   # Should return: {"status": "ok"}
   ```

---

## 📞 Support

If everything fails:

1. Check `GEMINI_LIVE_IMPLEMENTATION_COMPLETE.md` for detailed documentation
2. Review `GEMINI_LIVE_INTEGRATION_PLAN.md` for architecture
3. Check backend logs: `tail -f backend_current.log`
4. Check frontend console for errors
5. Try Classic Mode to isolate issue (Live Mode vs general app issue)

---

## 🎉 You're Ready!

Once you see the green "LIVE" badge and can record/hear responses, you're all set! 

**Enjoy real-time conversations with Gemini 2.5 Live! 🎙️✨**
