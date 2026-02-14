# SRS Settings Refactor - January 28, 2026

## Overview
Complete refactor of the SRS (Spaced Repetition System) settings interface to simplify the user experience and make it user-wide rather than per-language.

## Key Changes

### 1. User-Wide Settings (Not Per-Language)
- **Before**: SRS settings were per-language with an "Apply to all languages" toggle
- **After**: Settings are now user-wide and automatically apply to all languages
- **Benefit**: Simpler UX, consistent learning experience across all languages

### 2. Simplified Custom Controls
- **Before**: Users had to manually adjust "Starting Ease Factor" and "Minimum Ease Factor" (technical values like 2.5, 1.3)
- **After**: Users adjust a single "Difficulty Level" slider (1-10 scale)
  - 1 = Easiest (most forgiving, higher ease factors)
  - 10 = Hardest (strictest, lower ease factors)
- **Benefit**: More intuitive, no need to understand technical SRS parameters

### 3. Difficulty Calculation Logic
When custom mode is selected, the difficulty slider (1-10) automatically calculates all SRS parameters:

```javascript
// Ease Factor: 3.0 (easy) → 2.0 (hard)
easeFactor = 3.0 - (customDifficulty - 1) * 0.111

// Ease Increment: 0.25 (easy) → 0.10 (hard)
easeIncrement = 0.25 - (customDifficulty - 1) * 0.0167

// New Cards/Day: 5 (easy) → 30 (hard)
newCards = 5 + (customDifficulty - 1) * 2.78

// Reviews/Day: 15 (easy) → 80 (hard)
reviews = 15 + (customDifficulty - 1) * 7.22

// Ease Decrement: 0.1 (easy) → 0.25 (hard)
easeDecrement = 0.1 + (customDifficulty - 1) * 0.0167

// Min Ease: 1.6 (easy) → 1.2 (hard)
minEase = 1.6 - (customDifficulty - 1) * 0.0444
```

### 4. "Show All Calculated Values" Feature
- **New Button**: Toggle to expand/collapse detailed view of all calculated parameters
- **Shows**:
  - Starting Ease Factor
  - Minimum Ease Factor
  - Maximum Ease Factor (always 2.50)
  - Ease Increment (on success)
  - Ease Decrement (on forget)
- **Includes**: Explanatory note about what these values mean
- **Benefit**: Transparency for power users while keeping interface simple for beginners

### 5. Custom Mode Behavior
- **When Custom is selected for Learning Load OR Lapse Penalty**: Shows difficulty slider
- **Lapse Penalty options hidden**: When custom mode is active (difficulty controls both aspects)
- **Visual feedback**: 10-segment bar graph showing difficulty level with color coding:
  - Green (1-3): Easy
  - Blue (4-7): Moderate
  - Orange (8-10): Challenging

### 6. Section Reordering
- **Before**: Languages → Weekly Goals → Weekly Overview → Learning Progress → Review Scheduling
- **After**: Languages → Learning Progress → Weekly Goals → Weekly Overview → Review Scheduling
- **Benefit**: Learning Progress calendar is now more prominent

## UI Components

### New Components Added
1. **Difficulty Slider Container**
   - Main label: "Difficulty Level"
   - Subtitle: "Adjust overall learning intensity (1 = easiest, 10 = hardest)"
   - +/- buttons to adjust (range: 1-10)
   - Visual difficulty label (Easy/Moderate/Challenging)
   - 10-segment bar graph with color coding

2. **Show All Values Button**
   - Eye icon (eye-outline/eye-off-outline)
   - "Show/Hide All Calculated Values" text
   - Chevron indicator (up/down)

3. **All Values Container** (collapsible)
   - 5 rows showing technical parameters
   - Each row: Label (left) | Value (right)
   - Explanatory note at bottom

### Components Removed
1. "Apply to all languages" toggle (no longer needed)
2. Individual ease factor controls (replaced with difficulty slider)
3. Language-specific settings note (replaced with "applies to all languages" note)

## Styles Added

