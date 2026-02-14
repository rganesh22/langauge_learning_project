# Clickable Activity Bars & Flashcard "Again" Re-queue Implementation

**Date**: January 31, 2025  
**Features**: Interactive daily activity modal + Flashcard re-queue on "Again"

## Overview

Implemented two major UX improvements:

1. **Clickable Daily Activity Bars**: Users can now click on any day's activity bar in the weekly stats to see a detailed modal of all activities completed that day
2. **Flashcard "Again" Re-queue**: When users swipe "Again" (bottom-right) on a flashcard, it now immediately re-queues the card 5-10 positions ahead instead of just moving to the next card

---

## 1. Clickable Daily Activity Bars

### Frontend Implementation (DashboardScreen.js)

#### State Management (Lines ~60-64)
```javascript
const [selectedDayActivities, setSelectedDayActivities] = useState(null);
const [showDayActivitiesModal, setShowDayActivitiesModal] = useState(false);
const [loadingDayActivities, setLoadingDayActivities] = useState(false);
```

#### Modal Management Functions (Lines ~236-271)

**loadDayActivities(date)**
- Fetches activities for a specific date from `/api/daily-activities?date={date}`
- Sets loading state during fetch
- Updates `selectedDayActivities` state with response data
- Includes error handling with console logging

**openDayActivities(date, activityCount)**
- Only opens modal if `activityCount > 0`
- Calls `loadDayActivities(date)` to fetch data
- Sets `showDayActivitiesModal` to true

**closeDayActivitiesModal()**
- Resets modal state
- Clears selected activities
- Hides modal

**openHistoricalActivity(activityId, activityType)**
- Navigates to Activity screen with historical activity data
- Passes `activityId` and `activityType` as route params
- Uses `navigation.navigate('Activity', { ... })`

#### Interactive Bar Component (Lines ~439-469)

Changed from `<View>` to `<TouchableOpacity>`:
```javascript
<TouchableOpacity
  key={day.date}
  style={styles.barColumn}
  onPress={() => openDayActivities(day.date, day.activities)}
  disabled={day.activities === 0}
  activeOpacity={0.7}
>
  {/* Bar content */}
</TouchableOpacity>
```

**Key Features**:
- `disabled={day.activities === 0}`: Bars with no activities don't respond to clicks
- `activeOpacity={0.7}`: Visual feedback on press
- `onPress` handler passes date and activity count

#### Modal UI Component (Lines ~677-770)

**Modal Structure**:
- Transparent overlay with fade animation
- Centered modal content (90% width, max 500px, max 80% height)
- Header with formatted date and close button
- Scrollable activity list or empty state

**Activity Card Design**:
- Icon with colored background (matches activity type)
- Activity title (capitalized type + "Activity")
- Timestamp (formatted as "3:45 PM")
- Score (if available from activity_data)
- Chevron icon for navigation hint
- Color-coded left border matching activity type

**Activity Type Colors**:
```javascript
const activityColors = {
  reading: { primary: '#4A90E2', light: '#E3F2FD' },
  listening: { primary: '#9C27B0', light: '#F3E5F5' },
  writing: { primary: '#FF9800', light: '#FFF3E0' },
  speaking: { primary: '#F44336', light: '#FFEBEE' },
  translation: { primary: '#009688', light: '#E0F2F1' },
  conversation: { primary: '#8BC34A', light: '#F1F8E9' },
  flashcard: { primary: '#5D8EDC', light: '#E8F4FD' },
};
```

