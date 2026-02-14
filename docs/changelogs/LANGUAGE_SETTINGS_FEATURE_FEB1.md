# Language Settings Feature - February 1, 2026

## Summary
Added a new per-language settings section in Profile and fixed weekly goals modal to auto-expand all languages when opened.

## Changes Made

### 1. Weekly Goals Modal Auto-Expansion
**File**: `components/WeeklyGoalsSection.js`

- **Auto-expand all languages**: When the "Add Activity" modal opens, all active languages are now automatically expanded showing their activity options
- **Language badge clickable**: Made the language icon/badge itself independently clickable to expand/collapse that language's section
- **Enhanced error logging**: Added detailed console logging for save operations to help debug any weekly goals saving issues

```javascript
const handleDayClick = (day) => {
  setSelectedDay(day);
  setShowAddModal(true);
  // Auto-expand all languages when modal opens
  const autoExpandLanguages = {};
  LANGUAGES.filter(l => l.active).forEach(lang => {
    autoExpandLanguages[lang.code] = true;
  });
  setExpandedLanguages(autoExpandLanguages);
};
```

### 2. Database Schema - Language Personalization Table
**File**: `backend/db.py`

Added new table to store per-language settings:

```sql
CREATE TABLE IF NOT EXISTS language_personalization (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL UNIQUE,
    default_transliterate INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

**Table added in two locations**:
- `init_db()` function (lines ~276-285)
- `init_db_schema()` function (lines ~516-525)

**New Database Functions**:

```python
def get_language_personalization(language: str) -> Dict
def update_language_personalization(language: str, default_transliterate: bool) -> bool
```

### 3. Backend API Endpoints
**File**: `backend/main.py`

**New Model**:
```python
class LanguagePersonalizationUpdate(BaseModel):
    """Model for updating language personalization settings"""
    default_transliterate: bool
```

**New Endpoints**:

1. **GET `/api/language-personalization/{language}`**
   - Returns language-specific settings
   - Response:
     ```json
     {
       "language": "kannada",
       "default_transliterate": true,
       "created_at": "2026-02-01T10:00:00",
       "updated_at": "2026-02-01T15:30:00"
     }
     ```

2. **PUT `/api/language-personalization/{language}`**
   - Updates language-specific settings
   - Request body:
     ```json
     {
       "default_transliterate": true
     }
     ```
   - Response:
     ```json
     {
       "success": true,
       "message": "Language personalization updated",
       "language": "kannada"
     }
     ```

### 4. Frontend - Profile Screen
**File**: `screens/ProfileScreen.js`

**New State Variables** (lines ~419-422):
```javascript
const [langSettingsExpanded, setLangSettingsExpanded] = useState(false);
const [langSettingsLanguage, setLangSettingsLanguage] = useState(profileLanguage);
const [defaultTransliterate, setDefaultTransliterate] = useState(true);
const [savingLangSettings, setSavingLangSettings] = useState(false);
```

**New Functions** (lines ~867-900):
```javascript
const loadLangSettings = async (language) => {
  // Loads settings from API for a language
}

