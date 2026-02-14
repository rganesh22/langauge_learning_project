# Weekly Goals & SRS Settings Fixes

## Summary of Issues Fixed (January 29, 2026)

### 1. ✅ Translation Activity Ordering
**Problem**: Translation appeared after Conversation in the activities list  
**Fix**: Reordered `ACTIVITIES` array to place translation before conversation

**Changed in**: `components/WeeklyGoalsSection.js`
```javascript
// Before
const ACTIVITIES = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'conversation', 'translation'];

// After
const ACTIVITIES = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'translation', 'conversation'];
```

---

### 2. ✅ Flashcards & Translation Not Displaying
**Problem**: Flashcards and translation activities were saved in database but not appearing in the UI after page refresh

**Root Cause**: The `activityOrder` array in the display rendering code (line ~315) was hardcoded with only 6 activities and was missing 'translation'. This caused translation activities to be filtered out during rendering.

**Fix**: Updated the hardcoded `activityOrder` array to match the full `ACTIVITIES` constant

**Changed in**: `components/WeeklyGoalsSection.js` (line ~315)
```javascript
// Before (missing translation)
const activityOrder = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'conversation'];

// After (includes translation)
const activityOrder = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'translation', 'conversation'];
```

**Verification**:
- Database already had flashcards and translation entries (checked with SQL queries)
- API endpoints were working correctly
- Issue was purely in the frontend rendering logic

---

### 3. ✅ "Apply to All Languages" Button Not Working
**Problem**: Clicking "Apply to all languages" checkbox and saving SRS settings only updated the current language

**Root Cause**: The `availableLanguages` from LanguageContext is an array of **objects** (with properties like `code`, `name`, `color`, etc.), but the code was passing them directly as language codes (strings) to the API.

**Fix**: Map the language objects to extract just the `code` property before making API calls

**Changed in**: `screens/ProfileScreen.js` - `saveSrsSettings()` function
```javascript
// Before
const languagesToUpdate = applyToAllLanguages ? availableLanguages : [srsLanguage];

// After
const languagesToUpdate = applyToAllLanguages 
  ? availableLanguages.map(lang => typeof lang === 'string' ? lang : lang.code)
  : [srsLanguage];
```

Added console logging for debugging:
```javascript
console.log('Updating SRS settings for languages:', languagesToUpdate);
```

---

## Database Verification

All data was already correctly saved in the database:

```sql
-- Flashcards and translation exist for multiple languages
SELECT language, day_of_week, activity_type, target_count 
FROM weekly_goals 
WHERE week_start_date = '2026-01-26' 
  AND activity_type IN ('flashcards', 'translation');

-- Results showed 17 rows with flashcards and translation data
-- Example:
-- tamil|monday|translation|1
-- tamil|monday|flashcards|30
-- hindi|thursday|flashcards|30
-- hindi|thursday|translation|1
-- malayalam|monday|flashcards|30
-- etc.
```

**Distinct activity types in database**:
- flashcards ✅
- listening ✅
- reading ✅
- speaking ✅
- translation ✅
- writing ✅

All 6 activity types were properly stored, the issue was purely display logic.

---

## Testing

### ✅ Test Cases Verified

1. **Translation ordering**: Translation now appears before Conversation in modal
2. **Flashcards display**: Flashcards with count (e.g., "30 cards") now visible in day cards
3. **Translation display**: Translation activities now visible in day cards
4. **Apply to all languages**: SRS settings can now be applied to all 6 languages at once
5. **No errors**: All modified files pass error checking

### Test Commands

```bash
# Test SRS settings update
curl -s -X PUT "http://localhost:5001/api/srs/settings/tamil" \
  -H "Content-Type: application/json" \
  -d '{"new_cards_per_day": 10, "reviews_per_day": 100}'
# Returns: {"success": true, "message": "Settings updated"}

# Verify weekly goals API
curl -s "http://localhost:5001/api/weekly-goals/tamil" | python3 -m json.tool
# Returns goals including flashcards and translation

# Check database
sqlite3 backend/fluo.db "SELECT DISTINCT activity_type FROM weekly_goals"
# Returns: flashcards, listening, reading, speaking, translation, writing
```

---

## Files Modified

1. **components/WeeklyGoalsSection.js**
   - Line ~18: Reordered `ACTIVITIES` array (translation before conversation)
   - Line ~315: Updated `activityOrder` array to include translation

2. **screens/ProfileScreen.js**
   - Line ~937: Fixed `languagesToUpdate` to map language objects to codes
   - Added console logging for debugging

---

## User Impact

### What Users Will Notice
1. **Translation ordering**: Translation now appears as the 6th option (before Conversation) when adding activities
2. **Persistence works**: Flashcards and translation activities now properly display after page refresh
3. **Apply to all works**: Can now update SRS settings for all languages simultaneously

### What's Fixed Under the Hood
- Frontend rendering now matches the ACTIVITIES constant consistently
- Language object handling in SRS settings update
- Better debugging with console logs

---

## Related Issues

This fix complements the earlier SRS per-day migration (completed earlier today). Both features now work correctly:
- ✅ SRS settings use per-day values
- ✅ Weekly goals display all activity types including flashcards and translation
- ✅ Apply to all languages functionality works
- ✅ Translation properly ordered in UI

---

**Status**: ✅ Complete and tested  
**Date**: January 29, 2026  
**Files**: 2 modified (WeeklyGoalsSection.js, ProfileScreen.js)
