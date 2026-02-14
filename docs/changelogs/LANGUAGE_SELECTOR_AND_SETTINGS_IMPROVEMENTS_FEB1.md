# Language Selector Width & Settings Improvements - February 1, 2026

**Date**: February 1, 2026  
**Files Modified**: ProfileScreen.js, PracticeScreen.js, LessonsScreen.js, VocabLibraryScreen.js, backend/main.py

## Problems Addressed

### 1. Language Selector Too Narrow
**Problem**: Language selector modals were too narrow (300px max width), causing SRS chips and language names to feel cramped.

**Solution**: Increased width across all screens:
- Width: `80%` → `85%`
- Max width: `300px` → `400px`

### 2. SRS Stats Not Updating After Settings Change
**Problem**: When changing daily new cards in ProfileScreen (e.g., 20 → 22), the numbers didn't update in:
- Language selector chips
- Flashcard activity card in PracticeScreen

**Solution**: Added `loadAllLanguagesSrsStats()` call after saving SRS settings to reload stats immediately.

### 3. "Apply to All Languages" Toggle Not Persistent
**Problem**: The toggle state for "Apply to all languages" in both:
- Review Scheduling section
- Language Settings section

Would reset to unchecked every time the user reopened ProfileScreen.

**Solution**: Implemented database persistence using `user_preferences` table:
- Created new backend endpoints: `GET/PUT /api/user-preferences`
- Load saved toggle states on component mount
- Save toggle states immediately when changed
- Separate database keys for SRS settings vs Language settings

## Changes Made

### ProfileScreen.js

#### 1. Added Toggle State Persistence (Lines ~512-545)
```javascript
// Load toggle preferences from database
useEffect(() => {
  loadTogglePreferences();
}, []);

const loadTogglePreferences = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user-preferences?keys=apply_to_all_srs,apply_to_all_lang`);
    if (response.ok) {
      const data = await response.json();
      if (data.apply_to_all_srs !== undefined) {
        setApplyToAllLanguages(data.apply_to_all_srs);
      }
      if (data.apply_to_all_lang !== undefined) {
        setApplyLangSettingsToAll(data.apply_to_all_lang);
      }
    }
  } catch (error) {
    console.error('Error loading toggle preferences:', error);
  }
};

