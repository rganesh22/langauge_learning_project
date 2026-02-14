# Profile & Dashboard Updates - January 28, 2026

## Overview
Enhanced streak chips, connected Languages section to database, and refined language selector styling.

## Changes Made

### 1. Dashboard - Enhanced Streak Chip

**Updated**: Added "Day Streak" text to streak chip

#### Before
```javascript
<Text style={styles.streakChipText}>{streak}</Text>
```

#### After
```javascript
<Text style={styles.streakChipText}>{streak} Day Streak</Text>
```

**Visual change**:
```
Before: 🌐 Fluo  [🔥 5]
After:  🌐 Fluo  [🔥 5 Day Streak]
```

### 2. Profile - Enhanced Streak Chip

**Updated**: Added "Day Streak" text to streak chip next to "Languages"

#### Before
```javascript
<Text style={styles.streakChipText}>{profile.streak || 0}</Text>
```

#### After
```javascript
<Text style={styles.streakChipText}>{profile.streak || 0} Day Streak</Text>
```

**Visual change**:
```
Before: Languages          [🔥 5]
After:  Languages          [🔥 5 Day Streak]
```

### 3. Profile - Languages Section Connected to Database

**Major Update**: Replaced hardcoded language list with dynamic data from API

#### Before (Hardcoded)
```javascript
const levelMap = {
  'english': 'C2',
  'tamil': 'B2',
  'spanish': 'B2',
  'telugu': 'B1',
  'kannada': 'B1',
  'hindi': 'B1',
  'urdu': 'A2',
  'french': 'A2',
  'malayalam': 'A1',
  'welsh': 'A1',
};
const advancedLangs = LANGUAGES.map((lang) => {
  const level = levelMap[lang.code] || 'A1';
  return { lang, level };
})
```

#### After (Dynamic from DB)
```javascript
{learningLanguages
  .filter(item => ['C1', 'C2'].includes(item.level))
  .sort((a, b) => {
    const order = { 'C1': 1, 'C2': 2 };
    return order[b.level] - order[a.level];
  })
  .map((item) => {
    const lang = LANGUAGES.find(l => l.code === item.language);
    if (!lang) return null;
    return (
      <View key={lang.code} style={styles.languageItem}>
        {/* Language display */}
      </View>
    );
  })}
```

**Data Source**:
- API: `GET /api/languages/learning`
- Returns: `{ languages: [{ language: 'kannada', level: 'B1', total_mastered: 150, progress: 45 }] }`
- Backend function: `get_user_learning_languages()` (checks activity_history and word_states tables)

**Behavior**:
- **Before**: All 10 languages shown with hardcoded levels
- **After**: Only shows languages user is actively learning (has activity history or word states)
- Levels calculated from actual mastery data via `calculate_user_level()`

### 4. Profile - Language Selector Outline Removed

**Updated**: Removed border from language selector button in Learning Progress section

#### Before
```javascript
languageButtonLarge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F8F8F8',
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
  gap: 10,
  borderWidth: 1,        // ← Removed
  borderColor: '#E0E0E0', // ← Removed
}
```

#### After
```javascript
languageButtonLarge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#F8F8F8',
  borderRadius: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
  gap: 10,
  // No border
}
```

**Visual change**:
```
Before: [Border] कन्नड Kannada >
After:  [No Border] कन्नड Kannada >
```

## Backend Integration

### API Endpoint Used
```python
@app.get("/api/languages/learning")
def get_learning_languages():
    """Get all languages the user is learning with their levels"""
    languages = db.get_user_learning_languages()
    result = []
    for lang_code in languages:
        level_info = db.calculate_user_level(lang_code)
        result.append({
            'language': lang_code,
            'level': level_info.get('level', 'A1'),
            'total_mastered': level_info.get('total_mastered', 0),
            'progress': level_info.get('progress', 0),
        })
    return {'languages': result}
```

### Database Function
```python
def get_user_learning_languages() -> List[str]:
    """Get all languages the user is learning (has activity history or word states)"""
    # Checks activity_history table
    # Checks word_states table (joined with vocabulary)
    # Returns union of both
    # Defaults to ['kannada'] if empty
```

### Level Calculation
Levels (A1, A2, B1, B2, C1, C2) are calculated based on:
- Total words mastered
- Mastery distribution across levels
- Activity completion history

## Code Organization

### ProfileScreen.js Structure
1. **State variables** (line ~360):
   - `learningLanguages` state already existed
   - Used by `loadLearningLanguages()` function

