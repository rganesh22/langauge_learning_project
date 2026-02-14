# Flashcard Bidirectional Testing & Loading Fix - February 1, 2026

## Issues Fixed (Updated)

### 1. ❌ **Deterministic Bidirectional Testing** ✅ FIXED
**Problem**: Cards used random direction assignment (`Math.random() < 0.5`), which meant:
- You might see the same word only as English→Native multiple times
- No guarantee you'd be tested both ways
- Inconsistent learning experience

**Solution**: Each word now creates **TWO cards automatically**:
1. One card: English → Native Language (production)
2. One card: Native Language → English (recognition)

This ensures balanced vocabulary acquisition - you WILL be tested both ways for every word.

### 2. ❌ **Card Shuffling Within Sets** ✅ FIXED
**Problem**: Cards were not shuffled, or fully randomized without ensuring both directions appear
- Fixed order could be predictable
- Full shuffle might group same directions together

**Solution**: 
- **Default behavior**: Each word's two directions are randomly ordered (sometimes En→Native first, sometimes Native→En first)
- **With shuffle enabled**: All cards fully randomized
- **Result**: You see at least one of each direction per word, mixed throughout the deck

### 3. ❌ **Screen Blanking After 10th Card** ✅ FIXED
**Problem**: `loadMoreCards()` function was:
- Checking if daily goal was met
- Clearing words array (`setWords([])`) when goal reached
- This caused blank screen instead of allowing continued practice

**Solution**: 
- Removed goal checking from `loadMoreCards()`
- Now loads cards continuously until backend has no more available
- Shows completion screen only when truly no more cards exist
- Users can practice beyond their daily goal if they want

### 3. ❌ **Not Enough New Cards**
**Problem**: Backend was loading limited new cards, and with bidirectional testing creating 2 cards per word, users quickly ran out

**Solution**: Updated backend to be more generous:
- Changed from `2x quota` to `3x quota`
- Minimum 10 new words per batch (= 20 cards with bidirectional)
- Comment explains bidirectional multiplier effect

### 4. ❌ **Text Node Error in Practice Screen** ✅ FIXED
**Problem**: React Native error "Unexpected text node: . A text node cannot be a child of a <View>"
- Caused by loose text in JSX: `{srsStats.new_count || 0} new`
- Space between expression and text creates standalone text node

**Solution**: Wrapped text in template literals:
```javascript
// Before (causes error)
{srsStats.new_count || 0} new

// After (works correctly)
{`${srsStats.new_count || 0} new`}
```

---

## Changes Made

### Frontend: `screens/FlashcardScreen.js`

#### Change 1: Deterministic Bidirectional in `loadWords()`
**Location**: Lines ~477-520

**Before**:
```javascript
// Randomly assign card direction (50% English→Native, 50% Native→English)
const wordsWithDirection = srsWords.map(word => ({
  ...word,
  cardDirection: Math.random() < 0.5 ? 'english-to-native' : 'native-to-english'
}));

setWords(sortedWords);
setAllWordsLoaded(true);
```

**After**:
```javascript
// DETERMINISTIC BIDIRECTIONAL TESTING:
// Each word gets TWO cards - one for each direction
const wordsWithBothDirections = [];
srsWords.forEach(word => {
  // Card 1: English → Native
  wordsWithBothDirections.push({
    ...word,
    cardDirection: 'english-to-native',
    originalWordId: word.id,  // Track original word for SRS updates
  });
  // Card 2: Native → English
  wordsWithBothDirections.push({
    ...word,
    cardDirection: 'native-to-english',
    originalWordId: word.id,
  });
});

// SHUFFLE: Mix front and back cards while ensuring both directions per word
let sortedWords = wordsWithBothDirections;
if (shuffleCards) {
  // Full shuffle mode
  sortedWords = [...wordsWithBothDirections].sort(() => Math.random() - 0.5);
} else {
  // Default: Mix directions for each word (sometimes En→Native first, sometimes Native→En first)
  const shuffledWords = [];
  for (let i = 0; i < srsWords.length; i++) {
    const englishToNative = wordsWithBothDirections[i * 2];
    const nativeToEnglish = wordsWithBothDirections[i * 2 + 1];
    // Randomly decide which direction comes first for this word
    if (Math.random() < 0.5) {
      shuffledWords.push(englishToNative, nativeToEnglish);
    } else {
      shuffledWords.push(nativeToEnglish, englishToNative);
    }
  }
  sortedWords = shuffledWords;
}

console.log(`[Flashcards] Created ${sortedWords.length} cards (${srsWords.length} words × 2 directions), shuffled: ${shuffleCards}`);
setWords(sortedWords);
setAllWordsLoaded(false); // Not all loaded yet
```

