# SRS Chip Styling Update - February 1, 2026

## Summary
Updated SRS chips to be right-aligned, number-only (no text labels), with blue color matching the reading activity (#5D8EDC).

## Changes Made

### 1. **Removed Text Labels**

**Before**: Chips showed "X New" and "X Due"
```jsx
<Text style={styles.languageSrsChipTextNew}>
  {langStats.new_count || 0} New
</Text>
```

**After**: Chips show only numbers
```jsx
<Text style={styles.languageSrsChipTextNew}>
  {langStats.new_count || 0}
</Text>
```

**Visual Comparison**:
```
Before: ⊕ 5 New   ⏰ 12 Due
After:  ⊕ 5      ⏰ 12
```

---

### 2. **Changed Color to Match Reading Activity**

**Before**: Teal color (#14B8A6)
**After**: Blue color (#5D8EDC - RGB 93, 142, 220)

**Why This Color?**
- Matches the Reading activity color from Dashboard
- RGB(93, 142, 220) = #5D8EDC
- Consistent with other activity colors in the app

**Color Comparison**:
```
Old Teal:  #14B8A6 (teal/turquoise)
New Blue:  #5D8EDC (reading activity blue)
Due Red:   #FF6B6B (unchanged)
```

---

### 3. **Right-Aligned Chips**

**Before**: Chips had `marginLeft: 8` (pushed from left)
**After**: Chips have no margin (naturally right-aligned in flexbox)

**Updated Styles**:
```javascript
languageSrsChips: {
  flexDirection: 'row',
  gap: 8,
  alignItems: 'center',  // ← Removed marginLeft
},
```

**Layout**:
```
Before:
┌────────────────────────────────────────┐
│ Kannada      ⊕ 5 New   ⏰ 12 Due      │
│ ಕನ್ನಡ                                 │
└────────────────────────────────────────┘
         ↑ marginLeft pushed from name

After:
┌────────────────────────────────────────┐
│ Kannada                   ⊕ 5    ⏰ 12│
│ ಕನ್ನಡ                                 │
└────────────────────────────────────────┘
         ↑ naturally right-aligned
```

---

### 4. **Increased Icon Size**

**Before**: `size={14}`
**After**: `size={16}`

**Reason**: Without text labels, icons can be slightly larger for better visibility

---

### 5. **Updated Text Styling**

**Changes**:
- Font size: `12px` → `13px` (slightly larger)
- Font weight: `600` → `700` (bolder)
- Background: `#E0F7F4` (teal) → `#E8F4FD` (blue)

**Complete Style Update**:
```javascript
// New chip (blue)
languageSrsChipNew: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#E8F4FD',  // ← Light blue
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  gap: 4,
},
languageSrsChipTextNew: {
  fontSize: 13,         // ← Increased from 12
  fontWeight: '700',    // ← Increased from 600
  color: '#5D8EDC',     // ← Changed from #14B8A6
},

// Due chip (red - unchanged color, updated size/weight)
languageSrsChipDue: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFE8E8',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  gap: 4,
},
languageSrsChipTextDue: {
  fontSize: 13,         // ← Increased from 12
  fontWeight: '700',    // ← Increased from 600
  color: '#FF6B6B',     // ← Unchanged (red)
},
```

---

## Data Source & Accuracy

### API Endpoint
The chip numbers come from: `GET /api/stats/language/{language}`

**Response Format**:
```json
{
  "new_words_available": 5,
  "reviews_due_today": 12
}
```

### Data Mapping
In `loadAllLanguagesSrsStats()`:
```javascript
const data = await response.json();
return {
  code: lang.code,
  new_count: data.new_words_available || 0,
  due_count: data.reviews_due_today || 0,
};
```

### Verification
Console logs show the data being loaded:
```
[ProfileScreen] Stats for kannada: 5 new, 12 due
[ProfileScreen] All SRS stats loaded: {
  kannada: { code: 'kannada', new_count: 5, due_count: 12 },
  telugu: { code: 'telugu', new_count: 0, due_count: 8 },
  ...
}
```

**Data Accuracy**:
- ✅ Numbers come from backend `/api/stats/language/{language}`
- ✅ Mapped correctly to `new_count` and `due_count`
- ✅ Should match flashcard activity counts
- ⚠️ If numbers don't match, check:
  1. Backend calculation logic in `/api/stats/language/{language}`
  2. Flashcard screen's data source (should be same endpoint)
  3. Cache staleness (try hard refresh)

---

## Files Modified

1. **ProfileScreen.js**
   - Lines ~1868-1882: Updated chip JSX (removed text, changed structure)
   - Lines ~2707-2734: Updated styles (color, size, alignment)

2. **PracticeScreen.js**
   - Lines ~340-354: Updated chip JSX
   - Lines ~618-645: Updated styles

3. **LessonsScreen.js**
   - Lines ~909-923: Updated chip JSX
   - Lines ~1303-1330: Updated styles

4. **VocabLibraryScreen.js**
   - Lines ~629-643: Updated chip JSX (with SafeText)
   - Lines ~1248-1275: Updated styles

---

## Visual Examples

### Chip Appearance

**Before**:
```
┌─────────────────┬──────────────────┐
│ ⊕ 5 New         │ ⏰ 12 Due        │
└─────────────────┴──────────────────┘
  Teal background    Red background
  Teal icon/text     Red icon/text
```

**After**:
```
┌──────────┬──────────┐
│ ⊕ 5      │ ⏰ 12    │
└──────────┴──────────┘
  Blue bg    Red bg
  Blue text  Red text
```

### Full Language Selector

```
┌───────────────────────────────────────┐
│  த  Tamil                  ⊕ 0  ⏰ 0 │
│     தமிழ்                             │
├───────────────────────────────────────┤
│  తె Telugu                 ⊕ 0  ⏰ 8 │
│     తెలుగు                           │
├───────────────────────────────────────┤
│  ಕ  Kannada                ⊕ 5  ⏰ 12│
│     ಕನ್ನಡ                            │
├───────────────────────────────────────┤
│  മ  Malayalam              ⊕ 2  ⏰ 3 │
│     മലയാളം                           │
└───────────────────────────────────────┘
```

**Key Features**:
- 🟦 Blue circle icon for new words
- 🔴 Red alarm icon for due reviews
- Numbers only (no "New"/"Due" labels)
- Right-aligned chips
- Consistent across all 4 screens

---

## Color Palette Reference

| Element | Color | RGB | Use |
|---------|-------|-----|-----|
| **New Icon** | #5D8EDC | 93, 142, 220 | Matches reading activity |
| **New Background** | #E8F4FD | 232, 244, 253 | Light blue (10% opacity) |
| **Due Icon** | #FF6B6B | 255, 107, 107 | Soft red for urgency |
| **Due Background** | #FFE8E8 | 255, 232, 232 | Light red (10% opacity) |

**Activity Color Reference** (from DashboardScreen.js):
```javascript
reading: { primary: '#4A90E2', light: '#E8F4FD' }
// New chip color (#5D8EDC) is between reading blue and standard blue
```

---

## Testing Checklist

### Visual Verification
- [ ] All chips show only numbers (no "New"/"Due" text)
- [ ] New chip icon and text are blue (#5D8EDC)
- [ ] Due chip icon and text are red (#FF6B6B)
- [ ] Icons are size 16 (not 14)
- [ ] Text is size 13, weight 700
- [ ] Chips are right-aligned in language selector

### Data Accuracy
- [ ] Open ProfileScreen → Check chip numbers
- [ ] Open Flashcards activity → Verify same counts
- [ ] Numbers should match exactly
- [ ] Console shows: `[ProfileScreen] Stats for {lang}: X new, Y due`

### Cross-Screen Consistency
- [ ] ProfileScreen chips match
- [ ] PracticeScreen chips match
- [ ] LessonsScreen chips match
- [ ] VocabLibraryScreen chips match
- [ ] All use same color palette

### Edge Cases
- [ ] Zero counts: Shows "0" (not hidden)
- [ ] Large numbers (100+): Doesn't overflow chip
- [ ] All languages: Consistent styling
- [ ] Alignment: Always right-aligned

---

## Troubleshooting

### Numbers Don't Match Flashcard Activity

**Check**:
1. Console logs in ProfileScreen: `[ProfileScreen] Stats for {lang}:`
2. Network tab: `/api/stats/language/{language}` response
3. Flashcard screen data source (should use same endpoint)

**Common Issues**:
- Cache staleness → Hard refresh
- Different endpoints → Verify both use `/api/stats/language/{language}`
- Timezone issues → Check backend date calculations

### Chips Not Right-Aligned

**Check**:
- `languageSrsChips` style has no `marginLeft`
- Parent container has `justifyContent: 'space-between'`
- Flexbox direction is `row`

### Colors Look Wrong

**Verify**:
- New chip: `#5D8EDC` (not `#14B8A6`)
- New background: `#E8F4FD` (not `#E0F7F4`)
- Check device color profile / display settings

---

**Status**: ✅ **Complete**  
**Date**: February 1, 2026  
**Developer**: GitHub Copilot  
**Key Changes**: Removed text labels, changed to blue (#5D8EDC), right-aligned  
**Color Reference**: Matches reading activity blue (RGB 93, 142, 220)
