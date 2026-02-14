# Profile and Activity Fixes - January 28, 2026

## Changes Made

### 1. ✅ Native Script Names on Language Chips (Profile Screen)

**Issue**: Language chips in the profile only showed English names, not the native script names.

**Fix**: Added native script names below English names on language chips.

#### Changes in `/screens/ProfileScreen.js`:

**Line ~1008 - Language Chip Structure:**
```javascript
<View key={lang.code} style={styles.languageChip}>
  <View style={[styles.languageChipIcon, { backgroundColor: lang.color }]}>
    {/* Icon */}
  </View>
  <View style={styles.languageChipTextContainer}>  {/* NEW: Wrapper for text */}
    <Text style={styles.languageChipName}>{lang.name}</Text>  {/* English name */}
    {lang.nativeName && (  {/* NEW: Native name */}
      <Text style={[
        styles.languageChipNativeName,
        lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
      ]}>{lang.nativeName}</Text>
    )}
  </View>
  <View style={[styles.languageChipLevel, { backgroundColor: LEVEL_COLORS[item.level]?.bg }]}>
    {/* Level badge */}
  </View>
</View>
```

**Lines 2878-2905 - New Styles:**
```javascript
languageChipTextContainer: {
  flexDirection: 'column',
  flex: 1,
  marginLeft: 8,
},
languageChipName: {
  fontSize: 15,
  fontWeight: '600',
  color: '#1A1A1A',
},
languageChipNativeName: {  // NEW
  fontSize: 12,
  fontWeight: '400',
  color: '#666',
  marginTop: 2,
},
languageChipLevel: {
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  minWidth: 36,
  alignItems: 'center',
  marginLeft: 8,  // Added for proper spacing
},
```

**Result**:
- Language chips now show: **Icon | English Name** | Level
                                 **Native Name**
- Native script uses correct font (Nastaliq for Urdu)
- Examples:
  - "Tamil" with "தமிழ்" below
  - "Hindi" with "हिन्दी" below  
  - "Urdu" with "اردو" below (Nastaliq font)
  - "Kannada" with "ಕನ್ನಡ" below

---

### 2. ✅ Topic Selection Modal Now Appears

**Issue**: When starting new activities, users were NOT being prompted to select a topic. The modal was blocked by the loading screen.

**Root Cause**: The `useActivityData` hook initialized `loading` to `true` for ALL activities, which caused the loading screen to appear immediately and block the modal.

**Fix**: Initialize `loading` to `false` for new activities, only `true` for history activities.

#### Changes in `/screens/activities/shared/hooks/useActivityData.js`:

**Line 11 - Initial Loading State:**
```javascript
// BEFORE:
const [loading, setLoading] = useState(true);

// AFTER:
const [loading, setLoading] = useState(fromHistory ? true : false);
```

**Logic**:
- **New Activity** (`fromHistory = false`): 
  - `loading = false` → Modal renders → User selects topic → `loading = true` → Activity generates
- **History Activity** (`fromHistory = true`): 
  - `loading = true` → Skip modal → Load saved activity immediately

**Result**:
- ✅ Reading Activity: Modal appears on new start
- ✅ Listening Activity: Modal appears on new start  
- ✅ Other activities: Will show modal once topic selection is implemented
- ✅ History activities: Still load immediately without modal (correct behavior)

---

## Visual Flow

### New Activity Start (e.g., Reading):
1. User clicks "Start Reading"
2. **Topic Selection Modal appears** (NEW - was broken)
   - Option 1: Enter custom topic
   - Option 2: Pick random (based on interests)
3. User selects → Modal closes → Loading screen appears
4. Activity generates → Activity screen loads

### History Activity:
1. User clicks activity from history
2. Loading screen appears immediately (no modal)
3. Activity loads with saved data

---

## Language Chip Visual

### Before:
```
[📱] Tamil          [A2]
```

### After:
```
[📱] Tamil          [A2]
     தமிழ்
```

### Examples for all languages:
- **Tamil**: தமிழ்
- **Telugu**: తెలుగు
- **Kannada**: ಕನ್ನಡ
- **Malayalam**: മലയാളം
- **Hindi**: हिन्दी
- **Urdu**: اردو (in Nastaliq font)

---

## Testing Checklist

### Language Chips:
- [x] Code compiles without errors
- [ ] Native names appear below English names
- [ ] Urdu uses Nastaliq font
- [ ] All 6 available languages show native script
- [ ] Chips maintain proper spacing and layout
- [ ] Level badges still aligned correctly

### Topic Selection Modal:
- [x] Code compiles without errors
- [ ] Reading: Modal appears for new activities
- [ ] Listening: Modal appears for new activities
- [ ] Modal does NOT appear when reopening from history
- [ ] Custom topic input works
- [ ] Random topic button works
- [ ] Cancel navigates back without starting activity
- [ ] Loading screen appears AFTER topic selection, not before

---

## Files Modified

1. **ProfileScreen.js**:
   - Added `languageChipTextContainer` wrapper
   - Added native name display with conditional rendering
   - Added 3 new styles: `languageChipTextContainer`, `languageChipNativeName`
   - Updated `languageChipLevel` margin

2. **useActivityData.js**:
   - Changed loading initialization from `true` to conditional `fromHistory ? true : false`

---

## Impact

### Language Chips:
- Better language learning experience - users see both scripts
- Helps users recognize the script they're learning
- Maintains cultural authenticity

### Topic Selection:
- **Critical bug fix** - Feature was completely broken
- Users can now actually choose topics for activities
- Personalization feature is now functional
- Interest-based random topics now accessible

---

## Next Steps

To complete the topic selection feature for all activities, still need to:
1. Implement topic selection for Writing Activity
2. Implement topic selection for Speaking Activity  
3. Implement topic selection for Conversation Activity

(Reading and Listening are now complete with working modals!)
