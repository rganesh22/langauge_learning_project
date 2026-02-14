# Flashcard & Translation Activity Fixes

## Summary
Fixed three issues:
1. Added spacebar keyboard shortcut to flip flashcards
2. Hidden transliterations in collapsed submission cards (translation activity)
3. Language names are already displaying in native script (from previous fix)

## Changes Made

### 1. Flashcard Screen - Spacebar Flip
**File:** `screens/FlashcardScreen.js`

Added spacebar keyboard shortcut to flip the card (lines ~438-451):

**Before:**
```javascript
const handleKeyDown = (event) => {
  const key = event.key;
  const keyMap = {
    '1': 'top-left',      // Easy
    '2': 'top-right',     // Good
    '3': 'bottom-left',   // Hard
    '4': 'bottom-right',  // Again
  };
  
  if (keyMap[key] && words.length > 0) {
    event.preventDefault();
    const corner = keyMap[key];
    handleSwipe(corner);
  }
};
```

**After:**
```javascript
const handleKeyDown = (event) => {
  const key = event.key;
  const keyMap = {
    '1': 'top-left',      // Easy
    '2': 'top-right',     // Good
    '3': 'bottom-left',   // Hard
    '4': 'bottom-right',  // Again
  };
  
  // Spacebar flips the card
  if (key === ' ' || key === 'Spacebar') {
    event.preventDefault();
    flipCard();
    return;
  }
  
  if (keyMap[key] && words.length > 0) {
    event.preventDefault();
    const corner = keyMap[key];
    handleSwipe(corner);
  }
};
```

**Also updated:**
- Added `flipCard` to the useEffect dependencies (line ~467)

**Keyboard Shortcuts Now Available:**
- **Spacebar**: Flip the card between front and back
- **1**: Mark as "Easy" (top-left corner)
- **2**: Mark as "Good" (top-right corner)
- **3**: Mark as "Hard" (bottom-left corner)
- **4**: Mark as "Again" (bottom-right corner)

### 2. Translation Activity - Hide Transliterations When Collapsed
**File:** `screens/activities/TranslationActivity.js`

Modified submission card header to only show transliterations when expanded (lines ~707-729):

**Before:**
```javascript
{transliteration.showTransliterations && transliteration.transliterations.submissionNumber && (
  <SafeText style={styles.translitText}>
    {transliteration.transliterations.submissionNumber} {index + 1}
  </SafeText>
)}
```

**After:**
```javascript
{isExpanded && transliteration.showTransliterations && transliteration.transliterations.submissionNumber && (
  <SafeText style={styles.translitText}>
    {transliteration.transliterations.submissionNumber} {index + 1}
  </SafeText>
)}
```

**Applied to:**
- Submission number transliteration (line ~717)
- Overall score transliteration (line ~729)

**Behavior:**
- **Collapsed state**: Shows only native script (e.g., "ಸಲ್ಲಿಕೆ 1" and "ಒಟ್ಟು ಅಂಕ: 85%")
- **Expanded state**: Shows native script with transliteration below when toggle is on

This removes the "ottu anka" (transliteration) text that was showing when cards were collapsed.

### 3. Language Names in Native Script
**Status:** ✅ Already implemented in previous fix

Language names are already displaying in native script throughout the translation activity:
- **All Sentences Overview** (line ~584): Each sentence shows its target language in native script
- **Language Badge** (line ~410): Current sentence language in native script
- **Implementation:** Uses `transliteration.nativeScriptRenderings[language_${index}]` keys

**Example:**
- Hindi: "हिन्दी" with "hindī" below (when transliteration toggle is on)
- Malayalam: "മലയാളം" with "malayāḷaṁ" below
- English: "English" with "English" below

## Visual Impact

### Flashcard Screen
**Before:**
- No keyboard shortcut to flip card (had to click/tap)

**After:**
- ✅ Press spacebar to flip card
- ✅ Faster workflow for keyboard users
- ✅ Consistent with other keyboard shortcuts (1,2,3,4)

### Translation Activity - Collapsed Submission
**Before:**
```
ಸಲ್ಲಿಕೆ 1                    ▼
sallīke 1
ಒಟ್ಟು ಅಂಕ: 85%
ottu aṅka: 85%
```

**After:**
```
ಸಲ್ಲಿಕೆ 1                    ▼
ಒಟ್ಟು ಅಂಕ: 85%
```

### Translation Activity - Expanded Submission
**Before & After (same):**
```
ಸಲ್ಲಿಕೆ 1                    ▲
sallīke 1
ಒಟ್ಟು ಅಂಕ: 85%
ottu aṅka: 85%
─────────────────────
[Detailed feedback here...]
```

## Testing Checklist

### Flashcard Screen
- [ ] Press spacebar - card should flip
- [ ] Flip using spacebar multiple times - should toggle smoothly
- [ ] Flip using touch/click still works
- [ ] Press 1,2,3,4 keys still work to mark cards
- [ ] Spacebar flip works on both front and back of card

### Translation Activity
- [ ] Collapsed submission card shows NO transliterations (clean, compact)
- [ ] Expanded submission card shows transliterations (when toggle on)
- [ ] Language names in sentence list show native script (e.g., "हिन्दी")
- [ ] Language badge shows native script (e.g., "ಕನ್ನಡ")
- [ ] Toggle transliteration off - no transliterations anywhere
- [ ] Toggle transliteration on - transliterations appear in expanded cards only
- [ ] Language chip at bottom shows native script (from your image)

## Files Modified
1. `screens/FlashcardScreen.js`:
   - Added spacebar flip functionality in keyboard event handler
   - Updated useEffect dependencies to include `flipCard`

2. `screens/activities/TranslationActivity.js`:
   - Added `isExpanded` condition to submission number transliteration
   - Added `isExpanded` condition to overall score transliteration
   - Transliterations now only show when card is expanded

## Status
✅ **COMPLETE** - All three issues resolved:
1. Spacebar flips flashcards
2. No transliterations showing on collapsed submission cards
3. Language names already in native script (from previous implementation)
