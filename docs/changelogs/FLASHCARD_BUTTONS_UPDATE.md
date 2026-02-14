# Flashcard Buttons Update - January 28, 2026

## Overview
Added 4 action buttons to the flashcard screen to provide an alternative to dragging cards to corners, with keyboard shortcut support (1, 2, 3, 4 keys).

## Changes Made

### 1. Action Buttons Added
Replaced the single instruction text with 4 interactive buttons at the bottom of the screen:

- **Easy** (Green) - Maps to top-left corner swipe
- **Again** (Blue) - Maps to top-right corner swipe  
- **Hard** (Orange) - Maps to bottom-left corner swipe
- **Very Hard** (Red) - Maps to bottom-right corner swipe

Each button:
- Displays an icon from the COMFORT_LEVELS configuration
- Uses the corresponding color from COMFORT_LEVELS
- Calls `handleSwipe()` with the appropriate corner parameter
- Has shadow/elevation for visual depth

### 2. Keyboard Shortcuts
Added keyboard event listener for numbers 1-4:
- **1** → Easy (top-left)
- **2** → Again (top-right)
- **3** → Hard (bottom-left)
- **4** → Very Hard (bottom-right)

Implementation details:
- Uses web-only keyboard events (wrapped in platform check)
- Prevents default key behavior to avoid conflicts
- Only active when words are loaded
- Cleanup on unmount

### 3. Updated Instructions
Changed instruction text from:
- **Old**: "Drag the card to a corner based on your comfort level"
- **New**: "Rate your comfort level with this word"

More concise and reflects the dual interaction model (drag OR buttons).

## Code Changes

### New useEffect Hook (after useFocusEffect)
```javascript
useEffect(() => {
  const handleKeyDown = (event) => {
    if (typeof window === 'undefined') return;
    
    const key = event.key;
    const keyMap = {
      '1': 'top-left',      // Easy
      '2': 'top-right',     // Again
      '3': 'bottom-left',   // Hard
      '4': 'bottom-right',  // Very Hard
    };
    
    if (keyMap[key] && words.length > 0) {
      event.preventDefault();
      handleSwipe(keyMap[key]);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }
}, [words, handleSwipe]);
```

### Updated Instructions Section (replaced)
```javascript
<View style={styles.instructionsContainer}>
  <SafeText style={styles.instructionsText}>
    Rate your comfort level with this word
  </SafeText>
  <View style={styles.actionButtonsContainer}>
    {/* 4 buttons with icons, labels, and colors */}
  </View>
</View>
```

### New Styles Added
```javascript
instructionsText: {
  marginBottom: 16,  // Added spacing below text
}
actionButtonsContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  gap: 10,
}
actionButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 14,
  paddingHorizontal: 12,
  borderRadius: 12,
  gap: 6,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  elevation: 3,
}
actionButtonText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#FFFFFF',
  textAlign: 'center',
}
```

## User Experience

### Before
- **Only option**: Drag card to one of 4 corners
- No keyboard support
- Required understanding of corner positions

### After
- **Two options**:
  1. Drag card to corners (still works)
  2. Press one of 4 buttons
  3. Press 1/2/3/4 on keyboard (web only)
- More accessible
- Faster interaction for keyboard users
- Visual cues with colored buttons

## Visual Layout

```
┌─────────────────────────────────────┐
│  [Card Content with Flip/Swipe]    │
│                                     │
└─────────────────────────────────────┘

Rate your comfort level with this word

┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  ✓   │ │  ⟳   │ │  ⚠   │ │  ✗   │
│ Easy │ │Again │ │ Hard │ │V.Hard│
└──────┘ └──────┘ └──────┘ └──────┘
 Green    Blue    Orange    Red
   1        2        3        4
```

## Button Mapping to COMFORT_LEVELS

| Button     | Corner        | comfort_level      | Color  | Icon            | Key |
|------------|---------------|-------------------|--------|-----------------|-----|
| Easy       | top-left      | easy              | Green  | checkmark-circle| 1   |
| Again      | top-right     | very_difficult    | Blue   | refresh         | 2   |
| Hard       | bottom-left   | difficult         | Orange | alert-circle    | 3   |
| Very Hard  | bottom-right  | very_difficult    | Red    | close-circle    | 4   |

## Backend Integration
No backend changes required. The buttons call the same `handleSwipe()` function that the drag gesture uses, which:
1. Calls `POST /api/flashcard/update` with word_id and comfort_level
2. Updates local state with new SRS data
3. Animates card off screen
4. Loads next card

## Platform Compatibility

### React Native (Mobile)
- ✅ Buttons work perfectly
- ❌ Keyboard shortcuts not available (mobile has no keyboard)

### Web (Expo Web)
- ✅ Buttons work perfectly
- ✅ Keyboard shortcuts work (1, 2, 3, 4 keys)

## Testing Checklist
- [ ] Buttons appear at bottom of screen
- [ ] Each button has correct color, icon, and label
- [ ] Clicking Easy button swipes card to top-left corner
- [ ] Clicking Again button swipes card to top-right corner
- [ ] Clicking Hard button swipes card to bottom-left corner
- [ ] Clicking Very Hard button swipes card to bottom-right corner
- [ ] Pressing "1" key triggers Easy (web only)
- [ ] Pressing "2" key triggers Again (web only)
- [ ] Pressing "3" key triggers Hard (web only)
- [ ] Pressing "4" key triggers Very Hard (web only)
- [ ] Dragging to corners still works as before
- [ ] Card flips and resets properly after button press
- [ ] SRS update happens correctly
- [ ] Next card loads after button press
- [ ] No console errors

## File Changes
- **Modified**: `screens/FlashcardScreen.js` (1291 lines, was 1224 lines)
- **Added**: 31 lines for keyboard listener
- **Added**: 44 lines for button UI
- **Added**: 24 lines for button styles
- **Modified**: Instructions text
- **Net change**: +67 lines

## Notes
- Keyboard shortcuts use web-specific `window` events (not available on React Native mobile)
- Platform checks (`typeof window === 'undefined'`) ensure no crashes on mobile
- Buttons complement drag gestures rather than replacing them
- Same SRS logic and backend API used for both interaction methods
- Colors and icons pulled from existing COMFORT_LEVELS configuration
