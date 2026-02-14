# Dashboard Activity Graph & Consistent Ordering Update
**Date:** January 28, 2026  
**Version:** 2.6

## Overview
This update adds a visual weekly activity graph to the Dashboard and ensures consistent ordering of activity chips across all languages. The graph provides an at-a-glance view of the user's learning patterns over the past week, showing both activity counts and words learned.

## Key Features

### 1. **Weekly Activity Bar Graph**
- **Location**: Between streak banner and "Today's Goals" section
- **Display**: 7-day bar chart showing activities per day
- **Highlights**: Today's bar is highlighted in darker blue
- **Counts**: Bubbles above bars show activity count for non-zero days
- **Stats**: Summary row below graph showing total activities and words for the week

### 2. **Consistent Activity Chip Ordering**
- **Fixed Order**: reading, listening, writing, speaking, conversation
- **Applied**: All language sections show activities in the same order
- **Benefit**: Easier to scan and compare across languages

### 3. **New Backend Endpoint**
- **Endpoint**: `GET /api/weekly-stats?days=7`
- **Returns**: Daily aggregates of activities and words for past N days
- **Data**: Date, day name, activity count, word count

## Visual Design

### Weekly Activity Graph

```
┌─────────────────────────────────────────────┐
│ Past Week Activity                          │
│                                             │
│     6      23    29    8                   │ ← Count bubbles
│   ▄▄▄   ▄▄▄▄▄  ▄▄▄▄▄  ▄▄▄                 │
│   ███   █████  █████  ███                  │ ← Bars
│   ███   █████  █████  ███                  │
│ ▄ ███ ▄ █████  █████  ███                  │
│ █ ███ █ █████  █████  ███                  │
│ ─ ─── ─ ─────  ─────  ───                  │
│Thu Fri Sat Sun Mon Tue Wed (today)         │ ← Day labels
│                                             │
│ ───────────────────────────────────────── │
│                                             │
│  ✓ 66            📖 210                    │ ← Weekly totals
│  Activities       Words                     │
└─────────────────────────────────────────────┘
```

### Activity Chip Consistency

**Before** (random order):
```
Kannada: [💬 1/1] [📖 2/2] [✍️ 1/2] [🎧 1/1]
Urdu:    [✍️ 0/1] [💬 1/1] [📖 1/1]
Tamil:   [🎧 0/1] [📖 2/2]
```

**After** (consistent order):
```
Kannada: [📖 2/2] [🎧 1/1] [✍️ 1/2] [💬 1/1]
Urdu:    [📖 1/1] [✍️ 0/1] [💬 1/1]
Tamil:   [📖 2/2] [🎧 0/1]
```

## Technical Implementation

### Backend Changes

#### **backend/main.py**

1. **New Endpoint**:
   ```python
   @app.get("/api/weekly-stats")
   def get_weekly_stats(days: int = 7):
       """Get activity and word counts for the past N days"""
       # Query activity_history for date-grouped counts
       # Parse activity_data JSON to count words
       # Return daily stats with date, day name, activities, words
   ```

2. **Query Logic**:
   ```python
   # Activity counts by date
   SELECT 
       DATE(completed_at) as date,
       COUNT(*) as activity_count
   FROM activity_history
   WHERE user_id = 1 AND completed_at >= ?
   GROUP BY DATE(completed_at)
   
   # Word counts from activity_data JSON
   SELECT 
       DATE(completed_at) as date,
       activity_data
   FROM activity_history
   WHERE user_id = 1 AND completed_at >= ?
   ```

3. **Word Counting**:
   - Parses `activity_data` JSON
   - Counts entries in `vocabulary`, `sentences`, `questions` arrays
   - Aggregates by date

4. **Response Format**:
   ```json
   {
     "stats": [
       {
         "date": "2026-01-22",
         "day": "Thu",
         "activities": 0,
         "words": 0
       },
       {
         "date": "2026-01-23",
         "day": "Fri",
         "activities": 6,
         "words": 30
       }
     ]
   }
   ```

