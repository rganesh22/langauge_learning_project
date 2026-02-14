# Weekly Goals System - Complete Revamp (v2.0)

## Overview
The weekly goals system has been completely revamped with a modern, multi-language interface that allows you to plan activities for all 7 days of the week (Monday-Sunday) across all active languages.

## 🎯 Key Features

### 1. **Enhanced Weekly Goals Editor**
- **Full Week Support**: Now includes Saturday and Sunday (previously Mon-Fri only)
- **Multi-Language Planning**: Add activities from ANY active language to ANY day
- **Visual Day Cards**: Each day displays as a card showing all planned activities
- **Modal-Based Selection**: Click any day to open a beautiful modal with all languages and activities
- **Smart Badges**: Activities show as colored badges with language icon + activity icon + count

### 2. **Weekly Overview Tracker** (NEW!)
- **Track Your Week**: See your planned goals vs actual progress for the current week
- **Historical View**: Navigate to previous weeks to review past performance
- **Future Planning**: Look ahead to see upcoming week's goals
- **Daily Breakdown**: Each day shows:
  - Total goals vs completed count
  - Individual activity progress by language
  - Green checkmarks for completed activities
  - "Today" badge highlighting current day
- **Week Navigation**: Easily switch between weeks with arrow buttons

### 3. **Dashboard Integration**
- Shows today's goals from the weekly plan
- Multi-language support - displays goals from all languages for today
- Empty state when no goals are set
- "From Weekly Plan" badge

## 🛠️ Technical Implementation

### Backend Enhancements

#### New Database Functions (`backend/db.py`):
```python
- get_all_languages_today_goals() # Today's goals across all languages
- get_week_goals_all_languages(week_offset) # Full week goals for all languages
- get_week_progress(week_offset) # Actual progress for a specific week
```

#### New API Endpoints (`backend/main.py`):
```
GET /api/today-goals-all
- Returns: Today's goals for ALL active languages
- Example: {"goals": {"kannada": {"reading": 2}, "hindi": {"listening": 1}}, "day": "monday", "date": "2026-01-27"}

GET /api/week-overview?week_offset=0
- Returns: Complete week data with goals and progress
- week_offset: 0 (current), -1 (last week), 1 (next week), etc.
- Includes:
  - week_start and week_end dates
  - goals: day -> language -> activity -> count
  - progress: date -> language -> activity -> count
```

### Frontend Components

#### 1. **WeeklyGoalsSection** (`components/WeeklyGoalsSection.js`)
New standalone component for weekly goal planning:
- **Week Grid**: 7 day cards (Mon-Sun) in a responsive grid (3 columns)
- **Day Cards**: Show all activities for that day with colored badges
- **Activity Badge**: Displays:
  - Language badge (native character or code)
  - Activity icon (book, headset, mic, etc.)
  - Count badge (number in corner)
- **Modal Interface**: 
  - Opens when clicking a day
  - Shows all active languages
  - Each language has all 5 activities to choose from
  - Click to add (can add multiple times)
  - Click badge in day card to remove
- **Save Functionality**: Saves goals for all languages at once

#### 2. **WeeklyOverviewSection** (`components/WeeklyOverviewSection.js`)
New standalone component for progress tracking:
- **Week Navigation**: Previous/Next week buttons with week title
- **Week Display**: Shows "This Week", "Last Week", or date range
- **Day Rows**: Each day shows:
  - Day name, date, and "Today" badge if applicable
  - Total progress (completed/goals)
  - Green checkmark if all goals completed
  - List of all activities with individual progress
- **Activity Items**: Display:
  - Language badge
  - Activity icon
  - Activity name
  - Progress count (completed/goals)
  - Checkmark when done
- **Scrollable**: Can view entire week with scroll

### UI/UX Enhancements

#### Visual Design:
- **Consistent Theme**: Matches existing app design
- **Color Coding**:
  - Languages: Use native colors (e.g., Tamil red, Kannada yellow, etc.)
  - Activities: Reading (blue), Listening (green), Writing (red), Speaking (orange), Conversation (purple)
- **Typography**: Clear hierarchy with bold titles, regular text, and subtle labels
- **Spacing**: Generous padding and gaps for easy interaction
- **Shadows**: Subtle depth on cards and badges

#### Interaction:
- **Tap Day Card**: Opens modal to add activities
- **Tap Activity Badge**: Removes/decreases count
- **Week Navigation**: Swipe-like feel with arrow buttons
- **Modal**: Bottom sheet animation, tap outside to close
- **Feedback**: Visual states for hover, press, and completion

### Section Placement
The new sections are placed in optimal order:
1. Profile Header
2. Streak Banner
3. Languages Overview
4. **🆕 Weekly Goals** (Planning interface)
5. **🆕 Weekly Overview** (Tracking interface)
6. Stats & Configuration (with Learning Progress)
7. SRS Settings