**Loading State**:
- Shows ActivityIndicator while `loadingDayActivities` is true
- Blue spinner (#4A90E2)

**Empty State**:
- Calendar icon (48px, gray)
- "No activities completed this day" message

#### Styles Added (Lines ~1215-1308)

**Modal Styles**:
- `modalOverlay`: Dark semi-transparent background (rgba(0,0,0,0.5))
- `modalContent`: White rounded card with shadow
- `modalHeader`: Title bar with close button
- `modalScrollView`: Scrollable content area
- `modalLoadingContainer` / `modalEmptyContainer`: Centered states

**Activity Card Styles**:
- `activityCard`: White card with left border, shadow, rounded corners
- `activityCardContent`: Row layout with icon, info, chevron
- `activityCardTitle`: Bold black text (16px)
- `activityCardTime`: Gray text (14px)
- `activityCardScore`: Blue text (12px)

### Backend Implementation (main.py)

#### New Endpoint (Lines ~3363-3420)

```python
@app.get("/api/daily-activities")
def get_daily_activities(date: str):
    """Get all activities completed on a specific date
    
    Args:
        date: Date in YYYY-MM-DD format
        
    Returns:
        List of activities with id, activity_type, language, timestamp, score
    """
```

**Query Logic**:
- Fetches from `activity_history` table
- Filters by `user_id = 1` and `DATE(completed_at) = date`
- Orders by `completed_at DESC` (most recent first)
- Returns: `id`, `activity_type`, `language`, `timestamp`

**Score Extraction**:
- Parses `activity_data` JSON field
- Looks for `final_score` or `score` keys
- Includes in response if available

**Response Format**:
```json
{
  "date": "2025-01-31",
  "activities": [
    {
      "id": 123,
      "activity_type": "reading",
      "language": "kannada",
      "timestamp": "2025-01-31 14:30:00",
      "score": 85
    }
  ]
}
```

---

## 2. Flashcard "Again" Re-queue

### Implementation (FlashcardScreen.js)

#### Detection Flag (Line ~912-913)
```javascript
const comfortLevel = COMFORT_LEVELS[corner];
const isAgainSwipe = corner === 'bottom-right'; // "Again" button
```

#### Re-queue Logic (Lines ~938-960)

**After SRS Update**:
```javascript
if (isAgainSwipe) {
  // Calculate position to re-insert (5-10 cards ahead, but not past end)
  const reinsertPosition = Math.min(
    prevIndex + 5 + Math.floor(Math.random() * 5), 
    updatedWords.length
  );
  
  // Create a copy of the current card
  const cardToRequeue = {
    ...updatedWords[prevIndex],
    isRequeued: true, // Mark for tracking
  };
  
  // Insert the card at the calculated position
  updatedWords.splice(reinsertPosition, 0, cardToRequeue);
  
  console.log(`[Again] Re-queued card "${cardToRequeue.english_word}" at position ${reinsertPosition}`);
}
```

**Key Features**:
- **Random Position**: Re-inserts 5-10 cards ahead (prevents predictable patterns)
- **Bounds Checking**: `Math.min()` ensures position doesn't exceed array length
- **Card Marking**: `isRequeued: true` flag for future tracking/analytics
- **Preserved State**: All card properties (flip state, mastery level) are copied

**User Experience Flow**:
1. User swipes card to bottom-right ("Again")
2. Card animates away as usual
3. Backend updates SRS with "again" comfort level
4. Card is immediately copied and inserted 5-10 positions ahead
5. User continues reviewing and will encounter the card again soon
6. Card appears with same front/back content but updated mastery level

**Why 5-10 Cards?**
- Too soon (1-2): Feels repetitive, may frustrate user
- Too late (20+): User may forget context, defeats purpose of "again"
- 5-10: Sweet spot for reinforcement without annoyance

---

## Testing Checklist

### Clickable Bars
- [ ] Click bar with activities > 0 → Modal opens
- [ ] Click bar with activities = 0 → No action (disabled)
- [ ] Modal shows correct date in header
- [ ] Activities are sorted by time (most recent first)
- [ ] Activity icons match activity types
- [ ] Scores are displayed when available
- [ ] Close button dismisses modal
- [ ] Click activity card → Opens historical Activity screen
- [ ] Loading spinner shows during fetch
- [ ] Empty state shows for days with no completed activities

### "Again" Re-queue
- [ ] Swipe card to bottom-right ("Again")
- [ ] Card animates away normally
- [ ] Continue reviewing 5-10 more cards
- [ ] Original card reappears in queue
- [ ] Card shows same content (word, translation, example)
- [ ] Card has updated mastery level from first review
- [ ] Console log shows re-queue message with position
- [ ] Multiple "Again" swipes on same card create multiple copies
- [ ] Daily goal counter doesn't double-count requeued cards

### Integration
- [ ] Backend `/api/daily-activities` endpoint returns data
- [ ] Backend endpoint handles invalid dates gracefully
- [ ] Modal activity cards navigate to correct historical activities
- [ ] Flashcard "Again" behavior doesn't break normal flow
- [ ] All other swipe directions (Easy, Good, Hard) work unchanged

---

## Technical Notes

### Database Schema Used
```sql
-- activity_history table structure
CREATE TABLE activity_history (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  activity_type TEXT,  -- 'reading', 'listening', etc.
  language TEXT,
  completed_at TIMESTAMP,
  activity_data TEXT  -- JSON string with scores, questions, etc.
);
```

### API Contract

**Request**: `GET /api/daily-activities?date=2025-01-31`

**Response**:
```json
{
  "date": "2025-01-31",
  "activities": [
    {
      "id": 123,
      "activity_type": "reading",
      "language": "kannada",
      "timestamp": "2025-01-31 14:30:00",
      "score": 85  // Optional, from activity_data JSON
    }
  ]
}
```

### State Management Patterns

**Modal State**:
- `showModal` (boolean): Controls visibility
- `selectedData` (object | null): Stores fetched data
- `loading` (boolean): Tracks async operation

**Flashcard Re-queue**:
- Uses `setWords()` state updater with functional update pattern
- `splice()` to insert at specific position
- Preserves immutability with spread operator

---

## Future Enhancements

### Clickable Bars
1. **Filtering**: Filter activities by type (show only reading, etc.)
2. **Language Grouping**: Group activities by language in modal
3. **Statistics**: Show total time spent, avg score for the day
4. **Animations**: Smooth slide-in animation for modal
5. **Infinite Scroll**: Load more historical activities if many exist

### "Again" Re-queue
1. **Smart Positioning**: Use SRS algorithm to calculate optimal position
2. **Visual Indicator**: Show "📌 Re-queued" badge on card when it reappears
3. **Limit Re-queues**: Prevent infinite re-queuing of same card
4. **Analytics**: Track how often users press "Again" per language/level
5. **Alternative Formats**: Show different example sentence on re-queue

---

## Files Modified

### Frontend
1. **screens/DashboardScreen.js**
   - Added modal state management
   - Added clickable TouchableOpacity wrapper on bars
   - Created modal UI with activity cards
   - Added modal styles
   - Lines changed: ~200 additions

### Backend
1. **backend/main.py**
   - Added `/api/daily-activities` endpoint
   - Queries `activity_history` table
   - Extracts scores from JSON activity_data
   - Lines changed: ~60 additions

### Flashcard Logic
1. **screens/FlashcardScreen.js**
   - Added "Again" detection flag
   - Implemented card re-queue logic with random positioning
   - Added console logging for debugging
   - Lines changed: ~25 modifications

---

## Related Documentation
- See `FLASHCARD_SRS_COMPLETE.md` for SRS algorithm details
- See `DASHBOARD_WEEKLY_GOALS_UPDATE.md` for weekly stats implementation
- See `FLASHCARD_FINAL_UX_UPDATE.md` for other flashcard UI improvements

## Summary

Both features are now fully implemented and ready for testing:

1. **Clickable Activity Bars**: Users can explore their daily activity history with a beautiful modal interface
2. **Flashcard "Again" Re-queue**: Cards marked as "Again" reappear shortly after for reinforcement learning

These improvements enhance the app's interactivity and learning effectiveness without disrupting existing workflows.
