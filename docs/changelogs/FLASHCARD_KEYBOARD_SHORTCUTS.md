# Flashcard Keyboard Shortcuts

## Overview

The flashcard screen now supports keyboard shortcuts (1, 2, 3, 4) that work identically to dragging cards to corners. When you press a number key, the card will animate to the corresponding corner, update the SRS system, and advance to the next card - exactly as if you had manually dragged it.

## Keyboard Mapping

### Number Keys → Corners → SRS Ratings

```
┌─────────────────────────────────┬─────────────────────────────────┐
│                                 │                                 │
│         1 - Easy (Green)        │      2 - Good (Blue)           │
│                                 │                                 │
│         ✓ Easy to recall        │      ✓ Correct recall          │
│         Longest interval        │      Standard interval         │
│                                 │                                 │
├─────────────────────────────────┼─────────────────────────────────┤
│                                 │                                 │
│         3 - Hard (Orange)       │      4 - Again (Red)           │
│                                 │                                 │
│         ⚠ Difficult recall      │      ✗ Incorrect/Forgot        │
│         Shorter interval        │      Shortest interval         │
│                                 │                                 │
└─────────────────────────────────┴─────────────────────────────────┘
```

## Key Mappings

| Key | Corner | Label | Color | SRS Effect | Typical Interval |
|-----|--------|-------|-------|------------|------------------|
| `1` | Top-Left | Easy | 🟢 Green | Longest review interval | 7-30+ days |
| `2` | Top-Right | Good | 🔵 Blue | Standard review interval | 3-14 days |
| `3` | Bottom-Left | Hard | 🟠 Orange | Shorter review interval | 1-5 days |
| `4` | Bottom-Right | Again | 🔴 Red | Reset to learning | <1-2 days |

## How It Works

### When You Press a Number Key:

1. **Card Animation**
   - Card smoothly animates to the corresponding corner
   - Corner indicator highlights
   - Background tint matches the corner color
   - Interval preview shows beneath corner label

2. **SRS Update**
   - Word state is updated via API: `POST /api/flashcard/update`
   - Comfort level is sent: `easy`, `good`, `hard`, or `again`
   - Backend calculates next review date using SRS algorithm
   - Word mastery level may change based on response

3. **Next Card**
   - Current card fades out and moves off-screen
   - Next card fades in from center
   - Corner indicators reset to default state
   - Interval previews load for the new card

### Identical to Dragging

The keyboard shortcuts call the same `handleSwipe(corner)` function that dragging uses, so:
- ✅ Same SRS updates
- ✅ Same animations
- ✅ Same card advancement logic
- ✅ Same mastery level calculations
- ✅ Same interval calculations
- ✅ Same progress tracking

## Usage Guide

### Basic Workflow

1. **Load Flashcards**
   - Navigate to Practice → Flashcards
   - Cards load sorted by SRS priority (due cards first)

2. **Review Front**
   - Front side shows (English word by default)
   - Think of the translation

3. **Flip Card**
   - Click/tap anywhere on card (not corners)
   - Back side reveals translation + transliteration

4. **Rate Your Recall**
   - Press `1` if you found it Easy
   - Press `2` if you got it right (Good)
   - Press `3` if you struggled (Hard)
   - Press `4` if you forgot or got it wrong (Again)

5. **Next Card**
   - Card automatically advances
   - Process repeats until all cards reviewed

### Alternative: Drag Method

You can also drag cards to corners:
- Click and hold on the card
- Drag toward a corner
- Corner highlights when you're in the zone
- Release to submit rating
- Intervals preview shown during drag

## SRS Algorithm Details

### Easy (Key 1)
- **Effect**: Significantly increases interval
- **Use When**: Instant recall, no hesitation
- **Mastery Impact**: Moves toward "Mastered" quickly
- **Interval Multiplier**: 2.5x or more

### Good (Key 2)
- **Effect**: Standard interval increase
- **Use When**: Correct answer with slight effort
- **Mastery Impact**: Steady progress toward mastery
- **Interval Multiplier**: 2.0x-2.5x

### Hard (Key 3)
- **Effect**: Minimal interval increase or decrease
- **Use When**: Struggled but eventually recalled
- **Mastery Impact**: Stays in "Learning" phase longer
- **Interval Multiplier**: 1.0x-1.5x

### Again (Key 4)
- **Effect**: Resets interval significantly
- **Use When**: Couldn't recall or got it wrong
- **Mastery Impact**: Drops back to "Learning" phase
- **Interval Multiplier**: 0.0x (back to 1-2 days)

