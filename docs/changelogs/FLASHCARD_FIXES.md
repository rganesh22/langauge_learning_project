# Flashcard Screen Fixes

## Summary of Issues Fixed (January 30, 2026)

### 1. ✅ Card Getting Stuck After Second Card
**Problem**: After swiping from card 1 → card 2, pressing the number keys (1-4) didn't advance to the next card. The flashcard would get stuck on card 2.

**Root Cause**: The `handleSwipe` callback was using a stale closure of `currentIndex`. The callback had `currentIndex` in its dependency array, which caused React to memoize the function with the old `currentIndex` value. When `currentIndex` changed from 1 to 2, the callback still referenced the old value (1), so subsequent swipes would try to process card 1 again instead of advancing.

**Fix**: Refactored `handleSwipe` to use the functional form of `setCurrentIndex` with a callback:
```javascript
// Before - used closure value
const wordAtIndex = words[currentIndex];

// After - uses current state value
setCurrentIndex((prevIndex) => {
  const wordAtIndex = words[prevIndex];
  // ... rest of logic
  return nextIndex < words.length ? nextIndex : prevIndex;
});
```

This ensures we always get the most current index value, not a stale closure.

**Changed in**: `screens/FlashcardScreen.js` - `handleSwipe()` function (lines ~446-590)

---

### 2. ✅ Missing Time Intervals in Corner Labels
**Problem**: The corner indicators (Easy, Good, Hard, Again) didn't show the review interval times (e.g., "1d", "2d", "6h") below each corner label.

**Root Cause**: The `nextReviewIntervals` state was only fetched when flipping a card to the back side, not when loading a new card. This meant:
- First card: No intervals shown until you flip it
- Subsequent cards: No intervals shown until you flip each one
- The intervals from the previous card would persist until you flipped the new card

**Fix**: Added a `useEffect` hook that automatically fetches review intervals whenever the current card changes:

```javascript
// Fetch next review intervals when current word changes
useEffect(() => {
  if (currentWord) {
    fetchNextReviewIntervals(currentWord);
  }
}, [currentWord, fetchNextReviewIntervals]);
```

Also moved `fetchNextReviewIntervals` to before the useEffect and wrapped it in `useCallback` to prevent infinite loops:

```javascript
const fetchNextReviewIntervals = useCallback(async (word) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/srs/preview/${word.id}`);
    if (response.ok) {
      const data = await response.json();
      setNextReviewIntervals(data);
    }
  } catch (error) {
    console.error('Error fetching next review intervals:', error);
    setNextReviewIntervals(null);
  }
}, []);
```

**Changed in**: `screens/FlashcardScreen.js` (lines ~391-422)

---

## Technical Details

### handleSwipe Closure Issue

**The Problem Explained:**
```javascript
// Old code - BAD
const handleSwipe = useCallback(async (corner) => {
  const wordAtIndex = words[currentIndex]; // Captures currentIndex at callback creation
  // ... 
  setCurrentIndex(currentIndex + 1); // Uses old value
}, [words, currentIndex, ...]); // Recreates callback when currentIndex changes, but too late
```

When the callback was created:
1. At card 1: `currentIndex = 0` → callback captures 0
2. Swipe card 1 → sets `currentIndex = 1`
3. At card 2: React recreates callback with `currentIndex = 1` → new callback captures 1
4. **BUT**: The panResponder and keyboard handler still reference the OLD callback from step 1
5. Swipe card 2 → OLD callback still tries to process card at index 0

**The Solution:**
```javascript
// New code - GOOD
const handleSwipe = useCallback(async (corner) => {
  setCurrentIndex((prevIndex) => { // Use functional update
    const wordAtIndex = words[prevIndex]; // Get CURRENT value from React state
    // ... process card at prevIndex
    return nextIndex; // Return NEW index
  });
}, [words, ...]); // Doesn't need currentIndex in deps
```

This ensures we ALWAYS get the current index value from React's state, not from a stale closure.

---

### Interval Display Flow

**Before Fix:**
1. Load card 1 → No intervals shown
2. User flips card 1 → Intervals fetched and shown
3. User swipes to card 2 → OLD intervals from card 1 still shown
4. User flips card 2 → NEW intervals fetched for card 2

**After Fix:**
1. Load card 1 → Intervals automatically fetched via useEffect
2. User flips card 1 → Intervals already visible
3. User swipes to card 2 → NEW intervals automatically fetched via useEffect
4. Intervals for card 2 immediately visible

**Why useCallback is Important:**
```javascript
// Without useCallback
const fetchNextReviewIntervals = async (word) => { ... };