console.log(`[Flashcards] Created ${sortedWords.length} cards (${srsWords.length} words × 2 directions)`);
setWords(sortedWords);
setAllWordsLoaded(false); // Not all loaded yet
```

#### Change 2: Removed Goal Checking in `loadMoreCards()`
**Location**: Lines ~720-800

**Before**:
```javascript
// First refresh stats to get current completion counts
const statsResponse = await fetch(`${API_BASE_URL}/api/srs/stats/${language}`);
if (statsResponse.ok) {
  const statsData = await statsResponse.json();
  
  // Check if daily goal is met
  const totalCompleted = ...;
  if (flashcardGoal > 0 && totalCompleted >= flashcardGoal) {
    // Complete the flashcard activity
    await completeFlashcardActivity();
    
    // Show completion screen
    setWords([]); // ❌ THIS CAUSED BLANK SCREEN
    return;
  }
}
```

**After**:
```javascript
// Get more words for review (DO NOT check goal completion here - let user practice)
const reviewResponse = await fetch(`${API_BASE_URL}/api/words-for-review/${language}?limit=50`);
const reviewData = await reviewResponse.json();
const newSrsWords = reviewData.words || [];

if (newSrsWords.length === 0) {
  console.log('[Flashcards] No more cards available from backend');
  // Only NOW show completion screen
  if (completedWords.length > 0) {
    await completeFlashcardActivity();
  }
  setWords([]);
  setAllWordsLoaded(true);
  return;
}
```

#### Change 3: Bidirectional in `loadMoreCards()`
**Location**: Lines ~780-820

**Before**:
```javascript
// Randomly assign card direction
const newWordsWithDirection = newSrsWords.map(word => ({
  ...word,
  cardDirection: Math.random() < 0.5 ? 'english-to-native' : 'native-to-english'
}));
```

**After**:
```javascript
// DETERMINISTIC BIDIRECTIONAL TESTING
const newWordsWithBothDirections = [];
newSrsWords.forEach(word => {
  newWordsWithBothDirections.push({
    ...word,
    cardDirection: 'english-to-native',
    originalWordId: word.id,
  });
  newWordsWithBothDirections.push({
    ...word,
    cardDirection: 'native-to-english',
    originalWordId: word.id,
  });
});

console.log(`[Flashcards] Created ${sortedNewWords.length} new cards (${newSrsWords.length} words × 2 directions)`);
```

#### Change 4: Use `originalWordId` for SRS Updates
**Location**: Lines ~840-870 in `handleSwipe()`

**Before**:
```javascript
setCompletedWords(prev => {
  if (!prev.includes(wordAtIndex.id)) {
    return [...prev, wordAtIndex.id];
  }
  return prev;
});

fetch(`${API_BASE_URL}/api/flashcard/update`, {
  method: 'POST',
  body: JSON.stringify({
    word_id: wordAtIndex.id,
    comfort_level: comfortLevel.comfort_level,
  }),
})
```

**After**:
```javascript
// Track using originalWordId (since we have 2 cards per word now)
const wordIdToTrack = wordAtIndex.originalWordId || wordAtIndex.id;

setCompletedWords(prev => {
  if (!prev.includes(wordIdToTrack)) {
    return [...prev, wordIdToTrack];
  }
  return prev;
});

fetch(`${API_BASE_URL}/api/flashcard/update`, {
  method: 'POST',
  body: JSON.stringify({
    word_id: wordIdToTrack,  // Use original word ID
    comfort_level: comfortLevel.comfort_level,
  }),
})
```

**Why**: Both cards (English→Native and Native→English) represent the same word, so they should update the same SRS state.

#### Change 5: Bidirectional in "Learn More" Button
**Location**: Lines ~1218-1248

**Before**:
```javascript
const extraWordsWithDirection = extraWords.map(word => ({
  ...word,
  cardDirection: Math.random() < 0.5 ? 'english-to-native' : 'native-to-english'
}));
```

**After**:
```javascript
const extraWordsWithBothDirections = [];
extraWords.forEach(word => {
  extraWordsWithBothDirections.push({
    ...word,
    cardDirection: 'english-to-native',
    originalWordId: word.id,
  });
  extraWordsWithBothDirections.push({
    ...word,
    cardDirection: 'native-to-english',
    originalWordId: word.id,
  });
});