```javascript
customControlSubLabel       // Subtitle text for controls
difficultyDisplayContainer  // Container for difficulty number + label
difficultyLabelText        // "Easy/Moderate/Challenging" text
difficultyScale            // Container for 10-segment bar
difficultyScaleBar         // Individual bar segment
difficultyScaleBarActive   // Active (filled) bar segment
showAllValuesButton        // Toggle button for showing all values
showAllValuesText          // Button text
allValuesContainer         // Container for detailed values
valueRow                   // Individual parameter row
valueLabel                 // Parameter name
valueText                  // Parameter value
allValuesNote              // Explanatory text
```

## Styles Removed

```javascript
srsApplyAllContainer       // "Apply to all" toggle container
srsApplyAllLeft           // Left side of toggle
srsApplyAllText           // Toggle label text
srsToggle                 // Toggle switch
srsToggleActive           // Active toggle switch
srsToggleThumb            // Toggle thumb/slider
srsToggleThumbActive      // Active thumb position
```

## Backend Integration

### Save Flow
```javascript
// 1. Calculate all metrics from current settings
const metrics = getExpectedMetrics();

// 2. Convert to backend format
const settings = {
  default_ease_factor: parseFloat(metrics.easeFactor),
  min_ease_factor: parseFloat(metrics.minEase),
  max_ease_factor: 2.5,
  ease_factor_increment: parseFloat(metrics.easeIncrement),
  ease_factor_decrement: parseFloat(metrics.easeDecrement),
};

// 3. Save to ALL languages
for (const lang of LANGUAGES.map(l => l.code)) {
  for (const [key, value] of Object.entries(settings)) {
    await fetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ key, value: value.toString(), language: lang })
    });
  }
}
```

### API Endpoints Used
- `PUT /api/settings` - Updates individual setting for a language
- Existing endpoint, no backend changes needed

## State Management

### State Variables Changed
```javascript
// REMOVED
const [applyToAllLanguages, setApplyToAllLanguages] = useState(false);
const [customEaseFactor, setCustomEaseFactor] = useState(2.5);
const [customMinEase, setCustomMinEase] = useState(1.3);

// ADDED
const [customDifficulty, setCustomDifficulty] = useState(5); // 1-10 scale
const [showAllValues, setShowAllValues] = useState(false);   // Toggle details
```

### Presets (Unchanged)
- **Learning Loads**: chill, steady, sprint, custom
- **Lapse Penalties**: gentle, strict, variable, custom
- Still available for quick selection (except when custom mode active)

## User Experience Flow

1. **Default Experience**
   - Select Learning Load preset (chill/steady/sprint)
   - Select Lapse Penalty preset (gentle/strict/variable)
   - See real-time metrics update (new words, reviews, retention)
   - Save → applies to all languages

2. **Custom Experience**
   - Select "Custom" for Learning Load or Lapse Penalty
   - Difficulty slider appears
   - Adjust 1-10 scale
   - See metrics update in real-time
   - Optionally: Click "Show All Calculated Values" to see technical details
   - Save → applies to all languages

3. **Power User Experience**
   - Use custom mode
   - Open "Show All Calculated Values"
   - See exactly what ease factors, increments, decrements are being used
   - Understand the technical implications
   - Fine-tune difficulty level based on those values

## File Changes
- **Modified**: `screens/ProfileScreen.js` (2654 lines, was 2552 lines)
- **Added**: Section reordering (Learning Progress moved up)
- **Removed**: ~40 lines of toggle code
- **Added**: ~140 lines of difficulty slider + show all values code
- **Net change**: +102 lines

## Testing Checklist
- [ ] Difficulty slider adjusts from 1-10
- [ ] Visual bar graph updates with difficulty
- [ ] Metrics update in real-time when difficulty changes
- [ ] "Show All Values" button toggles detail view
- [ ] All 5 calculated values display correctly
- [ ] Save button applies settings to all languages
- [ ] Settings persist across app restarts
- [ ] Learning Progress section appears before Weekly Goals
- [ ] Lapse Penalty section hides when custom mode active
- [ ] Custom mode works for both Learning Load and Lapse Penalty

## Migration Notes
- No database migration needed (using existing settings tables)
- Existing per-language settings will remain, new saves overwrite all languages
- Old "apply to all" toggle setting is ignored (no longer used)
