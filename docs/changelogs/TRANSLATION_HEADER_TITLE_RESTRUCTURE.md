# Translation Activity - Header & Title Restructure

## Summary
Restructured the translation activity screen to show just "Translation" in the purple header, with the AI-generated title displayed prominently in the body below it.

## Changes Made

### 1. New UI Label - "Translation" Activity Type
**File:** `constants/ui_labels.js`

Added `TRANSLATION_ACTIVITY_LABELS` (lines ~765-773):
```javascript
export const TRANSLATION_ACTIVITY_LABELS = {
  kannada: 'ಅನುವಾದ',
  telugu: 'అనువాదం',
  malayalam: 'വിവർത്തനം',
  tamil: 'மொழிபெயர்ப்பு',
  english: 'Translation',
  hindi: 'अनुवाद',
  urdu: 'अनुवाद', // Devanagari - will be transliterated to Nastaliq
};
```

Added `getTranslationActivityLabel()` getter function (lines ~1687-1694):
```javascript
export const getTranslationActivityLabel = (language) => {
  try {
    const val = TRANSLATION_ACTIVITY_LABELS[language] || TRANSLATION_ACTIVITY_LABELS.english || 'Translation';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Translation';
  }
};
```

Updated exports to include new constant and getter.

### 2. TranslationActivity.js - Import Updates
**File:** `screens/activities/TranslationActivity.js`

Added import for `getTranslationActivityLabel` (line 44).

### 3. Native Script Fetching
**File:** `screens/activities/TranslationActivity.js`

Updated useEffect (lines ~103-109) to fetch native script for:
- **Activity type label:** "Translation" in native script (key: `activityType`)
- **AI-generated title:** Activity name in native script (key: `activity_name`)

```javascript
// Fetch native script for "Translation" activity type label
const activityTypeLabel = getTranslationActivityLabel(language);
transliteration.ensureNativeScriptForKey('activityType', activityTypeLabel);
transliteration.ensureAndShowTransliterationForKey('activityType', activityTypeLabel);

// Fetch native script for AI-generated activity name (title)
if (activityData.activity?.activity_name) {
  transliteration.ensureNativeScriptForKey('activity_name', activityData.activity.activity_name);
  transliteration.ensureAndShowTransliterationForKey('activity_name', activityData.activity.activity_name);
}
```

### 4. Header Update
**File:** `screens/activities/TranslationActivity.js`

Changed header title (lines ~293-306) from AI-generated name to static "Translation":
```javascript
<SafeText style={styles.headerTitle}>
  {transliteration.nativeScriptRenderings.activityType || getTranslationActivityLabel(language)}
</SafeText>
{transliteration.showTransliterations && transliteration.transliterations.activityType && (
  <SafeText style={styles.headerTransliteration}>
    {transliteration.transliterations.activityType}
  </SafeText>
)}
```

**Examples:**
- Kannada: "ಅನುವಾದ" with "anuvāda" below
- Tamil: "மொழிபெயர்ப்பு" with "moḻipeyarppu" below
- Hindi: "अनुवाद" with "anuvād" below

### 5. AI-Generated Title Card
**File:** `screens/activities/TranslationActivity.js`

Added new title card section (lines ~341-356) in the body, after ScrollView starts and before instructions:
```javascript
{/* AI-Generated Activity Title */}
{activity?.activity_name && (
  <View style={styles.activityTitleCard}>
    <SafeText style={styles.activityTitleText}>
      {transliteration.nativeScriptRenderings.activity_name || activity.activity_name}
    </SafeText>
    {transliteration.showTransliterations && transliteration.transliterations.activity_name && (
      <SafeText style={styles.activityTitleTranslit}>
        {transliteration.transliterations.activity_name}
      </SafeText>
    )}
  </View>
)}
```

**Features:**
- Displays AI-generated activity title (e.g., "Travel Phrases", "Daily Conversations")
- Native script with transliteration below
- Centered text
- Appears in white card between header and instructions
- Conditional rendering (only shows if activity_name exists)

### 6. New Styles
**File:** `screens/activities/TranslationActivity.js`

Added styles for activity title card (lines ~1047-1064):

**activityTitleCard:**
```javascript
activityTitleCard: {
  backgroundColor: '#FFF',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
  alignItems: 'center',
}
```

**activityTitleText:**
```javascript
activityTitleText: {
  fontSize: 22,
  fontWeight: '700',
  color: '#1A1A1A',
  textAlign: 'center',
}
```

**activityTitleTranslit:**
```javascript
activityTitleTranslit: {
  fontSize: 16,
  color: '#666',
  marginTop: 0,
  fontStyle: 'italic',
  textAlign: 'center',
}
```

## Visual Structure

### Before:
```
┌─────────────────────────────────┐
│ ← [AI Title in native script]  │ ← Purple header
│    [transliteration]            │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Instructions...                 │
│ ...                             │
└─────────────────────────────────┘
```

### After:
```
┌─────────────────────────────────┐
│ ← Translation                   │ ← Purple header
│    (transliteration)            │    (static label)
└─────────────────────────────────┘
┌─────────────────────────────────┐
│      [AI Title]                 │ ← White card
│   [transliteration]             │    (centered)
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ Instructions...                 │
│ ...                             │
└─────────────────────────────────┘
```

## Benefits

### ✅ Clear Hierarchy
- **Header:** Shows activity type ("Translation") consistently
- **Title Card:** Shows specific topic/theme of this activity
- **Instructions:** Follows after context is established

### ✅ Better UX
- Users immediately know they're in a translation activity
- AI-generated title provides context about the content
- Centered title card draws attention
- Consistent with activity naming conventions

### ✅ Native Language Support
- Both "Translation" label and AI title in native script
- Both show transliteration when toggle is on
- Proper Urdu support (RTL alignment, Noto Nastaliq font)
- Zero spacing between native text and transliteration

### ✅ Reusable Pattern
- This pattern can be applied to other activities
- Separates activity type from activity content
- Makes headers cleaner and more consistent

## Testing Checklist
- [ ] Header shows "Translation" in native script (not AI title)
- [ ] Header transliteration appears directly below (no gap)
- [ ] AI title card appears in body (centered, white background)
- [ ] AI title shows native script + transliteration
- [ ] Title card appears ABOVE instructions section
- [ ] Toggle transliteration on/off - both header and title update
- [ ] Test with Urdu - both header and title align properly (RTL)
- [ ] Test with different AI-generated titles
- [ ] Verify title card doesn't show if activity_name is missing

## Files Modified
1. `constants/ui_labels.js`:
   - Added `TRANSLATION_ACTIVITY_LABELS` constant
   - Added `getTranslationActivityLabel()` getter
   - Updated exports

2. `screens/activities/TranslationActivity.js`:
   - Added import for `getTranslationActivityLabel`
   - Updated useEffect to fetch "activityType" native script
   - Changed header to show static "Translation" label
   - Added AI-generated title card in body (centered)
   - Added 3 new styles: `activityTitleCard`, `activityTitleText`, `activityTitleTranslit`

## Status
✅ **COMPLETE** - Translation activity now shows "Translation" in the purple header with the AI-generated title displayed prominently in the body below it.
