# Fluo - Language Learning App

A Duolingo-inspired mobile language learning application built with Expo (React Native) and Python FastAPI backend. Features AI-powered activities, Spaced Repetition System (SRS), and progress tracking.

## Features

- **Dashboard**: Track streaks, daily goals, and language progress
- **Vocabulary Library**: Searchable and filterable vocabulary with SRS tracking
- **AI-Powered Activities**:
  - **Reading**: Stories with comprehension questions
  - **Listening**: Audio exercises with transcription
  - **Writing**: Contextual translation prompts
  - **Conversation**: Voice-driven chat tutor
- **Progress Tracking**: Per-language, per-activity daily goals
- **SRS System**: Automatic vocabulary mastery tracking

## Tech Stack

### Frontend
- Expo (React Native)
- React Navigation
- Expo Linear Gradient
- TypeScript/JavaScript

### Backend
- FastAPI (Python)
- SQLite (Local database)
- Google Gemini 2.5 Flash API (Text generation & TTS)
- Google Cloud Speech-to-Text (STT)

## Prerequisites

- Node.js (v14 or higher)
- Python 3.7 or higher
- Expo CLI (`npm install -g expo-cli`)
- Google Gemini API Key
- Google Cloud credentials (for Speech-to-Text)

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file in the `backend` directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
```

Or export them:

```bash
export GEMINI_API_KEY=your_gemini_api_key_here
export GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
```

### 3. Initialize Database

The database will be automatically initialized when you first run the backend. It will:
- Create SQLite database (`fluo.db`)
- Load vocabulary from `vocab/kannada-oxford-5000.csv`
- Set up default goals

### 4. Start Backend Server

```bash
cd backend
source venv/bin/activate
python main.py
```

The backend will run on `http://localhost:5001`

### 5. Frontend Setup

```bash
npm install
```

### 6. Start Expo App

```bash
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web browser
- Scan QR code with Expo Go app on your phone

## Configuration

### API Base URL

If testing on a physical device, update the `API_BASE_URL` in each screen file:
- `screens/DashboardScreen.js`
- `screens/VocabLibraryScreen.js`
- `screens/ProfileScreen.js`
- `screens/ActivityScreen.js`

Change from:
```javascript
const API_BASE_URL = 'http://localhost:5001';
```

To your computer's IP address:
```javascript
const API_BASE_URL = 'http://192.168.1.100:5001';
```

## Project Structure

```
.
├── App.js                    # Main app with navigation
├── screens/                  # Screen components
│   ├── DashboardScreen.js   # Main dashboard
│   ├── VocabLibraryScreen.js # Vocabulary browser
│   ├── ProfileScreen.js     # Settings and goals
│   └── ActivityScreen.js    # Activity handler
├── backend/
│   ├── main.py              # FastAPI server
│   ├── db.py                # Database operations
│   ├── api_client.py        # Gemini API integration
│   └── requirements.txt     # Python dependencies
├── vocab/
│   └── kannada-oxford-5000.csv  # Vocabulary data
└── package.json             # Frontend dependencies
```

## API Endpoints

### Dashboard
- `GET /api/dashboard/{language}` - Get dashboard data
- `GET /api/profile` - Get user profile

### Vocabulary
- `GET /api/vocabulary/{language}` - Get vocabulary (with search/filter)
- `GET /api/words-for-review/{language}` - Get words for SRS review

### Activities
- `POST /api/activity/reading/{language}` - Generate reading activity
- `POST /api/activity/listening/{language}` - Generate listening activity
- `POST /api/activity/writing/{language}` - Generate writing activity
- `POST /api/activity/conversation/{language}` - Generate conversation response
- `POST /api/activity/complete` - Complete activity and update SRS

### Goals
- `GET /api/goals/{language}` - Get language goals
- `PUT /api/goals/{language}` - Update language goals

## SRS (Spaced Repetition System

Words progress through stages:
- **New**: Never reviewed
- **Learning**: Recently introduced (1 day interval)
- **Review**: Being reinforced (3+ day intervals)
- **Mastered**: Fully learned

The system uses a simplified SM-2 algorithm to schedule reviews based on performance.

## Current Languages

- **Kannada**: Fully active (with vocabulary loaded)
- **Telugu, Malayalam, Tamil, Hindi, Urdu, Spanish, French, Welsh**: Locked (UI ready)

## Troubleshooting

### Backend Issues

1. **Port 5001 already in use**: Change port in `backend/main.py`
2. **Database errors**: Delete `backend/fluo.db` and restart
3. **Gemini API errors**: Check `GEMINI_API_KEY` environment variable

### Frontend Issues

1. **Connection refused**: Ensure backend is running and check `API_BASE_URL`
2. **Navigation errors**: Run `npm install` to ensure all dependencies are installed
3. **Build errors**: Clear cache with `expo start -c`

## Next Steps

- Add more language vocabulary files
- Implement full TTS audio playback
- Add voice recording for conversation activity
- Implement advanced SRS algorithm
- Add user authentication
- Add progress analytics

## License

MIT
