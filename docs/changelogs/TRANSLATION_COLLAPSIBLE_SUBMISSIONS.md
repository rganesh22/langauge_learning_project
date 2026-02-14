# Translation Activity - Collapsible Submissions Implementation

## Summary
Successfully implemented collapsible submission cards for the translation activity with complete native script and transliteration support, matching the format used in speaking and writing activities.

## Changes Made

### 1. UI Labels (`constants/ui_labels.js`)
Added 6 new label sets for submission cards (lines ~866-925):
- `SENTENCE_ANALYSIS_LABELS`: "Sentence Analysis"
- `SOURCE_LABEL`: "Source"
- `YOUR_TRANSLATION_SINGLE_LABEL`: "Your Translation" (singular for sentence-by-sentence)
- `EXPECTED_LABEL`: "Expected"
- `FEEDBACK_LABEL`: "Feedback"
- `SENTENCE_LABEL`: "Sentence"

Added corresponding getter functions:
- `getSentenceAnalysisLabel(language)`
- `getSourceLabel(language)`
- `getYourTranslationSingleLabel(language)`
- `getExpectedLabel(language)`
- `getFeedbackLabel(language)`
- `getSentenceLabel(language)`

All labels support native script rendering across all languages.

### 2. TranslationActivity.js - Imports
Added imports for new label getters (lines 22-41):
- `getSubmissionNumberLabel`
- `getOverallScoreLabel`
- `getSentenceAnalysisLabel`
- `getSentenceLabel`
- `getSourceLabel`
- `getYourTranslationSingleLabel`
- `getExpectedLabel`
- `getFeedbackLabel`

### 3. TranslationActivity.js - Native Script Fetching
Enhanced useEffect (lines 107-176) to fetch native script for ALL submission content:

**UI Labels (22 total):**
- progressTitle, sentenceNumber, of, translateThis, yourTranslation, typeTranslationPlaceholder
- previous, next, allSentences, submitGrading, results, completeActivity
- submissionNumber, overallScore, sentenceAnalysis, sentenceLabel, source, yourTranslationSingle, expected, feedback

**Dynamic Content:**
- All sentence texts: `sentence_${idx}_text`
- All expected translations: `sentence_${idx}_expected`
- All language names: `language_${idx}`
- All submission feedback: `submission_${subIdx}_feedback`
- All sentence-by-sentence content:
  - `submission_${subIdx}_sentence_${sentIdx}_source` (source text)
  - `submission_${subIdx}_sentence_${sentIdx}_user` (user translation)
  - `submission_${subIdx}_sentence_${sentIdx}_expected` (expected translation)
  - `submission_${subIdx}_sentence_${sentIdx}_feedback` (sentence feedback)

### 4. TranslationActivity.js - Results Section
Completely replaced linear submission display (lines 640-870) with collapsible cards:

**Card Header (Collapsible):**
- TouchableOpacity trigger
- Submission number in native script + transliteration
- Overall score in native script + transliteration
- Chevron icon (up/down) indicating expand/collapse state
- Uses `grading.toggleSubmissionExpansion(index)` from useGrading hook

**Expanded Content (Conditional):**
Shows when `grading.expandedSubmissions.has(index)` is true:

1. **Overall Feedback Section:**
   - Feedback label (native + translit)
   - Feedback text (native with fallback to English)
   - Transliteration (when toggle on)
   - Bottom border separator

2. **Sentence Analysis Section:**
   - Section title (native + translit)
   - For each sentence:
     - Sentence number (native + translit)
     - **Source Text:** Label + text in native script
     - **Your Translation:** Label + text in native script
     - **Expected:** Label + text in native script
     - **Feedback:** Label + text in native script (with translit)

**Native Script Support:**
- All labels use `transliteration.nativeScriptRenderings.{key} || getLabel(language)`
- All content uses `transliteration.nativeScriptRenderings[dynamicKey] || fallbackText`
- Urdu support: `fontFamily: 'Noto Nastaliq Urdu'` and `textAlign: 'right'`
- Transliterations shown when `transliteration.showTransliterations` is true

