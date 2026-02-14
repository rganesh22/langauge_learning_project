# Dashboard Weekly Goals Integration Update
**Date:** January 28, 2026  
**Version:** 2.3

## Overview
This update integrates weekly goals into the Dashboard screen and improves the interaction model for managing goals in the Profile screen. The key changes enable users to see all their language goals for today in one place and quickly jump into activities by clicking goal cards.

## Key Features

### 1. **Collapsible Weekly Goals Section on Dashboard**
- Replaced the single-language "Today's Goals" section with a multi-language "Today's Weekly Goals" section
- Shows goals from ALL active languages (not just the currently selected language)
- Collapsible dropdown interface to save screen space
- Badge indicating "All Languages" to clarify scope

### 2. **Auto-Generate Activity on Goal Click**
- Clicking a goal card now:
  1. **Switches the global language context** to the goal's language
  2. **Auto-navigates** to the activity screen
  3. **Immediately starts** the activity for that language
- No need to manually switch languages first - just tap the goal and go!

### 3. **Weekly Goals Card Click Behavior Change**
- **OLD BEHAVIOR**: Clicking activity badges in the weekly plan (Monday, Tuesday, etc.) would decrement the count
- **NEW BEHAVIOR**: Clicking day cards opens the add/remove tray modal
- **RATIONALE**: Cards are not interactive on their own; the parent day card opens the management modal

### 4. **Real-Time Progress Tracking**
- Dashboard now fetches progress for ALL languages with goals today
- Progress bars update correctly for each language/activity combination
- Checkmarks appear when goals are completed

## Technical Implementation

### Frontend Changes

#### **DashboardScreen.js**
1. **New State Variables**:
   ```javascript
   const [weeklyGoalsExpanded, setWeeklyGoalsExpanded] = useState(true);
   const [allTodayGoals, setAllTodayGoals] = useState({});
   const [allTodayProgress, setAllTodayProgress] = useState({});
   ```

2. **New API Functions**:
   ```javascript
   const loadAllTodayGoals = async () => {
     // Fetches goals for all languages from /api/today-goals-all
     // Then loads progress for each language with goals
   };

   const loadProgressForLanguages = async (languages) => {
     // Loads dashboard data for each language to get progress
     // Stores in allTodayProgress state
   };
   ```

3. **Updated startActivity Function**:
   ```javascript
   const startActivity = (activityType, language = null) => {
     const targetLanguage = language || selectedLanguage;
     // Switch language context if different
     if (language && language !== selectedLanguage) {
       setSelectedLanguage(language);
       setCtxLanguage(language);
     }
     navigation.navigate('Activity', {
       language: targetLanguage,
       activityType,
     });
   };
   ```

4. **New UI Structure**:
   ```jsx
   {/* Weekly Goals Section */}
   <View style={styles.section}>
     <TouchableOpacity 
       style={styles.weeklyGoalsHeader}
       onPress={() => setWeeklyGoalsExpanded(!weeklyGoalsExpanded)}
     >
       <View style={styles.weeklyGoalsHeaderLeft}>
         <Ionicons name={weeklyGoalsExpanded ? "chevron-down" : "chevron-forward"} />
         <Text style={styles.sectionTitle}>Today's Weekly Goals</Text>
       </View>
       <View style={styles.weeklyBadge}>
         <Ionicons name="calendar" />
         <Text>All Languages</Text>
       </View>
     </TouchableOpacity>

     {weeklyGoalsExpanded && (
       <View style={styles.weeklyGoalsContent}>
         {Object.entries(allTodayGoals).map(([lang, activities]) => (
           <View key={lang} style={styles.languageGoalsSection}>
             {/* Language Header with native character/code */}
             <View style={styles.languageGoalsHeader}>...</View>
             
             {/* Activity Cards */}
             {Object.entries(activities).map(([activity, goalCount]) => (
               <TouchableOpacity
                 onPress={() => startActivity(activity, lang)}
               >
                 {/* Progress bar, checkmark, counts, etc. */}
               </TouchableOpacity>
             ))}
           </View>
         ))}
       </View>
     )}
   </View>
   ```

5. **New Styles**:
   ```javascript
   weeklyGoalsHeader: { /* Clickable header with chevron */ },
   weeklyGoalsHeaderLeft: { /* Flex container for chevron + title */ },
   chevronIcon: { /* Spacing for chevron */ },
   weeklyGoalsContent: { /* Container for all language sections */ },
   languageGoalsSection: { /* Container for each language's goals */ },
   languageGoalsHeader: { /* Language name + native char banner */ },
   languageGoalsName: { /* Language name text style */ },
   ```

#### **WeeklyGoalsSection.js**
1. **Removed Interactive Click on Activity Badges**:
   - Changed `<TouchableOpacity>` wrapping activity badges to plain `<View>`
   - Removed `onPress` handler that called `removeActivity()`
   - Day cards still open the modal on click (parent TouchableOpacity remains)

2. **Code Change**:
   ```javascript
   // OLD: TouchableOpacity with onPress to decrement
   <TouchableOpacity
     onPress={(e) => {
       e.stopPropagation();
       removeActivity(day, lang, activity);
     }}
   >
     {/* Badge content */}
   </TouchableOpacity>

   // NEW: Plain View, no click handler
   <View>
     {/* Badge content */}
   </View>
   ```

### Backend Integration

#### **Existing Endpoints Used**
1. **`GET /api/today-goals-all`**:
   - Returns goals for all languages for today
   - Response format:
     ```json
     {
       "goals": {
         "kannada": {"reading": 2, "listening": 1},
         "urdu": {"speaking": 1, "writing": 2}
       },
       "day": "monday",
       "date": "2026-01-28"
     }
     ```

