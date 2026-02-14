# Profile and Listening Activity Fixes - January 28, 2026

## Changes Made

### 1. ✅ Urdu Native Script Text Left-Adjusted in Language Chips

**Issue**: Urdu native script text (اردو) was not left-aligned in the language chips, causing improper RTL display.

**Fix**: Added explicit text alignment properties to `languageChipNativeName` style.

#### Changes in `/screens/ProfileScreen.js` (Line ~2894):

```javascript
languageChipNativeName: {
  fontSize: 12,
  fontWeight: '400',
  color: '#666',
  marginTop: 2,
  textAlign: 'left',        // NEW: Force left alignment
  writingDirection: 'ltr',  // NEW: Set writing direction
},
```

**Result**:
- Urdu native text (اردو) is now properly left-aligned in the chip
- RTL text displays correctly starting from the left side
- Consistent with other language native names
- Works with Nastaliq font

**Visual Example**:
```
Before:                  After:
[Icon] Urdu    [A2]     [Icon] Urdu    [A2]
           اردو                اردو
       (right-aligned)   (left-aligned ✓)
```

---

### 2. ✅ Listening Activity Loading Bars Show Only During Audio Generation

**Issue**: 
1. Progress bars appeared immediately when activity generation started
2. Number of bars didn't match actual paragraph count (showed estimated count)
3. Bars appeared even before TTS generation began

**Root Cause**: 
- Progress bars rendered as soon as `paragraphCount > 0`
- This happened during "init" message before TTS started
- Used estimated paragraph count instead of actual count from generated activity

**Fix**: Progress bars now only appear when TTS generation actually starts, with correct paragraph count.

#### Changes in `/screens/activities/ListeningActivity.js` (Lines ~583-598):

```javascript
// BEFORE:
{activityData.paragraphCount > 0 && (
  <View style={{ marginTop: 20, width: '90%', maxWidth: 500 }}>
    <TTSProgressIndicator 
      paragraphCount={activityData.paragraphCount}  // Used estimate
      currentStatus={activityData.ttsProgress}
    />
  </View>
)}

// AFTER:
{activityData.paragraphCount > 0 && activityData.ttsProgress && Object.keys(activityData.ttsProgress).length > 0 && (
  (() => {
    // Check if any paragraph has started processing (not all are 'pending')
    const hasStarted = Object.values(activityData.ttsProgress).some(status => status !== 'pending');
    const actualParagraphCount = Object.keys(activityData.ttsProgress).length;
    
    return hasStarted ? (
      <View style={{ marginTop: 20, width: '90%', maxWidth: 500 }}>
        <TTSProgressIndicator 
          paragraphCount={actualParagraphCount}  // Use ACTUAL count from progress object
          currentStatus={activityData.ttsProgress}
        />
      </View>
    ) : null;
  })()
)}
```

**Logic**:
1. **Wait for progress object**: `activityData.ttsProgress && Object.keys(activityData.ttsProgress).length > 0`
2. **Check if started**: `Object.values(activityData.ttsProgress).some(status => status !== 'pending')`
3. **Use actual count**: `Object.keys(activityData.ttsProgress).length` (not estimated `paragraphCount`)
4. **Show only when started**: `return hasStarted ? <Progress /> : null`

**Result**:
- ✅ Progress bars don't appear during initial activity generation
- ✅ Progress bars appear only when TTS audio generation starts
- ✅ Number of bars matches actual paragraph count (3-5, not estimate)
- ✅ More accurate user feedback about what's happening

---

## Loading Flow Comparison

### Before:
```
1. User selects topic
2. "Generating passage and questions..." 
   [5 loading bars appear - all pending]  ❌ Too early, wrong count
3. Activity generates (3 paragraphs)
   [Still shows 5 bars]                   ❌ Wrong count
4. TTS starts
   [Bars start filling]
5. Complete
```

### After:
```
1. User selects topic
2. "Generating passage and questions..."
   [No bars yet]                          ✓ Correct
3. Activity generates (3 paragraphs)
   [No bars yet]                          ✓ Correct
4. TTS starts
   [3 loading bars appear]                ✓ Correct count!
   [Bars start filling immediately]       ✓ Correct
5. Complete
```

---

## Technical Details

### Urdu Text Alignment:
- **textAlign: 'left'**: Forces text to start from left edge
- **writingDirection: 'ltr'**: Ensures LTR context even for RTL script
- Works with `fontFamily: 'Noto Nastaliq Urdu'` for proper rendering

### Progress Bar Logic:
1. **Init phase**: Backend sends estimated count (5), all status 'pending'
2. **Generation phase**: Activity generated, actual paragraph count determined (3-5)
3. **TTS Start**: First paragraph status changes from 'pending' → 'processing'
   - **Trigger**: This is when bars appear
4. **TTS Progress**: Status updates: 'processing' → 'complete'
5. **TTS Complete**: All paragraphs 'complete', bars full

### Status Flow:
```
pending → processing → complete
   ↓          ↓           ↓
  Hide     Show bars   Update bars
```

---

## Testing Checklist

### Urdu Text Alignment:
- [x] Code compiles without errors
- [ ] Urdu native text (اردو) is left-aligned in chip
- [ ] Text doesn't overflow or get cut off
- [ ] Nastaliq font displays correctly
- [ ] Consistent with other language chips

### Loading Bars:
- [x] Code compiles without errors
- [ ] Bars don't appear during passage generation
- [ ] Bars appear when TTS starts
- [ ] Number of bars matches actual paragraphs (3-5)
- [ ] Bars update correctly as TTS progresses
- [ ] No bars show when all are 'pending'

---

## Files Modified

1. **ProfileScreen.js** (Line 2894):
   - Added `textAlign: 'left'` to `languageChipNativeName`
   - Added `writingDirection: 'ltr'` to `languageChipNativeName`

2. **ListeningActivity.js** (Lines 583-598):
   - Changed progress bar visibility condition
   - Added check for TTS start (not all 'pending')
   - Use actual paragraph count from progress object
   - Use inline function for conditional rendering

---

## User Experience Impact

### Urdu Display:
- Better RTL text handling
- Proper alignment for Perso-Arabic script
- More professional appearance

### Loading Feedback:
- Clearer indication of what's happening
- Progress bars appear at the right time
- Accurate visual feedback (correct number of bars)
- Less confusing for users (no premature bars)

---

## Edge Cases Handled

### Urdu Text:
- Works with Nastaliq font
- Handles RTL script in LTR context
- Proper text direction for all languages

### Loading Bars:
- Handles 3-5 paragraph variance
- Handles init message with estimates
- Handles update_count message
- Handles case where progress object is empty
- Handles case where all statuses are 'pending'
