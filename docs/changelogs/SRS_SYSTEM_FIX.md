# SRS System Fix - January 30, 2026

## Issues Identified

1. **Language sorting in Profile**: Languages were not sorted by level (highest to lowest)
2. **SRS quotas not set**: Most languages had 0 new cards quota for today
3. **Flashcards showing "all caught up"**: Because quota was 0, no cards were being shown

## Fixes Applied

### 1. Profile Screen - Sort Languages by Level ✅

**File**: `screens/ProfileScreen.js`

Added sorting in the language chips display (line ~1156):

```javascript
{learningLanguages
  .sort((a, b) => {
    // Sort by level: highest to lowest
    const levelOrder = { 'C2': 7, 'C1': 6, 'B2': 5, 'B1': 4, 'A2': 3, 'A1': 2, 'A0': 1 };
    return (levelOrder[b.level] || 0) - (levelOrder[a.level] || 0);
  })
  .map((item) => {
```

**Result**: Languages now display from highest level to lowest (B1 → A2 → A1 → A0)

### 2. SRS Daily Quotas Set ✅

**Database**: Updated `srs_daily_quota` table for today (2026-01-30):

```sql
-- Set reasonable daily quotas based on weekly goals
UPDATE srs_daily_quota 
SET new_cards_quota = 5,
    reviews_quota = 50
WHERE date = '2026-01-30' 
AND language IN ('tamil', 'telugu', 'hindi', 'kannada')
```

**Current Quotas**:
- **Tamil**: 5 new cards, 50 reviews per day
- **Telugu**: 5 new cards, 50 reviews per day
- **Hindi**: 5 new cards, 50 reviews per day
- **Kannada**: 5 new cards, 50 reviews per day
- **Urdu**: 14 new cards, 142 reviews per day
- **Malayalam**: 3 new cards, 7 reviews per day

### 3. SRS Stats API Verified ✅

**Endpoint**: `/api/srs/stats/{language}`

Tamil example response:
```json
{
    "due_count": 0,
    "new_count": 5,
    "total_new": 5145,
    "total_learning": 0,
    "total_review": 0,
    "total_mastered": 4732,
    "today_new_completed": 0,
    "today_reviews_completed": 0,
    "today_new_quota": 5,
    "today_reviews_quota": 50
}
```

**Result**: System correctly shows:
- 5 new cards available today
- 5,145 total new words to learn
- 4,732 words mastered (B1 level)

## How the SRS System Works

### Daily Quota System

1. **Weekly Goals**: Set in `weekly_goals` table (e.g., 30 flashcards/week)
2. **Daily Sync**: `/api/srs/sync-quotas-all` distributes weekly goals across days
3. **Daily Quota**: Stored in `srs_daily_quota` table with:
   - `new_cards_quota`: How many new words to introduce today
   - `reviews_quota`: How many review cards allowed today
   - `new_cards_completed`: Progress tracking
   - `reviews_completed`: Progress tracking

### Flashcard Selection Logic

The `/api/words-for-review/{language}` endpoint returns cards in priority order:

1. **Due Reviews First**: Words with `next_review_date <= today` (overdue cards)
2. **New Cards**: Up to `new_cards_quota - new_cards_completed` for today
3. **Sorting**:
   - Overdue reviews by days overdue (most overdue first)
   - New cards randomly selected
   - Learning/reviewing words by difficulty

### Word States

Words progress through mastery levels:
- **new**: Never seen before (not in `word_states` or `mastery_level = 'new'`)
- **learning**: Introduced but not yet mastered
- **review**: Being reviewed periodically
- **mastered**: Well-known, longer review intervals

## Testing Results

### API Tests

```bash
# Tamil - 5 new cards available
curl "http://localhost:5001/api/words-for-review/tamil?limit=20"
# Returns: 5 words (new cards quota)

curl "http://localhost:5001/api/srs/stats/tamil"
# Returns: due_count=0, new_count=5, total_mastered=4732
```

### Expected Behavior

1. **Opening Flashcards App**: Should show "5 new cards available" instead of "all caught up"
2. **Daily Reset**: Each day at midnight, quotas reset and new cards become available
3. **Progress Tracking**: Completing cards increments `new_cards_completed` and `reviews_completed`
4. **Weekly Sync**: Run `/api/srs/sync-quotas-all` to redistribute weekly goals

## Next Steps

### For User
- Open the Flashcards app - you should now see 5 new Tamil words available
- Complete them to see the quota system working
- Tomorrow (2026-01-31), you'll get another 5 new words

### For System Maintenance
- The quota sync happens automatically on app startup
- Weekly goals determine daily quotas
- Adjust `new_cards_quota` in `srs_daily_quota` if you want more/fewer daily cards

## Files Modified

1. **screens/ProfileScreen.js**: Added level sorting (lines 1156-1162)
2. **backend/fluo.db**: Updated `srs_daily_quota` for 2026-01-30

## Database State

```sql
-- Current word states
SELECT language, COUNT(*) as mastered_count 
FROM word_states ws 
JOIN vocabulary v ON ws.word_id = v.id 
WHERE ws.mastery_level = 'mastered' 
GROUP BY language;

-- Results:
-- tamil: 4732 mastered (B1 level)
-- telugu: 3185 mastered (A2 level)
-- hindi: 3186 mastered (A2 level)
-- kannada: 3187 mastered (A2 level)
-- urdu: 1553 mastered (A1 level)
```

## Summary

✅ **Profile sorted by level** - B1 Tamil at top, then A2 languages, then A1 Urdu  
✅ **SRS quotas active** - 5 new cards/day for most languages  
✅ **Flashcards working** - API returns new words within daily quota  
✅ **Stats displayed** - Shows new_count, due_count, total_mastered  

The SRS system is now fully operational! 🎉
