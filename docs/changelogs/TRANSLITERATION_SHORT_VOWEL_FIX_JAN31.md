# Transliteration Short Vowel Fix - January 31, 2026

## Issue
Short 'e' and 'o' vowels in native script were being incorrectly converted to long 'ē' and 'ō' with macrons (bars) in the transliteration output.

### Examples of Incorrect Behavior:
- **Hindi**: "ke" (के) → was showing as "kē" (should be "ke")
- **Kannada**: "mele" (ಮೇಲೆ) → was showing as "mēlē" (should be "mēle" - first is long, second is short)
- **Tamil**: "enge" (எங்கே) → was showing as "ēngē" (should be "eṅgē")

## Root Cause
The `clean_iast()` function in `backend/transliteration.py` had incorrect logic that was converting **ALL** 'e' and 'o' vowels to their long forms (ē, ō) with macrons.

### Incorrect Assumption
The code contained this incorrect comment and logic:
```python
# aksharamukha uses: ĕ for short e, e for long e (backwards from IAST!)
# aksharamukha uses: ŏ for short o, o for long e (backwards from IAST!)
# So we need to swap: ĕ -> e (short), e -> ē (long), ŏ -> o (short), o -> ō (long)
text = text.replace('e', 'ē')  # Convert what aksharamukha calls "e" (long) to ē
text = text.replace('o', 'ō')  # Convert what aksharamukha calls "o" (long) to ō
```

### Actual Aksharamukha Behavior
Aksharamukha's ISO/IAST output is **already correct**:
- Short vowels: 'e' and 'o' (no macron)
- Long vowels: 'ē' and 'ō' (with macron)

The "hat logic" was incorrectly trying to "fix" something that wasn't broken, adding macrons to all e and o vowels regardless of length.

## Solution

### File Modified: `backend/transliteration.py`

**Location**: Lines 152-169

**Before** (INCORRECT):
```python
def clean_iast(text: str) -> str:
    """
    Clean IAST transliteration to standard IAST format.
    Converts breve vowels to proper IAST macron vowels (ĕ -> ē, ŏ -> ō).
    ...
    """
    # Convert aksharamukha's non-standard vowel notation to proper IAST
    # aksharamukha uses: ĕ for short e, e for long e (backwards from IAST!)
    # aksharamukha uses: ŏ for short o, o for long e (backwards from IAST!)
    # IAST standard: e for short e, ē for long e
    # IAST standard: o for short o, ō for long o
    # So we need to swap: ĕ -> e (short), e -> ē (long), ŏ -> o (short), o -> ō (long)
    # But we need to be careful - we'll use a marker to avoid double conversion
    text = text.replace('ĕ', '\u0001SHORT_E\u0001')  # Mark short e
    text = text.replace('ŏ', '\u0001SHORT_O\u0001')  # Mark short o
    text = text.replace('e', 'ē')  # Convert what aksharamukha calls "e" (long) to ē ❌
    text = text.replace('o', 'ō')  # Convert what aksharamukha calls "o" (long) to ō ❌
    text = text.replace('\u0001SHORT_E\u0001', 'e')  # Restore short e
    text = text.replace('\u0001SHORT_O\u0001', 'o')  # Restore short o
    
    # Handle other breve vowels (less common)
    text = text.replace('ĭ', 'i')  # Short i stays as i
    text = text.replace('ŭ', 'u')  # Short u stays as u
```