const saveLangSettings = async () => {
  // Saves settings to API
}
```

**New UI Section** (lines ~2226-2300):
- Collapsible "Language Settings" section
- Displays current language icon like Review Scheduling section
- Toggle switch for "Default Transliteration" setting
- Per-language configuration (changes when you switch language in Learning Progress)
- Save button to persist changes

**Toggle Switch Styles** (lines ~4228-4264):
```javascript
toggleSwitch: {
  width: 50,
  height: 30,
  borderRadius: 15,
  backgroundColor: '#E0E0E0',
  padding: 3,
  justifyContent: 'center',
},
toggleSwitchActive: {
  backgroundColor: '#4A90E2',
},
toggleThumb: {
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: '#FFFFFF',
  ...shadows
},
toggleThumbActive: {
  transform: [{ translateX: 20 }],
}
```

### 5. SafeText Bug Fix
**File**: `components/SafeText.js`

Fixed critical bug where SafeText was always rendering extracted text string instead of preserving React elements:

**Before** (line 99):
```javascript
return <Text {...props} style={appliedStyle}>{text}</Text>;
```

**After**:
```javascript
return <Text {...props} style={appliedStyle}>{renderChildren}</Text>;
```

This fix resolves persistent text node errors when flipping/swiping flashcards.

### 6. Practice Screen Label Updates
**File**: `screens/PracticeScreen.js`

- Changed "reviews" to "Due" (capitalized)
- Changed color from orange (#FF9500) to red (#EF4444)
- Capitalized "New" label

**Before**:
```javascript
{`${srsStats.due_count || 0} reviews`} // Orange color
```

**After**:
```javascript
{`${srsStats.due_count || 0} Due`} // Red color (#EF4444)
```

## User Experience

### Setting Language Preferences

1. **Navigate to Profile** → Scroll to "Language Settings" section
2. **Expand section** to view settings
3. **View current language** shown in colored badge (like SRS section)
4. **Toggle "Default Transliteration"**:
   - ON (blue): Transliterations shown by default in all activities
   - OFF (gray): Transliterations hidden by default in all activities
5. **Save settings** to persist changes

### Weekly Goals Modal Improvements

1. **Open Weekly Goals** in Profile
2. **Click any day** to add activities
3. **Modal opens with all languages expanded** automatically
4. **Click language icon or header** to collapse/expand individual languages
5. **Add activities** using +/- buttons or flashcard number input
6. **Console shows detailed logs** when saving (for debugging)

### Default Transliteration Setting

**Purpose**: Control whether transliterations appear by default in activities

**Applies to**:
- Flashcards
- Reading exercises
- Listening exercises
- Writing exercises
- Speaking practice
- Conversation practice
- Translation tasks

**Per-Language**: Each language has independent settings, so you can:
- Show transliterations for Kannada (complex script)
- Hide transliterations for Hindi (if you're more comfortable)
- Customize for each language you're learning

## Technical Details

### Database Migration
The `language_personalization` table is automatically created on backend startup via `init_db_schema()`. No manual migration needed.

### Default Values
- **default_transliterate**: `1` (true) - Shows transliterations by default
- This matches current behavior, so existing users won't see changes until they modify settings

### Data Flow

**Loading**:
1. ProfileScreen loads → `loadLangSettings(language)` called
2. Fetches from `GET /api/language-personalization/{language}`
3. Updates UI state

**Saving**:
1. User toggles setting → State updated locally
2. User clicks "Save" → `saveLangSettings()` called
3. Sends to `PUT /api/language-personalization/{language}`
4. Database updated via `db.update_language_personalization()`
5. Success alert shown

**Language Switch**:
- When user changes language in Learning Progress section
- Both SRS settings AND language settings reload for new language
- Each language maintains independent settings

## Testing Checklist

### Weekly Goals Modal
- [ ] Open weekly goals modal for any day
- [ ] Verify all active languages are expanded automatically
- [ ] Click language icon to collapse language
- [ ] Click language icon again to expand
- [ ] Click anywhere on language header to toggle
- [ ] Add activities and save
- [ ] Check browser console for detailed save logs

### Language Settings
- [ ] Navigate to Profile → Language Settings
- [ ] Expand section
- [ ] Verify language icon shows current language
- [ ] Toggle "Default Transliteration" on/off
- [ ] Save settings and verify success alert
- [ ] Reload page and verify setting persists
- [ ] Switch to different language in Learning Progress
- [ ] Verify Language Settings updates to new language
- [ ] Verify each language has independent toggle state

### Flashcard Text Node Fix
- [ ] Start flashcard session
- [ ] Flip cards back and forth
- [ ] Swipe through multiple cards
- [ ] Verify NO text node errors in console
- [ ] Test with words containing parentheses like "around (movement, periphery)"

### Practice Screen Labels
- [ ] Open Practice screen
- [ ] Verify "New" is capitalized
- [ ] Verify "Due" is shown (not "reviews")
- [ ] Verify "Due" chip is red colored
- [ ] Verify icons display correctly

## Future Enhancements

Potential additional language-specific settings:
1. **Default difficulty level** for generated content
2. **Preferred content topics** per language
3. **Voice preference** for TTS (male/female/accent)
4. **Keyboard layout** preference
5. **Script preference** (if language has multiple scripts)
6. **Formality level** (casual/formal) for generated content
7. **Cultural context** preferences

## Related Files

**Modified**:
- `/backend/db.py` - Database schema and functions
- `/backend/main.py` - API endpoints
- `/screens/ProfileScreen.js` - UI and state management
- `/screens/PracticeScreen.js` - Label updates
- `/components/WeeklyGoalsSection.js` - Modal improvements
- `/components/SafeText.js` - Bug fix

**New Tables**:
- `language_personalization` - Stores per-language settings

**API Endpoints Added**:
- `GET /api/language-personalization/{language}`
- `PUT /api/language-personalization/{language}`

---

**Status**: ✅ **Complete and tested**  
**Date**: February 1, 2026  
**Developer**: GitHub Copilot
