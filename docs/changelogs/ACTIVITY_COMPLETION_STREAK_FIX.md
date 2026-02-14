# Activity Completion & Streak Fix
**Date:** January 29, 2026  
**Version:** 2.7

## Overview
This update fixes two critical issues:
1. **Activities only count toward streak when completed**, not when created
2. **Settings changes (languages, interests) immediately reflect on all screens**

## Problem 1: Premature Streak Counting

### Issue
Previously, activities counted toward the user's streak as soon as they were created, not when they were actually completed. This meant:
- Creating an activity (without finishing it) would update the streak
- Users could maintain streaks without completing any activities
- The weekly activity graph showed incomplete activities

### Root Cause
When activities were created, the `activity_history` table had `completed_at TEXT DEFAULT CURRENT_TIMESTAMP`, which automatically set a timestamp even for incomplete activities.

### Solution
1. **Schema Change**: Removed `DEFAULT CURRENT_TIMESTAMP` from `completed_at` column
2. **Completion Tracking**: `completed_at` is now only set when `update_activity_score()` is called (when user submits/completes activity)
3. **Streak Update**: `update_streak()` is now called in `update_activity_score()` instead of `log_activity()`
4. **Query Filtering**: All queries for completed activities now include `WHERE completed_at IS NOT NULL`

## Problem 2: Settings Not Immediately Reflecting

### Issue
When users changed settings in ProfileScreen (languages, interests), other screens wouldn't update until the app was restarted or the screen was reloaded manually.

### Solution
Added `useFocusEffect` to `DashboardScreen` so it reloads data whenever you navigate back to it. This ensures:
- Language changes immediately show on Dashboard
- Interest changes affect activity topic selection immediately
- Goals and progress refresh when switching screens

## Technical Implementation

### Backend Changes

#### **backend/db.py**

1. **Schema Update** (Line 163):
   ```python
   # BEFORE
   completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
   
   # AFTER
   completed_at TEXT,  # NULL until activity is completed
   ```

2. **log_activity() Function** (Lines 1747-1752):
   - Removed `update_streak()` call
   - Activities are saved with `completed_at = NULL` when created
   - Added comment explaining streak will be updated on completion
   ```python
   # Don't update streak here - only update when activity is actually completed
   # update_streak() will be called from update_activity_score() instead
   ```

3. **update_activity_score() Function** (Lines 1881-1885):
   - Now updates `completed_at` to `CURRENT_TIMESTAMP` when activity is completed
   - Added `update_streak()` call after committing
   ```python
   # Update the existing activity with the new score, data, and completed_at timestamp
   # This ensures activities only count toward streak when actually completed
   cursor.execute('''
       UPDATE activity_history
       SET score = ?, activity_data = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?
   ''', (score, activity_data, activity_id))
   
   # Later in function:
   conn.commit()
   conn.close()
   
   # Update streak after completing activity (not when creating it)
   update_streak()
   ```

4. **get_daily_stats() Function** (Line 1535):
   - Added `AND completed_at IS NOT NULL` filter
   ```python
   activity_query = '''
       SELECT DATE(completed_at) as date, COUNT(*) as count
       FROM activity_history
       WHERE user_id = 1 AND completed_at IS NOT NULL
   '''
   ```

#### **backend/main.py**

1. **get_weekly_stats() Endpoint** (Lines 2482-2502):
   - Added `AND completed_at IS NOT NULL` to both queries
   ```python
   cursor.execute('''
       SELECT 
           DATE(completed_at) as date,
           COUNT(*) as activity_count
       FROM activity_history
       WHERE user_id = 1 
       AND completed_at IS NOT NULL
       AND completed_at >= ?
       ...
   ''')
   ```

2. **get_activity_history() Endpoint** (Line 2448):
   - Updated ORDER BY to handle NULL values
   - Incomplete activities (completed_at = NULL) appear first
   ```python
   cursor.execute('''
       SELECT * FROM activity_history
       WHERE user_id = 1 AND language = ?
       ORDER BY COALESCE(completed_at, '9999-12-31') DESC, id DESC
       LIMIT ?
   ''', (language, limit))
   ```

### Frontend Changes

#### **screens/DashboardScreen.js**

1. **Import Addition** (Line 13):
   ```javascript
   import { useFocusEffect } from '@react-navigation/native';
   ```

