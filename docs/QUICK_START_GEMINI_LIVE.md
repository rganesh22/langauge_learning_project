# 🚀 QUICK START - 60 Seconds to Live Mode!

## Step 1: Install Dependencies (10s)
```bash
cd backend && pip3 install websockets==12.0
```

## Step 2: Start Backend (10s)
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 5001
```

## Step 3: Start Frontend Web (10s)
```bash
npx expo start --web
```
Press `w` or open http://localhost:8081

## Step 4: Test Live Mode (30s)
1. **Navigate**: Conversation Activity
2. **Toggle**: "🎙️ Real-Time Live Mode" → ON
3. **Start**: Click "Start Conversation"
4. **Permission**: Allow microphone
5. **Record**: Click 🎤, speak, click stop
6. **Listen**: Hear AI respond! ✨

---

## ✅ You'll Know It's Working When...
- Green "LIVE" badge appears
- "🔴 Streaming..." when recording
- AI status changes (🎤 → 🤔 → 🗣️)
- You hear AI voice!

---

## 🐛 Quick Troubleshooting

**No microphone permission?**
→ Check browser settings → Privacy → Microphone

**WebSocket won't connect?**
→ `curl http://localhost:5001/api/health`

**Can't hear audio?**
→ Check volume, browser not muted

**Browser console errors?**
→ Use Chrome/Firefox/Edge (not Safari/IE)

---

## 📚 Full Documentation
- **Testing**: See `GEMINI_LIVE_WEB_TESTING.md`
- **Summary**: See `GEMINI_LIVE_WEB_COMPLETE.md`
- **Architecture**: See `GEMINI_LIVE_INTEGRATION_PLAN.md`

---

## 🎉 That's It!
Real-time AI conversations in 60 seconds! 🎙️✨

Browser → MediaRecorder → WebSocket → Gemini Live → Audio Response

**Happy conversing!** 🚀
