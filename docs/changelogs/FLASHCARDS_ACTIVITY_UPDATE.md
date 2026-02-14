# Flashcards as Completable Activity

## Summary of Changes (January 29, 2026)

Added flashcards as a trackable and completable activity type that automatically logs when users finish their daily SRS review goals.

---

## Overview

**Feature**: Flashcards are now a tracked activity type that counts toward daily and weekly goals.

**Completion Criteria**: A flashcard activity is marked complete when BOTH conditions are met:
1. ✅ All new cards for the day are completed (`new_cards_completed >= new_cards_quota`)
2. ✅ All reviews for the day are completed (`reviews_completed >= reviews_quota`)

**Automatic Tracking**: The system automatically detects when daily flashcard goals are met and logs the activity without manual intervention.

---

## Changes Made

### 1. Frontend: Activity Type Added

**Files Modified**:
- `screens/ProfileScreen.js`
- `screens/DashboardScreen.js`
- `components/WeeklyGoalsSection.js`
- `components/WeeklyOverviewSection.js`

**Changes**:
```javascript
// Before
const ACTIVITIES = ['reading', 'listening', 'writing', 'speaking', 'conversation'];

// After
const ACTIVITIES = ['reading', 'listening', 'writing', 'speaking', 'conversation', 'flashcards'];
```

**Activity Color**:
```javascript
flashcards: { primary: '#EC4899', light: '#FCE7F3' },  // Pink theme
```

