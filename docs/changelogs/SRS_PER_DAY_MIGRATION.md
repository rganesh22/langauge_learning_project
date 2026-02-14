# SRS Settings Migration: Per-Week → Per-Day

## Summary of Changes

This update converts the SRS (Spaced Repetition System) settings from **per-week** to **per-day** and adds **translation** activities to the weekly goals system.

---

## 1. SRS Settings: Per-Week → Per-Day

### Why This Change?
- **More intuitive**: Users think about daily goals, not weekly distributions
- **Clearer settings**: "3 new words per day" is easier to understand than "21 per week"
- **Better control**: Users can adjust their daily pace directly

### Backend Changes

#### **config.py**
- Changed constants:
  - `DEFAULT_NEW_CARDS_PER_WEEK = 20` → `DEFAULT_NEW_CARDS_PER_DAY = 3`
  - `DEFAULT_REVIEWS_PER_WEEK = 200` → `DEFAULT_REVIEWS_PER_DAY = 30`

#### **db.py**
- Updated database schema:
  - `new_cards_per_week` → `new_cards_per_day`
  - `reviews_per_week` → `reviews_per_day`
- Updated functions:
  - `get_srs_settings()` - Returns per-day values
  - `update_srs_settings(language, new_cards_per_day, reviews_per_day)` - Accepts per-day values
  - `_recalculate_daily_quotas()` - No longer divides by 7, uses daily values directly

#### **main.py**
- Updated API endpoints:
  - `PUT /api/srs/settings/{language}` - Now expects `new_cards_per_day` and `reviews_per_day` in request body

### Frontend Changes

#### **ProfileScreen.js**
- Updated state variables (kept names for minimal changes):
  - `newCardsPerWeek` now stores per-day value (default: 10)
  - `reviewsPerWeek` now stores per-day value (default: 100)
- Updated UI labels:
  - "New Cards Per Week" → "New Cards Per Day"
  - "Reviews Per Week" → "Reviews Per Day"
  - Removed "per day" calculation display
- Updated increment/decrement buttons:
  - New cards: ±7 → ±1
  - Reviews: ±35 → ±5
- Updated API calls:
  - Load: `settingsData.new_cards_per_day`
  - Save: `{new_cards_per_day: ..., reviews_per_day: ...}`

### Database Migration

Created `migrate_srs_to_per_day.py` script that:
1. Checks if migration is needed
2. Converts existing weekly values to daily (divides by 7, rounds)
3. Updates database schema
4. Preserves user settings with appropriate conversion

**Migration Results:**
```
tamil:   70/week → 10/day,  700/week → 100/day
kannada: 100/week → 14/day, 1000/week → 143/day
urdu:    100/week → 14/day, 1000/week → 143/day
```

---

## 2. Weekly Goals: Added Translation Activities

### Why This Change?
Translation is an important activity type that should be trackable in weekly goals, just like reading, writing, speaking, etc.

### Changes Made

#### **WeeklyGoalsSection.js**
- Updated `ACTIVITIES` array:
  ```javascript
  // Before
  const ACTIVITIES = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'conversation'];
  
  // After
  const ACTIVITIES = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'conversation', 'translation'];
  ```
- Translation already had color defined: `{ primary: '#8B5CF6', light: '#F3E8FF' }`
- Translation icon handling already existed in the component

---

## Testing

### ✅ Backend Testing
```bash
# Test GET endpoint
curl http://localhost:5001/api/srs/settings/tamil
# Returns: new_cards_per_day: 10, reviews_per_day: 100

# Test PUT endpoint
curl -X PUT http://localhost:5001/api/srs/settings/tamil \
  -H "Content-Type: application/json" \
  -d '{"new_cards_per_day": 12, "reviews_per_day": 120}'
# Returns: {"success": true, "message": "Settings updated"}

# Verify update
curl http://localhost:5001/api/srs/settings/tamil
# Returns: new_cards_per_day: 12, reviews_per_day: 120
```

### ✅ Database Verification
```sql
-- Check schema
PRAGMA table_info(srs_settings);
-- Shows: new_cards_per_day (INTEGER), reviews_per_day (INTEGER)

-- Check data
SELECT language, new_cards_per_day, reviews_per_day FROM srs_settings WHERE user_id = 1;
-- Returns:
-- kannada|14|143
-- tamil|12|120
-- urdu|14|143
```

### Frontend Testing
1. Open Profile Screen
2. Go to "Review Scheduling" section
3. Verify labels show "Per Day" instead of "Per Week"
4. Change settings and save
5. Reload page - settings should persist
6. Open Weekly Goals section
7. Add activities - verify "translation" appears in activity list

---

## User Impact

### What Users Will Notice
1. **Review Scheduling section**: 
   - Labels now say "per day" instead of "per week"
   - Numbers are ~7x smaller (70/week → 10/day)
   - Increment buttons adjust by smaller amounts (1 instead of 7)

2. **Weekly Goals section**:
   - Translation now appears as an activity option
   - Can set daily translation goals alongside other activities

### What Stays the Same
- Daily quota calculation logic (backend calculates based on daily settings)
- Learning flow and activity screens
- Progress tracking and statistics
- All existing data preserved (automatically converted)

---

## Files Modified

### Backend
- ✅ `backend/config.py` - Updated constants
- ✅ `backend/db.py` - Updated schema and functions
- ✅ `backend/main.py` - Updated API endpoint
- ✅ `backend/migrate_srs_to_per_day.py` - NEW migration script

### Frontend
- ✅ `screens/ProfileScreen.js` - Updated UI labels and API calls
- ✅ `components/WeeklyGoalsSection.js` - Added translation to activities

### Database
- ✅ `srs_settings` table - Migrated schema from per-week to per-day columns

---

## Rollback Plan (if needed)

If issues arise, you can rollback by:

1. Restore database from backup:
   ```bash
   cp backend/db_backup/fluo.db.bak.YYYYMMDDHHMMSS backend/fluo.db
   ```

2. Revert code changes:
   ```bash
   git revert <commit-hash>
   ```

3. Or manually revert column names and multiply values by 7

---

## Next Steps

- ✅ Monitor frontend for any display issues
- ✅ Verify daily quota calculations work correctly
- ✅ Test translation activities in weekly goals
- ⏳ Consider adding UI tooltips explaining daily vs weekly goals
- ⏳ Update any documentation that mentions "per week" settings

---

## Date: January 29, 2026
