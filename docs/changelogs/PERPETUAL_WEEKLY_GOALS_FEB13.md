# Perpetual Weekly Goals Implementation - February 13, 2026

## Overview
Updated the weekly goals system to be **perpetual** - goals now apply to all future weeks until explicitly changed, rather than being week-specific.

## Previous Behavior
- Weekly goals were tied to a specific week (identified by `week_start_date`)
- If you set goals for the current week, they only applied to that week
- Future weeks had no goals unless explicitly set

## New Behavior
- Weekly goals are now stored as a **default template** (using `week_start_date = 'default'`)
- Once set, goals apply **perpetually to all future weeks**
- Goals remain in effect until you explicitly change them
- Example: Set "2 listening activities for Monday" → applies to every Monday going forward

## Implementation Details

### 1. Database Changes (`backend/db.py`)

#### `get_weekly_goals()`
- First checks for week-specific goals (for potential future override feature)
- Falls back to the `'default'` template if no week-specific goals exist
- This ensures goals are perpetual by default

#### `update_weekly_goals()`
- When `week_start_date = None`, saves to the `'default'` template
- This makes goals apply to all future weeks
- Still supports week-specific overrides if needed in the future

### 2. API Changes (`backend/main.py`)

#### `GET /api/weekly-goals/{language}`
- Returns the default template goals that apply to all weeks
- Can still accept optional `week_start_date` parameter for future features

#### `PUT /api/weekly-goals/{language}`
- Now saves to the `'default'` template by default
- Response message updated to: "Weekly goals updated (applies to all future weeks)"
- Returns `week_start_date: "default"` in response

### 3. Frontend Changes (`components/WeeklyGoalsSection.js`)

#### State Cleanup
- Removed `currentWeekStart` state variable (no longer needed)
- Removed `getCurrentWeekStart()` function (no longer needed)

#### Save Function
- Removed `?week_start_date=${currentWeekStart}` from API URL
- Updated success message: "Weekly goals saved! These goals will apply to all future weeks."
- Simplified logging to indicate "perpetual" goals

### 4. Migration (`database/migrations/migrate_weekly_goals_to_perpetual.sql`)
- Copies most recent week's goals to the `'default'` template for each language
- Preserves old week-specific goals for historical reference
- Only creates default entries if they don't already exist

## Database Schema
The `weekly_goals` table schema remains unchanged:
```sql
CREATE TABLE weekly_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    week_start_date TEXT NOT NULL,  -- Now uses 'default' for perpetual goals
    target_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(language, activity_type, day_of_week, week_start_date)
)
```

## Benefits

1. **Simpler UX**: Users set goals once and they apply forever
2. **Less Mental Overhead**: No need to remember to set goals every week
3. **Consistent Behavior**: Goals persist across weeks automatically
4. **Future Extensibility**: Week-specific overrides still possible if needed

## User Experience

### Setting Goals
1. User opens Weekly Goals section
2. Sets goals for each day (e.g., "2 listening for Monday, 1 flashcard for Tuesday")
3. Saves goals
4. **These goals now apply to every week going forward**

### Changing Goals
1. User opens Weekly Goals section
2. Modifies existing goals or adds new ones
3. Saves
4. **Updated goals immediately apply to all future weeks**

### Viewing Goals
- Goals display shows the perpetual template
- No confusion about "this week vs next week"
- What you see is what applies to all weeks

## Testing Checklist
- [x] Backend migration script created
- [x] Backend `get_weekly_goals()` updated to use default template
- [x] Backend `update_weekly_goals()` updated to save to default template
- [x] API endpoints updated with proper documentation
- [x] Frontend save function updated (removed week parameter)
- [x] Frontend state cleanup (removed unused week tracking)
- [ ] Test: Set new goals and verify they save correctly
- [ ] Test: Check that goals appear in dashboard/overview sections
- [ ] Test: Verify SRS quotas sync correctly with new goals
- [ ] Test: Load goals on future dates and confirm they use template

## Files Modified
1. `backend/db.py` - Updated get/update functions for perpetual goals
2. `backend/main.py` - Updated API endpoints
3. `components/WeeklyGoalsSection.js` - Removed week tracking, updated save
4. `database/migrations/migrate_weekly_goals_to_perpetual.sql` - Migration script

## Technical Notes

### Week-Specific Overrides (Future Feature)
The system still supports week-specific goals through the API:
```javascript
// To set goals for a specific week (future feature):
PUT /api/weekly-goals/{language}?week_start_date=2026-02-17
```

The lookup order is:
1. Check for week-specific goals for requested week
2. Fall back to 'default' template if none exist

This allows for future features like:
- Vacation mode (skip a specific week)
- Intensive study weeks (increase goals for one week)
- Special events (modify goals for holiday weeks)

### Backward Compatibility
- Old week-specific goals remain in database
- Will be used if they exist, otherwise falls back to default
- No data loss from migration
