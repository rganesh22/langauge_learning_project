# Goal-Based Streak & SRS Configuration Update

## Overview
This document outlines the changes made to implement:
1. **Goal-based streak tracking** - Streak only continues if ALL daily goals are met
2. **Revamped SRS configuration UI** - Per-language settings for new cards and reviews per week

## Backend Changes

### 1. New Streak Calculation (`backend/db.py`)

**Function**: `calculate_goal_based_streak(user_id=1)`

**Logic**:
- Checks backwards from today up to 365 days
- For each day, verifies if ALL goals were met (activity count >= target count)
- If no goals set for a day, it doesn't break the streak
- Returns:
  - `current_streak`: Consecutive days (including today) where all goals met
  - `longest_streak`: Longest streak ever achieved
  - `today_complete`: Boolean indicating if today's goals are done

**Key Features**:
- Queries `weekly_goals` table for targets
- Queries `activity_history` for completed activities (score > 0)
- Handles days with no goals gracefully

### 2. API Endpoint (`backend/main.py`)

**New Endpoint**: `GET /api/streak`

Returns:
```json
{
  "current_streak": 5,
  "longest_streak": 12,
  "today_complete": true
}
```

### 3. Existing SRS Endpoints (Already Implemented)

- `GET /api/srs/settings/{language}` - Get SRS settings for a language
- `PUT /api/srs/settings/{language}` - Update SRS settings
  - Body: `{ "new_cards_per_week": int, "reviews_per_week": int }`
  - Validates: reviews >= new_cards * 10

## Frontend Changes (`screens/ProfileScreen.js`)

### 1. Streak Display Update

**Current**: Shows `profile.streak` from database

**New**: 
- Fetch from `/api/streak` endpoint
- Display current streak with visual indicator
- Show "Today Complete ✓" badge if goals are done
- Show longest streak in a separate chip

### 2. SRS Configuration UI Revamp

**Remove**:
- Old "Learning Load" presets (Light, Moderate, Intense, Custom)
- Old "Lapse Penalty" settings
- Difficulty slider (1-10)

**Add**:
- **Per-language SRS settings**:
  - New Cards Per Week (editable number input)
  - Reviews Per Week (editable number input with minimum validation)
- **Visual previews**:
  - Daily new cards estimate (divide by 7)
  - Daily reviews estimate (divide by 7)
- **Real-time SRS stats** (from existing endpoint):
  - Words in learning
  - Words mastered
  - Today's due reviews
  - Upcoming reviews (next 7 days)

**Validation**:
- Reviews must be >= 10x new cards
- Show inline error if validation fails
- Disable save button until valid

## UI Design

### Streak Section
```
┌─────────────────────────────────────┐
│  🔥 5 Day Streak                    │
│  ✓ Today Complete                   │
│                                     │
│  🏆 Longest: 12 days                │
└─────────────────────────────────────┘
```

### SRS Settings (Per Language)
```
┌─────────────────────────────────────┐
│  ⚙️ Spaced Repetition Settings      │
│  Language: Kannada ▼                │
│                                     │
│  New Cards Per Week                 │
│  [ 35 ] words  (≈5/day)            │
│  ─────────────────────────          │
│                                     │
│  Reviews Per Week                   │
│  [ 350 ] reviews (≈50/day)         │
│  ℹ️ Must be ≥ 10x new cards        │
│  ─────────────────────────          │
│                                     │
│  Current Stats:                     │
│  • Learning: 48 words               │
│  • Mastered: 125 words              │
│  • Due today: 12 reviews            │
│  • Due next 7 days: 78 reviews      │
│                                     │
│  [ Save Settings ]                  │
└─────────────────────────────────────┘
```

## Migration Notes

1. **Backward Compatibility**: Old `update_streak()` function kept but deprecated
2. **No Data Migration Needed**: Streak calculated on-demand from existing data
3. **SRS Settings**: Already stored per-language in `srs_settings` table

## Testing Checklist

- [ ] Test streak calculation with various goal configurations
- [ ] Test streak resets when goals not met
- [ ] Test streak continues when no goals set for a day
- [ ] Test SRS settings load correctly for each language
- [ ] Test SRS settings validation (reviews >= 10x new cards)
- [ ] Test SRS settings save and recalculate quotas
- [ ] Test UI updates when switching languages
- [ ] Test "Today Complete" indicator updates in real-time

## Files Modified

1. `backend/db.py` - Added `calculate_goal_based_streak()`, `get_week_start()`
2. `backend/main.py` - Added `GET /api/streak` endpoint
3. `screens/ProfileScreen.js` - TO BE UPDATED with new UI

## Next Steps

1. Update ProfileScreen.js to fetch and display goal-based streak
2. Revamp SRS configuration UI section
3. Test thoroughly with real data
4. Document user-facing changes
