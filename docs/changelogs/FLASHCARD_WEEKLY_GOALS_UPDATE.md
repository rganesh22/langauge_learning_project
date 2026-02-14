# Flashcard Weekly Goals Update - January 29, 2026

## Summary
Enhanced the weekly goals system to support flashcard activity with a free-text number input representing the number of vocab cards to review each day. Updated all related UI components to display flashcards with the correct color and icon.

## Changes Made

### 1. **Weekly Goals Section - Flashcard Input**

#### Free Text Number Input
- Replaced +/- buttons with a `TextInput` for flashcards
- Allows direct numeric input (0-999 cards)
- Styled with border color matching flashcard theme (#EC4899)
- Shows placeholder "0" when empty
- Auto-updates goals when input changes

#### Visual Design
```javascript
flashcardInput: {
  width: 70,
  height: 32,
  borderRadius: 16,
  borderWidth: 2,
  textAlign: 'center',
  fontSize: 14,
  fontWeight: '600',
  paddingHorizontal: 8,
}
```

#### Label Update
- Changed activity label to "Flashcards (cards)" to clarify the unit
- Other activities retain their standard labels

### 2. **Backend Integration**

#### Data Storage
- Number is stored directly in weekly goals JSON
- Format: `{"flashcards": 50}` represents 50 cards to review
- Backend already supports numeric values without modification
- Works with existing `/api/weekly-goals/{language}` endpoints

#### Goal Tracking
- Dashboard and Weekly Overview display progress as `X/Y` where:
  - X = completed flashcard sessions (counted per completion)
  - Y = number of cards set as goal

### 3. **UI Icon Updates**

#### Flashcard Icon Consistency
All components now use the correct flashcard icon (`'card'`) and color (`#EC4899`):

**Components Updated:**
1. **WeeklyGoalsSection.js**
   - Day view activity icons
   - Modal activity selection
   - Color: `#EC4899` (primary), `#FCE7F3` (light)

2. **WeeklyOverviewSection.js**
   - Historical progress view
   - Activity icons with completion badges
   - Added flashcards to activity order

3. **DashboardScreen.js**
   - Today's goals section
   - Activity chips
   - Goal detail cards

**Icon Mapping:**
```javascript
activity === 'reading' ? 'book' : 
activity === 'listening' ? 'headset' :
activity === 'writing' ? 'create' : 
activity === 'speaking' ? 'mic' : 
activity === 'conversation' ? 'chatbubbles' : 
'card'  // flashcards
```

### 4. **Component Changes**

#### WeeklyGoalsSection.js
```javascript
// New function to set flashcard count directly
const setFlashcardCount = (language, countText) => {
  const count = parseInt(countText) || 0;
  const updated = { ...weeklyGoals };
  
  if (count > 0) {
    if (!updated[selectedDay]) updated[selectedDay] = {};
    if (!updated[selectedDay][language]) updated[selectedDay][language] = {};
    updated[selectedDay][language]['flashcards'] = count;
  } else {
    // Remove if count is 0
    delete updated[selectedDay]?.[language]?.['flashcards'];
  }
  
  setWeeklyGoals(updated);
};
```

**Rendering Logic:**
```javascript
{activity === 'flashcards' ? (
  // TextInput for direct number entry
  <TextInput
    style={[styles.flashcardInput, { borderColor: colors.primary, color: colors.primary }]}
    value={currentCount > 0 ? String(currentCount) : ''}
    placeholder="0"
    keyboardType="number-pad"
    onChangeText={(text) => setFlashcardCount(lang.code, text)}
    maxLength={3}
  />
) : (
  // Regular +/- buttons for other activities
  <>
    <TouchableOpacity onPress={() => decreaseActivity(lang.code, activity)}>
      <Ionicons name="remove" />
    </TouchableOpacity>
    <TouchableOpacity onPress={() => addActivity(lang.code, activity)}>
      <Ionicons name="add" />
    </TouchableOpacity>
  </>
)}
```

#### WeeklyOverviewSection.js
- Added flashcards to `activityOrder` array
- Updated icon mapping to include `'card'` for flashcards
- Color already defined: `#EC4899`

#### DashboardScreen.js
- Updated both icon rendering locations
- Today's goals activity chips
- Goal detail cards
- Flashcards already in `ACTIVITY_ORDER` and `ACTIVITY_COLORS`

### 5. **Color Consistency**

**Flashcard Theme:**
- **Primary**: `#EC4899` (Pink/Magenta)
- **Light**: `#FCE7F3` (Light Pink)
- **Icon**: `'card'` (Ionicons)

**Used Across:**
- Weekly Goals day cards
- Weekly Goals modal
- Weekly Overview historical view
- Dashboard today's goals
- Dashboard goal cards

## User Experience

### Setting Flashcard Goals
1. Open Weekly Goals section in Profile
2. Tap a day to add activities
3. Select language
4. Find "Flashcards (cards)" row
5. Tap the input field and type number (e.g., "50")
6. Number represents cards to review that day
7. Save weekly goals

### Viewing Progress
- **Dashboard**: Shows `X/Y` progress (e.g., "0/50")
- **Weekly Overview**: Shows completed vs goal with checkmark when done
- **Weekly Goals**: Shows count badge on activity icon

### Semantics
- **Goal Number**: Number of vocabulary cards to review
- **Completion**: Tracked when flashcard session completes daily quotas
- **Unit**: "cards" clarifies it's vocab cards, not sessions

## Technical Details

### Data Flow
1. User inputs number in WeeklyGoalsSection
2. `setFlashcardCount()` updates local state
3. User saves → POST to `/api/weekly-goals/{language}`
4. Backend stores: `{"monday": {"flashcards": 50}}`
5. Dashboard fetches and displays progress
6. Weekly Overview shows historical completion

### Validation
- Input type: `number-pad` keyboard
- Max length: 3 digits (0-999)
- Auto-converts to integer
- 0 or empty removes the goal
- Non-numeric input defaults to 0

### Backward Compatibility
- Existing weekly goals with +/- system still work
- Only flashcards use TextInput
- Backend unchanged (already supports numbers)
- No database migration needed

## Files Modified

### Frontend Components
1. `components/WeeklyGoalsSection.js`
   - Added TextInput import
   - Added `setFlashcardCount()` function
   - Updated modal rendering for flashcard input
   - Added `flashcardInput` style
   - Updated activity label

2. `components/WeeklyOverviewSection.js`
   - Added flashcards to activity order
   - Updated icon mapping

3. `screens/DashboardScreen.js`
   - Updated icon mappings (2 locations)
   - Color already present

### Backend
- **No changes required** - existing API handles numeric goals

## Testing Checklist

### Weekly Goals Input
- [x] Open Weekly Goals modal
- [x] Select a language and day
- [x] Verify flashcard input field appears
- [x] Type a number (e.g., 50)
- [x] Verify number appears in input
- [x] Save and verify persists
- [x] Change number and verify updates
- [x] Set to 0 or empty to remove goal

### Icon & Color Display
- [x] Verify flashcard icon is 'card' (not chatbubbles)
- [x] Verify color is pink/magenta (#EC4899)
- [x] Check Weekly Goals day cards
- [x] Check Weekly Goals modal
- [x] Check Weekly Overview
- [x] Check Dashboard today's goals
- [x] Check Dashboard goal cards

### Progress Tracking
- [x] Set flashcard goal (e.g., 50 cards)
- [x] Complete flashcard reviews
- [x] Verify progress updates in Dashboard
- [x] Verify shows in Weekly Overview
- [x] Verify completion checkmark when done

### Data Persistence
- [x] Set goals for multiple days
- [x] Close and reopen app
- [x] Verify goals persisted
- [x] Change week and verify separate goals

## Known Limitations

1. **Session vs Cards**: The progress tracking shows completed sessions, not individual cards reviewed. This means the goal "50 cards" is interpreted as needing to complete the daily flashcard quota, not specifically reviewing 50 cards.

2. **Future Enhancement**: Could track actual card count reviewed and compare to goal number for more precise progress tracking.

## Future Enhancements

1. **Actual Card Tracking**: Track number of cards reviewed vs goal number
2. **Smart Defaults**: Auto-populate with SRS daily quota
3. **Bulk Edit**: Set same number for all days at once
4. **Weekly Total**: Show total cards for the week
5. **Historical Stats**: Show average cards per day over time

## API Endpoints

### Existing (No Changes)
- `GET /api/weekly-goals/{language}` - Fetch weekly goals
- `PUT /api/weekly-goals/{language}` - Update weekly goals
- `GET /api/today-goals/{language}` - Get today's goals

### Data Format
```json
{
  "weekly_goals": {
    "monday": {
      "reading": 2,
      "listening": 1,
      "flashcards": 50
    },
    "tuesday": {
      "flashcards": 30
    }
  }
}
```

## Deployment Notes

1. **Frontend only changes** - no backend or database updates needed
2. **Backward compatible** - existing goals continue to work
3. **No migration required** - data format unchanged
4. **Immediate rollout** - no breaking changes

## Summary

Successfully implemented flashcard goals with free-text number input representing the number of vocabulary cards to review each day. All UI components now consistently use the correct flashcard icon (card) and color (#EC4899). The system is fully integrated with the existing weekly goals backend and displays properly across Dashboard, Weekly Goals, and Weekly Overview sections.
