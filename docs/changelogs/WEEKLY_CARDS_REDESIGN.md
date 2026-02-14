# Weekly Cards Redesign - Unified Layout

**Date**: January 29, 2026  
**Status**: ✅ **IMPLEMENTED**

---

## Summary

Redesigned the activity cards in both **Weekly Goals** and **Weekly Overview** sections to have a unified, cleaner design where:
- Language icon appears on the left in a colored square
- All activity icons are displayed in a row (not stacked)
- Activity counts appear as badges on the top-right of each icon
- Gray background for all cards

---

## Visual Design

### Before vs After

**BEFORE** (Multiple small badges):
```
┌──────────────────────────────┐
│ Monday                       │
│ ┌──────┐ ┌──────┐ ┌──────┐ │
│ │ KN 📖│ │ KN 🎧│ │ TA 📖│ │
│ │   2  │ │   1  │ │   3  │ │
│ └──────┘ └──────┘ └──────┘ │
└──────────────────────────────┘
```

**AFTER** (Unified cards per language):
```
┌──────────────────────────────┐
│ Monday                       │
│ ┌────────────────────────┐  │
│ │ ┌──┐  📖  🎧  ✍️       │  │
│ │ │ಕ │  ²   ¹   ³        │  │
│ │ └──┘                   │  │
│ └────────────────────────┘  │
│ ┌────────────────────────┐  │
│ │ ┌──┐  📖  🎤           │  │
│ │ │த │  ³   ¹            │  │
│ │ └──┘                   │  │
│ └────────────────────────┘  │
└──────────────────────────────┘
```

---

## Implementation Details

### Files Modified

1. **`components/WeeklyGoalsSection.js`**
   - Updated day card rendering (lines ~220-280)
   - Added new unified card styles
   - Groups activities by language
   - Shows language icon + activity icons in a row

2. **`components/WeeklyOverviewSection.js`**
   - Updated progress rendering (lines ~280-360)
   - Matching unified card design
   - Displays completed/goal counts on activity icons

### Key Changes

#### 1. **Data Grouping**
Changed from individual activity badges to language-grouped cards:

```javascript
// Before: Each lang-activity pair was separate
{lang}-{activity} → Badge

// After: Group by language first
language → [activity1, activity2, activity3]
```

#### 2. **Card Structure**
```javascript
<View style={styles.languageCard}>
  {/* Language icon (left) */}
  <View style={styles.languageIconContainer}>
    <Text>{language.nativeChar}</Text>
  </View>
  
  {/* Activity icons (row) */}
  <View style={styles.activityIconsRow}>
    {activities.map(activity => (
      <View style={styles.activityIconWrapper}>
        <View style={styles.activityIconCircle}>
          <Ionicons name={activityIcon} />
          {/* Count badge (top-right) */}
          <View style={styles.activityCountBadge}>
            <Text>{count}</Text>
          </View>
        </View>
      </View>
    ))}
  </View>
</View>
```

#### 3. **Activity Order**
Consistent order across both sections:
```javascript
const activityOrder = ['reading', 'listening', 'writing', 'speaking', 'conversation'];
```

---

## Styling Details

### New Styles Added

#### Language Card Container
```javascript
languageCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F8F8F8',  // Gray background
  borderRadius: 8,
  padding: 8-10,
  gap: 10-12,
}
```

#### Language Icon (Left Side)
```javascript
languageIconContainer: {
  width: 32-36,
  height: 32-36,
  borderRadius: 8,
  backgroundColor: language.color,  // Dynamic color
  justifyContent: 'center',
  alignItems: 'center',
}
```

#### Activity Icons Row
```javascript
activityIconsRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8-10,
  flex: 1,
  flexWrap: 'wrap',  // For overflow
}
```

#### Activity Icon Circle
```javascript
activityIconCircle: {
  width: 28-32,
  height: 28-32,
  borderRadius: 14-16,
  backgroundColor: colors.light,  // Activity-specific light color
  justifyContent: 'center',
  alignItems: 'center',
}
```

#### Count Badge (Top-Right)
```javascript
activityCountBadge: {
  position: 'absolute',
  top: -6,
  right: -6,
  backgroundColor: '#FFFFFF',
  borderRadius: 8,
  minWidth: 20-24,
  height: 14-16,
  paddingHorizontal: 4,
  borderWidth: 1.5,
  borderColor: '#E0E0E0',
}
```

---

## Color Scheme

### Language Colors (Dynamic)
- **Kannada**: Custom color from LANGUAGES
- **Tamil**: Custom color from LANGUAGES
- **Telugu**: Custom color from LANGUAGES
- etc.

