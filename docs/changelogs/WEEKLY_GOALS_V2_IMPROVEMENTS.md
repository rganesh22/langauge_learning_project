# Weekly Goals System - UI/UX Improvements (v2.1)

**Date:** January 28, 2026  
**Version:** 2.1

## Overview

Enhanced the Weekly Goals system with improved UI/UX features for better usability and historical tracking.

---

## Improvements Implemented

### 1. ✅ Weekly Overview - Show ALL Activities (Including History)

**Problem:** The overview only showed activities that had goals set. Users couldn't see historical activities they completed without goals.

**Solution:** Modified the overview to display ALL activities from the `daily_progress` table, regardless of whether they had goals set.

**Changes:**
- Updated activity rendering logic to merge both `goals` and `progress` data
- Shows activities with goals as `completed/goal` format
- Shows activities without goals as just the count in blue color
- Users can now see complete activity history

**Visual:**
```
📚 Reading      2/3  ✓   (has goal, 2 of 3 completed)
✍️ Writing      1/2      (has goal, 1 of 2 completed)
🗣️ Speaking     5        (no goal, but did 5 activities - shows in blue)
```

**File:** `components/WeeklyOverviewSection.js`

---

### 2. ✅ Date Format with Year

**Problem:** Dates showed as `1/26` without year context, making it unclear which year for past/future weeks.

**Solution:** Added 2-digit year suffix to all dates.

**Format Change:**
- **Before:** `1/26 - 2/1`
- **After:** `1/26/26 - 2/1/26`

**Implementation:**
```javascript
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const year = date.getFullYear().toString().slice(-2); // Last 2 digits
  return `${date.getMonth() + 1}/${date.getDate()}/${year}`;
};
```

**File:** `components/WeeklyOverviewSection.js`

---

### 3. ✅ Activity Count Badges in Add Modal

**Problem:** When adding activities, users couldn't see how many of each activity they already added for that day.

**Solution:** Added count badges on activity icons showing current count.

**Visual:**
```
📚 Reading   [3]  ← Badge shows 3 reading activities already added
🎧 Listening      ← No badge (0 activities)
✍️ Writing   [1]  ← Badge shows 1 writing activity
```

**Features:**
- Badge appears on top-right corner of activity icon
- Shows current count for that specific day/language/activity
- Updates in real-time as you add activities
- Badge styled with activity's primary color + white border

**Implementation:**
```javascript
{currentCount > 0 && (
  <View style={[styles.activityCountBadge, { backgroundColor: colors.primary }]}>
    <Text style={styles.activityCountBadgeText}>{currentCount}</Text>
  </View>
)}
```

**File:** `components/WeeklyGoalsSection.js`

---

### 4. ✅ Collapsible Language Trays

**Problem:** The add activity modal showed all languages expanded at once, making it cluttered and hard to find specific activities.

**Solution:** Implemented collapsible language sections - tap language to expand/collapse activities.

**UI Flow:**
1. Open add activity modal
2. See list of all active languages (collapsed by default)
3. Tap on a language → Activities expand below
4. Tap again → Activities collapse
5. Multiple languages can be expanded simultaneously

**Visual:**
```
Before (all expanded):
─────────────────────
🅚 Kannada
  📚 Reading [+]
  🎧 Listening [+]
  ✍️ Writing [+]
  🗣️ Speaking [+]
  💬 Conversation [+]
─────────────────────
🅷 Hindi
  📚 Reading [+]
  🎧 Listening [+]
  ...

After (collapsible):
─────────────────────
▶️ 🅚 Kannada       ← Collapsed
─────────────────────
▼ 🅷 Hindi          ← Expanded
  📚 Reading [2] [+]
  🎧 Listening [+]
  ✍️ Writing [1] [+]
  🗣️ Speaking [+]
  💬 Conversation [+]
─────────────────────
▶️ த Tamil         ← Collapsed
─────────────────────
```

**Features:**
- Chevron icon shows expand/collapse state
- Tapping language header toggles expansion
- State persists while modal is open
- Activities indented when expanded

**Implementation:**
```javascript
const [expandedLanguages, setExpandedLanguages] = useState({});

const toggleLanguage = (langCode) => {
  setExpandedLanguages(prev => ({
    ...prev,
    [langCode]: !prev[langCode]
  }));
};
```

**File:** `components/WeeklyGoalsSection.js`

---

## Technical Details

### Files Modified

#### 1. `components/WeeklyOverviewSection.js`
**Lines changed:** ~100 lines

**Key Changes:**
- Updated `formatDate()` to include year
- Rewrote activity rendering logic to show all activities (not just goals)
- Added `activityCountNoGoal` style for activities without goals
- Used JavaScript `Map` to collect unique language-activity combinations
- Merged goals and progress data for complete view

**New Logic:**
```javascript
// Collect all unique language-activity combinations
const allActivities = new Map();

// Add from goals
Object.entries(dayGoals).forEach(([lang, activities]) => {
  Object.entries(activities).forEach(([activity, goalCount]) => {
    const key = `${lang}-${activity}`;
    allActivities.set(key, { lang, activity, goalCount });
  });
});

// Add from progress (even if no goal)
Object.entries(dayProgress).forEach(([lang, activities]) => {
  Object.entries(activities).forEach(([activity, completedCount]) => {
    const key = `${lang}-${activity}`;
    if (!allActivities.has(key)) {
      allActivities.set(key, { lang, activity, goalCount: 0 });
    }
  });
});
```

---

#### 2. `components/WeeklyGoalsSection.js`
**Lines changed:** ~80 lines

**Key Changes:**
- Added `expandedLanguages` state object
- Added `toggleLanguage()` function
- Added `getActivityCountForDay()` function
- Made language headers clickable/toggleable
- Added chevron icons to language headers
- Added count badges to activity icons
- Indented activities grid when expanded

