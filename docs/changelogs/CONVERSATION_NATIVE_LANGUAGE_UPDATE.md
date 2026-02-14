# Conversation Activity: Native Language & Dictionary Lookup Update

## Overview
Updated the ConversationActivity component to be fully language-native with transliterations and dictionary lookup functionality.

## Changes Made

### 1. New UI Labels Added (`constants/ui_labels.js`)

#### Start Conversation Label
```javascript
const START_CONVERSATION_LABELS = {
  kannada: 'ಸಂವಾದ ಪ್ರಾರಂಭಿಸಿ',
  telugu: 'సంభాషణ ప్రారంభించండి',
  malayalam: 'സംഭാഷണം ആരംഭിക്കുക',
  tamil: 'உரையாடலைத் தொடங்கவும்',
  english: 'Start Conversation',
  hindi: 'बातचीत शुरू करें',
  urdu: 'बातचीत शुरू करें', // Devanagari
};
```

#### Reset Conversation Label
```javascript
const RESET_CONVERSATION_LABELS = {
  kannada: 'ಸಂವಾದ ಮರುಹೊಂದಿಸಿ',
  telugu: 'సంభాషణను రీసెట్ చేయండి',
  malayalam: 'സംഭാഷണം പുനഃസജ്ജമാക്കുക',
  tamil: 'உரையாடலை மீட்டமைக்கவும்',
  english: 'Reset Conversation',
  hindi: 'बातचीत रीसेट करें',
  urdu: 'बातचीत रीसेट करें', // Devanagari
};
```

#### Speaker Profile Label
```javascript
const SPEAKER_PROFILE_LABELS = {
  kannada: 'ಮಾತನಾಡುವವರ ವಿವರ',
  telugu: 'మాట్లాడేవారి వివరాలు',
  malayalam: 'സംസാരിക്കുന്നയാളുടെ വിശദാംശങ്ങൾ',
  tamil: 'பேசுபவரின் விவரங்கள்',
  english: 'Speaker Profile',
  hindi: 'वक्ता का विवरण',
  urdu: 'वक्ता का विवरण', // Devanagari
};
```

### 2. Component Updates (`screens/activities/ConversationActivity.js`)

#### Added Imports
```javascript
import {
  getConversationHeaderLabel,
  getSpeakerProfileLabel,
  getSpeakerNameLabel,
  getSpeakerGenderLabel,
  getSpeakerAgeLabel,
  getSpeakerCityLabel,
  getSpeakerStateLabel,
  getSpeakerCountryLabel,
  getSpeakerDialectLabel,
  getSpeakerBackgroundLabel,
  getTopicLabel,
  getTasksTitleLabel,
  getStartConversationLabel,
  getResetConversationLabel,
} from '../../constants/ui_labels';
```

#### Clickable Text Rendering
**New `renderText()` function** that makes all text clickable for dictionary lookup:
```javascript
const renderText = (text, style = {}) => {
  if (!text) return null;
  const safeText = normalizeText(text);
  const words = safeText.split(/(\s+|[.,!?;:—\-()[\]{}\"\']+)/);
  
  // Apply Urdu font if needed
  const urduFontStyle = (language === 'urdu' && !transliteration.showTransliterations) 
    ? { fontFamily: 'NotoNastaliqUrdu' } 
    : {};
  
  const combinedStyle = Array.isArray(style) ? StyleSheet.flatten(style) : style;
  
  return (
    <Text style={combinedStyle}>
      {words.map((word, idx) => {
        const isWord = word.trim() && !/^[\s.,!?;:—\-()[\]{}\"\']+$/.test(word);
        
        if (!isWord) {
          return <Text key={idx} style={urduFontStyle}>{word}</Text>;
        }
        
        return (
          <Text
            key={idx}
            style={[{ color: combinedStyle.color || '#000' }, urduFontStyle]}
            onPress={() => dictionary.handleWordClick(word.trim())}
          >
            {word}
          </Text>
        );
      })}
    </Text>
  );
};
```

#### Header - Native Language
```javascript
<View style={{ flex: 1, alignItems: 'center' }}>
  <SafeText style={styles.headerTitle}>
    {getConversationHeaderLabel(language)}
  </SafeText>
  {transliteration.showTransliterations && transliteration.transliterations.header && (
    <SafeText style={styles.headerSubtitle}>
      {transliteration.transliterations.header}
    </SafeText>
  )}
</View>
```

#### Speaker Profile - Native Language with Clickable Text
```javascript
<SafeText style={[styles.sectionTitle, { marginBottom: 0, fontWeight: 'bold' }]}>
  {getSpeakerProfileLabel(language)}
</SafeText>
{transliteration.showTransliterations && transliteration.transliterations.speaker_profile && (
  <SafeText style={[styles.transliterationText, { marginTop: 4 }]}>
    {transliteration.transliterations.speaker_profile}
  </SafeText>
)}
```