2. **Languages Section** (line ~780):
   - Now uses `learningLanguages.filter().map()`
   - Grouped into 3 columns: Advanced, Intermediate, Beginner
   - Each column filters by level range

3. **Data Flow**:
   ```
   loadProfile() 
     → loadLearningLanguages() 
       → fetch('/api/languages/learning')
         → setLearningLanguages(data.languages)
           → Languages section renders dynamically
   ```

## Visual Comparison

### Streak Chips
```
Before:
┌────────────────────────────┐
│ 🌐 Fluo  [🔥 5]           │ Dashboard
└────────────────────────────┘
┌────────────────────────────┐
│ Languages      [🔥 5]      │ Profile
└────────────────────────────┘

After:
┌────────────────────────────┐
│ 🌐 Fluo  [🔥 5 Day Streak]│ Dashboard
└────────────────────────────┘
┌────────────────────────────┐
│ Languages  [🔥 5 Day Streak]│ Profile
└────────────────────────────┘
```

### Languages Display
```
Before (Hardcoded):
Advanced    | Intermediate | Beginner
English C2  | Kannada B1   | Urdu A2
            | Hindi B1     | Malayalam A1
            | Telugu B1    | Welsh A1
            | Tamil B2     |
            | Spanish B2   |
(All 10 languages shown)

After (Dynamic from DB):
Advanced    | Intermediate | Beginner
            | Kannada B1   |
(Only languages with activity shown)
```

### Language Selector
```
Before:
┌─────────────────────────┐
│ [Border visible]        │
│ कन्नड Kannada          >│
└─────────────────────────┘

After:
  कन्नड Kannada          >
  (No visible border)
```

## Benefits

### 1. Clearer Streak Information
- "5 Day Streak" is more understandable than just "5"
- Consistent with original banner design
- No ambiguity about what the number means

### 2. Accurate Language List
- Shows only languages user is actively learning
- Levels reflect actual progress (not hardcoded)
- Automatically updates as user progresses
- Cleaner display (no languages with zero activity)

### 3. Cleaner Language Selector
- Less visual clutter without border
- Better integration with page design
- Maintains readability with background color

## File Changes

| File | Changes | Net Change |
|------|---------|------------|
| DashboardScreen.js | Added "Day Streak" text | +1 word |
| ProfileScreen.js | - Added "Day Streak" text<br>- Replaced 3 hardcoded language columns<br>- Removed language selector border | -140 lines (removed hardcoded data)<br>+60 lines (dynamic rendering)<br>-2 lines (border styles)<br>**Net: -82 lines** |

## Testing Checklist

### Dashboard
- [ ] Streak chip shows "X Day Streak" format
- [ ] Flame icon displays correctly
- [ ] Text wraps properly if needed
- [ ] Chip background is light pink

### Profile - Streak Chip
- [ ] Streak chip shows "X Day Streak" format next to "Languages"
- [ ] Flame icon displays correctly
- [ ] Positioned on right side of header
- [ ] Aligns properly with "Languages" title

### Profile - Languages Section
- [ ] Only shows languages with activity history or word states
- [ ] Levels (A1-C2) reflect actual calculated levels from DB
- [ ] Languages correctly sorted into Advanced/Intermediate/Beginner columns
- [ ] Empty columns don't cause layout issues
- [ ] Native characters display correctly
- [ ] Color coding works for each language
- [ ] Level badges show correct colors (red→orange→green→teal→blue→purple)

### Profile - Language Selector
- [ ] No visible border/outline on language selector button
- [ ] Background color (#F8F8F8) still visible
- [ ] Native script displays correctly
- [ ] Chevron icon visible on right
- [ ] Button still clickable/functional
- [ ] Modal opens when tapped

## Database Requirements

For languages to appear in Languages section, user must have:
- **Activity history** in that language (completed any activity), OR
- **Word states** for vocabulary in that language (studied flashcards)

**Example query results**:
```sql
-- User has completed activities in Kannada
SELECT DISTINCT language FROM activity_history WHERE user_id = 1;
-- Returns: ['kannada']

-- User has word states in Kannada  
SELECT DISTINCT v.language FROM word_states ws 
  JOIN vocabulary v ON ws.word_id = v.id 
  WHERE ws.user_id = 1;
-- Returns: ['kannada']

-- Combined result
-- Languages shown: Kannada (with calculated level)
```

## Migration Notes

- No database changes needed (uses existing tables)
- No breaking changes (backwards compatible)
- If user has no activity, defaults to showing Kannada
- Existing hardcoded level map removed (was for demo purposes)
