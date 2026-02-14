# Translation Activity Audio Recording Implementation Guide

## Overview
This document provides a complete implementation guide for adding audio recording capability to translation activities, allowing users to record audio for each sentence instead of typing translations.

---

## ✅ COMPLETED: Phase 1 & 3 (Immediate Save + Native Language Names)

### Phase 1: Save Activity After Generation
**Status**: ✅ COMPLETE
**File**: `backend/main.py` lines ~1145-1200

#### Changes Made:
1. Added immediate save after translation generation
2. Added error checking for activity generation
3. Extract words from sentences for dictionary
4. Return words_used data to frontend

```python
# Save activity immediately after generation
activity_data_json = json.dumps(activity)
db.log_activity(
    language,
    'translation',
    0.0,  # Score is 0 until completed
    activity_data_json
)
```

### Phase 3: Fix Language Names (Native Script)
**Status**: ✅ COMPLETE
**File**: `backend/api_client.py` lines ~2606-2650

#### Changes Made:
1. Added `LANGUAGE_NATIVE_NAMES` mapping with 21 languages
2. Post-process sentences to replace English language_display with native names
3. Logs conversion for debugging

```python
LANGUAGE_NATIVE_NAMES = {
    'hindi': 'हिंदी',
    'telugu': 'తెలుగు',
    'kannada': 'ಕನ್ನಡ',
    # ... etc
}
```

---

## 🚧 TODO: Phase 2 (Audio Recording)

### Required Changes Summary

#### Frontend (`screens/activities/TranslationActivity.js`)

**State Additions** (Already added):
```javascript
const [inputMode, setInputMode] = useState('text'); // 'text' or 'audio'
const [sentenceRecordings, setSentenceRecordings] = useState({});
const [recordingStates, setRecordingStates] = useState({});
const recordingRefs = useRef({});
const [audioStates, setAudioStates] = useState({});
const audioRefs = useRef({});
```

**Functions to Add**:

1. **startRecordingForSentence(index)**
```javascript
const startRecordingForSentence = async (index) => {
  try {
    // Request permissions
    const { Audio } = require('expo-av');
    const permissionResponse = await Audio.requestPermissionsAsync();
    if (permissionResponse.status !== 'granted') {
      Alert.alert('Permission Required', 'Microphone permission needed');
      return;
    }

    // Configure audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Create recording
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    
    recordingRefs.current[index] = recording;
    setRecordingStates(prev => ({ ...prev, [index]: 'recording' }));
  } catch (error) {
    console.error('Failed to start recording:', error);
    Alert.alert('Error', 'Failed to start recording');
  }
};
```

2. **stopRecordingForSentence(index)**
```javascript
const stopRecordingForSentence = async (index) => {
  const recording = recordingRefs.current[index];
  if (!recording) return;

  try {
    setRecordingStates(prev => ({ ...prev, [index]: 'processing' }));
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    
    // Read as base64
    let audioBase64;
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      audioBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
    } else {
      audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    
    // Store recording
    setSentenceRecordings(prev => ({
      ...prev,
      [index]: { uri, base64: audioBase64 }
    }));
    
    setRecordingStates(prev => ({ ...prev, [index]: 'idle' }));
    delete recordingRefs.current[index];
  } catch (error) {
    console.error('Failed to stop recording:', error);
    setRecordingStates(prev => ({ ...prev, [index]: 'idle' }));
  }
};
```

3. **clearRecordingForSentence(index)**
```javascript
const clearRecordingForSentence = (index) => {
  setSentenceRecordings(prev => {
    const updated = { ...prev };
    delete updated[index];
    return updated;
  });
};
```

**UI Changes** (Add below "Your Translation" label):

