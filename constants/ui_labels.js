// Shared UI labels used across screens for language-specific short labels
// Note: Urdu labels are stored in Devanagari script and will be transliterated to Nastaliq and Roman
export const QUESTIONS_LABELS = {
  kannada: 'ಪ್ರಶ್ನೆಗಳು',
  telugu: 'ప్రశ్నలు',
  malayalam: 'ചോദ്യങ്ങൾ',
  tamil: 'கேள்விகள்',
  english: 'Questions',
  hindi: 'प्रश्न',
  urdu: 'सवालात', // Devanagari - will be transliterated to Nastaliq
};

export const SUBMIT_LABELS = {
  kannada: 'ಸಲ್ಲಿಸಿ',
  telugu: 'సమర్పించండి',
  malayalam: 'സമർപ്പിക്കുക',
  tamil: 'சமர்ப்பிக்கவும்',
  english: 'Submit',
  hindi: 'जमा करें',
  urdu: 'जमा कराएँ', // Devanagari - will be transliterated to Nastaliq
};

export const getSubmitLabel = (language) => {
  try {
    const val = SUBMIT_LABELS[language] || SUBMIT_LABELS.english || 'Submit';
    if (val === null || typeof val === 'undefined') return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.filter(Boolean).join(' ');
    if (typeof val === 'object') {
      if (val.text && typeof val.text === 'string') return val.text;
      if (val.label && typeof val.label === 'string') return val.label;
      try { return JSON.stringify(val); } catch (e) { return String(val); }
    }
    return String(val);
  } catch (e) {
    return '';
  }
};

export const YOUR_SCORE_LABELS = {
  kannada: 'ನಿಮ್ಮ ಅಂಕಗಳು',
  telugu: 'మీ స్కోర్',
  malayalam: 'നിങ്ങളുടെ സ്കോർ',
  tamil: 'உங்கள் மதிப்பெண்',
  english: 'Your Score',
  hindi: 'आपका स्कोर',
  urdu: 'आपका स्कोर', // Devanagari - will be transliterated to Nastaliq
};

export const getYourScoreLabel = (language) => {
  try {
    const val = YOUR_SCORE_LABELS[language] || YOUR_SCORE_LABELS.english || 'Your Score';
    if (val === null || typeof val === 'undefined') return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.filter(Boolean).join(' ');
    if (typeof val === 'object') {
      if (val.text && typeof val.text === 'string') return val.text;
      if (val.label && typeof val.label === 'string') return val.label;
      try { return JSON.stringify(val); } catch (e) { return String(val); }
    }
    return String(val);
  } catch (e) {
    return '';
  }
};

export const CORRECT_ANSWERS_LABELS = {
  kannada: 'ಸರಿಯಾದ ಉತ್ತರಗಳು',
  telugu: 'సరైన సమాధానాలు',
  malayalam: 'ശരിയായ ഉത്തരങ്ങൾ',
  tamil: 'சரியான பதில்கள்',
  english: 'Correct Answers',
  hindi: 'सही उत्तर',
  urdu: 'सही जवाब', // Devanagari - will be transliterated to Nastaliq
};

export const getCorrectAnswersLabel = (language) => {
  try {
    const val = CORRECT_ANSWERS_LABELS[language] || CORRECT_ANSWERS_LABELS.english || 'Correct Answers';
    if (val === null || typeof val === 'undefined') return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.filter(Boolean).join(' ');
    if (typeof val === 'object') {
      if (val.text && typeof val.text === 'string') return val.text;
      if (val.label && typeof val.label === 'string') return val.label;
      try { return JSON.stringify(val); } catch (e) { return String(val); }
    }
    return String(val);
  } catch (e) {
    return '';
  }
};

export const SUBMITTING_LABELS = {
  kannada: 'ಮೌಲ್ಯಮಾಪನ ನಡೆಯುತ್ತಿದೆ...',
  telugu: 'మూల్యాంకనం జరుగుతోంది...',
  malayalam: 'മൂല്യനിർണ്ണയം നടക്കുന്നു...',
  tamil: 'மதிப்பீடு செயலிழக்கிறது...',
  english: 'Submitting...',
  hindi: 'मूल्यांकन जारी है...',
  urdu: 'जायज़ा जारी है...', // Devanagari - will be transliterated to Nastaliq
};

export const THINKING_LABELS = {
  kannada: 'ಯೋಚಿಸುತ್ತಿದೆ...',
  telugu: 'ఆలోచిస్తోంది...',
  malayalam: 'ചിന്തിക്കുന്നു...',
  tamil: 'சிந்தித்துக் கொண்டிருக்கிறது...',
  english: 'Thinking...',
  hindi: 'सोच रहा है...',
  urdu: 'सोच रहा है...', // Devanagari - will be transliterated to Nastaliq
};

export const GENERATING_AUDIO_LABELS = {
  kannada: 'ಆಡಿಯೋ ರಚಿಸಲಾಗುತ್ತಿದೆ...',
  telugu: 'ఆడియో రూపొందిస్తోంది...',
  malayalam: 'ഓഡിയോ സൃഷ്ടിക്കുന്നു...',
  tamil: 'ஆடியோ உருவாக்குகிறது...',
  english: 'Generating audio...',
  hindi: 'ऑडियो बनाया जा रहा है...',
  urdu: 'आवाज़ बनाई जा रही है...', // Devanagari - will be transliterated to Nastaliq
};

export const LIVE_MODE_TITLE_LABELS = {
  kannada: 'ನೇರ ಸಂವಾದ ವಿಧಾನ',
  telugu: 'ప్రత్యక్ష సంభాషణ మోడ్',
  malayalam: 'തത്സമയ സംഭാഷണ മോഡ്',
  tamil: 'நேரடி உரையாடல் பயன்முறை',
  english: 'Real-Time Live Mode',
  hindi: 'वास्तविक समय लाइव मोड',
  urdu: 'حقیقی وقت لائیو موڈ', // Nastaliq script
};

export const LIVE_MODE_DESCRIPTION_LABELS = {
  kannada: 'ತ್ವರಿತ AI ಪ್ರತಿಕ್ರಿಯೆಗಳೊಂದಿಗೆ ನೇರ ಆಡಿಯೋ ಸ್ಟ್ರೀಮಿಂಗ್',
  telugu: 'తక్షణ AI ప్రతిస్పందనలతో ప్రత్యక్ష ఆడియో స్ట్రీమింగ్',
  malayalam: 'തൽക്ഷണ AI പ്രതികരണങ്ങളോടെ നേരിട്ടുള്ള ഓഡിയോ സ്ട്രീമിംഗ്',
  tamil: 'உடனடி AI பதில்களுடன் நேரடி ஆடியோ ஸ்ட்ரீமிங்',
  english: 'Direct audio streaming with instant AI responses',
  hindi: 'तत्काल AI प्रतिक्रियाओं के साथ सीधा ऑडियो स्ट्रीमिंग',
  urdu: 'فوری AI جوابات کے ساتھ براہ راست آڈیو سٹریمنگ', // Nastaliq script
};

export const CLASSIC_MODE_DESCRIPTION_LABELS = {
  kannada: 'ಭಾಷಣದಿಂದ-ಪಠ್ಯಕ್ಕೆ ಪ್ರತಿಲೇಖನದೊಂದಿಗೆ ಶಾಸ್ತ್ರೀಯ ವಿಧಾನ',
  telugu: 'స్పీచ్-టు-టెక్స్ట్ ట్రాన్స్క్రిప్షన్‌తో క్లాసిక్ మోడ్',
  malayalam: 'സ്പീച്ച്-ടു-ടെക്സ്റ്റ് ട്രാൻസ്ക്രിപ്ഷനോടുകൂടിയ ക്ലാസിക് മോഡ്',
  tamil: 'பேச்சு-முதல்-உரை படியெடுப்புடன் கிளாசிக் பயன்முறை',
  english: 'Classic mode with speech-to-text transcription',
  hindi: 'वाक्-से-पाठ प्रतिलेखन के साथ क्लासिक मोड',
  urdu: 'تقریر سے متن نقل کے ساتھ کلاسک موڈ', // Nastaliq script
};

