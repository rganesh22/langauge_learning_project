# Flashcard Chip Styling and Layout Fixes ✅

## Overview
Updated the flashcard screen to match the vocabulary page chip styling for both SRS badges and word class badges. Also restructured the "Tap to reveal/flip back" buttons to show transliterations directly below the native text, and moved the bottom corner buttons down further to prevent overlap with the card.

## Changes Made

### 1. Added Imports and Helper Functions
**Added constants import**:
```javascript
import { MASTERY_FILTERS, WORD_CLASSES } from '../constants/filters';
```

**Added helper functions** (matching VocabularyDictionary.js):
- `getMasteryColor(masteryLevel)`: Returns background color for mastery badge
- `getMasteryEmoji(masteryLevel)`: Returns emoji for mastery level (✓, ↻, ▶, +)
- `getMasteryLabel(masteryLevel)`: Returns label text (Mastered, Review, Learning, New)
- `getWordClassColor(wordClass)`: Returns {bg, text} color object for word classes

### 2. Updated SRS Badge Styling (Vocabulary Page Style)

**Before**:
- Simple gray background with colored dot indicator
- Text only showed state name (e.g., "Mastered", "Review")
- No emoji
- Custom colors

**After** (matches vocabulary page):
- Colored background matching MASTERY_FILTERS colors:
  - New: #999999 (gray)
  - Learning: #4A90E2 (blue)
  - Review: #FF9500 (orange)
  - Mastered: #50C878 (green)
- White text on colored background
- Includes emoji: ✓ Mastered, ↻ Review, ▶ Learning, + New
- Uppercase label text

**Front Card Badge Code**:
```jsx
<View style={[
  styles.srsStateBadge,
  { backgroundColor: getMasteryColor(currentWord.mastery_level) }
]}>
  <SafeText style={styles.srsStateText}>
    {getMasteryEmoji(currentWord.mastery_level)} {getMasteryLabel(currentWord.mastery_level).toUpperCase()}
  </SafeText>
</View>
```

**Back Card Badge Code**: Same as front card

### 3. Updated Word Class Badge Styling (Vocabulary Page Style)