### Frontend Changes

#### **screens/DashboardScreen.js**

1. **New Constant**:
   ```javascript
   const ACTIVITY_ORDER = ['reading', 'listening', 'writing', 'speaking', 'conversation'];
   ```

2. **New State**:
   ```javascript
   const [weeklyStats, setWeeklyStats] = useState([]);
   ```

3. **Load Function**:
   ```javascript
   const loadWeeklyStats = async () => {
     const response = await fetch(`${API_BASE_URL}/api/weekly-stats?days=7`);
     const data = await response.json();
     setWeeklyStats(data.stats || []);
   };
   ```

4. **Weekly Graph Component**:
   ```jsx
   {weeklyStats.length > 0 && (
     <View style={styles.weeklyGraphContainer}>
       <Text style={styles.graphTitle}>Past Week Activity</Text>
       <View style={styles.graphContent}>
         {/* Bar Graph */}
         <View style={styles.barsContainer}>
           {weeklyStats.map((day, index) => {
             const maxActivities = Math.max(...weeklyStats.map(d => d.activities), 1);
             const activityHeight = (day.activities / maxActivities) * 100;
             const isToday = index === weeklyStats.length - 1;
             
             return (
               <View key={day.date} style={styles.barColumn}>
                 {/* Count bubble */}
                 {day.activities > 0 && (
                   <View style={styles.countBubble}>
                     <Text>{day.activities}</Text>
                   </View>
                 )}
                 {/* Bar */}
                 <View style={[
                   styles.bar,
                   { 
                     height: `${activityHeight}%`,
                     backgroundColor: isToday ? '#4A90E2' : '#A8D5FF'
                   }
                 ]} />
                 {/* Day label */}
                 <Text style={isToday && styles.todayLabel}>
                   {day.day}
                 </Text>
               </View>
             );
           })}
         </View>
         
         {/* Stats Summary */}
         <View style={styles.statsRow}>
           <View style={styles.statItem}>
             <Ionicons name="checkmark-circle" color="#50C878" />
             <Text>{totalActivities}</Text>
             <Text>Activities</Text>
           </View>
           <View style={styles.statItem}>
             <Ionicons name="book" color="#4A90E2" />
             <Text>{totalWords}</Text>
             <Text>Words</Text>
           </View>
         </View>
       </View>
     </View>
   )}
   ```

5. **Updated Activity Chips Rendering**:
   ```javascript
   // OLD: Object.entries(activitySummary).map(...)
   // NEW: ACTIVITY_ORDER.filter(...).map(...)
   
   {ACTIVITY_ORDER
     .filter(activity => activitySummary[activity])
     .map((activity) => {
       const { completed, goalCount } = activitySummary[activity];
       // Render chip
     })}
   ```

6. **New Styles**:
   ```javascript
   weeklyGraphContainer: {
     backgroundColor: '#FFFFFF',
     borderBottomWidth: 1,
     borderBottomColor: '#F0F0F0',
     paddingVertical: 20,
     paddingHorizontal: 20,
   },
   graphTitle: {
     fontSize: 16,
     fontWeight: '600',
     color: '#1A1A1A',
     marginBottom: 16,
   },
   barsContainer: {
     flexDirection: 'row',
     alignItems: 'flex-end',
     height: 120,
     gap: 8,
   },
   barColumn: {
     flex: 1,
     alignItems: 'center',
   },
   bar: {
     width: '100%',
     borderRadius: 6,
     minHeight: 4,
   },
   countBubble: {
     position: 'absolute',
     top: -24,
     backgroundColor: '#4A90E2',
     borderRadius: 10,
     paddingHorizontal: 6,
     paddingVertical: 2,
   },
   dayLabel: {
     fontSize: 11,
     color: '#999',
   },
   todayLabel: {
     color: '#4A90E2',
     fontWeight: 'bold',
   },
   statsRow: {
     flexDirection: 'row',
     justifyContent: 'space-around',
     paddingTop: 16,
     borderTopWidth: 1,
     borderTopColor: '#F0F0F0',
   },
   ```

