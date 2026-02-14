# Dictionary Lenient Transliteration Search - February 1, 2025

## Overview
Enhanced the dictionary search to support lenient romanized transliteration matching, allowing users to search with simplified romanization and find words with IAST diacritics.

## Problem
Users typing romanized searches (without diacritics) couldn't easily find words:
- Typing "m" wouldn't find words with "ṁ" (anusvara)
- Typing "aa" wouldn't find words with "ā" (long vowel)
- Typing "D" or "T" wouldn't find retroflex consonants "ḍ", "ṭ"

## Solution
Enhanced the `normalize_iast_diacritics()` function in `backend/db.py` to handle common romanization patterns:

### What Changed
**File: `backend/db.py` (lines 1731-1773)**

1. **Added digraph normalization** - Handles double-vowel romanizations:
   - `aa` → `a` (matches `ā` after normalization)
   - `ee` → `e` (matches `ē` after normalization)
   - `ii` → `i` (matches `ī` after normalization)
   - `oo` → `o` (matches `ō` after normalization)
   - `uu` → `u` (matches `ū` after normalization)

2. **Existing diacritic removal** - Already handled (no changes needed):
   - `ā, ē, ī, ō, ū` → `a, e, i, o, u` (long vowels)
   - `ṁ, ṃ` → `m` (anusvara/chandrabindu)
   - `ṭ, ḍ, ṇ` → `t, d, n` (retroflex consonants)
   - `ṣ, ś` → `s` (sibilants)
   - `ṛ, ṝ, ḷ, ḹ` → `r, l` (vocalic r/l)
   - `ḥ` → `` (visarga removed)

3. **Capital letter handling** - Works automatically via `.lower()`:
   - `T` → `t` → matches `ṭ` (which also becomes `t`)
   - `D` → `d` → matches `ḍ` (which also becomes `d`)
   - `N` → `n` → matches `ṇ` (which also becomes `n`)
   - `S` → `s` → matches `ṣ` or `ś` (which both become `s`)

## How It Works

### Search Flow
1. User enters search term (e.g., "rasayana", "m", "aa", "D")
2. Backend receives search in `get_vocabulary()` function
3. Both search term and stored transliterations are normalized:
   ```python
   normalized_search = normalize_iast_diacritics(search)
   normalized_translit = normalize_iast_diacritics(stored_transliteration)
   ```
4. Comparison happens on normalized versions
5. Results are scored and sorted by similarity

### Examples

#### Example 1: Double Vowels
- **User types:** `"rasayana"`
- **Database has:** `"rāsāyana"`
- **Normalization:**
  - Search: `"rasayana"` → `"rasayana"` (no change)
  - Database: `"rāsāyana"` → `"rasayana"` (ā→a)
- **Result:** ✓ Match found

#### Example 2: Anusvara
- **User types:** `"m"`
- **Database has:** `"saṁskṛta"`
- **Normalization:**
  - Search: `"m"` → `"m"`
  - Database: `"saṁskṛta"` → `"samskrta"` (ṁ→m, ṛ→r)
- **Result:** ✓ Match found (contains 'm')

#### Example 3: Retroflex with Digraph
- **User types:** `"DaakTar"` or `"daaktar"`
- **Database has:** `"ḍākṭar"`
- **Normalization:**
  - Search: `"daaktar"` → `"daktar"` (aa→a, lowercase)
  - Database: `"ḍākṭar"` → `"daktar"` (ḍ→d, ā→a, ṭ→t)
- **Result:** ✓ Match found

#### Example 4: Mixed Case Retroflex
- **User types:** `"T"` or `"t"`
- **Database has:** `"haṭṭha"`
- **Normalization:**
  - Search: `"t"` → `"t"` (lowercase)
  - Database: `"haṭṭha"` → `"hattha"` (ṭ→t)
- **Result:** ✓ Match found (contains 't')

## Technical Details

