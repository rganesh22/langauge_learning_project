# Language Levels CSV Update & Backend Reload - Jan 30

## Problem Identified

The initial database update was overwritten because the backend reloads vocabulary from CSV files on startup. The vocabulary CSV files still had the original multi-level distribution (A1, A2, B1, B2, C1).

## Solution Applied

### 1. Updated CSV Source Files

Updated all vocabulary CSV files in the `vocab/` directory:

| CSV File | Level Updated To | Words Updated |
|----------|------------------|---------------|
| `tamil-oxford-5000.csv` | **A1** | 9,877 words |
| `telugu-oxford-5000.csv` | **A2** | 9,875 words |
| `hindi-oxford-5000.csv` | **A2** | 9,875 words |
| `kannada-oxford-5000.csv` | **A2** | 9,877 words |
| `urdu-oxford-5000.csv` | **A1** | 9,875 words |

**Total**: 49,379 words across 5 CSV files

### 2. Backend Reload

After updating the CSV files, the backend server was restarted to reload the vocabulary into the database with the new levels.

## Technical Details

### CSV File Format

Each vocabulary CSV file has the following structure:

```csv
english_word,word_class,{language}_translation,transliteration,verb_transitivity,level
```

**Example** (Tamil):
```csv
english_word,word_class,tamil_translation,transliteration,verb_transitivity,level
a (meaning one),indefinite article,ஒரு,oru,,a1
about,preposition,பற்றி,paṟṟi,,a1
```

### Update Script Used

```python
import csv
import os

vocab_dir = "/Users/raghavganesh/Documents/Code Projects/Language Learning Project/vocab"

level_updates = {
    'tamil-oxford-5000.csv': 'a1',
    'telugu-oxford-5000.csv': 'a2',
    'hindi-oxford-5000.csv': 'a2',
    'kannada-oxford-5000.csv': 'a2',
    'urdu-oxford-5000.csv': 'a1'
}

for filename, new_level in level_updates.items():
    filepath = os.path.join(vocab_dir, filename)
    
    # Read CSV
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames
    
    # Update level column
    for row in rows:
        if 'level' in row:
            row['level'] = new_level
    
    # Write back
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
```

### Backend Vocabulary Loading

The backend loads vocabulary on startup from `backend/db.py`:

```python
def init_db():
    # ... table creation ...
    
    # Load vocabulary from CSV files
    for language in ['tamil', 'telugu', 'hindi', 'kannada', 'urdu', ...]:
        csv_path = f'vocab/{language}-oxford-5000.csv'
        # Delete existing vocabulary
        cursor.execute('DELETE FROM vocabulary WHERE language = ?', (language,))
        # Load from CSV
        # ... insert rows ...
```

**This is why updating the CSV files is permanent** - the database reloads from CSV on each startup.

## Verification

### Database Verification

```sql
SELECT language, level, COUNT(*) as word_count 
FROM vocabulary 
WHERE language IN ('tamil', 'telugu', 'hindi', 'kannada', 'urdu') 
GROUP BY language, level 
ORDER BY language, level;
```

**Results**:
```
hindi|a2|9875
kannada|a2|9877
tamil|a1|9877
telugu|a2|9875
urdu|a1|9875
```

✅ **Confirmed**: All words in each language are now at the specified level.

### Profile Page Verification

The profile page calculates levels using `calculate_user_level()` which:
1. Counts total words at each level
2. Counts mastered words at each level
3. Determines current level based on completion

**Expected Profile Display**:
- **Tamil**: Shows progress towards A1 (0-100% of 9,877 words)
- **Telugu**: Shows progress towards A2 (0-100% of 9,875 words)
- **Hindi**: Shows progress towards A2 (0-100% of 9,875 words)
- **Kannada**: Shows progress towards A2 (0-100% of 9,877 words)
- **Urdu**: Shows progress towards A1 (0-100% of 9,875 words)

### Vocab Page Verification

The vocabulary page filters words by level. Now:
- **Tamil vocab**: All 9,877 words appear under A1 filter
- **Telugu vocab**: All 9,875 words appear under A2 filter
- **Hindi vocab**: All 9,875 words appear under A2 filter
- **Kannada vocab**: All 9,877 words appear under A2 filter
- **Urdu vocab**: All 9,875 words appear under A1 filter

## What Changed

### Before (Original Distribution)

Each language had words distributed across 5 levels:

```
Tamil:   A1(1,553) + A2(1,633) + B1(1,546) + B2(2,736) + C1(2,409) = 9,877
Telugu:  A1(1,552) + A2(1,633) + B1(1,545) + B2(2,736) + C1(2,409) = 9,875
Hindi:   A1(1,553) + A2(1,633) + B1(1,545) + B2(2,736) + C1(2,408) = 9,875
Kannada: A1(1,554) + A2(1,633) + B1(1,545) + B2(2,736) + C1(2,409) = 9,877
Urdu:    A1(1,553) + A2(1,633) + B1(1,545) + B2(2,736) + C1(2,408) = 9,875
```

**Profile would show**: Progress through multiple levels (A0 → A1 → A2 → B1 → B2 → C1)