// Apply same shuffling logic
let finalWords = extraWordsWithBothDirections;
if (shuffleCards) {
  finalWords = [...extraWordsWithBothDirections].sort(() => Math.random() - 0.5);
} else {
  const shuffledWords = [];
  for (let i = 0; i < extraWords.length; i++) {
    const englishToNative = extraWordsWithBothDirections[i * 2];
    const nativeToEnglish = extraWordsWithBothDirections[i * 2 + 1];
    if (Math.random() < 0.5) {
      shuffledWords.push(englishToNative, nativeToEnglish);
    } else {
      shuffledWords.push(nativeToEnglish, englishToNative);
    }
  }
  finalWords = shuffledWords;
}
```

---

### Frontend: `screens/PracticeScreen.js`

#### Change 6: Fixed Text Node Error
**Location**: Lines ~130-140

**Problem**: Space between JSX expression and text created standalone text node

**Before**:
```javascript
<Text style={[styles.flashcardChipText, { color: '#4A90E2' }]}>
  {srsStats.new_count || 0} new
</Text>
```

**After**:
```javascript
<Text style={[styles.flashcardChipText, { color: '#4A90E2' }]}>
  {`${srsStats.new_count || 0} new`}
</Text>
```

**Applied to both chips**: "X new" and "X reviews"

---

### Backend: `backend/db.py`

#### Change: More Generous New Card Loading
**Location**: Lines ~910-918 in `get_words_for_review()`

**Before**:
```python
# Be generous: allow 2x quota to ensure continuous learning
new_cards_remaining = max(10, (new_cards_quota * 2) - new_cards_completed)
```

**After**:
```python
# Calculate how many new cards to include in this batch
# IMPORTANT: Frontend creates 2 flashcards per word (bidirectional testing)
# So if quota is 10, we need at least 10 words to make 20 cards
# Be generous: allow 3x quota to ensure continuous learning with bidirectional cards
new_cards_remaining = max(10, (new_cards_quota * 3) - new_cards_completed)
```

**Why**: Since frontend now creates 2 cards per word, we need to return more words from backend to maintain smooth flow.

---

## How It Works Now

### Card Creation Flow
1. **Backend returns**: 10 words (based on quota)
2. **Frontend creates**: 20 cards (10 words × 2 directions)
3. **User sees**: 20 flashcards total
4. **SRS tracks**: 10 unique words (both directions update same word state)

### Card Shuffling Behavior
**Default (shuffleCards = false)**:
- Each word's two cards are randomly ordered
- Example with 3 words (A, B, C):
  - Possible order: A-en→native, A-native→en, B-native→en, B-en→native, C-en→native, C-native→en
  - Different each session, but both directions guaranteed per word

**With Shuffle Enabled (shuffleCards = true)**:
- All cards fully randomized
- Example: C-native→en, A-en→native, B-native→en, A-native→en, C-en→native, B-en→native
- Maximum variety, still guaranteed both directions per word

### Example Session
```
Word: "cat" (id: 123)

Card 1: 
  Front: "cat" (English)
  Back: "बिल्ली" (Hindi)
  Direction: english-to-native
  originalWordId: 123

Card 2:
  Front: "बिल्ली" (Hindi) 
  Back: "cat" (English)
  Direction: native-to-english
  originalWordId: 123
