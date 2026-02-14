# Quick Setup Guide

## 1. Install Dependencies

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend
```bash
npm install
```

## 2. Set Environment Variables

```bash
export GEMINI_API_KEY=your_key_here
export GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
```

## 3. Start Backend

```bash
cd backend
source venv/bin/activate
python main.py
```

Backend runs on `http://localhost:5001`

## 4. Start Frontend

```bash
npm start
```

Press `w` for web, `i` for iOS, `a` for Android, or scan QR code.

## Notes

- Database is auto-created on first run
- Vocabulary loads from `vocab/kannada-oxford-5000.csv`
- Only Kannada is active; other languages are locked
- For physical devices, update `API_BASE_URL` in screen files to your computer's IP