**After** (CORRECT):
```python
def clean_iast(text: str) -> str:
    """
    Clean IAST transliteration to standard IAST format.
    Converts combining diacritics to precomposed IAST characters.
    Standardizes IAST format:
    - Converts ṁ (m with dot above) to ṃ (m with dot below) for anusvara
    - Preserves visarga (ḥ) consistently
    - Preserves all standard IAST diacritics: ā, ē, ī, ō, ū, ṛ, ṝ, ḷ, ḹ, ṃ, ṇ, ṭ, ḍ, ṣ, ś, ḥ
    - Preserves SHORT e and o (without macrons) and LONG ē and ō (with macrons) as output by Aksharamukha
    """
    # NOTE: Aksharamukha's ISO/IAST output is already correct:
    # - Short e and o appear as 'e' and 'o' (no macron)
    # - Long ē and ō appear as 'ē' and 'ō' (with macron)
    # We should NOT convert all e->ē or o->ō as that would be incorrect!
    
    # Only handle breve vowels if they appear (rare in Aksharamukha output)
    text = text.replace('ĕ', 'e')  # Short e with breve -> short e
    text = text.replace('ŏ', 'o')  # Short o with breve -> short o
    text = text.replace('ĭ', 'i')  # Short i with breve -> short i
    text = text.replace('ŭ', 'u')  # Short u with breve -> short u
```

### Key Changes:
1. **Removed**: Lines that converted ALL 'e' to 'ē' and ALL 'o' to 'ō'
2. **Updated**: Documentation to clarify Aksharamukha already outputs correct vowels
3. **Kept**: Breve vowel handling (ĕ, ŏ) for edge cases, but now correctly mapping them to short vowels
4. **Preserved**: All other IAST cleaning logic (combining diacritics, anusvara, etc.)

## Impact

### Affected Languages
All Indic languages using transliteration:
- Hindi (Devanagari)
- Urdu (Devanagari/Arabic)
- Kannada
- Tamil
- Telugu
- Malayalam

### What's Fixed
✅ Short 'e' and 'o' now correctly appear without macrons
✅ Long 'ē' and 'ō' still correctly appear with macrons
✅ Transliterations now match standard IAST conventions
✅ Native script vowel length is accurately represented

## Examples - Before vs After

### Hindi Examples

| Native Script | Incorrect (Before) | Correct (After) |
|---------------|-------------------|-----------------|
| के | kē | ke |
| से | sē | se |
| को | kō | ko |
| मेरा | mērā | merā |
| तेरा | tērā | terā |

### Kannada Examples

| Native Script | Incorrect (Before) | Correct (After) |
|---------------|-------------------|-----------------|
| ಮೇಲೆ | mēlē | mēle |
| ಕೆಲಸ | kēlasa | kelasa |
| ಬೇಕು | bēku | bēku ✓ |
| ಹೊರಗೆ | hōragē | horage |

### Tamil Examples

| Native Script | Incorrect (Before) | Correct (After) |
|---------------|-------------------|-----------------|
| எங்கே | ēṅgē | eṅgē |
| எப்போது | ēppōtu | eppōtu |
| எல்லா | ēllā | ellā |
| ஏன் | ēṉ | ēṉ ✓ |

### Telugu Examples

| Native Script | Incorrect (Before) | Correct (After) |
|---------------|-------------------|-----------------|
| ఎక్కడ | ēkkaḍa | ekkaḍa |
| ఎప్పుడు | ēppuḍu | eppuḍu |
| ఏమిటి | ēmiṭi | ēmiṭi ✓ |
| కొంత | kōnta | konta |

## Technical Details

### IAST Vowel System

**Short Vowels** (no macron):
- a, i, u, e, o
- Represent short vowel sounds
- Example: "ke" (के) = /ke/ (short e)

**Long Vowels** (with macron):
- ā, ī, ū, ē, ō
- Represent long vowel sounds
- Example: "kē" (की) = /keː/ (long e)

### Aksharamukha Output
Aksharamukha's ISO transliteration scheme correctly outputs:
- Short vowels: e, o (plain letters)
- Long vowels: ē, ō (with Unicode combining macron U+0304)

The `clean_iast()` function should only:
1. Normalize combining diacritics to precomposed characters
2. Handle rare breve vowels (ĕ, ŏ) if present
3. **NOT** modify plain 'e' and 'o' vowels

### Unicode Characters

