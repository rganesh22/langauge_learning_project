# Language Learning Project

A full-stack language learning platform with two main components:

## Structure

```
├── language_learning_app/
│   ├── backend/               # FastAPI server (port 8080)
│   ├── frontend/              # Expo React Native app
│   ├── vocab/                 # Oxford-5000 vocabulary CSVs
│   ├── README.md
│   └── start.sh               # Start/stop this app
├── agentic_curriculum/
│   ├── backend/               # FastAPI agent server (port 8000)
│   ├── frontend/              # Electron UI
│   ├── storage/               # Persisted task results
│   ├── README.md
│   └── start.sh               # Start/stop this app
├── dev_launcher.sh            # Global: start all 4 processes at once
└── README.md
```

## Components

### 🎓 Language Learning App (`language_learning_app/`)
A Duolingo-inspired mobile app supporting Kannada, Malayalam, Tamil, Telugu, Hindi, and Urdu. Features SRS flashcards, structured lessons, conversation practice, and more.

- **Frontend**: Expo / React Native (web + mobile)
- **Backend**: FastAPI on port `8080`
- **Database**: SQLite (`fluo.db`)

See [`language_learning_app/README.md`](language_learning_app/README.md)

### 🤖 Agentic Curriculum Studio (`agentic_curriculum/`)
An AI-powered tool for generating and managing lesson content. Uses a ReAct agent with Google Gemini to create, validate, and load lessons into the app's database.

- **Backend**: FastAPI on port `8000`
- **UI**: Electron desktop app
- **Agent**: ReAct loop with 18 tools (file ops, DB management, planning)

See [`agentic_curriculum/README.md`](agentic_curriculum/README.md)

## Quick Start

### Start everything (global launcher)
```bash
./dev_launcher.sh --all
```

### Start individual apps
```bash
# Language Learning App only
./language_learning_app/start.sh             # backend + frontend
./language_learning_app/start.sh --backend   # backend only (port 8080)
./language_learning_app/start.sh --frontend  # Expo only

# Agentic Curriculum only
./agentic_curriculum/start.sh                # backend + frontend
./agentic_curriculum/start.sh --backend      # backend only (port 8000)
./agentic_curriculum/start.sh --setup        # first-time install
```

### Check logs
```bash
tail -f logs/ll-backend.log
tail -f logs/ac-backend.log
```

## Ports

| Service                         | Port |
|---------------------------------|------|
| Language Learning App (API)     | 8080 |
| Agentic Curriculum Studio (API) | 8000 |
| Expo Dev Server                 | 8081 |
| Agentic Curriculum UI           | 3000 |
