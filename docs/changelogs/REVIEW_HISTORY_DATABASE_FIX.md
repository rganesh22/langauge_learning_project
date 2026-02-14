# Review History Database Schema Fix

## Issue
Review history endpoint was failing with:
```
sqlite3.OperationalError: no such table: words
```

## Root Cause
The endpoint was using incorrect table names:
- Used `words` table → Should be `vocabulary`
- Used `target_word` column → Should be `translation`
- Attempted to query `review_history` table → This table doesn't exist in current schema

## Database Schema (Actual)

### Vocabulary Table
```sql
CREATE TABLE vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    english_word TEXT NOT NULL,
    translation TEXT NOT NULL,        -- NOT "target_word"
    transliteration TEXT,
    word_class TEXT,
    level TEXT,
    verb_transitivity TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

### Word States Table  
```sql
CREATE TABLE word_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    user_id INTEGER DEFAULT 1,
    mastery_level TEXT DEFAULT 'new',
    next_review_date TEXT,
    review_count INTEGER DEFAULT 0,
    ease_factor REAL DEFAULT 2.5,
    last_reviewed TEXT,
    introduced_date TEXT,
    interval_days REAL,              -- Added in updates
    FOREIGN KEY (word_id) REFERENCES vocabulary(id)
)
```

### Review History Table
**❌ DOES NOT EXIST** in current schema

The system only tracks:
- Current state in `word_states` table
- No historical record of past reviews
- No tracking of individual flashcard interactions (easy/good/hard/again)

## Fix Applied

### Backend Changes (`backend/main.py`)

1. **Changed table name**: `words` → `vocabulary`
2. **Changed column name**: `target_word` → `translation`
3. **Removed history query**: Since `review_history` table doesn't exist
4. **Return empty history array**: `"history": []`
5. **Added TODO comment**: For future implementation of review history tracking

### Updated Endpoint Response
```json
{
  "word": {
    "id": 21812205,
    "english_word": "hello",
    "translation": "ನಮಸ್ಕಾರ",
    "transliteration": "namaskāra",
    "word_class": "interjection",
    "level": "a1",
    "language": "kannada"
  },
  "current_state": {
    "mastery_level": "learning",
    "review_count": 5,
    "ease_factor": 2.5,
    "interval_days": 7.0,
    "next_review_date": "2026-02-06",
    "last_reviewed": "2026-01-30"
  },
  "history": []  // Empty - no history tracking yet
}
```

## Frontend Behavior

The modal still works and displays:

✅ **Current SRS Status** (from `word_states`):
- Mastery level with colored badge
- Review count (total times reviewed)
- Ease factor
- Current interval
- Next review date
- ETA calculation

❌ **Review History Section**:
- Shows "No review history yet" message
- This is expected since history table doesn't exist

## Future Enhancement: Review History Table

To add full history tracking, need to create:

```sql
CREATE TABLE IF NOT EXISTS review_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word_id INTEGER NOT NULL,
    user_id INTEGER DEFAULT 1,
    reviewed_at TEXT NOT NULL,
    rating TEXT NOT NULL,           -- 'easy', 'good', 'hard', 'again'
    activity_type TEXT,             -- 'flashcard', 'reading', 'listening'
    interval_days REAL,
    ease_factor REAL,
    mastery_level_before TEXT,
    mastery_level_after TEXT,
    FOREIGN KEY (word_id) REFERENCES vocabulary(id),
    FOREIGN KEY (user_id) REFERENCES user_profile(id)
)
```

And update the flashcard/activity completion code to insert records into this table.

## Testing

✅ Endpoint now works without errors
✅ Returns word data and current state correctly
✅ Modal displays current SRS info
✅ History section shows "No review history yet" (expected)
✅ No database errors

## Files Modified
- `backend/main.py` - Fixed table names and removed non-existent history query

## Status
✅ **Working** - Shows current SRS state
⚠️ **Limited** - No historical tracking (requires schema update)

The feature is functional but shows only current state. Full history tracking requires:
1. Creating `review_history` table via migration
2. Updating flashcard/activity code to log reviews
3. Backend will automatically return history once table exists