**Visual Design**:
- Primary color: Pink (#EC4899) - stands out from other activities
- Light background: Light pink (#FCE7F3) - consistent with other activity cards
- Icon: Will use existing card/deck icons in the UI

---

### 2. Backend: Completion Detection

**File**: `backend/db.py`

**New Function Added**: `check_and_log_flashcard_completion()`

**Location**: Lines ~1036-1105 (after `get_srs_stats()`)

**Function Signature**:
```python
def check_and_log_flashcard_completion(language: str, user_id: int = 1) -> bool:
    """Check if daily flashcard goal is met and log as activity if complete
    
    Returns True if flashcards were completed for the day, False otherwise
    """
```

**Logic Flow**:
```
1. Get today's quota (new cards and reviews)
2. Check if BOTH quotas are met:
   - new_cards_completed >= new_cards_quota
   - reviews_completed >= reviews_quota
3. If not complete → return False
4. Check if already logged today → return True (already done)
5. If complete and not logged:
   - Insert into activity_history (activity_type='flashcards', score=1.0)
   - Insert into daily_progress (count=1)
   - Print confirmation message
   - return True
```

**Data Stored**:
```json
{
  "new_completed": 10,
  "reviews_completed": 50
}
```
(Stored in `activity_data` field for reference)

---

### 3. Integration: Automatic Logging

**Trigger Points**: Function called automatically after every flashcard review

**Integration 1** - `update_word_state_from_flashcard()`:
```python
# After line ~2021 (after quota increment)
increment_daily_quota(language, is_new_card, user_id)

# Added:
check_and_log_flashcard_completion(language, user_id)
```

**Integration 2** - `update_word_state()`:
```python
# After line ~1906 (after commit)
conn.commit()
conn.close()

# Added:
check_and_log_flashcard_completion(language, user_id)
```

**Why Both Functions?**:
- `update_word_state_from_flashcard()`: Used by flashcard screen with corner-based feedback (easy/difficult/again)
- `update_word_state()`: Used by simplified review flows (correct/incorrect)
- Both can complete daily goals, so both trigger the check

---

## User Experience

### Dashboard View

**Before**:
```
📚 ಕನ್ನಡ Activities Today
✓ Reading (2/2)
✓ Listening (1/1)
○ Writing (0/1)
```

**After**:
```
📚 ಕನ್ನಡ Activities Today
✓ Reading (2/2)
✓ Listening (1/1)
○ Writing (0/1)
✓ Flashcards (1/1)  ← New!
```

### Weekly Goals

Users can now set weekly flashcard goals:
- **Mon**: 1 flashcard session
- **Tue**: 1 flashcard session
- **Wed**: 1 flashcard session
- etc.

Each day's goal is automatically marked complete when SRS quota is met.

### Weekly Overview

Shows historical flashcard completion:
```
Mon  1/27  [Today]  3/4 ✓
  ┌────────────────────────┐
  │ ✓ Flashcards          │  ← Shows in expanded view
  │ ✓ Reading             │
  │ ✓ Listening           │
  └────────────────────────┘
```

### Profile Stats

**Learning Progress Graph**:
- Flashcard activities now contribute to the activity count heatmap
- Each completed day adds to the contribution graph

**Activity Breakdown**:
- Shows flashcard completion rate alongside other activities

---

## Technical Details

### Database Schema

**No schema changes required** - uses existing tables:

1. **activity_history**:
   ```sql
   INSERT INTO activity_history 
   (user_id, language, activity_type, activity_data, score, completed_at)
   VALUES 
   (1, 'kannada', 'flashcards', '{"new_completed":10,"reviews_completed":50}', 1.0, '2026-01-29 10:30:00')
   ```

2. **daily_progress**:
   ```sql
   INSERT INTO daily_progress 
   (user_id, language, activity_type, date, count)
   VALUES 
   (1, 'kannada', 'flashcards', '2026-01-29', 1)
   ```

### Completion Logic

**Quota Check**:
```python
quota = get_daily_quota(language, today, user_id)
# Returns: {
#   'new_cards_quota': 10,
#   'new_cards_completed': 10,
#   'reviews_quota': 50,
#   'reviews_completed': 50
# }

new_cards_complete = 10 >= 10  # True
reviews_complete = 50 >= 50    # True
both_complete = True           # Both must be True
```

**Idempotency**:
- Checks `daily_progress` table before inserting
- If already logged for today, returns `True` without re-inserting
- Prevents duplicate activity logging

**Error Handling**:
- Wrapped in try-except block
- Prints error with traceback if failure occurs
- Returns `False` on error (doesn't crash the review flow)

---

## Testing Checklist

### Basic Functionality
- [ ] Review 1 flashcard → check not yet complete (if quota not met)
- [ ] Complete all new cards → check still not complete (if reviews remain)
- [ ] Complete all reviews → check activity logged ✓
- [ ] Check `activity_history` table for flashcard entry
- [ ] Check `daily_progress` table for count increment

### Multi-Language Testing
- [ ] Complete flashcards for Kannada → check logged for Kannada only
- [ ] Complete flashcards for Hindi → check logged for Hindi only
- [ ] Check both languages show separately in weekly overview

### UI Display Testing
- [ ] Dashboard shows flashcard icon and count
- [ ] Weekly Goals shows flashcard as option
- [ ] Weekly Overview shows completed flashcard activities
- [ ] Profile Progress graph includes flashcard activities
- [ ] Activity colors display correctly (pink theme)

### Edge Cases
- [ ] Complete flashcards twice in one day → only logs once
- [ ] Review after already complete → doesn't re-log
- [ ] Zero quota (new_cards=0, reviews=0) → check if logs correctly
- [ ] Incomplete quota (50% done) → check not logged yet
- [ ] Mix of languages → each tracked independently

### Integration Testing
- [ ] Flashcard completion appears in contribution graph
- [ ] Weekly goals properly track flashcard completion
- [ ] Historical data shows flashcard activities
- [ ] Activity filter includes flashcards option

---

## Benefits

### For Users

1. **Automatic Tracking**: No need to manually mark flashcard sessions as complete
2. **Visual Progress**: See flashcard completion in weekly views and graphs
3. **Motivation**: Completing daily flashcard quota counts as an achievement
4. **Goal Setting**: Can set weekly flashcard targets like other activities
5. **Consistency**: Works exactly like other activity types (reading, listening, etc.)

### For Developers

1. **Clean Integration**: Uses existing activity tracking infrastructure
2. **No Breaking Changes**: Doesn't modify existing database schema
3. **Idempotent**: Safe to call multiple times, won't create duplicates
4. **Self-Contained**: Logic encapsulated in single function
5. **Observable**: Prints confirmation when flashcard activity logged

---

## Implementation Notes

### Why Auto-Complete?

Flashcards are different from other activities:
- **Reading/Listening**: User explicitly completes an activity screen
- **Writing/Speaking**: User submits and receives feedback
- **Conversation**: User finishes a conversation session
- **Flashcards**: Continuous reviews throughout the day

Auto-completion ensures:
- Users don't need extra step after finishing reviews
- Quota system directly determines completion
- Consistent with SRS philosophy (daily goal-oriented)

### Quota vs Activity Completion

**Quota System** (SRS-specific):
- Tracks how many new/review cards done today
- Used for pacing word introduction
- Resets daily based on weekly settings

**Activity System** (Goal-tracking):
- Tracks activity completion for weekly goals
- Used for progress visualization
- Contributes to habit building

Flashcards bridge both systems:
- Meeting quota → Activity complete
- Activity complete → Weekly goal progress

---

## Future Enhancements (Optional)

### Potential Improvements

1. **Partial Credit**:
   - Currently: All-or-nothing (both quotas must be met)
   - Future: Partial completion percentage shown in UI

2. **Streak Tracking**:
   - Track consecutive days of flashcard completion
   - Show streak badge in profile

3. **Time-of-Day Analytics**:
   - When do users typically complete flashcards?
   - Suggest optimal review times

4. **Custom Quotas**:
   - Let users set per-day flashcard goals (not just weekly average)
   - Weekend vs weekday quotas

5. **Completion Notification**:
   - Show toast/banner when daily flashcard goal is met
   - Celebrate the achievement in-app

6. **Flashcard-Specific Stats**:
   - Average review time per card
   - Success rate (easy vs difficult ratings)
   - Retention curve visualization

---

## Related Features

This update complements existing features:

- ✅ **SRS System**: Flashcard completion built on existing SRS quota system
- ✅ **Weekly Goals**: Flashcards now appear in weekly goal setting
- ✅ **Weekly Overview**: Historical flashcard completion tracked
- ✅ **Learning Progress**: Flashcard activities contribute to contribution graph
- ✅ **Dashboard**: Flashcard status visible alongside other activities
- ✅ **Activity History**: Full log of flashcard sessions in database

---

## Files Modified Summary

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `screens/ProfileScreen.js` | 2 lines | Add 'flashcards' to ACTIVITIES and ACTIVITY_COLORS |
| `screens/DashboardScreen.js` | 2 lines | Add 'flashcards' to ACTIVITY_ORDER and ACTIVITY_COLORS |
| `components/WeeklyGoalsSection.js` | 1 line | Add 'flashcards' to ACTIVITIES array |
| `components/WeeklyOverviewSection.js` | 1 line | Add flashcard color to ACTIVITY_COLORS |
| `backend/db.py` | ~70 lines | New function + 2 integration calls |

**Total**: ~76 lines added across 5 files

---

## Console Output Example

When flashcards are completed:

```
[SRS] Updated word 1234: review, ease=2.65, next=2026-02-05, new=False
✓ Flashcard activity logged for kannada on 2026-01-29
```

When quota not yet met:

```
[SRS] Updated word 1234: learning, ease=2.30, next=2026-01-30, new=True
(No flashcard log - quota incomplete)
```

When already logged today:

```
[SRS] Updated word 1235: mastered, ease=2.80, next=2026-02-12, new=False
(No flashcard log - already completed today)
```

---

## API Compatibility

**No API changes required**:
- Uses existing `log_activity()` infrastructure
- Works with current frontend activity fetching
- Compatible with existing weekly goal endpoints
- No migration needed for existing data

---

**Status**: ✅ **Fully Implemented and Ready for Testing**

**Date**: January 29, 2026

**Developer**: GitHub Copilot