## 📱 User Experience

### Planning Your Week (Weekly Goals):
1. Open Profile tab
2. See "Weekly Goals" section (expanded by default)
3. View week grid with Monday-Sunday
4. Click any day card
5. Modal opens showing all active languages
6. Select language and choose activities
7. Add multiple activities (count increases)
8. Close modal - see badges appear in day card
9. Click badge to remove if needed
10. Click "Save Weekly Goals" when done

### Tracking Progress (Weekly Overview):
1. Open "Weekly Overview" section in Profile
2. See current week with all goals and progress
3. Today is highlighted with blue border
4. Each day shows:
   - Total progress at top-right
   - Each activity with individual progress
   - Green checkmarks for completed items
5. Use arrows to navigate to previous/next weeks
6. Review past performance or plan ahead

### Dashboard Experience:
1. Open Dashboard
2. See "Today's Goals" with "From Weekly Plan" badge
3. Only shows activities scheduled for today
4. Progress bars track completion
5. Works across all languages

## 🎨 Example Weekly Schedule

Here's what a multilingual week might look like:

**Monday** 🌅
- 2× Kannada Reading
- 1× Kannada Listening
- 1× Hindi Speaking

**Tuesday** 📚
- 2× Tamil Reading
- 1× Hindi Conversation

**Wednesday** 🎧
- 1× Kannada Writing
- 1× Kannada Reading
- 2× Malayalam Listening

**Thursday** 🗣️
- 3× Hindi Speaking
- 1× Tamil Listening

**Friday** ✍️
- 1× Kannada Conversation
- 1× Tamil Writing
- 1× Hindi Reading

**Saturday** 🎉 (New!)
- 1× Kannada Reading (light day)

**Sunday** 😊 (New!)
- Rest day or 1× Conversation for maintenance

## 🔧 Developer Notes

### Data Structure:
```javascript
// Goals are stored per language
weekly_goals: {
  day: {
    language: {
      activity: count
    }
  }
}

// Example:
{
  "monday": {
    "kannada": {"reading": 2, "listening": 1},
    "hindi": {"speaking": 1}
  },
  "tuesday": {
    "tamil": {"reading": 2}
  }
}
```

### API Response Format:
```json
{
  "week_start": "2026-01-26",
  "week_end": "2026-02-01",
  "week_offset": 0,
  "goals": {/* day-based goals */},
  "progress": {/* date-based progress */}
}
```

### Component Props:
```javascript
<WeeklyGoalsSection 
  expanded={boolean}
  onToggle={() => void}
/>

<WeeklyOverviewSection 
  expanded={boolean}
  onToggle={() => void}
/>
```

## ✅ Testing

All features have been tested:
- ✅ Weekly goals can be saved for multiple languages
- ✅ Goals persist across sessions
- ✅ Today's goals calculated correctly for any day of week
- ✅ Week overview shows correct goals and progress
- ✅ Week navigation works (past, current, future weeks)
- ✅ Dashboard displays today's multi-language goals
- ✅ Activity badges display correctly with counts
- ✅ Modal interface is responsive and intuitive
- ✅ Progress tracking shows accurate completion status

## 🚀 Future Enhancements

Potential improvements:
1. **Drag & Drop**: Reorder or move activities between days
2. **Templates**: Save and reuse weekly schedules
3. **Smart Suggestions**: AI-powered goal recommendations
4. **Notifications**: Reminders for today's goals
5. **Statistics**: Weekly/monthly progress reports
6. **Copy Week**: Duplicate previous week's schedule
7. **Bulk Edit**: Multi-select days for batch operations
8. **Export**: Share or print weekly schedules

## 📊 Benefits

### For Users:
- **Flexibility**: Plan different activities for different days
- **Multi-Language**: Study multiple languages in organized way
- **Visual**: See entire week at a glance
- **Tracking**: Monitor progress with historical data
- **Motivation**: Green checkmarks and completion stats
- **Realistic**: Weekend planning for balanced learning

### For Learning:
- **Variety**: Mix activities throughout the week
- **Balance**: Ensure all skills (reading, listening, etc.) are practiced
- **Consistency**: Set realistic, achievable weekly goals
- **Accountability**: Track what you actually accomplish
- **Insights**: Identify patterns in your learning habits

## 🎉 Summary

The Weekly Goals system has evolved from a simple daily counter to a comprehensive week-long planning and tracking tool that:
- Supports all 7 days of the week (not just weekdays)
- Works across all active languages simultaneously
- Provides both planning (edit) and tracking (view) interfaces
- Integrates seamlessly with the Dashboard
- Offers historical tracking and future planning
- Uses modern, intuitive UI components
- Maintains clean, maintainable code architecture

This is a complete, production-ready feature that significantly enhances the language learning experience! 🚀
