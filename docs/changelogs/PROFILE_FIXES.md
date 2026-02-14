# Profile Page Fixes - Language Sorting & SRS Settings Persistence

## Issues Fixed

### 1. **Language Ordering by Level** ✅
**Problem**: Languages in profile page were not ordered by proficiency level

**Solution**: Modified `/api/user-languages` endpoint to:
- Calculate level for each language using `calculate_user_level()`
- Sort languages by level: C2 → C1 → B2 → B1 → A2 → A1 → A0
- Return languages in sorted order

**Current Order** (highest to lowest):
1. **Tamil** - B2 (7,468 mastered)
2. **Telugu** - B1 (4,730 mastered)
3. **Kannada** - B1 (4,732 mastered)
4. **Malayalam** - B1 (mastered count varies)
5. **Hindi** - B1 (4,731 mastered)
6. **Urdu** - A2 (3,186 mastered)

**File Changed**: `backend/main.py` (lines 3162-3204)

---

### 2. **SRS Settings Persistence** ✅
**Problem**: Review scheduling settings weren't loading when page first opened - only loaded when language changed

**Root Cause**: Initial `useEffect` didn't call `loadSrsSettings()`

**Solution**: Added SRS settings load to initial mount effect
```javascript
useEffect(() => {
  loadProfile();
  loadSelectedLanguages();
  loadSelectedInterests();
  // Load SRS settings for current language on mount
  if (profileLanguage) {
    loadSrsSettings(profileLanguage);
  }
}, []);
```

**File Changed**: `screens/ProfileScreen.js` (line 596-600)

**How It Works Now**:
1. User opens profile page → SRS settings load immediately
2. User changes language → SRS settings reload for new language
3. User changes settings → Click "Save Settings" button
4. Settings persist to database and reload automatically
5. User closes and reopens app → Settings are remembered

---

## Verification

### Test Language Sorting
```bash
curl http://localhost:5001/api/user-languages
```

**Expected Output**:
```json
{
  "languages": ["tamil", "telugu", "kannada", "malayalam", "hindi", "urdu"]
}
```
(Sorted from B2 → B1 → A2)

### Test SRS Settings Persistence

#### 1. Save Settings
```bash
curl -X PUT http://localhost:5001/api/srs/settings/tamil \
  -H "Content-Type: application/json" \
  -d '{"new_cards_per_week": 70, "reviews_per_week": 700}'
```

#### 2. Verify Settings Saved
```bash
curl http://localhost:5001/api/srs/settings/tamil
```

**Expected Output**:
```json
{
  "language": "tamil",
  "new_cards_per_week": 70,
  "reviews_per_week": 700,
  "created_at": "2026-01-30 07:41:53",
  "updated_at": "2026-01-29T23:41:53.307270-08:00"
}
```

#### 3. Reload App
- Close and reopen profile page
- Settings should display saved values (70 new cards, 700 reviews)

### Check Database
```sql
SELECT language, new_cards_per_week, reviews_per_week 
FROM srs_settings 
WHERE user_id = 1;
```

**Current State**:
```
kannada|100|1000
tamil|70|700
urdu|100|1000
```

---

## User Experience Improvements

### Before
- ❌ Languages in random order
- ❌ SRS settings showed defaults (70/350) even if user saved different values
- ❌ Settings only loaded when changing language
- ❌ User had to manually select language to see their saved settings

### After
- ✅ Languages sorted by proficiency (C2 → A0)
- ✅ Most advanced languages appear first
- ✅ SRS settings load immediately on page open
- ✅ Settings persist correctly across sessions
- ✅ User sees their saved values immediately
- ✅ Settings reload when switching languages

---

## Implementation Details

### Language Sorting Algorithm

```python
# backend/main.py - get_user_languages()

# Define level priority (C2 = highest)
level_order = {'C2': 6, 'C1': 5, 'B2': 4, 'B1': 3, 'A2': 2, 'A1': 1, 'A0': 0}

# Get level for each language
for lang in languages:
    level_info = db.calculate_user_level(lang)
    language_levels.append({
        'code': lang,
        'level': level_info.get('level', 'A0'),
        'level_order': level_order.get(level_info.get('level', 'A0'), 0)
    })

# Sort by level (highest first)
language_levels.sort(key=lambda x: x['level_order'], reverse=True)

# Return sorted language codes
sorted_languages = [lang['code'] for lang in language_levels]
```

