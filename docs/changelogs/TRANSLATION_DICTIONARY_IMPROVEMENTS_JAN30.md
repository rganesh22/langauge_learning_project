# Translation Activity Dictionary Improvements - January 30, 2026

## Summary

Enhanced the dictionary functionality in translation activities to make ALL text clickable for word lookups, updated the dictionary language selector to match the style of other screens, and enabled automatic language switching when clicking words in different languages.

---

## Changes Made

### 1. ✅ Enhanced useDictionary Hook

**File**: `screens/activities/shared/hooks/useDictionary.js`

**Changes**:
- Added `dictionaryLanguage` state to track which language the dictionary should show
- Added `setDictionaryLanguage` function to change dictionary language
- Updated `handleWordClick` to accept optional `wordLanguage` parameter
- When clicking a word, if `wordLanguage` is provided, dictionary switches to that language

**Before**:
```javascript
export function useDictionary(language) {
  const [showDictionary, setShowDictionary] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');

  const handleWordClick = (word) => {
    setInitialSearchQuery(word.trim());
    setShowDictionary(true);
  };
}
```

**After**:
```javascript
export function useDictionary(defaultLanguage) {
  const [showDictionary, setShowDictionary] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [dictionaryLanguage, setDictionaryLanguage] = useState(defaultLanguage);

  const handleWordClick = (word, wordLanguage = null) => {
    setInitialSearchQuery(word.trim());
    if (wordLanguage) {
      setDictionaryLanguage(wordLanguage);
    }
    setShowDictionary(true);
  };

  return {
    // ... existing
    dictionaryLanguage,
    setDictionaryLanguage,
    handleWordClick
  };
}
```

---

### 2. ✅ Updated VocabularyDictionary Language Selector

**File**: `screens/activities/shared/components/VocabularyDictionary.js`

#### A. Updated Props and State
- Added `dictionaryLanguage` and `setDictionaryLanguage` props
- Language now syncs with parent component's dictionary hook
- Falls back to `initialLanguage` if no `dictionaryLanguage` provided

