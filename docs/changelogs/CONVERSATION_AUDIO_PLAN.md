# Conversation Activity Audio Implementation Plan

## Current Status

### ✅ What Works:
1. Text-based conversation messaging
2. Dictionary lookup on all words
3. Transliterations for all content
4. Task tracking (auto-check by model)
5. Speaker profile display
6. Native language throughout

### ❌ What Needs Implementation:
1. Audio recording for user messages
2. Audio responses from Gemini (instead of TTS)
3. Real-time audio streaming
4. Audio playback controls

## Architecture Overview

### Current (Text-Only):
```
Frontend → Text Message → Backend → Gemini Text API → Text Response → Frontend
```

### Target (Native Audio):
```
Frontend → Audio Recording → Backend → Gemini Native Audio API → Audio Response → Frontend
                                            ↓
                                    (also returns text transcript)
```

## Implementation Plan

### Phase 1: Frontend Audio Recording

#### 1.1 Add Audio Recording Support to ConversationActivity

**Import useRecording hook (same as SpeakingActivity):**
```javascript
import { useRecording } from './shared/hooks/useRecording';
```

**Add recording state:**
```javascript
const recording = useRecording(language);
const [useAudioInput, setUseAudioInput] = useState(true); // Toggle between text/audio
```

**Replace text input with audio button when audio mode:**
```javascript
{/* Message Input */}
{conversation.conversationStarted && (
  <View style={[styles.inputContainer, { borderTopColor: colors.primary }]}>
    {/* Toggle between text and audio input */}
    <TouchableOpacity
      style={styles.toggleInputButton}
      onPress={() => setUseAudioInput(!useAudioInput)}
    >
      <Ionicons 
        name={useAudioInput ? "text" : "mic"} 
        size={24} 
        color={colors.primary} 
      />
    </TouchableOpacity>
    
    {useAudioInput ? (
      // Audio Recording Button
      <TouchableOpacity
        style={[
          styles.recordButton,
          { backgroundColor: recording.isRecording ? '#FF4444' : colors.primary }
        ]}
        onPressIn={handleStartRecording}
        onPressOut={handleStopRecording}
        disabled={conversation.messageLoading}
      >
        <Ionicons 
          name={recording.isRecording ? "stop" : "mic"} 
          size={32} 
          color="#FFFFFF" 
        />
      </TouchableOpacity>
    ) : (
      // Text Input (existing)
      <>
        <TextInput
          style={styles.messageInput}
          placeholder={`Type your message in ${language}...`}
          value={userInput}
          onChangeText={setUserInput}
          multiline
          maxLength={500}
          editable={!conversation.messageLoading}
        />
        <TouchableOpacity
          style={[styles.sendButton, 
            { backgroundColor: userInput.trim() ? colors.primary : '#E0E0E0' }
          ]}
          onPress={handleSendMessage}
          disabled={!userInput.trim() || conversation.messageLoading}
        >
          <Ionicons name="send" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </>
    )}
  </View>
)}
```

**Add recording handlers:**
```javascript
const handleStartRecording = async () => {
  try {
    await recording.startRecording();
  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Failed to start recording. Please check microphone permissions.');
  }
};

const handleStopRecording = async () => {
  try {
    const audioUri = await recording.stopRecording();
    if (audioUri) {
      await handleSendAudioMessage(audioUri);
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
    alert('Failed to process recording.');
  }
};

const handleSendAudioMessage = async (audioUri) => {
  setMessageLoading(true);
  setLoadingStage('processing_audio');
  
  try {
    // Read audio file as blob
    const response = await fetch(audioUri);
    const audioBlob = await response.blob();
    
    // Create FormData for multipart upload
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('language', language);
    
    // Include conversation context
    if (conversationId) {
      formData.append('conversation_id', String(conversationId));
    }
    if (conversationVoice) {
      formData.append('voice', String(conversationVoice));
    }
    
    // Send to backend
    const apiResponse = await fetch(
      `${API_BASE_URL}/api/activity/conversation/${language}/audio`,
      {
        method: 'POST',
        body: formData,
      }
    );
    
    if (!apiResponse.ok) {
      throw new Error(`HTTP error! status: ${apiResponse.status}`);
    }
    
    const data = await apiResponse.json();
    
    // Add message to conversation with audio response
    const newMessage = {
      user_message: data.transcript, // User's transcribed audio
      ai_response: data.response_text, // AI's text response
      audio_data: data.audio_response, // AI's audio response (base64)
      timestamp: new Date().toISOString(),
    };
    
    setConversationMessages(prev => [...prev, newMessage]);
    
    // Play audio response automatically
    if (data.audio_response) {
      audio.loadAudio(conversationMessages.length, data.audio_response);
      audio.playAudio(conversationMessages.length);
    }
    
  } catch (error) {
    console.error('Error sending audio message:', error);
    alert('Failed to send audio message.');
  } finally {
    setMessageLoading(false);
  }
};
```