**New State:**
```javascript
const [expandedLanguages, setExpandedLanguages] = useState({});
```

**New Functions:**
```javascript
const toggleLanguage = (langCode) => {
  setExpandedLanguages(prev => ({
    ...prev,
    [langCode]: !prev[langCode]
  }));
};

const getActivityCountForDay = (langCode, activity) => {
  if (!selectedDay) return 0;
  return weeklyGoals[selectedDay]?.[langCode]?.[activity] || 0;
};
```

**New Styles:**
- `languageHeaderLeft` - Container for chevron + badge + name
- `activityButtonContent` - Wrapper for icon + text
- `activityCountBadge` - Badge overlay on icon
- `activityCountBadgeText` - Text inside badge
- Updated `activitiesGrid` with left padding for indentation

---

## User Experience Improvements

### Before vs After Comparison

#### Weekly Overview Screen

**Before:**
- Only showed activities with goals
- Dates without year context
- Couldn't see historical activities without goals
- Empty days showed "No goals" even if activities were done

**After:**
- Shows ALL activities ever done
- Dates include year (e.g., 2/1/26)
- Can review complete activity history
- Activities without goals shown in blue with just count
- Perfect for tracking unexpected learning sessions

#### Add Activity Modal

**Before:**
- All languages expanded at once
- Scrolling through clutter to find activity
- No indication of current count
- Had to remember what you already added

**After:**
- Clean collapsed view of languages
- Expand only the language you need
- Count badges show current status
- Visual feedback as you add activities
- Much faster to navigate

---

## Use Cases

### 1. Historical Review
**Scenario:** You want to see what you actually did last week vs what you planned.

**Usage:**
1. Go to Weekly Overview
2. Navigate to last week (← button)
3. See:
   - Planned: Reading 3/3 ✓ (completed goal)
   - Unplanned: Speaking 2 (did 2 without goal - shown in blue)
   - Analysis: You did reading as planned + bonus speaking practice!

### 2. Quick Goal Setting
**Scenario:** Setting goals for Monday across multiple languages.

**Usage:**
1. Tap Monday in Weekly Goals
2. See collapsed language list
3. Tap "Kannada" → Expand → Add Reading [badge shows 0]
4. Tap again → [badge updates to 1]
5. Tap "Hindi" → Expand → Add Speaking
6. Done! No scrolling through all activities

### 3. Year-Round Planning
**Scenario:** Planning goals for next week (end of year).

**Usage:**
- Dates show 12/28/25 - 1/3/26
- Clear year boundary visible
- No confusion about which week you're viewing

---

## Visual Design

### Color Coding

**Weekly Overview:**
- **Goals with progress:** `X/Y` in gray (#666)
- **Completed goals:** `X/Y` in green (#50C878) + ✓
- **No goal activities:** `X` in blue (#4A90E2) - indicates historical data

**Activity Badges (Week Grid):**
- Count badge: white background, black text
- Activity icon: colored circle with activity color
- Language badge: language color with native character

**Count Badges (Add Modal):**
- Activity icon: circular with light background
- Count badge: overlay on top-right with activity primary color
- White border for contrast

### Interactive Elements

**Touchable Areas:**
- Language headers: Full-width touch area
- Activity buttons: Full-width with border
- Day cards: Full card is touchable
- Badges: Tap to remove (in week grid)

**Visual Feedback:**
- Chevrons rotate when expanding/collapsing
- Badges appear/disappear instantly
- Activity counts update in real-time
- Smooth animations for expand/collapse

---

## Backend (No Changes Required)

The backend already provides all necessary data:
- `/api/week-overview?week_offset=N` returns complete progress data
- `daily_progress` table has all historical activities
- No database schema changes needed
- No API endpoint changes needed

---

## Testing Checklist

### Weekly Overview
- [ ] Activities without goals show as blue count
- [ ] Activities with goals show as X/Y format
- [ ] Completed goals show green checkmark
- [ ] Dates include year (e.g., 1/28/26)
- [ ] Past weeks show historical activities
- [ ] Empty days show "No goals" appropriately

### Add Activity Modal
- [ ] Languages collapsed by default
- [ ] Chevron rotates when toggling
- [ ] Tapping language header expands/collapses
- [ ] Count badges appear when count > 0
- [ ] Count badges update in real-time
- [ ] Multiple languages can be expanded
- [ ] Activities indented when expanded
- [ ] Scrolling works smoothly

### Integration
- [ ] Badges in week grid still work (tap to remove)
- [ ] Save functionality unchanged
- [ ] Load functionality unchanged
- [ ] All languages supported
- [ ] Urdu font renders correctly

---

## Future Enhancements (Ideas)

### Potential Improvements:
1. **Auto-expand last used language** - Remember which language user added last
2. **Search/filter languages** - For users with many active languages
3. **Activity templates** - "Repeat last week" button
4. **Streak indicators** - Show consecutive days with activities
5. **Export history** - CSV export of all activities
6. **Charts/graphs** - Visual progress over time

---

## Summary

**Version 2.1** significantly improves the Weekly Goals experience with:
- 📊 **Complete historical tracking** - Never lose sight of your progress
- 📅 **Year context** - Always know which week you're viewing
- 🔢 **Visual count feedback** - See what you've added at a glance
- 🎯 **Cleaner navigation** - Collapsible trays reduce clutter

These changes make the weekly planning and tracking workflow more intuitive, faster, and more informative!

---

**Status:** ✅ **COMPLETE - Ready for Testing**

**Next Steps:**
1. Test all features on device/simulator
2. Verify with multiple languages active
3. Test with historical data
4. Gather user feedback
5. Iterate based on usage patterns
