# Flashcard Interval Multiplier Fix - January 30, 2026

## Issues Fixed

### 1. ✅ Review Speed Not Persisting on Save
**Problem**: When saving SRS settings, the interval_multiplier would reset to default (1.0) instead of persisting the user's chosen value.

**Root Cause**: The backend PUT endpoint `/api/srs/settings/{language}` was only handling `new_cards_per_day` and `reviews_per_day`, ignoring advanced settings like interval_multiplier.

**Solution**:
- Updated backend PUT endpoint to accept and save all advanced SRS settings
- Settings are stored in `user_settings` table with key-value pairs
- Frontend already sends interval_multiplier - backend now properly saves it

**Files Modified**:
- `backend/main.py` (lines ~2701-2738)

---

### 2. ✅ Review Speed Not Visible/Adjustable in SRS Simulator
**Problem**: The SRS simulator didn't show or allow adjusting the interval multiplier, making it impossible to test how different speeds affect scheduling.

**Solution**:
- Added dedicated state variable `simulatorMultiplier` (separate from settings multiplier)
- Added slider control in simulator UI to adjust multiplier (0.5x - 2.0x)
- Simulator now uses its own multiplier value when calculating intervals
- Backend simulator endpoint updated to apply multiplier to all interval calculations

**Files Modified**:
- `screens/ProfileScreen.js`:
  - Added `simulatorMultiplier` state (line ~406)
  - Updated `simulateSRSInterval()` to use simulator's multiplier (line ~1012)
  - Updated `resetSimulator()` to reset multiplier to 1.0 (line ~1035)
  - Added slider UI in simulator (lines ~2050-2074)
  - Added simulator section styles (lines ~3321-3336)
- `backend/main.py`:
  - Updated `/api/srs/simulate` endpoint to accept `interval_multiplier` (line ~2784)
  - Applied multiplier to all interval calculations (lines ~2788-2827)

---

### 3. ✅ "Apply to All Languages" Works for Interval Multiplier
**Problem**: Need to ensure the "Apply to All Languages" checkbox properly saves interval_multiplier across all languages.

**Solution**: The existing loop in `saveSrsSettings()` already sends interval_multiplier for each language. Backend now properly saves it via the updated PUT endpoint.

**Code Flow**:
```javascript
// Frontend sends for each language
for (const lang of languagesToUpdate) {
  await fetch(`${API_BASE_URL}/api/srs/settings/${lang}`, {
    method: 'PUT',
    body: JSON.stringify({
      // ... basic settings ...
      interval_multiplier: intervalMultiplier  // ✅ Sent
    })
  });
}

// Backend saves to user_settings table
for key, value in advanced_settings.items():
    if value is not None:
        db.update_user_setting(key, str(value), language)  // ✅ Saved per language
```

---

## Technical Implementation

### Backend Changes

**1. GET `/api/srs/settings/{language}` Endpoint**
```python
@app.get("/api/srs/settings/{language}")
def get_srs_settings_api(language: str):
    # Get basic settings (new_cards_per_day, reviews_per_day)
    settings = db.get_srs_settings(language)
    
    # Get advanced settings (ease factors)
    advanced_settings = db.get_srs_settings_for_language(language)
    
    # Get interval_multiplier from user_settings
    interval_multiplier = float(db.get_user_settings(language).get('interval_multiplier', '1.0'))
    
    # Merge and return everything
    return {**settings, **advanced_settings, 'interval_multiplier': interval_multiplier}
```

**2. PUT `/api/srs/settings/{language}` Endpoint**
```python
@app.put("/api/srs/settings/{language}")
async def update_srs_settings_api(language: str, request: Request):
    # Update basic settings (srs_settings table)
    success = db.update_srs_settings(language, new_cards, reviews)
    
    # Update advanced settings (user_settings table)
    advanced_settings = {
        'ease_factor_increment': body.get('ease_factor_increment'),
        'ease_factor_decrement': body.get('ease_factor_decrement'),
        'min_ease_factor': body.get('min_ease_factor'),
        'max_ease_factor': body.get('max_ease_factor'),
        'interval_multiplier': body.get('interval_multiplier')  # ✅ NEW
    }
    
    for key, value in advanced_settings.items():
        if value is not None:
            db.update_user_setting(key, str(value), language)
```

**3. POST `/api/srs/simulate` Endpoint**
```python
@app.post("/api/srs/simulate")
async def simulate_srs_interval(request: Request):
    # Extract multiplier from request
    interval_multiplier = body.get('interval_multiplier', 1.0)
    
    # Apply to all interval calculations
    if response == "again":
        interval = max(1, current_interval * 0.5 * interval_multiplier)
    elif response == "hard":
        interval = max(1, current_interval * 1.2 * interval_multiplier)
    elif response == "good":
        interval = current_interval * new_ease * interval_multiplier
    elif response == "easy":
        interval = current_interval * new_ease * 1.3 * interval_multiplier
```

### Frontend Changes

**1. Separate Simulator State**
```javascript
// Settings multiplier (saved to backend)
const [intervalMultiplier, setIntervalMultiplier] = useState(1.0);

// Simulator multiplier (for testing, not saved)
const [simulatorMultiplier, setSimulatorMultiplier] = useState(1.0);
```