### After (New Distribution)

Each language now has all words at a single level:

```
Tamil:   A1(9,877) = 9,877
Telugu:  A2(9,875) = 9,875
Hindi:   A2(9,875) = 9,875
Kannada: A2(9,877) = 9,877
Urdu:    A1(9,875) = 9,875
```

**Profile will show**: Progress towards single level (A0 → A1 for Tamil/Urdu, A0 → A2 for others)

## Impact on App Features

### Level Display
- **Before**: Could be at different levels for different languages (e.g., A2 in Tamil, B1 in Hindi)
- **After**: Either A0 or the target level (A1/A2) for each language

### Vocabulary Filters
- **Before**: Could filter by A1, A2, B1, B2, C1 and see different word sets
- **After**: Only one level filter will show words for each language

### Activity Generation
- **Before**: Activities could be generated at different CEFR levels (A1-C1)
- **After**: Activities will be at the user's calculated level (A0, A1, or A2)

### Word Progress
- **Before**: Words would "graduate" through levels as they were mastered
- **After**: All words are already at their final level; progress is measured by mastery state

### Mastery States
The three mastery states still apply:
- **Learning**: New words being studied
- **Familiar**: Words seen multiple times, not yet mastered
- **Mastered**: Words that have been fully learned

**Note**: Word levels (A1, A2) are separate from mastery states (learning, familiar, mastered)

## Why This Approach Works

### Advantages

1. **Permanent Changes**: CSV updates survive backend restarts
2. **Source of Truth**: CSV files are the authoritative source
3. **Clean State**: No orphaned data or level mismatches
4. **Predictable Behavior**: Vocabulary reloads consistently

### Trade-offs

1. **Single Level**: All words in a language are at one level
2. **No Gradual Difficulty**: Can't filter by multiple difficulty levels within a language
3. **Long Learning Path**: Must master ~10,000 words to reach A2 in Telugu/Hindi/Kannada

## Refresh Instructions

If the profile page or vocab page doesn't immediately show the changes:

1. **Refresh the App**: 
   - Pull down to refresh on mobile
   - Press Cmd+R (iOS) or double-tap R (Android) to reload
   - Or completely close and reopen the app

2. **Clear Cache** (if needed):
   - Close app completely
   - Reopen app
   - Navigate to Profile page

3. **Verify Backend**:
   - Check that backend is running: `http://localhost:5001/docs`
   - Check vocabulary endpoint returns correct levels

## Files Modified

### CSV Files Updated
- `/vocab/tamil-oxford-5000.csv` - All 9,877 rows updated to `a1`
- `/vocab/telugu-oxford-5000.csv` - All 9,875 rows updated to `a2`
- `/vocab/hindi-oxford-5000.csv` - All 9,875 rows updated to `a2`
- `/vocab/kannada-oxford-5000.csv` - All 9,877 rows updated to `a2`
- `/vocab/urdu-oxford-5000.csv` - All 9,875 rows updated to `a1`

### Database Updated
- `/backend/fluo.db` - Vocabulary table reloaded from updated CSV files

### Backend Restarted
- Server restarted to load vocabulary with new levels
- All API endpoints now return correct level information

## Verification Commands

### Check CSV Files
```bash
# Check Tamil CSV
grep -c "a1$" vocab/tamil-oxford-5000.csv

# Check Telugu CSV  
grep -c "a2$" vocab/telugu-oxford-5000.csv

# Check Hindi CSV
grep -c "a2$" vocab/hindi-oxford-5000.csv

# Check Kannada CSV
grep -c "a2$" vocab/kannada-oxford-5000.csv

# Check Urdu CSV
grep -c "a1$" vocab/urdu-oxford-5000.csv
```

### Check Database
```sql
-- Verify vocabulary levels
SELECT language, level, COUNT(*) 
FROM vocabulary 
WHERE language IN ('tamil', 'telugu', 'hindi', 'kannada', 'urdu')
GROUP BY language, level;

-- Check word states (mastery levels)
SELECT v.language, ws.mastery_level, COUNT(*) 
FROM word_states ws 
JOIN vocabulary v ON ws.word_id = v.id 
WHERE v.language IN ('tamil', 'telugu', 'hindi', 'kannada', 'urdu')
GROUP BY v.language, ws.mastery_level;
```

### Check Backend API
```bash
# Get Tamil level info
curl http://localhost:5001/api/level/tamil

# Get Telugu level info
curl http://localhost:5001/api/level/telugu

# Get profile data
curl http://localhost:5001/api/profile
```

## Summary

✅ **CSV Files Updated**: All 5 language files updated with new levels
✅ **Backend Reloaded**: Vocabulary reloaded from updated CSV files  
✅ **Database Verified**: All words now at specified levels
✅ **Permanent**: Changes will persist through backend restarts

**Result**: 
- Tamil & Urdu: All words at A1 (9,875-9,877 words each)
- Telugu, Hindi & Kannada: All words at A2 (9,875-9,877 words each)

The profile page and vocabulary page should now reflect these levels correctly!