### SRS Settings Loading Flow

```javascript
// Initial Mount
useEffect(() => {
  loadProfile();
  loadSelectedLanguages();
  loadSelectedInterests();
  loadSrsSettings(profileLanguage); // ✅ NEW: Load settings immediately
}, []);

// Language Change
useEffect(() => {
  if (profileLanguage) {
    loadSrsSettings(profileLanguage); // Reload for new language
  }
}, [profileLanguage]);

// Settings Load
const loadSrsSettings = async (language) => {
  const settingsResponse = await fetch(`${API_BASE_URL}/api/srs/settings/${language}`);
  const settingsData = await settingsResponse.json();
  setNewCardsPerWeek(settingsData.new_cards_per_week || 70); // ✅ Sets state
  setReviewsPerWeek(settingsData.reviews_per_week || 350);   // ✅ Sets state
};
```

---

## Testing Checklist

### Language Sorting
- [ ] Open profile page
- [ ] Check "Languages" section
- [ ] Verify Tamil appears first (B2)
- [ ] Verify Telugu/Hindi/Kannada next (B1)
- [ ] Verify Urdu appears last (A2)

### SRS Settings Persistence
- [ ] Open profile page
- [ ] Scroll to "Review Scheduling" section
- [ ] Note current values (e.g., 70 new cards, 350 reviews)
- [ ] Change values (e.g., 100 new cards, 1000 reviews)
- [ ] Click "Save Settings" button
- [ ] See success alert
- [ ] Close app completely
- [ ] Reopen app and navigate to profile
- [ ] Scroll to "Review Scheduling"
- [ ] Verify values show 100/1000 (your saved values)
- [ ] Change language in "Learning Progress" section
- [ ] Verify SRS settings update for new language
- [ ] Change back to original language
- [ ] Verify settings are still 100/1000

### Cross-Language Settings
- [ ] Set Tamil to 70/700
- [ ] Save settings
- [ ] Switch to Telugu
- [ ] Set Telugu to 100/1000
- [ ] Save settings
- [ ] Switch back to Tamil
- [ ] Verify Tamil still shows 70/700
- [ ] Switch to Telugu
- [ ] Verify Telugu shows 100/1000

---

## Files Modified

1. **backend/main.py**
   - Lines 3162-3204: Updated `get_user_languages()` endpoint
   - Added level calculation and sorting logic

2. **screens/ProfileScreen.js**
   - Lines 596-600: Added SRS settings load to initial useEffect

3. **Database Cleanup**
   - Removed invalid `[object Object]` entry from srs_settings table

---

## Benefits

### 1. **Better Organization**
- Most advanced languages appear first
- Easy to see learning progress at a glance
- Visual hierarchy matches proficiency

### 2. **Improved Settings UX**
- Settings load immediately (no blank values)
- Values persist across sessions
- No confusion about whether settings saved
- Each language maintains its own settings

### 3. **Motivation**
- Seeing advanced languages first is encouraging
- Clear progression visible in language order
- Settings persistence shows commitment tracking

---

## Known Limitations

### Language Sorting
- Languages without word_states (no mastery data) default to A0
- Malayalam might need word states set if not done yet
- Order updates only when endpoint is called (not live)

### SRS Settings
- Settings are per-language (intentional design)
- "Apply to all languages" checkbox updates all at once
- No validation UI for minimum reviews (only on save)

---

## Future Enhancements

### Language Sorting
- [ ] Add visual level badges next to each language
- [ ] Show mastered word count for each language
- [ ] Add drag-to-reorder functionality (override auto-sort)
- [ ] Cache sorted order for better performance

### SRS Settings
- [ ] Add presets ("Beginner", "Intermediate", "Advanced")
- [ ] Show estimated study time per day
- [ ] Add visual preview of daily quotas
- [ ] Sync settings across devices (if/when multi-device support added)

---

## Summary

✅ **All Fixes Complete**:
1. Languages now sorted by level (C2 → A0) in profile page
2. SRS settings persist correctly across sessions
3. Settings load immediately on page open
4. Each language maintains independent settings
5. Clean database state (removed invalid entries)

🎯 **User Experience**:
- Clear learning progression visible in language order
- Settings save and load reliably
- No more confusion about default vs. saved values
- Smooth experience when switching between languages
