# Shared Activity Components

This directory contains reusable components, hooks, and utilities for activity screens.

## Components

### VocabularyDictionary

A full-featured dictionary modal that displays vocabulary with search and filtering capabilities. This is the same dictionary used in the Vocab Library screen, adapted for use in activities.

**Features:**
- Search vocabulary by English or native language
- Filter by mastery level (New, Learning, Learned)
- Filter by part of speech (Noun, Verb, Adjective, etc.)
- Filter by CEFR level (A1, A2, B1, B2, C1, C2)
- Display word cards with:
  - English word
  - Translation in target language
  - Transliteration
  - Mastery badge
  - Tags (part of speech, level, transitivity)
- Infinite scroll with pagination
- Word count display

**Usage:**

```javascript
import { VocabularyDictionary } from './shared/components';
import { useDictionary } from './shared/hooks/useDictionary';

export default function MyActivity({ route, navigation }) {
  const language = 'urdu'; // or any supported language
  const dictionary = useDictionary(language);

  // To open dictionary with a specific word search
  const handleWordClick = (word) => {
    dictionary.handleWordClick(word);
  };

  return (
    <View>
      {/* Your activity content */}
      <TouchableOpacity onPress={() => dictionary.setShowDictionary(true)}>
        <Text>Open Dictionary</Text>
      </TouchableOpacity>

      {/* Dictionary Modal */}
      <VocabularyDictionary
        visible={dictionary.showDictionary}
        onClose={() => dictionary.setShowDictionary(false)}
        language={language}
        initialSearchQuery={dictionary.initialSearchQuery}
      />
    </View>
  );
}
```

**Props:**
- `visible` (boolean): Controls modal visibility
- `onClose` (function): Called when modal is closed
- `language` (string): Target language code (e.g., 'urdu', 'kannada', 'hindi')
- `initialSearchQuery` (string): Optional - Pre-populate search with this query

---

### APIDebugModal

A debug modal that displays API call details including costs, tokens, prompts, and responses.

**Features:**
- Cumulative statistics across all API calls
- Collapsible cards for individual API calls
- Token usage and costs breakdown
- Response times
- Full prompt and response display
- Error highlighting (parse errors, TTS errors)

**Usage:**

```javascript
import { APIDebugModal } from './shared/components';
import { useActivityData } from './shared/hooks/useActivityData';

export default function MyActivity({ route, navigation }) {
  const activityData = useActivityData('reading', 'urdu', activityId, fromHistory);

  return (
    <View>
      {/* Your activity content */}
      <TouchableOpacity onPress={() => activityData.setShowApiModal(true)}>
        <Ionicons name="bug" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Debug Modal */}
      <APIDebugModal
        visible={activityData.showApiModal}
        onClose={() => activityData.setShowApiModal(false)}
        allApiDetails={activityData.allApiDetails}
      />
    </View>
  );
}
```

**Props:**
- `visible` (boolean): Controls modal visibility
- `onClose` (function): Called when modal is closed
- `allApiDetails` (array): Array of API call detail objects

---

## Hooks

### useDictionary

Manages dictionary state and word click handling.

**Returns:**
- `showDictionary` (boolean): Whether dictionary modal is visible
- `setShowDictionary` (function): Show/hide dictionary
- `initialSearchQuery` (string): Search query to initialize dictionary with
- `setInitialSearchQuery` (function): Set initial search query
- `handleWordClick` (function): Handler for clicking on words - opens dictionary with that word

### useActivityData

Manages activity data loading, API details, and debug modal state.

**Returns:**
- `activity` (object): Activity data
- `loading` (boolean): Loading state
- `loadingStatus` (string): Loading status message
- `wordsUsed` (array): Words used in activity
- `allApiDetails` (array): API call details for debugging
- `showApiModal` (boolean): Debug modal visibility
- `setShowApiModal` (function): Show/hide debug modal
- `loadActivity` (function): Load activity data

### useTransliteration

Manages transliteration display and native script rendering (e.g., Urdu Nastaliq).

**Returns:**
- `showTransliterations` (boolean): Whether transliterations are visible
- `setShowTransliterations` (function): Toggle transliterations
- `transliterations` (object): Transliteration mappings
- `nativeScriptRenderings` (object): Native script renderings (e.g., Nastaliq for Urdu)
- `ensureNativeScriptForKey` (function): Fetch native script for a key
- `ensureAndShowTransliterationForKey` (function): Fetch and show transliteration

---

## Example: Complete Activity Setup

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useActivityData } from './shared/hooks/useActivityData';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import { VocabularyDictionary, APIDebugModal } from './shared/components';
import { ACTIVITY_COLORS } from './shared/constants';

export default function MyActivity({ route, navigation }) {
  const { activityId, fromHistory, language } = route.params || {};
  
  // Initialize hooks
  const activityData = useActivityData('reading', language, activityId, fromHistory);
  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);
  const colors = ACTIVITY_COLORS.reading;

  useEffect(() => {
    activityData.loadActivity();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Header with buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} />
        </TouchableOpacity>
        
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Transliteration toggle */}
          <TouchableOpacity onPress={() => transliteration.setShowTransliterations(!transliteration.showTransliterations)}>
            <Ionicons name={transliteration.showTransliterations ? "text" : "text-outline"} size={20} />
          </TouchableOpacity>
          
          {/* Dictionary button */}
          <TouchableOpacity onPress={() => dictionary.setShowDictionary(true)}>
            <Ionicons name="book" size={20} />
          </TouchableOpacity>
          
          {/* Debug button */}
          <TouchableOpacity onPress={() => activityData.setShowApiModal(true)}>
            <Ionicons name="bug" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Activity content */}
      <ScrollView>
        {/* Your content here - use dictionary.handleWordClick(word) for clickable words */}
      </ScrollView>

      {/* Modals */}
      <VocabularyDictionary
        visible={dictionary.showDictionary}
        onClose={() => dictionary.setShowDictionary(false)}
        language={language}
        initialSearchQuery={dictionary.initialSearchQuery}
      />

      <APIDebugModal
        visible={activityData.showApiModal}
        onClose={() => activityData.setShowApiModal(false)}
        allApiDetails={activityData.allApiDetails}
      />
    </View>
  );
}
```

---

## File Structure

```
screens/activities/shared/
├── components/
│   ├── VocabularyDictionary.js  # Full-featured dictionary modal
│   ├── APIDebugModal.js          # API debug information modal
│   └── index.js                  # Component exports
├── hooks/
│   ├── useActivityData.js        # Activity data management
│   ├── useTransliteration.js     # Transliteration management
│   ├── useDictionary.js          # Dictionary state management
│   └── ...
├── utils/
│   ├── apiHelpers.js             # API utility functions
│   ├── textProcessing.js         # Text normalization utilities
│   └── ...
└── constants.js                  # Shared constants (colors, etc.)
```