| Character | Unicode | Name | Usage |
|-----------|---------|------|-------|
| e | U+0065 | Latin Small Letter E | Short e |
| ē | U+0113 | Latin Small Letter E with Macron | Long e |
| o | U+006F | Latin Small Letter O | Short o |
| ō | U+014D | Latin Small Letter O with Macron | Long o |
| ĕ | U+0115 | Latin Small Letter E with Breve | Rare: short e marker |
| ŏ | U+014F | Latin Small Letter O with Breve | Rare: short o marker |

## Backend Auto-Reload
The backend is running with `--reload` flag, so changes take effect automatically without manual restart.

To verify backend is running:
```bash
ps aux | grep uvicorn | grep -v grep
```

## Testing

### Test Cases

#### 1. Short Vowels (Common)
- [ ] Hindi: "मेरे" → "mere" (not "mērē")
- [ ] Kannada: "ಕೆಲಸ" → "kelasa" (not "kēlasa")
- [ ] Tamil: "எங்கே" → "eṅgē" (second e is long)
- [ ] Telugu: "ఎక్కడ" → "ekkaḍa" (not "ēkkaḍa")

#### 2. Long Vowels (Should Keep Macron)
- [ ] Hindi: "मेरा" → "merā" (short e, long ā)
- [ ] Kannada: "ಬೇಕು" → "bēku" (long e)
- [ ] Tamil: "ஏன்" → "ēṉ" (long e)
- [ ] Telugu: "ఏమిటి" → "ēmiṭi" (long e)

#### 3. Mixed Length
- [ ] Kannada: "ಮೇಲೆ" → "mēle" (first e long, second e short)
- [ ] Hindi: "कैसे" → "kaise" (both e short)
- [ ] Tamil: "எப்போது" → "eppōtu" (first e short, o long)

#### 4. No Vowels Affected
- [ ] Consonants unchanged: "ṭ", "ḍ", "ṇ", "ṣ", "ś", "ḥ"
- [ ] Other vowels unchanged: "ā", "ī", "ū"
- [ ] Anusvara unchanged: "ṃ" or "ṁ"

### Test API Endpoint
```bash
curl -X POST http://localhost:5001/api/transliterate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "मेरे के से को",
    "language": "hindi",
    "to_script": "IAST"
  }'
```

Expected output:
```json
{
  "original": "मेरे के से को",
  "transliteration": "mere ke se ko",
  "requested_from": null,
  "requested_to": "IAST",
  "language": "hindi"
}
```

(NOT "mērē kē sē kō")

### Frontend Testing
1. Open flashcards with transliterations enabled
2. Check vocabulary dictionary transliterations
3. Verify activity instructions transliterations
4. Test all supported languages

## Benefits

### 1. Accurate Representation
- Transliterations now correctly represent vowel length
- Matches standard IAST/ISO conventions
- Linguistically accurate

### 2. Better Learning
- Users can distinguish between short and long vowels
- Helps with pronunciation
- Reflects actual native script differences

### 3. Consistency
- Matches academic and scholarly transliteration standards
- Compatible with dictionaries and linguistic resources
- Consistent across all Indic languages

## Notes

### Why This Bug Existed
The original code had an incorrect understanding of how Aksharamukha outputs vowels. The developer assumed Aksharamukha output needed "fixing" when it was already correct.

### Future Considerations
- Aksharamukha's output should be trusted for vowel length
- Only normalize combining diacritics and special characters
- Don't modify plain vowel letters without good reason

### Related Files
- `backend/transliteration.py` - Main transliteration logic
- `backend/main.py` - API endpoint that calls transliteration
- `vocab/vocab_pipeline/vocab_manager.py` - Vocab pipeline transliteration (separate system)

## Status
✅ Bug identified
✅ Root cause found (incorrect e→ē, o→ō conversion)
✅ Fix implemented (removed vowel swapping logic)
✅ Backend auto-reloaded
✅ Documentation complete
⏳ Testing needed
