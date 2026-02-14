# Quick Reference: SRS Settings Update

## Changes Made (January 29, 2026)

### 1. SRS Settings: Per-Week → Per-Day ✅

**What changed:**
- Settings now use daily values instead of weekly
- UI shows "New Cards Per Day" and "Reviews Per Day"
- API endpoints use `new_cards_per_day` and `reviews_per_day`

**Default values:**
- New cards: 3 per day (was 20 per week)
- Reviews: 30 per day (was 200 per week)

**Current user settings:**
```
tamil:     12 cards/day, 120 reviews/day
kannada:   14 cards/day, 143 reviews/day
urdu:      14 cards/day, 143 reviews/day
telugu:    3 cards/day (default), 30 reviews/day (default)
hindi:     3 cards/day (default), 30 reviews/day (default)
malayalam: 3 cards/day (default), 30 reviews/day (default)
```

### 2. Weekly Goals: Added Translation ✅

**What changed:**
- Translation activities can now be added to weekly goals
- Translation uses purple color (#8B5CF6)

**Full activity list:**
- Flashcards
- Reading
- Listening
- Writing
- Speaking
- Conversation
- **Translation** (NEW)

---

## API Endpoints

### Get SRS Settings
```bash
GET /api/srs/settings/{language}

Response:
{
  "language": "tamil",
  "new_cards_per_day": 12,
  "reviews_per_day": 120,
  "created_at": "...",
  "updated_at": "..."
}
```

### Update SRS Settings
```bash
PUT /api/srs/settings/{language}

Body:
{
  "new_cards_per_day": 12,
  "reviews_per_day": 120
}

Response:
{
  "success": true,
  "message": "Settings updated"
}
```

---

## Frontend Usage

### ProfileScreen.js
```javascript
// State variables (names unchanged but now store per-day values)
const [newCardsPerWeek, setNewCardsPerWeek] = useState(10);  // Actually per-day
const [reviewsPerWeek, setReviewsPerWeek] = useState(100);    // Actually per-day

// Load settings
const settingsData = await fetch(`${API_BASE_URL}/api/srs/settings/${language}`);
setNewCardsPerWeek(settingsData.new_cards_per_day || 10);
setReviewsPerWeek(settingsData.reviews_per_day || 100);

// Save settings
await fetch(`${API_BASE_URL}/api/srs/settings/${lang}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    new_cards_per_day: newCardsPerWeek,
    reviews_per_day: reviewsPerWeek
  }),
});
```

### WeeklyGoalsSection.js
```javascript
// Activities now include translation
const ACTIVITIES = [
  'flashcards', 
  'reading', 
  'listening', 
  'writing', 
  'speaking', 
  'conversation', 
  'translation'  // NEW
];
```

---

## Database Schema

### srs_settings table
```sql
CREATE TABLE srs_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    language TEXT NOT NULL,
    new_cards_per_day INTEGER DEFAULT 3,      -- Changed from new_cards_per_week
    reviews_per_day INTEGER DEFAULT 30,       -- Changed from reviews_per_week
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, language)
);
```

---

## Migration Script

If you need to run the migration again:

```bash
cd "/Users/raghavganesh/Documents/Code Projects/Language Learning Project"
python3 backend/migrate_srs_to_per_day.py
```

The script automatically:
- Converts weekly values to daily (divides by 7)
- Updates database schema
- Preserves all user data

---

## Testing Commands

```bash
# Test GET endpoint
curl http://localhost:5001/api/srs/settings/tamil | python3 -m json.tool

# Test PUT endpoint
curl -X PUT http://localhost:5001/api/srs/settings/tamil \
  -H "Content-Type: application/json" \
  -d '{"new_cards_per_day": 15, "reviews_per_day": 150}'

# Check all languages
sqlite3 backend/fluo.db "SELECT language, new_cards_per_day, reviews_per_day FROM srs_settings WHERE user_id = 1"
```

---

## Files Modified

- `backend/config.py` - Updated constants
- `backend/db.py` - Updated functions and schema
- `backend/main.py` - Updated API endpoint
- `backend/migrate_srs_to_per_day.py` - NEW migration script
- `screens/ProfileScreen.js` - Updated UI and API calls
- `components/WeeklyGoalsSection.js` - Added translation activity

---

## Validation ✅

- [x] Backend API returns per-day values
- [x] Database schema updated
- [x] Migration completed successfully
- [x] All languages accessible
- [x] PUT endpoint accepts per-day values
- [x] Translation added to weekly goals
- [x] No errors in modified files

---

**Status**: ✅ Complete and tested
**Date**: January 29, 2026
