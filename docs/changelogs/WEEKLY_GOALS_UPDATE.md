# Weekly Goals Update - Implementation Summary

## Overview
The "Daily Goals" feature has been revamped into a comprehensive "Weekly Goals" system that allows users to plan their language learning activities for each weekday (Monday-Friday).

## Changes Made

### 1. Database Updates (`backend/db.py`)
- **New Table**: `weekly_goals` - Stores per-language, per-activity goals for each day of the week
  - Fields: `language`, `activity_type`, `day_of_week`, `target_count`
- **New Functions**:
  - `get_weekly_goals(language)` - Retrieves the full weekly plan
  - `update_weekly_goals(language, weekly_goals)` - Saves the weekly plan
  - `get_today_goals(language)` - Returns only today's goals based on current day of week

### 2. Backend API (`backend/main.py`)
- **New Endpoints**:
  - `GET /api/weekly-goals/{language}` - Fetch weekly goals
  - `PUT /api/weekly-goals/{language}` - Update weekly goals
  - `GET /api/today-goals/{language}` - Get today's specific goals
- **Updated Endpoint**:
  - `GET /api/dashboard/{language}` - Now returns today's goals from the weekly plan instead of static daily goals

### 3. Profile Screen UI (`screens/ProfileScreen.js`)
The Daily Goals section has been completely redesigned:

#### New Features:
- **Weekly Canvas**: Visual grid showing Monday-Friday with separate columns for each day
- **Language Badges**: Activities are represented by colored language badges showing:
  - Language native character or code
  - Activity type icon (book, headset, mic, etc.)
  - Count badge showing how many of that activity
- **Interactive Controls**:
  - Click badges to remove activities
  - Add activities using the grid below (one button per day per activity)
- **Sleek Design**: 
  - Dashed borders for empty days
  - Color-coded badges matching language colors
  - Activity type indicators with activity-specific colors
  - Clean, modern layout

#### UI Components:
- **Week Canvas**: 5 columns (Mon-Fri) with distinct day containers
- **Activity Badges**: Rounded badges with language branding + activity icons
- **Count Indicators**: Small numbered badges on each activity
- **Add Activity Grid**: Matrix of activity rows with day buttons

### 4. Dashboard Screen (`screens/DashboardScreen.js`)
- **Updated Title**: "Today's Goals" with a badge indicating "From Weekly Plan"
- **Smart Display**: Only shows activities that have goals for today (hides zero-goal activities)
- **Empty State**: Shows helpful message if no goals are set for today
- **Integration**: Automatically loads today's goals based on the weekly plan

## How It Works

1. **Setting Weekly Goals**:
   - Go to Profile → Weekly Goals section
   - For each activity type, click the + button under the day you want to add it
   - Multiple activities can be added to the same day
   - Same activity can be added multiple times (count increases)
   - Click on a badge to remove/decrease count
   - Click "Save Weekly Goals" to persist changes

2. **Viewing Today's Goals**:
   - Dashboard automatically shows goals for the current weekday
   - Progress tracking works the same as before
   - Weekends (Saturday/Sunday) show no goals by default

3. **Multi-Language Support**:
   - Each language can have its own independent weekly plan
   - Switch languages in Profile to configure different weekly schedules
   - Language badges use the native characters (e.g., க for Tamil, ಕ for Kannada, اردو for Urdu)

## Visual Design

The interface uses:
- **Language Colors**: Each language's distinct color for badges
- **Activity Colors**: 
  - Reading: Blue (#4A90E2)
  - Listening: Green (#50C878)
  - Writing: Red (#FF6B6B)
  - Speaking: Orange (#FF9500)
  - Conversation: Purple (#9B59B6)
- **Typography**: Clean, modern fonts with proper hierarchy
- **Spacing**: Generous padding and gaps for easy interaction
- **Shadows**: Subtle shadows on badges for depth

## Example Weekly Plan

**Kannada Learning Schedule**:
- **Monday**: 2 Reading activities, 1 Listening activity
- **Tuesday**: 2 Speaking activities
- **Wednesday**: 1 Reading activity, 1 Writing activity
- **Thursday**: 3 Listening activities
- **Friday**: 1 Conversation activity, 1 Speaking activity

Each day's activities appear as colored badges in the Profile screen and automatically show up in the Dashboard on the corresponding day.

## Testing

All endpoints have been tested and verified:
- ✅ Weekly goals can be saved and retrieved
- ✅ Today's goals are calculated correctly based on day of week
- ✅ Dashboard displays today's goals from weekly plan
- ✅ UI is responsive and intuitive
- ✅ Multiple languages supported independently

## Future Enhancements

Potential improvements:
1. Drag-and-drop to reorder activities within days
2. Copy week template for quick setup
3. Weekly summary view showing total planned activities
4. Completion statistics per week
5. Weekend goal support (optional)
