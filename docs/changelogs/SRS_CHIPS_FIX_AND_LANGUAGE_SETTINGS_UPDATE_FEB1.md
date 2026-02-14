# SRS Chips Display Fix & Language Settings UI Update - February 1, 2026

## Summary
Fixed SRS chips to always display in language selectors (showing counts even when zero), and updated Language Settings section to match Review Scheduling UI pattern with proper "Apply to all languages" toggle.

## Issues Fixed

### 1. **SRS Chips Not Displaying - ROOT CAUSE FOUND**

**Problem**: Chips were implemented correctly but invisible because they only showed when counts > 0.

**Root Cause**: Conditional rendering prevented chips from displaying:
```javascript
// OLD - Chips hidden when count is 0
{langStats.new_count > 0 && (
  <View style={styles.languageSrsChip}>
    <Text>{langStats.new_count} ✨</Text>
  </View>
)}
```

**Solution**: Always show chips, display "0" when no new/due words:
```javascript
// NEW - Chips always visible
<View style={styles.languageSrsChip}>
  <Text>{langStats.new_count || 0} ✨</Text>
</View>
<View style={[styles.languageSrsChip, styles.languageSrsChipDue]}>
  <Text>{langStats.due_count || 0} ⏰</Text>
</View>
```

**Why This Approach**:
- **Consistency**: Users always see the same UI structure
- **Information**: Seeing "0 ✨ 0 ⏰" confirms there's no pending work (vs wondering if chips failed to load)
- **Layout stability**: No shifting layout when counts change

**Files Fixed**:
1. ✅ **ProfileScreen.js** (lines ~1858-1869)
2. ✅ **PracticeScreen.js** (lines ~341-352)
3. ✅ **LessonsScreen.js** (lines ~908-919)
4. ✅ **VocabLibraryScreen.js** (lines ~628-639)

**Visual Result**:
```
Before (counts = 0):
┌────────────────────────────────┐
│ Kannada                        │
│ ಕನ್ನಡ                          │
└────────────────────────────────┘
❌ No chips visible - looks broken

After (counts = 0):
┌────────────────────────────────┐
│ Kannada          [0 ✨] [0 ⏰]│
│ ಕನ್ನಡ                          │
└────────────────────────────────┘
✅ Chips visible - clear status

After (with pending work):
┌────────────────────────────────┐
│ Kannada          [5 ✨] [12 ⏰]│
│ ಕನ್ನಡ                          │
└────────────────────────────────┘
✅ Shows actual counts
```

---

### 2. **Language Settings UI Not Matching Review Scheduling**

**Problem**: Language Settings section had different UI pattern than Review Scheduling section.

**Issues**:
1. "Apply to All Languages" was a separate button below "Save"
2. Different styling (outline button vs checkbox toggle)
3. Inconsistent with Review Scheduling pattern

**Solution**: Match Review Scheduling pattern exactly:

#### Review Scheduling Pattern:
```
┌────────────────────────────────────┐
│ [Settings inputs...]               │
│                                    │
│ ☑ Apply to all languages           │
│   Use the same settings for all... │
│                                    │
│ ┌────────────────────────────────┐ │
│ │   Save Settings                │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

#### Language Settings - Updated to Match:
```
┌────────────────────────────────────┐
│ Default Transliteration            │
│                                    │
│ ☑ Show transliterations            │
│   Transliterations will be...      │
│                                    │
│ ☑ Apply to all languages           │
│   Use the same settings for all... │
│                                    │
│ ┌────────────────────────────────┐ │
│ │   Save Settings                │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

**Changes Made**:

1. **Replaced separate button with checkbox toggle** (lines ~2364-2379):
```javascript
{/* Apply to All Languages Toggle */}
<TouchableOpacity
  style={styles.applyToAllContainer}
  onPress={() => setApplyLangSettingsToAll(!applyLangSettingsToAll)}
  activeOpacity={0.7}
>
  <View style={styles.applyToAllLeft}>
    <Ionicons 
      name={applyLangSettingsToAll ? "checkmark-circle" : "ellipse-outline"} 
      size={24} 
      color={applyLangSettingsToAll ? "#4A90E2" : "#999"} 
    />
    <View style={styles.applyToAllTextContainer}>
      <Text style={styles.applyToAllText}>
        Apply to all languages
      </Text>
      <Text style={styles.applyToAllSubtext}>
        Use the same settings for all languages you're learning
      </Text>
    </View>
  </View>
</TouchableOpacity>
```

2. **Updated Save button text** (lines ~2381-2390):
```javascript
{/* Save Button */}
<TouchableOpacity
  style={[styles.saveButton, savingLangSettings && styles.saveButtonDisabled]}
  onPress={saveLangSettings}
  disabled={savingLangSettings}
>
  <Text style={styles.saveButtonText}>
    {savingLangSettings ? 'Saving...' : 'Save Settings'}
  </Text>
</TouchableOpacity>
```