### Phase 2: Backend Audio Endpoint

#### 2.1 Create Audio Conversation Endpoint

**Add to `backend/main.py`:**
```python
@app.post("/api/activity/conversation/{language}/audio")
async def conversation_audio_message(
    language: str,
    audio: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    voice: Optional[str] = Form(None)
):
    """Process audio message in conversation (using Gemini Native Audio)"""
    try:
        # Read audio file
        audio_bytes = await audio.read()
        
        # Get conversation history
        conversation_history = []
        speaker_profile = None
        tasks = None
        topic = None
        
        if conversation_id:
            conversation_data = db.get_conversation(conversation_id)
            if conversation_data:
                conversation_history = conversation_data.get('history', [])
                speaker_profile = conversation_data.get('speaker_profile')
                tasks = conversation_data.get('tasks')
                topic = conversation_data.get('topic')
        
        # Call Gemini Native Audio API
        result = await api_client.generate_conversation_audio_response(
            language=language,
            audio_input=audio_bytes,
            conversation_history=conversation_history,
            speaker_profile=speaker_profile,
            tasks=tasks,
            topic=topic,
            voice=voice
        )
        
        # Update conversation history
        if conversation_id and result.get('transcript') and result.get('response_text'):
            db.add_conversation_message(
                conversation_id,
                result['transcript'],
                result['response_text']
            )
        
        return {
            'transcript': result['transcript'],  # User's transcribed speech
            'response_text': result['response_text'],  # AI's text response
            'audio_response': result['audio_response'],  # AI's audio (base64)
            'api_details': result.get('api_details', {}),
            'words_used': result.get('words_used', []),
        }
        
    except Exception as e:
        print(f"Error processing audio conversation: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
```

#### 2.2 Implement Gemini Native Audio API Call

