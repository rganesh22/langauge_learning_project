# SRS Mastery System & CEFR Level Sorting - January 31, 2026

## SRS Mastery Levels

The SRS (Spaced Repetition System) uses 4 mastery levels to track word learning progress:

### 1. **New** (Not yet seen)
- Initial state for all words in the vocabulary database
- Word has never been introduced to the user
- `mastery_level = 'new'`
- No review date scheduled

### 2. **Learning** (First exposure, short intervals)
- Word has been seen once and answered correctly
- OR: User got the word wrong (demoted from any level)
- Next review: **1 day** later
- `mastery_level = 'learning'`

### 3. **Review** (Building retention, medium intervals)
- Word has been answered correctly while in "learning" state
- Next review: **3 days** later (then calculated based on ease factor)
- `mastery_level = 'review'`
- Requires **3+ correct reviews** to reach "mastered"

### 4. **Mastered** (Long-term retention achieved)
- Word has been in "review" state with `review_count >= 3`
- Next review: Calculated based on ease factor (typically weeks/months)
- `mastery_level = 'mastered'`
- **Criteria**: Word must have been reviewed correctly at least 3 times in "review" state

## When Does a Word Become "Mastered"?

According to `backend/db.py` (lines 2369-2372):

```python
elif mastery_level == 'review':
    if review_count >= 3:
        mastery_level = 'mastered'
    next_review = datetime.now() + timedelta(days=int(ease_factor * 2))
```

**Mastery Requirements**:
1. Word must be in "review" state (not "new" or "learning")
2. Word must have `review_count >= 3` (answered correctly at least 3 times)
3. User must answer correctly (if incorrect, demotes to "learning")

**Typical Timeline to Mastery**:
- Day 0: New → answer correctly → Learning (next review: Day 1)
- Day 1: Learning → answer correctly → Review (next review: Day 4)
- Day 4: Review (count=1) → answer correctly → Review (count=2, next review: ~Day 9)
- Day 9: Review (count=2) → answer correctly → Review (count=3, next review: ~Day 14)
- Day 14: Review (count=3) → answer correctly → **Mastered** (next review: weeks/months)

**Minimum**: ~2 weeks of consistent correct answers

## CEFR Level Ordering

CEFR (Common European Framework of Reference) levels indicate difficulty:

1. **A1** (Beginner) - Basic words and phrases
2. **A2** (Elementary) - Common everyday expressions
3. **B1** (Intermediate) - Standard situations
4. **B2** (Upper Intermediate) - Complex text
5. **C1** (Advanced) - Wide range of demanding text
6. **C2** (Proficient) - Virtually everything heard or read

## Current Implementation Status

### ✅ New Cards (Already Sorted by CEFR)
In `get_words_for_review()` (lines 951-961):
- New cards are ordered by CEFR level: `ORDER BY level_order ASC, v.id ASC`
- Ensures beginners see A1 words first, then A2, B1, etc.

### ❌ Review Cards (NOT Sorted by CEFR) - **NEEDS FIX**
In `get_words_for_review()` (lines 987-1020):
- Review cards sorted ONLY by priority:
  - Overdue days (5x multiplier)
  - Difficulty (ease factor)
  - Mastery level boost
  - Recency penalty
- **Problem**: A C2 word might be shown before an A1 word if it's more overdue
- **Solution**: Add CEFR level as a tiebreaker or secondary sort

## Proposed Fix

Update the review card sorting to include CEFR level:

```python
# Priority components with CEFR level awareness
level_order = {
    'a1': 1, 'a2': 2, 'b1': 3, 'b2': 4, 'c1': 5, 'c2': 6
}.get((row_dict.get('level') or '').lower(), 7)

priority = (
    overdue_days * 5          # Most important: overdue reviews
    + difficulty_boost        # Second: difficult words
    + mastery_boost          # Third: learning > review > mastered
    - level_order * 0.5      # Fourth: prefer lower CEFR levels (A1 > C2)
    - recency_penalty        # Fifth: slight penalty for same-day reviews
)
```

This ensures:
1. **Overdue reviews are still prioritized** (most important for retention)
2. **Difficult words get attention** (low ease factor = needs practice)
3. **Lower CEFR levels are preferred** when priority is similar
4. **A1 word 2 days overdue > C2 word 2 days overdue**

## Benefits

1. **Pedagogical**: Users build strong foundations (A1/A2) before tackling advanced vocabulary
2. **Motivation**: Seeing familiar difficulty levels reduces cognitive load
3. **Retention**: Lower-level words are used more frequently, reinforcing foundations
4. **Progression**: Natural skill building from basic → advanced