2. **`GET /api/dashboard/{language}`**:
   - Returns dashboard data including progress for a specific language
   - Called multiple times (once per language with goals today)
   - Response includes `progress` object with activity counts

## User Experience Flow

### Scenario 1: User Opens Dashboard
1. Dashboard loads with collapsible "Today's Weekly Goals" section expanded
2. Shows all languages with goals for today
3. Each language has a header with its native character/code
4. Activity cards show progress bars and counts (e.g., "1/2")
5. User can collapse/expand the section with the chevron

### Scenario 2: User Clicks a Goal Card (Different Language)
**Example**: Currently viewing Kannada, clicks an Urdu speaking goal

1. **Click**: User taps the Urdu speaking goal card
2. **Language Switch**: Global language context switches to Urdu
3. **Navigation**: App navigates to Activity screen
4. **Activity Starts**: Speaking activity for Urdu begins immediately
5. **No Extra Steps**: User didn't need to manually switch language first!

### Scenario 3: User Clicks a Goal Card (Same Language)
**Example**: Currently viewing Kannada, clicks a Kannada reading goal

1. **Click**: User taps the Kannada reading goal card
2. **Navigation**: App navigates to Activity screen (no language switch needed)
3. **Activity Starts**: Reading activity for Kannada begins immediately

### Scenario 4: User Manages Weekly Goals (Profile Screen)
**OLD BEHAVIOR**:
- User could click activity badges inside day cards to decrement count
- Confusing because badges looked clickable but only decreased count

**NEW BEHAVIOR**:
1. User clicks on a day card (e.g., "Monday")
2. Modal opens with collapsible language trays
3. User expands desired language
4. User clicks **+** button to add activity or **-** button to remove
5. Modal shows current count badge on activity icons
6. User saves changes with "Save Weekly Goals" button

## Benefits

### 1. **Unified Goal Visibility**
- See all language goals in one place
- No need to switch languages to see what you need to do today
- Clear visual hierarchy by language

### 2. **Streamlined Workflow**
- One-tap access to any activity in any language
- No manual language switching required
- Reduces friction in daily practice routine

### 3. **Clearer Interaction Model**
- Weekly plan day cards are clearly the interactive element
- Activity badges are visual indicators, not buttons
- Modal provides explicit add/remove controls

### 4. **Accurate Progress Tracking**
- Real-time progress for all languages
- Progress bars update correctly after completing activities
- Checkmarks indicate completed goals

## Testing Checklist

### Dashboard Tests
- [ ] Weekly goals section appears on Dashboard
- [ ] Chevron toggles expand/collapse correctly
- [ ] All languages with goals for today are shown
- [ ] Language headers display correct native character or code
- [ ] Activity cards show correct goal counts
- [ ] Progress bars update after completing activities
- [ ] Checkmarks appear when goals are met
- [ ] Clicking a goal card navigates to correct activity
- [ ] Language context switches correctly when clicking different language goal
- [ ] "No goals" message appears when no goals set

### Weekly Goals Tests (Profile Screen)
- [ ] Activity badges in day cards are NOT clickable
- [ ] Clicking day card opens modal
- [ ] Modal shows correct activities and counts
- [ ] Plus button adds activity
- [ ] Minus button removes activity
- [ ] Count badge on activity icons updates correctly
- [ ] Save button persists changes

### Integration Tests
- [ ] Setting goals in Profile updates Dashboard immediately
- [ ] Completing activity on Dashboard updates progress
- [ ] Progress persists across language switches
- [ ] Goals saved for specific week are displayed correctly

## Migration Notes

### For Users
- **No action required** - UI changes are automatic
- **New behavior**: Click day cards to manage goals (not individual badges)
- **New feature**: Click any language goal on Dashboard to jump straight into activity

### For Developers
- No database changes required
- No API endpoint changes required
- Only frontend component changes
- Backward compatible with existing data

## Future Enhancements

### Possible Next Steps
1. **Swipe Actions**: Swipe left on goal card to mark complete without starting activity
2. **Quick Add**: Long-press goal card to add another instance of that activity
3. **Goal Suggestions**: AI-powered suggestions for balanced weekly plans
4. **Streak Integration**: Show mini-streak indicator on language headers
5. **Filtering**: Filter by language or activity type in Dashboard
6. **Sorting**: Sort languages by progress percentage or alphabetically
7. **Notifications**: Remind user of incomplete goals at end of day

## Code Locations

### Modified Files
1. **`screens/DashboardScreen.js`** (Lines ~35-250):
   - Added state variables for weekly goals
   - Added loadAllTodayGoals and loadProgressForLanguages functions
   - Updated startActivity to accept language parameter
   - Replaced Today's Goals section with new Weekly Goals section
   - Added new styles for weekly goals UI

2. **`components/WeeklyGoalsSection.js`** (Lines ~217-244):
   - Removed TouchableOpacity wrapper from activity badges
   - Removed onPress handler that decremented count
   - Day cards still open modal via parent TouchableOpacity

### Related Files (No Changes)
- **`backend/main.py`**: Uses existing `/api/today-goals-all` endpoint
- **`backend/db.py`**: Uses existing `get_all_languages_today_goals()` function
- **`contexts/LanguageContext.js`**: Uses existing context for language switching

## Summary

This update transforms the Dashboard into a true multi-language learning hub where users can see all their daily goals across all languages and jump into any activity with a single tap. The changes to the weekly goals interaction model make it clearer how to add and remove activities from the weekly plan. Together, these improvements significantly reduce friction in the daily learning workflow.

**Key Takeaway**: Less navigation, fewer taps, more learning! 🚀
