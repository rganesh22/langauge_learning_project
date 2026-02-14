# Historical Activity Fixes and Language Selector Update - February 1, 2025

## Overview
Fixed multiple issues with historical activities and updated the Profile page language selector to match other screens:
1. Fixed Dashboard historical activities opening as new activities instead of viewing history
2. Display activity titles instead of generic activity types in both Dashboard and Profile popups
3. Updated Profile language selector to match the style of Vocab, Lessons, and Practice screens (including native script names)

## Changes Made

### 1. Backend - Extract Activity Titles (`backend/main.py`)

**Location:** Lines 3363-3423 (`/api/daily-activities` endpoint)

#### Problem
The API was only returning basic activity info (type, timestamp, score) but not the activity title.

#### Solution
Enhanced the endpoint to extract titles from the `activity_data` JSON:

```python
# Try to extract score and title from activity_data if available
if row['activity_data']:
    try:
        data = json.loads(row['activity_data'])
        if 'final_score' in data:
            activity['score'] = data['final_score']
        elif 'score' in data:
            activity['score'] = data['score']
        
        # Extract title based on activity type
        if 'title' in data:
            activity['title'] = data['title']
        elif 'topic' in data:
            activity['title'] = data['topic']
        elif 'story_title' in data:
            activity['title'] = data['story_title']
    except:
        pass
```

**Title Field Mapping:**
- Reading: `title` or `story_title`
- Listening: `title` or `topic`
- Writing: `title`
- Speaking: `title` or `topic`
- Translation: `title`
- Conversation: `topic`
- Flashcard: (uses activity type as fallback)

### 2. Dashboard - Fix Historical Activity Navigation

**Location:** Lines 273-280 (`screens/DashboardScreen.js`)

#### Problem
Clicking on historical activities was creating new activities instead of opening the historical view:
```javascript
navigation.navigate('Activity', {
  language: selectedLanguage,
  activityType: activityType,
  activityId: activityId,
  fromHistory: true,  // ❌ Wrong parameter
});
```

#### Solution
Fixed to use correct parameter `isHistorical: true`:
```javascript
const openHistoricalActivity = (activityId, activityType) => {
  closeDayActivitiesModal();
  navigation.navigate('Activity', {
    activityId,
    activityType,
    isHistorical: true,  // ✅ Correct parameter
  });
};
```

**Removed:** `language` parameter (not needed, retrieved from activity data)

### 3. Dashboard - Display Activity Titles

**Location:** Lines 706-768 (`screens/DashboardScreen.js`)

#### Problem
Cards showed generic activity types like "Reading", "Writing", "Speaking"

#### Solution
Display actual activity titles with fallback to activity type:
```javascript
<Text style={styles.historicalActivityType}>
  {activity.title || (activityType.charAt(0).toUpperCase() + activityType.slice(1))}
</Text>
```

**Examples:**
- Before: "Reading"
- After: "The Festival of Colors" (actual story title)

- Before: "Listening"
- After: "Daily Routines in India" (actual topic)

### 4. Profile - Display Activity Titles

**Location:** Lines 380-430 (`screens/ProfileScreen.js`)

#### Problem
Same as Dashboard - showed generic activity types

#### Solution
Applied same fix as Dashboard:
```javascript
<Text style={styles.historicalActivityType}>
  {activity.title || (activityType.charAt(0).toUpperCase() + activityType.slice(1))}
</Text>
```

### 5. Profile - Update Language Selector Style

**Location:** Lines 1829-1866 (`screens/ProfileScreen.js`)

#### Problem
Profile language selector had a different, simpler style than other screens:
- Small icon (28x28px)
- Only showed language name (no native name)
- White background with border

#### Solution
Updated to match Vocab/Lessons/Practice style:

**Before:**
```javascript
<View style={styles.countryCodeBoxCompact}>  // 28x28px
  <Text>{currentLang.nativeChar}</Text>
</View>
<Text>{currentLang.name}</Text>  // Only English name
```

**After:**
```javascript
<View style={styles.countryCodeBoxCompact}>  // 40x40px
  <Text>{currentLang.nativeChar}</Text>
</View>
<View style={styles.languageButtonContentCompact}>
  <Text>{currentLang.name}</Text>  // English name
  <Text>{currentLang.nativeName}</Text>  // Native script name ✅
</View>
```

**Visual Comparison:**

Old Style:
```
┌─────────────────────────────┐
│ [ಕ] Kannada  ▾              │
└─────────────────────────────┘
```

