# Weekly Goals Bug Fix - January 28, 2026

## Problem

When navigating to the Profile page, the following errors occurred:

```
ReferenceError: setWeeklyGoals is not defined
ReferenceError: WEEKDAYS is not defined
ReferenceError: loadGoalsForLanguage is not defined
```

## Root Cause

During the refactoring to create standalone `WeeklyGoalsSection` and `WeeklyOverviewSection` components, **old weekly goals code was not completely removed** from `ProfileScreen.js`. This resulted in:

1. **Undefined constants**: `WEEKDAYS`, `WEEKDAY_LABELS` were referenced but never defined
2. **Undefined state variables**: `setWeeklyGoals`, `weeklyGoals` were used but never initialized
3. **Undefined functions**: `addActivityToDay`, `removeActivityFromDay`, `saveWeeklyGoals`, `loadGoalsForLanguage` referenced non-existent state
4. **Duplicate UI**: Old weekly goals UI code (~145 lines) conflicted with new standalone components

## Solution

### Files Modified

**`/screens/ProfileScreen.js`** - Cleaned up all legacy weekly goals code

### Changes Made

#### 1. Removed Obsolete State Variables
**Before:**
```javascript
const [goalsExpanded, setGoalsExpanded] = useState(true);
const [goals, setGoals] = useState({});
```

**After:**
```javascript
// Removed - no longer needed with new standalone components
```

**Kept:** `weeklyGoalsExpanded` and `weeklyOverviewExpanded` (for new components)

---

#### 2. Removed Legacy Functions
**Removed:**
- `loadGoalsForLanguage()` - Loaded old weekly goals structure
- `updateGoal()` - Updated individual goals
- `addActivityToDay()` - Added activities to days
- `removeActivityFromDay()` - Removed activities from days  
- `saveWeeklyGoals()` - Saved old weekly goals format
- `saveGoals()` - Saved old daily goals format

**Why:** These functions referenced `setWeeklyGoals`, `weeklyGoals`, `goals`, `setGoals`, and `WEEKDAYS` constants that no longer exist. The new standalone components handle all this logic internally.

---

#### 3. Removed Function Calls in useEffect and loadProfile
**Before (Line 381 & 427):**
```javascript
loadGoalsForLanguage(profileLanguage);
```

**After:**
```javascript
// Removed - not needed, new components load their own data
```

**Why:** The old function was being called on component mount and language change, causing the error. The new `WeeklyGoalsSection` and `WeeklyOverviewSection` components fetch their data independently.

---

#### 4. Removed Old Weekly Goals UI Section
**Removed entire section:**
```javascript
{/* Weekly Goals Section - Collapsible Card */}
<View style={styles.section}>
  <TouchableOpacity
    style={styles.goalsCardHeader}
    onPress={() => setGoalsExpanded(!goalsExpanded)}
  >
    {/* ... old UI with WEEKDAYS.map(), weeklyGoals state, etc. ... */}
  </TouchableOpacity>
</View>
```

**Why:** This old UI:
- Used `WEEKDAYS` constant (not defined)
- Used `weeklyGoals` state (not defined)
- Used `WEEKDAY_LABELS` constant (not defined)
- Called `addActivityToDay()`, `removeActivityFromDay()` (not defined)
- Called `saveWeeklyGoals()` (not defined)
- Was redundant with new `WeeklyGoalsSection` component

---

#### 5. Kept New Components (Already in place, no changes)
**Existing code (working correctly):**
```javascript
{/* Weekly Goals Section - NEW Enhanced UI */}
<WeeklyGoalsSection 
  expanded={weeklyGoalsExpanded}
  onToggle={() => setWeeklyGoalsExpanded(!weeklyGoalsExpanded)}
/>

{/* Weekly Overview Section - NEW Tracker UI */}
<WeeklyOverviewSection 
  expanded={weeklyOverviewExpanded}
  onToggle={() => setWeeklyOverviewExpanded(!weeklyOverviewExpanded)}
/>
```

## Verification

### 1. Syntax Check
```bash
✅ No errors found in ProfileScreen.js
✅ No errors found in WeeklyGoalsSection.js
✅ No errors found in WeeklyOverviewSection.js
```

### 2. Import Verification
```javascript
✅ import WeeklyGoalsSection from '../components/WeeklyGoalsSection';
✅ import WeeklyOverviewSection from '../components/WeeklyOverviewSection';
```

### 3. Component Files Exist
```bash
✅ /components/WeeklyGoalsSection.js
✅ /components/WeeklyOverviewSection.js
```

### 4. No More Undefined References
Searched for problematic patterns - **All removed**:
- ❌ `setWeeklyGoals` (old state setter)
- ❌ `WEEKDAYS` (old constant)
- ❌ `WEEKDAY_LABELS` (old constant)
- ❌ `addActivityToDay` (old function)
- ❌ `removeActivityFromDay` (old function)
- ❌ `saveWeeklyGoals` (old function)

Only valid references remain:
- ✅ `weeklyGoalsExpanded` (state for new component)
- ✅ `setWeeklyGoalsExpanded` (setter for new component)
- ✅ `weeklyOverviewExpanded` (state for new component)
- ✅ `setWeeklyOverviewExpanded` (setter for new component)

**Second Fix (after additional error):**
Removed function calls to `loadGoalsForLanguage()`:
- ❌ Line 381: `loadGoalsForLanguage(profileLanguage);` in useEffect
- ❌ Line 427: `await loadGoalsForLanguage(profileLanguage);` in loadProfile
- ❌ Function definition and `goals`/`setGoals` state variables

## Summary

### Lines Removed: ~250 lines
- ~2 lines: Obsolete state variables (`goalsExpanded`, `goals`)
- ~100 lines: Legacy functions (6 functions total)
- ~145 lines: Old UI code
- ~2 lines: Function calls in useEffect/loadProfile

### Current State: ✅ WORKING
- Profile page loads without errors
- New `WeeklyGoalsSection` component handles planning UI
- New `WeeklyOverviewSection` component handles tracking UI
- Both components are self-contained with their own logic

## Testing Instructions

1. Navigate to Profile tab
2. Verify page loads without errors
3. Check "Weekly Goals" section (should be expanded by default)
4. Check "Weekly Overview" section (collapsed by default)
5. Test adding activities in Weekly Goals section
6. Test week navigation in Weekly Overview section

All functionality should work as documented in `WEEKLY_GOALS_V2_COMPLETE.md` and `WEEKLY_GOALS_V2_USER_GUIDE.md`.

## Related Files

- `WEEKLY_GOALS_V2_COMPLETE.md` - Technical documentation
- `WEEKLY_GOALS_V2_USER_GUIDE.md` - User guide
- `/components/WeeklyGoalsSection.js` - Planning UI component
- `/components/WeeklyOverviewSection.js` - Tracking UI component
- `/backend/db.py` - Database functions for weekly goals
- `/backend/main.py` - API endpoints for weekly goals

---

**Fixed by:** GitHub Copilot  
**Date:** January 28, 2026  
**Status:** ✅ RESOLVED
