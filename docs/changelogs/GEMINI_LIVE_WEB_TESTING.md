# Web Testing Guide - Gemini Live Mode

## ✅ Implementation Complete for Web!

The Gemini Live integration now uses **Web Audio API** for recording and playback, which means it works perfectly in the browser!

---

## 🚀 Quick Start (Web Testing)

### 1. Update Backend URL (30 seconds)

Edit `screens/activities/shared/constants.js`:
```javascript
export const API_BASE_URL = 'http://localhost:5001';
// Or your machine's IP if testing on different device:
// export const API_BASE_URL = 'http://192.168.1.100:5001';
```

### 2. Install Backend Dependencies

```bash
cd backend
pip3 install websockets==12.0
```

### 3. Start Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 5001
```

Wait for:
```
INFO:     Uvicorn running on http://0.0.0.0:5001
```

### 4. Start Frontend (Web Mode)

```bash
npx expo start --web
```

Press `w` or open http://localhost:8081 in your browser.

**Important**: Use Chrome, Edge, or Firefox (Safari has WebRTC limitations)

### 5. Test Live Mode

1. Navigate to: Activity → Conversation
2. Toggle ON: "🎙️ Real-Time Live Mode"
3. Select a topic
4. Click "Start Conversation"
5. Wait for green "LIVE" badge
6. Click microphone button
7. **Allow microphone access when prompted** ✨
8. Speak!
9. Click stop
10. Listen to AI response!

---

## 🎙️ Web Audio API Features

### Recording
- **MediaRecorder API** captures audio
- **1-second chunks** sent to backend in real-time
- **Audio format**: WebM with Opus codec
- **Sample rate**: 16kHz
- **Channels**: Mono

### Playback
- **HTML5 Audio** for playback
- Queued chunks for smooth streaming
- Automatic cleanup of audio URLs

---

## 🔍 Browser Console Debugging

Open browser console (F12) to see logs:

```javascript
// Good logs:
"Starting recording..."
"Web recording started"
"Connecting to WebSocket: ws://localhost:5001/ws/conversation/live"
"WebSocket connected"
"WebSocket message: setup_complete"
"AI status: listening"

// When recording:
"Stopping recording..."
"Recording stopped"

// When AI responds:
"WebSocket message: audio_chunk"
"WebSocket message: response_complete"
```

---

## 🐛 Troubleshooting

### "MediaDevices API not supported"
- **Cause**: Browser doesn't support getUserMedia
- **Fix**: Use Chrome, Firefox, or Edge (latest versions)

### "Permission denied" for microphone
- **Fix**: Browser will prompt for permission - click "Allow"
- Check browser settings: Settings → Privacy → Site Settings → Microphone

### "HTTPS required"
- **Cause**: Some browsers require HTTPS for getUserMedia
- **Fix**: Use localhost (HTTP allowed) or setup HTTPS

### No audio playback
- **Check**: Volume is up
- **Check**: Browser console for errors
- **Check**: Backend logs show audio chunks being sent

### WebSocket won't connect
- **Check**: Backend is running on port 5001
- **Test**: Open http://localhost:5001/api/health in browser
- **Check**: No CORS errors in console

### Recording starts but no response
- **Check**: Backend console for errors
- **Check**: Audio chunks are being sent (see Network tab → WS)
- **Verify**: Gemini API key is configured in backend

---

## 🌐 Network Tab Inspection

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Click on the WebSocket connection
5. See Messages tab

**You should see:**
```
→ {"type":"start_session","config":{...}}
← {"type":"setup_complete"}
← {"type":"status","status":"listening"}
→ {"type":"audio_chunk","data":"..."} (repeating)
← {"type":"status","status":"thinking"}
← {"type":"audio_chunk","data":"..."} (repeating)
← {"type":"response_complete","text":"...","audio":"..."}
← {"type":"status","status":"listening"}
```

---

## 📊 Performance Metrics

### Recording Latency
- **Chunk interval**: 1 second
- **Network delay**: ~50-200ms
- **Total latency**: ~1-1.2 seconds

### Playback
- **Start delay**: ~100-300ms (first chunk)
- **Streaming**: Smooth (chunks queued)

---

## 🎨 UI Status Indicators

### Header Badge
- **Green "LIVE"**: Connected and ready
- **Red "OFFLINE"**: Disconnected or error

### AI Status
- **🎤 Listening...**: Waiting for your input (green)
- **🤔 Thinking...**: Processing your audio (orange with spinner)
- **🗣️ Speaking...**: AI is responding (blue)

### Recording Button
- **Red dot**: Actively streaming audio
- **Microphone icon**: Ready to record
- **Text**: "🔴 Streaming... (Tap to stop)" or "Tap to start streaming"

---

## 🔧 Advanced Configuration

### Change Chunk Size

In `useGeminiLive.js`, line ~185:
```javascript
mediaRecorder.start(1000); // Get data every 1 second
```

Smaller = lower latency, more overhead:
```javascript
mediaRecorder.start(500);  // 0.5 seconds
mediaRecorder.start(250);  // 0.25 seconds (very low latency!)
```

### Change Audio Quality

In `useGeminiLive.js`, line ~153:
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: {
    channelCount: 1,
    sampleRate: 16000,
    // Add more constraints:
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  } 
});
```