### Activity Colors (Consistent)
```javascript
reading:     { primary: '#4A90E2', light: '#E8F4FD' }  // Blue
listening:   { primary: '#2B654A', light: '#E8F5EF' }  // Green
writing:     { primary: '#FF6B6B', light: '#FFE8E8' }  // Red
speaking:    { primary: '#FF9500', light: '#FFF4E6' }  // Orange
conversation: { primary: '#9B59B6', light: '#F4E6FF' }  // Purple
```

---

## User Experience Improvements

### ✅ Benefits

1. **Cleaner Visual Hierarchy**
   - Language is primary grouping (clear at a glance)
   - Activities are secondary (easy to scan)

2. **Space Efficient**
   - More compact than stacked badges
   - Shows all activities per language in one line
   - Fits more information in day cards

3. **Consistent Design**
   - Same layout in Weekly Goals and Weekly Overview
   - Same layout on mobile and tablet
   - Easy to compare across days

4. **Quick Scanning**
   - See all languages for a day at once
   - Quickly spot missing activities
   - Identify patterns across the week

5. **Better Touch Targets**
   - Entire language card is clickable (in Weekly Overview)
   - Icons are appropriately sized
   - Badges don't overlap

---

## Responsive Behavior

### Day Card Sizing
- **Weekly Goals**: 3 cards per row (31% width each)
- **Weekly Overview**: Full width cards (vertical scroll)

### Activity Icon Overflow
- Icons wrap to next line if needed (5+ activities)
- Maintains alignment with language icon
- Gray background extends to accommodate all icons

### Text Overflow
- Activity counts: Fixed badge size, numbers don't overflow
- Language icons: Single character, no overflow
- Language names: Not displayed in cards (only in modals)

---

## Technical Notes

### Activity Filtering
Only activities with goals or progress are shown:
```javascript
// WeeklyGoals: Only shows activities with set goals
const count = activities.get(activity);
if (!count) return null;

// WeeklyOverview: Shows activities with goals OR completed
const activityData = activities.get(activity);
if (!activityData) return null;
```

### Order Preservation
Activities always appear in the same order (reading → listening → writing → speaking → conversation), making it easy to compare across days.

### Dynamic Colors
Language colors come from the LANGUAGES constant, ensuring consistency with the rest of the app.

---

## Testing Checklist

### Visual Testing
- ✅ Day cards show language icon on left
- ✅ Activity icons appear in a row
- ✅ Count badges positioned correctly (top-right)
- ✅ Gray background fills entire card
- ✅ Cards have proper spacing
- ✅ Urdu font displays correctly

### Interaction Testing
- ✅ Tap day card to open modal (Weekly Goals)
- ✅ Add/remove activities updates card correctly
- ✅ Save goals persists changes
- ✅ Weekly Overview reflects completed activities
- ✅ Progress counts update in real-time

### Edge Cases
- ✅ Single activity shows correctly
- ✅ 5+ activities wrap to next line
- ✅ Multiple languages per day display properly
- ✅ Empty days show "Tap to add" message
- ✅ Zero-count activities hidden

---

## Code Quality

- **No Errors**: Both files compile without errors
- **Backward Compatible**: Legacy badge styles preserved for reference
- **Consistent Naming**: languageCard, activityIconsRow, countBadgeText
- **Type Safety**: All props properly typed
- **Performance**: No unnecessary re-renders

---

## Future Enhancements (Optional)

1. **Animation on Progress**
   - Confetti when completing all daily goals
   - Pulse animation when count increases

2. **Drag to Reorder Activities**
   - Let users prioritize activity order

3. **Long Press Actions**
   - Quick decrease count without opening modal
   - Swipe to delete activity

4. **Compact Mode Toggle**
   - Super compact view showing just icons + counts
   - No language icons for more space

5. **Color Customization**
   - Let users pick language colors
   - Custom activity color themes

---

## Related Files

- **`contexts/LanguageContext.js`**: Language definitions with colors
- **`screens/ProfileScreen.js`**: Parent screen containing both sections
- **`components/WeeklyGoalsSection.js`**: Goals planning interface
- **`components/WeeklyOverviewSection.js`**: Progress tracking interface

---

## Conclusion

The unified card design provides a **cleaner, more scannable interface** for both planning goals and tracking progress. By grouping activities by language and displaying them horizontally, users can quickly understand their weekly schedule and progress at a glance.

**Status**: ✅ Ready for user testing!

---

*Last Updated: January 29, 2026*