```jsx
{/* Input Mode Toggle */}
<View style={styles.inputModeToggle}>
  <TouchableOpacity
    style={[
      styles.modeButton,
      inputMode === 'text' && styles.modeButtonActive
    ]}
    onPress={() => setInputMode('text')}
  >
    <Ionicons name="text" size={20} color={inputMode === 'text' ? '#FFF' : colors.primary} />
    <SafeText style={[
      styles.modeButtonText,
      inputMode === 'text' && styles.modeButtonTextActive
    ]}>
      {transliteration.nativeScriptRenderings.textMode || getTextInputModeLabel(language)}
    </SafeText>
  </TouchableOpacity>
  
  <TouchableOpacity
    style={[
      styles.modeButton,
      inputMode === 'audio' && styles.modeButtonActive
    ]}
    onPress={() => setInputMode('audio')}
  >
    <Ionicons name="mic" size={20} color={inputMode === 'audio' ? '#FFF' : colors.primary} />
    <SafeText style={[
      styles.modeButtonText,
      inputMode === 'audio' && styles.modeButtonTextActive
    ]}>
      {transliteration.nativeScriptRenderings.audioMode || getAudioInputModeLabel(language)}
    </SafeText>
  </TouchableOpacity>
</View>

{/* Conditional: Text Input or Audio Recording */}
{inputMode === 'text' ? (
  <TextInput
    style={styles.translationInput}
    value={userTranslations[currentSentenceIndex] || ''}
    onChangeText={(text) => handleTranslationChange(currentSentenceIndex, text)}
    placeholder={transliteration.nativeScriptRenderings.typePlaceholder || getTypeTranslationPlaceholderLabel(language)}
    multiline
  />
) : (
  <View style={styles.audioRecordingContainer}>
    {!sentenceRecordings[currentSentenceIndex] ? (
      // No recording yet
      recordingStates[currentSentenceIndex] === 'recording' ? (
        <TouchableOpacity
          style={[styles.recordButton, styles.recordButtonActive]}
          onPress={() => stopRecordingForSentence(currentSentenceIndex)}
        >
          <Ionicons name="stop-circle" size={48} color="#FF3B30" />
          <SafeText style={styles.recordButtonText}>
            {transliteration.nativeScriptRenderings.stopRecording || getStopRecordingLabel(language)}
          </SafeText>
        </TouchableOpacity>
      ) : recordingStates[currentSentenceIndex] === 'processing' ? (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <SafeText style={styles.processingText}>
            {transliteration.nativeScriptRenderings.processingAudio || getProcessingAudioLabel(language)}
          </SafeText>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.recordButton}
          onPress={() => startRecordingForSentence(currentSentenceIndex)}
        >
          <Ionicons name="mic-circle" size={48} color={colors.primary} />
          <SafeText style={styles.recordButtonText}>
            {transliteration.nativeScriptRenderings.startRecording || getStartRecordingLabel(language)}
          </SafeText>
        </TouchableOpacity>
      )
    ) : (
      // Recording exists
      <View style={styles.recordingExistsContainer}>
        <View style={styles.recordingInfo}>
          <Ionicons name="checkmark-circle" size={24} color="#34C759" />
          <SafeText style={styles.recordingInfoText}>
            Audio recorded
          </SafeText>
        </View>
        <AudioPlayer uri={sentenceRecordings[currentSentenceIndex].uri} />
        <TouchableOpacity
          style={styles.recordAgainButton}
          onPress={() => clearRecordingForSentence(currentSentenceIndex)}
        >
          <Ionicons name="refresh" size={20} color={colors.primary} />
          <SafeText style={styles.recordAgainText}>
            {transliteration.nativeScriptRenderings.recordAgain || getRecordAgainLabel(language)}
          </SafeText>
        </TouchableOpacity>
      </View>
    )}
  </View>
)}
```

**Styles to Add**:
```javascript
inputModeToggle: {
  flexDirection: 'row',
  marginBottom: 12,
  borderRadius: 8,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: '#DDD',
},
modeButton: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 12,
  gap: 8,
  backgroundColor: '#FFF',
},
modeButtonActive: {
  backgroundColor: colors.primary,
},
modeButtonText: {
  fontSize: 14,
  color: colors.primary,
  fontWeight: '600',
},
modeButtonTextActive: {
  color: '#FFF',
},
audioRecordingContainer: {
  alignItems: 'center',
  padding: 20,
  backgroundColor: '#F8F9FA',
  borderRadius: 12,
},
recordButton: {
  alignItems: 'center',
  gap: 8,
},
recordButtonActive: {
  // Optional: Add pulse animation
},
recordButtonText: {
  fontSize: 14,
  color: '#666',
  marginTop: 8,
},
processingContainer: {
  alignItems: 'center',
  gap: 12,
  padding: 20,
},
processingText: {
  fontSize: 14,
  color: '#666',
},
recordingExistsContainer: {
  width: '100%',
  alignItems: 'center',
  gap: 12,
},
recordingInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
recordingInfoText: {
  fontSize: 16,
  color: '#34C759',
  fontWeight: '600',
},
recordAgainButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  padding: 10,
},
recordAgainText: {
  color: colors.primary,
  fontSize: 14,
},
```

**Submit Handler Changes**:
```javascript
const handleSubmit = async () => {
  if (grading.gradingLoading) return;

  // Check if all sentences have either text or audio
  const allComplete = activity.sentences.every((_, idx) => 
    (userTranslations[idx] && userTranslations[idx].trim()) || 
    sentenceRecordings[idx]
  );

  if (!allComplete) {
    Alert.alert('Incomplete', 'Please complete all translations');
    return;
  }

  // Build translations array with mixed text/audio
  const translations = activity.sentences.map((sentence, idx) => ({
    sentence_id: sentence.id || idx,
    source_text: sentence.text,
    source_language: sentence.language,
    expected_translation: sentence.expected_translation,
    user_translation: userTranslations[idx] || null,
    audio_base64: sentenceRecordings[idx]?.base64 || null,
    input_mode: sentenceRecordings[idx] ? 'audio' : 'text'
  }));

  await grading.gradeTranslationActivity(translations);
};
```

---