## Interval Preview

Beneath each corner label, you'll see the next review interval:
- `<1d` - Less than 1 day (hours shown)
- `Xh` - Hours (for very short intervals)
- `Xd` - Days (most common)

Examples:
- Easy: `14d` (2 weeks)
- Good: `7d` (1 week)
- Hard: `2d` (2 days)
- Again: `<1d` (review soon)

## Platform Support

### Web (Desktop/Laptop)
✅ **Full keyboard support**
- All number keys work (1, 2, 3, 4)
- Fast review workflow
- Keyboard-first experience

### Mobile (iOS/Android)
⚠️ **Touch only**
- Keyboard shortcuts not available (no physical keyboard)
- Drag to corners still works perfectly
- Corner tap may work (if implemented)

## Tips for Efficient Reviews

### Speed Tips
1. **Use keyboard shortcuts** for fastest reviews (web only)
2. **Flip card immediately** before dragging/pressing
3. **Be honest** with your ratings for best SRS performance
4. **Don't rush** - accuracy matters more than speed

### Rating Guidelines
- **Press 1 (Easy)** sparingly - only for truly effortless recalls
- **Press 2 (Good)** most often - this is your default "correct"
- **Press 3 (Hard)** when you need to think hard or nearly forgot
- **Press 4 (Again)** whenever you couldn't recall - no shame!

### Session Management
- Aim for **20-30 cards** per session
- Take **breaks** every 50-100 cards
- Review **consistently** > reviewing perfectly
- Check daily quota to stay on track

## Implementation Details

### Code Location
- File: `screens/FlashcardScreen.js`
- Lines: 415-442 (keyboard handler)
- Function: `handleKeyDown` → `handleSwipe(corner)`

### Event Flow
```javascript
User presses key (1-4)
  ↓
handleKeyDown captures event
  ↓
Maps key to corner position
  ↓
Calls handleSwipe(corner)
  ↓
Animates card to corner
  ↓
Updates SRS via API
  ↓
Advances to next card
```

### Key Dependencies
- `useEffect` hook watches for keyboard events
- `window.addEventListener('keydown')` captures keys
- `handleSwipe(corner)` processes the rating
- Web platform check: `typeof window !== 'undefined'`

## Troubleshooting

### Keyboard Not Working

**Problem**: Number keys don't move cards

**Solutions**:
1. **Check platform**: Only works on web (desktop/laptop)
2. **Focus window**: Click on the flashcard screen
3. **Check console**: Look for JavaScript errors
4. **Reload page**: Try refreshing if stuck

### Wrong Corner Mapping

**Problem**: Key presses go to wrong corners

**Check mapping**:
- `1` = Top-Left (Easy/Green)
- `2` = Top-Right (Good/Blue)
- `3` = Bottom-Left (Hard/Orange)
- `4` = Bottom-Right (Again/Red)

### Card Not Advancing

**Problem**: Card moves but doesn't advance

**Solutions**:
1. Wait for animation to complete
2. Check if it's the last card
3. Check backend is running
4. Look for API errors in console

### Intervals Not Showing

**Problem**: No numbers beneath corner labels

**Solutions**:
1. Flip card to back side first
2. Wait for API call to complete
3. Check `/api/srs/preview/{word_id}` endpoint
4. Verify word has SRS data

## Future Enhancements

### Possible Additions
- [ ] Spacebar to flip card
- [ ] Arrow keys for navigation
- [ ] Undo last rating (Ctrl+Z)
- [ ] Skip card (Escape)
- [ ] Keyboard help overlay (?)
- [ ] Custom key mappings
- [ ] Keyboard shortcuts on mobile (with external keyboard)

### Advanced Features
- [ ] Bulk operations (select multiple)
- [ ] Keyboard macros
- [ ] Voice commands
- [ ] Gesture recognition on mobile
- [ ] Haptic feedback on mobile

## Summary

Keyboard shortcuts (1, 2, 3, 4) provide a **fast, keyboard-first workflow** for reviewing flashcards on web platforms. They work **identically to dragging** cards to corners, ensuring consistent SRS behavior regardless of input method. The interval preview system helps you understand the impact of each rating before committing, leading to more thoughtful and effective reviews.

**Quick Reference**:
- `1` = Easy 🟢 (longest interval)
- `2` = Good 🔵 (standard interval)
- `3` = Hard 🟠 (shorter interval)  
- `4` = Again 🔴 (restart learning)

Happy reviewing! 📚✨