```

When user swipes either card:
- Both update word_id=123 in database
- Both count as reviewing the same word
- SRS state reflects combined difficulty across both directions

### Continuous Loading
1. User starts with 20 cards (10 words × 2)
2. Around card 10, system loads more (20 more cards = 10 words × 2)
3. Around card 30, loads more again
4. Continues until backend says "no more words available"
5. Only then shows completion screen

---

## Benefits

### 1. ✅ Deterministic Testing
- **Guaranteed**: Every word is tested both ways
- **Balanced**: Equal exposure to production (En→Native) and recognition (Native→En)
- **Predictable**: No random chance, consistent experience

### 2. ✅ Continuous Practice
- No more blank screens
- Can practice beyond daily goal
- Completion screen only when truly done

### 3. ✅ Better Card Flow
- Frontend: Creates 2 cards per word
- Backend: Returns 3x quota (30 words default = 60 cards)
- Result: Smooth, uninterrupted practice sessions

### 4. ✅ Correct SRS Tracking
- Both card directions update the same word
- SRS algorithm sees combined performance
- Daily quota counts unique words, not cards

---

## Testing Checklist

### Test 1: Bidirectional Cards
- [ ] Start flashcard session
- [ ] Note first word (e.g., "cat")
- [ ] Verify you see "cat → बिल्ली" 
- [ ] Continue swiping
- [ ] Verify you also see "बिल्ली → cat" later
- [ ] Confirm EVERY word appears in both directions

### Test 2: Continuous Loading
- [ ] Start with 10 new cards per day setting
- [ ] Complete 10 cards (swipe all)
- [ ] ✅ **Expected**: More cards load automatically (not blank screen)
- [ ] Complete 20 cards total
- [ ] ✅ **Expected**: Still more cards (if available)
- [ ] Continue until no more words
- [ ] ✅ **Expected**: Completion screen appears

### Test 3: SRS Updates
- [ ] Note a specific word (e.g., "book")
- [ ] Swipe English→Native card as "Easy"
- [ ] Later find Native→English card for same word
- [ ] Swipe it as "Again"
- [ ] Check word state in database
- [ ] ✅ **Expected**: Both swipes updated same word_id
- [ ] ✅ **Expected**: Review count = 2, ease factor adjusted by both

### Test 4: Daily Quota
- [ ] Set new_cards_per_day = 10
- [ ] Start flashcards
- [ ] Count total cards available initially
- [ ] ✅ **Expected**: ~20-30 cards load (10 words × 2 directions, generous buffer)
- [ ] Complete all cards
- [ ] Check srs_daily_quota table
- [ ] ✅ **Expected**: new_cards_completed = 10 (not 20)

### Test 5: Learn More Button
- [ ] Reach completion screen
- [ ] Click "Learn More Cards"
- [ ] ✅ **Expected**: Extra words load as bidirectional cards
- [ ] Verify each word appears in both directions

---

## Database Impact

### No Schema Changes
All changes are in application logic. Database structure remains the same:
- `word_states`: Still tracks one state per word (not per card)
- `srs_daily_quota`: Still counts unique words completed
- `review_history`: Logs both card reviews but references same word_id

### Query Example
```sql
-- Check how many times "cat" was reviewed today
SELECT COUNT(*) 
FROM review_history 
WHERE word_id = 123 
  AND date(reviewed_at) = date('now');
-- Returns: 2 (one for each direction)

-- Check word state (single row)
SELECT * FROM word_states WHERE word_id = 123;
-- Returns: 1 row with combined stats
```

---

## Configuration

### Current Settings (after fix)
```javascript
// Frontend
- Creates 2 cards per word automatically
- No configuration needed

// Backend (db.py)
new_cards_remaining = max(10, (new_cards_quota * 3) - new_cards_completed)
//                         ↑                    ↑
//                    minimum            3x multiplier for bidirectional
```

### Adjust If Needed
To change card flow behavior:

**More aggressive loading** (if users complain about running out):
```python
new_cards_remaining = max(15, (new_cards_quota * 4) - new_cards_completed)
```

**Less aggressive loading** (if too many cards):
```python
new_cards_remaining = max(5, (new_cards_quota * 2) - new_cards_completed)
```

---

## Known Behaviors

### 1. Card Count Doubling
**This is intentional**: If settings say "10 new cards per day", users will see ~20 flashcards (10 words × 2 directions). This is CORRECT behavior for bidirectional testing.

### 2. Multiple Reviews Per Word
**This is intentional**: Same word reviewed twice per session (once each direction). Both reviews update the same SRS state, making the algorithm more accurate.

### 3. Goal Progress
**Important**: Dashboard/goals track WORDS completed, not CARDS reviewed. So completing 20 cards = 10 words toward goal.

---

## Related Files

### Modified
- `screens/FlashcardScreen.js` - Main flashcard logic
- `backend/db.py` - Word loading quota calculation

### Documentation
- `BIDIRECTIONAL_FLASHCARDS_JAN31.md` - Original random implementation
- `FLASHCARD_SRS_ENHANCEMENTS_JAN30.md` - SRS algorithm details
- `FLASHCARD_IMPROVEMENTS_JAN30.md` - Goal completion logic

---

## Status

✅ **COMPLETE** - All changes implemented and ready for testing

### Summary of What Changed
1. ✅ Deterministic bidirectional testing (2 cards per word)
2. ✅ Removed goal checking that caused blank screen
3. ✅ Increased backend quota for continuous flow
4. ✅ Used originalWordId for correct SRS tracking
5. ✅ Updated all loading points (initial, loadMore, learnMore)

### What to Test
- Verify every word appears in both directions
- Confirm no blank screens during practice
- Check that you get enough new cards (should see 20+ cards with 10/day setting)
- Ensure SRS properly tracks both directions as one word