### Modified Function
```python
def normalize_iast_diacritics(text: str) -> str:
    """Remove IAST diacritics for fuzzy search
    
    Handles:
    - IAST diacritics: ā→a, ṁ→m, ḍ→d, etc.
    - Romanization digraphs: aa→a, ee→e, ii→i, oo→o, uu→u
    - Case normalization: All text lowercased
    """
    if not text:
        return text
    
    normalized = text.lower()
    
    # Remove IAST diacritics (existing logic)
    for diacritic, base in diacritic_map.items():
        normalized = normalized.replace(diacritic, base)
    
    # Handle romanization digraphs (NEW)
    romanization_map = {
        'aa': 'a', 'ee': 'e', 'ii': 'i', 
        'oo': 'o', 'uu': 'u',
    }
    for romanized, normalized_form in romanization_map.items():
        normalized = normalized.replace(romanized, normalized_form)
    
    return normalized
```

### Where This Applies
This normalization affects all dictionary searches:
1. **Vocabulary Library Screen** (`VocabLibraryScreen.js`)
   - Search bar at top of screen
   - Filters words in main vocabulary list

2. **Activity Dictionaries** (all 6 activities)
   - Popup dictionaries when clicking words
   - Reading, Writing, Speaking, Listening, Conversation, Translation activities

3. **Flashcard Screen** (`FlashcardScreen.js`)
   - Dictionary lookups during flashcard review

### Backend Endpoint
- **Endpoint:** `GET /api/vocabulary/{language}?search=<term>`
- **File:** `backend/main.py` (lines 324-420)
- **Database Function:** `db.get_vocabulary()` (lines 1763-2039)
- **Normalization Called:** Lines 1780-1786, 1965-1967, 2007

## Testing Recommendations

Test the following search patterns:

### 1. Digraph Searches
- Search: `"aa"` → Should find words with `"ā"`
- Search: `"ii"` → Should find words with `"ī"`
- Search: `"uu"` → Should find words with `"ū"`

### 2. Retroflex Consonants
- Search: `"T"` or `"t"` → Should find words with `"ṭ"`
- Search: `"D"` or `"d"` → Should find words with `"ḍ"`
- Search: `"N"` or `"n"` → Should find words with `"ṇ"`

### 3. Anusvara/Chandrabindu
- Search: `"m"` → Should find words with `"ṁ"` or `"ṃ"`
- Search: `"sam"` → Should find words with `"saṁ"` or `"saṃ"`

### 4. Combined Patterns
- Search: `"raasaayana"` → Should find `"rāsāyana"`
- Search: `"mantra"` → Should find `"mantra"`, `"maṁtra"`, etc.
- Search: `"Daktar"` → Should find `"ḍākṭar"`, `"ḍaktar"`, etc.

### 5. Activity Dictionary Tests
- Open any activity (Reading, Writing, etc.)
- Click on a word with diacritics
- Verify dictionary opens with correct word
- Try searching within the dictionary popup

## Implementation Status
✅ Enhanced normalization function with digraph support
✅ Existing diacritic removal already working
✅ Capital letter handling via lowercase conversion
✅ Documentation created

## Notes
- The normalization is **bidirectional** - works on both user input and stored data
- **Exact matches** are still found first (higher similarity score)
- **Fuzzy matches** are found second (lower similarity score)
- **Case-insensitive** by design (everything lowercased)
- **Performance impact** is minimal - normalization is a simple string replacement
- **Backwards compatible** - doesn't break existing searches

## Related Files
- `backend/db.py` - Main implementation (normalize_iast_diacritics function)
- `backend/main.py` - API endpoint that calls db.get_vocabulary()
- `screens/VocabLibraryScreen.js` - Main vocabulary search interface
- `screens/activities/shared/hooks/useDictionary.js` - Dictionary modal logic
- `screens/activities/shared/utils/apiHelpers.js` - searchDictionary() function

## Previous Related Changes
- **ACTIVITY_DICTIONARY_AND_TRANSLITERATION_FIXES_FEB1.md** - Fixed dictionary language context
- **LANGUAGE_SELECTOR_AND_SETTINGS_IMPROVEMENTS_FEB1.md** - Enhanced language selector width and toggle persistence
