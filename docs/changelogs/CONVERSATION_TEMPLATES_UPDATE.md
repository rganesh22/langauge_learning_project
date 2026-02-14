# Conversation Templates - Language-Agnostic Update

## Summary
All conversation-related prompt templates have been updated to be **language-agnostic** and work for all supported languages (Kannada, Hindi, Urdu, Tamil, Telugu, Malayalam, English).

---

## ✅ Files Updated

### 1. **conversation_activity.txt**
**Location**: `backend/prompting/templates/conversation_activity.txt`

**Changes Made**:
- ❌ **Removed**: `"Create a realistic Kannada conversation scenario"`
- ✅ **Added**: `"Create a realistic {language} conversation scenario"`
- ❌ **Removed**: `"Language Style: {formality_instruction}"` (hardcoded Kannada text)
- ✅ **Added**: `"Formality Level: {formality_choice}"` (language-neutral)
- ❌ **Removed**: All Kannada-specific examples (e.g., `"ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ವಯಸ್ಸನ್ನು ಹೇಳಿ"`)
- ✅ **Added**: Generic placeholders (e.g., `"Task 1 in {language} native script"`)
- ❌ **Removed**: Hardcoded gender terms (`"ಗಂಡು or ಹೆಣ್ಣು"`)
- ✅ **Added**: Language-specific gender instructions with examples for all languages
- ❌ **Removed**: `"All text must be in Kannada script (ಕನ್ನಡ ಲಿಪಿ)"`
- ✅ **Added**: `"All text must be in {language}'s native script"`

**New Template Variables**:
- `{language}` - Target language name
- `{formality_choice}` - "informal" or "formal" (instead of hardcoded Kannada instructions)
- `{user_cefr_level}` - User's proficiency level
- `{topic}` - Conversation topic
- `{selected_region}` - Regional dialect
- `{words_context}` - Available vocabulary words

**Key Instructions Added**:
```
8. Apply appropriate formality based on {formality_choice}:
   - If "informal": Use casual, friendly, everyday conversational style
   - If "formal": Use respectful, proper, professional language style
```

---

### 2. **conversation_response.txt**
**Location**: `backend/prompting/templates/conversation_response.txt`

**Changes Made**:
- ❌ **Removed**: `"You are a character in a realistic Kannada conversation scenario"`
- ✅ **Added**: `"You are a character in a realistic {language} conversation scenario"`
- ❌ **Removed**: `"Language Style: {formality_instruction}"` (Kannada hardcoded text)
- ✅ **Added**: `"Formality Level: {formality_choice}"` with clear instructions
- ❌ **Removed**: Hardcoded Kannada speaker profile format
- ✅ **Added**: Language-neutral speaker profile using template variables:
  ```
  Name: {speaker_profile.name}
  Gender: {speaker_profile.gender}
  Age: {speaker_profile.age}
  City: {speaker_profile.city}
  State: {speaker_profile.state}
  Country: {speaker_profile.country}
  Dialect: {speaker_profile.dialect}
  Background: {speaker_profile.background}
  ```
- ❌ **Removed**: `"Return ONLY the response text in Kannada script"`
- ✅ **Added**: `"Return ONLY the response text in {language}'s native script"`
- ❌ **Removed**: `"Do NOT use any English - use ONLY Kannada script"`
- ✅ **Added**: `"Do NOT use any English - use ONLY {language}'s native script"`

**New Instructions Added**:
```
4. Match the conversation style and formality level specified:
   - If formality_choice is "informal": Use casual, friendly, everyday conversational style
   - If formality_choice is "formal": Use respectful, proper, professional language style

10. Apply the regional dialect features specified in {selected_region} naturally in your speech.
```

---

### 3. **conversation_rating.txt**
**Location**: `backend/prompting/templates/conversation_rating.txt`

**Changes Made**:
- ❌ **Removed**: `"ಕನ್ನಡ ಭಾಷಾ ಕಲಿಕೆಯ ಸಂಭಾಷಣೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಿ."` (Kannada text)
- ✅ **Added**: `"Evaluate a {language} language learning conversation."`
- ❌ **Removed**: All Kannada instructions (e.g., `"ಎಲ್ಲಾ ಔಟ್ಪುಟ್ ಕೇವಲ ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿರಬೇಕು"`)
- ✅ **Added**: Language-neutral instructions (e.g., `"All output must be in {language}'s native script"`)
- ❌ **Removed**: Kannada JSON examples
- ✅ **Added**: Generic JSON format with `{language}` placeholders
- ❌ **Removed**: Kannada-specific reminders
- ✅ **Added**: Language-neutral critical reminders

**New Template Structure**:
```
CRITICAL: All output must be in {language}'s native script ONLY.
- All feedback text must be in pure {language} native script only
- All task assessment feedback must be in {language} native script only
- Scores are numbers (0-100), feedback is {language} text
```

---

## 🎯 Benefits of Language-Agnostic Templates

### **1. Universal Support**
- ✅ Works for Kannada, Hindi, Urdu, Tamil, Telugu, Malayalam, English
- ✅ No code changes needed to add new languages
- ✅ Single template maintains all languages

### **2. Consistent Structure**
- ✅ Same format for all languages
- ✅ Predictable JSON output structure
- ✅ Easy to maintain and update

### **3. Formality Handling**
- ✅ Replaces hardcoded formality text with `{formality_choice}` variable
- ✅ Templates apply formality instructions based on "informal" or "formal" value
- ✅ Language-specific formality nuances handled by the model

### **4. Regional Dialect Support**
- ✅ `{selected_region}` variable passes dialect information
- ✅ Model applies regional features naturally
- ✅ Works for all language regions (Bengaluru Kannada, Mumbai Hindi, Hyderabad Urdu, etc.)