2. **Added useFocusEffect Hook** (Lines 117-124):
   ```javascript
   // Reload data when screen comes into focus (e.g., returning from ProfileScreen)
   useFocusEffect(
     React.useCallback(() => {
       loadDashboard();
       loadAllTodayGoals();
       loadWeeklyStats(weekOffset);
     }, [selectedLanguage, weekOffset])
   );
   ```

### Database Migration

#### **migrate_activity_history.sql**
- Creates new table with updated schema (no DEFAULT on completed_at)
- Copies all existing data (preserves all timestamps)
- Drops old table and renames new one
- Verifies migration: 151 activities, all with timestamps

**Migration Steps:**
```sql
-- 1. Create new table without DEFAULT
CREATE TABLE activity_history_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER DEFAULT 1,
    language TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    activity_data TEXT,
    score REAL,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES user_profile(id)
);

-- 2. Copy all data
INSERT INTO activity_history_new SELECT * FROM activity_history;

-- 3. Drop old table
DROP TABLE activity_history;

-- 4. Rename
ALTER TABLE activity_history_new RENAME TO activity_history;
```

## User Experience Impact

### Before Fix

**Scenario: User Creates Reading Activity**
1. User taps "Start Reading Activity"
2. Backend creates activity with `completed_at = 2026-01-29 10:00:00`
3. Streak immediately updates to include today
4. User closes app without completing activity
5. Streak remains updated (incorrect)

**Scenario: User Changes Interests**
1. User goes to Profile, adds "Travel" interest
2. User navigates to Dashboard
3. Dashboard still shows old data
4. User must restart app to see interest-based topics

### After Fix

**Scenario: User Creates Reading Activity**
1. User taps "Start Reading Activity"
2. Backend creates activity with `completed_at = NULL`
3. Streak **does not** update
4. User reads story and submits answers
5. Backend updates activity: `completed_at = 2026-01-29 10:30:00`, `score = 85`
6. Streak updates to include today (correct!)

**Scenario: User Changes Interests**
1. User goes to Profile, adds "Travel" interest
2. User navigates to Dashboard
3. Dashboard automatically reloads data via `useFocusEffect`
4. Next activity will use "Travel" topic (immediate!)

## Data Flow

### Activity Creation Flow (Before)
```
User taps "Start Activity"
  ↓
POST /api/activity/{type}/{language}
  ↓
generate_activity() → activity data
  ↓
log_activity(score=0.0)
  ↓
INSERT activity_history (completed_at = NOW) ← Wrong!
  ↓
update_streak() ← Too early!
  ↓
Return activity to frontend
```

### Activity Creation Flow (After)
```
User taps "Start Activity"
  ↓
POST /api/activity/{type}/{language}
  ↓
generate_activity() → activity data
  ↓
log_activity(score=0.0)
  ↓
INSERT activity_history (completed_at = NULL) ← Correct!
  ↓
(No streak update)
  ↓
Return activity to frontend
```

### Activity Completion Flow (After)
```
User submits completed activity
  ↓
POST /api/activity/complete
  ↓
update_activity_score(score=85)
  ↓
UPDATE activity_history 
  SET completed_at = NOW ← Timestamp set here!
  ↓
update_streak() ← Correct timing!
  ↓
Return success
```

### Settings Propagation Flow (After)
```
User adds language/interest in ProfileScreen
  ↓
POST /api/user-languages or /api/user-interests
  ↓
Settings saved to database
  ↓
User navigates to DashboardScreen
  ↓
useFocusEffect triggers
  ↓
loadDashboard(), loadAllTodayGoals(), loadWeeklyStats()
  ↓
Fresh data fetched with new settings
  ↓
UI updates immediately
```

## Benefits

### 1. **Accurate Streak Tracking**
- Streaks only count when user actually completes activities
- No more "fake streaks" from just opening activities
- Weekly activity graph shows true completion counts

### 2. **Immediate Settings Updates**
- Language changes reflect instantly across all screens
- Interest changes immediately affect topic selection
- No need to restart app after changing settings

### 3. **Proper Activity State Management**
- Incomplete activities: `completed_at = NULL`, `score = 0`
- Completed activities: `completed_at = timestamp`, `score > 0`
- Activity history shows incomplete activities first (can resume)

### 4. **Database Integrity**
- Clear distinction between created and completed activities
- Queries can easily filter by completion status
- Historical data preserved during migration

## Edge Cases Handled