**Add to `backend/api_client.py`:**
```python
async def generate_conversation_audio_response(
    language: str,
    audio_input: bytes,
    conversation_history: list,
    speaker_profile: dict,
    tasks: list = None,
    topic: str = None,
    voice: str = None
):
    """
    Generate conversation response using Gemini Native Audio API
    
    Args:
        language: Target language
        audio_input: Audio bytes from user
        conversation_history: Previous messages
        speaker_profile: Character profile
        tasks: Conversation tasks
        topic: Conversation topic
        voice: Voice to use for response
    
    Returns:
        dict with 'transcript', 'response_text', 'audio_response', 'api_details'
    """
    import google.generativeai as genai
    import base64
    import io
    
    try:
        # Configure Gemini Native Audio model
        model = genai.GenerativeModel(GEMINI_MODEL_LIVE)
        
        # Prepare context from conversation history
        conversation_context = ""
        if conversation_history:
            for msg in conversation_history[-5:]:  # Last 5 messages for context
                user_msg = msg.get('user_message', '')
                ai_msg = msg.get('ai_response', '')
                if user_msg:
                    conversation_context += f"\nUser: {user_msg}"
                if ai_msg:
                    conversation_context += f"\nYou: {ai_msg}"
        
        # Prepare tasks context
        tasks_context = ""
        if tasks:
            tasks_context = "\n\nConversation Tasks (things the user should accomplish):\n"
            for i, task in enumerate(tasks, 1):
                tasks_context += f"{i}. {task}\n"
        
        # Get user's CEFR level
        user_level_info = db.calculate_user_level(language)
        user_cefr_level = user_level_info.get('level', 'A1')
        
        # Get vocabulary words
        learning_words, _ = db.get_vocabulary(language, mastery_filter='learning')
        review_words, _ = db.get_vocabulary(language, mastery_filter='review')
        words = list(learning_words)[:20]  # Limit to 20
        words.extend(list(review_words)[:10])
        
        words_context = "\n".join([
            f"- {w.get('word', '')} ({w.get('transliteration', '')}) - {w.get('definition', '')}"
            for w in words if w.get('word')
        ])
        
        # Flatten speaker profile
        speaker_name = speaker_profile.get('name', '') if speaker_profile else ''
        speaker_gender = speaker_profile.get('gender', '') if speaker_profile else ''
        speaker_age = speaker_profile.get('age', '') if speaker_profile else ''
        speaker_city = speaker_profile.get('city', '') if speaker_profile else ''
        speaker_state = speaker_profile.get('state', '') if speaker_profile else ''
        speaker_country = speaker_profile.get('country', '') if speaker_profile else ''
        speaker_dialect = speaker_profile.get('dialect', '') if speaker_profile else ''
        speaker_background = speaker_profile.get('background', '') if speaker_profile else ''
        
        # Build prompt
        system_prompt = f"""You are a character in a realistic {language} conversation, NOT a language tutor.

YOUR CHARACTER:
Name: {speaker_name}
Gender: {speaker_gender}
Age: {speaker_age}
City: {speaker_city}
State: {speaker_state}
Country: {speaker_country}
Dialect: {speaker_dialect}
Background: {speaker_background}

User's Level: {user_cefr_level}
Topic: {topic or 'General conversation'}

{tasks_context}
{conversation_context}

Available Vocabulary: {words_context}

INSTRUCTIONS:
1. Respond naturally as THIS character would in real life
2. Keep responses SHORT (1-2 sentences)
3. Use simple language appropriate for {user_cefr_level} level
4. Naturally incorporate 1-2 vocabulary words when appropriate
5. Respond in {language} native script
6. Maintain your character's personality throughout

AUDIO OUTPUT: Respond with natural speech in {language}, matching the character's voice and personality."""

        # Upload audio to Gemini
        audio_file = genai.upload_file(
            path=io.BytesIO(audio_input),
            mime_type="audio/webm"
        )
        
        # Generate response with audio input and audio output
        response = model.generate_content(
            [system_prompt, audio_file],
            generation_config=genai.GenerationConfig(
                response_modalities=["AUDIO"],  # Request audio output
                speech_config=genai.SpeechConfig(
                    voice_config=genai.VoiceConfig(
                        prebuilt_voice_config=genai.PrebuiltVoiceConfig(
                            voice_name=voice or "Kore"  # Use specified voice or default
                        )
                    )
                )
            )
        )
        
        # Extract transcript and audio
        transcript = ""
        response_text = ""
        audio_response_base64 = None
        
        for part in response.candidates[0].content.parts:
            if part.text:
                # This is the text transcription of the audio response
                response_text = part.text
            if hasattr(part, 'inline_data') and part.inline_data.mime_type.startswith('audio/'):
                # This is the audio response
                audio_response_base64 = base64.b64encode(part.inline_data.data).decode('utf-8')
        
        # Also extract user's transcript (if available from audio input processing)
        # Note: Gemini Native Audio should provide transcript of input audio
        # For now, we'll use the response text as a placeholder
        transcript = "(Audio message)"  # This would be populated by Gemini's transcription
        
        # Calculate costs
        # Gemini Native Audio pricing: $3/1M tokens input audio, $12/1M tokens output audio
        # Approximate token count based on audio duration (rough estimate)
        audio_duration_seconds = len(audio_input) / 16000  # Assuming 16kHz sample rate
        input_tokens = int(audio_duration_seconds * 10)  # ~10 tokens per second (rough estimate)
        output_tokens = len(response_text.split()) * 1.3  # Estimate tokens from text
        
        input_cost = (input_tokens / 1_000_000) * GEMINI_25_FLASH_NATIVE_AUDIO_INPUT_AUDIO_PRICE_PER_1M
        output_cost = (output_tokens / 1_000_000) * GEMINI_25_FLASH_NATIVE_AUDIO_OUTPUT_AUDIO_PRICE_PER_1M
        total_cost = input_cost + output_cost
        
        api_details = {
            'model': GEMINI_MODEL_LIVE,
            'input_audio_duration': audio_duration_seconds,
            'estimated_input_tokens': input_tokens,
            'estimated_output_tokens': output_tokens,
            'input_cost': input_cost,
            'output_cost': output_cost,
            'total_cost': total_cost,
            'voice_used': voice,
        }
        
        return {
            'transcript': transcript,
            'response_text': response_text,
            'audio_response': audio_response_base64,
            'api_details': api_details,
            'words_used': [],  # TODO: Extract words used from response
        }
        
    except Exception as e:
        print(f"Error generating audio conversation response: {str(e)}")
        import traceback
        traceback.print_exc()
        raise
```

