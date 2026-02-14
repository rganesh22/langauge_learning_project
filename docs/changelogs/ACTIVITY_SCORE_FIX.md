# Activity Score Update Issue - Fix Documentation

## Problem Description
Activity completion percentages are not being displayed on the Activity History Screen because scores are not being saved to the database when activities are completed.

## Root Cause
After the activity refactoring (REFACTORING_COMPLETE.md), the new activity components (ReadingActivity.js, ListeningActivity.js, etc.) calculate scores locally but **do not call the backend API to save the score**.

### Evidence from Database
```sql
SELECT id, language, activity_type, ROUND(score * 100) as percentage 
FROM activity_history 
WHERE user_id = 1 AND score IS NOT NULL 
ORDER BY id DESC LIMIT 10;

-- Result: All scores are 0.0%
181|malayalam|listening|0.0
180|tamil|listening|0.0
179|tamil|listening|0.0
178|tamil|listening|0.0
```

### What Happens Currently

**Reading/Listening Activities:**
1. User submits answers
2. `handleSubmit()` calculates score locally
3. `setScore(finalScore)` updates local state
4. `setShowResult(true)` shows results
5. ❌ **MISSING**: No call to `/api/activity/complete`

**Current Code (ReadingActivity.js, line 174-192):**
```javascript
const handleSubmit = () => {
  // ... calculate score ...
  const finalScore = correctAnswers / activityData.activity.questions.length;
  
  setScore(finalScore);  // Only local state update
  setShowResult(true);   // Show results UI
  // ❌ Missing: No backend API call to save score
};
```

### What Should Happen

Activities need to call `/api/activity/complete` with:
- `language`: Current language
- `activity_type`: 'reading', 'listening', etc.
- `score`: Calculated score (0-1 range)
- `word_updates`: Array of word state updates
- `activity_data`: Full activity data
- `activity_id`: Activity ID (from sessionId or activityData.id)

## Solution

Each activity component needs to call a completion function that submits the score to the backend.

### Option 1: Add `onComplete` Callback (Recommended)
Modify each activity component to accept and call an `onComplete` callback:

```javascript
// In ReadingActivity.js
const handleSubmit = () => {
  // Calculate score...
  const finalScore = correctAnswers / activityData.activity.questions.length;
  
  setScore(finalScore);
  setShowResult(true);
  
  // NEW: Call completion callback
  if (onComplete) {
    const wordUpdates = (activityData.activity._words_used_data || []).map(word => ({
      word_id: word.id,
      correct: finalScore > 0.5
    }));
    
    onComplete({
      score: finalScore,
      wordUpdates,
      activityData: activityData.activity
    });
  }
};
```

Then in the parent (ActivityScreen.js), pass the `onComplete` handler:

```javascript
<ReadingActivity
  language={language}
  onComplete={async (data) => {
    await fetch(`${API_BASE_URL}/api/activity/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        activity_type: 'reading',
        score: data.score,
        word_updates: data.wordUpdates,
        activity_data: data.activityData,
        activity_id: activityData.sessionId || activityData.id
      })
    });
  }}
/>
```

### Option 2: Use Shared Hook
Create a `useActivityCompletion` hook in `screens/activities/shared/hooks/`:

```javascript
// useActivityCompletion.js
export function useActivityCompletion(language, activityType) {
  const complete = async ({ score, wordUpdates, activityData, activityId }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/activity/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          activity_type: activityType,
          score,
          word_updates: wordUpdates || [],
          activity_data: activityData,
          activity_id: activityId
        })
      });
      
      if (!response.ok) {
        console.error('Failed to save activity completion');
      } else {
        console.log(`✓ Activity ${activityType} completed with score ${Math.round(score * 100)}%`);
      }
    } catch (error) {
      console.error('Error completing activity:', error);
    }
  };
  
  return { complete };
}
```

Then use in each activity:

```javascript
// In ReadingActivity.js
const { complete } = useActivityCompletion(language, 'reading');

const handleSubmit = async () => {
  // Calculate score...
  const finalScore = correctAnswers / activityData.activity.questions.length;
  
  setScore(finalScore);
  setShowResult(true);
  
  // Save to backend
  await complete({
    score: finalScore,
    wordUpdates: (activityData.activity._words_used_data || []).map(word => ({
      word_id: word.id,
      correct: finalScore > 0.5
    })),
    activityData: activityData.activity,
    activityId: activityData.sessionId || activityData.id
  });
};
```

## Files That Need Updates

1. **`screens/activities/ReadingActivity.js`** - Line 174 (`handleSubmit`)
2. **`screens/activities/ListeningActivity.js`** - Line 556 (`handleSubmit`)
3. **`screens/activities/WritingActivity.js`** - Line 289 (`handleSubmit`) - Already has grading, just needs completion call
4. **`screens/activities/SpeakingActivity.js`** - Line 579 (`handleSubmit`) - Already has grading, just needs completion call
5. **`screens/activities/ConversationActivity.js`** - Needs to be checked for rating submission

## Testing Checklist

After implementing the fix:

- [ ] Complete a reading activity → Check score appears in history screen
- [ ] Complete a listening activity → Check score appears in history screen
- [ ] Complete a writing activity → Check score appears in history screen
- [ ] Complete a speaking activity → Check score appears in history screen
- [ ] Verify database: `SELECT * FROM activity_history ORDER BY id DESC LIMIT 5` shows non-zero scores
- [ ] Verify history screen displays percentages correctly
- [ ] Verify word states are updated (SRS)

## Backend Verification

The backend endpoint `/api/activity/complete` (main.py:2126) is already working correctly:
- ✓ Accepts score, word_updates, activity_data
- ✓ Updates word states via SRS
- ✓ Calls `db.update_activity_score()` to save score
- ✓ Updates daily progress and streaks

The issue is purely on the **frontend** - activities calculate scores but don't submit them.

## Priority
**HIGH** - This is a core feature that affects user experience and progress tracking. Without scores being saved:
- Users can't see their performance history
- Progress tracking is broken
- Gamification/motivation features don't work

## Recommendation
Implement **Option 2 (Shared Hook)** as it:
- Reduces code duplication
- Makes completion logic consistent across all activities
- Easier to maintain and update
- Can add additional logic (analytics, offline support) in one place
