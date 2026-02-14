# User Level System Update

## Overview
The user level system has been updated to base proficiency levels on **vocabulary completion** rather than arbitrary word count thresholds.

## New Level Calculation Logic

### Level Progression
Users advance through CEFR levels (A0 → A1 → A2 → B1 → B2 → C1 → C2) by **completing all vocabulary words** at each level:

- **A0**: Starting level (fewer than all A1 words mastered)
- **A1**: All A1 words mastered
- **A2**: All A1 + A2 words mastered
- **B1**: All A1 + A2 + B1 words mastered
- **B2**: All A1 + A2 + B1 + B2 words mastered
- **C1**: All A1 + A2 + B1 + B2 + C1 words mastered
- **C2**: All A1 + A2 + B1 + B2 + C1 + C2 words mastered

### Progress Tracking
- Progress percentage shows completion towards the **next level**
- Users must complete **100% of all words** at a level to advance
- Partially completed levels show progress towards that level

## Implementation

### Updated Function: `calculate_user_level(language: str)`
**Location**: `backend/db.py` lines 1819-1900

**Algorithm**:
1. Query total vocabulary words available at each CEFR level
2. Query mastered words count at each CEFR level
3. Iterate through levels in order (A1 → C2)
4. Check if user has mastered ALL words at each level
5. Set current level to highest completed level
6. Calculate progress towards next level

**Return Format**:
```python
{
    'level': 'B2',              # Current CEFR level
    'progress': 45.3,           # Progress to next level (%)
    'total_mastered': 7468,     # Total mastered words
    'next_level': 'C1'          # Next target level
}
```

## Vocabulary Distribution by Language

Based on the Oxford 5000 word lists:

| Language  | A1   | A2   | B1   | B2   | C1   | Total |
|-----------|------|------|------|------|------|-------|
| Tamil     | 1553 | 1633 | 1546 | 2736 | 2409 | 9877  |
| Telugu    | 1552 | 1633 | 1545 | 2736 | 2409 | 9875  |
| Hindi     | 1553 | 1633 | 1545 | 2736 | 2408 | 9875  |
| Kannada   | 1554 | 1633 | 1545 | 2736 | 2409 | 9877  |
| Urdu      | 1553 | 1633 | 1545 | 2736 | 2408 | 9875  |

## Current User Levels

Your current language levels have been set as follows:

| Language | Level | Mastered Words | Progress to Next | Next Level |
|----------|-------|----------------|------------------|------------|
| **Tamil**   | **B2** | 7,468 words | 0% | C1 |
| **Telugu**  | **B1** | 4,730 words | 0% | B2 |
| **Hindi**   | **B1** | 4,731 words | 0% | B2 |
| **Kannada** | **B1** | 4,732 words | 0% | B2 |
| **Urdu**    | **A2** | 3,186 words | 0% | B1 |

### Word Status Distribution

For each language:
- **Mastered words**: All words up to and including your current level
- **Review words**: All words above your current level (marked as 'review' status)

This ensures:
1. Activities use appropriate vocabulary for your level
2. You can practice higher-level words that are due for review
3. Level progression is clear and achievement-based

## Benefits of New System

### 1. **Clear Achievement Goals**
- Users know exactly what's required to advance (complete all level words)
- No arbitrary thresholds or hidden requirements
- Progress is transparent and measurable

### 2. **Language-Specific Progression**
- Each language has its own vocabulary distribution
- System adapts to actual word counts per level
- Fair progression across all languages

### 3. **Accurate Activity Generation**
- AI activities know user's true proficiency level
- Vocabulary selection matches actual knowledge
- Better difficulty calibration

### 4. **Motivation & Engagement**
- Clear milestones encourage completion
- Users see exact progress percentages
- Achievement-based advancement is more rewarding

## Testing & Verification

### Verify Levels
Run this SQL query to check mastered words by level:
```sql
SELECT 
    v.language,
    v.level,
    COUNT(*) as total_words,
    SUM(CASE WHEN ws.mastery_level = 'mastered' THEN 1 ELSE 0 END) as mastered
FROM vocabulary v
LEFT JOIN word_states ws ON v.id = ws.word_id AND ws.user_id = 1
WHERE v.language = 'tamil'
    AND v.level IS NOT NULL
GROUP BY v.language, v.level
ORDER BY v.level;
```

### Set Custom Levels
Use the `set_user_levels.py` script to set specific levels:
```python
from backend.set_user_levels import set_language_level

# Set to specific level
set_language_level('tamil', 'B2')
set_language_level('hindi', 'A2')
```

## Impact on Existing Features

### Activities
All activity generation functions use `calculate_user_level()`:
- Reading activities (`backend/main.py` line 481)
- Listening activities (`backend/main.py` line 812)
- Writing activities (`backend/main.py` line 1192)
- Speaking activities (`backend/main.py` line 918)
- Translation activities (`backend/main.py` line 1047)
- Conversation activities (`backend/main.py` line 1783, 1984)

Activities now automatically:
- Generate content at appropriate CEFR level
- Include vocabulary from completed and current levels
- Adjust difficulty based on true proficiency

### Profile & Dashboard
- User profiles display accurate current levels
- Progress bars show real completion percentage
- Language cards reflect vocabulary-based achievement

## Migration Notes

### Old System vs New System

**Old System** (Fixed thresholds):
- A1: 0-200 words
- A2: 201-500 words
- B1: 501-1,000 words
- B2: 1,001-2,000 words
- C1: 2,001-3,500 words
- C2: 3,501+ words

**New System** (Vocabulary completion):
- A1: Complete all A1 words (~1,550)
- A2: Complete all A1+A2 words (~3,180)
- B1: Complete all A1+A2+B1 words (~4,730)
- B2: Complete all A1+A2+B1+B2 words (~7,470)
- C1: Complete all A1+A2+B1+B2+C1 words (~9,880)
- C2: Complete all words

### Advantages
1. **More realistic**: Reflects actual vocabulary knowledge
2. **Language-agnostic**: Works for any language with CEFR-tagged vocabulary
3. **Clear goals**: Users know exactly what to complete
4. **Better pedagogy**: Aligns with CEFR standards

## Future Enhancements

Potential improvements to the level system:
1. **Partial credit**: Allow advancement with 90-95% completion instead of 100%
2. **Level challenges**: Special assessments to test level mastery
3. **Skill-based levels**: Separate reading/writing/speaking/listening levels
4. **Decay mechanics**: Reduce level if mastered words are forgotten
5. **Accelerated progression**: Skip levels through comprehensive testing

## Files Changed

1. **`backend/db.py`** (lines 1819-1900)
   - Rewrote `calculate_user_level()` function
   - Added level completion checking
   - Updated progress calculation

2. **`backend/set_user_levels.py`** (NEW)
   - Script to set user levels
   - Bulk update word states
   - Verification utilities

3. **User word_states table**
   - Updated mastery levels for all languages
   - Set words to 'mastered' or 'review' based on target levels