### Phase 3: Audio Playback

#### 3.1 Auto-play Audio Responses

**Modify message rendering in ConversationActivity:**
```javascript
// In the AI response section
{msg.ai_response && (
  <View style={styles.aiMessageContainer}>
    <View style={styles.aiMessageBubble}>
      {/* Audio playback if available */}
      {msg.audio_data && (
        <TouchableOpacity
          style={styles.audioButton}
          onPress={() => audio.toggleAudio(index)}
        >
          <Ionicons
            name={audio.playingParagraph === index ? "pause-circle" : "play-circle"}
            size={32}
            color={colors.primary}
          />
          {audio.playingParagraph === index && (
            <ActivityIndicator 
              size="small" 
              color={colors.primary} 
              style={{ marginLeft: 8 }}
            />
          )}
        </TouchableOpacity>
      )}
      {renderText(msg.ai_response, styles.aiMessageText)}
      {/* ... transliteration ... */}
    </View>
  </View>
)}
```

## Cost Calculation Updates

### Updated Pricing (January 2026):

**Gemini 2.5 Flash (Text Model):**
- Input: $0.30 / 1M tokens (text/image/video)
- Input: $1.00 / 1M tokens (audio)
- Output: $2.50 / 1M tokens

**Gemini 2.5 Flash Native Audio:**
- Input: $0.50 / 1M tokens (text)
- Input: $3.00 / 1M tokens (audio/video)
- Output: $2.00 / 1M tokens (text)
- Output: $12.00 / 1M tokens (audio)

### Cost Calculation Functions:

**For text-only conversations (current):**
```python
input_cost = (prompt_tokens / 1_000_000) * 0.30
output_cost = (response_tokens / 1_000_000) * 2.50
total_cost = input_cost + output_cost
```

**For audio conversations (native audio):**
```python
# Audio input
audio_input_tokens = duration_seconds * 10  # Rough estimate
audio_input_cost = (audio_input_tokens / 1_000_000) * 3.00

# Audio output
audio_output_tokens = estimated_from_response_text
audio_output_cost = (audio_output_tokens / 1_000_000) * 12.00

total_cost = audio_input_cost + audio_output_cost
```

## Testing Plan

### Phase 1 Testing:
- [ ] Audio recording starts on button press
- [ ] Audio recording stops on button release
- [ ] Audio file is properly formatted (WebM/Opus)
- [ ] FormData uploads correctly

### Phase 2 Testing:
- [ ] Backend receives audio file
- [ ] Gemini Native Audio API called successfully
- [ ] Transcript extracted from user audio
- [ ] Response generated in correct language
- [ ] Audio response received and encoded

### Phase 3 Testing:
- [ ] Audio response plays automatically
- [ ] Audio playback controls work
- [ ] Multiple messages maintain separate audio
- [ ] Cost calculation accurate

## Migration Path

### Option 1: Gradual Migration
1. Keep text input as default
2. Add audio input as toggle option
3. Test with small group
4. Make audio default once stable

### Option 2: Direct Migration
1. Replace text input with audio immediately
2. Add "type instead" fallback
3. Full audio experience from start

**Recommendation: Option 1 (Gradual Migration)** - Less risk, easier to debug

## Files to Modify

### Frontend:
1. `screens/activities/ConversationActivity.js` - Add audio recording
2. `screens/activities/shared/hooks/useConversation.js` - Add audio methods

### Backend:
1. `backend/main.py` - Add audio endpoint
2. `backend/api_client.py` - Add audio generation function
3. `backend/db.py` - Update conversation storage for audio

## Estimated Timeline

- **Phase 1 (Frontend Audio Recording):** 3-4 hours
- **Phase 2 (Backend Audio API):** 4-5 hours
- **Phase 3 (Audio Playback):** 2-3 hours
- **Testing & Polish:** 2-3 hours
- **Total:** 11-15 hours

## Next Steps

1. ✅ Update pricing constants (DONE)
2. Implement Phase 1: Frontend audio recording
3. Implement Phase 2: Backend audio endpoint
4. Implement Phase 3: Audio playback
5. Test end-to-end flow
6. Deploy and monitor
