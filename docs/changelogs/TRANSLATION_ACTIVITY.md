# Translation Activity Feature

## Overview
Added a new Translation activity that allows users to practice translating sentences from other languages they are learning into their target language. The activity intelligently selects source languages and sentence difficulty based on the user's proficiency levels.

## Implementation Details

### Frontend Components

#### TranslationActivity.js
**Location**: `screens/activities/TranslationActivity.js`

**Key Features**:
1. **Sentence-by-Sentence Translation**: Users translate 15-30 sentences one at a time
2. **Progress Tracking**: Visual progress bar showing completed translations
3. **Navigation**: Previous/Next buttons to move between sentences
4. **Overview Panel**: Shows all sentences with completion status
5. **Multi-Language Support**: Displays source sentences with proper fonts and transliteration
6. **Grading System**: AI-powered grading with detailed feedback per sentence
7. **Results Display**: Shows overall scores and sentence-specific analysis

**User Flow**:
1. Activity generates 15-30 sentences from languages the user is learning
2. User translates each sentence via text input
3. Can navigate freely between sentences
4. Submits all translations for grading
5. Receives detailed feedback on accuracy, grammar, naturalness
6. Can review sentence-by-sentence analysis
7. Completes activity and logs score

### Activity Colors
- **Primary Color**: `#8B5CF6` (Purple)
- **Light Color**: `#F3E8FF` (Light Purple)

### Backend Implementation

#### Translation Generation (`/api/activity/translation/{language}`)
**Location**: `backend/main.py` lines 1030-1141

**Algorithm**:
1. Determines user's CEFR level in target language
2. Finds all other languages user is learning
3. Gets CEFR levels for each source language
4. Generates 15-30 sentences (random count)
5. If target language is 2+ levels higher than all source languages, includes English sentences
6. Distributes sentences across source languages
7. Uses AI to generate contextually related sentences on a topic

**Source Language Selection**:
```python
# If target language much higher level, include English
if target_level_numeric - max_other_level >= 2:
    use_english = True
    other_languages.append('english')
    
# If no other languages learned, use English
if not other_languages:
    other_languages = ['english']
```

**Sentence Distribution**:
- Random distribution across languages
- Each language gets at least 1 sentence
- Balanced across available languages

#### Translation Grading (`/api/activity/translation/{language}/grade`)
**Location**: `backend/main.py` lines 1588-1683

**Grading Criteria**:
1. **Accuracy** (0-100): How well meaning is captured
2. **Grammar** (0-100): Grammatical correctness
3. **Naturalness** (0-100): Idiomatic and natural phrasing
4. **Level Appropriateness** (0-100): Matches user's CEFR level

**Returns**:
- Overall score (average of criteria)
- Individual scores per criterion
- Overall feedback in target language
- Sentence-by-sentence feedback with suggestions

### API Client Functions

#### generate_translation_activity()
**Location**: `backend/api_client.py` lines 2606-2716

**Parameters**:
- `target_language`: Language to translate into
- `target_level`: User's CEFR level in target language
- `source_languages`: List of source languages
- `source_language_levels`: CEFR levels for each source
- `sentences_per_language`: Distribution of sentences
- `custom_topic`: Optional topic override

**Process**:
1. Selects random topic from base topics (or uses custom)
2. Formats source language descriptions with levels and counts
3. Generates prompt using translation_activity.txt template
4. Calls Gemini 2.5 Flash API
5. Parses JSON response
6. Returns activity with sentences, translations, transliterations

#### grade_translation_activity()
**Location**: `backend/api_client.py` lines 2808-2877

**Parameters**:
- `translations`: List of translation objects
- `target_language`: Target language
- `user_cefr_level`: User's CEFR level

**Process**:
1. Formats all translations with source and expected
2. Generates grading prompt using translation_grading.txt template
3. Calls Gemini 2.5 Flash API
4. Parses JSON response with scores and feedback
5. Returns detailed grading results

### Prompt Templates

#### translation_activity.txt
**Location**: `backend/prompting/templates/translation_activity.txt`

