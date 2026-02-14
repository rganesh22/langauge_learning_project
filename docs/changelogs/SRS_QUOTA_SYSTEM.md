# SRS Quota System - Implementation Guide

## Overview

The SRS (Spaced Repetition System) quota system automatically syncs daily flashcard quotas with the user's weekly goals. This ensures that the flashcard system respects the user's learning pace and goals.

## Architecture

### Database Layer (`backend/db.py`)

#### Tables
- `srs_daily_quota`: Stores daily quotas and completion counts for each language
  - Columns: `user_id`, `language`, `date`, `new_cards_quota`, `new_cards_completed`, `reviews_quota`, `reviews_completed`

#### Key Functions

**`sync_srs_quotas_from_weekly_goals(language, week_start_date, user_id)`**
- Syncs SRS daily quotas from weekly flashcard goals for a specific language
- Reads weekly goals and distributes flashcard counts across the week
- Uses 30/70 split: 30% new cards, 70% reviews
- Preserves completed counts when updating quotas

**`sync_all_languages_srs_quotas(week_start_date, user_id)`**
- Syncs SRS quotas for all active languages
- Called on app startup and after saving weekly goals
- Ensures all languages stay synchronized

**`update_weekly_goals(language, weekly_goals, week_start_date)`**
- Updates weekly goals in the database
- **Automatically triggers `sync_srs_quotas_from_weekly_goals()`** after saving
- This ensures quotas update immediately when goals change

**`get_daily_quota(language, date, user_id)`**
- Retrieves daily quota for a specific date
- Auto-creates quota if it doesn't exist
- Used by flashcard system to enforce limits

**`increment_daily_quota(language, is_new_card, user_id)`**
- Increments completion counter when a card is reviewed
- Tracks progress toward daily quota

### API Layer (`backend/main.py`)

#### Endpoints

**POST `/api/srs/sync-quotas/{language}`**
```json
{
  "success": true,
  "message": "SRS quotas synced for kannada",
  "language": "kannada",
  "week_start_date": "2026-01-27"
}
```
- Syncs SRS quotas for a specific language
- Optional `week_start_date` parameter

**POST `/api/srs/sync-quotas-all`**
```json
{
  "success": true,
  "message": "SRS quotas synced for all languages",
  "week_start_date": "2026-01-27"
}
```
- Syncs SRS quotas for all languages with weekly goals
- Called on app startup and after saving goals

**PUT `/api/weekly-goals/{language}`**
- Updates weekly goals
- **Automatically syncs SRS quotas** via `db.update_weekly_goals()`

### Frontend Layer

#### App Initialization (`App.js`)

```javascript
useEffect(() => {
  const syncSrsQuotas = async () => {
    const response = await fetch(`${API_BASE_URL}/api/srs/sync-quotas-all`, {
      method: 'POST',
    });
    // Syncs all SRS quotas on app startup
  };
  syncSrsQuotas();
}, []);
```

**When**: App launches
**Why**: Ensures quotas are current, especially after app updates or new days

#### Dashboard Screen (`screens/DashboardScreen.js`)

```javascript
useFocusEffect(
  React.useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    if (lastSrsSyncDate.current !== today) {
      syncSrsQuotas();
      lastSrsSyncDate.current = today;
    }
  }, [selectedLanguage, weekOffset])
);
```

**When**: Dashboard screen is focused (daily check)
**Why**: Syncs quotas once per day when user opens the app

#### Weekly Goals Section (`components/WeeklyGoalsSection.js`)

```javascript
const saveGoals = async () => {
  // Save goals to backend
  await Promise.all(promises);
  
  // Sync SRS quotas after saving
  await fetch(`${API_BASE_URL}/api/srs/sync-quotas-all`, {
    method: 'POST',
  });
  
  // Notify parent components
  if (onGoalsSaved) {
    onGoalsSaved();
  }
};
```

**When**: User saves weekly goals
**Why**: Immediately updates SRS quotas to match new goals

## Data Flow

### 1. User Sets Weekly Goals
```
User Input (Profile) 
  → WeeklyGoalsSection.saveGoals()
  → API: PUT /api/weekly-goals/{language}
  → db.update_weekly_goals()
  → db.sync_srs_quotas_from_weekly_goals() [AUTO]
  → Updates srs_daily_quota table
```

### 2. App Startup Sync
```
App Launch
  → App.js useEffect
  → API: POST /api/srs/sync-quotas-all
  → db.sync_all_languages_srs_quotas()
  → Syncs all active languages
```

### 3. Daily Dashboard Check
```
Dashboard Focus (new day)
  → DashboardScreen.useFocusEffect
  → syncSrsQuotas()
  → API: POST /api/srs/sync-quotas-all
  → Ensures quotas are current
```