## User Experience Flow

### Scenario 1: User Opens Dashboard
1. **Sees**: Streak banner at top
2. **Sees**: Weekly activity graph showing past 7 days
3. **Observes**: Today's bar is highlighted in blue
4. **Reads**: Total activities (66) and words (210) for the week
5. **Sees**: Today's goals section below

### Scenario 2: User Reviews Weekly Progress
1. **Scans**: Bar heights show activity distribution
2. **Notices**: Monday and Tuesday had most activities (23, 29)
3. **Sees**: Thursday and Saturday had no activity
4. **Reflects**: Can identify patterns and gaps in practice

### Scenario 3: User Compares Languages
1. **Looks at Kannada**: [📖 2/2] [🎧 1/1] [✍️ 1/2] [💬 1/1]
2. **Looks at Urdu**: [📖 1/1] [✍️ 0/1] [💬 1/1]
3. **Notices**: Same order makes it easy to compare
4. **Identifies**: Both languages need writing practice

### Scenario 4: User Completes Activity
1. **Completes**: Reading activity
2. **Graph**: Will update next time dashboard loads
3. **Today's bar**: Will grow taller with new activity
4. **Count bubble**: Will increment by 1

## Benefits

### 1. **Visual Progress Tracking**
- See weekly patterns at a glance
- Identify productive and idle days
- Motivate consistency with visual feedback

### 2. **Data-Driven Insights**
- Total activities and words provide concrete metrics
- 7-day view shows meaningful trends
- Compare current week to expectations

### 3. **Improved Scannability**
- Consistent activity order reduces cognitive load
- Easier to compare goals across languages
- Familiar pattern helps muscle memory

### 4. **Engagement & Motivation**
- Visual bars create satisfying progress visualization
- Empty days motivate users to maintain streak
- Growing totals provide sense of accomplishment

### 5. **Aligned with App Theme**
- Simple, clean bar chart design
- Uses app's color palette (blues, greens)
- Consistent spacing and typography

## Graph Features

### Bar Height Calculation
- **Formula**: `(activities / maxActivities) * 100`
- **Min Height**: 4px (ensures visibility even for low counts)
- **Max Height**: 100% of container (120px)

