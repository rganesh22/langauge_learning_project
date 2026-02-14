# How to Complete the ActivityScreen Refactoring

## Quick Start Guide

### Step 1: Create ReadingActivity Component

```bash
# Create the file
touch screens/activities/ReadingActivity.js
```

Then copy the reading-specific sections from ActivityScreen.js:
- Lines ~4920-5500 (reading render logic)
- Shared state and hooks needed for reading
- Question rendering logic

### Step 2: Create Other Activity Components

Repeat for each activity type:
- `ListeningActivity.js` - Audio playback, paragraph navigation
- `WritingActivity.js` - Text input, grading
- `SpeakingActivity.js` - Recording, transcription
- `ConversationActivity.js` - Chat interface, tasks

### Step 3: Extract Shared Hooks

Create reusable hooks in `shared/hooks/`:

**`useTransliteration.js`**
```javascript
export function useTransliteration(language, activity) {
  const [transliterations, setTransliterations] = useState({});
  const [showTransliterations, setShowTransliterations] = useState(true);
  
  // Extract transliteration logic from ActivityScreen.js
  // ...
  
  return {
    transliterations,
    showTransliterations,
    setShowTransliterations,
    ensureTransliterations
  };
}
```

**`useDictionary.js`**
```javascript
export function useDictionary(language) {
  const [showDictionary, setShowDictionary] = useState(false);
  const [dictionarySearch, setDictionarySearch] = useState('');
  const [dictionaryResults, setDictionaryResults] = useState([]);
  
  // Extract dictionary logic...
  
  return {
    showDictionary,
    setShowDictionary,
    dictionarySearch,
    dictionaryResults,
    performSearch
  };
}
```

### Step 4: Extract Shared Components

**`ActivityHeader.js`** - Reusable header for all activities
**`TextRenderer.js`** - Text with highlighting, transliteration, clickable words
**`Dictionary.js`** - Dictionary modal/panel
**`QuestionList.js`** - Reusable question rendering

### Step 5: Test and Switch

1. Test each new activity component individually
2. When all activities work, update the import in `App.js`:
   ```javascript
   // Change from:
   import ActivityScreen from './screens/ActivityScreen';
   // To:
   import ActivityScreen from './screens/ActivityScreenNew';
   ```
3. Rename files:
   ```bash
   mv screens/ActivityScreen.js screens/ActivityScreenOld.js
   mv screens/ActivityScreenNew.js screens/ActivityScreen.js
   ```

## Template for Each Activity Component

```javascript
import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import ActivityHeader from './shared/components/ActivityHeader';
import { ACTIVITY_COLORS } from './shared/constants';
import { sanitizeActivity } from './shared/utils/textProcessing';
import { fetchActivityData } from './shared/utils/apiHelpers';

export default function ReadingActivity({ route, navigation }) {
  const { activityId, language } = route.params;
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const colors = ACTIVITY_COLORS.reading;
  
  const transliteration = useTransliteration(language, activity);
  const dictionary = useDictionary(language);
  
  useEffect(() => {
    loadActivity();
  }, []);
  
  const loadActivity = async () => {
    try {
      const data = await fetchActivityData('reading', language);
      setActivity(sanitizeActivity(data.activity));
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1 }}>
      <ActivityHeader
        title="Reading"
        colors={colors}
        navigation={navigation}
        showTransliterations={transliteration.showTransliterations}
        onToggleTransliterations={() => transliteration.setShowTransliterations(!transliteration.showTransliterations)}
      />
      
      <ScrollView>
        {/* Activity-specific content */}
      </ScrollView>
    </View>
  );
}
```

## Automated Approach (Optional)

If you want to speed up the process, you could:

1. Use a script to split the file by activity type
2. Use regex to find activity-specific sections
3. Automatically extract shared logic

Example split script:
```javascript
// Split ActivityScreen.js by activity type
const fs = require('fs');
const content = fs.readFileSync('screens/ActivityScreen.js', 'utf8');

// Find sections for each activity
const readingMatch = content.match(/activityType === 'reading'[\s\S]*?(?=activityType === '|$)/);
// Extract and save...
```

## Verification Checklist

After refactoring, verify:

- [ ] All 5 activity types load
- [ ] Questions appear correctly
- [ ] Transliteration works
- [ ] Dictionary search works
- [ ] Vocabulary highlighting works
- [ ] Submit/grading works
- [ ] Audio playback (listening/speaking)
- [ ] Recording (speaking)
- [ ] Conversation flow (conversation)
- [ ] API debug modal works
- [ ] Navigation works
- [ ] No console errors

## Tips

1. **Start with Reading** - It's the simplest activity type
2. **Copy liberally** - Don't try to optimize during extraction
3. **Test frequently** - Test after each activity extraction
4. **Keep original** - Don't delete ActivityScreen.js until everything works
5. **Use Git** - Commit after each successful activity extraction

## Common Issues

**Issue**: Import errors  
**Solution**: Make sure all shared utilities are properly exported

**Issue**: Missing state  
**Solution**: Check if state is shared across activities or activity-specific

**Issue**: Hooks errors  
**Solution**: Ensure hooks are called in the same order in each component

**Issue**: Styles missing  
**Solution**: Extract styles to shared file or copy to each component

## Getting Help

If you encounter issues during refactoring:
1. Check `REFACTORING_STATUS.md` for current progress
2. Refer to `REFACTORING_PLAN.md` for the overall strategy
3. Look at the created utilities in `shared/` for examples
4. Test each component individually before integrating

---

**Remember**: The goal is to make the code more maintainable, not perfect. Start simple, then refine!