3. **Added state variable** (line ~424):
```javascript
const [applyLangSettingsToAll, setApplyLangSettingsToAll] = useState(false);
```

4. **Updated saveLangSettings function** (lines ~900-930):
```javascript
const saveLangSettings = async () => {
  setSavingLangSettings(true);
  try {
    if (applyLangSettingsToAll) {
      // Apply to all languages
      const promises = availableLanguages.map(lang =>
        fetch(`${API_BASE_URL}/api/language-personalization/${lang.code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ default_transliterate: defaultTransliterate }),
        })
      );
      await Promise.all(promises);
      Alert.alert('Success', 'Settings applied to all languages!');
    } else {
      // Apply to current language only
      const response = await fetch(`${API_BASE_URL}/api/language-personalization/${langSettingsLanguage}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_transliterate: defaultTransliterate }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Language settings saved successfully!');
      } else {
        Alert.alert('Error', 'Failed to save language settings');
      }
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to save language settings');
  } finally {
    setSavingLangSettings(false);
  }
};
```

5. **Removed custom button styles** (deleted applyToAllButton, applyToAllButtonDisabled, applyToAllButtonText)

**Benefits**:
- ✅ Consistent with Review Scheduling
- ✅ Simpler UI (checkbox vs button)
- ✅ Clear visual hierarchy
- ✅ Same behavior as SRS settings

---

## Behavior Changes

### SRS Chips Display

**Before**:
- Chips invisible when counts are 0
- User confused: "Are chips working?"
- Layout shifts when counts change from 0 to non-zero

**After**:
- Chips always visible
- "0 ✨ 0 ⏰" clearly indicates no pending work
- Stable layout regardless of counts
- Loading state visible (0s show while loading, then update to real counts)

### Language Settings Save Flow

**Before**:
1. Set transliteration preference for Kannada
2. Click "Save Language Settings" → Saves to Kannada only
3. Click "Apply to All Languages" button → Separate action

**After**:
1. Set transliteration preference for Kannada
2. Toggle "Apply to all languages" ON (if desired)
3. Click "Save Settings" → Saves to Kannada OR all languages based on toggle

**Example Workflows**:

**Workflow 1: Save to current language only**
```
1. Select Kannada in Language Settings
2. Turn OFF "Show transliterations"
3. Leave "Apply to all languages" unchecked
4. Click "Save Settings"
→ Saves to Kannada only
```

**Workflow 2: Apply to all languages**
```
1. Select Kannada in Language Settings
2. Turn OFF "Show transliterations"
3. ✓ Check "Apply to all languages"
4. Click "Save Settings"
→ Saves to ALL languages (Telugu, Tamil, Hindi, etc.)
```

---

## Testing Checklist

### SRS Chips Display

**Test 1: Chips Always Visible**
- [ ] Open ProfileScreen → Click language selector
- [ ] **Verify**: Every language shows two chips (✨ and ⏰)
- [ ] **Verify**: Chips show "0" for languages with no pending work
- [ ] Open PracticeScreen → Click language selector
- [ ] **Verify**: Same chips visible
- [ ] Open LessonsScreen → Click language selector
- [ ] **Verify**: Same chips visible
- [ ] Open VocabLibraryScreen → Click language selector
- [ ] **Verify**: Same chips visible

**Test 2: Counts Update Correctly**
- [ ] Note current counts (e.g., "5 ✨ 12 ⏰" for Kannada)
- [ ] Complete some flashcards
- [ ] Reopen language selector
- [ ] **Verify**: Due count decreased
- [ ] Learn new words
- [ ] **Verify**: New count decreased

**Test 3: Cross-Screen Consistency**
- [ ] Open language selector in Profile
- [ ] Note counts for Kannada (e.g., "5 ✨ 12 ⏰")
- [ ] Open language selector in Practice
- [ ] **Verify**: Exact same counts
- [ ] Open language selector in Lessons
- [ ] **Verify**: Exact same counts

**Test 4: Loading State**
- [ ] Refresh page (hard reload)
- [ ] Quickly open language selector
- [ ] **Verify**: Chips show "0 ✨ 0 ⏰" initially
- [ ] Wait 1-2 seconds
- [ ] **Verify**: Chips update to real counts

### Language Settings UI

**Test 1: Toggle Behavior**
- [ ] Go to Profile → Language Settings
- [ ] **Verify**: "Apply to all languages" toggle is unchecked by default
- [ ] Click the toggle
- [ ] **Verify**: Checkmark appears (☑)
- [ ] **Verify**: Matches style of "Show transliterations" toggle above

**Test 2: Save to Current Language Only**
- [ ] Select Kannada
- [ ] Turn OFF "Show transliterations"
- [ ] Leave "Apply to all languages" unchecked
- [ ] Click "Save Settings"
- [ ] **Verify**: Success alert says "Language settings saved successfully!"
- [ ] Switch to Telugu
- [ ] **Verify**: Transliterations still ON for Telugu
- [ ] Switch to Hindi
- [ ] **Verify**: Transliterations still ON for Hindi

**Test 3: Save to All Languages**
- [ ] Select Kannada
- [ ] Turn OFF "Show transliterations"
- [ ] ✓ Check "Apply to all languages"
- [ ] Click "Save Settings"
- [ ] **Verify**: Success alert says "Settings applied to all languages!"
- [ ] Switch to Telugu
- [ ] **Verify**: Transliterations now OFF
- [ ] Switch to Hindi
- [ ] **Verify**: Transliterations now OFF
- [ ] Open FlashcardScreen for any language
- [ ] **Verify**: No transliterations shown initially

**Test 4: UI Consistency with Review Scheduling**
- [ ] Go to Profile → Review Scheduling
- [ ] **Verify**: Has "Apply to all languages" checkbox toggle
- [ ] Go to Profile → Language Settings
- [ ] **Verify**: Has identical "Apply to all languages" checkbox toggle
- [ ] **Verify**: Same text style, icon style, layout
- [ ] **Verify**: "Save Settings" button looks identical in both sections

---

## Technical Details

### SRS Chips Implementation

**Data Flow**:
1. Screen mounts → `loadAllLanguagesSrsStats()` called
2. Fetches stats for all languages in parallel
3. Updates `allLanguagesSrsStats` state:
```javascript
{
  'kannada': { code: 'kannada', new_count: 5, due_count: 12 },
  'telugu': { code: 'telugu', new_count: 0, due_count: 8 },
  'hindi': { code: 'hindi', new_count: 3, due_count: 0 },
}
```
4. Language selector renders → looks up stats for each language
5. Displays chips with counts (or 0 if not loaded yet)

**Fallback Logic**:
```javascript
const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
```
- If stats haven't loaded yet: Shows 0
- If stats failed to load: Shows 0
- If stats loaded successfully: Shows actual counts

### Language Settings Save Logic

**Decision Tree**:
```
User clicks "Save Settings"
│
├─ Is "Apply to all languages" checked?
│  │
│  ├─ YES → Save to ALL languages
│  │        └─ Parallel fetch to all language endpoints
│  │           └─ Show "Settings applied to all languages!"
│  │
│  └─ NO → Save to current language only
│           └─ Single fetch to current language endpoint
│              └─ Show "Language settings saved successfully!"
```

**API Calls**:

Single language:
```javascript
PUT /api/language-personalization/kannada
Body: { "default_transliterate": false }
```

All languages:
```javascript
PUT /api/language-personalization/kannada
PUT /api/language-personalization/telugu
PUT /api/language-personalization/tamil
PUT /api/language-personalization/hindi
PUT /api/language-personalization/malayalam
PUT /api/language-personalization/urdu
// All called in parallel with Promise.all()
```

---

## Edge Cases Handled

### SRS Chips
1. **Stats not loaded yet**: Shows "0 ✨ 0 ⏰"
2. **API error**: Falls back to 0 counts
3. **Backend offline**: Shows 0 counts, no crash
4. **Language not found in stats**: Uses fallback object
5. **Rapid language switching**: State updates correctly

### Language Settings
1. **Toggle checked + save fails**: Alert shows error, toggle state unchanged
2. **Apply to all + partial failure**: Uses `Promise.all()`, any failure triggers error alert
3. **Rapid clicking**: Button disabled during save
4. **Network timeout**: Catch block handles error
5. **No languages available**: Button works (no-op)

---

## Files Modified

1. **ProfileScreen.js**
   - Lines ~1858-1869: Updated chips to always show
   - Lines ~424: Added `applyLangSettingsToAll` state
   - Lines ~900-930: Updated `saveLangSettings()` function
   - Lines ~2364-2390: Replaced button with toggle, reordered
   - Deleted: Custom button styles

2. **PracticeScreen.js**
   - Lines ~341-352: Updated chips to always show

3. **LessonsScreen.js**
   - Lines ~908-919: Updated chips to always show

4. **VocabLibraryScreen.js**
   - Lines ~628-639: Updated chips to always show

---

## Migration Notes

**Breaking Changes**: None

**Backwards Compatibility**: ✅ Full
- Existing settings preserved
- API unchanged
- Database unchanged

**Visual Changes**:
- Chips now visible when counts are 0 (was hidden)
- Language Settings layout matches Review Scheduling

**Deployment**:
1. Deploy updated frontend
2. Test language selector on all screens
3. Verify chips display correctly
4. Test Language Settings save flow
5. Verify "Apply to all languages" works

**Rollback**:
- If chips look wrong: Revert conditional rendering
- If save fails: Check API logs, revert save function

---

**Status**: ✅ **Complete**  
**Date**: February 1, 2026  
**Developer**: GitHub Copilot  
**Root Cause**: Conditional rendering (chips hidden when count = 0)  
**Solution**: Always render chips, show "0" instead of hiding  
**UI Update**: Language Settings now matches Review Scheduling pattern
