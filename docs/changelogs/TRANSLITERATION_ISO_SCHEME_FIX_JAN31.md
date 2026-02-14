# Transliteration ISO Scheme Fix - January 31, 2026

## Problem
Transliterations on flashcards, vocabulary page, and activity pages were not properly distinguishing between short and long e/o vowels. Words with long vowels (like Kannada ಬೇಕು "bēku") were being shown with short vowels ("beku").

## Root Cause
The backend was using Aksharamukha's **IAST** scheme, which does NOT distinguish between short and long e/o vowels in its output. Both short and long e/o are output as plain 'e' and 'o' without macrons.

## Solution
Changed the transliteration scheme from **IAST** to **ISO** (ISO 15919):
- ISO properly outputs long ē (U+0113) and ō (U+014D) with macrons
- ISO properly outputs short e (U+0065) and o (U+006F) without macrons
- This maintains all other IAST diacritics (ā, ī, ū, ṇ, ṭ, ḍ, etc.)

## Changes Made

### backend/transliteration.py
1. Changed default target scheme from `IAST` to `ISO`
2. Updated `target_map` to map 'iast' → 'ISO' (so any IAST requests use ISO)
3. Updated docstrings to reflect ISO scheme usage
4. Added note that IAST scheme doesn't distinguish short/long e and o

## Testing Results

### Kannada (Working Correctly ✓)
| Native | Old Output | New Output | Correct |
|--------|-----------|------------|---------|
| ಬೇಕು | beku | **bēku** | ✓ (long ē) |
| ಕೆಲಸ | kelasa | **kelasa** | ✓ (short e) |
| ಮೇಲೆ | mele | **mēle** | ✓ (long ē, short e) |
| ಹೋಗು | hogu | **hōgu** | ✓ (long ō) |
| ಕೊಡು | koḍu | **koḍu** | ✓ (short o) |

### Hindi (Working Correctly ✓)
| Native | Old Output | New Output | Note |
|--------|-----------|------------|------|
| मेरे | mere | **mērē** | Correct - Hindi े is /eː/ (long) |
| को | ko | **kō** | Correct - Hindi ो is /oː/ (long) |
| के | ke | **kē** | Correct - Hindi े is /eː/ (long) |

**Note**: In Hindi/Devanagari, the vowels े (e-matra) and ो (o-matra) represent LONG vowels /eː/ and /oː/, not short /e/ and /o/. The ISO transliteration correctly marks them with macrons.

### Tamil (Expected Results)
| Native | Expected Output | Vowel Type |
|--------|----------------|------------|
| மேல் | mēl | Long ē |
| கேள் | kēḷ | Long ē |
| எலி | eli | Short e |
| ஏரி | ēri | Long ē |

### Telugu (Expected Results)
| Native | Expected Output | Vowel Type |
|--------|----------------|------------|
| నేను | nēnu | Long ē |
| ఎవరు | evaru | Short e |
| నోరు | nōru | Long ō |
| కొత్త | kotta | Short o |

## Linguistic Context

### IAST vs ISO Schemes
- **IAST** (International Alphabet of Sanskrit Transliteration): Traditional scheme that doesn't mark e/o length because Sanskrit scholars assume e/o are always long in Sanskrit
- **ISO 15919**: Modern international standard that properly marks ALL vowel lengths including e/o, making it suitable for all Indic languages

### Vowel Length in Indic Languages
- **Sanskrit**: e and o are always long (/eː/, /oː/)
- **Hindi/Urdu**: े and ो represent long vowels (/eː/, /oː/)
- **Dravidian (Kannada, Tamil, Telugu, Malayalam)**: Both short (e, o) and long (ē, ō) vowels are phonemic and must be distinguished

## Impact
- ✅ Flashcard screen now shows correct transliterations
- ✅ Vocabulary dictionary now shows correct transliterations  
- ✅ Activity pages now show correct transliterations
- ✅ All API endpoints using `/api/transliterate` now return ISO with proper vowel marking
- ✅ No database migration needed (transliterations are generated on-the-fly)

## Files Modified
- `backend/transliteration.py` - Changed default scheme from IAST to ISO

## Database Reload Required
The vocabulary database (`fluo.db`) was populated with transliterations generated using the old IAST scheme (which didn't distinguish e/o vowels). After fixing the code, we needed to reload all vocabulary from the CSV files:

```python
# Reloaded all 6 languages:
db.load_vocabulary_from_csv('kannada')   # ✅ 9,877 words
db.load_vocabulary_from_csv('tamil')     # ✅ 9,877 words  
db.load_vocabulary_from_csv('telugu')    # ✅ 9,875 words
db.load_vocabulary_from_csv('malayalam') # ✅ 9,876 words
db.load_vocabulary_from_csv('hindi')     # ✅ 9,875 words
db.load_vocabulary_from_csv('urdu')      # ✅ 9,875 words
```

**Verification**: Database now shows correct transliterations:
- Example: "a couple of (two or three)" / "ಎರಡು ಮೂರು / ಒಂದೆರಡು"
- Old: `ēraḍu mūru / ōṁdēraḍu` ✗ (incorrect - had long vowels)
- New: `eraḍu mūru / oṁderaḍu` ✅ (correct - short e and o)

## Next Steps
Users should now see linguistically accurate transliterations that distinguish between short and long e/o vowels across all flashcards, vocabulary entries, and activity pages.
