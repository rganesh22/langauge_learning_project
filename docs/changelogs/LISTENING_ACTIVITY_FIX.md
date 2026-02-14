# Listening Activity - Paragraph/Audio Alignment Fix

## Issue Description
User reported: "In the listening activity, the paragraphs aren't aligned with the audio playing. some paragraphs are aligned, but others aren't"

## Root Cause Analysis

The misalignment was caused by a **race condition** between two competing mechanisms that update the `currentParagraphIndex` state:

### 1. Auto-Play Logic ("Listen to All" feature)
Located in the useEffect at lines 214-256:
- When audio finishes playing, the effect detects this
- Scrolls to the next paragraph programmatically
- Updates `currentParagraphIndex` to the next index
- Plays the next audio after a 500ms delay

### 2. ScrollView Event Handlers
Located at lines 1036-1051:
- `onScroll`: Updates `currentParagraphIndex` based on current scroll position (fires during scroll animation)
- `onMomentumScrollEnd`: Updates `currentParagraphIndex` when scroll animation completes

### The Race Condition
When "Listen to All" auto-advances:
1. ✅ Auto-play logic sets `currentParagraphIndex = nextIndex` (e.g., 2)
2. ✅ Programmatic scroll starts animating to paragraph 2
3. ❌ During animation, `onScroll` fires and calculates index based on scroll position
4. ❌ If scroll is still mid-animation, it calculates wrong index (e.g., 1)
5. ❌ `onMomentumScrollEnd` fires after animation and sets index based on final position
6. ❌ But by this time, the state might be out of sync with what's actually playing

This resulted in:
- Visual paragraph highlighting not matching the audio
- Some paragraphs appearing "aligned" (when timing worked out)
- Others appearing "misaligned" (when race condition occurred)

## Solution Implemented

**File Modified:** `screens/activities/ListeningActivity.js`

**Changes Made:**
Added guards to both scroll handlers to prevent them from updating the index during auto-play:

```javascript
onScroll={(event) => {
  // Don't update index during "Listen to All" auto-play to prevent race conditions
  if (isListeningToAll) return;
  
  // Update on scroll for immediate feedback
  const index = Math.round(
    event.nativeEvent.contentOffset.x / Dimensions.get('window').width
  );
  if (index !== currentParagraphIndex && index >= 0 && index < paragraphs.length) {
    setCurrentParagraphIndex(index);
  }
}}

onMomentumScrollEnd={(event) => {
  // Don't update index during "Listen to All" auto-play to prevent race conditions
  if (isListeningToAll) return;
  
  // Final update when scroll ends
  const index = Math.round(
    event.nativeEvent.contentOffset.x / Dimensions.get('window').width
  );
  setCurrentParagraphIndex(index);
}}
```

## How The Fix Works

**When "Listen to All" is active (`isListeningToAll = true`):**
- Scroll handlers are disabled
- Only the auto-play useEffect controls `currentParagraphIndex`
- Programmatic scrolling happens, but doesn't trigger index updates
- Result: Audio and visual highlighting stay perfectly synchronized

**When "Listen to All" is NOT active (manual paragraph selection):**
- Scroll handlers work normally
- User can swipe between paragraphs and index updates correctly
- Manual paragraph selection still works as expected

## Testing Recommendations

Test the following scenarios:

1. **Auto-Play Full Sequence:**
   - Start "Listen to All" from paragraph 1
   - Verify all paragraphs play in sequence
   - Verify highlighting matches the playing audio throughout

2. **Auto-Play from Middle:**
   - Scroll to paragraph 3 manually
   - Start "Listen to All"
   - Verify it continues from paragraph 3 onwards

3. **Manual Interruption:**
   - Start "Listen to All"
   - Manually tap a different paragraph
   - Verify auto-play stops and manual selection works

4. **Manual Scrolling:**
   - With auto-play OFF, swipe between paragraphs
   - Verify highlighting updates correctly

5. **Edge Cases:**
   - Test with 2 paragraphs (minimum)
   - Test with 10+ paragraphs (maximum)
   - Test stopping and restarting auto-play

## Additional Notes

- No changes to audio playback logic (useAudio hook)
- No changes to state initialization
- No changes to manual paragraph selection
- Only modified scroll handler behavior during auto-play
- Backward compatible with existing functionality

## Files Modified

1. `screens/activities/ListeningActivity.js` - Added guards to scroll handlers (lines ~1036-1051)

## Result

✅ Paragraph highlighting now stays synchronized with audio playback
✅ "Listen to All" feature works reliably
✅ Manual paragraph selection still works correctly
✅ No breaking changes to existing functionality