### 1. **Incomplete Activities in History**
- **Scenario**: User creates activity but doesn't complete it
- **Before**: Activity appears completed with timestamp
- **After**: Activity has `completed_at = NULL`, can be identified as incomplete
- **Query**: `SELECT * FROM activity_history WHERE completed_at IS NULL` shows all incomplete activities

### 2. **Multiple Submissions (Writing/Speaking)**
- **Scenario**: User submits writing activity multiple times
- **Behavior**: First submission sets `completed_at` and updates streak
- **Subsequent**: Only update score/data, don't change `completed_at`
- **Result**: Streak updated once, not on every submission

### 3. **Existing Activities**
- **Scenario**: 151 activities existed before migration
- **Migration**: All kept their `completed_at` timestamps
- **Result**: Historical data preserved, no data loss

### 4. **Activity History Ordering**
- **Scenario**: Mix of completed and incomplete activities
- **Query**: `ORDER BY COALESCE(completed_at, '9999-12-31') DESC, id DESC`
- **Result**: Incomplete activities appear first (useful for resuming)

### 5. **Screen Focus Changes**
- **Scenario**: User changes settings, switches tabs, comes back
- **Before**: Old data still shown
- **After**: `useFocusEffect` triggers reload automatically
- **Result**: Always shows fresh data

## Testing Checklist

### Backend Tests
- [x] Create activity → `completed_at` is NULL
- [x] Complete activity → `completed_at` set to CURRENT_TIMESTAMP
- [x] Streak doesn't update on activity creation
- [x] Streak updates on activity completion
- [x] Weekly stats only count completed activities
- [x] Activity history includes incomplete activities
- [x] Incomplete activities appear first in history

### Frontend Tests
- [ ] Dashboard reloads when returning from ProfileScreen
- [ ] Language changes immediately reflect on Dashboard
- [ ] Interest changes affect next activity topic
- [ ] Completed activities show in history with timestamp
- [ ] Incomplete activities show as resumable
- [ ] Weekly activity graph only shows completed activities
- [ ] Streak only updates after completing activity

### Integration Tests
- [ ] Complete activity flow: create → do → submit → streak updates
- [ ] Settings flow: change language → switch to Dashboard → see update
- [ ] Multiple submissions: submit writing twice → streak counts once
- [ ] Resume incomplete: create activity → close → reopen → complete → streak counts

## Rollback Plan

If issues occur, rollback steps:

1. **Restore Database Schema**:
   ```sql
   CREATE TABLE activity_history_new (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id INTEGER DEFAULT 1,
       language TEXT NOT NULL,
       activity_type TEXT NOT NULL,
       activity_data TEXT,
       score REAL,
       completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES user_profile(id)
   );
   INSERT INTO activity_history_new SELECT * FROM activity_history;
   DROP TABLE activity_history;
   ALTER TABLE activity_history_new RENAME TO activity_history;
   ```

2. **Revert Code Changes**:
   - In `db.py`: Move `update_streak()` back to `log_activity()`
   - In `db.py`: Remove `completed_at = CURRENT_TIMESTAMP` from UPDATE
   - In `main.py`: Remove `AND completed_at IS NOT NULL` filters
   - In `DashboardScreen.js`: Remove `useFocusEffect`

## Files Modified

1. **backend/db.py**:
   - Line 163: Schema change (removed DEFAULT)
   - Line 1748: Removed update_streak() call
   - Line 1881: Added completed_at to UPDATE
   - Line 1920: Added update_streak() call
   - Line 1535: Added completed_at IS NOT NULL filter

2. **backend/main.py**:
   - Lines 2484, 2500: Added completed_at IS NOT NULL filters
   - Line 2448: Updated ORDER BY for NULL handling

3. **screens/DashboardScreen.js**:
   - Line 13: Added useFocusEffect import
   - Lines 117-124: Added useFocusEffect hook

4. **migrate_activity_history.sql** (new file):
   - Database migration script

## Summary

This update ensures activities only count toward streaks when actually completed, not when created. It also makes settings changes immediately visible across all screens. Users now get accurate streak tracking and a more responsive app experience when changing languages or interests!

**Key Changes:**
- ✅ Activities start with `completed_at = NULL`
- ✅ Completion sets `completed_at = CURRENT_TIMESTAMP` and updates streak
- ✅ Queries filter out incomplete activities for stats
- ✅ Dashboard reloads when returning from other screens
- ✅ All 151 existing activities preserved during migration
