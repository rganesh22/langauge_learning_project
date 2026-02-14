# Weekly Sections UI Update - January 29, 2026

## Summary

Updated the Weekly Goals and Weekly Overview sections with improved layouts:

1. **Weekly Goals**: Days now stack vertically for better readability
2. **Weekly Overview**: Days are expandable to show completed activities in unified card format
3. **Visual Hierarchy**: Distinct backgrounds for day cards vs activity cards

---

## Changes Made

### 1. **Weekly Goals Section** (`WeeklyGoalsSection.js`)

#### Layout Changes
- **Before**: Days in 3-column grid (31% width each)
- **After**: Days stack vertically (100% width)

#### Visual Design
- **Day Cards**: White background (#FFFFFF) with subtle shadow
- **Activity Cards**: Gray background (#F8F8F8) - distinct from day card
- **Empty Days**: Light gray background (#FAFAFA) with dashed border

#### Benefits
- ✅ More space for language cards
- ✅ Easier to scan all days at once
- ✅ Better mobile experience (no cramped columns)
- ✅ Clear visual hierarchy

#### Code Changes
```javascript
weekGrid: {
  flexDirection: 'column',  // Changed from 'row'
  gap: 12,
  marginBottom: 24,
},
dayCard: {
  width: '100%',  // Changed from '31%'
  backgroundColor: '#FFFFFF',  // Changed from '#F8F8F8'
  borderRadius: 12,
  padding: 16,
  borderWidth: 1,
  borderColor: '#E0E0E0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
},
```

---

### 2. **Weekly Overview Section** (`WeeklyOverviewSection.js`)

#### New Feature: Expandable Day Cards

**State Management**:
```javascript
const [expandedDays, setExpandedDays] = useState({}); // Track which days are expanded

const toggleDayExpanded = (dayIndex) => {
  setExpandedDays(prev => ({
    ...prev,
    [dayIndex]: !prev[dayIndex]
  }));
};
```

#### Interactive Day Headers

**Before**: Static day cards showing only progress numbers

**After**: Clickable day headers with:
- **Chevron Icon**: Shows expand/collapse state (only if activities exist)
- **Day Name**: "Mon", "Tue", etc.
- **Date**: Formatted as M/D/YY
- **Progress**: Shows completed activities count
- **Today Badge**: Blue badge on current day

#### Expandable Content

When a day is clicked (if it has activities):
- Shows unified language cards (same design as Weekly Goals)
- Groups activities by language
- Displays activity icons with counts
- Shows completed/goal progress for each activity

#### Visual Design

**Day Card** (container):
- Background: White (#FFFFFF)
- Border: Light gray (#E0E0E0)
- Shadow: Subtle elevation
- Today: Blue border (#4A90E2) with light blue background (#F0F7FF)

**Activity Cards** (inside expanded day):
- Background: Gray (#F8F8F8)
- Border top: Separates from day header
- Padding: Additional space for clarity

#### Code Changes

**Day Header** (now interactive):
```javascript
<TouchableOpacity 
  style={styles.dayHeader}
  onPress={() => hasActivities && toggleDayExpanded(index)}
  activeOpacity={hasActivities ? 0.7 : 1}
>
  <View style={styles.dayHeaderLeft}>
    {hasActivities && (
      <Ionicons 
        name={isDayExpanded ? "chevron-down" : "chevron-forward"} 
        size={18} 
        color="#666" 
        style={{ marginRight: 8 }}
      />
    )}
    <Text style={[styles.dayName, isTodayDay && styles.dayNameToday]}>
      {WEEKDAY_SHORT[index]}
    </Text>
    <Text style={styles.dayDate}>{formatDate(getDateForDay(index))}</Text>
    {isTodayDay && (
      <View style={styles.todayBadge}>
        <Text style={styles.todayBadgeText}>Today</Text>
      </View>
    )}
  </View>
  
  <View style={styles.dayProgress}>
    {goals > 0 ? (
      <>
        <Text style={styles.progressText}>{completed}/{goals}</Text>
        {isCompletedDay && (
          <Ionicons name="checkmark-circle" size={20} color="#50C878" />
        )}
      </>
    ) : hasActivities ? (
      <Text style={styles.progressText}>{completed}</Text>
    ) : (
      <Text style={styles.noGoalsText}>No goals</Text>
    )}
  </View>
</TouchableOpacity>
```

**Expandable Content**:
```javascript
{isDayExpanded && hasActivities && (() => {
  // Group activities by language
  const languageActivities = new Map();
  
  // ... grouping logic ...
  
  return (
    <View style={styles.dayActivities}>
      {Array.from(languageActivities.entries()).map(([lang, activities]) => (
        <View key={lang} style={styles.languageCard}>
          {/* Language icon */}
          <View style={[styles.languageIconContainer, { backgroundColor: language?.color }]}>
            <Text>{language.nativeChar}</Text>
          </View>
          
          {/* Activity icons */}
          <View style={styles.activityIconsRow}>
            {activityOrder.map((activity) => (
              <View key={activity} style={styles.activityIconWrapper}>
                <View style={[styles.activityIconCircle, { backgroundColor: colors.light }]}>
                  <Ionicons name={activityIcon} color={colors.primary} />
                  {/* Count badge */}
                  <View style={styles.activityCountBadge}>
                    <Text>{completedCount}/{goalCount}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
})()}
```

---

## Visual Comparison

### Weekly Goals

**Before**:
```
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Monday  │ │ Tuesday │ │Wednesday│
│ [goals] │ │ [goals] │ │ [goals] │
└─────────┘ └─────────┘ └─────────┘
┌─────────┐ ┌─────────┐ ┌─────────┐
│Thursday │ │ Friday  │ │Saturday │
│ [goals] │ │ [goals] │ │ [goals] │
└─────────┘ └─────────┘ └─────────┘
```

**After**:
```
┌────────────────────────────────┐
│ Monday                         │
│ ┌──────────────────────────┐  │ ← White card
│ │ ┌──┐  📖  🎧  ✍️       │  │
│ │ │ಕ │  ²   ¹   ³        │  │ ← Gray activity card
│ │ └──┘                   │  │
│ └──────────────────────────┘  │
└────────────────────────────────┘
┌────────────────────────────────┐
│ Tuesday                        │
│ ┌──────────────────────────┐  │
│ │ ...                      │  │
│ └──────────────────────────┘  │
└────────────────────────────────┘
```

### Weekly Overview

**Before** (collapsed):
```
┌────────────────────────────────┐
│ Mon  1/27/26  [Today]   2/3 ✓ │
└────────────────────────────────┘
```

**After** (expanded):
```
┌────────────────────────────────┐
│ ▼ Mon  1/27/26  [Today]  2/3 ✓│ ← Clickable header
├────────────────────────────────┤
│ ┌──────────────────────────┐  │
│ │ ┌──┐  📖  🎧           │  │ ← Activity cards
│ │ │ಕ │  1/1  1/1         │  │
│ │ └──┘                   │  │
│ └──────────────────────────┘  │
└────────────────────────────────┘
```

---

## User Experience Improvements

### Weekly Goals
1. **Better Scanability**: All days visible at once
2. **More Space**: Activity cards have room to breathe
3. **Clear Hierarchy**: White cards contain gray activity cards
4. **Mobile-Friendly**: No need to zoom or scroll horizontally

### Weekly Overview
1. **On-Demand Details**: Tap to see what you completed
2. **Quick Summary**: See progress without expanding
3. **Consistent Design**: Same activity cards as Weekly Goals
4. **Visual Feedback**: Chevron shows expand state
5. **Smart Interaction**: Only days with activities are clickable

---

## Technical Implementation

### State Management

**Expanded Days**:
```javascript
const [expandedDays, setExpandedDays] = useState({});
// Structure: { 0: true, 2: true, ... } (dayIndex: isExpanded)
```

**Toggle Logic**:
```javascript
const toggleDayExpanded = (dayIndex) => {
  setExpandedDays(prev => ({
    ...prev,
    [dayIndex]: !prev[dayIndex]
  }));
};
```

### Activity Grouping

Both sections now use the same grouping logic:

```javascript
// Group activities by language
const languageActivities = new Map();

// Add from goals
Object.entries(dayGoals).forEach(([lang, activities]) => {
  if (!languageActivities.has(lang)) {
    languageActivities.set(lang, new Map());
  }
  Object.entries(activities).forEach(([activity, goalCount]) => {
    languageActivities.get(lang).set(activity, { goalCount, completedCount: 0 });
  });
});

// Add from progress
Object.entries(dayProgress).forEach(([lang, activities]) => {
  // ... merge with goals ...
});
```

### Conditional Rendering

**Show chevron only if activities exist**:
```javascript
{hasActivities && (
  <Ionicons 
    name={isDayExpanded ? "chevron-down" : "chevron-forward"} 
    size={18} 
    color="#666" 
  />
)}
```

**Make header clickable only if activities exist**:
```javascript
<TouchableOpacity 
  onPress={() => hasActivities && toggleDayExpanded(index)}
  activeOpacity={hasActivities ? 0.7 : 1}
>
```

---

## Styling Details

### Color Scheme

**Day Cards** (containers):
- Background: `#FFFFFF` (white)
- Border: `#E0E0E0` (light gray)
- Shadow: `rgba(0,0,0,0.05)` (subtle)
- Today: `#F0F7FF` (light blue)

**Activity Cards** (nested):
- Background: `#F8F8F8` (gray)
- Border top: `#F0F0F0` (separator)
- Language icon: Dynamic color per language
- Activity icons: Color per activity type

### Spacing

**Weekly Goals**:
- Card gap: 12px
- Card padding: 16px
- Activity gap: 6px

**Weekly Overview**:
- Card gap: 12px
- Card padding: 16px
- Header to activities: 12px padding + 1px border
- Activity gap: 8px

### Shadows & Elevation

```javascript
shadowColor: '#000',
shadowOffset: { width: 0, height: 1 },
shadowOpacity: 0.05,
shadowRadius: 2,
elevation: 1,  // Android elevation
```

---

## Files Modified

1. **`components/WeeklyGoalsSection.js`**
   - Changed weekGrid to vertical layout
   - Updated day card width to 100%
   - Changed backgrounds (white cards, gray activities)
   - Added shadow/elevation

2. **`components/WeeklyOverviewSection.js`**
   - Added expandedDays state
   - Added toggleDayExpanded function
   - Made day headers clickable
   - Added chevron icons
   - Added expandable activity cards
   - Updated styling for visual hierarchy

---

## Testing Checklist

### Weekly Goals
- ✅ Days stack vertically
- ✅ White background on day cards
- ✅ Gray background on activity cards
- ✅ Empty days show "Tap to add"
- ✅ Activity cards group by language
- ✅ Activity icons display with counts

### Weekly Overview
- ✅ Days show progress summary
- ✅ Chevron appears on days with activities
- ✅ Tapping expands/collapses day
- ✅ Expanded view shows unified activity cards
- ✅ Activity cards match Weekly Goals design
- ✅ Today badge shows on current day
- ✅ White day card contains gray activity cards
- ✅ Days without activities not clickable

---

## Browser Compatibility

- ✅ iOS Safari
- ✅ Android Chrome
- ✅ React Native Web

---

## Performance Notes

- State updates are localized (only expandedDays changes)
- No unnecessary re-renders
- Activity grouping happens per-day (not global)
- Map data structures for efficient lookups

---

## Future Enhancements (Optional)

1. **Animations**: Smooth expand/collapse transitions
2. **Swipe Gestures**: Swipe to expand/collapse
3. **Bulk Actions**: Expand/collapse all days
4. **Persistence**: Remember expanded state across sessions
5. **Activity Details**: Tap activity to see which specific items were completed
6. **Quick Add**: Long press to add activity from overview

---

## Related Documentation

- **WEEKLY_CARDS_REDESIGN.md**: Original unified card design
- **ProfileScreen.js**: Parent component containing both sections

---

**Last Updated**: January 29, 2026  
**Status**: ✅ Complete and tested