### 4. Flashcard Review
```
User Reviews Card
  → FlashcardScreen
  → API: POST /api/flashcard/update
  → db.update_word_state_from_flashcard()
  → db.increment_daily_quota()
  → Tracks progress
```

### 5. Quota Enforcement
```
Load Flashcards
  → API: GET /api/flashcards/{language}
  → db.get_words_for_review()
  → db.get_daily_quota()
  → Respects new_cards_quota and reviews_quota
```

## Quota Calculation

### From Weekly Goals
When user sets: **Monday: 20 flashcards**

The system calculates:
- **New cards quota**: 20 × 0.3 = 6 cards
- **Reviews quota**: 20 × 0.7 = 14 cards

### Distribution Logic
- 30% of daily goal = new cards to learn
- 70% of daily goal = review cards
- This ratio balances learning with reinforcement

### Example Week
```
Weekly Goals:
  Monday: 20 flashcards
  Tuesday: 15 flashcards
  Wednesday: 20 flashcards
  Thursday: 0 flashcards (rest day)
  Friday: 25 flashcards
  Saturday: 15 flashcards
  Sunday: 10 flashcards

Calculated Quotas:
  Monday: 6 new, 14 reviews
  Tuesday: 4 new, 11 reviews
  Wednesday: 6 new, 14 reviews
  Thursday: 0 new, 0 reviews
  Friday: 7 new, 18 reviews
  Saturday: 4 new, 11 reviews
  Sunday: 3 new, 7 reviews
```

## Sync Triggers

### Automatic Triggers
1. **App Startup** - Ensures fresh quotas
2. **Daily Check** - Updates when day changes
3. **Goals Saved** - Immediately reflects new goals
4. **Backend Update** - Triggered by `update_weekly_goals()`

### Manual Triggers (if needed)
- User can manually trigger via API calls
- Support team can run sync for specific users
- Cron jobs can ensure nightly sync (future enhancement)

## Benefits

### For Users
- ✅ Flashcard quotas automatically match weekly goals
- ✅ No manual SRS configuration needed
- ✅ Flexible daily pacing (adjust goals anytime)
- ✅ System respects rest days (0 cards = no pressure)

### For System
- ✅ Automatic synchronization
- ✅ Robust error handling
- ✅ Multiple sync points ensure reliability
- ✅ Preserves progress when updating quotas

## Testing Checklist

- [ ] Set weekly flashcard goals in Profile
- [ ] Save goals and verify sync API is called
- [ ] Check `srs_daily_quota` table has correct values
- [ ] Navigate to Dashboard and verify goals displayed
- [ ] Launch app and verify startup sync
- [ ] Review flashcards and check quota enforcement
- [ ] Change goals and verify immediate update
- [ ] Test with multiple languages

## Troubleshooting

### Quotas Not Updating
1. Check console for API errors
2. Verify backend is running
3. Check `srs_daily_quota` table directly
4. Manually trigger: POST `/api/srs/sync-quotas-all`

### Incorrect Quota Calculations
1. Verify weekly goals saved correctly
2. Check 30/70 split logic in `sync_srs_quotas_from_weekly_goals()`
3. Ensure `week_start_date` is correct Monday

### Sync Not Triggering
1. Check App.js useEffect runs on launch
2. Verify DashboardScreen date check logic
3. Check WeeklyGoalsSection calls API after save
4. Review backend logs for sync function calls

## Future Enhancements

### Possible Improvements
1. **Custom Split Ratio** - Let users choose new/review ratio
2. **Smart Distribution** - Distribute based on available words
3. **Streak Bonuses** - Adjust quotas based on performance
4. **Predictive Quotas** - Suggest goals based on learning pace
5. **Batch Sync** - Sync multiple weeks at once
6. **Offline Support** - Queue syncs when offline

### Monitoring
- Add analytics for sync success rates
- Track quota adherence vs completion
- Monitor API performance
- Log sync frequency and triggers

## Code References

### Backend Files
- `backend/db.py` - Lines 875-988 (quota functions)
- `backend/main.py` - Lines 2620-2715 (sync endpoints)

### Frontend Files
- `App.js` - Lines 64-82 (startup sync)
- `screens/DashboardScreen.js` - Lines 125-152 (daily check)
- `components/WeeklyGoalsSection.js` - Lines 168-210 (save goals)

## Summary

The SRS quota system creates a seamless connection between user goals and system behavior. By automatically syncing flashcard quotas with weekly goals, users can focus on learning while the system handles the scheduling complexity. The multi-trigger approach ensures quotas stay current, and the automatic integration with goal updates makes the system feel responsive and intelligent.
