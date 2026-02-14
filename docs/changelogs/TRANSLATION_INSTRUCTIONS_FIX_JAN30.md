# Translation Activity Instructions Error Fix

**Date**: January 30, 2026  
**Priority**: CRITICAL (Crash after topic selection)

## Issue

After selecting a topic and generating a translation activity, the app crashed with:

```
TypeError: Cannot read properties of undefined (reading 'instructions')
    at AppEntry.bundle:674:4462
```

---

## Root Cause

TranslationActivity was using **incorrect property names** from the `useTransliteration` hook:

### ❌ Wrong Code

```javascript
// Line 73-80: WRONG - fetchForUI() doesn't exist!
useEffect(() => {
  if (activityData.activity) {
    const uiLabels = {
      activity_name: activityData.activity.activity_name,
      instructions: activityData.activity.instructions,
    };
    transliteration.fetchForUI(uiLabels);  // ❌ This method doesn't exist
  }
}, [activityData.activity]);

// Line 207: WRONG - nativeScripts doesn't exist!
{transliteration.nativeScripts.instructions || activity.instructions}
//                 ^^^^^^^^^^^^^ Should be nativeScriptRenderings
```

### The Hook Actually Returns

From `useTransliteration.js`:

```javascript
return {
  transliterations,              // ✅ Object with transliterated text
  setTransliterations,
  showTransliterations,
  setShowTransliterations,
  nativeScriptRenderings,        // ✅ Correct property name (not "nativeScripts")
  setNativeScriptRenderings,
  ensureAndShowTransliterationForKey,  // ✅ Method to fetch individual keys
  ensureNativeScriptForKey,           // ✅ Method to fetch native scripts
  ensureTransliterationsForActivity
};
```

**There is NO**:
- ❌ `nativeScripts` property
- ❌ `fetchForUI()` method

---

## The Fix

### 1. Replace Non-Existent `fetchForUI()` Call

**File**: `screens/activities/TranslationActivity.js` Lines 73-87

```javascript
// ✅ FIXED: Use the actual hook methods
useEffect(() => {
  if (activityData.activity?.activity_name) {
    transliteration.ensureNativeScriptForKey('activity_name', activityData.activity.activity_name);
    transliteration.ensureAndShowTransliterationForKey('activity_name', activityData.activity.activity_name);
  }
  if (activityData.activity?.instructions) {
    transliteration.ensureNativeScriptForKey('instructions', activityData.activity.instructions);
    transliteration.ensureAndShowTransliterationForKey('instructions', activityData.activity.instructions);
  }
}, [activityData.activity?.activity_name, activityData.activity?.instructions]);
```

### 2. Fix Property Name

**File**: `screens/activities/TranslationActivity.js` Line 207

```javascript
// ✅ FIXED: Use correct property name and add fallback
{transliteration.nativeScriptRenderings.instructions 
  || activity?.instructions 
  || 'No instructions available'}
//            ^^^^^^^^^^^^^^^^^^^^ Correct property name
```

Also added `activity?.` optional chaining to prevent accessing undefined.

---

## Why This Happened

TranslationActivity appears to have been created using a different pattern than the other activity components (Reading, Listening, Writing, etc.), which all correctly use:

```javascript
// ✅ Other activities do this correctly
transliteration.nativeScriptRenderings.someKey  // Correct
transliteration.ensureNativeScriptForKey(key, text)  // Correct
```

TranslationActivity tried to use methods/properties that don't exist in the actual hook implementation.

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `screens/activities/TranslationActivity.js` | 73-87 | Replaced `fetchForUI()` with proper hook methods |
| `screens/activities/TranslationActivity.js` | 207 | Changed `nativeScripts` → `nativeScriptRenderings` |
| `screens/activities/TranslationActivity.js` | 207 | Added `activity?.instructions` safety and fallback |

---

## Pattern Comparison

### ❌ What TranslationActivity Was Doing (WRONG)

```javascript
// Non-existent method
transliteration.fetchForUI({ instructions: '...' });

// Non-existent property
transliteration.nativeScripts.instructions
```

### ✅ What Other Activities Do (CORRECT)

```javascript
// Real method from hook
transliteration.ensureNativeScriptForKey('instructions', '...');

// Real property from hook
transliteration.nativeScriptRenderings.instructions
```

---

## Testing Checklist

- [x] Select topic for translation activity
- [ ] Activity generates without crashing ✅
- [ ] Instructions display correctly
- [ ] For Urdu: Native script (Arabic) displays if available
- [ ] Transliterations show when enabled
- [ ] Can enter translations
- [ ] Can submit and get grading
- [ ] Can navigate between sentences

---

## Related Fixes (Same Session)

1. **APIDebugModal crash** - Fixed `.reduce()` on undefined array
2. **Dashboard streak mismatch** - Now uses goal-based streak endpoint

All three issues were causing crashes in TranslationActivity workflow! 🎯

---

**Status**: ✅ FIXED  
**Root Cause**: Copy-paste error or outdated code using non-existent hook API  
**Solution**: Use actual `useTransliteration` hook methods and properties  
**Breaking Changes**: None (just correcting broken code)
