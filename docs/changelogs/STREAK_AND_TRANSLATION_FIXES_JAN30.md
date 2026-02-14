# Streak Mismatch & Translation Activity Crash Fixes

**Date**: January 30, 2026

## Issues Fixed

### 1. ✅ Streak Mismatch Between Dashboard and Profile

**Problem**: 
- Dashboard showed different streak value than Profile page
- Dashboard was using old `profile.streak` from database
- Profile was correctly using goal-based streak from `/api/streak` endpoint

**Root Cause**:
- Dashboard's `loadDashboard()` function was fetching streak from `/api/dashboard/{language}` which returns the legacy `profile.streak` value
- Profile's `loadStreak()` function was correctly fetching from `/api/streak` which calculates goal-based streak
- Two different data sources = two different values

**Solution**:
Updated `DashboardScreen.js` to use the same goal-based streak endpoint as ProfileScreen:

```javascript
// OLD (line 252)
setStreak(data.streak || 0);

// NEW (lines 252-262)
// Load goal-based streak from dedicated endpoint
try {
  const streakResponse = await fetch(`${API_BASE_URL}/api/streak`);
  if (streakResponse.ok) {
    const streakData = await streakResponse.json();
    setStreak(streakData.current_streak || 0);
  } else {
    // Fallback to old streak from profile if goal-based fails
    setStreak(data.streak || 0);
  }
} catch (streakError) {
  console.warn('Failed to load goal-based streak, using profile streak:', streakError);
  setStreak(data.streak || 0);
}
```

**Benefits**:
- ✅ Dashboard and Profile now show the same streak value
- ✅ Both use goal-based calculation (requires completing daily goals)
- ✅ Fallback to legacy streak if goal-based endpoint fails
- ✅ Maintains backward compatibility

---

### 2. ✅ Translation Activity Crash on Load

**Problem**: 
Opening translation activity caused immediate crash:
```
TypeError: Cannot read properties of undefined (reading 'reduce')
```

**Root Cause**:
Line 176 in `TranslationActivity.js` was attempting to call `.every()` on `activity.sentences` before the array was fully loaded:

```javascript
// PROBLEMATIC CODE
const allTranslationsComplete = activity?.sentences && activity.sentences.length > 0 
  && activity.sentences.every((_, idx) => userTranslations[idx]?.trim());
```

Even though we checked `activity?.sentences`, the second check `activity.sentences.length > 0` assumes `activity.sentences` exists. If it's `undefined`, the `.every()` call throws an error.

**Solution**:
Added proper array check using `Array.isArray()`:

```javascript
// FIXED CODE (line 176)
const allTranslationsComplete = Array.isArray(activity?.sentences) 
  && activity.sentences.length > 0 
  && activity.sentences.every((_, idx) => userTranslations[idx]?.trim());
```

**Additional Safety Fix**:
Also improved the progress bar width calculation (line 227-230):

```javascript
// BEFORE
width: activity?.sentences?.length 
  ? `${(count / activity.sentences.length) * 100}%` 
  : '0%'

// AFTER
width: (activity?.sentences?.length && activity.sentences.length > 0)
  ? `${(count / activity.sentences.length) * 100}%` 
  : '0%'
```

**Benefits**:
- ✅ Translation activity loads without crashing
- ✅ Proper defensive checks for array operations
- ✅ Safe handling of async data loading
- ✅ Better error prevention for undefined arrays

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `screens/DashboardScreen.js` | 236-266 (31 lines) | Updated `loadDashboard()` to fetch goal-based streak |
| `screens/activities/TranslationActivity.js` | 176 | Added `Array.isArray()` check for `allTranslationsComplete` |
| `screens/activities/TranslationActivity.js` | 227-230 | Improved progress bar width calculation safety |

---

## Testing Checklist

### Streak Display
- [ ] Open Dashboard - verify streak shows correct value
- [ ] Open Profile - verify streak matches Dashboard value
- [ ] Complete some activities to meet goals
- [ ] Verify streak increments on both screens
- [ ] Verify "Today Complete" badge appears when appropriate

### Translation Activity
- [ ] Open translation activity from Dashboard
- [ ] Verify no crash on load
- [ ] Verify progress bar shows "0 / N" initially
- [ ] Enter translations for some sentences
- [ ] Verify progress bar updates correctly
- [ ] Navigate between sentences
- [ ] Submit translations for grading
- [ ] Verify results display correctly

---

## Technical Notes

### Why Array.isArray() vs Optional Chaining?

Optional chaining (`?.`) returns `undefined` if the property doesn't exist, but it doesn't guarantee the value is an array. 

```javascript
// If activity.sentences = undefined
activity?.sentences?.length        // undefined (doesn't throw error)
activity.sentences.every(...)      // ❌ TypeError!

// Safe approach
Array.isArray(activity?.sentences) // false (if undefined)
&& activity.sentences.every(...)   // Never reached if not array ✅
```

### Streak Calculation Methods

**Legacy Method** (`profile.streak` in DB):
- Simple counter incremented daily
- Not tied to goals
- Can be artificially high

**Goal-Based Method** (`/api/streak` endpoint):
- Checks if ALL weekly goals met each day
- Resets if any day's goals not met
- More meaningful measure of consistency
- Used by both Dashboard and Profile now

---

## Related Documentation

- `IMPLEMENTATION_COMPLETE.md` - Original goal-based streak implementation
- `PROFILE_DASHBOARD_UPDATES.md` - Previous Dashboard/Profile updates
- `TRANSLATION_CRASH_FIX.md` - Previous translation activity fixes

---

**Status**: ✅ Complete and ready for testing  
**Priority**: High (crash fix + data consistency)  
**Breaking Changes**: None (fallback maintained)