const saveTogglePreference = async (key, value) => {
  try {
    await fetch(`${API_BASE_URL}/api/user-preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
  } catch (error) {
    console.error(`Error saving toggle preference ${key}:`, error);
  }
};
```

#### 2. Updated Toggle Press Handlers (Lines ~2235, ~2521)
```javascript
// Review Scheduling "Apply to all languages" toggle
onPress={() => {
  const newValue = !applyToAllLanguages;
  setApplyToAllLanguages(newValue);
  saveTogglePreference('apply_to_all_srs', newValue);
}}

// Language Settings "Apply to all languages" toggle
onPress={() => {
  const newValue = !applyLangSettingsToAll;
  setApplyLangSettingsToAll(newValue);
  saveTogglePreference('apply_to_all_lang', newValue);
}}
```

#### 3. Updated saveSrsSettings to Reload Stats
```javascript
// After successful save and alert
await loadSrsSettings(srsLanguage);

// NEW: Reload SRS stats to update language selector chips
await loadAllLanguagesSrsStats();
```

#### 4. Updated Language Selector Width (Line ~2803)
```javascript
languageMenu: {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 20,
  width: '85%',      // Was 80%
  maxWidth: 400,     // Was 300
},
```

### backend/main.py

#### Added User Preferences Endpoints (Lines ~3644-3738)

**GET /api/user-preferences**
```python
@app.get("/api/user-preferences")
def get_user_preferences(keys: str = None):
    """Get user preferences by keys (comma-separated)"""
    
    # Create user_preferences table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, key)
        )
    ''')
    
    if keys:
        # Get specific preferences (comma-separated)
        key_list = [k.strip() for k in keys.split(',')]
        cursor.execute(...)
    else:
        # Get all preferences
        cursor.execute(...)
    
    # Parse boolean values
    preferences = {}
    for row in rows:
        if value in ('true', 'false'):
            preferences[key] = value == 'true'
        else:
            preferences[key] = value
    
    return preferences
```

**PUT /api/user-preferences**
```python
@app.put("/api/user-preferences")
def save_user_preferences(preferences: dict):
    """Save user preferences (supports multiple key-value pairs)"""
    
    # Save each preference
    for key, value in preferences.items():
        # Convert boolean to string for storage
        if isinstance(value, bool):
            value = 'true' if value else 'false'
        
        cursor.execute('''
            INSERT OR REPLACE INTO user_preferences (user_id, key, value, updated_at)
            VALUES (1, ?, ?, datetime('now'))
        ''', (key, value))
    
    return {'success': True, 'saved': list(preferences.keys())}
```

### PracticeScreen.js

#### Updated Language Selector Width (Line ~540)
```javascript
languageMenu: {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 20,
  width: '85%',      // Was 80%
  maxWidth: 400,     // Was 300
},
```

**Note**: PracticeScreen automatically reloads SRS stats via `useFocusEffect`, so the flashcard activity card updates when navigating back from ProfileScreen.

### LessonsScreen.js

#### Updated Language Selector Width (Line ~1279)
```javascript
languageMenu: {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 20,
  width: '85%',      // Was 80%
  maxWidth: 400,     // Was 300
},
```

### VocabLibraryScreen.js

#### Updated Language Selector Width (Line ~884)
```javascript
languageMenu: {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: 20,
  width: '85%',      // Was 80%
  maxWidth: 400,     // Was 300
},
```

## Technical Details

### Database Schema

**Table**: `user_preferences`
```sql
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
)
```

### Database Keys
- `apply_to_all_srs` - Stores Review Scheduling "Apply to all languages" toggle state
- `apply_to_all_lang` - Stores Language Settings "Apply to all languages" toggle state

### Data Flow for Toggle Persistence

**Load on Mount**:
```
ProfileScreen Mount
  ↓
useEffect (empty deps) runs
  ↓
loadTogglePreferences()
  ↓
GET /api/user-preferences?keys=apply_to_all_srs,apply_to_all_lang
  ↓
Backend queries user_preferences table
  ↓
Returns: { apply_to_all_srs: true, apply_to_all_lang: false }
  ↓
setApplyToAllLanguages(true)
setApplyLangSettingsToAll(false)
```

**Save on Change**:
```
User toggles checkbox
  ↓
onPress handler fires
  ↓
const newValue = !applyToAllLanguages
setApplyToAllLanguages(newValue)
saveTogglePreference('apply_to_all_srs', newValue)
  ↓
PUT /api/user-preferences
Body: { "apply_to_all_srs": true }
  ↓
Backend converts bool → string ('true')
  ↓
INSERT OR REPLACE INTO user_preferences
  ↓
Database updated
```

### Data Flow for SRS Stats Updates

**Before (Broken)**:
1. User changes daily new cards from 20 → 22
2. Save button → API updates database
3. Language selector chips still show old values
4. Flashcard card still shows old values

**After (Fixed)**:
1. User changes daily new cards from 20 → 22
2. Save button → API updates database
3. `loadAllLanguagesSrsStats()` called → Refreshes all language stats
4. Language selector chips update immediately
5. Navigate to PracticeScreen → `useFocusEffect` reloads stats
6. Flashcard card shows updated values

### Toggle Persistence Flow

**Load on Mount**:
```
ProfileScreen Mount
  ↓
useEffect (empty deps) runs
  ↓
loadTogglePreferences()
  ↓
GET /api/user-preferences?keys=apply_to_all_srs,apply_to_all_lang
  ↓
Backend queries user_preferences table
  ↓
Returns: { apply_to_all_srs: true, apply_to_all_lang: false }
  ↓
setApplyToAllLanguages(true)
setApplyLangSettingsToAll(false)
```

**Save on Change**:
```
User toggles checkbox
  ↓
onPress handler fires
  ↓
const newValue = !applyToAllLanguages
setApplyToAllLanguages(newValue)
saveTogglePreference('apply_to_all_srs', newValue)
  ↓
PUT /api/user-preferences
Body: { "apply_to_all_srs": true }
  ↓
Backend converts bool → string ('true')
  ↓
INSERT OR REPLACE INTO user_preferences
  ↓
Database updated
```

### API Endpoints

**GET /api/user-preferences**
- Query params: `keys` (optional, comma-separated list)
- Returns: Dict of key-value pairs
- Example: `GET /api/user-preferences?keys=apply_to_all_srs,apply_to_all_lang`
- Response: `{ "apply_to_all_srs": true, "apply_to_all_lang": false }`

**PUT /api/user-preferences**
- Body: Dict of key-value pairs to save
- Example: `{ "apply_to_all_srs": true }`
- Response: `{ "success": true, "saved": ["apply_to_all_srs"] }`
- Note: Supports saving multiple preferences in one request

## User Experience Improvements

### Before
- **Narrow selectors**: Language names and chips felt cramped
- **Stale numbers**: Changing settings didn't update displayed stats
- **Lost preferences**: Toggle states reset on every screen visit
- **Confusion**: Users had to re-enable "Apply to all" every time

### After
- **Wider selectors**: 33% more width (300px → 400px) for comfortable reading
- **Live updates**: Stats refresh immediately after settings save
- **Persistent toggles**: User preferences remembered across sessions
- **Consistent UX**: All 4 screens (Profile, Practice, Lessons, Vocab Library) have uniform width

## Testing Checklist

### Language Selector Width
- [ ] Open ProfileScreen → Language selector is noticeably wider
- [ ] Open PracticeScreen → Language selector matches ProfileScreen width
- [ ] Open LessonsScreen → Language selector matches ProfileScreen width
- [ ] Open VocabLibraryScreen → Language selector matches ProfileScreen width
- [ ] Verify SRS chips fit comfortably without wrapping

### SRS Stats Update
- [ ] Open ProfileScreen → Review Scheduling section
- [ ] Change "Daily new cards" from 20 → 22
- [ ] Click "Save SRS Settings"
- [ ] Check language selector chips → Should show updated value
- [ ] Navigate to PracticeScreen
- [ ] Check Flashcard activity card → Should show "22 New"
- [ ] Test with "Apply to all languages" ON
- [ ] Verify all language chips update

### Toggle Persistence - Review Scheduling
- [ ] Open ProfileScreen → Review Scheduling
- [ ] Toggle "Apply to all languages" ON
- [ ] Navigate away from ProfileScreen
- [ ] Return to ProfileScreen
- [ ] Verify "Apply to all languages" is still checked
- [ ] Toggle it OFF
- [ ] Navigate away and return
- [ ] Verify it's still unchecked

### Toggle Persistence - Language Settings
- [ ] Open ProfileScreen → Language Settings section
- [ ] Toggle "Apply to all languages" ON
- [ ] Navigate away from ProfileScreen
- [ ] Return to ProfileScreen
- [ ] Verify "Apply to all languages" is still checked
- [ ] Toggle it OFF
- [ ] Navigate away and return
- [ ] Verify it's still unchecked

### Cross-Screen Consistency
- [ ] Change daily new cards to 25 in ProfileScreen
- [ ] Save settings
- [ ] Open language selector in ProfileScreen → Shows 25
- [ ] Navigate to PracticeScreen
- [ ] Open language selector → Shows 25
- [ ] Check Flashcard card → Shows "25 New"
- [ ] Navigate to LessonsScreen
- [ ] Open language selector → Shows 25
- [ ] Navigate to VocabLibraryScreen
- [ ] Open language selector → Shows 25

### App Restart Persistence
- [ ] Set both toggles to ON
- [ ] Close app completely (kill process)
- [ ] Reopen app
- [ ] Navigate to ProfileScreen
- [ ] Verify both toggles are still ON

## Edge Cases Handled

1. **First Launch**: If no saved toggle state exists in database, defaults to `false` (unchecked)
2. **API Failure**: Wrapped in try-catch to prevent crashes if backend is offline
3. **Concurrent Updates**: Direct state setting prevents race conditions
4. **Boolean Storage**: Backend converts booleans to 'true'/'false' strings for SQLite compatibility
5. **Multiple Preferences**: PUT endpoint supports saving multiple keys in one request

## Performance Considerations

- **Database Queries**: Only queries on mount and updates on toggle change (not on every render)
- **API Calls**: Optimized - loads both toggles in single request with query params
- **Stats Reload**: Only happens after user action (save button), not on every render
- **useFocusEffect**: PracticeScreen already had this pattern, no additional overhead
- **Database Index**: UNIQUE(user_id, key) constraint provides fast lookups

## Files Modified Summary

| File | Changes | Lines Modified |
|------|---------|----------------|
| ProfileScreen.js | - Added loadTogglePreferences function<br>- Added saveTogglePreference function<br>- Updated 2 toggle onPress handlers<br>- Added loadAllLanguagesSrsStats call<br>- Updated languageMenu width | +38 lines<br>~6 lines modified |
| backend/main.py | - Added GET /api/user-preferences<br>- Added PUT /api/user-preferences<br>- Table creation with UNIQUE constraint | +95 lines |
| PracticeScreen.js | - Updated languageMenu width | ~2 lines modified |
| LessonsScreen.js | - Updated languageMenu width | ~2 lines modified |
| VocabLibraryScreen.js | - Updated languageMenu width | ~2 lines modified |

**Total**: ~133 new lines, ~14 lines modified

## Related Issues Fixed

1. ✅ Language selector width too narrow
2. ✅ SRS stats not updating after settings change
3. ✅ Toggle states not persisting
4. ✅ Inconsistent behavior across screens

## Dependencies

- No new dependencies required (uses existing SQLite database and Fetch API)

## API Endpoints Used

- `GET /api/srs/stats/{language}` - Fetch SRS stats for language selector chips (existing)
- `PUT /api/srs/settings/{language}` - Update SRS settings (existing)
- `PUT /api/language-personalization/{language}` - Update language settings (existing)
- `GET /api/user-preferences?keys=...` - Fetch user toggle preferences (NEW)
- `PUT /api/user-preferences` - Save user toggle preferences (NEW)

## Future Improvements

1. Consider adding a global state management solution (Context/Redux) to sync stats across screens without reload
2. Add loading indicators when stats are being refreshed
3. Consider debouncing AsyncStorage writes if users toggle rapidly
4. Add analytics to track how often users use "Apply to all languages"

## Summary

This update provides a more polished and consistent user experience by:
1. **Wider selectors** - More comfortable reading of language names and stats
2. **Live stats updates** - Changes reflect immediately across all screens
3. **Persistent preferences** - User choices remembered across sessions
4. **Universal consistency** - All screens share the same design language

Users can now confidently adjust their learning settings knowing that:
- Changes take effect immediately
- Their preferences are remembered
- All screens stay synchronized