**Before**:
- Fixed teal background (#14B8A6)
- White text
- Larger padding (12px horizontal, 6px vertical)
- Border radius: 12px
- Font size: 12px
- Uppercase text

**After** (matches vocabulary page):
- Dynamic background color from WORD_CLASSES:
  - noun: #8B5CF6 (purple)
  - verb: #EF4444 (red)
  - adjective: #10B981 (green)
  - adverb: #F59E0B (amber)
  - preposition: #3B82F6 (blue)
  - etc. (18 total word classes)
- Dynamic text color (mostly white, some have darker text)
- Smaller padding (8px horizontal, 4px vertical)
- Border radius: 4px (square-ish)
- Font size: 11px
- Normal case (not uppercase)

**Back Card Word Class Badge Code**:
```jsx
{currentWord.word_class && (() => {
  const wordClassColor = getWordClassColor(currentWord.word_class);
  return (
    <View style={[
      styles.wordClassBadge,
      { backgroundColor: wordClassColor.bg }
    ]}>
      <SafeText style={[
        styles.wordClassText,
        { color: wordClassColor.text }
      ]}>
        {currentWord.word_class}
      </SafeText>
    </View>
  );
})()}
```

### 4. Restructured Flip Button Text (Transliteration Below)

**Before**: Transliteration appeared to the side with marginLeft

**After**: Transliteration appears directly below using a text container

**Front Card "Tap to Reveal"**:
```jsx
<View style={styles.flipButton}>
  <Ionicons name="refresh" size={24} color="#14B8A6" />
  <View style={styles.flipButtonTextContainer}>
    <SafeText style={styles.flipButtonText}>{localizedText.tapToReveal.text}</SafeText>
    {showTransliterations && (
      <SafeText style={styles.flipButtonTransliteration}>{localizedText.tapToReveal.transliteration}</SafeText>
    )}
  </View>
</View>
```

**Back Card "Tap to Flip Back"**: Same structure

**Visual Result**:
```
🔄 வெளிப்படுத்த தட்டவும்
   veḷippaṭutta taṭṭavum
```

### 5. Moved Bottom Corner Buttons Down (Prevent Overlap)

**Before**: `bottom: 90`
**After**: `bottom: 120`

**Change**: Moved Hard (bottom-left) and Again (bottom-right) buttons down by 30px additional spacing

**Reason**: Card was overlapping with corner indicators, causing visual clutter and making it hard to distinguish between card content and corner buttons.

### 6. Updated Styles

**srsStateBadge**:
```javascript
srsStateBadge: {
  position: 'absolute',
  top: 12,
  right: 12,
  paddingHorizontal: 10,
  paddingVertical: 4,      // ← Changed from 6
  borderRadius: 12,
  // backgroundColor removed (now dynamic)
}
```

**srsStateText**:
```javascript
srsStateText: {
  fontSize: 11,            // ← Changed from 12
  fontWeight: '600',
  color: '#FFFFFF',        // ← Changed from '#4B5563'
}
```

**wordClassBadge**:
```javascript
wordClassBadge: {
  paddingHorizontal: 8,    // ← Changed from 12
  paddingVertical: 4,      // ← Changed from 6
  borderRadius: 4,         // ← Changed from 12
  marginBottom: 16,
  // backgroundColor removed (now dynamic)
}
```

**wordClassText**:
```javascript
wordClassText: {
  fontSize: 11,            // ← Changed from 12
  fontWeight: '600',
  // color removed (now dynamic)
  // textTransform removed (no longer uppercase)
}
```

**New style - flipButtonTextContainer**:
```javascript
flipButtonTextContainer: {
  flexDirection: 'column',  // ← Stack text vertically
  marginLeft: 8,
}
```

**flipButtonText** & **flipButtonTransliteration**:
- Removed marginLeft from individual text elements
- Now handled by container

**bottomLeft & bottomRight**:
```javascript
bottomLeft: {
  position: 'absolute',
  bottom: 120,             // ← Changed from 90
  left: 20,
}
bottomRight: {
  position: 'absolute',
  bottom: 120,             // ← Changed from 90
  right: 20,
}
```

## Visual Comparison

### SRS Badge (Before → After)
```
Before:                 After:
┌─────────────┐        ┌─────────────┐
│ ● Mastered  │   →    │ ✓ MASTERED  │
│ (gray bg)   │        │ (green bg)  │
└─────────────┘        └─────────────┘
```

### Word Class Badge (Before → After)
```
Before:                 After:
┌─────────────┐        ┌──────────┐
│   VERB      │   →    │  verb    │
│ (teal bg)   │        │ (red bg) │
└─────────────┘        └──────────┘
```

### Flip Button Text (Before → After)
```
Before:                           After:
🔄 வெளிப்படுத்த தட்டவும்          🔄 வெளிப்படுத்த தட்டவும்
   veḷippaṭutta taṭṭavum              veḷippaṭutta taṭṭavum
   (side by side)                     (stacked vertically)
```

### Bottom Corners Position (Before → After)
```
Before (bottom: 90):    After (bottom: 120):
┌─────────────┐        ┌─────────────┐
│    CARD     │        │    CARD     │
│             │        │             │
│             │        │             │
└─────────────┘        └─────────────┘
   ↙  Hard  ↘             ↙  (more  ↘
                             space)
```

## Color Reference

### Mastery Level Colors (from MASTERY_FILTERS):
- **New**: #999999 (gray) + emoji
- **Learning**: #4A90E2 (blue) ▶ emoji
- **Review**: #FF9500 (orange) ↻ emoji
- **Mastered**: #50C878 (green) ✓ emoji
- **Due**: #FF6B6B (red) ⏱ emoji

### Word Class Colors (from WORD_CLASSES) - Sample:
- **noun**: #8B5CF6 (purple), white text
- **verb**: #EF4444 (red), white text
- **adjective**: #10B981 (green), white text
- **adverb**: #F59E0B (amber), white text
- **preposition**: #3B82F6 (blue), white text
- **exclamation**: #FCD34D (yellow), dark text

## Files Modified

**screens/FlashcardScreen.js**:
- Line 17: Added MASTERY_FILTERS, WORD_CLASSES import
- Lines 235-257: Added helper functions (getMasteryColor, getMasteryEmoji, getMasteryLabel, getWordClassColor)
- Lines 1127-1136: Updated front card SRS badge (vocab page style)
- Lines 1148-1157: Restructured "Tap to reveal" with text container
- Lines 1207-1216: Updated back card SRS badge (vocab page style)
- Lines 1226-1241: Updated word class badge with dynamic colors
- Lines 1243-1253: Restructured "Tap to flip back" with text container
- Lines 1370-1379: Moved bottom corners down (90 → 120)
- Lines 1475-1487: Updated srsStateBadge and srsStateText styles
- Lines 1547-1558: Updated wordClassBadge and wordClassText styles
- Lines 1560-1579: Added flipButtonTextContainer style, updated flip button text styles

## Testing Checklist
- [ ] Verify SRS badge shows emoji + uppercase label with correct color
- [ ] Check word class badge has correct color per word type
- [ ] Test all mastery levels (New, Learning, Review, Mastered)
- [ ] Test various word classes (noun, verb, adjective, etc.)
- [ ] Confirm flip button transliteration appears directly below native text
- [ ] Verify bottom corner buttons (Hard, Again) don't overlap with card
- [ ] Test on different screen sizes
- [ ] Toggle transliterations on/off for flip buttons
- [ ] Check both front and back cards for consistency

## Impact
- ✅ Consistent chip styling between flashcards and vocabulary page
- ✅ More visually distinct mastery levels with emojis
- ✅ Clearer word class identification with varied colors
- ✅ Better transliteration layout (stacked, not side-by-side)
- ✅ No overlap between card and corner buttons
- ✅ Professional, polished appearance matching design system