export const SEARCH_VOCABULARY_LABELS = {
  kannada: 'ಶಬ್ದಕೋಶ ಹುಡುಕಿ...',
  telugu: 'పదకోశం శోధించండి...',
  malayalam: 'നിഘണ്ടു തിരയുക...',
  tamil: 'சொற்களஞ்சியம் தேடுக...',
  english: 'Search vocabulary...',
  hindi: 'शब्दावली खोजें...',
  urdu: 'शब्दावली तलाश करें...', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_NAME_LABELS = {
  kannada: 'ಹೆಸರು:',
  telugu: 'పేరు:',
  malayalam: 'പേര്:',
  tamil: 'பெயர்:',
  english: 'Name:',
  hindi: 'नाम:',
  urdu: 'नाम:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_GENDER_LABELS = {
  kannada: 'ಲಿಂಗ:',
  telugu: 'లింగం:',
  malayalam: 'ലിംഗം:',
  tamil: 'பாலினம்:',
  english: 'Gender:',
  hindi: 'लिंग:',
  urdu: 'जिंस:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_AGE_LABELS = {
  kannada: 'ವಯಸ್ಸು:',
  telugu: 'వయస్సు:',
  malayalam: 'പ്രായം:',
  tamil: 'வயது:',
  english: 'Age:',
  hindi: 'उम्र:',
  urdu: 'उम्र:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_CITY_LABELS = {
  kannada: 'ನಗರ:',
  telugu: 'నగరం:',
  malayalam: 'നഗരം:',
  tamil: 'நகரம்:',
  english: 'City:',
  hindi: 'शहर:',
  urdu: 'शहर:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_STATE_LABELS = {
  kannada: 'ರಾಜ್ಯ:',
  telugu: 'రాష్ట్రం:',
  malayalam: 'സംസ്ഥാനം:',
  tamil: 'மாநிலம்:',
  english: 'State:',
  hindi: 'राज्य:',
  urdu: 'सूबा:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_COUNTRY_LABELS = {
  kannada: 'ದೇಶ:',
  telugu: 'దేశం:',
  malayalam: 'രാജ്യം:',
  tamil: 'நாடு:',
  english: 'Country:',
  hindi: 'देश:',
  urdu: 'मुल्क:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_DIALECT_LABELS = {
  kannada: 'ಉಪಭಾಷೆ:',
  telugu: 'మాండలికం:',
  malayalam: 'ഭാഷാഭേദം:',
  tamil: 'வட்டார வழக்கு:',
  english: 'Dialect:',
  hindi: 'बोली:',
  urdu: 'लहजा:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_BACKGROUND_LABELS = {
  kannada: 'ಹಿನ್ನೆಲೆ:',
  telugu: 'నేపథ్యం:',
  malayalam: 'പശ്ചാത്തലം:',
  tamil: 'பின்னணி:',
  english: 'Background:',
  hindi: 'पृष्ठभूमि:',
  urdu: 'पृष्ठभूमि:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_FORMALITY_LABELS = {
  kannada: 'ಔಪಚಾರಿಕತೆ:',
  telugu: 'అధికారికత:',
  malayalam: 'ഔപചാരികത:',
  tamil: 'முறைமை:',
  english: 'Formality:',
  hindi: 'औपचारिकता:',
  urdu: 'रस्मियत:', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKER_DETAILS_LABELS = {
  kannada: 'ಮಾತನಾಡುವವರ ವಿವರಗಳು',
  telugu: 'స్పీకర్ వివరాలు',
  malayalam: 'സ്പീക്കർ വിശദാംശങ്ങൾ',
  tamil: 'பேச்சாளர் விவரங்கள்',
  english: 'Speaker Details',
  hindi: 'वक्ता विवरण',
  urdu: 'वक्ता की तफ़सीलात', // Devanagari - will be transliterated to Nastaliq
};

export const SHOW_TRANSCRIPT_LABELS = {
  kannada: 'ಪಠ್ಯ ತೋರಿಸಿ',
  telugu: 'వచనాన్ని చూపించు',
  malayalam: 'പകർപ്പ് കാണിക്കുക',
  tamil: 'உரையைக் காட்டு',
  english: 'Show Transcript',
  hindi: 'टेक्स्ट दिखाएं',
  urdu: 'तहरीर दिखाएँ', // Devanagari - will be transliterated to Nastaliq
};

export const HIDE_TRANSCRIPT_LABELS = {
  kannada: 'ಪಠ್ಯ ಮರೆಮಾಡಿ',
  telugu: 'వచనాన్ని దాచు',
  malayalam: 'പകർപ്പ് മറയ്ക്കുക',
  tamil: 'உரையை மறைக்கவும்',
  english: 'Hide Transcript',
  hindi: 'टेक्स्ट छुपाएं',
  urdu: 'तहरीर छुपाएँ', // Devanagari - will be transliterated to Nastaliq
};

export const SHOW_ANSWERS_LABELS = {
  kannada: 'ಉತ್ತರಗಳನ್ನು ತೋರಿಸಿ',
  telugu: 'సమాధానాలను చూపించు',
  malayalam: 'ഉത്തരങ്ങൾ കാണിക്കുക',
  tamil: 'விடைகளைக் காட்டு',
  english: 'Show Answers',
  hindi: 'उत्तर दिखाएं',
  urdu: 'जवाब दिखाएँ', // Devanagari - will be transliterated to Nastaliq
};

export const HIDE_ANSWERS_LABELS = {
  kannada: 'ಉತ್ತರಗಳನ್ನು ಮರೆಮಾಡಿ',
  telugu: 'సమాధానాలను దాచు',
  malayalam: 'ഉത്തരങ്ങൾ മറയ്ക്കുക',
  tamil: 'விடைகளை மறைக்கவும்',
  english: 'Hide Answers',
  hindi: 'उत्तर छुपाएं',
  urdu: 'जवाब छुपाएँ', // Devanagari - will be transliterated to Nastaliq
};

export const LISTEN_TO_ALL_LABELS = {
  kannada: 'ಇಲ್ಲಿಂದ ಎಲ್ಲವನ್ನೂ ಕೇಳಿ',
  telugu: 'ఇక్కడ నుండి అన్నీ వినండి',
  malayalam: 'ഇവിടെ നിന്ന് എല്ലാം കേൾക്കുക',
  tamil: 'இங்கிருந்து அனைத்தையும் கேளுங்கள்',
  english: 'Listen to All from Here',
  hindi: 'यहाँ से सब सुनें',
  urdu: 'यहाँ से सब सुनें', // Devanagari - will be transliterated to Nastaliq
};

export const STOP_AUTO_PLAY_LABELS = {
  kannada: 'ಸ್ವಯಂ-ಪ್ಲೇ ನಿಲ್ಲಿಸಿ',
  telugu: 'ఆటో-ప్లే ఆపండి',
  malayalam: 'ഓട്ടോ-പ്ലേ നിർത്തുക',
  tamil: 'தானியங்கி-இயக்கத்தை நிறுத்தவும்',
  english: 'Stop Auto-Play',
  hindi: 'ऑटो-प्ले बंद करें',
  urdu: 'ख़ुदकार चलाना बंद करें', // Devanagari - will be transliterated to Nastaliq
};

// Paragraph label templates (for "Paragraph 1 of 4", etc.)
export const PARAGRAPH_LABEL = {
  kannada: 'ಪ್ಯಾರಾಗ್ರಾಫ್',
  telugu: 'పేరా',
  malayalam: 'ഖണ്ഡിക',
  tamil: 'பத்தி',
  english: 'Paragraph',
  hindi: 'पैराग्राफ',
  urdu: 'पैराग्राफ', // Devanagari - will be transliterated to Nastaliq
};

export const OF_LABEL = {
  kannada: 'ರ',
  telugu: 'లో',
  malayalam: 'ൽ',
  tamil: 'இல்',
  english: 'of',
  hindi: 'में से',
  urdu: 'में से', // Devanagari - will be transliterated to Nastaliq
};

// Activity history labels
export const REOPEN_ACTIVITY_LABELS = {
  kannada: 'ಚಟುವಟಿಕೆಯನ್ನು ಮರುಪ್ರಾರಂಭಿಸಿ',
  telugu: 'కార్యాచరణను తిరిగి తెరవండి',
  malayalam: 'പ്രവർത്തനം വീണ്ടും തുറക്കുക',
  tamil: 'செயல்பாட்டை மீண்டும் திறக்கவும்',
  english: 'Reopen Activity',
  hindi: 'गतिविधि फिर से खोलें',
  urdu: 'गतिविधि दोबारा खोलें', // Devanagari - will be transliterated to Nastaliq
};

export const PLAY_PARAGRAPH_LABELS = {
  kannada: 'ಪ್ಯಾರಾಗ್ರಾಫ್ ಪ್ಲೇ ಮಾಡಿ',
  telugu: 'పేరా ప్లే చేయండి',
  malayalam: 'ഖണ്ഡിക പ്ലേ ചെയ്യുക',
  tamil: 'பத்தியை இயக்கவும்',
  english: 'Play Paragraph',
  hindi: 'पैराग्राफ चलाएं',
  urdu: 'पैराग्राफ चलाएं', // Devanagari - will be transliterated to Nastaliq
};

export const PAUSE_LABELS = {
  kannada: 'ವಿರಾಮ',
  telugu: 'పాజ్',
  malayalam: 'താൽക്കാലികമായി നിർത്തുക',
  tamil: 'இடைநிறுத்தம்',
  english: 'Pause',
  hindi: 'रोकें',
  urdu: 'रोकें', // Devanagari - will be transliterated to Nastaliq
};

export const PLAY_LABELS = {
  kannada: 'ಪ್ಲೇ ಮಾಡಿ',
  telugu: 'ప్ಲే చేయండి',
  malayalam: 'പ്ലേ ചെയ്യുക',
  tamil: 'இயక்கவும்',
  english: 'Play',
  hindi: 'चलाएं',
  urdu: 'चलाएं', // Devanagari - will be transliterated to Nastaliq
};

// Activity type header labels
export const READING_HEADER_LABELS = {
  kannada: 'ಓದುವಿಕೆ',
  telugu: 'చదవడం',
  malayalam: 'വായന',
  tamil: 'படித்தல்',
  english: 'Reading',
  hindi: 'पढ़ना',
  urdu: 'पढ़ना', // Devanagari - will be transliterated to Nastaliq
};

export const LISTENING_HEADER_LABELS = {
  kannada: 'ಆಲಿಸುವಿಕೆ',
  telugu: 'వినడం',
  malayalam: 'കേൾക്കൽ',
  tamil: 'கேட்டல்',
  english: 'Listening',
  hindi: 'सुनना',
  urdu: 'सुनना', // Devanagari - will be transliterated to Nastaliq
};

export const WRITING_HEADER_LABELS = {
  kannada: 'ಬರವಣಿಗೆ',
  telugu: 'రాయడం',
  malayalam: 'എഴുത്ത്',
  tamil: 'எழுதுதல்',
  english: 'Writing',
  hindi: 'लिखना',
  urdu: 'लिखना', // Devanagari - will be transliterated to Nastaliq
};

export const SPEAKING_HEADER_LABELS = {
  kannada: 'ಮಾತನಾಡುವಿಕೆ',
  telugu: 'మాట్లాడటం',
  malayalam: 'സംസാരം',
  tamil: 'பேசுதல்',
  english: 'Speaking',
  hindi: 'बोलना',
  urdu: 'बोलना', // Devanagari - will be transliterated to Nastaliq
};

export const CONVERSATION_HEADER_LABELS = {
  kannada: 'ಸಂಭಾಷಣೆ',
  telugu: 'సంభాషణ',
  malayalam: 'സംഭാഷണം',
  tamil: 'உரையாடல்',
  english: 'Conversation',
  hindi: 'बातचीत',
  urdu: 'बातचीत', // Devanagari - will be transliterated to Nastaliq
};

// Activity history specific labels
export const WRITING_PROMPT_LABEL = {
  kannada: 'ಬರವಣಿಗೆ ಪ್ರಾಂಪ್ಟ್:',
  telugu: 'రాత ప్రాంప్ట్:',
  malayalam: 'എഴുത്ത് പ്രോംപ്റ്റ്:',
  tamil: 'எழுத்து தூண்டல்:',
  english: 'Writing Prompt:',
  hindi: 'लेखन प्रॉम्प्ट:',
  urdu: 'लेखन प्रॉम्प्ट:', // Devanagari - will be transliterated to Nastaliq
};

export const REQUIRED_WORDS_TITLE_LABEL = {
  kannada: 'ಅವಶ್ಯಕ ಪದಗಳು:',
  telugu: 'అవసరమైన పదాలు:',
  malayalam: 'ആവശ്യമായ വാക്കുകൾ:',
  tamil: 'தேவையான சொற்கள்:',
  english: 'Required Words:',
  hindi: 'आवश्यक शब्द:',
  urdu: 'आवश्यक शब्द:', // Devanagari - will be transliterated to Nastaliq
};

// Writing activity labels
export const WRITING_EXERCISE_LABELS = {
  kannada: 'ಬರವಣಿಗೆ ಅಭ್ಯಾಸ',
  telugu: 'రాత వ్యాయామం',
  malayalam: 'എഴുത്ത് വ്യായാമം',
  tamil: 'எழுத்து பயிற்சி',
  english: 'Writing Exercise',
  hindi: 'लेखन अभ्यास',
  urdu: 'लेखन अभ्यास', // Devanagari - will be transliterated to Nastaliq
};

export const REQUIRED_WORDS_LABELS = {
  kannada: 'ಈ ಪದಗಳನ್ನು ಬಳಸಬೇಕು:',
  telugu: 'ఈ పదాలను ఉపయోగించాలి:',
  malayalam: 'ഈ വാക്കുകൾ ഉപയോഗിക്കണം:',
  tamil: 'இந்த வார்த்தைகளைப் பயன்படுத்த வேண்டும்:',
  english: 'You must use these words:',
  hindi: 'आपको ये शब्द उपयोग करने होंगे:',
  urdu: 'आपको ये शब्द इस्तेमाल करने होंगे:', // Devanagari - will be transliterated to Nastaliq
};

export const RUBRIC_TITLE_LABELS = {
  kannada: 'ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು',
  telugu: 'మూల్యాంకన ప్రమాణాలు',
  malayalam: 'മൂല്യനിർണ്ണയ മാനദണ്ഡങ്ങൾ',
  tamil: 'மதிப்பீட்டு அளவுகோல்கள்',
  english: 'Evaluation Criteria',
  hindi: 'मूल्यांकन मानदंड',
  urdu: 'मूल्यांकन मानदंड', // Devanagari - will be transliterated to Nastaliq
};

export const WRITE_ANSWER_PLACEHOLDER_LABELS = {
  kannada: 'ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಇಲ್ಲಿ ಬರೆಯಿರಿ (2-3 ಪ್ಯಾರಾಗ್ರಾಫ್‌ಗಳು)...',
  telugu: 'మీ సమాధానాన్ని ఇక్కడ వ్రాయండి (2-3 పేరాలు)...',
  malayalam: 'നിങ്ങളുടെ ഉത്തരം ഇവിടെ എഴുതുക (2-3 ഖണ്ഡികകൾ)...',
  tamil: 'உங்கள் பதிலை இங்கே எழுதுங்கள் (2-3 பத்திகள்)...',
  english: 'Write your answer here (2-3 paragraphs)...',
  hindi: 'अपना उत्तर यहाँ लिखें (2-3 पैराग्राफ)...',
  urdu: 'अपना जवाब यहाँ लिखें (2-3 पैराग्राफ)...', // Devanagari - will be transliterated to Nastaliq
};

export const SUBMIT_FOR_GRADING_LABELS = {
  kannada: 'ಗ್ರೇಡಿಂಗ್‌ಗಾಗಿ ಸಲ್ಲಿಸಿ',
  telugu: 'గ్రేడింగ్ కోసం సమర్పించండి',
  malayalam: 'ഗ്രേഡിംഗിനായി സമർപ്പിക്കുക',
  tamil: 'தரப்படுத்தலுக்காக சமர்ப்பிக்கவும்',
  english: 'Submit for Grading',
  hindi: 'ग्रेडिंग के लिए जमा करें',
  urdu: 'ग्रेडिंग के लिए जमा करें', // Devanagari - will be transliterated to Nastaliq
};

export const GRADING_PROGRESS_LABELS = {
  kannada: 'ನಿಮ್ಮ ಬರವಣಿಗೆಯನ್ನು ಗ್ರೇಡಿಂಗ್ ಮಾಡಲಾಗುತ್ತಿದೆ... ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ',
  telugu: 'మీ రచనను గ్రేడింగ్ చేస్తున్నాము... దయచేసి వేచి ఉండండి',
  malayalam: 'നിങ്ങളുടെ എഴുത്ത് ഗ്രേഡ് ചെയ്യുന്നു... ദയവായി കാത്തിരിക്കുക',
  tamil: 'உங்கள் எழுத்தை தரப்படுத்துகிறோம்... தயவுசெய்து காத்திருக்கவும்',
  english: 'Grading your writing... Please wait',
  hindi: 'आपके लेखन को ग्रेड किया जा रहा है... कृपया प्रतीक्षा करें',
  urdu: 'आपके लेखन को ग्रेड किया जा रहा है... कृपया इंतज़ार करें', // Devanagari - will be transliterated to Nastaliq
};

export const SUBMISSIONS_FEEDBACK_LABELS = {
  kannada: 'ಸಲ್ಲಿಕೆಗಳು ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆಗಳು',
  telugu: 'సమర్పణలు మరియు అభిప్రాయాలు',
  malayalam: 'സമർപ്പിക്കലുകളും പ്രതികരണങ്ങളും',
  tamil: 'சமர்ப்பிப்புகள் மற்றும் கருத்துக்கள்',
  english: 'Submissions and Feedback',
  hindi: 'सबमिशन और फीडबैक',
  urdu: 'सबमिशन और फीडबैक', // Devanagari - will be transliterated to Nastaliq
};

export const SUBMISSION_NUMBER_LABELS = {
  kannada: 'ಸಲ್ಲಿಕೆ',
  telugu: 'సమర్పణ',
  malayalam: 'സമർപ്പണം',
  tamil: 'சமர்ப்பிப்பு',
  english: 'Submission',
  hindi: 'सबमिशन',
  urdu: 'सबमिशन', // Devanagari - will be transliterated to Nastaliq
};

export const YOUR_WRITING_LABELS = {
  kannada: 'ನಿಮ್ಮ ಬರವಣಿಗೆ:',
  telugu: 'మీ రచన:',
  malayalam: 'നിങ്ങളുടെ എഴുത്ത്:',
  tamil: 'உங்கள் எழுத்து:',
  english: 'Your Writing:',
  hindi: 'आपका लेखन:',
  urdu: 'आपका लेखन:', // Devanagari - will be transliterated to Nastaliq
};

export const OVERALL_SCORE_LABELS = {
  kannada: 'ಒಟ್ಟು ಅಂಕ:',
  telugu: 'మొత్తం స్కోరు:',
  malayalam: 'മൊത്തം സ്കോർ:',
  tamil: 'மொத்த மதிப்பெண்:',
  english: 'Overall Score:',
  hindi: 'कुल स्कोर:',
  urdu: 'कुल स्कोर:', // Devanagari - will be transliterated to Nastaliq
};

export const VOCABULARY_SCORE_LABELS = {
  kannada: 'ಶಬ್ದಕೋಶ:',
  telugu: 'పదకోశం:',
  malayalam: 'പദാവലി:',
  tamil: 'சொற்களஞ்சியம்:',
  english: 'Vocabulary:',
  hindi: 'शब्दावली:',
  urdu: 'शब्दावली:', // Devanagari - will be transliterated to Nastaliq
};

export const GRAMMAR_SCORE_LABELS = {
  kannada: 'ವ್ಯಾಕರಣ:',
  telugu: 'వ్యాకరణం:',
  malayalam: 'വ്യാകരണം:',
  tamil: 'இலக்கணம்:',
  english: 'Grammar:',
  hindi: 'व्याकरण:',
  urdu: 'व्याकरण:', // Devanagari - will be transliterated to Nastaliq
};

export const COHERENCE_SCORE_LABELS = {
  kannada: 'ಸುಸಂಗತತೆ:',
  telugu: 'సంకల్పం:',
  malayalam: 'യോജിപ്പ്:',
  tamil: 'ஒத்திசைவு:',
  english: 'Coherence:',
  hindi: 'सुसंगतता:',
  urdu: 'सुसंगतता:', // Devanagari - will be transliterated to Nastaliq
};

export const DETAILED_FEEDBACK_LABELS = {
  kannada: 'ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆ:',
  telugu: 'వివరణాత్మక అభిప్రాయం:',
  malayalam: 'വിശദമായ പ്രതികരണം:',
  tamil: 'விரிவான கருத்து:',
  english: 'Detailed Feedback:',
  hindi: 'विस्तृत फीडबैक:',
  urdu: 'विस्तृत फीडबैक:', // Devanagari - will be transliterated to Nastaliq
};

export const WORD_USAGE_FEEDBACK_LABELS = {
  kannada: 'ಪದ ಬಳಕೆ ಪ್ರತಿಕ್ರಿಯೆ:',
  telugu: 'పద వినియోగ అభిప్రాయం:',
  malayalam: 'വാക്ക് ഉപയോഗ പ്രതികരണം:',
  tamil: 'சொல் பயன்பாடு கருத்து:',
  english: 'Word Usage Feedback:',
  hindi: 'शब्द उपयोग फीडबैक:',
  urdu: 'शब्द उपयोग फीडबैक:', // Devanagari - will be transliterated to Nastaliq
};

// Speaking Activity Labels
export const SPEAKING_PRACTICE_LABELS = {
  kannada: 'ಭಾಷಣ ಅಭ್ಯಾಸ',
  telugu: 'ప్రసంగ అభ్యాసం',
  malayalam: 'സംസാര പരിശീലനം',
  tamil: 'பேச்சு பயிற்சி',
  english: 'Speaking Practice',
  hindi: 'बोलने का अभ्यास',
  urdu: 'बोलने का अभ्यास', // Devanagari - will be transliterated to Nastaliq
};

export const INPUT_METHOD_LABELS = {
  kannada: 'ಇನ್ಪುಟ್ ವಿಧಾನ:',
  telugu: 'ఇన్‌పుట్ పద్ధతి:',
  malayalam: 'ഇൻപുട്ട് രീതി:',
  tamil: 'உள்ளீட்டு முறை:',
  english: 'Input Method:',
  hindi: 'इनपुट विधि:',
  urdu: 'इनपुट विधि:', // Devanagari - will be transliterated to Nastaliq
};

export const TEXT_INPUT_MODE_LABELS = {
  kannada: 'ಪಠ್ಯ',
  telugu: 'వచనం',
  malayalam: 'വാചകം',
  tamil: 'உரை',
  english: 'Text',
  hindi: 'पाठ',
  urdu: 'पाठ', // Devanagari - will be transliterated to Nastaliq
};

export const AUDIO_INPUT_MODE_LABELS = {
  kannada: 'ಆಡಿಯೋ',
  telugu: 'ఆడియో',
  malayalam: 'ഓഡിയോ',
  tamil: 'ஆடியோ',
  english: 'Audio',
  hindi: 'ऑडियो',
  urdu: 'ऑडियो', // Devanagari - will be transliterated to Nastaliq
};

export const TASKS_TITLE_LABELS = {
  kannada: 'ಕಾರ್ಯಗಳು',
  telugu: 'పనులు',
  malayalam: 'ടാസ്ക്കുകൾ',
  tamil: 'பணிகள்',
  english: 'Tasks',
  hindi: 'कार्य',
  urdu: 'कार्य', // Devanagari - will be transliterated to Nastaliq
};

export const START_RECORDING_LABELS = {
  kannada: 'ರೆಕಾರ್ಡಿಂಗ್ ಪ್ರಾರಂಭಿಸಿ',
  telugu: 'రికార్డింగ్ ప్రారంభించండి',
  malayalam: 'റെക്കോർഡിംഗ് ആരംഭിക്കുക',
  tamil: 'பதிவு தொடங்கவும்',
  english: 'Start Recording',
  hindi: 'रिकॉर्डिंग शुरू करें',
  urdu: 'रिकॉर्डिंग शुरू करें', // Devanagari - will be transliterated to Nastaliq
};

export const STOP_RECORDING_LABELS = {
  kannada: 'ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಿ',
  telugu: 'రికార్డింగ్ ఆపండి',
  malayalam: 'റെക്കോർഡിംഗ് നിർത്തുക',
  tamil: 'பதிவு நிறுத்தவும்',
  english: 'Stop Recording',
  hindi: 'रिकॉर्डिंग बंद करें',
  urdu: 'रिकॉर्डिंग बंद करें', // Devanagari - will be transliterated to Nastaliq
};

export const PROCESSING_AUDIO_LABELS = {
  kannada: 'ಆಡಿಯೋ ಪ್ರಕ್ರಿಯಗೊಳಿಸಲಾಗುತ್ತಿದೆ...',
  telugu: 'ఆడియో ప్రాసెస్ చేయబడుతోంది...',
  malayalam: 'ഓഡിയോ പ്രോസസ്സിംഗ്...',
  tamil: 'ஆடியோ செயலாக்கப்படுகிறது...',
  english: 'Processing audio...',
  hindi: 'ऑडियो प्रोसेस हो रहा है...',
  urdu: 'ऑडियो प्रोसेस हो रहा है...', // Devanagari - will be transliterated to Nastaliq
};

export const YOUR_RECORDING_LABELS = {
  kannada: 'ನಿಮ್ಮ ರೆಕಾರ್ಡಿಂಗ್',
  telugu: 'మీ రికార్డింగ్',
  malayalam: 'നിങ്ങളുടെ റെക്കോർഡിംഗ്',
  tamil: 'உங்கள் பதிவு',
  english: 'Your Recording',
  hindi: 'आपकी रिकॉर्डिंग',
  urdu: 'आपकी रिकॉर्डिंग', // Devanagari - will be transliterated to Nastaliq
};

export const RECORD_AGAIN_LABELS = {
  kannada: 'ಮತ್ತೆ ರೆಕಾರ್ಡ್ ಮಾಡಿ',
  telugu: 'మళ్లీ రికార్డ్ చేయండి',
  malayalam: 'വീണ്ടും റെക്കോർഡ് ചെയ്യുക',
  tamil: 'மீண்டும் பதிவு செய்யவும்',
  english: 'Record Again',
  hindi: 'फिर से रिकॉर्ड करें',
  urdu: 'फिर से रिकॉर्ड करें', // Devanagari - will be transliterated to Nastaliq
};

export const TRANSCRIPT_LABEL = {
  kannada: 'ಪಠ್ಯ:',
  telugu: 'లిఖితం:',
  malayalam: 'വാചകം:',
  tamil: 'படியெடுப்பு:',
  english: 'Transcript:',
  hindi: 'प्रतिलेख:',
  urdu: 'प्रतिलेख:', // Devanagari - will be transliterated to Nastaliq
};

export const FLUENCY_SCORE_LABELS = {
  kannada: 'ನಿರರ್ಗಳತೆ:',
  telugu: 'సులభత్వం:',
  malayalam: 'ഒഴുക്ക്:',
  tamil: 'சரளம்:',
  english: 'Fluency:',
  hindi: 'प्रवाह:',
  urdu: 'प्रवाह:', // Devanagari - will be transliterated to Nastaliq
};

export const TASK_COMPLETION_SCORE_LABELS = {
  kannada: 'ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ:',
  telugu: 'పని పూర్తి:',
  malayalam: 'ടാസ്ക് പൂർത്തീകരണം:',
  tamil: 'பணி நிறைவு:',
  english: 'Task Completion:',
  hindi: 'कार्य पूर्णता:',
  urdu: 'कार्य पूर्णता:', // Devanagari - will be transliterated to Nastaliq
};

export const TYPE_RESPONSE_PLACEHOLDER_LABELS = {
  kannada: 'ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಇಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ...',
  telugu: 'మీ ప్రతిస్పందనను ఇక్కడ టైప్ చేయండి...',
  malayalam: 'നിങ്ങളുടെ പ്രതികരണം ഇവിടെ ടൈപ്പ് ചെയ്യുക...',
  tamil: 'உங்கள் பதிலை இங்கே தட்டச்சு செய்யவும்...',
  english: 'Type your response here...',
  hindi: 'अपना जवाब यहाँ टाइप करें...',
  urdu: 'अपना जवाब यहाँ टाइप करें...', // Devanagari - will be transliterated to Nastaliq
};

export const GRADING_SPEECH_WAIT_LABELS = {
  kannada: 'ನಿಮ್ಮ ಭಾಷಣವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ... ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ',
  telugu: 'మీ ప్రసంగం గ్రేడింగ్ చేయబడుతోంది... దయచేసి వేచి ఉండండి',
  malayalam: 'നിങ്ങളുടെ പ്രസംഗം ഗ്രേഡ് ചെയ്യുന്നു... ദയവായി കാത്തിരിക്കുക',
  tamil: 'உங்கள் பேச்சு மதிப்பிடப்படுகிறது... தயவுசெய்து காத்திருக்கவும்',
  english: 'Grading your speech... Please wait',
  hindi: 'आपके भाषण का मूल्यांकन किया जा रहा है... कृपया प्रतीक्षा करें',
  urdu: 'आपके भाषण का मूल्यांकन किया जा रहा है... कृपया प्रतीक्षा करें', // Devanagari - will be transliterated to Nastaliq
};

export const TOPIC_LABELS = {
  kannada: 'ವಿಷಯ:',
  telugu: 'విషయం:',
  malayalam: 'വിഷയം:',
  tamil: 'தலைப்பு:',
  english: 'Topic:',
  hindi: 'विषय:',
  urdu: 'विषय:', // Devanagari - will be transliterated to Nastaliq
};

export const INSTRUCTIONS_LABELS = {
  kannada: 'ಸೂಚನೆಗಳು:',
  telugu: 'సూచనలు:',
  malayalam: 'നിർദ്ദേശങ്ങൾ:',
  tamil: 'அறிவுறுத்தல்கள்:',
  english: 'Instructions:',
  hindi: 'निर्देश:',
  urdu: 'निर्देश:', // Devanagari - will be transliterated to Nastaliq
};

export const SENTENCES_LABELS = {
  kannada: 'ವಾಕ್ಯಗಳು',
  telugu: 'వాక్యాలు',
  malayalam: 'വാക്യങ്ങൾ',
  tamil: 'வாக்கியங்கள்',
  english: 'Sentences',
  hindi: 'वाक्य',
  urdu: 'वाक्य', // Devanagari - will be transliterated to Nastaliq
};

export const SENTENCE_LABELS = {
  kannada: 'ವಾಕ್ಯ',
  telugu: 'వాక్యం',
  malayalam: 'വാക്യം',
  tamil: 'வாக்கியம்',
  english: 'Sentence',
  hindi: 'वाक्य',
  urdu: 'वाक्य', // Devanagari - will be transliterated to Nastaliq
};

export const SOURCE_TEXT_LABELS = {
  kannada: 'ಮೂಲ ಪಠ್ಯ:',
  telugu: 'మూల వచనం:',
  malayalam: 'ഉറവിട വാചകം:',
  tamil: 'மூல உரை:',
  english: 'Source Text:',
  hindi: 'स्रोत पाठ:',
  urdu: 'स्रोत पाठ:', // Devanagari - will be transliterated to Nastaliq
};

export const EXPECTED_TRANSLATION_LABELS = {
  kannada: 'ನಿರೀಕ್ಷಿತ ಅನುವಾದ:',
  telugu: 'ఆశించిన అనువాదం:',
  malayalam: 'പ്രതീക്ഷിക്കുന്ന വിവർത്തനം:',
  tamil: 'எதிர்பார்க்கப்படும் மொழிபெயர்ப்பு:',
  english: 'Expected Translation:',
  hindi: 'अपेक्षित अनुवाद:',
  urdu: 'अपेक्षित अनुवाद:', // Devanagari - will be transliterated to Nastaliq
};

export const TRANSLATION_ACTIVITY_LABELS = {
  kannada: 'ಅನುವಾದ',
  telugu: 'అనువాదం',
  malayalam: 'വിവർത്തനം',
  tamil: 'மொழிபெயர்ப்பு',
  english: 'Translation',
  hindi: 'अनुवाद',
  urdu: 'अनुवाद', // Devanagari - will be transliterated to Nastaliq
};

export const PROGRESS_TITLE_LABELS = {
  kannada: 'ಪ್ರಗತಿ',
  telugu: 'పురోగతి',
  malayalam: 'പുരോഗതി',
  tamil: 'முன்னேற்றம்',
  english: 'Progress',
  hindi: 'प्रगति',
  urdu: 'प्रगति', // Devanagari - will be transliterated to Nastaliq
};

export const SENTENCE_NUMBER_LABELS = {
  kannada: 'ವಾಕ್ಯ',
  telugu: 'వాక్యం',
  malayalam: 'വാക്യം',
  tamil: 'வாக்கியம்',
  english: 'Sentence',
  hindi: 'वाक्य',
  urdu: 'वाक्य', // Devanagari - will be transliterated to Nastaliq
};

export const TRANSLATE_THIS_LABELS = {
  kannada: 'ಇದನ್ನು ಅನುವಾದಿಸಿ:',
  telugu: 'దీన్ని అనువదించండి:',
  malayalam: 'ഇത് വിവർത്തനം ചെയ്യുക:',
  tamil: 'இதை மொழிபெயர்க்கவும்:',
  english: 'Translate this:',
  hindi: 'इसका अनुवाद करें:',
  urdu: 'इसका अनुवाद करें:', // Devanagari - will be transliterated to Nastaliq
};

export const YOUR_TRANSLATION_LABELS = {
  kannada: 'ನಿಮ್ಮ ಅನುವಾದ',
  telugu: 'మీ అనువాదం',
  malayalam: 'നിങ്ങളുടെ വിവർത്തനം',
  tamil: 'உங்கள் மொழிபெயர்ப்பு',
  english: 'Your translation',
  hindi: 'आपका अनुवाद',
  urdu: 'आपका अनुवाद', // Devanagari - will be transliterated to Nastaliq
};

export const TYPE_TRANSLATION_PLACEHOLDER_LABELS = {
  kannada: 'ಕನ್ನಡದಲ್ಲಿ ನಿಮ್ಮ ಅನುವಾದವನ್ನು ಟೈಪ್ ಮಾಡಿ...',
  telugu: 'తెలుగులో మీ అనువాదాన్ని టైప్ చేయండి...',
  malayalam: 'മലയാളത്തിൽ നിങ്ങളുടെ വിവർത്തനം ടൈപ്പ് ചെയ്യുക...',
  tamil: 'தமிழில் உங்கள் மொழிபெயர்ப்பை தட்டச்சு செய்யவும்...',
  english: 'Type your translation in english...',
  hindi: 'हिंदी में अपना अनुवाद टाइप करें...',
  urdu: 'हिंदी में अपना अनुवाद टाइप करें...', // Devanagari - will be transliterated to Nastaliq
};

export const PREVIOUS_BUTTON_LABELS = {
  kannada: 'ಹಿಂದಿನದು',
  telugu: 'మునుపటి',
  malayalam: 'മുമ്പത്തെ',
  tamil: 'முந்தைய',
  english: 'Previous',
  hindi: 'पिछला',
  urdu: 'पिछला', // Devanagari - will be transliterated to Nastaliq
};

export const NEXT_BUTTON_LABELS = {
  kannada: 'ಮುಂದೆ',
  telugu: 'తదుపరి',
  malayalam: 'അടുത്തത്',
  tamil: 'அடுத்தது',
  english: 'Next',
  hindi: 'अगला',
  urdu: 'अगला', // Devanagari - will be transliterated to Nastaliq
};

export const ALL_SENTENCES_LABELS = {
  kannada: 'ಎಲ್ಲಾ ವಾಕ್ಯಗಳು',
  telugu: 'అన్ని వాక్యాలు',
  malayalam: 'എല്ലാ വാക്യങ്ങളും',
  tamil: 'அனைத்து வாக்கியங்கள்',
  english: 'All Sentences',
  hindi: 'सभी वाक्य',
  urdu: 'सभी वाक्य', // Devanagari - will be transliterated to Nastaliq
};

export const GRADING_BUTTON_LABELS = {
  kannada: 'ಗ್ರೇಡಿಂಗ್...',
  telugu: 'గ్రేడింగ్...',
  malayalam: 'ഗ്രേഡിംഗ്...',
  tamil: 'தரநிலை...',
  english: 'Grading...',
  hindi: 'ग्रेडिंग...',
  urdu: 'ग्रेडिंग...', // Devanagari - will be transliterated to Nastaliq
};

export const RESULTS_LABELS = {
  kannada: 'ಫಲಿತಾಂಶಗಳು',
  telugu: 'ఫలితాలు',
  malayalam: 'ഫലങ്ങൾ',
  tamil: 'முடிவுகள்',
  english: 'Results',
  hindi: 'परिणाम',
  urdu: 'परिणाम', // Devanagari - will be transliterated to Nastaliq
};

export const COMPLETE_ACTIVITY_LABELS = {
  kannada: 'ಚಟುವಟಿಕೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ',
  telugu: 'కార్యాచరణను పూర్తి చేయండి',
  malayalam: 'പ്രവർത്തനം പൂർത്തിയാക്കുക',
  tamil: 'செயல்பாட்டை முடிக்கவும்',
  english: 'Complete Activity',
  hindi: 'गतिविधि पूर्ण करें',
  urdu: 'गतिविधि पूर्ण करें', // Devanagari - will be transliterated to Nastaliq
};

export const SENTENCE_ANALYSIS_LABELS = {
  kannada: 'ವಾಕ್ಯ ವಿಶ್ಲೇಷಣೆ',
  telugu: 'వాక్య విశ్లేషణ',
  malayalam: 'വാക്യ വിശകലനം',
  tamil: 'வாக்கிய பகுப்பாய்வு',
  english: 'Sentence Analysis',
  hindi: 'वाक्य विश्लेषण',
  urdu: 'वाक्य विश्लेषण', // Devanagari - will be transliterated to Nastaliq
};

export const SOURCE_LABEL = {
  kannada: 'ಮೂಲ',
  telugu: 'మూలం',
  malayalam: 'ഉറവിടം',
  tamil: 'மூலம்',
  english: 'Source',
  hindi: 'स्रोत',
  urdu: 'स्रोत', // Devanagari - will be transliterated to Nastaliq
};

export const YOUR_TRANSLATION_LABEL = {
  kannada: 'ನಿಮ್ಮ ಅನುವಾದ',
  telugu: 'మీ అనువాదం',
  malayalam: 'നിങ്ങളുടെ വിവർത്തനം',
  tamil: 'உங்கள் மொழிபெயர்ப்பு',
  english: 'Your Translation',
  hindi: 'आपका अनुवाद',
  urdu: 'आपका अनुवाद', // Devanagari - will be transliterated to Nastaliq
};

export const EXPECTED_LABEL = {
  kannada: 'ನಿರೀಕ್ಷಿತ',
  telugu: 'ఆశించిన',
  malayalam: 'പ്രതീക്ഷിക്കുന്ന',
  tamil: 'எதிர்பார்க்கப்படும்',
  english: 'Expected',
  hindi: 'अपेक्षित',
  urdu: 'अपेक्षित', // Devanagari - will be transliterated to Nastaliq
};

export const FEEDBACK_LABEL = {
  kannada: 'ಪ್ರತಿಕ್ರಿಯೆ',
  telugu: 'అభిప్రాయం',
  malayalam: 'പ്രതികരണം',
  tamil: 'கருத்து',
  english: 'Feedback',
  hindi: 'प्रतिक्रिया',
  urdu: 'प्रतिक्रिया', // Devanagari - will be transliterated to Nastaliq
};


export const getSubmittingLabel = (language) => {
  try {
    const val = SUBMITTING_LABELS[language] || SUBMITTING_LABELS.english || 'Submitting...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Submitting...';
  }
};

export const getThinkingLabel = (language) => {
  try {
    const val = THINKING_LABELS[language] || THINKING_LABELS.english || 'Thinking...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Thinking...';
  }
};

export const getGeneratingAudioLabel = (language) => {
  try {
    const val = GENERATING_AUDIO_LABELS[language] || GENERATING_AUDIO_LABELS.english || 'Generating audio...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Generating audio...';
  }
};

export const getLiveModeTitleLabel = (language) => {
  try {
    const val = LIVE_MODE_TITLE_LABELS[language] || LIVE_MODE_TITLE_LABELS.english || 'Real-Time Live Mode';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Real-Time Live Mode';
  }
};

export const getLiveModeDescriptionLabel = (language) => {
  try {
    const val = LIVE_MODE_DESCRIPTION_LABELS[language] || LIVE_MODE_DESCRIPTION_LABELS.english || 'Direct audio streaming with instant AI responses';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Direct audio streaming with instant AI responses';
  }
};

export const getClassicModeDescriptionLabel = (language) => {
  try {
    const val = CLASSIC_MODE_DESCRIPTION_LABELS[language] || CLASSIC_MODE_DESCRIPTION_LABELS.english || 'Classic mode with speech-to-text transcription';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Classic mode with speech-to-text transcription';
  }
};

export const getSearchVocabularyLabel = (language) => {
  try {
    const val = SEARCH_VOCABULARY_LABELS[language] || SEARCH_VOCABULARY_LABELS.english || 'Search vocabulary...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Search vocabulary...';
  }
};

export const getSpeakerNameLabel = (language) => {
  try {
    const val = SPEAKER_NAME_LABELS[language] || SPEAKER_NAME_LABELS.english || 'Name:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Name:';
  }
};

export const getSpeakerGenderLabel = (language) => {
  try {
    const val = SPEAKER_GENDER_LABELS[language] || SPEAKER_GENDER_LABELS.english || 'Gender:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Gender:';
  }
};

export const getSpeakerAgeLabel = (language) => {
  try {
    const val = SPEAKER_AGE_LABELS[language] || SPEAKER_AGE_LABELS.english || 'Age:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Age:';
  }
};

export const getSpeakerCityLabel = (language) => {
  try {
    const val = SPEAKER_CITY_LABELS[language] || SPEAKER_CITY_LABELS.english || 'City:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'City:';
  }
};

export const getSpeakerStateLabel = (language) => {
  try {
    const val = SPEAKER_STATE_LABELS[language] || SPEAKER_STATE_LABELS.english || 'State:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'State:';
  }
};

export const getSpeakerCountryLabel = (language) => {
  try {
    const val = SPEAKER_COUNTRY_LABELS[language] || SPEAKER_COUNTRY_LABELS.english || 'Country:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Country:';
  }
};

export const getSpeakerDialectLabel = (language) => {
  try {
    const val = SPEAKER_DIALECT_LABELS[language] || SPEAKER_DIALECT_LABELS.english || 'Dialect:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Dialect:';
  }
};

export const getSpeakerBackgroundLabel = (language) => {
  try {
    const val = SPEAKER_BACKGROUND_LABELS[language] || SPEAKER_BACKGROUND_LABELS.english || 'Background:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Background:';
  }
};

export const getSpeakerFormalityLabel = (language) => {
  try {
    const val = SPEAKER_FORMALITY_LABELS[language] || SPEAKER_FORMALITY_LABELS.english || 'Formality:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Formality:';
  }
};

export const getSpeakerDetailsLabel = (language) => {
  try {
    const val = SPEAKER_DETAILS_LABELS[language] || SPEAKER_DETAILS_LABELS.english || 'Speaker Details';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Speaker Details';
  }
};

const START_CONVERSATION_LABELS = {
  kannada: 'ಸಂವಾದ ಪ್ರಾರಂಭಿಸಿ',
  telugu: 'సంభాషణ ప్రారంభించండి',
  malayalam: 'സംഭാഷണം ആരംഭിക്കുക',
  tamil: 'உரையாடலைத் தொடங்கவும்',
  english: 'Start Conversation',
  hindi: 'बातचीत शुरू करें',
  urdu: 'बातचीत शुरू करें',
};

export const getStartConversationLabel = (language) => {
  try {
    const val = START_CONVERSATION_LABELS[language] || START_CONVERSATION_LABELS.english || 'Start Conversation';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Start Conversation';
  }
};

const RESET_CONVERSATION_LABELS = {
  kannada: 'ಸಂವಾದ ಮರುಹೊಂದಿಸಿ',
  telugu: 'సంభాషణను రీసెట్ చేయండి',
  malayalam: 'സംഭാഷണം പുനഃസജ്ജമാക്കുക',
  tamil: 'உரையாடலை மீட்டமைக்கவும்',
  english: 'Reset Conversation',
  hindi: 'बातचीत रीसेट करें',
  urdu: 'बातचीत रीसेट करें',
};

export const getResetConversationLabel = (language) => {
  try {
    const val = RESET_CONVERSATION_LABELS[language] || RESET_CONVERSATION_LABELS.english || 'Reset Conversation';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Reset Conversation';
  }
};

const SPEAKER_PROFILE_LABELS = {
  kannada: 'ಮಾತನಾಡುವವರ ವಿವರ',
  telugu: 'మాట్లాడేవారి వివరాలు',
  malayalam: 'സംസാരിക്കുന്നയാളുടെ വിശദാംശങ്ങൾ',
  tamil: 'பேசுபவரின் விவரங்கள்',
  english: 'Speaker Profile',
  hindi: 'वक्ता का विवरण',
  urdu: 'वक्ता का विवरण',
};

export const getSpeakerProfileLabel = (language) => {
  try {
    const val = SPEAKER_PROFILE_LABELS[language] || SPEAKER_PROFILE_LABELS.english || 'Speaker Profile';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Speaker Profile';
  }
};

export const getShowTranscriptLabel = (language) => {
  try {
    const val = SHOW_TRANSCRIPT_LABELS[language] || SHOW_TRANSCRIPT_LABELS.english || 'Show Transcript';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Show Transcript';
  }
};

export const getHideTranscriptLabel = (language) => {
  try {
    const val = HIDE_TRANSCRIPT_LABELS[language] || HIDE_TRANSCRIPT_LABELS.english || 'Hide Transcript';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Hide Transcript';
  }
};

export const getShowAnswersLabel = (language) => {
  try {
    const val = SHOW_ANSWERS_LABELS[language] || SHOW_ANSWERS_LABELS.english || 'Show Answers';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Show Answers';
  }
};

export const getHideAnswersLabel = (language) => {
  try {
    const val = HIDE_ANSWERS_LABELS[language] || HIDE_ANSWERS_LABELS.english || 'Hide Answers';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Hide Answers';
  }
};

export const getListenToAllLabel = (language) => {
  try {
    const val = LISTEN_TO_ALL_LABELS[language] || LISTEN_TO_ALL_LABELS.english || 'Listen to All from Here';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Listen to All from Here';
  }
};

export const getStopAutoPlayLabel = (language) => {
  try {
    const val = STOP_AUTO_PLAY_LABELS[language] || STOP_AUTO_PLAY_LABELS.english || 'Stop Auto-Play';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Stop Auto-Play';
  }
};

export const getParagraphLabel = (language) => {
  try {
    const val = PARAGRAPH_LABEL[language] || PARAGRAPH_LABEL.english || 'Paragraph';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Paragraph';
  }
};

export const getOfLabel = (language) => {
  try {
    const val = OF_LABEL[language] || OF_LABEL.english || 'of';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'of';
  }
};

// Activity type header getters
export const getReadingHeaderLabel = (language) => {
  try {
    const val = READING_HEADER_LABELS[language] || READING_HEADER_LABELS.english || 'Reading';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Reading';
  }
};

export const getListeningHeaderLabel = (language) => {
  try {
    const val = LISTENING_HEADER_LABELS[language] || LISTENING_HEADER_LABELS.english || 'Listening';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Listening';
  }
};

export const getWritingHeaderLabel = (language) => {
  try {
    const val = WRITING_HEADER_LABELS[language] || WRITING_HEADER_LABELS.english || 'Writing';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Writing';
  }
};

export const getSpeakingHeaderLabel = (language) => {
  try {
    const val = SPEAKING_HEADER_LABELS[language] || SPEAKING_HEADER_LABELS.english || 'Speaking';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Speaking';
  }
};

export const getConversationHeaderLabel = (language) => {
  try {
    const val = CONVERSATION_HEADER_LABELS[language] || CONVERSATION_HEADER_LABELS.english || 'Conversation';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Conversation';
  }
};

export const getReopenActivityLabel = (language) => {
  try {
    const val = REOPEN_ACTIVITY_LABELS[language] || REOPEN_ACTIVITY_LABELS.english || 'Reopen Activity';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Reopen Activity';
  }
};

export const getPlayParagraphLabel = (language) => {
  try {
    const val = PLAY_PARAGRAPH_LABELS[language] || PLAY_PARAGRAPH_LABELS.english || 'Play Paragraph';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Play Paragraph';
  }
};

export const getPauseLabel = (language) => {
  try {
    const val = PAUSE_LABELS[language] || PAUSE_LABELS.english || 'Pause';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Pause';
  }
};

export const getPlayLabel = (language) => {
  try {
    const val = PLAY_LABELS[language] || PLAY_LABELS.english || 'Play';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Play';
  }
};

export const getWritingPromptLabel = (language) => {
  try {
    const val = WRITING_PROMPT_LABEL[language] || WRITING_PROMPT_LABEL.english || 'Writing Prompt:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Writing Prompt:';
  }
};

export const getRequiredWordsTitleLabel = (language) => {
  try {
    const val = REQUIRED_WORDS_TITLE_LABEL[language] || REQUIRED_WORDS_TITLE_LABEL.english || 'Required Words:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Required Words:';
  }
};

export const getWritingExerciseLabel = (language) => {
  try {
    const val = WRITING_EXERCISE_LABELS[language] || WRITING_EXERCISE_LABELS.english || 'Writing Exercise';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Writing Exercise';
  }
};

export const getRequiredWordsLabel = (language) => {
  try {
    const val = REQUIRED_WORDS_LABELS[language] || REQUIRED_WORDS_LABELS.english || 'You must use these words:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'You must use these words:';
  }
};

export const getRubricTitleLabel = (language) => {
  try {
    const val = RUBRIC_TITLE_LABELS[language] || RUBRIC_TITLE_LABELS.english || 'Evaluation Criteria';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Evaluation Criteria';
  }
};

export const getWriteAnswerPlaceholderLabel = (language) => {
  try {
    const val = WRITE_ANSWER_PLACEHOLDER_LABELS[language] || WRITE_ANSWER_PLACEHOLDER_LABELS.english || 'Write your answer here (2-3 paragraphs)...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Write your answer here (2-3 paragraphs)...';
  }
};

export const getSubmitForGradingLabel = (language) => {
  try {
    const val = SUBMIT_FOR_GRADING_LABELS[language] || SUBMIT_FOR_GRADING_LABELS.english || 'Submit for Grading';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Submit for Grading';
  }
};

export const getGradingProgressLabel = (language) => {
  try {
    const val = GRADING_PROGRESS_LABELS[language] || GRADING_PROGRESS_LABELS.english || 'Grading your writing... Please wait';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Grading your writing... Please wait';
  }
};

export const getSubmissionsFeedbackLabel = (language) => {
  try {
    const val = SUBMISSIONS_FEEDBACK_LABELS[language] || SUBMISSIONS_FEEDBACK_LABELS.english || 'Submissions and Feedback';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Submissions and Feedback';
  }
};

export const getSubmissionNumberLabel = (language) => {
  try {
    const val = SUBMISSION_NUMBER_LABELS[language] || SUBMISSION_NUMBER_LABELS.english || 'Submission';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Submission';
  }
};

export const getYourWritingLabel = (language) => {
  try {
    const val = YOUR_WRITING_LABELS[language] || YOUR_WRITING_LABELS.english || 'Your Writing:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Your Writing:';
  }
};

export const getOverallScoreLabel = (language) => {
  try {
    const val = OVERALL_SCORE_LABELS[language] || OVERALL_SCORE_LABELS.english || 'Overall Score:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Overall Score:';
  }
};

export const getVocabularyScoreLabel = (language) => {
  try {
    const val = VOCABULARY_SCORE_LABELS[language] || VOCABULARY_SCORE_LABELS.english || 'Vocabulary:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Vocabulary:';
  }
};

export const getGrammarScoreLabel = (language) => {
  try {
    const val = GRAMMAR_SCORE_LABELS[language] || GRAMMAR_SCORE_LABELS.english || 'Grammar:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Grammar:';
  }
};

export const getCoherenceScoreLabel = (language) => {
  try {
    const val = COHERENCE_SCORE_LABELS[language] || COHERENCE_SCORE_LABELS.english || 'Coherence:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Coherence:';
  }
};

export const getDetailedFeedbackLabel = (language) => {
  try {
    const val = DETAILED_FEEDBACK_LABELS[language] || DETAILED_FEEDBACK_LABELS.english || 'Detailed Feedback:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Detailed Feedback:';
  }
};

export const getWordUsageFeedbackLabel = (language) => {
  try {
    const val = WORD_USAGE_FEEDBACK_LABELS[language] || WORD_USAGE_FEEDBACK_LABELS.english || 'Word Usage Feedback:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Word Usage Feedback:';
  }
};

// Speaking Activity Labels
export const getSpeakingPracticeLabel = (language) => {
  try {
    const val = SPEAKING_PRACTICE_LABELS[language] || SPEAKING_PRACTICE_LABELS.english || 'Speaking Practice';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Speaking Practice';
  }
};

export const getInputMethodLabel = (language) => {
  try {
    const val = INPUT_METHOD_LABELS[language] || INPUT_METHOD_LABELS.english || 'Input Method:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Input Method:';
  }
};

export const getTextInputModeLabel = (language) => {
  try {
    const val = TEXT_INPUT_MODE_LABELS[language] || TEXT_INPUT_MODE_LABELS.english || 'Text';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Text';
  }
};

export const getAudioInputModeLabel = (language) => {
  try {
    const val = AUDIO_INPUT_MODE_LABELS[language] || AUDIO_INPUT_MODE_LABELS.english || 'Audio';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Audio';
  }
};

export const getTasksTitleLabel = (language) => {
  try {
    const val = TASKS_TITLE_LABELS[language] || TASKS_TITLE_LABELS.english || 'Tasks';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Tasks';
  }
};

export const getStartRecordingLabel = (language) => {
  try {
    const val = START_RECORDING_LABELS[language] || START_RECORDING_LABELS.english || 'Start Recording';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Start Recording';
  }
};

export const getStopRecordingLabel = (language) => {
  try {
    const val = STOP_RECORDING_LABELS[language] || STOP_RECORDING_LABELS.english || 'Stop Recording';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Stop Recording';
  }
};

export const getProcessingAudioLabel = (language) => {
  try {
    const val = PROCESSING_AUDIO_LABELS[language] || PROCESSING_AUDIO_LABELS.english || 'Processing audio...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Processing audio...';
  }
};

export const getYourRecordingLabel = (language) => {
  try {
    const val = YOUR_RECORDING_LABELS[language] || YOUR_RECORDING_LABELS.english || 'Your Recording';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Your Recording';
  }
};

export const getRecordAgainLabel = (language) => {
  try {
    const val = RECORD_AGAIN_LABELS[language] || RECORD_AGAIN_LABELS.english || 'Record Again';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Record Again';
  }
};

export const getTranscriptLabel = (language) => {
  try {
    const val = TRANSCRIPT_LABEL[language] || TRANSCRIPT_LABEL.english || 'Transcript:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Transcript:';
  }
};

export const getFluencyScoreLabel = (language) => {
  try {
    const val = FLUENCY_SCORE_LABELS[language] || FLUENCY_SCORE_LABELS.english || 'Fluency:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Fluency:';
  }
};

export const getTaskCompletionScoreLabel = (language) => {
  try {
    const val = TASK_COMPLETION_SCORE_LABELS[language] || TASK_COMPLETION_SCORE_LABELS.english || 'Task Completion:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Task Completion:';
  }
};

export const getTypeResponsePlaceholderLabel = (language) => {
  try {
    const val = TYPE_RESPONSE_PLACEHOLDER_LABELS[language] || TYPE_RESPONSE_PLACEHOLDER_LABELS.english || 'Type your response here...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Type your response here...';
  }
};

export const getGradingSpeechWaitLabel = (language) => {
  try {
    const val = GRADING_SPEECH_WAIT_LABELS[language] || GRADING_SPEECH_WAIT_LABELS.english || 'Grading your speech... Please wait';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Grading your speech... Please wait';
  }
};

export const getTopicLabel = (language) => {
  try {
    const val = TOPIC_LABELS[language] || TOPIC_LABELS.english || 'Topic:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Topic:';
  }
};

export const getInstructionsLabel = (language) => {
  try {
    const val = INSTRUCTIONS_LABELS[language] || INSTRUCTIONS_LABELS.english || 'Instructions:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Instructions:';
  }
};

export const getSentencesLabel = (language) => {
  try {
    const val = SENTENCES_LABELS[language] || SENTENCES_LABELS.english || 'Sentences';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Sentences';
  }
};

export const getSentenceLabel = (language) => {
  try {
    const val = SENTENCE_LABELS[language] || SENTENCE_LABELS.english || 'Sentence';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Sentence';
  }
};

export const getSourceTextLabel = (language) => {
  try {
    const val = SOURCE_TEXT_LABELS[language] || SOURCE_TEXT_LABELS.english || 'Source Text:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Source Text:';
  }
};

export const getExpectedTranslationLabel = (language) => {
  try {
    const val = EXPECTED_TRANSLATION_LABELS[language] || EXPECTED_TRANSLATION_LABELS.english || 'Expected Translation:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Expected Translation:';
  }
};

export const getProgressTitleLabel = (language) => {
  try {
    const val = PROGRESS_TITLE_LABELS[language] || PROGRESS_TITLE_LABELS.english || 'Progress';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Progress';
  }
};

export const getSentenceNumberLabel = (language) => {
  try {
    const val = SENTENCE_NUMBER_LABELS[language] || SENTENCE_NUMBER_LABELS.english || 'Sentence';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Sentence';
  }
};

export const getTranslateThisLabel = (language) => {
  try {
    const val = TRANSLATE_THIS_LABELS[language] || TRANSLATE_THIS_LABELS.english || 'Translate this:';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Translate this:';
  }
};

export const getYourTranslationLabel = (language) => {
  try {
    const val = YOUR_TRANSLATION_LABELS[language] || YOUR_TRANSLATION_LABELS.english || 'Your translation';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Your translation';
  }
};

export const getTypeTranslationPlaceholderLabel = (language) => {
  try {
    const val = TYPE_TRANSLATION_PLACEHOLDER_LABELS[language] || TYPE_TRANSLATION_PLACEHOLDER_LABELS.english || 'Type your translation...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Type your translation...';
  }
};

export const getTranslationActivityLabel = (language) => {
  try {
    const val = TRANSLATION_ACTIVITY_LABELS[language] || TRANSLATION_ACTIVITY_LABELS.english || 'Translation';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Translation';
  }
};

export const getPreviousButtonLabel = (language) => {
  try {
    const val = PREVIOUS_BUTTON_LABELS[language] || PREVIOUS_BUTTON_LABELS.english || 'Previous';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Previous';
  }
};

export const getNextButtonLabel = (language) => {
  try {
    const val = NEXT_BUTTON_LABELS[language] || NEXT_BUTTON_LABELS.english || 'Next';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Next';
  }
};

export const getAllSentencesLabel = (language) => {
  try {
    const val = ALL_SENTENCES_LABELS[language] || ALL_SENTENCES_LABELS.english || 'All Sentences';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'All Sentences';
  }
};

export const getGradingButtonLabel = (language) => {
  try {
    const val = GRADING_BUTTON_LABELS[language] || GRADING_BUTTON_LABELS.english || 'Grading...';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Grading...';
  }
};

export const getResultsLabel = (language) => {
  try {
    const val = RESULTS_LABELS[language] || RESULTS_LABELS.english || 'Results';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Results';
  }
};

export const getCompleteActivityLabel = (language) => {
  try {
    const val = COMPLETE_ACTIVITY_LABELS[language] || COMPLETE_ACTIVITY_LABELS.english || 'Complete Activity';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Complete Activity';
  }
};

export const getSentenceAnalysisLabel = (language) => {
  try {
    const val = SENTENCE_ANALYSIS_LABELS[language] || SENTENCE_ANALYSIS_LABELS.english || 'Sentence Analysis';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Sentence Analysis';
  }
};

export const getSourceLabel = (language) => {
  try {
    const val = SOURCE_LABEL[language] || SOURCE_LABEL.english || 'Source';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Source';
  }
};

export const getYourTranslationSingleLabel = (language) => {
  try {
    const val = YOUR_TRANSLATION_LABEL[language] || YOUR_TRANSLATION_LABEL.english || 'Your Translation';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Your Translation';
  }
};

export const getExpectedLabel = (language) => {
  try {
    const val = EXPECTED_LABEL[language] || EXPECTED_LABEL.english || 'Expected';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Expected';
  }
};

export const getFeedbackLabel = (language) => {
  try {
    const val = FEEDBACK_LABEL[language] || FEEDBACK_LABEL.english || 'Feedback';
    return typeof val === 'string' ? val : String(val);
  } catch (e) {
    return 'Feedback';
  }
};




// Helper to format paragraph label with transliteration support
// Returns: "Paragraph 1 of 4" (or localized equivalent)
export const formatParagraphLabel = (language, currentIndex, totalCount) => {
  const paragraph = getParagraphLabel(language);
  const of = getOfLabel(language);
  return `${paragraph} ${currentIndex + 1} ${of} ${totalCount}`;
};

// Helper to format play paragraph label
// Returns: "Play Paragraph 3" (or localized equivalent)
export const formatPlayParagraphLabel = (language, paragraphNumber) => {
  const playParagraph = getPlayParagraphLabel(language);
  return `${playParagraph} ${paragraphNumber}`;
};

// Safe getter which always returns a string for use in UI components.
export const getQuestionLabel = (language) => {
  try {
    const val = QUESTIONS_LABELS[language] || QUESTIONS_LABELS.kannada || '';
    if (val === null || typeof val === 'undefined') return '';
    if (typeof val === 'string') return val;
    // If it's an object/array, try to coerce to a readable string
    if (Array.isArray(val)) return val.filter(Boolean).join(' ');
    if (typeof val === 'object') {
      // Prefer common text keys if present
      if (val.text && typeof val.text === 'string') return val.text;
      if (val.label && typeof val.label === 'string') return val.label;
      try {
        return JSON.stringify(val);
      } catch (e) {
        return String(val);
      }
    }
    return String(val);
  } catch (e) {
    return '';
  }
};

export default {
  QUESTIONS_LABELS,
  getQuestionLabel,
  SUBMIT_LABELS,
  getSubmitLabel,
  SUBMITTING_LABELS,
  getSubmittingLabel,
  THINKING_LABELS,
  getThinkingLabel,
  GENERATING_AUDIO_LABELS,
  getGeneratingAudioLabel,
  LIVE_MODE_TITLE_LABELS,
  getLiveModeTitleLabel,
  LIVE_MODE_DESCRIPTION_LABELS,
  getLiveModeDescriptionLabel,
  CLASSIC_MODE_DESCRIPTION_LABELS,
  getClassicModeDescriptionLabel,
  SEARCH_VOCABULARY_LABELS,
  getSearchVocabularyLabel,
  SPEAKER_NAME_LABELS,
  getSpeakerNameLabel,
  SPEAKER_GENDER_LABELS,
  getSpeakerGenderLabel,
  SPEAKER_AGE_LABELS,
  getSpeakerAgeLabel,
  SPEAKER_CITY_LABELS,
  getSpeakerCityLabel,
  SPEAKER_STATE_LABELS,
  getSpeakerStateLabel,
  SPEAKER_COUNTRY_LABELS,
  getSpeakerCountryLabel,
  SPEAKER_DIALECT_LABELS,
  getSpeakerDialectLabel,
  SPEAKER_BACKGROUND_LABELS,
  getSpeakerBackgroundLabel,
  SPEAKER_FORMALITY_LABELS,
  getSpeakerFormalityLabel,
  SPEAKER_DETAILS_LABELS,
  getSpeakerDetailsLabel,
  SHOW_TRANSCRIPT_LABELS,
  getShowTranscriptLabel,
  HIDE_TRANSCRIPT_LABELS,
  getHideTranscriptLabel,
  SHOW_ANSWERS_LABELS,
  getShowAnswersLabel,
  HIDE_ANSWERS_LABELS,
  getHideAnswersLabel,
  LISTEN_TO_ALL_LABELS,
  getListenToAllLabel,
  STOP_AUTO_PLAY_LABELS,
  getStopAutoPlayLabel,
  PARAGRAPH_LABEL,
  getParagraphLabel,
  OF_LABEL,
  getOfLabel,
  formatParagraphLabel,
  READING_HEADER_LABELS,
  getReadingHeaderLabel,
  LISTENING_HEADER_LABELS,
  getListeningHeaderLabel,
  WRITING_HEADER_LABELS,
  getWritingHeaderLabel,
  SPEAKING_HEADER_LABELS,
  getSpeakingHeaderLabel,
  CONVERSATION_HEADER_LABELS,
  getConversationHeaderLabel,
  getStartConversationLabel,
  getResetConversationLabel,
  getSpeakerProfileLabel,
  REOPEN_ACTIVITY_LABELS,
  getReopenActivityLabel,
  PLAY_PARAGRAPH_LABELS,
  getPlayParagraphLabel,
  formatPlayParagraphLabel,
  PAUSE_LABELS,
  getPauseLabel,
  PLAY_LABELS,
  getPlayLabel,
  WRITING_PROMPT_LABEL,
  getWritingPromptLabel,
  REQUIRED_WORDS_TITLE_LABEL,
  getRequiredWordsTitleLabel,
  WRITING_EXERCISE_LABELS,
  getWritingExerciseLabel,
  REQUIRED_WORDS_LABELS,
  getRequiredWordsLabel,
  RUBRIC_TITLE_LABELS,
  getRubricTitleLabel,
  WRITE_ANSWER_PLACEHOLDER_LABELS,
  getWriteAnswerPlaceholderLabel,
  SUBMIT_FOR_GRADING_LABELS,
  getSubmitForGradingLabel,
  GRADING_PROGRESS_LABELS,
  getGradingProgressLabel,
  SUBMISSIONS_FEEDBACK_LABELS,
  getSubmissionsFeedbackLabel,
  SUBMISSION_NUMBER_LABELS,
  getSubmissionNumberLabel,
  YOUR_WRITING_LABELS,
  getYourWritingLabel,
  OVERALL_SCORE_LABELS,
  getOverallScoreLabel,
  VOCABULARY_SCORE_LABELS,
  getVocabularyScoreLabel,
  GRAMMAR_SCORE_LABELS,
  getGrammarScoreLabel,
  COHERENCE_SCORE_LABELS,
  getCoherenceScoreLabel,
  DETAILED_FEEDBACK_LABELS,
  getDetailedFeedbackLabel,
  WORD_USAGE_FEEDBACK_LABELS,
  getWordUsageFeedbackLabel,
  // Speaking Activity Labels
  SPEAKING_PRACTICE_LABELS,
  getSpeakingPracticeLabel,
  INPUT_METHOD_LABELS,
  getInputMethodLabel,
  TEXT_INPUT_MODE_LABELS,
  getTextInputModeLabel,
  AUDIO_INPUT_MODE_LABELS,
  getAudioInputModeLabel,
  TASKS_TITLE_LABELS,
  getTasksTitleLabel,
  START_RECORDING_LABELS,
  getStartRecordingLabel,
  STOP_RECORDING_LABELS,
  getStopRecordingLabel,
  PROCESSING_AUDIO_LABELS,
  getProcessingAudioLabel,
  YOUR_RECORDING_LABELS,
  getYourRecordingLabel,
  RECORD_AGAIN_LABELS,
  getRecordAgainLabel,
  TRANSCRIPT_LABEL,
  getTranscriptLabel,
  FLUENCY_SCORE_LABELS,
  getFluencyScoreLabel,
  TASK_COMPLETION_SCORE_LABELS,
  getTaskCompletionScoreLabel,
  TYPE_RESPONSE_PLACEHOLDER_LABELS,
  getTypeResponsePlaceholderLabel,
  GRADING_SPEECH_WAIT_LABELS,
  getGradingSpeechWaitLabel,
  TOPIC_LABELS,
  getTopicLabel,
  INSTRUCTIONS_LABELS,
  getInstructionsLabel,
  SENTENCES_LABELS,
  getSentencesLabel,
  SENTENCE_LABELS,
  getSentenceLabel,
  SOURCE_TEXT_LABELS,
  getSourceTextLabel,
  EXPECTED_TRANSLATION_LABELS,
  getExpectedTranslationLabel,
  PROGRESS_TITLE_LABELS,
  getProgressTitleLabel,
  TRANSLATION_ACTIVITY_LABELS,
  getTranslationActivityLabel,
  SENTENCE_NUMBER_LABELS,
  getSentenceNumberLabel,
  TRANSLATE_THIS_LABELS,
  getTranslateThisLabel,
  YOUR_TRANSLATION_LABELS,
  getYourTranslationLabel,
  TYPE_TRANSLATION_PLACEHOLDER_LABELS,
  getTypeTranslationPlaceholderLabel,
  PREVIOUS_BUTTON_LABELS,
  getPreviousButtonLabel,
  NEXT_BUTTON_LABELS,
  getNextButtonLabel,
  ALL_SENTENCES_LABELS,
  getAllSentencesLabel,
  GRADING_BUTTON_LABELS,
  getGradingButtonLabel,
  RESULTS_LABELS,
  getResultsLabel,
  COMPLETE_ACTIVITY_LABELS,
  getCompleteActivityLabel,
  SENTENCE_ANALYSIS_LABELS,
  getSentenceAnalysisLabel,
  SOURCE_LABEL,
  getSourceLabel,
  YOUR_TRANSLATION_LABEL,
  getYourTranslationSingleLabel,
  EXPECTED_LABEL,
  getExpectedLabel,
  FEEDBACK_LABEL,
  getFeedbackLabel,
};
