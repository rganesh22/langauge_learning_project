# Translation Activity UI Improvements

## Date: January 30, 2026

## Changes Made

### 1. Collapsible "All Sentences" Section

**Problem**: The "All Sentences" overview was always expanded, taking up screen space.

**Solution**:
- Made the section collapsible with a chevron icon
- Section starts collapsed by default
- Users can click the header to expand/collapse
- Shows up/down chevron to indicate state

**Implementation**:

#### Added State (Line ~82)
```javascript
const [allSentencesExpanded, setAllSentencesExpanded] = useState(false); // Start collapsed
```

#### Made Header Clickable (Lines ~645-670)
```javascript
<View style={styles.overviewCard}>
  <TouchableOpacity 
    style={styles.overviewHeaderButton}
    onPress={() => setAllSentencesExpanded(!allSentencesExpanded)}
  >
    <View style={{ flex: 1 }}>
      <SafeText style={[
        styles.overviewTitle,
        language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
      ]}>
        {transliteration.nativeScriptRenderings.allSentences || getAllSentencesLabel(language)}
      </SafeText>
      {transliteration.showTransliterations && transliteration.transliterations.allSentences && (
        <SafeText style={[
          styles.translitText,
          language === 'urdu' && { textAlign: 'right' }
        ]}>
          {transliteration.transliterations.allSentences}
        </SafeText>
      )}
    </View>
    <Ionicons
      name={allSentencesExpanded ? "chevron-up" : "chevron-down"}
      size={24}
      color={colors.primary}
    />
  </TouchableOpacity>
  
  {allSentencesExpanded && activity.sentences.map((sentence, index) => (
    // ... sentence items
  ))}
</View>
```

#### Added Style (Lines ~1344-1349)
```javascript
overviewHeaderButton: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
},
```

### 2. Hide Score on Collapsed Submissions

**Problem**: When a submission was collapsed, the score still showed in the header.

**Solution**:
- Wrapped the score container in `{isExpanded && ...}`
- Score only displays when the submission is expanded
- Cleaner collapsed state showing just "Submission 1"

**Implementation** (Lines ~803-822):
```javascript
<SafeText style={[
  styles.resultCardTitle,
  { color: colors.primary },
  language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
]}>
  {transliteration.nativeScriptRenderings.submissionNumber || getSubmissionNumberLabel(language)} {index + 1}
</SafeText>
{isExpanded && transliteration.showTransliterations && transliteration.transliterations.submissionNumber && (
  <SafeText style={styles.translitText}>
    {transliteration.transliterations.submissionNumber} {index + 1}
  </SafeText>
)}
{isExpanded && (
  <View style={styles.scoreContainer}>
    <SafeText style={[
      styles.scoreText,
      { color: colors.primary },
      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
    ]}>
      {transliteration.nativeScriptRenderings.overallScore || getOverallScoreLabel(language)} {Math.round(submission.overall_score || 0)}%
    </SafeText>
    {transliteration.showTransliterations && transliteration.transliterations.overallScore && (
      <SafeText style={styles.translitText}>
        {transliteration.transliterations.overallScore} {Math.round(submission.overall_score || 0)}%
      </SafeText>
    )}
  </View>
)}
```

### 3. Transliteration Display (Note)

**Regarding Transliterations**: The transliterations shown in the "All Sentences" section (like "ā.dō", "malayāḷaṃ") are **correct phonetic representations** using diacritical marks. These are standard transliteration formats that:
- Use macrons (ā) to indicate long vowels
- Use dots below letters (ḍ, ḷ, ṃ) for retroflex/special sounds
- Follow academic/linguistic transliteration standards

If different transliteration styles are desired (e.g., simplified romanization), this would need to be changed at the **backend API level** where transliterations are generated, not in the frontend code.

The code correctly:
- Fetches transliterations for `sentence.language_display`
- Displays them with the key `language_${index}`
- Applies proper font families for RTL languages like Urdu
- Shows/hides based on user preference

## UI Behavior

### Before
- "All Sentences" section always expanded
- Collapsed submissions showed score
- More scrolling required to navigate

### After
- "All Sentences" starts collapsed, can be toggled
- Collapsed submissions only show number
- Score hidden until expanded
- Cleaner, more compact interface
- Less scrolling needed

## Testing

1. **Collapsible Section**:
   - Open Translation Activity
   - Verify "All Sentences" section is collapsed by default
   - Click header to expand - should show all sentences
   - Click again to collapse

2. **Submission Scores**:
   - Complete a translation and submit for grading
   - In Results section, verify collapsed submissions don't show scores
   - Expand a submission - score should appear
   - Collapse again - score should hide

3. **Transliterations**:
   - Enable transliterations via the transliteration button
   - Verify sentence transliterations appear correctly
   - Should show phonetic representations with diacritical marks
   - For Urdu, verify RTL alignment

## Files Modified

- `screens/activities/TranslationActivity.js`
  - Line ~82: Added `allSentencesExpanded` state
  - Lines ~645-670: Made "All Sentences" header collapsible
  - Lines ~803-822: Wrapped score display in `isExpanded` condition
  - Lines ~1344-1349: Added `overviewHeaderButton` style

## Notes

- State is reset on navigation away (doesn't persist)
- Chevron icons indicate expand/collapse state clearly
- Consistent with other collapsible sections in the app
- No backend changes required
- Transliteration accuracy depends on backend API responses