Each field shows native label + transliteration + clickable value:
```javascript
<View style={styles.speakerDetailRow}>
  <SafeText style={{ fontWeight: 'bold' }}>{getSpeakerNameLabel(language)}: </SafeText>
  {transliteration.showTransliterations && transliteration.transliterations.speaker_name_label && (
    <SafeText style={styles.transliterationText}>
      ({transliteration.transliterations.speaker_name_label}): 
    </SafeText>
  )}
  {renderText(activity._speaker_profile.name, styles.speakerDetailText)}
  {transliteration.showTransliterations && transliteration.transliterations.speaker_name && (
    <SafeText style={[styles.transliterationText, { marginLeft: 8 }]}>
      ({transliteration.transliterations.speaker_name})
    </SafeText>
  )}
</View>
```

#### Separate Topic Section
**New dedicated topic section** (no longer inside speaker profile):
```javascript
{/* Topic Section */}
{activity.introduction && (
  <View style={[styles.topicBox, { backgroundColor: '#E8F5E9' }]}>
    <SafeText style={[styles.sectionTitle, { fontWeight: 'bold' }]}>
      {getTopicLabel(language)}
    </SafeText>
    {transliteration.showTransliterations && transliteration.transliterations.topic_label && (
      <SafeText style={[styles.transliterationText, { marginTop: 4, marginBottom: 8 }]}>
        {transliteration.transliterations.topic_label}
      </SafeText>
    )}
    <View style={{ marginTop: 8 }}>
      {renderText(activity.introduction, styles.topicText)}
      {transliteration.showTransliterations && transliteration.transliterations.introduction && (
        <SafeText style={[styles.transliterationText, { marginTop: 8 }]}>
          {transliteration.transliterations.introduction}
        </SafeText>
      )}
    </View>
  </View>
)}
```

#### Tasks - Native Language with Clickable Text
```javascript
<SafeText style={[styles.sectionTitle, { marginBottom: 0, fontWeight: 'bold' }]}>
  {getTasksTitleLabel(language)}
</SafeText>
{transliteration.showTransliterations && transliteration.transliterations.tasks_title && (
  <SafeText style={[styles.transliterationText, { marginTop: 4 }]}>
    {transliteration.transliterations.tasks_title}
  </SafeText>
)}
```

Task items use `renderText()` for clickable words:
```javascript
{renderText(task, styles.taskTextContent)}
```

#### Buttons - Native Language
**Start Conversation:**
```javascript
<TouchableOpacity
  style={[styles.startButton, { backgroundColor: colors.primary }]}
  onPress={conversation.startConversation}
>
  <Ionicons name="chatbubbles" size={24} color="#FFFFFF" />
  <SafeText style={styles.startButtonText}>
    {getStartConversationLabel(language)}
  </SafeText>
  {transliteration.showTransliterations && transliteration.transliterations.start_conversation && (
    <SafeText style={[styles.startButtonSubtext]}>
      ({transliteration.transliterations.start_conversation})
    </SafeText>
  )}
</TouchableOpacity>
```

**Reset Conversation:**
```javascript
<SafeText style={[styles.resetButtonText, { color: colors.primary }]}>
  {getResetConversationLabel(language)}
</SafeText>
{transliteration.showTransliterations && transliteration.transliterations.reset_conversation && (
  <SafeText style={[styles.transliterationText, { marginLeft: 8 }]}>
    ({transliteration.transliterations.reset_conversation})
  </SafeText>
)}
```

#### AI Messages - Clickable Text
```javascript
{renderText(msg.ai_response, styles.aiMessageText)}
```

### 3. Transliteration Support

Added comprehensive `useEffect` to request transliterations for:
- **UI Labels**: header, speaker_profile, topic_label, tasks_title, start_conversation, reset_conversation
- **Speaker Field Labels**: speaker_name_label, speaker_gender_label, speaker_age_label, speaker_city_label, speaker_state_label, speaker_country_label
- **Speaker Field Values**: name, gender, city, state, country
- **Activity Content**: activity_name, introduction, tasks
- **AI Responses**: ai_response_{index}

```javascript
useEffect(() => {
  if (activityData.activity && transliteration.showTransliterations) {
    // Request transliterations for UI labels
    transliteration.ensureAndShowTransliterationForKey('header', getConversationHeaderLabel(language));
    transliteration.ensureAndShowTransliterationForKey('speaker_profile', getSpeakerProfileLabel(language));
    // ... (all other labels)
    
    // Request transliterations for speaker profile values
    if (activityData.activity._speaker_profile) {
      const profile = activityData.activity._speaker_profile;
      if (profile.name) transliteration.ensureAndShowTransliterationForKey('speaker_name', profile.name);
      // ... (all other fields)
    }
    
    // Request transliterations for activity content
    // Request transliterations for AI responses
  }
}, [activityData.activity, transliteration.showTransliterations, conversation.conversationMessages]);
```

### 4. New Styles

#### Header Subtitle
```javascript
headerSubtitle: {
  fontSize: 12,
  color: '#FFFFFF',
  opacity: 0.9,
  fontStyle: 'italic',
},
```

#### Speaker Detail Row
```javascript
speakerDetailRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginBottom: 8,
  alignItems: 'center',
},
```

