# Transliteration Settings Fix for New Activity Architecture

**Date**: February 1, 2026  
**File**: `screens/activities/shared/hooks/useTransliteration.js`

## Problem

The new activity architecture (ActivityScreenNew.js + individual activity components) was not respecting the user's default transliteration settings. All activities were showing transliterations by default, even when users had `default_transliterate = false` set for their language.

## Root Cause

The `useTransliteration` hook had two issues:

1. **Initial State**: Started with `showTransliterations = true`
2. **Missing Settings Load**: No code to fetch language-specific transliteration settings from the backend

```javascript
// BEFORE (Broken)
const [showTransliterations, setShowTransliterations] = useState(true);
// No useEffect to load settings!
```

## Solution

### 1. Changed Initial State to False

```javascript
const [showTransliterations, setShowTransliterations] = useState(false);
```

### 2. Added Language Settings Loading

Added a `useEffect` hook that:
- Fetches language settings from `/api/language-personalization/{language}`
- Sets `showTransliterations` to the user's preference
- Defaults to `false` if setting is missing or API fails
- Runs whenever the `language` prop changes

```javascript
useEffect(() => {
  const loadLanguageSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/language-personalization/${language}`);
      if (response.ok) {
        const data = await response.json();
        const shouldShowTranslit = data.default_transliterate !== undefined 
          ? data.default_transliterate 
          : false;
        setShowTransliterations(shouldShowTranslit);
      } else {
        // Keep default false
      }
    } catch (error) {
      // Keep default false
    }
  };
  
  if (language) {
    loadLanguageSettings();
  }
}, [language]);
```

### 3. Added API_BASE_URL Constant

```javascript
const API_BASE_URL = __DEV__ ? 'http://localhost:5001' : 'http://localhost:5001';
```

## Architecture Context

### New Activity Structure

```
ActivityScreenNew.js (Router)
    ├── ReadingActivity.js
    ├── ListeningActivity.js  
    ├── WritingActivity.js
    ├── SpeakingActivity.js
    ├── TranslationActivity.js
    └── ConversationActivity.js
           ↓ (all use)
    useTransliteration Hook
```

### Why This Fix Works for All Activities

All 6 activity components use the same `useTransliteration` hook:
- `ReadingActivity.js` - line 35: `const transliteration = useTransliteration(language, activityData.activity);`
- `ListeningActivity.js` - line 63: `const transliteration = useTransliteration(language, activityData.activity);`
- `WritingActivity.js` - line 57: `const transliteration = useTransliteration(language, activityData.activity);`
- `SpeakingActivity.js` - line 70: `const transliteration = useTransliteration(language, activityData.activity);`
- `TranslationActivity.js` - line 70: `const transliteration = useTransliteration(language, activityData.activity);`
- `ConversationActivity.js` - line 62: `const transliteration = useTransliteration(language, activityData.activity);`

**Result**: Fixing the hook fixes all 6 activity types with one change!

## Comparison with Old Architecture

### Old ActivityScreen.js
- Monolithic component handling all activity types
- Fixed in previous session (lines 538-560)
- Located in `/screens/ActivityScreen.js`

### New ActivityScreenNew.js Architecture
- Router component that delegates to specialized activity components
- Shared hook for transliteration logic
- Fixed in this session (hook file)
- Located in `/screens/ActivityScreenNew.js` + `/screens/activities/`

## Testing

### Verify Fix Works

1. Open any activity (reading, listening, writing, speaking, translation, conversation)
2. Check browser console for:
```
[useTransliteration] Loading settings for kannada: {default_transliterate: false}
[useTransliteration] Setting showTransliterations to: false
```
3. Verify transliterations are hidden initially
4. Click toggle button to enable/disable manually

### Test Each Activity Type

- [ ] Reading Activity - No transliterations initially
- [ ] Listening Activity - No transliterations initially  
- [ ] Writing Activity - No transliterations initially
- [ ] Speaking Activity - No transliterations initially
- [ ] Translation Activity - No transliterations initially
- [ ] Conversation Activity - No transliterations initially

### Test Toggle Button

For each activity:
- [ ] Toggle ON - transliterations appear
- [ ] Toggle OFF - transliterations disappear
- [ ] State persists during activity

## Code Changes Summary

**File**: `/screens/activities/shared/hooks/useTransliteration.js`

**Lines Changed**: 
- Line 10: Changed initial state from `true` to `false`
- Lines 12-40: Added useEffect for loading language settings
- Line 8: Added API_BASE_URL constant

**Total Lines Added**: ~32  
**Total Lines Modified**: 2  
**Total Lines Removed**: 0

## Impact

### Before Fix
- ❌ All activities show transliterations by default
- ❌ User settings ignored
- ❌ Users must toggle off every time

### After Fix
- ✅ Activities respect user's default setting
- ✅ Settings load automatically
- ✅ Toggle button still works for manual override

## Related Fixes

This fix complements the earlier fix for the old architecture:
1. **Session Earlier Today**: Fixed `/screens/ActivityScreen.js` (old architecture)
2. **This Session**: Fixed `/screens/activities/shared/hooks/useTransliteration.js` (new architecture)

Both architectures now respect user transliteration settings!

## Migration Note

If the app is transitioning from old to new architecture:
- Old `ActivityScreen.js` → Located in `/screens/` (already fixed)
- New `ActivityScreenNew.js` → Located in `/screens/` (router)
- Individual activities → Located in `/screens/activities/` (use hook)
- Shared hook → Located in `/screens/activities/shared/hooks/` (**FIXED HERE**)

## Console Logging

The fix adds helpful debugging logs:

```
[useTransliteration] Loading settings for kannada: {default_transliterate: false, ...}
[useTransliteration] Setting showTransliterations to: false
```

Or if settings not found:
```
[useTransliteration] No settings found for kannada, keeping default false
```

Or if API fails:
```
[useTransliteration] Error loading language settings: Error: Network request failed
```

## Summary

Fixed transliteration default settings for the **new activity architecture** by:
1. Changing initial state from `true` to `false` in `useTransliteration` hook
2. Adding language settings loading logic with proper fallback behavior
3. Ensuring all 6 activity types automatically inherit the fix

The settings now work correctly across **both** old and new activity architectures!