#### B. Redesigned Language Selector Modal
**Matches PracticeScreen style**:
- Removed old header with close button inside modal
- Simplified to title + list of languages
- Added large colorful badges (40x40) with native characters
- Added selection checkmark with blue color (#4A90E2)
- Rounded corners (borderRadius: 12 on items, 16 on container)
- Cleaner padding and spacing

**New Styles**:
```javascript
languageMenuContainer: {
  width: '85%',
  maxWidth: 400,
  maxHeight: '70%',
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 8,
},
languageMenuItem: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  borderRadius: 12,
  marginVertical: 4,
  marginHorizontal: 8,
},
languageMenuItemSelected: {
  backgroundColor: '#E8F4FD',
},
langBadgeLarge: {
  width: 40,
  height: 40,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
```

#### C. Language Change Callback
When language is changed, it now calls `setDictionaryLanguage` to update the parent component's state.

---

### 3. ✅ Made All Text Clickable in TranslationActivity

**File**: `screens/activities/TranslationActivity.js`

#### A. Added renderText Function
Similar to ReadingActivity, created a function that splits text into words and makes each word clickable:

```javascript
const renderText = (text, style = {}, enableWordClick = false, wordLanguage = null) => {
  const safeText = normalizeText(text);
  
  if (!enableWordClick) {
    return <SafeText style={style}>{safeText}</SafeText>;
  }
  
  // Split text into words and punctuation
  const words = safeText.split(/(\s+|[.,!?;:—\-()[\]{}\"\']+)/);
  
  // Detect Arabic/Urdu script and apply Nastaliq font
  const hasArabicScript = isArabicScript(safeText);
  const urduFontStyle = hasArabicScript ? { fontFamily: 'Noto Nastaliq Urdu' } : {};
  const combinedStyle = hasArabicScript ? [style, urduFontStyle] : style;
  
  return (
    <Text style={combinedStyle}>
      {words.map((word, idx) => {
        const isWord = word.trim() && !/^[\s.,!?;:—\-()[\]{}\"\']+$/.test(word);
        
        if (!isWord) {
          return <Text key={idx} style={urduFontStyle}>{word}</Text>;
        }
        
        return (
          <Text
            key={idx}
            style={[{ color: style.color }, urduFontStyle]}
            onPress={() => dictionary.handleWordClick(word.trim(), wordLanguage)}
          >
            {word}
          </Text>
        );
      })}
    </Text>
  );
};
```

#### B. Updated All Text Rendering
Replaced all `SafeText` components with `renderText()` calls for:

1. **Source Sentences** (Current sentence view)
   - Source text: clickable, language = sentence.language
   - Transliteration: clickable, language = sentence.language

2. **Overall Feedback** (Submission results)
   - Feedback text: clickable, language = activity language
   - Feedback transliteration: clickable, language = activity language

3. **Sentence-by-Sentence Feedback** (Submission details)
   - Source text: clickable, language = source sentence language
   - User translation: clickable, language = activity language
   - Expected translation: clickable, language = activity language
   - Feedback: clickable, language = activity language
   - Feedback transliteration: clickable, language = activity language

#### C. Updated VocabularyDictionary Props
```javascript
<VocabularyDictionary
  visible={dictionary.showDictionary}
  onClose={() => dictionary.setShowDictionary(false)}
  language={language}
  initialSearchQuery={dictionary.initialSearchQuery}
  dictionaryLanguage={dictionary.dictionaryLanguage}
  setDictionaryLanguage={dictionary.setDictionaryLanguage}
/>
```

---

## User Experience Improvements

### Before:
- ❌ Text was not clickable for dictionary lookup
- ❌ Dictionary language selector had old style (different from other screens)
- ❌ Dictionary always opened in activity language, even for foreign language words
- ❌ No way to look up words from different languages in translations

### After:
- ✅ **Every word is clickable** - source sentences, translations, feedback, transliterations
- ✅ **Dictionary language selector matches Practice/Vocab screens** - modern, clean design
- ✅ **Smart language switching** - clicking a Hindi word opens Hindi dictionary, clicking a Kannada word opens Kannada dictionary
- ✅ **Default to activity language** - dictionary opens in activity language by default
- ✅ **Manual language switching** - can still manually switch dictionary language via selector

---

## Visual Changes

### Dictionary Language Selector

**Before**:
```
┌─────────────────────────────────────┐
│ Dictionary              [KA] [X]    │
├─────────────────────────────────────┤
│                                     │
│ ○ Kannada                        ✓  │
│ ○ Hindi                             │
│ ○ Telugu                            │
│                                     │
└─────────────────────────────────────┘
```

**After** (Matches PracticeScreen):
```
┌────────────────────────────────┐
│  Select Language               │
│                                │
│  ┌──────────────────────────┐ │
│  │ [ಕ] Kannada              │ │
│  │     ಕನ್ನಡ            ✓   │ │
│  └──────────────────────────┘ │
│                                │
│  ┌──────────────────────────┐ │
│  │ [हि] Hindi                │ │
│  │      हिंदी                │ │
│  └──────────────────────────┘ │
│                                │
│  ┌──────────────────────────┐ │
│  │ [తె] Telugu               │ │
│  │      తెలుగు               │ │
│  └──────────────────────────┘ │
└────────────────────────────────┘
```

### Clickable Text

**Before**:
```
Translate this:
मैं स्कूल जाता हूं।
Main skool jaata hoon.

[Plain text - not clickable]
```

**After**:
```
Translate this:
[मैं] [स्कूल] [जाता] [हूं]।
[Main] [skool] [jaata] [hoon].

[Each word clickable - opens dictionary]
```

---

## Smart Language Detection

### Example 1: Hindi Source Sentence
```
User viewing Kannada activity
Source sentence: "मैं स्कूल जाता हूं।" (Hindi)
Action: Click on "स्कूल"
Result: Dictionary opens in HINDI with "स्कूल" search
```

### Example 2: Kannada Feedback
```
User viewing Kannada activity
Feedback: "ನಿಮ್ಮ ಅನುವಾದ ಉತ್ತಮವಾಗಿದೆ"
Action: Click on "ಅನುವಾದ"
Result: Dictionary opens in KANNADA with "ಅನುವಾದ" search
```

### Example 3: Transliteration
```
Source transliteration: "Main skool jaata hoon"
Action: Click on "skool"
Result: Dictionary opens in HINDI (source language) with "skool" search
```

---

## Technical Implementation

### Word Click Flow

1. **User clicks word** → `renderText()` captures click
2. **Extract word** → Remove punctuation, trim whitespace
3. **Determine language** → Use `wordLanguage` parameter (source language or activity language)
4. **Update dictionary state** → `dictionary.handleWordClick(word, wordLanguage)`
5. **Set search query** → `setInitialSearchQuery(word)`
6. **Set dictionary language** → `setDictionaryLanguage(wordLanguage)` if provided
7. **Open dictionary** → `setShowDictionary(true)`
8. **Dictionary loads** → Fetches words from correct language
9. **Search filters** → Shows words matching search query

### Language Fallback Chain

```
wordLanguage parameter (from renderText)
  ↓ if null
activity.sentences[idx].language (for source text)
  ↓ if null
language (activity language - Kannada/Hindi/etc.)
  ↓ if null
'kannada' (default)
```

---

## Files Modified

### 1. screens/activities/shared/hooks/useDictionary.js
- **Lines**: Entire file (~30 lines)
- **Changes**: Added dictionary language state and word language parameter

### 2. screens/activities/shared/components/VocabularyDictionary.js
- **Lines**: ~25-60 (props/state), ~515-585 (language selector modal), ~815-870 (styles)
- **Changes**: Updated language selector UI and added parent state sync

### 3. screens/activities/TranslationActivity.js
- **Lines**: ~255-310 (renderText function), ~528-544 (source sentence), ~795-825 (feedback), ~880-970 (sentence feedback), ~1000 (dictionary props)
- **Changes**: Added renderText function and made all text clickable

---

## Testing Checklist

### Dictionary Language Selector
- [x] Opens when clicking language badge
- [x] Shows all active languages
- [x] Displays native characters and names
- [x] Selected language highlighted with blue background
- [x] Checkmark shows on selected language
- [x] Changing language updates dictionary immediately
- [x] Style matches PracticeScreen/VocabScreen

### Word Click Functionality
- [x] Click on source sentence word → dictionary opens with that word
- [x] Click on transliteration word → dictionary opens with that word
- [x] Click on feedback word → dictionary opens with that word
- [x] Click on submission text word → dictionary opens with that word
- [x] Click on translated text word → dictionary opens with that word

### Language Switching
- [x] Click Hindi word → dictionary shows Hindi words
- [x] Click Kannada word → dictionary shows Kannada words
- [x] Click Telugu word → dictionary shows Telugu words
- [x] Manual language switch works
- [x] Dictionary defaults to activity language on open
- [x] Language persists between word clicks

### Edge Cases
- [x] Punctuation not clickable
- [x] Whitespace not clickable
- [x] Urdu text shows with Nastaliq font
- [x] Empty words ignored
- [x] Special characters handled correctly

---

## Benefits

1. **Comprehensive Dictionary Access**: Every word in the activity is now a potential learning opportunity
2. **Context-Aware Language**: Dictionary automatically switches to the correct language for multilingual content
3. **Consistent UI**: Language selector now matches the rest of the app's design language
4. **Better Learning Experience**: Students can look up unfamiliar words instantly without switching contexts
5. **Supports Multiple Languages**: Works seamlessly with Hindi, Telugu, Kannada, Urdu, and all supported languages
6. **Native Script Support**: Properly handles non-Latin scripts with appropriate fonts

---

## Future Enhancements

- [ ] Add long-press for additional word actions (copy, translate, etc.)
- [ ] Show word definitions in tooltip on hover (web)
- [ ] Track which words users look up for personalized recommendations
- [ ] Add "Add to flashcards" button in dictionary
- [ ] Highlight previously looked-up words in different color

---

## Success Criteria

All criteria met! ✅

- [x] Every piece of text in translation activity is clickable
- [x] Clicking any word opens dictionary with that word
- [x] Dictionary opens in correct language (source language for source text, activity language for translations/feedback)
- [x] Dictionary language selector matches Practice/Vocab screen style
- [x] Language names shown in native script with badges
- [x] Manual language switching works smoothly
- [x] No errors in console
- [x] Works with all supported languages
- [x] Urdu text properly displays with Nastaliq font
- [x] Punctuation and whitespace handled correctly
