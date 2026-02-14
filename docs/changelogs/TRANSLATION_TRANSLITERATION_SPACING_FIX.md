# Translation Activity - Transliteration Spacing & Language Names Fix

## Summary
Fixed transliteration spacing throughout the translation activity to remove gaps between native script and transliteration. Also updated all language name displays to show native script with transliteration below.

## Changes Made

### 1. Global Transliteration Style
**File:** `screens/activities/TranslationActivity.js`

Updated `translitText` style (line ~1040):
```javascript
translitText: {
  fontSize: 14,
  color: '#666',
  marginTop: 0,  // Changed from 2
  fontStyle: 'italic',
}
```

### 2. Language Badge Transliteration Style
**File:** `screens/activities/TranslationActivity.js`

Added `languageBadgeTranslit` style (line ~1105):
```javascript
languageBadgeTranslit: {
  fontSize: 10,
  opacity: 0.8,
  fontStyle: 'italic',
  marginTop: 0,
}
```

### 3. All Sentences Overview - Language Names
**File:** `screens/activities/TranslationActivity.js`

Updated language display in overview list (lines ~564-604):
- **Before:** Showed language names in English only
- **After:** Shows native script with transliteration below

```javascript
<View style={{ flex: 1 }}>
  <SafeText style={[
    styles.overviewItemLanguage,
    sentence.language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
  ]}>
    {transliteration.nativeScriptRenderings[`language_${index}`] || sentence.language_display || sentence.language}
  </SafeText>
  {transliteration.showTransliterations && transliteration.transliterations[`language_${index}`] && (
    <SafeText style={[
      styles.overviewItemLanguageTranslit,
      sentence.language === 'urdu' && { textAlign: 'right' }
    ]}>
      {transliteration.transliterations[`language_${index}`]}
    </SafeText>
  )}
</View>
```

Added `overviewItemLanguageTranslit` style (line ~1233):
```javascript
overviewItemLanguageTranslit: {
  fontSize: 11,
  color: '#666',
  fontStyle: 'italic',
  marginTop: 0,
}
```

### 4. Removed All Inline marginTop Values
**File:** `screens/activities/TranslationActivity.js`

Replaced all instances of `style={[styles.translitText, { marginTop: X }]}` with `style={styles.translitText}`:

**Submission Cards (lines ~690-870):**
- Submission number transliteration: `marginTop: 2` → removed
- Overall score transliteration: `marginTop: 2` → removed
- Feedback label transliteration: `marginTop: 2` → removed
- Feedback content transliteration: `marginTop: 8` → removed
- Sentence Analysis transliteration: `marginTop: 2` → removed
- Sentence label transliteration: `marginTop: 2` → removed
- Source label transliteration: `marginTop: 2` → removed
- Your Translation label transliteration: `marginTop: 2` → removed
- Expected label transliteration: `marginTop: 2` → removed
- Feedback label transliteration (in sentence): `marginTop: 2` → removed
- Sentence feedback transliteration: `marginTop: 4` → removed

**Result:** All transliterations now render with **NO gap** (marginTop: 0) between native script and transliteration text.

## Features

### ✅ Zero Spacing
- All transliterations now appear directly below their native script
- No visual gaps between native text and transliteration
- Consistent spacing throughout entire activity

### ✅ Language Names in Native Script
- **Current sentence badge:** Shows language in native script + transliteration
- **All Sentences overview:** Shows each language in native script + transliteration
- **Language picker chip:** Will show language in native script + transliteration
- All language names use `language_${index}` key for native rendering

### ✅ Complete Coverage
Updated transliteration spacing for:
- Sentence numbers (e.g., "Sentence 1 of 18" → native + translit with no gap)
- Language badges
- All UI labels
- Submission card headers
- Overall scores
- Feedback sections
- Sentence analysis sections
- All source/user/expected labels
- All sentence-by-sentence feedback

## Visual Impact

### Before:
```
ನಿಮ್ಮ ಅನುವಾದ:
       ↓ 2px gap
nimma anuvāda:
```

### After:
```
ನಿಮ್ಮ ಅನುವಾದ:
nimma anuvāda:  ← No gap!
```

## Testing Checklist
- [ ] Verify "Sentence 1 of 18" shows transliteration directly below
- [ ] Check language badge shows native script + translit with no gap
- [ ] Verify all sentences overview shows languages in native script
- [ ] Check submission cards show transliterations with no gaps
- [ ] Test with Urdu (RTL alignment) - transliterations should align right
- [ ] Toggle transliterations on/off - should show/hide smoothly
- [ ] Check all labels throughout activity have no gaps
- [ ] Verify feedback sections maintain zero spacing

## Files Modified
1. `screens/activities/TranslationActivity.js`:
   - Updated `translitText` style (marginTop: 0)
   - Added `languageBadgeTranslit` style
   - Updated all sentences overview to show native script for languages
   - Added `overviewItemLanguageTranslit` style
   - Removed all inline `marginTop` values from transliteration SafeText components

## Status
✅ **COMPLETE** - All transliterations now display with zero spacing between native script and transliteration. All language names display in native script with transliteration below.