---

## 📱 Mobile Testing (Future)

Currently, Live Mode is **web-only**. For mobile testing:

1. **Option A**: Use mobile browser (Chrome/Firefox on Android, Safari on iOS)
   - Same as web, should work!
   - May need HTTPS on mobile

2. **Option B**: Wait for expo-av integration
   - Will need native app build
   - Better performance
   - Background audio support

---

## ✅ Testing Checklist

### Basic Connection
- [ ] Backend starts without errors
- [ ] Frontend loads in browser
- [ ] Can access conversation activity
- [ ] Live Mode toggle appears
- [ ] Can toggle Live Mode ON

### WebSocket Connection
- [ ] Click "Start Conversation"
- [ ] "LIVE" badge turns green
- [ ] No errors in console
- [ ] WebSocket shows "Connected" in Network tab

### Recording
- [ ] Click microphone button
- [ ] Browser prompts for mic permission
- [ ] Recording indicator appears ("🔴 Streaming...")
- [ ] Can see mic input in browser (check mic icon in address bar)
- [ ] Can speak and hear yourself

### Streaming
- [ ] Network tab shows audio chunks being sent
- [ ] Backend logs show chunks being received
- [ ] AI status changes to "Thinking..."
- [ ] No errors in console

### Playback
- [ ] AI status changes to "Speaking..."
- [ ] Audio plays from speakers
- [ ] Can hear AI voice clearly
- [ ] Playback is smooth (not choppy)

### Multiple Turns
- [ ] Can record second message
- [ ] AI responds again
- [ ] Can continue conversation
- [ ] No degradation over time

### Error Handling
- [ ] Deny mic permission → clear error shown
- [ ] Disconnect WebSocket → status shows "OFFLINE"
- [ ] Refresh page → can restart conversation
- [ ] Network interruption → recovers gracefully

---

## 🎯 Expected User Experience

1. **User clicks "Start Conversation"**
   - Brief pause (~500ms)
   - "LIVE" badge appears (green)
   - "🎤 Listening..." status shown

2. **User clicks microphone**
   - Browser asks for permission (first time only)
   - Red recording dot appears
   - "🔴 Streaming..." text shown
   - User speaks

3. **User clicks stop**
   - Recording stops
   - Status changes to "🤔 Thinking..."
   - Spinner shows AI is processing

4. **AI responds**
   - Status changes to "🗣️ Speaking..."
   - Audio plays from speakers
   - User hears AI voice

5. **Ready for next turn**
   - Status back to "🎤 Listening..."
   - Mic button ready
   - Conversation continues!

---

## 🆘 Common Issues

### "WebSocket connection failed"
```bash
# Check backend is running:
curl http://localhost:5001/api/health

# Should return:
{"status":"ok"}
```

### "Cannot read property 'getUserMedia'"
- **Fix**: Use HTTPS or localhost
- **Fix**: Use modern browser (Chrome 47+, Firefox 36+, Edge 12+)

### Audio plays but can't hear anything
- Check volume mixer in OS
- Check browser is not muted (tab icon)
- Check speaker output device

### Recording but no response
```bash
# Check backend logs:
tail -f backend_current.log | grep -i "websocket\|gemini\|audio"
```

### Browser crashes or freezes
- **Cause**: Too many audio chunks in memory
- **Fix**: Refresh page
- **Fix**: Reduce chunk size (see Advanced Configuration)

---

## 🎉 Success!

If you can:
1. ✅ See green "LIVE" badge
2. ✅ Record audio (see streaming indicator)
3. ✅ Hear AI response
4. ✅ Continue multi-turn conversation

**Congratulations! Your Gemini Live integration is working! 🚀**

---

## 📚 Next Steps

1. **Test different languages** (kannada, hindi, tamil, etc.)
2. **Test different voices** (Puck, Charon, Kore, etc.)
3. **Test different topics** (shopping, restaurant, travel, etc.)
4. **Optimize chunk size** for your network
5. **Add mobile support** (expo-av integration)
6. **Deploy to production** (setup HTTPS)

---

## 🎓 Web Audio API Resources

- [MDN: MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN: getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Can I Use: MediaRecorder](https://caniuse.com/mediarecorder)

---

**Happy testing on the web! 🌐✨**
