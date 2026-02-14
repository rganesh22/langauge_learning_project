# Transliteration Settings Verification Guide

**Date**: February 1, 2026  
**Issue**: Verifying transliteration default settings work across all activity types

## Testing Steps

### 1. Verify Settings are Saved
```bash
# Check the database has the correct setting
sqlite3 backend/language_learning.db
SELECT language, default_transliterate FROM language_personalization WHERE user_id = 1;
```

Expected output for Kannada:
```
kannada|0
```
(0 = false, 1 = true)

### 2. Open DevTools Console

Before testing, open browser DevTools Console to see logging messages.

### 3. Test Each Activity Type

#### A. Reading Activity
1. Go to Practice → Select language (Kannada) → Start Reading activity
2. Check console for:
```
[ActivityScreen] Loading settings for kannada: {default_transliterate: false}
[ActivityScreen] Setting showTransliterations to: false
```
3. Verify:
   - Transliteration pane is **hidden**
   - Toggle button shows **outline** icon (not filled)
   - No transliteration text appears below paragraphs

#### B. Listening Activity
1. Go to Practice → Select language (Kannada) → Start Listening activity
2. Check same console messages
3. Verify same transliteration behavior

#### C. Writing Activity
1. Go to Practice → Select language (Kannada) → Start Writing activity
2. Check same console messages
3. Verify prompt shows no transliteration initially

#### D. Speaking Activity
1. Go to Practice → Select language (Kannada) → Start Speaking activity
2. Check same console messages
3. Verify prompt shows no transliteration initially

#### E. Translation Activity
1. Go to Practice → Select language (Kannada) → Start Translation activity
2. Check same console messages
3. Verify questions show no transliteration initially

#### F. Flashcards Activity
1. Go to Practice → Select language (Kannada) → Start Flashcards
2. Check console for:
```
[FlashcardScreen] Loading settings for kannada: {default_transliterate: false}
[FlashcardScreen] Setting showTransliterations to: false
```
3. Verify cards show no transliteration initially

### 4. Test Toggle Button

For each activity type:
1. Click the transliteration toggle button (top right, "A" icon)
2. Verify transliterations appear
3. Click again to toggle off
4. Verify transliterations disappear

### 5. Test with Setting = True

Change setting to true:
1. Go to Profile → Language Settings → Kannada
2. Toggle "Default Transliteration" to ON
3. Save settings
4. Repeat all activity tests
5. Verify transliterations **do** appear initially

## Common Issues

### Issue: Transliterations show even when setting is false

**Possible Causes:**
1. Settings not saved in database
2. Language mismatch (checking wrong language)
3. API endpoint returning wrong data
4. Race condition (transliterations fetched before settings load)
5. Rendering logic not checking `showTransliterations` flag

**Debug Steps:**
1. Check database has correct setting
2. Check console logs for "Loading settings for {language}"
3. Check console logs for "Setting showTransliterations to: false"
4. Check if toggle button visual state matches expected state
5. Check if transliterations appear in DOM (inspect element)

### Issue: Settings work for flashcards but not other activities

**Possible Causes:**
1. ActivityScreen and FlashcardScreen have different loading logic
2. ActivityScreen has additional code that overrides settings
3. Different timing/race conditions

**Debug Steps:**
1. Compare loading logic in both screens
2. Check for `setShowTransliterations(true)` calls after settings load
3. Check if activity type affects loading behavior

### Issue: Transliterations flash briefly then disappear

**Cause:** Initial state issue (already fixed in previous session)

**Verification:**
```javascript
// In ActivityScreen.js and FlashcardScreen.js
const [showTransliterations, setShowTransliterations] = useState(false);
// Should be false, not true
```

## Code Review Checklist

### ActivityScreen.js
- [ ] Initial state: `useState(false)` ✅
- [ ] Loading logic: Defaults to `false` on missing setting ✅
- [ ] Loading logic: Doesn't force `true` on API failure ✅
- [ ] useEffect dependency: `[language]` ✅
- [ ] Rendering: Checks `showTransliterations` before displaying ✅

### FlashcardScreen.js
- [ ] Initial state: `useState(false)` ✅
- [ ] Loading logic: Defaults to `false` on missing setting ✅
- [ ] Loading logic: Doesn't force `true` on API failure ✅
- [ ] useEffect dependency: `[language]` ✅
- [ ] Rendering: Checks `showTransliterations` before displaying ✅

## API Endpoint Verification

Test the API endpoint directly:

```bash
# For Kannada
curl http://localhost:5001/api/language-personalization/kannada

# Expected response
{
  "language": "kannada",
  "default_transliterate": false,
  ...
}
```

If this returns 404 or error, the settings aren't saved.

## Browser Cache Issues

If changes don't appear:
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Clear React Native cache: `npx expo start --clear`
3. Restart backend server
4. Clear browser DevTools cache

## Summary

The fix changes the **fallback behavior** when loading settings:
- **Before**: Defaults to `true` on error → Always shows transliterations
- **After**: Keeps initial `false` on error → Respects user preference

This should work for ALL activity types since they all use the same ActivityScreen component and loading logic.

If transliterations still appear:
1. Check console logs to see if settings are loading
2. Verify database has correct value
3. Check if there's a race condition where activities load before settings
4. Inspect DOM to see if transliterations are in the HTML but hidden via CSS