#### Backend Changes

**1. Modify Translation Grading Endpoint** (`backend/main.py`)

Current request model:
```python
class TranslationGradingRequest(BaseModel):
    translations: List[Dict]  # Each has: sentence_id, source_text, source_language, expected_translation, user_translation
```

New request model:
```python
class TranslationGradingRequest(BaseModel):
    translations: List[Dict]  # Now includes: audio_base64 (optional), input_mode
```

Modified endpoint:
```python
@app.post("/api/activity/translation/{language}/grade")
def grade_translation_activity(language: str, request: TranslationGradingRequest):
    """Grade translation activity - supports text and audio inputs"""
    try:
        # Process translations - transcribe audio if present
        processed_translations = []
        
        for trans in request.translations:
            if trans.get('input_mode') == 'audio' and trans.get('audio_base64'):
                # Transcribe audio using Gemini
                audio_bytes = base64.b64decode(trans['audio_base64'])
                transcript = api_client.transcribe_audio_with_gemini(
                    audio_bytes, 
                    language,
                    prompt=f"Transcribe this {language} audio accurately."
                )
                
                processed_translations.append({
                    **trans,
                    'user_translation': transcript,
                    'transcribed_from_audio': True
                })
            else:
                processed_translations.append(trans)
        
        # Grade as normal
        grading_result = api_client.grade_translation_activity(
            translations=processed_translations,
            target_language=language,
            user_cefr_level=user_cefr_level
        )
        
        # Include transcripts in response
        return {
            "overall_score": grading_result.get("overall_score", 0),
            "scores": grading_result.get("scores", {}),
            "feedback": grading_result.get("feedback", ""),
            "sentence_feedback": grading_result.get("sentence_feedback", []),
            "transcripts": [t.get('user_translation') if t.get('transcribed_from_audio') else None 
                           for t in processed_translations],
            # ... api_details
        }
    except Exception as e:
        # error handling
```

**2. Add Transcription Function** (`backend/api_client.py`)

```python
def transcribe_audio_with_gemini(audio_data: bytes, language: str, prompt: str = None) -> str:
    """Transcribe audio using Gemini 2.0 Flash with audio input"""
    if not config.GEMINI_API_KEY:
        return ""
    
    try:
        import base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        # Build multimodal request
        genai.configure(api_key=config.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        default_prompt = f"Transcribe the following {language} audio accurately. Return ONLY the transcribed text, no additional commentary."
        
        response = model.generate_content([
            prompt or default_prompt,
            {
                "mime_type": "audio/wav",  # or detect from data
                "data": audio_base64
            }
        ])
        
        return response.text.strip()
        
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        return ""
```

---

## Testing Checklist

### Phase 1 (Save Activity) ✅
- [x] Generate translation activity
- [x] Verify activity saved to database immediately
- [x] Check activity appears in history
- [x] Verify can reopen from history
- [x] Confirm dictionary populated with words

### Phase 3 (Native Language Names) ✅
- [x] Generate activity with Hindi sentences
- [x] Verify shows "हिंदी" not "Hindi"
- [x] Check transliteration shows below
- [x] Test with Telugu, Kannada, Tamil
- [x] Verify language badge shows native script
- [x] Verify overview list shows native script

### Phase 2 (Audio Recording) 🚧
- [ ] Input mode toggle visible
- [ ] Can switch between text and audio mode
- [ ] Record button appears in audio mode
- [ ] Can start recording
- [ ] Can stop recording
- [ ] Audio playback works
- [ ] Can re-record
- [ ] Submit with audio translations
- [ ] Backend transcribes audio
- [ ] Grading works with transcribed text
- [ ] Submission shows transcript
- [ ] Mixed mode (some text, some audio) works
- [ ] Navigation preserves recordings
- [ ] Recordings cleared on activity reload

---

## File Summary

### Modified Files (Phases 1 & 3):
1. **backend/main.py** - Lines ~1145-1200
   - Added immediate save after generation
   - Added error checking
   - Extract words for dictionary

2. **backend/api_client.py** - Lines ~2606-2720
   - Added LANGUAGE_NATIVE_NAMES mapping
   - Post-process sentences for native language names

### Files to Modify (Phase 2):
1. **screens/activities/TranslationActivity.js**
   - Import useRecording, AudioPlayer, new labels
   - Add recording state and functions
   - Add input mode toggle UI
   - Add audio recording UI
   - Modify submit handler

2. **backend/main.py**
   - Modify TranslationGradingRequest model
   - Update grading endpoint to handle audio
   - Add audio transcription logic

3. **backend/api_client.py**
   - Add transcribe_audio_with_gemini function

---

## Priority

1. ✅ **HIGH**: Save activity (COMPLETE)
2. ✅ **HIGH**: Fix language names (COMPLETE)
3. 🚧 **MEDIUM**: Audio recording (TODO - Full implementation guide provided above)

The audio recording feature is now fully specified and ready to implement when needed.