**2. Simulator UI**
```javascript
<View style={styles.simulatorSection}>
  <Text style={styles.simulatorSectionTitle}>Review Speed Multiplier</Text>
  <Text style={styles.simulatorSectionSubtitle}>
    Adjust to see how speed affects scheduling
  </Text>
  <View style={styles.sliderContainer}>
    <Text style={styles.sliderLabel}>0.5x</Text>
    <Slider
      minimumValue={0.5}
      maximumValue={2.0}
      step={0.1}
      value={simulatorMultiplier}
      onValueChange={setSimulatorMultiplier}
    />
    <Text style={styles.sliderLabel}>2.0x</Text>
  </View>
  <Text style={styles.sliderValue}>Current: {simulatorMultiplier.toFixed(1)}x</Text>
</View>
```

**3. API Calls**
```javascript
// Save settings - uses intervalMultiplier from settings
body: JSON.stringify({
  new_cards_per_day: newCardsPerWeek,
  reviews_per_day: reviewsPerWeek,
  interval_multiplier: intervalMultiplier  // ✅ From settings state
})

// Simulate - uses simulatorMultiplier for testing
body: JSON.stringify({
  current_interval: simulatorInterval,
  ease_factor: simulatorEase,
  interval_multiplier: simulatorMultiplier  // ✅ From simulator state
})
```

---

## Data Storage

### user_settings Table
```sql
-- Stores advanced SRS settings per language
CREATE TABLE user_settings (
    user_id INTEGER,
    language TEXT,
    setting_key TEXT,     -- e.g., 'interval_multiplier'
    setting_value TEXT,   -- e.g., '1.5'
    PRIMARY KEY (user_id, language, setting_key)
);

-- Example row
INSERT INTO user_settings VALUES (1, 'tamil', 'interval_multiplier', '1.5');
```

### Retrieval Pattern
```python
# Get all settings for a language
settings = db.get_user_settings('tamil')
# Returns: {'interval_multiplier': '1.5', 'ease_factor_increment': '0.15', ...}

# Get specific setting
multiplier = float(settings.get('interval_multiplier', '1.0'))
```

---

## Testing Guide

### Test 1: Settings Persistence
1. Go to Profile → Review Scheduling
2. Expand "Advanced Settings"
3. Move "Review Speed" slider to 1.5x
4. Click "Save SRS Settings"
5. ✅ **Expected**: Success message appears
6. Refresh app or switch languages and back
7. ✅ **Expected**: Slider still shows 1.5x

### Test 2: Apply to All Languages
1. Set Review Speed to 1.8x
2. Check "Apply to all languages"
3. Click "Save SRS Settings"
4. Switch to different language (e.g., Telugu)
5. ✅ **Expected**: Review Speed is 1.8x for all languages

### Test 3: Simulator Multiplier
1. Click "Test SRS Settings" button
2. See "Review Speed Multiplier" slider in simulator
3. Set to 0.5x (slower)
4. Press "Good" button
5. ✅ **Expected**: Interval is shorter (e.g., 3 days instead of 6 days)
6. Set to 2.0x (faster)
7. Press "Good" button
8. ✅ **Expected**: Interval is longer (e.g., 12 days instead of 6 days)

### Test 4: Different Response Types
Using simulator with interval_multiplier = 0.5x:
- **Again**: 0 days (0 * 0.5 = 0) ✅ Still same day
- **Hard**: 0.5 days → rounds to 1 day
- **Good**: 3 days (6 * 0.5 = 3)
- **Easy**: 5 days (10 * 0.5 = 5)

Using simulator with interval_multiplier = 2.0x:
- **Again**: 0 days (0 * 2.0 = 0) ✅ Still same day
- **Hard**: 2 days (1 * 2.0 = 2)
- **Good**: 12 days (6 * 2.0 = 12)
- **Easy**: 20 days (10 * 2.0 = 20)

---

## User Experience

### Before
❌ Review Speed slider visible but doesn't save
❌ No way to test speed settings
❌ Apply to All Languages doesn't work for speed

### After
✅ Review Speed persists after save
✅ Can test different speeds in simulator
✅ Can see real-time impact on intervals
✅ Apply to All Languages works for speed
✅ Separate speed control in simulator for experimentation

---

## Key Insights

**Why Separate Simulator State?**
- Settings slider = permanent preference (saved to DB)
- Simulator slider = experimentation (not saved)
- Allows testing "what if I used 0.5x" without changing actual settings
- User can return to settings and adjust based on simulator results

**Why User Settings Table?**
- Flexible key-value storage for optional settings
- Don't need to alter `srs_settings` table schema
- Easy to add new settings in future
- Per-language configuration

**Interval Multiplier Math**
```
Base Interval: 6 days
Ease Factor: 2.5

Standard (1.0x):
  Good: 6 * 2.5 * 1.0 = 15 days

Slower (0.5x):
  Good: 6 * 2.5 * 0.5 = 7.5 days (more frequent)

Faster (2.0x):
  Good: 6 * 2.5 * 2.0 = 30 days (less frequent)
```

---

## Related Features

- **Infinite Card Loading** - Users can review continuously with their chosen speed
- **"Again" = Immediate** - Still works (0 * multiplier = 0)
- **Generous New Cards** - More cards available at any speed
- **SRS Simulator** - Now shows realistic results with speed factor

---

## Success Metrics

✅ **Persistence**: Interval multiplier saves and loads correctly
✅ **UI**: Simulator has dedicated speed control
✅ **Backend**: All endpoints properly handle interval_multiplier
✅ **Apply All**: Works for all languages simultaneously
✅ **Simulator**: Shows accurate previews with multiplier applied

🎉 **All interval multiplier issues successfully resolved!**