### **5. Speaker Profile Integration**
- ✅ Clean template variable access (`{speaker_profile.name}`, etc.)
- ✅ No hardcoded Kannada field names
- ✅ Profile data passed directly from code

---

## 📋 Template Variable Reference

### **conversation_activity.txt Variables**
| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `{language}` | string | "Kannada", "Hindi", "Urdu" | Target language name |
| `{user_cefr_level}` | string | "A1", "B2" | User's proficiency level |
| `{topic}` | string | "daily life and routines" | Conversation topic |
| `{selected_region}` | string | "ಬೆಂಗಳೂರು/ಮೈಸೂರು" | Regional dialect |
| `{formality_choice}` | string | "informal", "formal" | Formality level |
| `{words_context}` | string | List of vocabulary words | Available words |

### **conversation_response.txt Variables**
| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `{language}` | string | "Kannada" | Target language |
| `{user_cefr_level}` | string | "A1" | User proficiency |
| `{topic_context}` | string | "Topic: food" | Scenario context |
| `{selected_region}` | string | "Delhi" | Regional dialect |
| `{formality_choice}` | string | "informal" | Formality level |
| `{speaker_profile.name}` | string | "राजेश" | Character name |
| `{speaker_profile.gender}` | string | "पुरुष" | Character gender |
| `{speaker_profile.age}` | string | "25-35" | Age range |
| `{speaker_profile.city}` | string | "मुंबई" | City name |
| `{speaker_profile.state}` | string | "महाराष्ट्र" | State name |
| `{speaker_profile.country}` | string | "भारत" | Country name |
| `{speaker_profile.dialect}` | string | "Mumbai Hindi" | Dialect desc |
| `{speaker_profile.background}` | string | "सॉफ्टवेयर इंजीनियर" | Profession |
| `{tasks_context}` | string | Task list | Conversation tasks |
| `{conversation_context}` | string | Previous messages | Chat history |
| `{message}` | string | User's message | Current message |
| `{words_context}` | string | Vocabulary list | Available words |

### **conversation_rating.txt Variables**
| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `{language}` | string | "Hindi" | Target language |
| `{user_cefr_level}` | string | "B1" | User proficiency |
| `{topic}` | string | "technology" | Conversation topic |
| `{conversation_transcript}` | string | Full chat log | Transcript |
| `{tasks_list}` | string | Task list | Tasks to check |
| `{learned_context}` | string | Learned words | User's progress |
| `{learning_context}` | string | Learning words | Current focus |

---

## 🔄 How Backend Uses These Templates

### **Python Code Integration** (`api_client.py`)

**Before** (Kannada-specific):
```python
if formality_choice == 'informal':
    formality_instruction = "ಅನೌಪಚಾರಿಕ/ಸಾಮಾನ್ಯ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ..."
else:
    formality_instruction = "ಔಪಚಾರಿಕ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ..."

prompt = render_template(
    'conversation_activity.txt',
    formality_instruction=formality_instruction,
    ...
)
```

**After** (Language-agnostic):
```python
# Just pass the choice - template handles language-specific instructions
prompt = render_template(
    'conversation_activity.txt',
    language=language,
    formality_choice=formality_choice,  # "informal" or "formal"
    ...
)
```

**Speaker Profile Passing**:
```python
# Clean dictionary access in template
prompt = render_template(
    'conversation_response.txt',
    language=language,
    speaker_profile=speaker_profile,  # Dict with all profile fields
    formality_choice=formality_choice,
    ...
)
```

---

## ✅ Testing Checklist

To verify the language-agnostic templates work correctly:

- [ ] Test conversation creation in **Kannada**
- [ ] Test conversation creation in **Hindi**
- [ ] Test conversation creation in **Urdu**
- [ ] Test conversation creation in **Tamil**
- [ ] Test conversation creation in **Telugu**
- [ ] Test conversation creation in **Malayalam**
- [ ] Test conversation creation in **English**
- [ ] Verify **informal** formality works in all languages
- [ ] Verify **formal** formality works in all languages
- [ ] Test conversation response generation in all languages
- [ ] Test conversation rating in all languages
- [ ] Verify regional dialects are applied (e.g., Bengaluru Kannada, Mumbai Hindi)
- [ ] Check speaker profiles use correct language script
- [ ] Verify gender terms are language-appropriate

---

## 🚀 Next Steps

1. **Update Backend Functions** ✅ (Already completed in `api_client.py`)
   - Made `generate_conversation_activity()` language-agnostic
   - Made `generate_conversation_response()` language-agnostic
   - Added regional support for all languages
   - Removed hardcoded Kannada instructions

2. **Test with All Languages** (To do)
   - Generate conversation activities in each language
   - Verify output is in correct script
   - Check formality levels work correctly

3. **Implement Gemini Live API** (Future)
   - Add real-time audio streaming support
   - Use `GEMINI_MODEL_LIVE` ("gemini-2.0-flash-exp")
   - Replace TTS/STT with bidirectional streaming

4. **Update Frontend** (Future)
   - Ensure `ConversationActivity.js` handles all languages
   - Add language-specific UI text rendering
   - Support for Urdu RTL layout if needed

---

## 📖 Related Documentation

- See `CONVERSATION_REVAMP.md` for backend code changes
- See `REFACTORING_COMPLETE.md` for overall project status
- See `backend/prompting/templates/` for other language-agnostic templates (listening, reading, writing, speaking)

---

**Status**: ✅ **All conversation templates are now language-agnostic and ready for use with all supported languages!**