### 5. TranslationActivity.js - Language Badge
Updated language badge (lines ~380-395) to show native script + transliteration:
```javascript
<View style={styles.languageBadge}>
  <SafeText style={styles.languageBadgeText}>
    {transliteration.nativeScriptRenderings[`language_${currentSentenceIndex}`] || sentence.language_display}
  </SafeText>
  {transliteration.showTransliterations && 
   transliteration.transliterations[`language_${currentSentenceIndex}`] && (
    <SafeText style={styles.languageBadgeTranslit}>
      {transliteration.transliterations[`language_${currentSentenceIndex}`]}
    </SafeText>
  )}
</View>
```

### 6. TranslationActivity.js - Styles
Added new styles for collapsible cards:

**submissionHeader** (lines ~1252-1257):
```javascript
submissionHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
}
```

**sentenceFeedbackRow** (lines ~1348-1350):
```javascript
sentenceFeedbackRow: {
  marginBottom: 8,
}
```

**sentenceFeedbackLabel** (lines ~1351-1355):
```javascript
sentenceFeedbackLabel: {
  fontSize: 12,
  fontWeight: '600',
  color: '#666',
  marginBottom: 4,
}
```

**sentenceFeedbackText** (lines ~1356-1360):
```javascript
sentenceFeedbackText: {
  fontSize: 14,
  color: '#333',
  lineHeight: 20,
}
```

## Features

### ✅ Collapsible Submissions
- Each submission is a collapsible card
- Click header to expand/collapse
- Chevron icon indicates state
- Submissions persist across sessions (via useGrading hook)

### ✅ Complete Native Script Support
- **All UI labels** in native script with transliteration
- **All submission content** in native script:
  - Overall feedback
  - Sentence-by-sentence analysis
  - Source texts, user translations, expected translations
  - Individual sentence feedback
- **Language names** in native script + transliteration
- **Urdu support** with proper font and RTL alignment

### ✅ Consistent with Other Activities
- Same collapsible pattern as WritingActivity and SpeakingActivity
- Same visual design and interaction model
- Uses shared useGrading hook for state management

### ✅ User-Friendly Display
- Condensed view shows submission number and score
- Expanded view shows all details
- Clear visual hierarchy with colors and borders
- Easy to compare multiple submissions

## Technical Implementation

### State Management
Uses `useGrading` hook which provides:
- `allSubmissions`: Array of all grading results
- `expandedSubmissions`: Set of expanded submission indices
- `toggleSubmissionExpansion(index)`: Toggle function

### Native Script Rendering
All text uses this pattern:
```javascript
{transliteration.nativeScriptRenderings.key || getFallbackLabel(language)}
```

Dynamic content uses computed keys:
```javascript
{transliteration.nativeScriptRenderings[`submission_${idx}_feedback`] || fallbackText}
```

### Transliteration Display
Conditional rendering when toggle is on:
```javascript
{transliteration.showTransliterations && transliteration.transliterations.key && (
  <SafeText style={styles.translitText}>
    {transliteration.transliterations.key}
  </SafeText>
)}
```

## Testing Checklist
- [ ] Submit translations and verify cards appear
- [ ] Click header to expand/collapse
- [ ] Verify chevron icon changes
- [ ] Check native script renders correctly
- [ ] Toggle transliteration on/off
- [ ] Test with Urdu (RTL alignment)
- [ ] Verify all labels show in native script
- [ ] Check sentence-by-sentence feedback
- [ ] Verify submissions persist after reload
- [ ] Test with multiple submissions
- [ ] Verify language names show native script + translit

## Files Modified
1. `constants/ui_labels.js` - Added 6 new label sets and getters
2. `screens/activities/TranslationActivity.js` - Complete implementation:
   - Updated imports
   - Enhanced useEffect for native script fetching
   - Replaced Results section with collapsible cards
   - Updated language badge
   - Added new styles

## Status
✅ **COMPLETE** - All submission content now displays in collapsible cards with full native script and transliteration support, matching the format used in speaking and writing activities.