**Generates**:
- Activity name in target language
- Instructions in target language
- Array of sentences with:
  - Source text in source script
  - Transliteration (if non-Latin script)
  - Language code
  - Language display name
  - Expected translation in target script

#### translation_grading.txt
**Location**: `backend/prompting/templates/translation_grading.txt`

**Evaluates**:
- Each translation against expected
- Provides scores for accuracy, grammar, naturalness, level
- Gives overall feedback
- Provides sentence-specific feedback with suggestions

### Database Utilities

#### _cefr_to_numeric()
**Location**: `backend/db.py` lines 1813-1816

Converts CEFR levels to numeric for comparison:
- A1 = 1, A2 = 2, B1 = 3, B2 = 4, C1 = 5, C2 = 6

Used to determine if target language is significantly higher level than source languages.

### Navigation & Routing

#### ActivityScreenNew.js
Updated to route `translation` activity type to TranslationActivity component.

#### PracticeScreen.js
Added translation to activity list between speaking and conversation.

#### ActivityHistoryScreen.js
Added translation color scheme for history display.

### Shared Constants

#### ACTIVITY_COLORS
**Location**: `screens/activities/shared/constants.js`

Added translation colors to shared constants used across all components.

## User Experience

### Activity Selection
- Appears in Practice screen between Speaking and Conversation
- Purple color theme distinguishes it from other activities
- Language icon (Ionicons 'language') for recognition

### During Activity
1. **Instructions Card**: Explains task in target language
2. **Progress Card**: Shows X/Y translations completed with progress bar
3. **Sentence Card**: 
   - Shows current sentence number
   - Displays source language badge
   - Shows source sentence with transliteration (if applicable)
   - Text input for translation in target language
   - Previous/Next navigation buttons
4. **Overview Card**: Lists all sentences with completion checkmarks
5. **Submit Button**: Enabled when all translations complete

### After Grading
1. **Results Section**:
   - Overall score displayed prominently
   - Breakdown by criteria (accuracy, grammar, naturalness, level)
   - Overall feedback in target language
2. **Sentence Analysis**:
   - Each sentence shown with:
     - Source text
     - User's translation (blue)
     - Expected translation (green)
     - Specific feedback
3. **Complete Button**: Logs activity and returns to Practice

## Intelligence Features

### Adaptive Source Selection
- Uses only languages the user is actively learning
- Considers proficiency levels in each language
- Adds English if target language too advanced for other sources
- Balances sentence distribution across languages

### Level-Appropriate Content
- Target translations match user's target language level
- Source sentences match user's source language levels
- Grading considers user's level (more lenient at lower levels)

### Contextual Sentences
- All sentences relate to a common topic/theme
- Natural, idiomatic language in both source and target
- Avoids overly literal translations

## Technical Benefits

1. **Language Agnostic**: Works with any combination of languages
2. **Scalable**: Supports any number of source languages
3. **Flexible**: Sentence count and distribution adapts to user's profile
4. **Reusable**: Leverages existing hooks (useActivityData, useGrading, etc.)
5. **Consistent**: Follows same patterns as other activities

## Testing Checklist

- [ ] Translation activity appears in Practice screen
- [ ] Activity generates correct number of sentences
- [ ] Sentences are from appropriate source languages
- [ ] Source language levels are appropriate
- [ ] English is included when target level much higher
- [ ] Sentences all relate to chosen topic
- [ ] Transliterations appear for non-Latin scripts
- [ ] Text input works for all target languages
- [ ] Navigation between sentences works
- [ ] Overview shows all sentences and completion status
- [ ] Progress bar updates correctly
- [ ] Submit enabled only when all complete
- [ ] Grading provides detailed feedback
- [ ] Scores are reasonable and accurate
- [ ] Sentence-specific feedback is helpful
- [ ] Activity logs correctly to history
- [ ] Can reopen from history
- [ ] Works with Urdu (special font handling)

## Future Enhancements

Potential improvements:
1. Audio pronunciation of source sentences
2. Hint system showing word-by-word translations
3. Dictionary integration for unfamiliar words
4. Multiple choice mode for beginners
5. Spaced repetition for difficult translations
6. Community translations for comparison
7. Alternative correct translations support
8. Context/explanation for cultural phrases
