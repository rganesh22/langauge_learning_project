# Flashcard SRS State Display & Interval Timing Fix

## Changes Made (January 30, 2026)

### 1. Fixed Time Estimates Not Showing on First Card

**Problem**: When opening the flashcard screen, the time estimates (10min, 1d, etc.) wouldn't show on the corners until the second card or after some delay.

**Root Cause**: The `fetchNextReviewIntervals()` function was called in a `useEffect` hook, but there was a timing issue where the intervals weren't loaded before the first card rendered.

**Solution**:
- Modified `loadWords()` to fetch intervals for the first card immediately after loading words
- Enhanced the `useEffect` to properly clear intervals when no word is present
- This ensures intervals are available before the first card renders

**Code Changes** (screens/FlashcardScreen.js):
```javascript
// In loadWords() function - fetch intervals for first card
if (sortedWords.length > 0) {
  await fetchNextReviewIntervals(sortedWords[0]);
}

// In useEffect - clear intervals when no word
useEffect(() => {
  if (currentWord) {
    fetchNextReviewIntervals(currentWord);
  } else {
    setNextReviewIntervals(null);
  }
}, [currentWord, fetchNextReviewIntervals]);
```

### 2. Added SRS State Display on Flashcards

**Problem**: Users couldn't see what SRS state a word was in while reviewing it.

**Solution**: Added a badge at the top-left of each flashcard showing:
- **SRS State**: New, Learning, Reviewing, or Mastered
- **Review Count**: Number of times the word has been reviewed (if > 0)
- **Color Coding**:
  - 🟢 Green = Mastered
  - 🔵 Blue = Reviewing
  - 🟡 Orange = Learning
  - ⚪ Gray = New

**Implementation**:
- Badge appears on both front and back of card
- Uses data from `word_states` table: `mastery_level` and `review_count`
- Positioned at top-left corner with rounded background
- Color-coded dot indicator for quick visual identification

**Code Changes** (screens/FlashcardScreen.js):
```javascript
{/* SRS State Badge */}
{currentWord && (
  <View style={styles.srsStateBadge}>
    <View style={[
      styles.srsStateIndicator,
      { backgroundColor: 
        currentWord.mastery_level === 'mastered' ? '#10B981' :
        currentWord.mastery_level === 'reviewing' ? '#3B82F6' :
        currentWord.mastery_level === 'learning' ? '#F59E0B' :
        '#9CA3AF' // new
      }
    ]} />
    <SafeText style={styles.srsStateText}>
      {currentWord.mastery_level === 'mastered' ? 'Mastered' :
       currentWord.mastery_level === 'reviewing' ? 'Reviewing' :
       currentWord.mastery_level === 'learning' ? 'Learning' :
       'New'}
      {currentWord.review_count > 0 && ` • ${currentWord.review_count} reviews`}
    </SafeText>
  </View>
)}
```

### 3. New Styles Added

```javascript
srsStateBadge: {
  position: 'absolute',
  top: 12,
  left: 12,
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F3F4F6',
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 12,
},
srsStateIndicator: {
  width: 8,
  height: 8,
  borderRadius: 4,
  marginRight: 6,
},
srsStateText: {
  fontSize: 12,
  color: '#4B5563',
  fontWeight: '500',
},
```

## User Experience Improvements

### Before:
- ❌ Time estimates missing on first card
- ❌ No visibility into SRS state during review
- ❌ Couldn't tell if word was new or being reviewed

### After:
- ✅ Time estimates show immediately on first card
- ✅ Clear SRS state badge on every card
- ✅ Color-coded indicators for quick identification
- ✅ Review count visible for tracking progress

## Example Display

```
┌─────────────────────────────┐
│ 🟡 Learning • 3 reviews     │ ← SRS State Badge
│                             │
│           WORD              │
│                             │
│        வணக்கம்              │
│                             │
│      (Tap to reveal)        │
│                             │
└─────────────────────────────┘

Easy (எளிது)        Good (நல்லது)
   1d                   4d

Again (மீண்டும்)     Hard (கடினம்)
   10min                1d
```

## Technical Details

### Data Source
- SRS state comes from `word_states` table in database
- Backend endpoint `/api/words-for-review/` includes these fields:
  - `mastery_level`: 'new', 'learning', 'reviewing', 'mastered'
  - `review_count`: Integer count of reviews
  - `next_review_date`: When word is due for next review
  - `ease_factor`: SRS ease factor for interval calculation

### Performance
- Intervals fetched asynchronously to avoid blocking
- Badge rendered only when `currentWord` exists
- No additional API calls required (data already in word object)

## Testing Checklist

- [x] Time estimates show on first card
- [x] SRS state badge appears on front of card
- [x] SRS state badge appears on back of card
- [x] Color coding matches mastery level
- [x] Review count displays when > 0
- [x] Badge doesn't interfere with card flipping
- [x] Badge visible on all mastery levels
- [x] Badge styling consistent with app design

## Related Files
- `screens/FlashcardScreen.js` - Main implementation
- `backend/db.py` - SRS data source (get_words_for_review)
- `backend/main.py` - API endpoint

## Future Enhancements
- Add animation when mastery level changes
- Show streak information on badge
- Add tooltip explaining mastery levels
- Display next review date on badge