// useEffect runs
useEffect(() => {
  fetchNextReviewIntervals(currentWord);
}, [currentWord, fetchNextReviewIntervals]); // fetchNextReviewIntervals changes on every render!
// This creates an infinite loop: useEffect → state update → re-render → new function → useEffect → ...
```

```javascript
// With useCallback
const fetchNextReviewIntervals = useCallback(async (word) => { ... }, []);

// useEffect runs
useEffect(() => {
  fetchNextReviewIntervals(currentWord);
}, [currentWord, fetchNextReviewIntervals]); // fetchNextReviewIntervals is stable
// This only runs when currentWord changes, as intended
```

---

## Files Modified

1. **screens/FlashcardScreen.js**
   - Lines ~391-406: Moved and wrapped `fetchNextReviewIntervals` in useCallback
   - Lines ~422-428: Added useEffect to fetch intervals when card changes
   - Lines ~446-590: Refactored `handleSwipe` to use functional state updates
   - Lines ~608-622: Updated `flipCard` dependencies to include `fetchNextReviewIntervals`

---

## Testing

### ✅ Test Cases

1. **Card progression**: 
   - Press 1 (Easy) on card 1 → advances to card 2 ✅
   - Press 2 (Good) on card 2 → advances to card 3 ✅
   - Press 3 (Hard) on card 3 → advances to card 4 ✅
   - Press 4 (Again) on card 4 → advances to card 5 ✅

2. **Interval display**:
   - Load first card → intervals immediately visible ✅
   - Swipe to next card → new intervals immediately visible ✅
   - Flip card back/front → intervals remain visible ✅

3. **Corner labels show**:
   - Top-left: "Easy" + interval (e.g., "6d")
   - Top-right: "Good" + interval (e.g., "3d")
   - Bottom-left: "Hard" + interval (e.g., "1d")
   - Bottom-right: "Again" + interval (e.g., "10m")

### Manual Testing Steps

1. Open FlashcardScreen
2. **Don't flip the card** - check if intervals are visible in corners
3. Press keyboard number 1 (or swipe to Easy corner)
4. Verify card advances to next card
5. Check if new intervals are immediately visible
6. Repeat steps 3-5 for several cards
7. Verify you can progress through entire deck

---

## User Impact

### What Users Will Notice
1. **Flashcards no longer get stuck** - smooth progression through entire deck
2. **Intervals always visible** - no need to flip card to see review times
3. **Better UX** - immediate feedback on what each choice means

### What's Fixed Under the Hood
- Closure issues in memoized callbacks
- State management using functional updates
- Proper useEffect/useCallback patterns
- Eliminated stale state references

---

## Related Code Patterns

This fix demonstrates important React patterns:

1. **Functional State Updates**: Use `setState(prev => ...)` when new state depends on old state
2. **useCallback Dependencies**: Only include values the callback actually closes over
3. **useEffect Triggers**: Fetch data when key values (like currentWord) change
4. **Stable References**: Use useCallback to prevent infinite loops in useEffect

---

**Status**: ✅ Complete and tested  
**Date**: January 30, 2026  
**File**: screens/FlashcardScreen.js (1 file modified, ~150 lines changed)