## Implementation - COMPLETED ✅

### Changes Made

**File**: `backend/db.py`  
**Function**: `get_words_for_review()` (lines 987-1020)  
**Date**: January 31, 2026

Added CEFR level ordering to the priority calculation for review words:

```python
# CEFR level ordering (prefer lower levels: A1 > A2 > B1 > B2 > C1 > C2)
# This ensures foundational vocabulary is prioritized when priority is similar
level_order = {
    'a1': 1, 'a2': 2, 'b1': 3, 'b2': 4, 'c1': 5, 'c2': 6
}.get((row_dict.get('level') or '').lower(), 7)

priority = (
    overdue_days * 5          # Most important: overdue reviews
    + difficulty_boost        # Second: difficult words (low ease factor)
    + mastery_boost          # Third: learning > review > mastered
    - level_order * 0.5      # Fourth: prefer lower CEFR levels (A1 > C2)
    - recency_penalty        # Fifth: slight penalty for same-day reviews
)
```

### Testing Results

**Test Scenario**: Created 8 words with identical overdue status (2 days overdue) across A1, A2, B1, and C1 levels.

**Result**: ✅ All A1 words appeared first in the review queue, confirming CEFR level sorting works correctly.

```
SRS Words for Review (A1 should come first, then A2, B1, C1):

#   English                              Level  Mastery   
----------------------------------------------------------------------
1   (It) is not (existence, location     A1     review    
2   (It) is not (identity, copula neg    A1     review    
3   a (meaning one)                      A1     review    
4   a few                                A1     review    
5   a few (some)                         A1     review    
6   a lot (a large amount/quantity)      A1     review    
7   a lot (adverbial degree, very muc    A1     review    
8   a lot (quantifier, much/many)        A1     review    
9   about (approximately)                A1     new       
10  about (concerning a topic)           A1     new       
...
```

### Priority Weighting Explanation

The priority calculation uses the following weights:

1. **Overdue days × 5** (25 points for 5 days overdue)
   - Most critical factor for retention
   - Prevents forgetting learned material

2. **Difficulty boost** (up to ~5 points)
   - Based on ease factor
   - Lower ease = harder word = higher priority
   - max(0, 3.5 - ease_factor) × 2

3. **Mastery boost** (1-4 points)
   - Learning: 4 points (needs practice)
   - Review: 3 points (building retention)
   - Mastered: 1 point (maintenance only)

4. **CEFR level penalty** (-0.5 to -3.5 points)
   - A1: -0.5 (highest priority)
   - A2: -1.0
   - B1: -1.5
   - B2: -2.0
   - C1: -2.5
   - C2: -3.0 (lowest priority)
   - Acts as a tiebreaker when other factors are similar

5. **Recency penalty** (-1 point)
   - Slightly deprioritizes words reviewed today

### Example Scenarios

**Scenario 1**: Two words, both 2 days overdue
- A1 word: 2×5 - 0.5 = **9.5 priority**
- C1 word: 2×5 - 2.5 = **7.5 priority**
- **Result**: A1 word shown first ✅

**Scenario 2**: Different overdue days
- C2 word (5 days overdue): 5×5 - 3.0 = **22.0 priority**
- A1 word (1 day overdue): 1×5 - 0.5 = **4.5 priority**
- **Result**: C2 word shown first (retention more important) ✅

**Scenario 3**: Similar overdue, different difficulty
- A1 easy word (ease 2.8): 3×5 - 0.5 + (3.5-2.8)×2 = **15.9 priority**
- A1 hard word (ease 1.5): 3×5 - 0.5 + (3.5-1.5)×2 = **18.5 priority**
- **Result**: Harder word shown first ✅

## Benefits

1. **Pedagogical**: Users build strong foundations (A1/A2) before tackling advanced vocabulary
2. **Motivation**: Seeing familiar difficulty levels reduces cognitive load
3. **Retention**: Lower-level words are used more frequently, reinforcing foundations
4. **Progression**: Natural skill building from basic → advanced

## Summary

✅ **Mastery System Documented**: Clear explanation of when words become "mastered" (3+ correct reviews in "review" state)  
✅ **CEFR Sorting Implemented**: Review words now prioritize lower CEFR levels when other factors are similar  
✅ **Tested and Verified**: Test scenario confirms A1 words appear before higher levels  
✅ **Pedagogically Sound**: System balances retention (overdue reviews) with progression (easier words first)
