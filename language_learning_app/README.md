# Language Learning App (Fluo)

A React Native / Expo mobile app for learning South Asian languages (Kannada, Hindi, Urdu, Malayalam, Tamil, Telugu) with AI-powered activities, spaced-repetition flashcards, and script-reading lessons.

## Structure

```
language_learning_app/
├── backend/          # FastAPI backend (port 8080)
│   ├── main.py       # App entry point
│   ├── db.py         # SQLite + SRS logic
│   ├── api_client.py # Gemini AI integration
│   ├── config.py     # Config & DB path
│   ├── data/         # fluo.db (SQLite database)
│   ├── lessons/      # Lesson JSON files per language
│   ├── prompting/    # Prompt templates
│   └── scripts/      # One-off utility scripts
├── frontend/         # Expo React Native app
│   ├── App.js        # Navigation root
│   ├── screens/      # All app screens
│   ├── components/   # Shared UI components
│   ├── contexts/     # React contexts
│   └── constants/    # Static data & labels
├── vocab/            # Vocabulary CSV files (Oxford 5000)
└── start.sh          # Start backend and/or frontend
```

## Quick Start

```bash
# Start everything
./start.sh

# Backend only (port 8080)
./start.sh --backend

# Frontend only (Expo)
./start.sh --frontend

# Stop everything
./start.sh --stop
```

## Backend Setup (first time)

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Set GEMINI_API_KEY in your environment or a .env file
```

## Frontend Setup (first time)

```bash
cd frontend
npm install
```

## Ports

| Service  | Port |
|----------|------|
| Backend  | 8080 |
| Frontend | 8081 (Expo web) |
