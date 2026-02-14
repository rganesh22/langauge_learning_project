# Flashcard SRS Fixes - January 30, 2026

## Issues Identified

### 1. **Infinite Cards Not Loading**
- **Problem**: After finishing 50 flashcards, no more cards load
- **Root Cause**: `loadWords(limit=50)` only loads 50 cards once
- **Fix**: Implement continuous loading - load more cards when user finishes current batch

### 2. **New Cards Not Showing**
- **Problem**: User not getting new cards recommended
- **Root Cause**: Quota system may be too restrictive - 30% of daily goal goes to new cards
- **Fix**: Make new card quota more aggressive and configurable

### 3. **"Again" Interval Too Long**
- **Problem**: When user clicks "Again", card scheduled for next day (not immediate)
- **Root Cause**: `timedelta(days=1)` in `update_word_state_from_flashcard()`
- **Fix**: Make "Again" schedule card for immediate re-review (same session)

### 4. **No SRS Speed Settings**
- **Problem**: No way to control how quickly cards are shown again
- **Root Cause**: SRS intervals are hardcoded, no UI control
- **Fix**: Add interval multiplier settings to control review speed

---

## Implementation Plan

### Fix 1: Infinite Flashcard Loading

**File**: `screens/FlashcardScreen.js`

**Changes**:
1. Track when user reaches end of current batch
2. Automatically load next 50 cards
3. Show loading indicator while fetching
4. Maintain position in current card

**Code Location**: Lines 750-850 (handleSwipe function)

### Fix 2: "Again" = Immediate Review

**File**: `backend/db.py` (update_word_state_from_flashcard function)

**Change**:
```python
if comfort_level == 'again':
    mastery_level = 'learning'
    ease_factor = max(srs_settings['min_ease_factor'], 
                     ease_factor - (srs_settings['ease_factor_decrement'] * 2))
    # CHANGE: Schedule for same day (immediate review in same session)
    next_review = today  # Was: today + timedelta(days=1)
```

**Line**: ~2580

### Fix 3: Aggressive New Card Loading

**File**: `backend/db.py` (get_words_for_review function)

**Change**: Load unlimited cards (not just quota), but prioritize reviews first

**Line**: ~910

### Fix 4: SRS Speed Settings

**Add to ProfileScreen.js**:
- Interval multiplier slider (0.5x - 2.0x)
- Controls how fast intervals grow
- Applied to all interval calculations

---

## Detailed Implementation