New Style (matching other screens):
```
┌─────────────────────────────┐
│ [ಕ] Kannada                │
│     ಕನ್ನಡ          ▾        │
└─────────────────────────────┘
```

### 6. Profile - Updated Selector Styles

**Location:** Lines 4043-4100 (`screens/ProfileScreen.js`)

#### Changes
Updated all compact selector styles to match VocabLibraryScreen:

**Icon Size:**
- Old: 28x28px → New: 40x40px

**Layout:**
- Old: Single-line (icon, name, chevron)
- New: Multi-line with native name below English name

**Background:**
- Old: White with border (#FFFFFF, 1px #DEE2E6)
- New: Light gray (#F5F5F5, no border)

**Typography:**
- English name: 14px, semibold
- Native name: 12px, gray (#666), 2px top margin

**Complete Style Specifications:**
```javascript
languageSelectorCompact: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
  backgroundColor: '#F5F5F5',  // Match other screens
  flexShrink: 0,
},
countryCodeBoxCompact: {
  width: 40,   // Increased from 28
  height: 40,  // Increased from 28
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 8,
},
nativeCharTextCompact: {
  fontSize: 18,  // Increased from 14
  color: '#FFFFFF',
  fontWeight: '500',
},
countryCodeTextCompact: {
  fontSize: 11,  // Increased from 10
  color: '#FFFFFF',
  fontWeight: 'bold',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
},
languageButtonContentCompact: {
  flexDirection: 'column',  // NEW: Stack names vertically
  alignItems: 'flex-start',
  marginRight: 4,
},
languageNameCompact: {
  fontSize: 14,
  fontWeight: '600',
  color: '#1A1A1A',
},
languageNativeNameCompact: {  // NEW: Native script name
  fontSize: 12,
  color: '#666',
  marginTop: 2,
},
```

## Visual Examples

### Activity Cards with Titles

**Dashboard/Profile Day Modal:**

Before:
```
┌──────────────────────────────────┐
│ [ಕ]  Reading          [📖]      │
│      10:30 AM • 85%              │
└──────────────────────────────────┘
```

After:
```
┌──────────────────────────────────┐
│ [ಕ]  The Festival of Colors  [📖]│
│      10:30 AM • 85%              │
└──────────────────────────────────┘
```

### Profile Language Selector

Before (inconsistent):
```
LANGUAGE SPECIFIC SETTINGS    [ಕ] Kannada ▾
```

After (matches other screens):
```
LANGUAGE SPECIFIC SETTINGS    [ಕ] Kannada
                                  ಕನ್ನಡ    ▾
```

## Testing Checklist

### Historical Activity Navigation
- [ ] Click activity in Dashboard day modal
- [ ] Verify it opens ActivityHistoryScreen (not new activity)
- [ ] Confirm activity data loads correctly
- [ ] Test with all activity types (reading, writing, speaking, etc.)
- [ ] Click activity in Profile calendar day modal
- [ ] Verify same behavior as Dashboard

### Activity Titles Display
- [ ] Dashboard popup shows actual activity titles
- [ ] Profile popup shows actual activity titles
- [ ] Fallback to activity type when title missing
- [ ] Reading activities show story titles
- [ ] Listening activities show topic titles
- [ ] Writing/Speaking show appropriate titles
- [ ] Translation activities show titles
- [ ] Conversation activities show topics

### Profile Language Selector
- [ ] Selector shows native script name below English name
- [ ] Icon is 40x40px (same as other screens)
- [ ] Background is light gray #F5F5F5 (no border)
- [ ] Layout matches Vocab/Lessons/Practice exactly
- [ ] Kannada shows "Kannada" and "ಕನ್ನಡ"
- [ ] Hindi shows "Hindi" and "हिन्दी"
- [ ] Tamil shows "Tamil" and "தமிழ்"
- [ ] Urdu uses correct font for native name
- [ ] Languages without native names only show English name

### Edge Cases
- [ ] Activities without titles fall back to type name
- [ ] Activities with very long titles truncate properly
- [ ] Language selector works with all languages
- [ ] Modal closing doesn't cause navigation issues

## Implementation Details

### Activity Data Structure

Activities are stored in `activity_history` table:
```sql
CREATE TABLE activity_history (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  activity_type TEXT,
  language TEXT,
  completed_at TEXT,
  activity_data TEXT,  -- JSON containing title/topic
  ...
);
```

**Sample `activity_data` JSON:**
```json
{
  "title": "The Festival of Colors",
  "story": "...",
  "questions": [...],
  "final_score": 85
}
```

### Navigation Parameters

**Correct (View History):**
```javascript
navigation.navigate('Activity', {
  activityId: 123,
  activityType: 'reading',
  isHistorical: true,  // ✅ Opens in read-only mode
});
```

**Incorrect (Creates New):**
```javascript
navigation.navigate('Activity', {
  language: 'kannada',
  activityType: 'reading',
  fromHistory: true,  // ❌ Wrong parameter, creates new activity
});
```

### Language Data Structure

From `contexts/LanguageContext.js`:
```javascript
{
  code: 'kannada',
  name: 'Kannada',           // English name
  langCode: 'kn',
  nativeChar: 'ಕ',           // Single character for icons
  nativeName: 'ಕನ್ನಡ',        // Full native script name ✅
  countryCode: 'IN',
  color: '#F97316',
  family: 'Dravidian',
  active: true
}
```

## Files Modified

### Backend
**backend/main.py**
- Lines 3363-3423: Enhanced `/api/daily-activities` endpoint
- Added title extraction from activity_data JSON
- Total: ~10 lines added

### Frontend
**screens/DashboardScreen.js**
- Lines 273-280: Fixed `openHistoricalActivity` function
- Lines 745-750: Display activity titles in cards
- Total: ~8 lines modified

**screens/ProfileScreen.js**
- Lines 408-413: Display activity titles in cards
- Lines 1829-1866: Updated language selector layout
- Lines 4043-4100: Updated selector styles
- Total: ~45 lines modified, ~10 lines added

## Related Components

### ActivityHistoryScreen
- Receives `isHistorical: true` parameter
- Displays activity in read-only mode
- Shows complete activity data with title

### Language Context
- Provides `LANGUAGES` array with all metadata
- Includes both `name` (English) and `nativeName` (native script)
- Used by all language selectors across the app

## Benefits

### User Experience
✅ **Accurate Information**: See actual activity titles instead of generic types  
✅ **Proper Navigation**: Historical activities open correctly for review  
✅ **Consistent Design**: Language selector matches across all screens  
✅ **Better Readability**: Native script names provide cultural context  
✅ **Easier Recognition**: Titles help identify specific activities quickly  

### Developer Experience
✅ **Consistent Patterns**: Same navigation params everywhere  
✅ **Maintainable**: Single source of truth for language selector style  
✅ **Extensible**: Easy to add new title formats for new activity types  

## Known Limitations

1. **Legacy Activities**: Activities created before this update may not have titles stored
   - Fallback: Display activity type name
   - Solution: Titles are optional, graceful degradation

2. **Title Truncation**: Very long titles may need truncation
   - Current: No truncation applied
   - Future: Add `numberOfLines={1}` and `ellipsizeMode="tail"`

3. **Flashcard Titles**: Flashcards don't have individual titles
   - Fallback: Shows "Flashcards" (activity type)
   - Expected: This is correct behavior

## Future Enhancements

1. **Title Formatting**: Capitalize or style titles consistently
2. **Language Indicators**: Show activity language if different from profile language
3. **Activity Icons**: Different icons for different activity subtypes
4. **Quick Actions**: Swipe actions on activity cards (share, delete, retry)

## Notes

- Backend changes are backward compatible (title field is optional)
- Profile language selector now 100% matches VocabLibraryScreen style
- Native names display correctly for all script types (Devanagari, Kannada, Tamil, Arabic/Urdu)
- Navigation fix prevents duplicate activity generation
- Title extraction works for all activity types with graceful fallback

## Previous Related Changes
- **HISTORICAL_ACTIVITY_CARDS_REDESIGN_FEB1.md** - Initial card redesign with language icons
- **PROFILE_LANGUAGE_SETTINGS_REORGANIZATION_FEB1.md** - Added language divider section
- **PROFILE_CALENDAR_CLICKABLE_DAYS_FEB1.md** - Added calendar day click functionality

## Implementation Status
✅ Backend title extraction implemented  
✅ Dashboard historical navigation fixed  
✅ Dashboard activity titles displayed  
✅ Profile activity titles displayed  
✅ Profile language selector updated to match other screens  
✅ Native script names added to Profile selector  
✅ All styles synchronized with VocabLibraryScreen  
✅ Documentation created