### Color Scheme
- **Today**: Primary blue (#4A90E2)
- **Past Days**: Light blue (#A8D5FF)
- **Count Bubbles**: Primary blue (#4A90E2) background, white text

### Interactive Elements
- **Non-interactive**: Graph is purely visual (no taps)
- **Future**: Could add tap to see day details

### Empty State
- **Condition**: `weeklyStats.length === 0`
- **Behavior**: Graph doesn't render
- **Rationale**: No data to show on first use

## Testing Checklist

### Backend Tests
- [ ] `/api/weekly-stats` endpoint responds correctly
- [ ] Activity counts are accurate
- [ ] Word counts parse JSON correctly
- [ ] Date range calculation works for past 7 days
- [ ] Days without activity return 0 counts
- [ ] Response includes all 7 days

### Frontend Tests
- [ ] Graph renders with correct number of bars (7)
- [ ] Bar heights scale proportionally
- [ ] Today's bar is highlighted
- [ ] Count bubbles appear for non-zero days
- [ ] Day labels are correct (Thu, Fri, etc.)
- [ ] Today's label is bold
- [ ] Total activities sum is correct
- [ ] Total words sum is correct
- [ ] Graph doesn't render when no data

### Activity Chip Tests
- [ ] Chips appear in consistent order
- [ ] Order matches: reading, listening, writing, speaking, conversation
- [ ] Only activities with goals are shown
- [ ] Order is same across all languages

### Visual Tests
- [ ] Graph aligns with app theme
- [ ] Bars have rounded corners
- [ ] Count bubbles are centered above bars
- [ ] Stats row has proper spacing
- [ ] Icons are correct (checkmark, book)

### Edge Cases
- [ ] All days have zero activities
- [ ] One day has extremely high activity count
- [ ] User has no activity history
- [ ] Only one activity in entire week
- [ ] Many activities spread evenly

## API Response Examples

### Typical Week
```json
{
  "stats": [
    {"date": "2026-01-22", "day": "Thu", "activities": 0, "words": 0},
    {"date": "2026-01-23", "day": "Fri", "activities": 6, "words": 30},
    {"date": "2026-01-24", "day": "Sat", "activities": 0, "words": 0},
    {"date": "2026-01-25", "day": "Sun", "activities": 0, "words": 0},
    {"date": "2026-01-26", "day": "Mon", "activities": 23, "words": 105},
    {"date": "2026-01-27", "day": "Tue", "activities": 29, "words": 70},
    {"date": "2026-01-28", "day": "Wed", "activities": 8, "words": 5}
  ]
}
```

### New User (No Activity)
```json
{
  "stats": [
    {"date": "2026-01-22", "day": "Thu", "activities": 0, "words": 0},
    {"date": "2026-01-23", "day": "Fri", "activities": 0, "words": 0},
    {"date": "2026-01-24", "day": "Sat", "activities": 0, "words": 0},
    {"date": "2026-01-25", "day": "Sun", "activities": 0, "words": 0},
    {"date": "2026-01-26", "day": "Mon", "activities": 0, "words": 0},
    {"date": "2026-01-27", "day": "Tue", "activities": 0, "words": 0},
    {"date": "2026-01-28", "day": "Wed", "activities": 0, "words": 0}
  ]
}
```

## Performance Considerations

### Backend
- Single SQL query for activity counts (efficient GROUP BY)
- Single SQL query for activity data (date filter only)
- JSON parsing done in Python (fast)
- 7-day default is reasonable (not too much data)

### Frontend
- Data loaded once on mount (not on every render)
- Bar height calculation is simple math (O(n))
- No complex animations or transitions
- Conditional render (only shows when data exists)

## Migration Notes

### For Users
- **No action required** - New features appear automatically
- **New view**: Weekly activity graph above goals
- **Improved layout**: Activities always in same order

### For Developers
- New backend endpoint: `/api/weekly-stats`
- New frontend state: `weeklyStats`
- New constant: `ACTIVITY_ORDER`
- Activity chip rendering updated to use filter + map

## Code Locations

### Modified Files
1. **`backend/main.py`**:
   - Added `/api/weekly-stats` endpoint (lines ~2279-2349)
   - Queries `activity_history` table
   - Parses JSON for word counts

2. **`screens/DashboardScreen.js`**:
   - Added `ACTIVITY_ORDER` constant (line ~18)
   - Added `weeklyStats` state (line ~53)
   - Added `loadWeeklyStats` function (lines ~93-101)
   - Added weekly graph component (lines ~186-241)
   - Updated activity chip rendering to use `ACTIVITY_ORDER` (lines ~298-305)
   - Added graph styles (lines ~483-562)

## Future Enhancements

### Possible Next Steps
1. **Tap to Expand**: Tap a bar to see activity breakdown for that day
2. **Date Range Selector**: Toggle between 7, 14, 30 days
3. **Activity Type Breakdown**: Stacked bars showing activity types
4. **Comparison View**: Compare current week to previous week
5. **Animations**: Animate bars growing when data loads
6. **Goals Overlay**: Show goal lines on graph
7. **Export**: Share graph as image
8. **Trends**: Show week-over-week percentage change

## Summary

This update enhances the Dashboard with:
- **Visual weekly activity graph** showing 7-day progress with bar chart
- **Consistent activity chip ordering** across all languages
- **New backend endpoint** for aggregated weekly stats
- **Totals summary** showing activities and words for the week

Users can now see their learning patterns at a glance, identify productive days, and compare progress across languages more easily. The graph provides motivating visual feedback while the consistent ordering reduces cognitive load! 📊✨
