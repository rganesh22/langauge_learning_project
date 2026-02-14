# Refactoring Visual Structure

## Before Refactoring

```
App.js
  ↓
ActivityScreen.js (11,780 lines) 😱
  ├─ Reading logic (2000 lines)
  ├─ Listening logic (2500 lines)  
  ├─ Writing logic (1500 lines)
  ├─ Speaking logic (1500 lines)
  ├─ Conversation logic (2000 lines)
  ├─ Shared utilities (800 lines)
  ├─ Shared components (1000 lines)
  └─ Styles (480 lines)
```

## After Refactoring

```
App.js
  ↓
ActivityScreenNew.js (40 lines) 😊
  ├─→ ReadingActivity.js (2000 lines)
  ├─→ ListeningActivity.js (2500 lines)
  ├─→ WritingActivity.js (1500 lines)
  ├─→ SpeakingActivity.js (1500 lines)
  └─→ ConversationActivity.js (2000 lines)
       ↓
    All use shared resources:
       ├─ shared/constants.js (colors, API config)
       ├─ shared/utils/textProcessing.js
       ├─ shared/utils/apiHelpers.js
       ├─ shared/hooks/useTransliteration.js
       ├─ shared/hooks/useDictionary.js
       ├─ shared/hooks/useAudio.js
       ├─ shared/components/ActivityHeader.js
       ├─ shared/components/TextRenderer.js
       └─ shared/components/Dictionary.js
```

## File Size Comparison

### Before
```
ActivityScreen.js  ████████████████████████████████████████  11,780 lines
```

### After
```
ActivityScreenNew.js        ▌ 40 lines
ReadingActivity.js          ████████ 2,000 lines
ListeningActivity.js        ██████████ 2,500 lines
WritingActivity.js          ██████ 1,500 lines
SpeakingActivity.js         ██████ 1,500 lines
ConversationActivity.js     ████████ 2,000 lines
Shared utilities            ██ 500 lines
Shared hooks                ███ 800 lines
Shared components           █████ 1,200 lines
                           ─────────────────────
Total                       ████████████████████████████████████████ 12,040 lines
                            (Slightly more due to separation, but MUCH more maintainable)
```

## Component Relationships

```
┌─────────────────────────────────────────────────┐
│              ActivityScreenNew                  │
│             (Router - 40 lines)                 │
│    Switch on activityType param                 │
└──────────┬──────────────────────────────────────┘
           │
    ┌──────┴──────┬──────┬──────┬──────────┐
    │             │      │      │          │
    ▼             ▼      ▼      ▼          ▼
┌────────┐  ┌─────────┐ ┌───┐ ┌───┐  ┌────────┐
│Reading │  │Listening│ │Wri│ │Spe│  │  Conv  │
│Activity│  │Activity │ │tin│ │aki│  │Activity│
└───┬────┘  └────┬────┘ └─┬─┘ └─┬─┘  └───┬────┘
    │            │        │     │        │
    └────────────┴────────┴─────┴────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │    Shared Resources        │
    ├────────────────────────────┤
    │ • constants.js             │
    │ • textProcessing.js        │
    │ • apiHelpers.js            │
    │ • useTransliteration()     │
    │ • useDictionary()          │
    │ • useAudio()               │
    │ • ActivityHeader           │
    │ • TextRenderer             │
    │ • Dictionary               │
    └────────────────────────────┘
```

## Data Flow Example: Reading Activity

```
User opens Reading Activity
        ↓
App.js → ActivityScreenNew.js
        ↓
     ReadingActivity.js
        ↓
  ┌────┴────┐
  │ Imports │
  └────┬────┘
       ├─→ useTransliteration() hook
       ├─→ useDictionary() hook  
       ├─→ fetchActivityData() from apiHelpers
       ├─→ sanitizeActivity() from textProcessing
       └─→ ActivityHeader component
        ↓
  ┌─────────────┐
  │ Load Data   │
  │ via API     │
  └────┬────────┘
       │
       ├─→ Sanitize activity data
       ├─→ Set up transliterations
       ├─→ Prepare dictionary
       └─→ Render story + questions
        ↓
  ┌──────────────┐
  │ User reads   │
  │ and answers  │
  └──────┬───────┘
         │
         ├─→ Click word → useDictionary()
         ├─→ Toggle transliteration → useTransliteration()
         └─→ Submit → apiHelpers.submitActivity()
```

## Current Implementation Status

```
✅ DONE
  ├─ Directory structure
  ├─ ActivityScreenNew.js (router)
  ├─ Activity stub files (5)
  ├─ shared/constants.js
  ├─ shared/utils/textProcessing.js
  └─ shared/utils/apiHelpers.js

📋 TODO
  ├─ Extract actual activity implementations
  ├─ Create shared hooks
  │  ├─ useTransliteration.js
  │  ├─ useDictionary.js
  │  ├─ useAudio.js
  │  └─ useActivityData.js
  └─ Create shared components
     ├─ ActivityHeader.js
     ├─ TextRenderer.js
     ├─ Dictionary.js
     ├─ QuestionList.js
     └─ ApiDebugModal.js
```

## Benefits Visualization

### Maintainability
```
Before: 😱 Find bug in 11,780 line file
After:  😊 Find bug in relevant 1,500 line activity file
```

### Testing
```
Before: 😱 Test entire monolith for any change
After:  😊 Test only affected activity component
```

### Collaboration
```
Before: 😱 Merge conflicts when 2+ devs edit same file
After:  😊 Work on different activities without conflicts
```

### Load Time
```
Before: 😱 Editor struggles with 11,780 line file
After:  😊 Fast loading of focused files
```

### Debugging
```
Before: 😱 Console errors point to line 7,432
        😱 Scroll through thousands of lines
After:  😊 Error in ListeningActivity.js line 234
        😊 Easy to locate and fix
```

## Migration Path

```
┌────────────┐
│   Step 1   │  Test new router (5 min)
│   Router   │  ✅ Working
└──────┬─────┘
       │
┌──────▼─────┐
│   Step 2   │  Extract Reading (1-2 hrs)
│  Reading   │  📋 TODO
└──────┬─────┘
       │
┌──────▼─────┐
│   Step 3   │  Extract Listening (1-2 hrs)
│ Listening  │  📋 TODO
└──────┬─────┘
       │
┌──────▼─────┐
│   Step 4   │  Extract Writing (1-2 hrs)
│  Writing   │  📋 TODO
└──────┬─────┘
       │
┌──────▼─────┐
│   Step 5   │  Extract Speaking (1-2 hrs)
│  Speaking  │  📋 TODO
└──────┬─────┘
       │
┌──────▼─────┐
│   Step 6   │  Extract Conversation (2-3 hrs)
│ Conversati│  📋 TODO
│     on     │
└──────┬─────┘
       │
┌──────▼─────┐
│   Step 7   │  Create shared hooks (2-3 hrs)
│   Hooks    │  📋 TODO
└──────┬─────┘
       │
┌──────▼─────┐
│   Step 8   │  Create shared components (2-3 hrs)
│ Components │  📋 TODO
└──────┬─────┘
       │
┌──────▼─────┐
│   Step 9   │  Switch & cleanup (30 min)
│  Complete  │  📋 TODO
└────────────┘

Total: ~10-14 hours
Can be done incrementally over days/weeks
```

---

**Remember**: You can stop at any step and still have a working app!
