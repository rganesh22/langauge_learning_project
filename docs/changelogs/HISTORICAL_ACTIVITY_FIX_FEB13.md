# Historical Activity Fix - February 13, 2026

## Issue
When clicking on a historical activity card in the calendar day modal, the app threw an error:
```
ReferenceError: openHistoricalActivity is not defined
```

## Root Cause
The `ContributionGraph` component is defined at the top of `ProfileScreen.js` as a separate component, but it was trying to use the `openHistoricalActivity` function which was defined later in the parent `ProfileScreen` component (around line 916). The nested component couldn't access the parent's function.

## Solution

### 1. Added `navigation` prop to `ContributionGraph` component
**File**: `screens/ProfileScreen.js`

Updated component definition to accept navigation:
```javascript
const ContributionGraph = ({ data, viewType, language, navigation }) => {
```

### 2. Defined `openHistoricalActivity` inside `ContributionGraph`
Added the function inside the `ContributionGraph` component (after `formatDateShort`):
```javascript
const openHistoricalActivity = (activityId, activityType) => {
  setShowDayModal(false);
  setTimeout(() => {
    navigation.navigate('Activity', {
      activityId,
      activityType,
      fromHistory: true,
    });
  }, 300);
};
```

### 3. Passed `navigation` when using the component
Updated the usage of `ContributionGraph`:
```javascript
<ContributionGraph 
  data={dailyStats} 
  viewType={statsView}
  language={LANGUAGES.find(l => l.code === profileLanguage)?.name || 'Kannada'}
  navigation={navigation}
/>
```

## Weekly Goals Language Icon Feature
The second requested feature (clicking language icons in weekly goals to open the modal focused on that language) was **already implemented correctly**:
- Language icons are wrapped in `TouchableOpacity` (line ~355)
- They call `handleDayClick(day, lang)` which opens the modal with only that language expanded
- No changes needed

## Testing Checklist
- [x] Backend restarted successfully on port 5001
- [x] Frontend restarted successfully on port 8081
- [ ] Click on a historical activity card in calendar day modal - should navigate to activity
- [ ] Click on a language icon in weekly goals - should open modal with that language expanded

## Files Changed
1. `screens/ProfileScreen.js` - Fixed `openHistoricalActivity` scope issue

## Technical Details
- The fix involved properly passing the `navigation` object down to the nested component
- This allows the nested component to handle its own navigation logic
- The function is now scoped correctly within the component that uses it
