# ActivityScreen.js Refactoring Plan

## Current State
- **Single file**: ~11,780 lines
- **5 Activity Types**: reading, listening, writing, speaking, conversation
- **Massive complexity**: All logic, UI, and state management in one file

## Refactoring Strategy

### 1. Shared Infrastructure (`screens/activities/shared/`)
- `constants.js` - Activity colors, API URLs
- `hooks/useActivityData.js` - Data fetching and caching logic
- `hooks/useTransliteration.js` - Transliteration logic
- `hooks/useAudio.js` - Audio playback logic (for listening/speaking)
- `hooks/useDictionary.js` - Dictionary search and display
- `utils/textProcessing.js` - Text normalization, splitting, etc.
- `utils/apiHelpers.js` - API call utilities
- `components/ActivityHeader.js` - Reusable header component
- `components/Dictionary.js` - Dictionary modal/panel
- `components/ApiDebugModal.js` - API debug modal
- `components/TextRenderer.js` - Text rendering with highlighting and transliteration

### 2. Activity-Specific Components (`screens/activities/`)
- `ReadingActivity.js` - Reading comprehension with Q&A
- `ListeningActivity.js` - Audio paragraphs with playback controls
- `WritingActivity.js` - Text input with grading
- `SpeakingActivity.js` - Voice recording with feedback
- `ConversationActivity.js` - Interactive conversation flow

### 3. Main Router (`screens/ActivityScreen.js`)
- Import all activity components
- Route to appropriate component based on `activityType`
- Pass shared props and context

## Benefits
- **Maintainability**: Each activity type is self-contained
- **Testability**: Individual components can be tested in isolation
- **Performance**: Smaller bundle sizes, easier code splitting
- **Collaboration**: Multiple developers can work on different activities
- **Clarity**: Clear separation of concerns

## Implementation Steps
1. ✅ Create directory structure
2. ✅ Extract shared constants
3. Extract shared hooks (transliteration, audio, dictionary)
4. Extract text rendering utilities
5. Create shared UI components
6. Extract each activity type into its own component
7. Create main router component
8. Test each activity independently
9. Remove old ActivityScreen.js once verified

## File Structure
```
screens/
  ActivityScreen.js (new - router only, ~200 lines)
  activities/
    shared/
      constants.js
      hooks/
        useActivityData.js
        useTransliteration.js
        useAudio.js
        useDictionary.js
      utils/
        textProcessing.js
        apiHelpers.js
      components/
        ActivityHeader.js
        Dictionary.js
        ApiDebugModal.js
        TextRenderer.js
    ReadingActivity.js (~1500 lines)
    ListeningActivity.js (~1500 lines)
    WritingActivity.js (~1200 lines)
    SpeakingActivity.js (~1200 lines)
    ConversationActivity.js (~1800 lines)
```