#### Topic Box
```javascript
topicBox: {
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
},
topicText: {
  fontSize: 14,
  color: '#1A1A1A',
  lineHeight: 20,
},
```

#### Start Button Subtext
```javascript
startButtonSubtext: {
  color: '#FFFFFF',
  fontSize: 12,
  fontStyle: 'italic',
  opacity: 0.9,
},
```

## Features

### ✅ Fully Native Language
- All UI elements (headers, labels, buttons) display in native language
- Supports all 7 languages: Kannada, Telugu, Malayalam, Tamil, Hindi, Urdu, English

### ✅ Comprehensive Transliterations
- Every native language element has corresponding transliteration
- Shown when transliteration toggle is enabled
- Includes: labels, values, content, messages

### ✅ Dictionary Lookup
- **Every word** in the conversation is clickable
- Clicking any word opens dictionary lookup
- Works for: activity name, speaker profile fields, topic, tasks, AI messages
- Uses same pattern as ReadingActivity

### ✅ Separated Topic Section
- Topic is now its own section (green background)
- No longer nested in speaker profile
- Better visual hierarchy

### ✅ Urdu Support
- All Urdu labels stored in Devanagari in constants
- Backend generates in Devanagari
- Frontend will transliterate to Perso-Arabic for display (when transliteration is OFF)
- Shows Devanagari → Roman transliteration (when transliteration is ON)

## UI Layout

```
┌─────────────────────────────────────┐
│ Header (Native) [Transliteration]   │
│ [Back] [Toggle Buttons]             │
├─────────────────────────────────────┤
│ Activity Name (Native + Clickable)  │
│ [Transliteration]                   │
├─────────────────────────────────────┤
│ ▼ Speaker Profile (Native) [Translit│
│   Name (Native Label + Translit):   │
│     Value (Clickable) [Translit]    │
│   Gender (Native + Translit):       │
│     Value (Clickable) [Translit]    │
│   Age (Native + Translit): Value    │
│   City (Native + Translit):         │
│     Value (Clickable) [Translit]    │
│   ...                               │
├─────────────────────────────────────┤
│ Topic (Native) [Transliteration]    │
│   Content (Clickable words)         │
│   [Transliteration]                 │
├─────────────────────────────────────┤
│ ▼ Tasks (Native) [Transliteration]  │
│   ☐ Task 1 (Clickable words)       │
│      [Transliteration]              │
│   ☐ Task 2 (Clickable words)       │
│      [Transliteration]              │
├─────────────────────────────────────┤
│ [Start Conversation (Native)]       │
│  [(Transliteration)]                │
├─────────────────────────────────────┤
│ Conversation messages...            │
│ (All text clickable for dictionary) │
├─────────────────────────────────────┤
│ [Reset Conversation (Native)]       │
│  [(Transliteration)]                │
└─────────────────────────────────────┘
```

## Testing Checklist

- [ ] Open conversation activity in each language
- [ ] Verify header shows native language + transliteration
- [ ] Click on any word in speaker profile → dictionary opens
- [ ] Verify topic is separate section with green background
- [ ] Click on words in topic → dictionary opens
- [ ] Verify tasks show native language + transliteration
- [ ] Click on words in tasks → dictionary opens
- [ ] Click "Start Conversation" button (native language)
- [ ] Send messages and receive AI responses
- [ ] Click on words in AI messages → dictionary opens
- [ ] Toggle transliteration ON/OFF → verify appearance changes
- [ ] Click "Reset Conversation" button (native language)
- [ ] Test with Urdu specifically:
  - [ ] Verify all content shows in Devanagari
  - [ ] Verify transliteration shows Roman
  - [ ] Verify frontend will transliterate to Perso-Arabic when toggle OFF

## Notes

1. **Dictionary Lookup Pattern**: Uses same word-splitting regex as ReadingActivity: `/(\s+|[.,!?;:—\-()[\]{}\"\']+)/`

2. **Urdu Handling**: 
   - UI labels stored in Devanagari in constants
   - Backend generates in Devanagari (from templates)
   - Frontend needs to transliterate to Perso-Arabic when `showTransliterations` is OFF

3. **Transliteration Keys**: Organized by category:
   - UI labels: `header`, `speaker_profile`, `topic_label`, `tasks_title`, etc.
   - Speaker labels: `speaker_name_label`, `speaker_gender_label`, etc.
   - Speaker values: `speaker_name`, `speaker_gender`, etc.
   - Content: `activity_name`, `introduction`, `task_0`, `task_1`, etc.
   - Messages: `ai_response_0`, `ai_response_1`, etc.

4. **Performance**: Transliterations are requested once and cached, so clicking words repeatedly doesn't cause re-fetching

## Files Modified

1. `constants/ui_labels.js` - Added 3 new label sets and exports
2. `screens/activities/ConversationActivity.js` - Complete native language refactor with dictionary lookup

## Related Documents

- `CONVERSATION_REVAMP.md` - Initial conversation activity revamp
- `CONVERSATION_TEMPLATES_UPDATE.md` - Template language-agnostic update
- `REFACTORING_COMPLETE.md` - Overall refactoring status
