import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  ScrollView,
} from 'react-native';
import SafeText from '../components/SafeText';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { MASTERY_FILTERS, WORD_CLASSES, CEFR_LEVELS, VERB_TRANSITIVITY_FILTERS } from '../constants/filters';
import { LanguageContext, LANGUAGES } from '../contexts/LanguageContext';
import { useTutor } from '../contexts/TutorContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.5;
const SWIPE_THRESHOLD = 100; // Distance to trigger swipe

// Localized UI text for flashcards
const FLASHCARD_LOCALIZATION = {
  tamil: {
    headerTitle: { text: 'ஃபிளாஷ்கார்டுகள்', transliteration: 'fḷāṣkārṭukaḷ' },
    wordLabel: { text: 'சொல்', transliteration: 'col' },
    translationLabel: { text: 'மொழிபெயர்ப்பு', transliteration: 'moḻipeyarppu' },
    tapToReveal: { text: 'வெளிப்படுத்த தட்டவும்', transliteration: 'veḷippaṭutta taṭṭavum' },
    tapToFlipBack: { text: 'மீண்டும் புரட்ட தட்டவும்', transliteration: 'mīṇṭum puraṭṭa taṭṭavum' },
    srsNew: { text: 'புதியது', transliteration: 'putiyatu' },
    srsLearning: { text: 'கற்றுக்கொண்டிருக்கிறது', transliteration: 'kaṟṟukkoṇṭirukkiṟatu' },
    srsReviewing: { text: 'மறுஆய்வு', transliteration: 'maṟu-āyvu' },
    srsMastered: { text: 'தேர்ச்சி பெற்றது', transliteration: 'tērcchi peṟṟatu' },
    reviewsText: { text: 'மதிப்பாய்வுகள்', transliteration: 'matippāyvukaḷ' },
    days: { text: 'நாட்கள்', transliteration: 'nāṭkaḷ' },
    hours: { text: 'மணிநேரங்கள்', transliteration: 'maṇi-nēraṅkaḷ' },
    easy: { text: 'எளிது', transliteration: 'eḷitu' },
    good: { text: 'நல்லது', transliteration: 'nallatu' },
    hard: { text: 'கடினம்', transliteration: 'kaṭiṉam' },
    again: { text: 'மீண்டும்', transliteration: 'mīṇṭum' },
    previousCard: { text: 'முந்தைய அட்டை', transliteration: 'muntaiya aṭṭai' },
    instruction: { text: 'உங்கள் வசதிக்கேற்ப கார்டை ஒரு மூலைக்கு இழுக்கவும்', transliteration: 'uṅkaḷ vacatikkēṟpa kārṭai oru mūlaikku iḻukkavum' },
    completionTitle: { text: 'எல்லாம் முடிந்தது!', transliteration: 'ellām muṭintatu!' },
    completionSubtext: { text: 'இன்றைய ஃபிளாஷ்கார்டு ஒதுக்கீட்டை முடித்துவிட்டீர்கள்', transliteration: 'iṉṟaiya fḷāṣkārṭu otukīṭṭai muṭittuviṭṭīrkaḷ' },
    newCards: { text: 'புதிய அட்டைகள்', transliteration: 'putiya aṭṭaikaḷ' },
    reviews: { text: 'மதிப்பாய்வுகள்', transliteration: 'matippāyvukaḷ' },
    mastered: { text: 'தேர்ச்சி பெற்றவை:', transliteration: 'tērcchi peṟṟavai:' },
    learning: { text: 'கற்றுக்கொண்டிருப்பவை:', transliteration: 'kaṟṟukkoṇṭiruppavai:' },
    newAvailable: { text: 'புதிதாக கிடைக்கும்:', transliteration: 'putitāka kiṭaikkum:' },
    learnMore: { text: 'மேலும் அட்டைகளைக் கற்றுக்கொள்ளுங்கள்', transliteration: 'mēlum aṭṭaikaḷaik kaṟṟukkoḷḷuṅkaḷ' },
    comeBackTomorrow: { text: 'மேலும் அட்டைகளுக்கு நாளை மீண்டும் வாருங்கள்!', transliteration: 'mēlum aṭṭaikaḷukku nāḷai mīṇṭum vāruṅkaḷ!' },
  },
  telugu: {
    headerTitle: { text: 'ఫ్లాష్‌కార్డులు', transliteration: 'fḷāṣkārḍulu' },
    wordLabel: { text: 'పదం', transliteration: 'padaṁ' },
    translationLabel: { text: 'అనువాదం', transliteration: 'anuvādaṁ' },
    tapToReveal: { text: 'బహిర్గతం చేయడానికి నొక్కండి', transliteration: 'bahirgataṁ cēyadāniki nokkaṇḍi' },
    tapToFlipBack: { text: 'తిరిగి తిప్పడానికి నొక్కండి', transliteration: 'tirigi tippaḍāniki nokkaṇḍi' },
    srsNew: { text: 'కొత్త', transliteration: 'kotta' },
    srsLearning: { text: 'నేర్చుకుంటున్నది', transliteration: 'nērcukuṇṭunnadi' },
    srsReviewing: { text: 'సమీక్ష', transliteration: 'samīkṣa' },
    srsMastered: { text: 'పూర్తిగా నేర్చుకున్నది', transliteration: 'pūrtigā nērcukunnadi' },
    reviewsText: { text: 'సమీక్షలు', transliteration: 'samīkṣalu' },
    days: { text: 'రోజులు', transliteration: 'rōjulu' },
    hours: { text: 'గంటలు', transliteration: 'gaṇṭalu' },
    easy: { text: 'సులభం', transliteration: 'sulabhaṁ' },
    good: { text: 'మంచిది', transliteration: 'man̄cidi' },
    hard: { text: 'కష్టం', transliteration: 'kaṣṭaṁ' },
    again: { text: 'మళ్లీ', transliteration: 'maḷlī' },
    previousCard: { text: 'మునుపటి కార్డు', transliteration: 'munupaṭi kārḍu' },
    instruction: { text: 'మీ సౌలభ్యం ఆధారంగా కార్డును మూలకు లాగండి', transliteration: 'mī saulabhyaṁ ādhāraṅgā kārḍunu mūlaku lāgaṇḍi' },
    completionTitle: { text: 'అన్నీ పూర్తయ్యాయి!', transliteration: 'annī pūrtayyāyi!' },
    completionSubtext: { text: 'మీరు ఈరోజు ఫ్లాష్‌కార్డ్ కోటాను పూర్తి చేసారు', transliteration: 'mīru īrōju fḷāṣkārḍ kōṭānu pūrti cēsāru' },
    newCards: { text: 'కొత్త కార్డులు', transliteration: 'kotta kārḍulu' },
    reviews: { text: 'సమీక్షలు', transliteration: 'samīkṣalu' },
    mastered: { text: 'నైపుణ్యం పొందినవి:', transliteration: 'naipuṇyaṁ pondinavi:' },
    learning: { text: 'నేర్చుకుంటున్నవి:', transliteration: 'nērcukuṇṭunnavi:' },
    newAvailable: { text: 'కొత్తగా అందుబాటులో:', transliteration: 'kottaga andubāṭulō:' },
    learnMore: { text: 'మరిన్ని కార్డులు నేర్చుకోండి', transliteration: 'marinni kārḍulu nērcukōṇḍi' },
    comeBackTomorrow: { text: 'మరిన్ని కార్డుల కోసం రేపు తిరిగి రండి!', transliteration: 'marinni kārḍula kōsaṁ rēpu tirigi raṇḍi!' },
  },
  hindi: {
    headerTitle: { text: 'फ्लैशकार्ड', transliteration: 'fḷaiśkārḍ' },
    wordLabel: { text: 'शब्द', transliteration: 'śabd' },
    translationLabel: { text: 'अनुवाद', transliteration: 'anuvād' },
    tapToReveal: { text: 'खोलने के लिए टैप करें', transliteration: 'kholne ke lie ṭaip kareṁ' },
    tapToFlipBack: { text: 'वापस पलटने के लिए टैप करें', transliteration: 'vāpas palaṭne ke lie ṭaip kareṁ' },
    srsNew: { text: 'नया', transliteration: 'nayā' },
    srsLearning: { text: 'सीख रहे हैं', transliteration: 'sīkh rahe haiṁ' },
    srsReviewing: { text: 'समीक्षा', transliteration: 'samīkṣā' },
    srsMastered: { text: 'पूर्ण निपुणता', transliteration: 'pūrṇa nipuṇatā' },
    reviewsText: { text: 'समीक्षाएं', transliteration: 'samīkṣāeṁ' },
    days: { text: 'दिन', transliteration: 'din' },
    hours: { text: 'घंटे', transliteration: 'ghaṇṭe' },
    easy: { text: 'आसान', transliteration: 'āsān' },
    good: { text: 'अच्छा', transliteration: 'acchā' },
    hard: { text: 'मुश्किल', transliteration: 'muśkil' },
    again: { text: 'फिर से', transliteration: 'phir se' },
    previousCard: { text: 'पिछला कार्ड', transliteration: 'pichlā kārḍ' },
    instruction: { text: 'अपने आराम स्तर के आधार पर कार्ड को कोने में खींचें', transliteration: 'apne ārām star ke ādhār par kārḍ ko kone mẽ khīn̄cẽ' },
    completionTitle: { text: 'सब पूरा हो गया!', transliteration: 'sab pūrā ho gayā!' },
    completionSubtext: { text: 'आपने आज का फ्लैशकार्ड कोटा पूरा कर लिया है', transliteration: 'āpne āj kā fḷaiśkārḍ kōṭā pūrā kar liyā hai' },
    newCards: { text: 'नए कार्ड', transliteration: 'nae kārḍ' },
    reviews: { text: 'समीक्षाएँ', transliteration: 'samīkṣāẽ' },
    mastered: { text: 'महारत हासिल:', transliteration: 'māharat hāsil:' },
    learning: { text: 'सीख रहे हैं:', transliteration: 'sīkh rahe haĩ:' },
    newAvailable: { text: 'नए उपलब्ध:', transliteration: 'nae uplabdh:' },
    learnMore: { text: 'अधिक कार्ड सीखें', transliteration: 'adhik kārḍ sīkhẽ' },
    comeBackTomorrow: { text: 'अधिक कार्ड के लिए कल फिर आएँ!', transliteration: 'adhik kārḍ ke lie kal phir āẽ!' },
  },
  kannada: {
    headerTitle: { text: 'ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್‌ಗಳು', transliteration: 'fḷyāṣkārḍgaḷu' },
    wordLabel: { text: 'ಪದ', transliteration: 'pada' },
    translationLabel: { text: 'ಅನುವಾದ', transliteration: 'anuvāda' },
    tapToReveal: { text: 'ಬಹಿರಂಗಪಡಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ', transliteration: 'bahiraṅgapaḍisalu ṭyāp māḍi' },
    tapToFlipBack: { text: 'ಹಿಂದಕ್ಕೆ ತಿರುಗಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ', transliteration: 'hindakke tirugisalu ṭyāp māḍi' },
    srsNew: { text: 'ಹೊಸ', transliteration: 'hosa' },
    srsLearning: { text: 'ಕಲಿಯುತ್ತಿದ್ದಾರೆ', transliteration: 'kaliyuttiddāre' },
    srsReviewing: { text: 'ಪರಿಶೀಲನೆ', transliteration: 'pariśīlane' },
    srsMastered: { text: 'ಪಾರಂಗತತೆ ಗಳಿಸಿದೆ', transliteration: 'pāraṅgatate gaḷiside' },
    reviewsText: { text: 'ಪರಿಶೀಲನೆಗಳು', transliteration: 'pariśīlanegaḷu' },
    days: { text: 'ದಿನಗಳು', transliteration: 'dinagaḷu' },
    hours: { text: 'ಗಂಟೆಗಳು', transliteration: 'gaṇṭegaḷu' },
    easy: { text: 'ಸುಲಭ', transliteration: 'sulabha' },
    good: { text: 'ಒಳ್ಳೆಯದು', transliteration: 'oḷḷeyadu' },
    hard: { text: 'ಕಷ್ಟ', transliteration: 'kaṣṭa' },
    again: { text: 'ಮತ್ತೆ', transliteration: 'matte' },
    previousCard: { text: 'ಹಿಂದಿನ ಕಾರ್ಡ್', transliteration: 'hindina kārḍ' },
    instruction: { text: 'ನಿಮ್ಮ ಆರಾಮದ ಮಟ್ಟದ ಆಧಾರದ ಮೇಲೆ ಕಾರ್ಡ್ ಅನ್ನು ಮೂಲೆಗೆ ಎಳೆಯಿರಿ', transliteration: 'nimma ārāmada maṭṭada ādhārada mēle kārḍ annu mūlege eḷeyiri' },
    completionTitle: { text: 'ಎಲ್ಲಾ ಮುಗಿದಿದೆ!', transliteration: 'ellā mugidide!' },
    completionSubtext: { text: 'ನೀವು ಇಂದಿನ ಫ್ಲ್ಯಾಶ್‌ಕಾರ್ಡ್ ಕೋಟಾವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ', transliteration: 'nīvu indin fḷyāṣkārḍ kōṭāvannu pūrṇagoḷisiddīri' },
    newCards: { text: 'ಹೊಸ ಕಾರ್ಡ್‌ಗಳು', transliteration: 'hosa kārḍgaḷu' },
    reviews: { text: 'ಪರಿಶೀಲನೆಗಳು', transliteration: 'pariśīlanegaḷu' },
    mastered: { text: 'ಪಾರಂಗತವಾದವು:', transliteration: 'pāraṅgatavādavu:' },
    learning: { text: 'ಕಲಿಯುತ್ತಿರುವವು:', transliteration: 'kaliyuttiruvavu:' },
    newAvailable: { text: 'ಹೊಸದಾಗಿ ಲಭ್ಯವಿದೆ:', transliteration: 'hosadāgi labhyavide:' },
    learnMore: { text: 'ಹೆಚ್ಚಿನ ಕಾರ್ಡ್‌ಗಳನ್ನು ಕಲಿಯಿರಿ', transliteration: 'heccina kārḍgaḷannu kaliyiri' },
    comeBackTomorrow: { text: 'ಹೆಚ್ಚಿನ ಕಾರ್ಡ್‌ಗಳಿಗಾಗಿ ನಾಳೆ ಮತ್ತೆ ಬನ್ನಿ!', transliteration: 'heccina kārḍgaḷigāgi nāḷe matte banni!' },
  },
  urdu: {
    headerTitle: { text: 'فلیش کارڈز', transliteration: 'fḷaiś kārḍz' },
    wordLabel: { text: 'لفظ', transliteration: 'lafẓ' },
    translationLabel: { text: 'ترجمہ', transliteration: 'tarjamah' },
    tapToReveal: { text: 'ظاہر کرنے کے لیے تھپتھپائیں', transliteration: 'ẓāhir karne ke lie thapthapāẽ' },
    tapToFlipBack: { text: 'واپس پلٹنے کے لیے تھپتھپائیں', transliteration: 'vāpas palaṭne ke lie thapthapāẽ' },
    srsNew: { text: 'نیا', transliteration: 'nayā' },
    srsLearning: { text: 'سیکھ رہے ہیں', transliteration: 'sīkh rahe haĩ' },
    srsReviewing: { text: 'جائزہ', transliteration: 'jāizah' },
    srsMastered: { text: 'مکمل مہارت', transliteration: 'mukammal mahārat' },
    reviewsText: { text: 'جائزے', transliteration: 'jāize' },
    days: { text: 'دن', transliteration: 'din' },
    hours: { text: 'گھنٹے', transliteration: 'ghaṇṭe' },
    easy: { text: 'آسان', transliteration: 'āsān' },
    good: { text: 'اچھا', transliteration: 'acchā' },
    hard: { text: 'مشکل', transliteration: 'muśkil' },
    again: { text: 'دوبارہ', transliteration: 'dobārah' },
    previousCard: { text: 'پچھلا کارڈ', transliteration: 'pichlā kārḍ' },
    instruction: { text: 'اپنے آرام کی سطح کی بنیاد پر کارڈ کو کونے میں کھینچیں', transliteration: 'apne ārām kī satah kī bunyād par kārḍ ko kone mẽ khīn̄cẽ' },
    completionTitle: { text: 'سب ختم ہو گیا!', transliteration: 'sab xatm ho gayā!' },
    completionSubtext: { text: 'آپ نے آج کا فلیش کارڈ کوٹا پورا کر لیا ہے', transliteration: 'āp ne āj kā fḷaiś kārḍ kōṭā pūrā kar liyā hai' },
    newCards: { text: 'نئے کارڈز', transliteration: 'nae kārḍz' },
    reviews: { text: 'جائزے', transliteration: 'jāʿize' },
    mastered: { text: 'مہارت حاصل:', transliteration: 'mahārat hāṣil:' },
    learning: { text: 'سیکھ رہے ہیں:', transliteration: 'sīkh rahe haĩ:' },
    newAvailable: { text: 'نئے دستیاب:', transliteration: 'nae dastiyāb:' },
    learnMore: { text: 'مزید کارڈز سیکھیں', transliteration: 'mazīd kārḍz sīkhẽ' },
    comeBackTomorrow: { text: 'مزید کارڈز کے لیے کل واپس آئیں!', transliteration: 'mazīd kārḍz ke liye kal vāpas āẽ!' },
  },
  malayalam: {
    headerTitle: { text: 'ഫ്ലാഷ്കാർഡുകൾ', transliteration: 'fḷāṣkārḍukaḷ' },
    wordLabel: { text: 'വാക്ക്', transliteration: 'vākk' },
    translationLabel: { text: 'വിവർത്തനം', transliteration: 'vivarttanaṁ' },
    tapToReveal: { text: 'വെളിപ്പെടുത്താൻ ടാപ്പ് ചെയ്യുക', transliteration: 'veḷippeṭuttān ṭāpp ceyyuka' },
    tapToFlipBack: { text: 'തിരികെ മറിക്കാൻ ടാപ്പ് ചെയ്യുക', transliteration: 'tirike maṟikkān ṭāpp ceyyuka' },
    srsNew: { text: 'പുതിയത്', transliteration: 'putiyat' },
    srsLearning: { text: 'പഠിക്കുന്നു', transliteration: 'paṭhikkunnu' },
    srsReviewing: { text: 'അവലോകനം', transliteration: 'avalōkanaṁ' },
    srsMastered: { text: 'പ്രാവീണ്യം നേടി', transliteration: 'prāvīṇyaṁ nēṭi' },
    reviewsText: { text: 'അവലോകനങ്ങൾ', transliteration: 'avalōkanaṅṅaḷ' },
    days: { text: 'ദിവസങ്ങൾ', transliteration: 'divasaṅṅaḷ' },
    hours: { text: 'മണിക്കൂറുകൾ', transliteration: 'maṇikkūṟukaḷ' },
    easy: { text: 'എളുപ്പം', transliteration: 'eḷuppam' },
    good: { text: 'നല്ലത്', transliteration: 'nallat' },
    hard: { text: 'പ്രയാസം', transliteration: 'prayāsaṁ' },
    again: { text: 'വീണ്ടും', transliteration: 'vīṇṭuṁ' },
    previousCard: { text: 'മുൻ കാർഡ്', transliteration: 'mun kārḍ' },
    instruction: { text: 'നിങ്ങളുടെ സുഖസൗകര്യത്തിന്റെ അടിസ്ഥാനത്തിൽ കാർഡ് ഒരു കോണിലേക്ക് വലിക്കുക', transliteration: 'niṅṅaḷuṭe sukhasaukaryattinṟe aṭisthānattil kārḍ oru kōṇilēkk valikuka' },
    completionTitle: { text: 'എല്ലാം പൂർത്തിയായി!', transliteration: 'ellām pūrttiyāyi!' },
    completionSubtext: { text: 'നിങ്ങൾ ഇന്നത്തെ ഫ്ലാഷ്കാർഡ് കോട്ട പൂർത്തിയാക്കി', transliteration: 'niṅṅaḷ innatte fḷāṣkārḍ kōṭṭa pūrttiyākki' },
    newCards: { text: 'പുതിയ കാർഡുകൾ', transliteration: 'putiya kārḍukaḷ' },
    reviews: { text: 'അവലോകനങ്ങൾ', transliteration: 'avalōkanaṅṅaḷ' },
    mastered: { text: 'പ്രാവീണ്യം നേടിയവ:', transliteration: 'prāvīṇyaṁ nēṭiyava:' },
    learning: { text: 'പഠിക്കുന്നവ:', transliteration: 'paṭhikkunnaav:' },
    newAvailable: { text: 'പുതുതായി ലഭ്യമാണ്:', transliteration: 'pututāyi labhyamāṇ:' },
    learnMore: { text: 'കൂടുതൽ കാർഡുകൾ പഠിക്കുക', transliteration: 'kūṭutal kārḍukaḷ paṭhikkuka' },
    comeBackTomorrow: { text: 'കൂടുതൽ കാർഡുകൾക്കായി നാളെ തിരികെ വരൂ!', transliteration: 'kūṭutal kārḍukaḷkkāyi nāḷe tirike varū!' },
  },
};

// Comfort levels mapped to corners
const COMFORT_LEVELS = {
  'top-left': { 
    label: 'Easy', 
    comfort_level: 'easy',
    color: '#10B981', // Green
    lightColor: '#E8F8F0', // Light green
    brightColor: '#10B981', // Very bright, saturated green
    icon: 'checkmark-circle',
  },
  'top-right': { 
    label: 'Good', 
    comfort_level: 'good',
    color: '#4A90E2', // Blue
    lightColor: '#E8F4FD', // Light blue
    brightColor: '#2563EB', // Very bright, saturated blue
    icon: 'checkmark',
  },
  'bottom-left': { 
    label: 'Hard', 
    comfort_level: 'hard',
    color: '#FF9500', // Orange
    lightColor: '#FFF4E6', // Light orange
    brightColor: '#F97316', // Very bright, saturated orange
    icon: 'alert-circle',
  },
  'bottom-right': { 
    label: 'Again', 
    comfort_level: 'again',
    color: '#EF4444', // Red
    lightColor: '#FFE8E8', // Light red
    brightColor: '#DC2626', // Very bright, saturated red
    icon: 'refresh',
  },
};

// Helper functions for mastery and word class colors
const getMasteryColor = (masteryLevel) => {
  // Normalize to lowercase for comparison
  const normalizedLevel = masteryLevel?.toLowerCase();
  const filter = MASTERY_FILTERS.find(f => f.value === normalizedLevel || (!normalizedLevel && f.value === 'new'));
  return filter ? filter.color.bg : '#999999';
};

const getMasteryEmoji = (masteryLevel) => {
  // Normalize to lowercase for comparison
  const normalizedLevel = masteryLevel?.toLowerCase();
  const filter = MASTERY_FILTERS.find(f => f.value === normalizedLevel || (!normalizedLevel && f.value === 'new'));
  return filter ? filter.emoji : '+';
};

const getMasteryLabel = (masteryLevel) => {
  // Normalize to lowercase for comparison
  const normalizedLevel = masteryLevel?.toLowerCase();
  const filter = MASTERY_FILTERS.find(f => f.value === normalizedLevel || (!normalizedLevel && f.value === 'new'));
  return filter ? filter.label : 'New';
};

const getWordClassColor = (wordClass) => {
  const wordClassData = WORD_CLASSES.find(wc => wc.value.toLowerCase() === wordClass?.toLowerCase());
  return wordClassData ? wordClassData.color : { bg: '#F5F5F5', text: '#666' };
};

export default function FlashcardScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const {
    language: routeLanguage = 'kannada',
    studyMode: routeStudyMode = null,
    deckId: routeDeckId = null,
    deckName: routeDeckName = '',
  } = route.params || {};

  // ── Language context + in-screen picker ──
  const { selectedLanguage: ctxLanguage, setSelectedLanguage: setCtxLanguage, availableLanguages } = useContext(LanguageContext);
  const { openTutor } = useTutor();
  const [selectedLanguage, setSelectedLanguageState] = useState(ctxLanguage || routeLanguage);
  const language = selectedLanguage; // alias used throughout the file

  const setSelectedLanguage = (lang) => {
    setSelectedLanguageState(lang);
    setCtxLanguage(lang);
  };

  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [allLanguagesSrsStats, setAllLanguagesSrsStats] = useState({});

  const currentLanguage = LANGUAGES.find(l => l.code === language);

  const [studyMode, setStudyMode] = useState(routeStudyMode); // null = picker, 'reviews', 'new', 'all', 'deck'
  const [activeDeckId, setActiveDeckId] = useState(routeDeckId); // set when studyMode='deck'
  const [activeDeckName, setActiveDeckName] = useState(routeDeckName || ''); // display label in header
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deckStartMode, setDeckStartMode] = useState(route.params?.deckStartMode || 'mixed');

  // Imported decks for the picker
  const [decks, setDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [decksExpanded, setDecksExpanded] = useState(false);
  const [showDeleteDeckModal, setShowDeleteDeckModal] = useState(false);
  const [deleteDeckList, setDeleteDeckList] = useState([]);
  const [deleteDeckSelectedIds, setDeleteDeckSelectedIds] = useState(new Set());
  const [showDeleteChoiceModal, setShowDeleteChoiceModal] = useState(false);
  const [deletePendingDeck, setDeletePendingDeck] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState('single');
  const [deleteSingleDeckId, setDeleteSingleDeckId] = useState(null);
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTransliterations, setShowTransliterations] = useState(false); // Start false, load from settings
  const [transliterations, setTransliterations] = useState({});
  const [allWordsLoaded, setAllWordsLoaded] = useState(false);
  const [nextReviewIntervals, setNextReviewIntervals] = useState(null);
  const [srsStats, setSrsStats] = useState(null); // SRS statistics (new/due counts)
  const [completedWords, setCompletedWords] = useState([]); // Track completed word IDs for daily goal
  const [showReviewHistory, setShowReviewHistory] = useState(false);
  const [reviewHistoryData, setReviewHistoryData] = useState([]);
  const [completedCardIndices, setCompletedCardIndices] = useState([]); // Track indices of completed cards for navigation
  const [previousButtonDisabled, setPreviousButtonDisabled] = useState(false); // Track if previous button was just clicked
  const [pressedCorner, setPressedCorner] = useState(null); // Track which corner is being pressed for visual feedback
  
  // Track the studyMode for which the deck has already been loaded (prevents re-load on stats refresh)
  const loadedForModeRef = useRef(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showFrontFirst, setShowFrontFirst] = useState(true); // true = front first, false = back first
  const [shuffleCards, setShuffleCards] = useState(false);
  
  const position = useRef(new Animated.ValueXY()).current;
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const [activeCorner, setActiveCorner] = useState(null);
  const [cardTint, setCardTint] = useState(null);
  const [backgroundColor, setBackgroundColor] = useState('#F5F5F5');
  
  // Animated values for corner indicators
  const cornerOpacities = useMemo(() => ({
    'top-left': new Animated.Value(0.5), // Visible but dimmed by default
    'top-right': new Animated.Value(0.5),
    'bottom-left': new Animated.Value(0.5),
    'bottom-right': new Animated.Value(0.5),
  }), []);
  
  // Animated value for card background tint
  const cardTintOpacity = useRef(new Animated.Value(0)).current;
  
  // Throttle corner detection to reduce re-renders
  const lastCornerUpdate = useRef(0);
  const CORNER_UPDATE_THROTTLE = 50; // ms

  // PanResponder for drag gestures - recreate when dependencies change
  const panResponder = useMemo(() => 
    PanResponder.create({
      onStartShouldSetPanResponder: () => words.length > 0, // Only allow if words are loaded
      onMoveShouldSetPanResponder: () => words.length > 0,
      onPanResponderGrant: () => {
        // Extract current position and set as offset
        const currentX = position.x._value || 0;
        const currentY = position.y._value || 0;
        position.setOffset({ x: currentX, y: currentY });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        // Use Animated.event for smooth dragging without re-renders
        Animated.event(
          [null, { dx: position.x, dy: position.y }],
          { useNativeDriver: false }
        )(evt, gestureState);
        
        // Throttle corner detection updates
        const now = Date.now();
        if (now - lastCornerUpdate.current < CORNER_UPDATE_THROTTLE) {
          return;
        }
        lastCornerUpdate.current = now;
        
        // Determine which corner is being dragged to
        const { dx, dy } = gestureState;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        
        let corner = null;
        if (absX > 50 || absY > 50) {
          if (dy < -50) {
            // Top half
            corner = dx < 0 ? 'top-left' : 'top-right';
          } else if (dy > 50) {
            // Bottom half
            corner = dx < 0 ? 'bottom-left' : 'bottom-right';
          }
        }
        
        // Update active corner and card tint (only if changed)
        if (corner && corner !== activeCorner) {
          setActiveCorner(corner);
          const cornerData = COMFORT_LEVELS[corner];
          setCardTint(cornerData.color);
          setBackgroundColor(cornerData.lightColor); // Use light color for background
          
          // Batch animate corner indicators
          const animations = Object.keys(cornerOpacities).map(key =>
            Animated.timing(cornerOpacities[key], {
              toValue: key === corner ? 1 : 0.3, // Show active, dim others
              duration: 150,
              useNativeDriver: false,
            })
          );
          
          Animated.parallel([
            ...animations,
            Animated.timing(cardTintOpacity, {
              toValue: 0.3, // Lighter opacity for card background
              duration: 150,
              useNativeDriver: false,
            }),
          ]).start();
        } else if (!corner && activeCorner) {
          // Reset if not near any corner
          setActiveCorner(null);
          setCardTint(null);
          setBackgroundColor('#F5F5F5');
          
          const animations = Object.keys(cornerOpacities).map(key =>
            Animated.timing(cornerOpacities[key], {
              toValue: 0.5, // Return to dimmed state when not dragging
              duration: 150,
              useNativeDriver: false,
            })
          );
          
          Animated.parallel([
            ...animations,
            Animated.timing(cardTintOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        position.flattenOffset();
        
        const { dx, dy } = gestureState;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        
        // Check if it was just a tap (minimal movement) - flip the card
        // But only if we're not near a corner
        if (absX < 10 && absY < 10 && !activeCorner) {
          flipCard();
          return;
        }
        
        // Use activeCorner if it exists and gesture is significant, otherwise calculate from gesture
        let corner = null;
        if (activeCorner && (absX > 20 || absY > 20)) {
          // User has dragged to a corner zone, use the active corner
          corner = activeCorner;
        } else if (absX > 50 || absY > 50) {
          // Calculate corner from gesture direction (lower threshold)
          if (dy < -50) {
            // Top half
            corner = dx < 0 ? 'top-left' : 'top-right';
          } else if (dy > 50) {
            // Bottom half
            corner = dx < 0 ? 'bottom-left' : 'bottom-right';
          }
        }
        
        if (corner) {
          // Only swipe if words are loaded
          if (words.length === 0) {
            console.log('Words not loaded yet, cannot swipe');
            // Reset position
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
              tension: 50,
              friction: 7,
            }).start();
            return;
          }
          // Prevent default behavior and trigger swipe
          handleSwipe(corner);
          return;
        } else {
          // Reset corner indicators and card tint
          setActiveCorner(null);
          setCardTint(null);
          setBackgroundColor('#F5F5F5');
          
          Object.keys(cornerOpacities).forEach(key => {
            Animated.timing(cornerOpacities[key], {
              toValue: 0.5, // Return to dimmed state
              duration: 200,
              useNativeDriver: false,
            }).start();
          });
          
          Animated.timing(cardTintOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
          
          // Return to center with optimized spring
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
        }
      },
    }), [words, handleSwipe, position, activeCorner, flipCard, setActiveCorner, setCardTint, setBackgroundColor, cornerOpacities, cardTintOpacity]);

  // Load words for review and new words
  const loadWords = async (limit = 50, mode = 'all') => {
    try {
      setLoading(true);
      
      // Get words for review (SRS) - mode determines what we fetch
      const modeParam = mode || 'all';
      const reviewResponse = await fetch(`${API_BASE_URL}/api/words-for-review/${language}?limit=${limit}&mode=${modeParam}`);
      const reviewData = await reviewResponse.json();
      const srsWords = reviewData.words || [];
      
      console.log(`[Flashcards] Loaded ${srsWords.length} words from SRS (respects daily quota)`);
      
      // DETERMINISTIC BIDIRECTIONAL TESTING:
      // Each word gets TWO cards - one for each direction
      // This ensures balanced testing: English→Native AND Native→English
      const wordsWithBothDirections = [];
      srsWords.forEach(word => {
        // Card 1: English → Native
        wordsWithBothDirections.push({
          ...word,
          cardDirection: 'english-to-native',
          originalWordId: word.id,  // Track original word for SRS updates
        });
        // Card 2: Native → English
        wordsWithBothDirections.push({
          ...word,
          cardDirection: 'native-to-english',
          originalWordId: word.id,  // Track original word for SRS updates
        });
      });
      
      // IMPROVED SHUFFLING: Distribute cards evenly (1F 2B 1B 2F instead of 1F 1B 2B 2F)
      let sortedWords = wordsWithBothDirections;
      if (shuffleCards) {
        // Full shuffle mode
        sortedWords = [...wordsWithBothDirections].sort(() => Math.random() - 0.5);
      } else {
        // Smart interleaving: Mix cards from different words
        // Create two separate arrays for each direction
        const englishToNative = [];
        const nativeToEnglish = [];
        
        for (let i = 0; i < srsWords.length; i++) {
          englishToNative.push(wordsWithBothDirections[i * 2]);
          nativeToEnglish.push(wordsWithBothDirections[i * 2 + 1]);
        }
        
        // Shuffle each direction array independently
        const shuffledEn = [...englishToNative].sort(() => Math.random() - 0.5);
        const shuffledNative = [...nativeToEnglish].sort(() => Math.random() - 0.5);
        
        // Interleave them: alternate between the two arrays
        const interleaved = [];
        const maxLength = Math.max(shuffledEn.length, shuffledNative.length);
        for (let i = 0; i < maxLength; i++) {
          if (i < shuffledEn.length) interleaved.push(shuffledEn[i]);
          if (i < shuffledNative.length) interleaved.push(shuffledNative[i]);
        }
        
        sortedWords = interleaved;
      }
      
      console.log(`[Flashcards] Created ${sortedWords.length} cards (${srsWords.length} words × 2 directions), shuffled: ${shuffleCards}`);
      
      setWords(sortedWords);
      setAllWordsLoaded(false); // Not all loaded yet - we'll load more as needed
      
      // Set initial flip state based on settings
      setIsFlipped(!showFrontFirst);
      flipAnimation.setValue(showFrontFirst ? 0 : 180);
      
      // Load transliterations
      await loadTransliterations(sortedWords);
      
      // Fetch intervals for first card immediately
      if (sortedWords.length > 0) {
        await fetchNextReviewIntervals(sortedWords[0]);
      }
    } catch (error) {
      console.error('Error loading words:', error);
      Alert.alert('Error', 'Failed to load words. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadSrsStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/stats/${language}`);
      if (response.ok) {
        const data = await response.json();
        setSrsStats(data);
        console.log(`[Flashcards] SRS Stats:`, data);
      }
    } catch (error) {
      console.error('Error loading SRS stats:', error);
    }
  };

  // Load SRS stats for ALL available languages (for language picker chips)
  const loadAllLanguagesSrsStats = useCallback(async () => {
    try {
      const results = await Promise.all(
        availableLanguages.map(async (lang) => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/srs/stats/${lang.code}`);
            if (res.ok) {
              const data = await res.json();
              return [lang.code, { new_count: data.new_count || 0, due_count: data.due_count || 0 }];
            }
          } catch (e) { /* ignore */ }
          return [lang.code, { new_count: 0, due_count: 0 }];
        })
      );
      setAllLanguagesSrsStats(Object.fromEntries(results));
    } catch (e) {
      console.error('Error loading all languages SRS stats:', e);
    }
  }, [availableLanguages]);

  const loadDecks = async () => {
    setDecksLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vocab/decks?language=${language}`);
      if (res.ok) {
        const data = await res.json();
        setDecks(data.decks || []);
      }
    } catch (e) {
      console.error('Error loading decks:', e);
    } finally {
      setDecksLoading(false);
    }
  };

  const loadDeckWords = async (deckId, startMode = 'mixed') => {
    try {
      setLoading(true);
      let deckWords = [];

      if (deckId === 'all') {
        // Load all words from all imported decks
        const allRes = await Promise.all(
          decks.map(d => fetch(`${API_BASE_URL}/api/vocab/decks/${d.id}/words?language=${language}`).then(r => r.json()))
        );
        const seen = new Set();
        for (const data of allRes) {
          for (const w of data.words || []) {
            if (!seen.has(w.id)) { seen.add(w.id); deckWords.push(w); }
          }
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/api/vocab/decks/${deckId}/words?language=${language}`);
        const data = await res.json();
        deckWords = data.words || [];
      }

      // Filter by startMode: 'new', 'due', or 'mixed'
      const today = new Date();
      let filteredWords = deckWords;
      if (startMode === 'new') {
        filteredWords = deckWords.filter(w => (w.mastery_level || 'new') === 'new');
      } else if (startMode === 'due') {
        filteredWords = deckWords.filter(w => {
          const ml = w.mastery_level || 'new';
          if (ml === 'new') return false;
          if (!w.next_review_date) return false;
          return new Date(w.next_review_date) <= today;
        });
      }

      if (filteredWords.length === 0) {
        Alert.alert(
          startMode === 'new' ? 'No New Cards' : startMode === 'due' ? 'No Due Cards' : 'No Cards',
          'This deck has no cards for this mode yet.'
        );
        Alert.alert('No Words', 'This deck has no words yet.');
        setLoading(false);
        return;
      }

      // Build bidirectional cards from deck words
      const cardsWithBothDirections = [];
      filteredWords.forEach(word => {
        cardsWithBothDirections.push({ ...word, cardDirection: 'english-to-native', originalWordId: word.id });
        cardsWithBothDirections.push({ ...word, cardDirection: 'native-to-english', originalWordId: word.id });
      });

      const sorted = shuffleCards
        ? [...cardsWithBothDirections].sort(() => Math.random() - 0.5)
        : cardsWithBothDirections;

      setWords(sorted);
      setAllWordsLoaded(false);
      setIsFlipped(!showFrontFirst);
      flipAnimation.setValue(showFrontFirst ? 0 : 180);
      await loadTransliterations(sorted);
      if (sorted.length > 0) await fetchNextReviewIntervals(sorted[0]);
    } catch (e) {
      console.error('Error loading deck words:', e);
      Alert.alert('Error', 'Failed to load deck words.');
    } finally {
      setLoading(false);
    }
  };

  const loadTransliterations = async (wordsToTransliterate) => {
    const newTransliterations = {};
    for (const word of wordsToTransliterate) {
      if (word.translation && !word.transliteration) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/transliterate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: word.translation, language }),
          });
          const data = await response.json();
          if (data.transliteration) {
            newTransliterations[word.id] = data.transliteration;
          }
        } catch (error) {
          console.error(`Error transliterating word ${word.id}:`, error);
        }
      } else if (word.transliteration) {
        newTransliterations[word.id] = word.transliteration;
      }
    }
    setTransliterations(prev => ({ ...prev, ...newTransliterations }));
  };

  const transliterateText = async (text) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/transliterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });
      const data = await response.json();
      return data.transliteration || text;
    } catch (error) {
      console.error('Error transliterating:', error);
      return text;
    }
  };

  useEffect(() => {
    loadSrsStats();
    loadLanguageSettings();
    loadDecks();
    // Reset study mode when language changes so user picks a mode for the new language
    setStudyMode(null);
    setWords([]);
    setCurrentIndex(0);
    setCompletedWords([]);
    setCompletedCardIndices([]);
    setActiveDeckId(null);
    setActiveDeckName('');
    loadedForModeRef.current = null;
  }, [language]);

  // Load all-languages stats for the language picker chips
  useEffect(() => {
    loadAllLanguagesSrsStats();
  }, [loadAllLanguagesSrsStats]);

  // Load words when study mode is selected
  useEffect(() => {
    // Reset the loaded-mode tracker when returning to mode picker
    if (!studyMode) {
      loadedForModeRef.current = null;
      return;
    }

    // Deck mode: load words by deck
    if (studyMode === 'deck') {
      if (!activeDeckId) return;
      const modeKey = `deck-${activeDeckId}-${deckStartMode || 'mixed'}`;
      if (loadedForModeRef.current === modeKey) return;
      loadedForModeRef.current = modeKey;
      loadDeckWords(activeDeckId, deckStartMode || 'mixed');
      return;
    }

    // Don't reload the deck if it's already been loaded for this studyMode
    if (loadedForModeRef.current === studyMode) return;

    loadedForModeRef.current = studyMode;

    // Pass a large limit — the backend enforces the daily quota for mode=new,
    // and for reviews/all the server caps at the available due count.
    loadWords(100, studyMode);
  }, [language, studyMode, activeDeckId, deckStartMode]);

  // Load language-specific settings
  const loadLanguageSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/language-personalization/${language}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[FlashcardScreen] Loading settings for ${language}:`, data);
        // Use the actual setting value, defaulting to false if not set
        const shouldShowTranslit = data.default_transliterate !== undefined ? data.default_transliterate : false;
        console.log(`[FlashcardScreen] Setting showTransliterations to:`, shouldShowTranslit);
        setShowTransliterations(shouldShowTranslit);
      } else {
        console.log(`[FlashcardScreen] No settings found for ${language}, keeping default false`);
        // Don't change from initial false state
      }
    } catch (error) {
      console.error('Error loading language settings:', error);
      // Don't change from initial false state
    }
  };

  // Function to fetch next review intervals
  const fetchNextReviewIntervals = useCallback(async (word) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/preview/${word.id}`);
      if (response.ok) {
        const data = await response.json();
        setNextReviewIntervals(data);
      }
    } catch (error) {
      console.error('Error fetching next review intervals:', error);
      setNextReviewIntervals(null);
    }
  }, []);

  // Load transliterations when current word changes
  useEffect(() => {
    if (currentWord && !transliterations[currentWord.id] && currentWord.translation) {
      transliterateText(currentWord.translation).then(translit => {
        if (translit && translit !== currentWord.translation) {
          setTransliterations(prev => ({
            ...prev,
            [currentWord.id]: translit,
          }));
        }
      });
    }
  }, [currentWord]);

  // Fetch next review intervals when current word changes
  useEffect(() => {
    if (currentWord) {
      // Immediate fetch without delay
      fetchNextReviewIntervals(currentWord);
    } else {
      // Clear intervals when no word
      setNextReviewIntervals(null);
    }
  }, [currentWord, fetchNextReviewIntervals]);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh SRS stats every time we (re-)focus the screen so that
      // cards marked 'Again' in a previous session show up in Due.
      loadSrsStats();
      loadDecks();

      // If we were navigated to with a specific deck + deck study mode,
      // respect that on focus.
      if (routeDeckId && routeStudyMode === 'deck') {
        setActiveDeckId(routeDeckId);
        setActiveDeckName(routeDeckName || '');
        setDeckStartMode(route.params?.deckStartMode || 'mixed');
        setStudyMode('deck');
      }

      // Reset card position/flip state
      setCurrentIndex(0);
      setIsFlipped(!showFrontFirst);
      position.setValue({ x: 0, y: 0 });
      flipAnimation.setValue(showFrontFirst ? 0 : 180);
      cardOpacity.setValue(1);

      // Cleanup: when the user navigates AWAY mid-session, reset the session
      // so they get a fresh start when they come back.
      return () => {
        setStudyMode(null);
        setActiveDeckId(null);
        setActiveDeckName('');
        setWords([]);
        setCurrentIndex(0);
        setCompletedWords([]);
        setCompletedCardIndices([]);
        loadedForModeRef.current = null;
      };
    }, [showFrontFirst, routeDeckId, routeDeckName, routeStudyMode])
  );

  // Keyboard support for moving card to corners
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle if on web platform
      if (typeof window === 'undefined') return;
      
      const key = event.key;
      const keyMap = {
        '1': 'top-left',      // Easy
        '2': 'top-right',     // Good
        '3': 'bottom-left',   // Hard
        '4': 'bottom-right',  // Again
      };
      
      // Spacebar flips the card (works on both sides)
      if (key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        flipCard();
        return;
      }
      
      // Arrow keys for navigation
      if (key === 'ArrowLeft') {
        event.preventDefault();
        navigateBack();
        return;
      }
      
      if (key === 'ArrowRight') {
        event.preventDefault();
        navigateForward();
        return;
      }
      
      if (keyMap[key] && words.length > 0) {
        event.preventDefault();
        
        const corner = keyMap[key];
        
        // Call handleSwipe directly - this will animate the card out and update the word state
        // Same behavior as dragging to a corner
        handleSwipe(corner);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [words, handleSwipe, flipCard, isFlipped, navigateBack, navigateForward]);

  // Complete the flashcard activity and update daily progress
  const completeFlashcardActivity = useCallback(async () => {
    try {
      console.log(`[Flashcards] Completing activity with ${completedWords.length} cards reviewed`);
      
      // Calculate score - we consider all reviewed cards as "correct" for flashcards
      const score = completedWords.length > 0 ? 1.0 : 0.0;
      
      const response = await fetch(`${API_BASE_URL}/api/activity/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          activity_type: 'flashcard',
          score,
          word_updates: completedWords.map(wordId => ({ word_id: wordId, correct: true })),
          activity_data: { 
            cards_reviewed: completedWords.length,
            session_type: 'srs'
          },
          activity_id: null
        })
      });
      
      if (response.ok) {
        console.log(`✓ Flashcard activity completed: ${completedWords.length} cards`);
      } else {
        console.error('Failed to complete flashcard activity:', response.status);
      }
    } catch (error) {
      console.error('[Flashcards] Error completing activity:', error);
    }
  }, [language, completedWords]);

  // Load more cards and append to existing deck
  const loadMoreCards = useCallback(async () => {
    try {
      if (loading) return; // Prevent duplicate loads
      
      setLoading(true);
      console.log('[Flashcards] Loading additional cards...');

      // In deck mode, just loop the deck — no SRS call needed
      if (studyMode === 'deck') {
        setLoading(false);
        setAllWordsLoaded(true);
        // Reset to beginning of deck for another pass
        setCurrentIndex(0);
        setIsFlipped(!showFrontFirst);
        flipAnimation.setValue(showFrontFirst ? 0 : 180);
        return;
      }
      
      // Get more words for review (DO NOT check goal completion here - let user practice)
      const modeParam = studyMode || 'all';
      const reviewResponse = await fetch(`${API_BASE_URL}/api/words-for-review/${language}?limit=100&mode=${modeParam}`);
      const reviewData = await reviewResponse.json();
      const newSrsWords = reviewData.words || [];
      
      console.log(`[Flashcards] Loaded ${newSrsWords.length} additional words`);
      
      if (newSrsWords.length === 0) {
        console.log('[Flashcards] No more cards available from backend');
        
        // Complete activity if user did any cards
        if (completedWords.length > 0) {
          await completeFlashcardActivity();
        }
        
        // Navigate back to previous screen since deck is done
        setLoading(false);
        setAllWordsLoaded(true);
        // Go back to mode selection so user can pick another mode or leave
        setStudyMode(null);
        setActiveDeckId(null);
        setActiveDeckName('');
        setWords([]);
        setCurrentIndex(0);
        setCompletedWords([]);
        setCompletedCardIndices([]);
        // Refresh stats
        loadSrsStats();
        return;
      }
      
      // DETERMINISTIC BIDIRECTIONAL TESTING:
      // Each word gets TWO cards - one for each direction
      const newWordsWithBothDirections = [];
      newSrsWords.forEach(word => {
        // Card 1: English → Native
        newWordsWithBothDirections.push({
          ...word,
          cardDirection: 'english-to-native',
          originalWordId: word.id,
        });
        // Card 2: Native → English
        newWordsWithBothDirections.push({
          ...word,
          cardDirection: 'native-to-english',
          originalWordId: word.id,
        });
      });
      
      // IMPROVED SHUFFLING: Distribute cards evenly
      let sortedNewWords = newWordsWithBothDirections;
      if (shuffleCards) {
        sortedNewWords = [...newWordsWithBothDirections].sort(() => Math.random() - 0.5);
      } else {
        // Smart interleaving: Mix cards from different words
        const englishToNative = [];
        const nativeToEnglish = [];
        
        for (let i = 0; i < newSrsWords.length; i++) {
          englishToNative.push(newWordsWithBothDirections[i * 2]);
          nativeToEnglish.push(newWordsWithBothDirections[i * 2 + 1]);
        }
        
        // Shuffle each direction array independently
        const shuffledEn = [...englishToNative].sort(() => Math.random() - 0.5);
        const shuffledNative = [...nativeToEnglish].sort(() => Math.random() - 0.5);
        
        // Interleave them
        const interleaved = [];
        const maxLength = Math.max(shuffledEn.length, shuffledNative.length);
        for (let i = 0; i < maxLength; i++) {
          if (i < shuffledEn.length) interleaved.push(shuffledEn[i]);
          if (i < shuffledNative.length) interleaved.push(shuffledNative[i]);
        }
        
        sortedNewWords = interleaved;
      }
      
      console.log(`[Flashcards] Created ${sortedNewWords.length} new cards (${newSrsWords.length} words × 2 directions), shuffled`);
      
      // Append to existing words (don't reset position)
      setWords(prevWords => [...prevWords, ...sortedNewWords]);
      
      // Load transliterations for new words
      await loadTransliterations(sortedNewWords);
      
      setLoading(false);
      console.log(`[Flashcards] Total cards now: ${words.length + sortedNewWords.length}`);
    } catch (error) {
      console.error('Error loading more cards:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to load more cards. Please try again.');
    }
  }, [language, loading, words.length, shuffleCards, completedWords, completeFlashcardActivity]);

  // Fetch review history for current word
  const fetchReviewHistory = useCallback(async (wordId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/review-history/${wordId}`);
      if (response.ok) {
        const data = await response.json();
        // Store the full response object {word, current_state, history}
        setReviewHistoryData(data);
        setShowReviewHistory(true);
      }
    } catch (error) {
      console.error('Error fetching review history:', error);
    }
  }, []);

  const handleSwipe = useCallback(async (corner) => {
    console.log(`handleSwipe called with corner: ${corner}, currentIndex: ${currentIndex}, words.length: ${words.length}`);
    
    // Early return if words aren't loaded
    if (words.length === 0) {
      console.log('Words array is empty, cannot swipe');
      return;
    }
    
    // Use a ref or state to get the current index value instead of closure
    setCurrentIndex((prevIndex) => {
      const wordAtIndex = words[prevIndex];
      if (!wordAtIndex) {
        console.log(`No word at index ${prevIndex}, cannot swipe. Words array length: ${words.length}`);
        return prevIndex; // Return same index if no word
      }
      
      console.log(`Swiping to corner: ${corner}, word: ${wordAtIndex.english_word}, direction: ${wordAtIndex.cardDirection}`);
      
      const comfortLevel = COMFORT_LEVELS[corner];
      const isAgainSwipe = corner === 'bottom-right'; // "Again" button
      
      // Track this word as completed for daily goal (use originalWordId if available)
      const wordIdToTrack = wordAtIndex.originalWordId || wordAtIndex.id;
      setCompletedWords(prev => {
        if (!prev.includes(wordIdToTrack)) {
          return [...prev, wordIdToTrack];
        }
        return prev;
      });
      
      // Track this card index as completed for navigation
      setCompletedCardIndices(prev => {
        if (!prev.includes(prevIndex)) {
          return [...prev, prevIndex];
        }
        return prev;
      });
      
      // Calculate next index early so it's in scope for the return statement
      const nextIndex = prevIndex + 1;
      
      // Update word state via SRS with comfort level (use originalWordId if available)
      fetch(`${API_BASE_URL}/api/flashcard/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word_id: wordIdToTrack,
          comfort_level: comfortLevel.comfort_level,
        }),
      })
      .then(response => response.json())
      .then(data => {
        // Update local word data with new SRS status
        if (data.word) {
          setWords(prevWords => {
            const updatedWords = [...prevWords];
            updatedWords[prevIndex] = {
              ...updatedWords[prevIndex],
              mastery_level: data.word.mastery_level,
              next_review: data.word.next_review,
              review_count: data.word.review_count,
            };
            
            // If "Again" was swiped, re-insert this card a few positions ahead
            if (isAgainSwipe) {
              // Calculate position to re-insert (5-10 cards ahead, but not past end)
              const reinsertPosition = Math.min(prevIndex + 5 + Math.floor(Math.random() * 5), updatedWords.length);
              
              // Create a copy of the current card
              const cardToRequeue = {
                ...updatedWords[prevIndex],
                // Mark it as a requeued card so we can track it
                isRequeued: true,
              };
              
              // Insert the card at the calculated position
              updatedWords.splice(reinsertPosition, 0, cardToRequeue);
              
              console.log(`[Again] Re-queued card "${cardToRequeue.english_word}" at position ${reinsertPosition}`);
            }
            
            return updatedWords;
          });
          console.log(`[SRS] Updated word ${wordAtIndex.english_word}: ${data.word.mastery_level}, next review: ${data.word.next_review}`);
        }
      })
      .catch(error => {
        console.error('Error updating word state:', error);
      });
      
      // Get current position values before animation
      const currentX = position.x._value || 0;
      const currentY = position.y._value || 0;
      
      // Animate card out to corner
      const cornerPositions = {
        'top-left': { x: -SCREEN_WIDTH * 2, y: -SCREEN_HEIGHT * 2 },
        'top-right': { x: SCREEN_WIDTH * 2, y: -SCREEN_HEIGHT * 2 },
        'bottom-left': { x: -SCREEN_WIDTH * 2, y: SCREEN_HEIGHT * 2 },
        'bottom-right': { x: SCREEN_WIDTH * 2, y: SCREEN_HEIGHT * 2 },
      };
      
      const targetPos = cornerPositions[corner];
      
      console.log(`Animating to corner: ${corner}, from: (${currentX}, ${currentY}) to: (${targetPos.x}, ${targetPos.y})`);
      
      Animated.parallel([
        Animated.timing(position, {
          toValue: targetPos,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start((finished) => {
        console.log(`Animation finished: ${finished}`);
        
        if (!finished) {
          console.log('Animation was cancelled');
          return;
        }
        
        // Reset corner indicators
        setActiveCorner(null);
        setCardTint(null);
        setBackgroundColor('#F5F5F5');
        Object.keys(cornerOpacities).forEach(key => {
          cornerOpacities[key].setValue(0.5);
        });
        cardTintOpacity.setValue(0);
        
        // Re-enable previous button after processing card
        setPreviousButtonDisabled(false);
        
        // Move to next card
        if (nextIndex < words.length) {
          console.log(`Moving to next card: ${nextIndex} of ${words.length}`);
          
          // Completely reset position immediately (not animated)
          position.setValue({ x: 0, y: 0 });
          position.setOffset({ x: 0, y: 0 });
          
          // Reset flip state for next card
          setIsFlipped(!showFrontFirst);
          flipAnimation.setValue(showFrontFirst ? 0 : 180);
          cardOpacity.setValue(1);
          
          // Fetch intervals for the next card
          const nextWord = words[nextIndex];
          if (nextWord) {
            fetchNextReviewIntervals(nextWord);
          }
          
          // Check if we're getting low on cards (last 10 cards) - preload more
          // But NOT in 'new' mode — in 'new' mode the session ends after the initial batch
          if (nextIndex >= words.length - 10 && !loading && studyMode !== 'new') {
            console.log('[Flashcards] Running low on cards, loading more...');
            loadMoreCards();
          }
        } else {
          // Finished current batch
          if (studyMode === 'new') {
            // In 'new' mode, the session is done after the initial batch
            console.log('[Flashcards] New-words session complete!');
            if (completedWords.length > 0) {
              completeFlashcardActivity();
            }
            // Return to mode picker
            setStudyMode(null);
            setActiveDeckId(null);
            setActiveDeckName('');
            setWords([]);
            setCurrentIndex(0);
            setCompletedWords([]);
            setCompletedCardIndices([]);
            // Small delay so the last SRS update POST can complete before we refresh stats.
            // Cards marked 'Again' will then correctly appear under Due (not New).
            setTimeout(() => { loadSrsStats(); }, 600);
          } else {
            // For reviews/all, load more cards automatically
            console.log('[Flashcards] Batch complete, loading more cards...');
            loadMoreCards();
          }
        }
      });
      
      // Return the next index
      return nextIndex < words.length ? nextIndex : prevIndex;
    });
  }, [words, position, cardOpacity, flipAnimation, showFrontFirst, navigation, setActiveCorner, setCardTint, setBackgroundColor, cornerOpacities, cardTintOpacity, completeFlashcardActivity, studyMode, loadMoreCards, completedWords, loadSrsStats]);

  const flipCard = useCallback(() => {
    const newValue = isFlipped ? 0 : 180;
    Animated.spring(flipAnimation, {
      toValue: newValue,
      friction: 8,
      tension: 10,
      useNativeDriver: false,
    }).start();
    setIsFlipped(!isFlipped);
  }, [isFlipped, flipAnimation]);

  // Navigation functions
  const canNavigateBack = useMemo(() => {
    return completedCardIndices.length > 0 && currentIndex > 0;
  }, [completedCardIndices, currentIndex]);

  const canNavigateForward = useMemo(() => {
    // Can go forward if we've navigated back from a higher index
    // (i.e., there are cards we've seen that are ahead of current position)
    const maxCompletedIndex = Math.max(...completedCardIndices, -1);
    return currentIndex < maxCompletedIndex;
  }, [completedCardIndices, currentIndex]);

  const navigateBack = useCallback(() => {
    if (!canNavigateBack) return;
    
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    
    // Reset card position and flip state
    position.setValue({ x: 0, y: 0 });
    position.setOffset({ x: 0, y: 0 });
    setIsFlipped(!showFrontFirst);
    flipAnimation.setValue(showFrontFirst ? 0 : 180);
    cardOpacity.setValue(1);
    
    // Fetch intervals for the previous card
    const prevWord = words[prevIndex];
    if (prevWord) {
      fetchNextReviewIntervals(prevWord);
    }
  }, [canNavigateBack, currentIndex, position, flipAnimation, cardOpacity, showFrontFirst, words]);

  const navigateForward = useCallback(() => {
    if (!canNavigateForward) return;
    
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    
    // Reset card position and flip state
    position.setValue({ x: 0, y: 0 });
    position.setOffset({ x: 0, y: 0 });
    setIsFlipped(!showFrontFirst);
    flipAnimation.setValue(showFrontFirst ? 0 : 180);
    cardOpacity.setValue(1);
    
    // Fetch intervals for the next card
    const nextWord = words[nextIndex];
    if (nextWord) {
      fetchNextReviewIntervals(nextWord);
    }
  }, [canNavigateForward, currentIndex, position, flipAnimation, cardOpacity, showFrontFirst, words]);

  // Programmatically swipe card to a corner
  const swipeToCorner = useCallback((corner) => {
    if (words.length === 0 || activeCorner) return;
    
    // Determine the target position based on corner
    let targetX = 0;
    let targetY = 0;
    
    switch (corner) {
      case 'top-left':
        targetX = -SCREEN_WIDTH;
        targetY = -SCREEN_HEIGHT;
        break;
      case 'top-right':
        targetX = SCREEN_WIDTH;
        targetY = -SCREEN_HEIGHT;
        break;
      case 'bottom-left':
        targetX = -SCREEN_WIDTH;
        targetY = SCREEN_HEIGHT;
        break;
      case 'bottom-right':
        targetX = SCREEN_WIDTH;
        targetY = SCREEN_HEIGHT;
        break;
    }
    
    // Animate the card to the corner
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x: targetX, y: targetY },
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // After animation completes, call handleSwipe
      handleSwipe(corner);
    });
  }, [words, activeCorner, position, cardOpacity, handleSwipe]);

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const currentWord = useMemo(() => words[currentIndex], [words, currentIndex]);
  const progress = useMemo(() => 
    words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0,
    [words.length, currentIndex]
  );

  // Study mode selection screen
  if (!studyMode) {
    const dueCount = srsStats?.due_count || 0;
    const newCount = srsStats?.new_count || 0;
    const totalLearning = srsStats?.total_learning || 0;
    const totalMastered = srsStats?.total_mastered || 0;

    const openDeckDetail = (deck) => {
      navigation.navigate('DeckDetail', {
        language,
        deckId: deck.id,
        deckName: deck.name,
      });
    };

    const startDeleteDeck = (deck) => {
      const id = deck?.id;
      if (!id) return;
      setDeletePendingDeck(deck);
      setShowDeleteChoiceModal(true);
    };

    const handleDeleteChoiceThisDeckOnly = () => {
      const deck = deletePendingDeck;
      setShowDeleteChoiceModal(false);
      setDeletePendingDeck(null);
      if (!deck?.id) return;
      setDeleteSingleDeckId(deck.id);
      setDeleteConfirmMode('single');
      setShowDeleteConfirmModal(true);
    };

    const handleDeleteChoiceAlsoOtherLanguages = async () => {
      const deck = deletePendingDeck;
      if (!deck?.id) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/vocab/decks/${deck.id}/siblings`);
        const data = res.ok ? await res.json() : { decks: [] };
        const siblings = data.decks || [];
        const list = siblings.length > 0 ? siblings : [{ id: deck.id, name: deck.name, language: deck.language || language }];
        setDeleteDeckList(list);
        setDeleteDeckSelectedIds(new Set(list.map((d) => d.id)));
        setShowDeleteChoiceModal(false);
        setDeletePendingDeck(null);
        setShowDeleteDeckModal(true);
      } catch (e) {
        console.error('Error loading siblings:', e);
        setShowDeleteChoiceModal(false);
        setDeletePendingDeck(null);
      }
    };

    const executeDeleteSingle = async () => {
      const id = deleteSingleDeckId;
      setShowDeleteConfirmModal(false);
      setDeleteSingleDeckId(null);
      if (!id) return;
      try {
        await fetch(`${API_BASE_URL}/api/vocab/decks/${id}`, { method: 'DELETE' });
        loadDecks();
      } catch (e) {
        console.error('Error deleting deck:', e);
      }
    };

    const openMultiDeleteConfirm = () => {
      const selected = Array.from(deleteDeckSelectedIds);
      if (selected.length === 0) return;
      setShowDeleteDeckModal(false);
      setDeleteConfirmMode('multi');
      setShowDeleteConfirmModal(true);
    };

    const executeDeleteMulti = async () => {
      const selected = Array.from(deleteDeckSelectedIds);
      setShowDeleteConfirmModal(false);
      setDeleteDeckList([]);
      setDeleteDeckSelectedIds(new Set());
      for (const id of selected) {
        try {
          await fetch(`${API_BASE_URL}/api/vocab/decks/${id}`, { method: 'DELETE' });
        } catch (e) {
          console.error('Error deleting deck:', e);
        }
      }
      loadDecks();
    };

    const confirmDeleteSelectedDecks = () => {
      const selected = Array.from(deleteDeckSelectedIds);
      if (selected.length === 0) return;
      openMultiDeleteConfirm();
    };

    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerTitleRow}>
              <SafeText style={styles.headerTitle}>{"Flashcards"}</SafeText>
              <TouchableOpacity onPress={openTutor} style={styles.tutorIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="school" size={20} color="#4A90E2" />
                  <SafeText style={styles.tutorIconLabel}>Tutor</SafeText>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.transliterationButton, showTransliterations && styles.transliterationButtonActive]}
              onPress={() => setShowTransliterations(!showTransliterations)}
            >
              <Text style={styles.transliterationIcon}>Aa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langPickerButton}
              onPress={() => { loadAllLanguagesSrsStats(); setLanguageMenuVisible(true); }}
            >
              {(currentLanguage?.nativeChar || currentLanguage?.langCode) && (
                <View style={[styles.countryCodeBox, { backgroundColor: currentLanguage?.color || '#0FA896' }]}>
                  {currentLanguage?.nativeChar ? (
                    <SafeText style={[styles.nativeCharText, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                      {currentLanguage.nativeChar}
                    </SafeText>
                  ) : (
                    <SafeText style={styles.countryCodeText}>{currentLanguage?.langCode?.toUpperCase()}</SafeText>
                  )}
                </View>
              )}
              <View style={styles.languageButtonContent}>
                <SafeText style={styles.languageName} numberOfLines={1}>{currentLanguage?.name}</SafeText>
                {currentLanguage?.nativeName ? (
                  <SafeText style={[styles.languageNativeName, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={1}>
                    {currentLanguage.nativeName}
                  </SafeText>
                ) : null}
              </View>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={{flex: 1, backgroundColor: '#F5F5F5'}} contentContainerStyle={{padding: 20, paddingBottom: 40}}>
          {/* SRS Stats */}
          {srsStats ? (
            <View style={{flexDirection: 'row', gap: 12, marginBottom: 20}}>
              <View style={{flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2}}>
                <SafeText style={{fontSize: 28, fontWeight: '700', color: '#FF6B6B'}}>{String(dueCount)}</SafeText>
                <SafeText style={{fontSize: 12, color: '#888', marginTop: 2}}>{"Due"}</SafeText>
              </View>
              <View style={{flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2}}>
                <SafeText style={{fontSize: 28, fontWeight: '700', color: '#4A90E2'}}>{String(newCount)}</SafeText>
                <SafeText style={{fontSize: 12, color: '#888', marginTop: 2}}>{"New"}</SafeText>
              </View>
              <View style={{flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2}}>
                <SafeText style={{fontSize: 28, fontWeight: '700', color: '#8B5CF6'}}>{String(totalLearning)}</SafeText>
                <SafeText style={{fontSize: 12, color: '#888', marginTop: 2}}>{"Learning"}</SafeText>
              </View>
              <View style={{flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2}}>
                <SafeText style={{fontSize: 28, fontWeight: '700', color: '#50C878'}}>{String(totalMastered)}</SafeText>
                <SafeText style={{fontSize: 12, color: '#888', marginTop: 2}}>{"Mastered"}</SafeText>
              </View>
            </View>
          ) : (
            <ActivityIndicator size="small" color="#14B8A6" style={{marginVertical: 24}} />
          )}

          {/* SRS Study Modes */}
          <SafeText style={{fontSize: 13, fontWeight: '700', color: '#999', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase'}}>{"SRS Study"}</SafeText>
          <TouchableOpacity
            style={{backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderLeftWidth: 4, borderLeftColor: '#FF6B6B', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, opacity: dueCount === 0 ? 0.4 : 1}}
            onPress={() => setStudyMode('reviews')}
            disabled={dueCount === 0}
          >
            <View style={{width: 42, height: 42, borderRadius: 10, backgroundColor: '#FFE8E8', alignItems: 'center', justifyContent: 'center'}}>
              <Ionicons name="refresh-circle" size={22} color="#FF6B6B" />
            </View>
            <View style={{flex: 1}}>
              <SafeText style={{fontSize: 16, fontWeight: '600', color: '#1A1A1A'}}>{"Review Due Words"}</SafeText>
              <SafeText style={{fontSize: 13, color: '#888', marginTop: 2}}>{`${dueCount} cards ready for review`}</SafeText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderLeftWidth: 4, borderLeftColor: '#4A90E2', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, opacity: newCount === 0 ? 0.4 : 1}}
            onPress={() => setStudyMode('new')}
            disabled={newCount === 0}
          >
            <View style={{width: 42, height: 42, borderRadius: 10, backgroundColor: '#E8F4FD', alignItems: 'center', justifyContent: 'center'}}>
              <Ionicons name="add-circle" size={22} color="#4A90E2" />
            </View>
            <View style={{flex: 1}}>
              <SafeText style={{fontSize: 16, fontWeight: '600', color: '#1A1A1A'}}>{"Learn New Words"}</SafeText>
              <SafeText style={{fontSize: 13, color: '#888', marginTop: 2}}>{`${newCount} new words to learn`}</SafeText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderLeftWidth: 4, borderLeftColor: '#8B5CF6', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2}}
            onPress={() => setStudyMode('all')}
          >
            <View style={{width: 42, height: 42, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center'}}>
              <Ionicons name="layers" size={22} color="#8B5CF6" />
            </View>
            <View style={{flex: 1}}>
              <SafeText style={{fontSize: 16, fontWeight: '600', color: '#1A1A1A'}}>{"Mixed Study"}</SafeText>
              <SafeText style={{fontSize: 13, color: '#888', marginTop: 2}}>{"Reviews + new words combined"}</SafeText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#CCC" />
          </TouchableOpacity>

          {/* Imported Decks Section */}
          <TouchableOpacity
            style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}
            onPress={() => setDecksExpanded(!decksExpanded)}
            activeOpacity={0.7}
          >
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <Ionicons name="albums" size={16} color="#16A34A" />
              <SafeText style={{fontSize: 13, fontWeight: '700', color: '#16A34A', letterSpacing: 0.5, textTransform: 'uppercase'}}>{"Imported Decks"}</SafeText>
              {decks.length > 0 && (
                <View style={{backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2}}>
                  <SafeText style={{fontSize: 11, fontWeight: '700', color: '#16A34A'}}>{String(decks.length)}</SafeText>
                </View>
              )}
            </View>
            <Ionicons name={decksExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#999" />
          </TouchableOpacity>

          {decksExpanded && (
            decksLoading ? (
              <ActivityIndicator size="small" color="#16A34A" style={{marginVertical: 12}} />
            ) : decks.length === 0 ? (
              <View style={{backgroundColor: '#FFF', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0', borderStyle: 'dashed', marginBottom: 12}}>
                <Ionicons name="albums-outline" size={32} color="#CCC" />
                <SafeText style={{fontSize: 14, color: '#AAA', marginTop: 8, textAlign: 'center'}}>{"No imported decks yet.\nUse Import Vocab to add words."}</SafeText>
              </View>
            ) : (
              <View style={{gap: 10, marginBottom: 12}}>
                {/* Study all imported decks */}
                <TouchableOpacity
                  style={{backgroundColor: '#FFFBEB', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#F59E0B'}}
                  onPress={() => {
                    setActiveDeckId('all');
                    setActiveDeckName('All Imported Decks');
                    setStudyMode('deck');
                    setCurrentIndex(0);
                    setCompletedWords([]);
                    setCompletedCardIndices([]);
                  }}
                >
                  <View style={{width: 42, height: 42, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center'}}>
                    <Ionicons name="library" size={22} color="#16A34A" />
                  </View>
                  <View style={{flex: 1}}>
                    <SafeText style={{fontSize: 15, fontWeight: '700', color: '#92400E'}}>{"All Imported Decks"}</SafeText>
                    <SafeText style={{fontSize: 12, color: '#16A34A', marginTop: 2}}>
                      {`${decks.reduce((s, d) => s + (d.word_count || 0), 0)} words across ${decks.length} deck${decks.length !== 1 ? 's' : ''}`}
                    </SafeText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
                </TouchableOpacity>

                {/* Individual decks */}
                {decks.map((deck) => {
                  const isTranslated = deck.is_translated === 1 || deck.is_translated === true || (deck.base_language && deck.base_language !== language);
                  return (
                  <View
                    key={deck.id}
                    style={{backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderLeftWidth: 4, borderLeftColor: '#16A34A', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2}}
                  >
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}
                      onPress={() => openDeckDetail(deck)}
                      activeOpacity={0.7}
                    >
                      <View style={{width: 42, height: 42, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center'}}>
                        <Ionicons name="albums" size={22} color="#16A34A" />
                      </View>
                      <View style={{flex: 1}}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <SafeText style={{fontSize: 15, fontWeight: '600', color: '#1A1A1A'}} numberOfLines={1}>
                            {deck.name || `Deck ${deck.id}`}
                          </SafeText>
                          {isTranslated && (
                            <View style={{ backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="language-outline" size={11} color="#4F46E5" style={{ marginRight: 3 }} />
                              <SafeText style={{ fontSize: 11, fontWeight: '600', color: '#4F46E5' }}>Translated</SafeText>
                            </View>
                          )}
                        </View>
                        <SafeText style={{fontSize: 12, color: '#888', marginTop: 2}}>
                          {`${deck.word_count || 0} word${(deck.word_count || 0) !== 1 ? 's' : ''}`}
                          {deck.created_at ? `  ·  ${new Date(deck.created_at).toLocaleDateString()}` : ''}
                        </SafeText>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => startDeleteDeck(deck)}
                      style={{ padding: 12, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={22} color="#B91C1C" />
                    </TouchableOpacity>
                  </View>
                )})}
              </View>
            )
          )}
        </ScrollView>
        {/* Delete choice modal: this deck only vs also other languages */}
        <Modal
          visible={showDeleteChoiceModal}
          transparent
          animationType="fade"
          onRequestClose={() => { setShowDeleteChoiceModal(false); setDeletePendingDeck(null); }}
        >
          <TouchableOpacity
            style={styles.langModalOverlay}
            activeOpacity={1}
            onPress={() => { setShowDeleteChoiceModal(false); setDeletePendingDeck(null); }}
          >
            <View style={styles.langModalMenu} onStartShouldSetResponder={() => true}>
              <SafeText style={styles.langModalTitle}>Delete deck</SafeText>
              <SafeText style={{ fontSize: 14, color: '#4B5563', marginBottom: 16 }}>
                Delete only this deck, or also delete this deck in other languages?
              </SafeText>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity
                  style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                  onPress={() => { setShowDeleteChoiceModal(false); setDeletePendingDeck(null); }}
                >
                  <SafeText style={{ fontSize: 15, color: '#6B7280' }}>Cancel</SafeText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#E5E7EB', borderRadius: 8 }}
                  onPress={handleDeleteChoiceThisDeckOnly}
                >
                  <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>This deck only</SafeText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#B91C1C', borderRadius: 8 }}
                  onPress={handleDeleteChoiceAlsoOtherLanguages}
                >
                  <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Also delete in other languages</SafeText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
        {/* Delete confirm modal */}
        <Modal
          visible={showDeleteConfirmModal}
          transparent
          animationType="fade"
          onRequestClose={() => { setShowDeleteConfirmModal(false); setDeleteSingleDeckId(null); }}
        >
          <TouchableOpacity
            style={styles.langModalOverlay}
            activeOpacity={1}
            onPress={() => { setShowDeleteConfirmModal(false); setDeleteSingleDeckId(null); }}
          >
            <View style={styles.langModalMenu} onStartShouldSetResponder={() => true}>
              <SafeText style={styles.langModalTitle}>Are you sure?</SafeText>
              <SafeText style={{ fontSize: 14, color: '#4B5563', marginBottom: 16 }}>
                {deleteConfirmMode === 'single'
                  ? 'This will permanently delete this deck and all its cards. This cannot be undone.'
                  : `This will permanently delete ${deleteDeckSelectedIds.size} deck(s) and all their cards. This cannot be undone.`}
              </SafeText>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <TouchableOpacity
                  style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                  onPress={() => { setShowDeleteConfirmModal(false); setDeleteSingleDeckId(null); }}
                >
                  <SafeText style={{ fontSize: 15, color: '#6B7280' }}>Cancel</SafeText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#B91C1C', borderRadius: 8 }}
                  onPress={deleteConfirmMode === 'single' ? executeDeleteSingle : executeDeleteMulti}
                >
                  <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Delete</SafeText>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
        {/* Delete deck(s) selection modal */}
        <Modal
          visible={showDeleteDeckModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteDeckModal(false)}
        >
          <TouchableOpacity
            style={styles.langModalOverlay}
            activeOpacity={1}
            onPress={() => setShowDeleteDeckModal(false)}
          >
            <TouchableOpacity
              style={[styles.langModalMenu, { maxHeight: '70%' }]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <SafeText style={styles.langModalTitle}>Select decks to delete</SafeText>
              <ScrollView style={{ maxHeight: 320 }}>
                {deleteDeckList.map((d) => {
                  const langMeta = availableLanguages?.find((l) => l.code === d.language) || { name: d.language };
                  const selected = deleteDeckSelectedIds.has(d.id);
                  const cardBg = selected ? '#EFF6FF' : '#FFFFFF';
                  const borderColor = selected ? '#3B82F6' : 'transparent';
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.langModalOption, { backgroundColor: cardBg, borderColor }]}
                      onPress={() => {
                        setDeleteDeckSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(d.id)) next.delete(d.id);
                          else next.add(d.id);
                          return next;
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.langModalCodeBox, { backgroundColor: langMeta.color || '#4A90E2' }]}>
                        {langMeta.nativeChar ? (
                          <SafeText
                            style={[
                              styles.langModalNativeChar,
                              langMeta.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' },
                            ]}
                          >
                            {String(langMeta.nativeChar)}
                          </SafeText>
                        ) : (
                          <SafeText style={styles.langModalCodeText}>
                            {String(langMeta.langCode?.toUpperCase() || d.language?.slice(0, 2).toUpperCase())}
                          </SafeText>
                        )}
                      </View>
                      <View style={styles.langModalOptionContent}>
                        <SafeText
                          style={[
                            styles.langModalOptionText,
                            selected && styles.langModalOptionTextSelected,
                          ]}
                        >
                          {String(langMeta.name)}
                        </SafeText>
                        <SafeText style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{d.name}</SafeText>
                      </View>
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={selected ? '#16A34A' : '#9CA3AF'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
                <TouchableOpacity
                  style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                  onPress={() => setShowDeleteDeckModal(false)}
                >
                  <SafeText style={{ fontSize: 15, color: '#6B7280' }}>Cancel</SafeText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#B91C1C', borderRadius: 8 }}
                  onPress={confirmDeleteSelectedDecks}
                >
                  <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Delete</SafeText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
        {/* Language Selector Modal */}
        <Modal
          visible={languageMenuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setLanguageMenuVisible(false)}
        >
          <TouchableOpacity
            style={styles.langModalOverlay}
            activeOpacity={1}
            onPress={() => setLanguageMenuVisible(false)}
          >
            <View style={styles.langModalMenu}>
              <SafeText style={styles.langModalTitle}>Select Language</SafeText>
              {availableLanguages.map((lang) => {
                const isSelected = language === lang.code;
                const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
                const cardBg = isSelected ? '#EFF6FF' : '#FFFFFF';
                const borderColor = isSelected ? '#3B82F6' : 'transparent';
                const nameColor = isSelected ? '#2563EB' : '#1A1A1A';
                const nativeColor = isSelected ? '#2563EB' : '#666666';
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langModalOption, { backgroundColor: cardBg, borderColor }]}
                    onPress={() => {
                      setSelectedLanguage(lang.code);
                      setLanguageMenuVisible(false);
                    }}
                    activeOpacity={0.8}
                  >
                    {(lang.nativeChar || lang.langCode) && (
                      <View style={[styles.langModalCodeBox, { backgroundColor: lang.color || '#4A90E2' }]}>
                        {lang.nativeChar ? (
                          <SafeText
                            style={[
                              styles.langModalNativeChar,
                              lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' },
                            ]}
                          >
                            {String(lang.nativeChar)}
                          </SafeText>
                        ) : (
                          <SafeText style={styles.langModalCodeText}>{String(lang.langCode?.toUpperCase())}</SafeText>
                        )}
                      </View>
                    )}
                    <View style={styles.langModalOptionContent}>
                      <SafeText
                        style={[
                          styles.langModalOptionText,
                          { color: nameColor },
                          !lang.active && styles.langModalOptionTextDisabled,
                        ]}
                      >
                        {String(lang.name)}
                      </SafeText>
                      {lang.nativeName && (
                        <SafeText
                          style={[
                            styles.langModalNativeName,
                            { color: nativeColor },
                            lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' },
                          ]}
                        >
                          {String(lang.nativeName)}
                        </SafeText>
                      )}
                    </View>
                    <View style={styles.langSrsChips}>
                      <View style={styles.langSrsChipNew}>
                        <Ionicons name="add-circle" size={16} color="#4A90E2" />
                        <SafeText style={styles.langSrsChipTextNew}>{langStats.new_count || 0}</SafeText>
                      </View>
                      <View style={styles.langSrsChipDue}>
                        <Ionicons name="alarm" size={16} color="#FF6B6B" />
                        <SafeText style={styles.langSrsChipTextDue}>{langStats.due_count || 0}</SafeText>
                      </View>
                    </View>
                    {!lang.active && <Ionicons name="lock-closed" size={16} color="#CCC" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerTitleRow}>
              <SafeText style={styles.headerTitle}>Flashcards</SafeText>
              <TouchableOpacity onPress={openTutor} style={styles.tutorIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="school" size={20} color="#4A90E2" />
                  <SafeText style={styles.tutorIconLabel}>Tutor</SafeText>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setShowTransliterations(!showTransliterations)}
              style={[styles.transliterationButton, showTransliterations && styles.transliterationButtonActive]}
            >
              <Text style={styles.transliterationIcon}>Aa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langPickerButton}
              onPress={() => { loadAllLanguagesSrsStats(); setLanguageMenuVisible(true); }}
            >
              {(currentLanguage?.nativeChar || currentLanguage?.langCode) && (
                <View style={[styles.countryCodeBox, { backgroundColor: currentLanguage?.color || '#0FA896' }]}>
                  {currentLanguage?.nativeChar ? (
                    <SafeText style={[styles.nativeCharText, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                      {currentLanguage.nativeChar}
                    </SafeText>
                  ) : (
                    <SafeText style={styles.countryCodeText}>{currentLanguage?.langCode?.toUpperCase()}</SafeText>
                  )}
                </View>
              )}
              <View style={styles.languageButtonContent}>
                <SafeText style={styles.languageName} numberOfLines={1}>{currentLanguage?.name}</SafeText>
                {currentLanguage?.nativeName ? (
                  <SafeText style={[styles.languageNativeName, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={1}>
                    {currentLanguage.nativeName}
                  </SafeText>
                ) : null}
              </View>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#14B8A6" />
          <SafeText style={styles.loadingText}>Loading flashcards...</SafeText>
        </View>
        {/* Language Selector Modal (shared) */}
        <Modal visible={languageMenuVisible} transparent={true} animationType="fade" onRequestClose={() => setLanguageMenuVisible(false)}>
          <TouchableOpacity style={styles.langModalOverlay} activeOpacity={1} onPress={() => setLanguageMenuVisible(false)}>
            <View style={styles.langModalMenu}>
              <SafeText style={styles.langModalTitle}>Select Language</SafeText>
              {availableLanguages.map((lang) => {
                const isSelected = language === lang.code;
                const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
                const cardBg = isSelected ? '#EFF6FF' : '#FFFFFF';
                const borderColor = isSelected ? '#3B82F6' : 'transparent';
                const nameColor = isSelected ? '#2563EB' : '#1A1A1A';
                const nativeColor = isSelected ? '#2563EB' : '#666666';
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langModalOption, { backgroundColor: cardBg, borderColor }]}
                    onPress={() => { setSelectedLanguage(lang.code); setLanguageMenuVisible(false); }}
                    activeOpacity={0.8}
                  >
                    {(lang.nativeChar || lang.langCode) && (
                      <View style={[styles.langModalCodeBox, { backgroundColor: lang.color || '#4A90E2' }]}>
                        {lang.nativeChar ? (
                          <SafeText style={[styles.langModalNativeChar, lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                            {String(lang.nativeChar)}
                          </SafeText>
                        ) : (
                          <SafeText style={styles.langModalCodeText}>{String(lang.langCode?.toUpperCase())}</SafeText>
                        )}
                      </View>
                    )}
                    <View style={styles.langModalOptionContent}>
                      <SafeText
                        style={[
                          styles.langModalOptionText,
                          { color: nameColor },
                          !lang.active && styles.langModalOptionTextDisabled,
                        ]}
                      >
                        {String(lang.name)}
                      </SafeText>
                      {lang.nativeName && (
                        <SafeText
                          style={[
                            styles.langModalNativeName,
                            { color: nativeColor },
                            lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' },
                          ]}
                        >
                          {String(lang.nativeName)}
                        </SafeText>
                      )}
                    </View>
                    <View style={styles.langSrsChips}>
                      <View style={styles.langSrsChipNew}>
                        <Ionicons name="add-circle" size={16} color="#4A90E2" />
                        <SafeText style={styles.langSrsChipTextNew}>{langStats.new_count || 0}</SafeText>
                      </View>
                      <View style={styles.langSrsChipDue}>
                        <Ionicons name="alarm" size={16} color="#FF6B6B" />
                        <SafeText style={styles.langSrsChipTextDue}>{langStats.due_count || 0}</SafeText>
                      </View>
                    </View>
                    {!lang.active && <Ionicons name="lock-closed" size={16} color="#CCC" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  if (!currentWord) {
    // Get localized text
    const localizedText = FLASHCARD_LOCALIZATION[language] || FLASHCARD_LOCALIZATION.tamil;

    // In deck mode, words start empty until loadDeckWords completes. Show loading instead of "finished".
    if (studyMode === 'deck' && words.length === 0 && loading) {
      return (
        <View style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerTitleRow}>
                <SafeText style={styles.headerTitle} numberOfLines={1}>{activeDeckName || localizedText.headerTitle.text}</SafeText>
                <TouchableOpacity onPress={openTutor} style={styles.tutorIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="school" size={20} color="#4A90E2" />
                    <SafeText style={styles.tutorIconLabel}>Tutor</SafeText>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => setShowTransliterations(!showTransliterations)} style={styles.transliterationButton}>
                <Text style={styles.transliterationIcon}>Aa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.langPickerButton} onPress={() => { loadAllLanguagesSrsStats(); setLanguageMenuVisible(true); }}>
                {(currentLanguage?.nativeChar || currentLanguage?.langCode) && (
                  <View style={[styles.countryCodeBox, { backgroundColor: currentLanguage?.color || '#0FA896' }]}>
                    {currentLanguage?.nativeChar ? (
                      <SafeText style={[styles.nativeCharText, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                        {currentLanguage.nativeChar}
                      </SafeText>
                    ) : (
                      <SafeText style={styles.countryCodeText}>{currentLanguage?.langCode?.toUpperCase()}</SafeText>
                    )}
                  </View>
                )}
                <View style={styles.languageButtonContent}>
                  <SafeText style={styles.languageName} numberOfLines={1}>{currentLanguage?.name}</SafeText>
                  {currentLanguage?.nativeName ? (
                    <SafeText style={[styles.languageNativeName, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={1}>
                      {currentLanguage.nativeName}
                    </SafeText>
                  ) : null}
                </View>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <ActivityIndicator size="large" color="#14B8A6" />
            <SafeText style={{ fontSize: 16, color: '#666', marginTop: 16 }}>Loading deck...</SafeText>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <View style={styles.headerTitleRow}>
              <SafeText style={styles.headerTitle}>{localizedText.headerTitle.text}</SafeText>
              <TouchableOpacity onPress={openTutor} style={styles.tutorIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="school" size={20} color="#4A90E2" />
                  <SafeText style={styles.tutorIconLabel}>Tutor</SafeText>
                </View>
              </TouchableOpacity>
            </View>
            {showTransliterations && (
              <SafeText style={styles.headerTitleTranslit}>{localizedText.headerTitle.transliteration}</SafeText>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setShowTransliterations(!showTransliterations)}
              style={styles.transliterationButton}
            >
              <Text style={styles.transliterationIcon}>Aa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.langPickerButton}
              onPress={() => { loadAllLanguagesSrsStats(); setLanguageMenuVisible(true); }}
            >
              {(currentLanguage?.nativeChar || currentLanguage?.langCode) && (
                <View style={[styles.countryCodeBox, { backgroundColor: currentLanguage?.color || '#0FA896' }]}>
                  {currentLanguage?.nativeChar ? (
                    <SafeText style={[styles.nativeCharText, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                      {currentLanguage.nativeChar}
                    </SafeText>
                  ) : (
                    <SafeText style={styles.countryCodeText}>{currentLanguage?.langCode?.toUpperCase()}</SafeText>
                  )}
                </View>
              )}
              <View style={styles.languageButtonContent}>
                <SafeText style={styles.languageName} numberOfLines={1}>{currentLanguage?.name}</SafeText>
                {currentLanguage?.nativeName ? (
                  <SafeText style={[styles.languageNativeName, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' }]} numberOfLines={1}>
                    {currentLanguage.nativeName}
                  </SafeText>
                ) : null}
              </View>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.emptyContainer}
          showsVerticalScrollIndicator={false}
        >
          {srsStats ? (
            <>
              <View style={styles.completionIconContainer}>
                <Ionicons name="trophy" size={64} color="#F59E0B" />
              </View>
              <SafeText style={styles.emptyTitle}>{localizedText.completionTitle.text}</SafeText>
              {showTransliterations && (
                <SafeText style={styles.emptyTitleTranslit}>{localizedText.completionTitle.transliteration}</SafeText>
              )}
              <SafeText style={styles.emptySubtext}>{localizedText.completionSubtext.text}</SafeText>
              {showTransliterations && (
                <SafeText style={styles.emptySubtextTranslit}>{localizedText.completionSubtext.transliteration}</SafeText>
              )}
{/* SRS Stats Display */}
              <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                  <SafeText style={styles.statNumber}>{srsStats.today_new_completed || 0} / {srsStats.today_new_quota || 0}</SafeText>
                  <SafeText style={styles.statLabel}>{localizedText.newCards.text}</SafeText>
                  {showTransliterations && (
                    <SafeText style={styles.statLabelTranslit}>{localizedText.newCards.transliteration}</SafeText>
                  )}
                </View>
                <View style={styles.statBox}>
                  <SafeText style={styles.statNumber}>{srsStats.today_reviews_completed || 0} / {srsStats.today_reviews_quota || 0}</SafeText>
                  <SafeText style={styles.statLabel}>{localizedText.reviews.text}</SafeText>
                  {showTransliterations && (
                    <SafeText style={styles.statLabelTranslit}>{localizedText.reviews.transliteration}</SafeText>
                  )}
                </View>
              </View>
              
              <View style={styles.overviewContainer}>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewLabelContainer}>
                    <SafeText style={styles.overviewLabel}>{localizedText.mastered.text}</SafeText>
                    {showTransliterations && (
                      <SafeText style={styles.overviewLabelTranslit}>{localizedText.mastered.transliteration}</SafeText>
                    )}
                  </View>
                  <SafeText style={styles.overviewValue}>{srsStats.total_mastered ? srsStats.total_mastered.toLocaleString() : 0}</SafeText>
                </View>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewLabelContainer}>
                    <SafeText style={styles.overviewLabel}>{localizedText.learning.text}</SafeText>
                    {showTransliterations && (
                      <SafeText style={styles.overviewLabelTranslit}>{localizedText.learning.transliteration}</SafeText>
                    )}
                  </View>
                  <SafeText style={styles.overviewValue}>{srsStats.total_learning ? srsStats.total_learning.toLocaleString() : 0}</SafeText>
                </View>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewLabelContainer}>
                    <SafeText style={styles.overviewLabel}>{localizedText.newAvailable.text}</SafeText>
                    {showTransliterations && (
                      <SafeText style={styles.overviewLabelTranslit}>{localizedText.newAvailable.transliteration}</SafeText>
                    )}
                  </View>
                  <SafeText style={styles.overviewValue}>{srsStats.total_new ? srsStats.total_new.toLocaleString() : 0}</SafeText>
                </View>
              </View>
{/* Learn More Button */}
              <TouchableOpacity
                style={styles.learnMoreButton}
                onPress={async () => {
                  setLoading(true);
                  try {
                    // Fetch extra cards beyond quota (ignoring SRS restrictions)
                    const response = await fetch(`${API_BASE_URL}/api/vocabulary/${language}?limit=50`);
                    const data = await response.json();
                    const extraWords = data.words || [];
                    
                    // DETERMINISTIC BIDIRECTIONAL TESTING:
                    // Each word gets TWO cards - one for each direction
                    const extraWordsWithBothDirections = [];
                    extraWords.forEach(word => {
                      // Card 1: English → Native
                      extraWordsWithBothDirections.push({
                        ...word,
                        cardDirection: 'english-to-native',
                        originalWordId: word.id,
                      });
                      // Card 2: Native → English
                      extraWordsWithBothDirections.push({
                        ...word,
                        cardDirection: 'native-to-english',
                        originalWordId: word.id,
                      });
                    });
                    
                    // IMPROVED SHUFFLING: Distribute cards evenly
                    let finalWords = extraWordsWithBothDirections;
                    if (shuffleCards) {
                      finalWords = [...extraWordsWithBothDirections].sort(() => Math.random() - 0.5);
                    } else {
                      // Smart interleaving: Mix cards from different words
                      const englishToNative = [];
                      const nativeToEnglish = [];
                      
                      for (let i = 0; i < extraWords.length; i++) {
                        englishToNative.push(extraWordsWithBothDirections[i * 2]);
                        nativeToEnglish.push(extraWordsWithBothDirections[i * 2 + 1]);
                      }
                      
                      // Shuffle each direction array independently
                      const shuffledEn = [...englishToNative].sort(() => Math.random() - 0.5);
                      const shuffledNative = [...nativeToEnglish].sort(() => Math.random() - 0.5);
                      
                      // Interleave them
                      const interleaved = [];
                      const maxLength = Math.max(shuffledEn.length, shuffledNative.length);
                      for (let i = 0; i < maxLength; i++) {
                        if (i < shuffledEn.length) interleaved.push(shuffledEn[i]);
                        if (i < shuffledNative.length) interleaved.push(shuffledNative[i]);
                      }
                      
                      finalWords = interleaved;
                    }
                    
                    if (finalWords.length > 0) {
                      setWords(finalWords);
                      setCurrentIndex(0);
                      setIsFlipped(!showFrontFirst);
                      flipAnimation.setValue(showFrontFirst ? 0 : 180);
                    }
                  } catch (error) {
                    console.error('Error loading extra cards:', error);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <SafeText style={styles.learnMoreButtonText}>{localizedText.learnMore.text}</SafeText>
                {showTransliterations && (
                  <SafeText style={styles.learnMoreButtonTranslit}>{localizedText.learnMore.transliteration}</SafeText>
                )}
              </TouchableOpacity>
              
              <SafeText style={styles.comeBackText}>{localizedText.comeBackTomorrow.text}</SafeText>
              {showTransliterations && (
                <SafeText style={styles.comeBackTextTranslit}>{localizedText.comeBackTomorrow.transliteration}</SafeText>
              )}
            </>
          ) : (
            <SafeText style={styles.emptyText}>No words available</SafeText>
          )}
        </ScrollView>
        {/* Language Selector Modal */}
        <Modal visible={languageMenuVisible} transparent={true} animationType="fade" onRequestClose={() => setLanguageMenuVisible(false)}>
          <TouchableOpacity style={styles.langModalOverlay} activeOpacity={1} onPress={() => setLanguageMenuVisible(false)}>
            <View style={styles.langModalMenu}>
              <SafeText style={styles.langModalTitle}>Select Language</SafeText>
              {availableLanguages.map((lang) => {
                const isSelected = language === lang.code;
                const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
                const cardBg = isSelected ? '#EFF6FF' : '#FFFFFF';
                const borderColor = isSelected ? '#3B82F6' : 'transparent';
                const nameColor = isSelected ? '#2563EB' : '#1A1A1A';
                const nativeColor = isSelected ? '#2563EB' : '#666666';
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langModalOption, { backgroundColor: cardBg, borderColor }]}
                    onPress={() => { setSelectedLanguage(lang.code); setLanguageMenuVisible(false); }}
                    activeOpacity={0.8}
                  >
                    {(lang.nativeChar || lang.langCode) && (
                      <View style={[styles.langModalCodeBox, { backgroundColor: lang.color || '#4A90E2' }]}>
                        {lang.nativeChar ? (
                          <SafeText style={[styles.langModalNativeChar, lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                            {String(lang.nativeChar)}
                          </SafeText>
                        ) : (
                          <SafeText style={styles.langModalCodeText}>{String(lang.langCode?.toUpperCase())}</SafeText>
                        )}
                      </View>
                    )}
                    <View style={styles.langModalOptionContent}>
                      <SafeText
                        style={[
                          styles.langModalOptionText,
                          { color: nameColor },
                          !lang.active && styles.langModalOptionTextDisabled,
                        ]}
                      >
                        {String(lang.name)}
                      </SafeText>
                      {lang.nativeName && (
                        <SafeText
                          style={[
                            styles.langModalNativeName,
                            { color: nativeColor },
                            lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' },
                          ]}
                        >
                          {String(lang.nativeName)}
                        </SafeText>
                      )}
                    </View>
                    <View style={styles.langSrsChips}>
                      <View style={styles.langSrsChipNew}>
                        <Ionicons name="add-circle" size={16} color="#4A90E2" />
                        <SafeText style={styles.langSrsChipTextNew}>{langStats.new_count || 0}</SafeText>
                      </View>
                      <View style={styles.langSrsChipDue}>
                        <Ionicons name="alarm" size={16} color="#FF6B6B" />
                        <SafeText style={styles.langSrsChipTextDue}>{langStats.due_count || 0}</SafeText>
                      </View>
                    </View>
                    {!lang.active && <Ionicons name="lock-closed" size={16} color="#CCC" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  const localizedText = FLASHCARD_LOCALIZATION[language] || FLASHCARD_LOCALIZATION.tamil;

  // Back press during study: deck mode goes back to picker, otherwise navigate back
  const handleBackPress = () => {
    if (studyMode) {
      setStudyMode(null);
      setWords([]);
      setCurrentIndex(0);
      setCompletedWords([]);
      setCompletedCardIndices([]);
      setActiveDeckId(null);
      setActiveDeckName('');
      loadedForModeRef.current = null;
      loadSrsStats();
    } else {
      navigation.goBack();
    }
  };

  // Header title: deck name if in deck mode, else localized language title
  const headerDisplayTitle = studyMode === 'deck' && activeDeckName
    ? activeDeckName
    : localizedText.headerTitle.text;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerTitleRow}>
            <SafeText style={styles.headerTitle} numberOfLines={1}>{headerDisplayTitle}</SafeText>
            {studyMode === 'deck' && activeDeckId ? (
              <TouchableOpacity
                onPress={() => { setRenameInput(activeDeckName); setRenameModalVisible(true); }}
                style={{ padding: 6, marginLeft: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={openTutor} style={styles.tutorIconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="school" size={20} color="#4A90E2" />
                <SafeText style={styles.tutorIconLabel}>Tutor</SafeText>
              </View>
            </TouchableOpacity>
          </View>
          {showTransliterations && studyMode !== 'deck' && (
            <SafeText style={styles.headerTitleTranslit}>{localizedText.headerTitle.transliteration}</SafeText>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowTransliterations(!showTransliterations)}
            style={[styles.transliterationButton, showTransliterations && styles.transliterationButtonActive]}
          >
            <Text style={styles.transliterationIcon}>Aa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.langPickerButton}
            onPress={() => { loadAllLanguagesSrsStats(); setLanguageMenuVisible(true); }}
          >
            {(currentLanguage?.nativeChar || currentLanguage?.langCode) && (
              <View style={[styles.countryCodeBox, { backgroundColor: currentLanguage?.color || '#0FA896' }]}>
                {currentLanguage?.nativeChar ? (
                  <SafeText style={[styles.nativeCharText, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                    {currentLanguage.nativeChar}
                  </SafeText>
                ) : (
                  <SafeText style={styles.countryCodeText}>{currentLanguage?.langCode?.toUpperCase()}</SafeText>
                )}
              </View>
            )}
            <View style={styles.languageButtonContent}>
              <SafeText style={styles.languageName} numberOfLines={1}>{currentLanguage?.name}</SafeText>
              {currentLanguage?.nativeName ? (
                <SafeText style={[styles.languageNativeName, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]} numberOfLines={1}>
                  {currentLanguage.nativeName}
                </SafeText>
              ) : null}
            </View>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
{/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <SafeText style={styles.progressText}>
          {currentIndex + 1} / {words.length}
        </SafeText>
      </View>
{/* Corner Indicators */}
      <View style={styles.cornerIndicators}>
        {Object.keys(COMFORT_LEVELS).map((corner) => {
          const cornerData = COMFORT_LEVELS[corner];
          const isActive = activeCorner === corner;
          
          // Map corner key to style name
          const cornerStyleMap = {
            'top-left': styles.topLeft,
            'top-right': styles.topRight,
            'bottom-left': styles.bottomLeft,
            'bottom-right': styles.bottomRight,
          };
          
          // Get interval days for this corner
          const intervalDays = nextReviewIntervals && nextReviewIntervals[cornerData.comfort_level] 
            ? nextReviewIntervals[cornerData.comfort_level].interval_days 
            : null;
          
          return (
            <TouchableOpacity
              key={corner}
              activeOpacity={0.6}
              onPressIn={() => setPressedCorner(corner)}
              onPressOut={() => setPressedCorner(null)}
              onPress={() => {
                if (words.length > 0 && !activeCorner) {
                  swipeToCorner(corner);
                }
                setPressedCorner(null);
              }}
              style={[
                styles.cornerIndicator,
                cornerStyleMap[corner],
                {
                  backgroundColor: isActive 
                    ? cornerData.color 
                    : pressedCorner === corner 
                      ? cornerData.lightColor 
                      : 'transparent',
                },
              ]}
            >
              <Animated.View
                style={{
                  opacity: cornerOpacities[corner],
                  transform: [{ 
                    scale: isActive 
                      ? 1.1 
                      : pressedCorner === corner 
                        ? 0.95 
                        : 1 
                  }],
                  alignItems: 'center',
                }}
              >
                <Ionicons 
                  name={cornerData.icon} 
                  size={24} 
                  color={isActive ? "#FFFFFF" : cornerData.brightColor}
                  style={styles.cornerIcon}
                />
                <View style={styles.cornerLabelContainer}>
                  <Text style={[
                    styles.cornerLabel, 
                    { color: isActive ? "#FFFFFF" : cornerData.brightColor },
                    language === 'urdu' && { fontFamily: 'NafeesNastaleeq' }
                  ]}>
                    {FLASHCARD_LOCALIZATION[language]?.[cornerData.comfort_level]?.text || cornerData.label}
                  </Text>
                  {showTransliterations && FLASHCARD_LOCALIZATION[language]?.[cornerData.comfort_level]?.transliteration && (
                    <Text style={[styles.cornerTranslit, { color: isActive ? "#FFFFFF" : cornerData.brightColor }]}>
                      {FLASHCARD_LOCALIZATION[language]?.[cornerData.comfort_level]?.transliteration}
                    </Text>
                  )}
                </View>
                {intervalDays !== null && (
                  <View style={styles.cornerIntervalContainer}>
                    <Text style={[styles.cornerInterval, { color: isActive ? "#FFFFFF" : cornerData.brightColor }]}>
                      {intervalDays === 0 
                        ? `<1${(localizedText.days?.text || 'days').charAt(0).toLowerCase()}` 
                        : intervalDays < 1 
                          ? `${Math.round(intervalDays * 24)}${(localizedText.hours?.text || 'hours').charAt(0).toLowerCase()}` 
                          : `${Math.round(intervalDays)}${(localizedText.days?.text || 'days').charAt(0).toLowerCase()}`}
                    </Text>
                    {showTransliterations && (
                      <Text style={[styles.cornerIntervalTranslit, { color: isActive ? "#FFFFFF" : cornerData.brightColor }]}>
                        {intervalDays === 0 
                          ? `<1${(localizedText.days?.transliteration || 'd').charAt(0).toLowerCase()}` 
                          : intervalDays < 1 
                            ? `${Math.round(intervalDays * 24)}${(localizedText.hours?.transliteration || 'h').charAt(0).toLowerCase()}` 
                            : `${Math.round(intervalDays)}${(localizedText.days?.transliteration || 'd').charAt(0).toLowerCase()}`}
                      </Text>
                    )}
                  </View>
                )}
              </Animated.View>
            </TouchableOpacity>
          );
        })}
{/* Previous Card Button - Bottom Center - Always visible */}
        <TouchableOpacity
          style={[
            styles.previousCardButton,
            (!canNavigateBack || previousButtonDisabled) && styles.previousCardButtonDisabled
          ]}
          onPress={() => {
            if (!previousButtonDisabled && canNavigateBack) {
              setPreviousButtonDisabled(true);
              navigateBack();
            }
          }}
          disabled={!canNavigateBack || previousButtonDisabled}
        >
          <View style={styles.previousCardContent}>
            <Ionicons 
              name="arrow-back-circle" 
              size={18} 
              color={(!canNavigateBack || previousButtonDisabled) ? "#666666" : "#FFFFFF"} 
            />
            <SafeText style={[
              styles.previousCardText,
              (!canNavigateBack || previousButtonDisabled) && styles.previousCardTextDisabled,
              language === 'urdu' && { fontFamily: 'NafeesNastaleeq' }
            ]}>
              {localizedText?.previousCard?.text || 'Previous Card'}
            </SafeText>
            {showTransliterations && localizedText?.previousCard?.transliteration && (
              <SafeText style={[
                styles.previousCardTranslit,
                (!canNavigateBack || previousButtonDisabled) && styles.previousCardTranslitDisabled
              ]}>
                {localizedText.previousCard.transliteration}
              </SafeText>
            )}
          </View>
        </TouchableOpacity>
      </View>
{/* Card Container */}
      <View style={styles.cardContainer}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotateY: frontInterpolate },
              ],
              opacity: cardOpacity,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Front of card */}
          <Animated.View
            style={[
              styles.cardFace,
              styles.cardFront,
              {
                transform: [{ rotateY: frontInterpolate }],
                opacity: flipAnimation.interpolate({
                  inputRange: [0, 90],
                  outputRange: [1, 0],
                }),
              },
            ]}
          >
            {/* Card background color change - behind content */}
            {cardTint && (
              <Animated.View
                style={[
                  styles.cardBackgroundOverlay,
                  {
                    backgroundColor: cardTint,
                    opacity: cardTintOpacity,
                  },
                ]}
                pointerEvents="none"
              />
            )}
            <TouchableOpacity 
              onPress={(e) => {
                // Only flip if not currently dragging
                if (!activeCorner) {
                  flipCard();
                }
              }}
              activeOpacity={0.9}
              style={styles.cardContent}
              disabled={!!activeCorner}
            >
              {/* SRS State Badge - Top Right Chip */}
              {currentWord && (
                <TouchableOpacity 
                  style={[
                    styles.srsStateBadge,
                    { backgroundColor: getMasteryColor(currentWord.mastery_level) }
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    fetchReviewHistory(currentWord.id);
                  }}
                  activeOpacity={0.7}
                >
                  <SafeText style={styles.srsStateText}>
                    {`${getMasteryEmoji(currentWord.mastery_level)} ${getMasteryLabel(currentWord.mastery_level).toUpperCase()}`}
                  </SafeText>
                </TouchableOpacity>
              )}
              
              <SafeText style={styles.wordLabel}>
                {currentWord?.cardDirection === 'english-to-native' ? (localizedText?.wordLabel?.text || 'Word') : (localizedText?.translationLabel?.text || 'Translation')}
              </SafeText>
              {showTransliterations && (
                <SafeText style={styles.wordLabelTransliteration}>
                  {currentWord?.cardDirection === 'english-to-native' ? (localizedText?.wordLabel?.transliteration || '') : (localizedText?.translationLabel?.transliteration || '')}
                </SafeText>
              )}
              <SafeText style={[
                styles.wordText,
                (currentWord?.cardDirection !== 'english-to-native' && language === 'urdu' && currentWord?.nastaliq)
                  ? { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' } : null,
              ]}>
                {((currentWord?.cardDirection === 'english-to-native'
                  ? currentWord?.english_word
                  : (language === 'urdu' && currentWord?.nastaliq ? currentWord.nastaliq : currentWord?.translation))) || ''}
                {(currentWord?.cardDirection !== 'english-to-native' && (language === 'hindi' || language === 'urdu') && currentWord?.gender && /^[mf]$/i.test(String(currentWord.gender)))
                  ? ` (${String(currentWord.gender).toLowerCase()})` : ''}
              </SafeText>
              {currentWord?.cardDirection === 'native-to-english' && showTransliterations && (transliterations[currentWord.id] || currentWord.transliteration) && (
                <SafeText style={styles.transliterationText}>
                  {transliterations[currentWord.id] || currentWord.transliteration}
                </SafeText>
              )}
{/* Info Badges - POS, CEFR Level, Verb Transitivity */}
              <View style={styles.infoBadgesContainer}>
                {currentWord?.word_class ? (() => {
                  const wordClassColor = getWordClassColor(currentWord.word_class);
                  return (
                    <View style={[
                      styles.infoBadge,
                      { backgroundColor: wordClassColor.bg }
                    ]}>
                      <SafeText style={[
                        styles.infoBadgeText,
                        { color: wordClassColor.text }
                      ]}>
                        {currentWord.word_class}
                      </SafeText>
                    </View>
                  );
                })() : null}
{currentWord?.level ? (() => {
                  const levelColor = CEFR_LEVELS.find(l => l.value === currentWord.level?.toLowerCase())?.color || { bg: '#6C757D', text: '#FFFFFF' };
                  return (
                    <View style={[
                      styles.cefrBadge,
                      { backgroundColor: levelColor.bg }
                    ]}>
                      <SafeText style={[
                        styles.cefrBadgeText,
                        { color: levelColor.text }
                      ]}>
                        {currentWord.level?.toUpperCase() || ''}
                      </SafeText>
                    </View>
                  );
                })() : null}
{currentWord?.verb_transitivity && currentWord.verb_transitivity !== 'N/A' ? (() => {
                  const vtf = VERB_TRANSITIVITY_FILTERS.find(f => f.value.toLowerCase() === currentWord.verb_transitivity.toLowerCase());
                  const vtColor = vtf ? vtf.color : { bg: '#6B7280', text: '#FFFFFF' };
                  return (
                    <View style={[styles.transitivityBadge, { backgroundColor: vtColor.bg }]}>
                      <SafeText style={[styles.transitivityBadgeText, { color: vtColor.text }]}>
                        {currentWord.verb_transitivity}
                      </SafeText>
                    </View>
                  );
                })() : null}
              </View>
              
              <View style={styles.flipButton}>
                <Ionicons name="refresh" size={24} color="#14B8A6" />
                <View style={styles.flipButtonTextContainer}>
                  <SafeText style={styles.flipButtonText}>{localizedText?.tapToReveal?.text || 'Tap to reveal'}</SafeText>
                  {showTransliterations && localizedText?.tapToReveal?.transliteration && (
                    <SafeText style={styles.flipButtonTransliteration}>{localizedText.tapToReveal.transliteration}</SafeText>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
{/* Back of card */}
          <Animated.View
            style={[
              styles.cardFace,
              styles.cardBack,
              {
                transform: [{ rotateY: backInterpolate }],
                opacity: flipAnimation.interpolate({
                  inputRange: [90, 180],
                  outputRange: [0, 1],
                }),
              },
            ]}
          >
            {/* Card background color change - behind content */}
            {cardTint && (
              <Animated.View
                style={[
                  styles.cardBackgroundOverlay,
                  {
                    backgroundColor: cardTint,
                    opacity: cardTintOpacity,
                  },
                ]}
                pointerEvents="none"
              />
            )}
            <TouchableOpacity 
              onPress={(e) => {
                // Only flip if not currently dragging
                if (!activeCorner) {
                  flipCard();
                }
              }}
              activeOpacity={0.9}
              style={[styles.cardContent, { transform: [{ scaleX: -1 }] }]}
              disabled={!!activeCorner}
            >
              {/* SRS State Badge - Top Right Chip */}
              {currentWord && (
                <TouchableOpacity 
                  style={[
                    styles.srsStateBadge,
                    { backgroundColor: getMasteryColor(currentWord.mastery_level) }
                  ]}
                  onPress={(e) => {
                    e.stopPropagation();
                    fetchReviewHistory(currentWord.id);
                  }}
                  activeOpacity={0.7}
                >
                  <SafeText style={styles.srsStateText}>
                    {`${getMasteryEmoji(currentWord.mastery_level)} ${getMasteryLabel(currentWord.mastery_level).toUpperCase()}`}
                  </SafeText>
                </TouchableOpacity>
              )}
              
              <SafeText style={styles.wordLabelBack}>
                {currentWord?.cardDirection === 'english-to-native' ? (localizedText?.translationLabel?.text || 'Translation') : (localizedText?.wordLabel?.text || 'Word')}
              </SafeText>
              {showTransliterations && (
                <SafeText style={styles.wordLabelTransliteration}>
                  {currentWord?.cardDirection === 'english-to-native' ? (localizedText?.translationLabel?.transliteration || '') : (localizedText?.wordLabel?.transliteration || '')}
                </SafeText>
              )}
              <SafeText style={[
                styles.translationText,
                (currentWord?.cardDirection === 'english-to-native' && language === 'urdu' && currentWord?.nastaliq)
                  ? { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' } : null,
              ]}>
                {((currentWord?.cardDirection === 'english-to-native'
                  ? (language === 'urdu' && currentWord?.nastaliq ? currentWord.nastaliq : currentWord?.translation)
                  : currentWord?.english_word)) || ''}
                {(currentWord?.cardDirection === 'english-to-native' && (language === 'hindi' || language === 'urdu') && currentWord?.gender && /^[mf]$/i.test(String(currentWord.gender)))
                  ? ` (${String(currentWord.gender).toLowerCase()})` : ''}
              </SafeText>
              {currentWord?.cardDirection === 'english-to-native' && showTransliterations && (transliterations[currentWord.id] || currentWord.transliteration) && (
                <SafeText style={styles.transliterationTextBack}>
                  {transliterations[currentWord.id] || currentWord.transliteration}
                </SafeText>
              )}
{/* Info Badges - POS, CEFR Level, Verb Transitivity */}
              <View style={styles.infoBadgesContainer}>
                {currentWord?.word_class ? (() => {
                  const wordClassColor = getWordClassColor(currentWord.word_class);
                  return (
                    <View style={[
                      styles.infoBadge,
                      { backgroundColor: wordClassColor.bg }
                    ]}>
                      <SafeText style={[
                        styles.infoBadgeText,
                        { color: wordClassColor.text }
                      ]}>
                        {currentWord.word_class}
                      </SafeText>
                    </View>
                  );
                })() : null}
{currentWord?.level ? (() => {
                  const levelColor = CEFR_LEVELS.find(l => l.value === currentWord.level?.toLowerCase())?.color || { bg: '#6C757D', text: '#FFFFFF' };
                  return (
                    <View style={[
                      styles.cefrBadge,
                      { backgroundColor: levelColor.bg }
                    ]}>
                      <SafeText style={[
                        styles.cefrBadgeText,
                        { color: levelColor.text }
                      ]}>
                        {currentWord.level?.toUpperCase() || ''}
                      </SafeText>
                    </View>
                  );
                })() : null}
{currentWord?.verb_transitivity && currentWord.verb_transitivity !== 'N/A' ? (() => {
                  const vtf = VERB_TRANSITIVITY_FILTERS.find(f => f.value.toLowerCase() === currentWord.verb_transitivity.toLowerCase());
                  const vtColor = vtf ? vtf.color : { bg: '#6B7280', text: '#FFFFFF' };
                  return (
                    <View style={[styles.transitivityBadge, { backgroundColor: vtColor.bg }]}>
                      <SafeText style={[styles.transitivityBadgeText, { color: vtColor.text }]}>
                        {currentWord.verb_transitivity}
                      </SafeText>
                    </View>
                  );
                })() : null}
              </View>
              
              <View style={styles.flipButton}>
                <Ionicons name="refresh" size={24} color="#14B8A6" />
                <View style={styles.flipButtonTextContainer}>
                  <SafeText style={styles.flipButtonTextBack}>{localizedText?.tapToFlipBack?.text || 'Tap to flip back'}</SafeText>
                  {showTransliterations && localizedText?.tapToFlipBack?.transliteration && (
                    <SafeText style={styles.flipButtonTransliteration}>{localizedText.tapToFlipBack.transliteration}</SafeText>
                  )}
                </View>
              </View>

              {/* Translated chip + Origin chip row */}
              {(currentWord?.origin || currentWord?.deck_name) && (
                <TouchableOpacity
                  style={styles.originChipRow}
                  onPress={(e) => {
                    e.stopPropagation();
                    // Navigate back to deck picker and highlight the relevant deck
                    setStudyMode(null);
                    setActiveDeckId(null);
                    setActiveDeckName('');
                    setWords([]);
                    setCurrentIndex(0);
                    setCompletedWords([]);
                    setCompletedCardIndices([]);
                    loadedForModeRef.current = null;
                    loadSrsStats();
                    // Expand the decks section so user sees it
                    setDecksExpanded(true);
                  }}
                  activeOpacity={0.75}
                >
                  {(() => {
                    const o = currentWord.origin;
                    const isTranslated = o === 'translated';
                    const bg = o === 'default' ? '#16A34A'
                             : o === 'activity' ? '#2563EB'
                             : '#6B7280';
                    const label = o === 'default' ? 'Original Set'
                                : o === 'activity' ? 'Activity'
                                : currentWord.deck_name ? currentWord.deck_name : 'User Upload';
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {isTranslated && (
                          <View style={[styles.originChip, { backgroundColor: '#EEF2FF', marginRight: 0 }]}>
                            <Ionicons name="language-outline" size={10} color="#4F46E5" />
                            <SafeText style={[styles.originChipText, { color: '#4F46E5' }]}>Translated</SafeText>
                          </View>
                        )}
                        {o && (
                          <View style={[styles.originChip, { backgroundColor: bg }]}>
                            <Ionicons name={o === 'default' ? 'star' : o === 'activity' ? 'flash' : 'cloud-upload'} size={10} color="#FFF" />
                            <SafeText style={styles.originChipText}>{label}</SafeText>
                            {o !== 'default' && <Ionicons name="arrow-forward" size={10} color="#FFF" style={{ marginLeft: 2 }} />}
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
{/* Language Selector Modal */}
      <Modal visible={languageMenuVisible} transparent={true} animationType="fade" onRequestClose={() => setLanguageMenuVisible(false)}>
        <TouchableOpacity style={styles.langModalOverlay} activeOpacity={1} onPress={() => setLanguageMenuVisible(false)}>
          <View style={styles.langModalMenu}>
            <SafeText style={styles.langModalTitle}>Select Language</SafeText>
            {availableLanguages.map((lang) => {
              const isSelected = language === lang.code;
              const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
              return (
                <TouchableOpacity key={lang.code} style={[styles.langModalOption, isSelected && styles.langModalOptionSelected]}
                  onPress={() => { setSelectedLanguage(lang.code); setLanguageMenuVisible(false); }}>
                  {(lang.nativeChar || lang.langCode) && (
                    <View style={[styles.langModalCodeBox, { backgroundColor: lang.color }]}>
                      {lang.nativeChar ? <SafeText style={[styles.langModalNativeChar, lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>{String(lang.nativeChar)}</SafeText>
                        : <SafeText style={styles.langModalCodeText}>{String(lang.langCode?.toUpperCase())}</SafeText>}
                    </View>
                  )}
                  <View style={styles.langModalOptionContent}>
                    <SafeText style={[styles.langModalOptionText, isSelected && styles.langModalOptionTextSelected, !lang.active && styles.langModalOptionTextDisabled]}>{String(lang.name)}</SafeText>
                    {lang.nativeName && <SafeText style={[styles.langModalNativeName, isSelected && styles.langModalNativeNameSelected, lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' }]}>{String(lang.nativeName)}</SafeText>}
                  </View>
                  <View style={styles.langSrsChips}>
                    <View style={styles.langSrsChipNew}><Ionicons name="add-circle" size={16} color="#4A90E2" /><SafeText style={styles.langSrsChipTextNew}>{langStats.new_count || 0}</SafeText></View>
                    <View style={styles.langSrsChipDue}><Ionicons name="alarm" size={16} color="#FF6B6B" /><SafeText style={styles.langSrsChipTextDue}>{langStats.due_count || 0}</SafeText></View>
                  </View>
                  {!lang.active && <Ionicons name="lock-closed" size={16} color="#CCC" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
{/* Review History Modal */}
      <Modal
        visible={showReviewHistory}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReviewHistory(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReviewHistory(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <SafeText style={styles.modalTitle}>
                {currentWord?.english_word}
              </SafeText>
              <TouchableOpacity onPress={() => setShowReviewHistory(false)}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {reviewHistoryData ? (
                <>
                  {/* Current SRS Info */}
                  <View style={styles.srsInfoSection}>
                    <SafeText style={styles.sectionTitle}>Current Status</SafeText>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Mastery Level:</SafeText>
                      <View style={[
                        styles.masteryBadge,
                        { backgroundColor: getMasteryColor(reviewHistoryData.current_state?.mastery_level) }
                      ]}>
                        <SafeText style={styles.masteryText}>
                          {`${getMasteryEmoji(reviewHistoryData.current_state?.mastery_level)} ${reviewHistoryData.current_state?.mastery_level?.toUpperCase() || 'NEW'}`}
                        </SafeText>
                      </View>
                    </View>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Review Count:</SafeText>
                      <SafeText style={styles.srsInfoValue}>{reviewHistoryData.current_state?.review_count || 0}</SafeText>
                    </View>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Ease Factor:</SafeText>
                      <SafeText style={styles.srsInfoValue}>{reviewHistoryData.current_state?.ease_factor?.toFixed(2) || 'N/A'}</SafeText>
                    </View>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Current Interval:</SafeText>
                      <SafeText style={styles.srsInfoValue}>
                        {reviewHistoryData.current_state?.interval_days 
                          ? `${reviewHistoryData.current_state.interval_days.toFixed(1)} days`
                          : 'N/A'}
                      </SafeText>
                    </View>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Next Review:</SafeText>
                      <SafeText style={styles.srsInfoValue}>
                        {reviewHistoryData.current_state?.next_review_date 
                          ? (() => {
                              const date = new Date(reviewHistoryData.current_state.next_review_date);
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              const year = String(date.getFullYear()).slice(-2);
                              return `${month}/${day}/${year}`;
                            })()
                          : 'Not scheduled'}
                      </SafeText>
                    </View>
                    {reviewHistoryData.current_state?.next_review_date && (
                      <View style={styles.srsInfoRow}>
                        <SafeText style={styles.srsInfoLabel}>ETA:</SafeText>
                        <SafeText style={styles.srsInfoValue}>
                          {(() => {
                            const now = new Date();
                            const nextReview = new Date(reviewHistoryData.current_state.next_review_date);
                            const diffMs = nextReview - now;
                            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) return 'Overdue';
                            if (diffDays === 0) return 'Due today';
                            if (diffDays === 1) return '1 day';
                            return `${diffDays} days`;
                          })()}
                        </SafeText>
                      </View>
                    )}
                  </View>
{/* Review History */}
                  <View style={styles.historySection}>
                    <SafeText style={styles.sectionTitle}>
                      Review History ({reviewHistoryData.history?.length || 0} reviews)
                    </SafeText>
                    {reviewHistoryData.history && reviewHistoryData.history.length > 0 ? (
                      reviewHistoryData.history.map((review, index) => {
                        const date = new Date(review.reviewed_at);
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const year = String(date.getFullYear()).slice(-2);
                        const dateStr = `${month}/${day}/${year}`;
                        const timeStr = date.toLocaleTimeString(undefined, { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        });
                        
                        const ratingColors = {
                          easy: '#10B981',
                          good: '#3B82F6',
                          hard: '#F59E0B',
                          again: '#EF4444'
                        };
                        
                        return (
                          <View key={index} style={styles.reviewItem}>
                            <View style={styles.reviewRow}>
                              <View style={styles.reviewLeft}>
                                <Text style={styles.reviewDate}>{dateStr}</Text>
                                <Text style={styles.reviewTime}>{timeStr}</Text>
                              </View>
                              <View style={styles.reviewRight}>
                                <View style={[
                                  styles.reviewRatingBadge, 
                                  { backgroundColor: ratingColors[review.rating] || '#666' }
                                ]}>
                                  <Text style={styles.reviewRatingText}>
                                    {review.rating?.toUpperCase() || 'N/A'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={styles.reviewDetails}>
                              <Text style={styles.reviewDetail}>
                                Activity: {review.activity_type || 'flashcard'}
                              </Text>
                              <Text style={styles.reviewDetail}>
                                Interval: {review.interval_days?.toFixed(1) || '0'} days
                              </Text>
                              <Text style={styles.reviewDetail}>
                                Ease: {review.ease_factor?.toFixed(2) || 'N/A'}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.noReviewsText}>No review history yet</Text>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#14B8A6" />
                  <Text style={styles.loadingText}>Loading review history...</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Rename deck modal (when studying an imported deck) */}
      <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} onPress={() => setRenameModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 }}>Rename deck</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#333', marginBottom: 16 }}
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Deck name"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setRenameModalVisible(false)} style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 15, color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const name = (renameInput || '').trim();
                  if (!name || !activeDeckId) return;
                  setRenaming(true);
                  try {
                    await fetch(`${API_BASE_URL}/api/vocab/decks/${activeDeckId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name }),
                    });
                    setActiveDeckName(name);
                    setRenameModalVisible(false);
                  } catch (e) {
                    console.error('Error renaming deck:', e);
                  } finally {
                    setRenaming(false);
                  }
                }}
                disabled={renaming || !(renameInput || '').trim()}
                style={{ paddingVertical: 8, paddingHorizontal: 16 }}
              >
                {renaming ? <ActivityIndicator size="small" color="#14B8A6" /> : <Text style={{ fontSize: 15, fontWeight: '600', color: '#14B8A6' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#14B8A6',
    borderBottomWidth: 1,
    borderBottomColor: '#0FA896',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginRight: 12,
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tutorIconBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorIconLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    color: '#4A90E2',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerTitleTranslit: {
    fontSize: 11,
    color: '#E0E0E0',
    fontStyle: 'italic',
    marginTop: 2,
  },
  settingsButton: {
    paddingVertical: 8,
    paddingRight: 8,
    paddingLeft: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navigationButtonHeader: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationInfoHeader: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationTextHeader: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  transliterationButton: {
    padding: 8,
    borderRadius: 8,
  },
  transliterationButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  transliterationIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flex: 1,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F5F5F5',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0F7F4',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#14B8A6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  cornerIndicators: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: 'box-none', // Allow touches to pass through to children
  },
  cornerIndicator: {
    position: 'absolute',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  topLeft: {
    position: 'absolute',
    top: 180, // Lower to avoid progress bar overlap
    left: 20,
  },
  topRight: {
    position: 'absolute',
    top: 180, // Lower to avoid progress bar overlap
    right: 20,
  },
  bottomLeft: {
    position: 'absolute',
    bottom: 20, // Moved up from bottom
    left: 20,
  },
  bottomRight: {
    position: 'absolute',
    bottom: 20, // Moved up from bottom
    right: 20,
  },
  cornerIcon: {
    marginBottom: 4,
  },
  cornerLabelContainer: {
    alignItems: 'center',
  },
  cornerLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  cornerTranslit: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
    fontStyle: 'italic',
  },
  cornerInterval: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.9,
  },
  cardTintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    zIndex: 1,
  },
  cardBackgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    zIndex: 0,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 80, // Increased to push card further down
    paddingBottom: 140, // Space for corner indicators including previous button
    marginTop: 0,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: 'relative',
    marginTop: 30, // Push card down slightly without affecting corner buttons
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  cardBack: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  srsStateBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  srsStateBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  srsStateIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  srsStateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  wordLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wordLabelTransliteration: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  wordLabelBack: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  translationText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  transliterationText: {
    fontSize: 18,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  transliterationTextBack: {
    fontSize: 18,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  wordClassBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 16,
  },
  wordClassText: {
    fontSize: 11,
    fontWeight: '600',
  },
  flipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
  },
  flipButtonTextContainer: {
    flexDirection: 'column',
    marginLeft: 8,
  },
  flipButtonText: {
    fontSize: 14,
    color: '#14B8A6',
    fontWeight: '600',
  },
  flipButtonTransliteration: {
    fontSize: 11,
    color: '#0D9488',
    fontStyle: 'italic',
    marginTop: 2,
  },
  flipButtonTextBack: {
    fontSize: 14,
    color: '#14B8A6',
    fontWeight: '600',
  },
  instructionsContainer: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0F7F4',
  },
  instructionTextContainer: {
    alignItems: 'center',
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  instructionsTranslit: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  modalCloseButton: {
    padding: 4,
  },
  settingsContent: {
    padding: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  // Empty state with stats styles
  completionIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyTitleTranslit: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtextTranslit: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 30,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  statBox: {
    backgroundColor: '#F0F9FF',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 140,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#14B8A6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  statLabelTranslit: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  overviewContainer: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  overviewLabelContainer: {
    flex: 1,
  },
  overviewLabel: {
    fontSize: 16,
    color: '#666',
  },
  overviewLabelTranslit: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  learnMoreButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  learnMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  learnMoreButtonTranslit: {
    color: '#E0E0FF',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  comeBackText: {
    fontSize: 14,
    color: '#999',
    marginTop: 10,
    marginBottom: 2,
    textAlign: 'center',
  },
  comeBackTextTranslit: {
    fontSize: 12,
    color: '#BBB',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  cornerIntervalContainer: {
    alignItems: 'center',
  },
  cornerIntervalTranslit: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
  },
  modalScroll: {
    padding: 20,
  },
  reviewItem: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewLeft: {
    flex: 1,
  },
  reviewDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  reviewTime: {
    fontSize: 13,
    color: '#666',
  },
  reviewRight: {
    alignItems: 'flex-end',
  },
  reviewRatingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 4,
  },
  reviewRatingText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  reviewInterval: {
    fontSize: 12,
    color: '#666',
  },
  reviewMasteryChange: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  reviewMasteryText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  noReviewsText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 40,
  },
  // New styles for SRS info section
  srsInfoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  srsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  srsInfoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  srsInfoValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  masteryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  masteryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  historySection: {
    marginTop: 8,
  },
  reviewDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  reviewDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  // Info badges container (POS, CEFR, Transitivity)
  infoBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    marginBottom: 12,
  },
  infoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cefrBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cefrBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  transitivityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  transitivityBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  originChipRow: {
    alignSelf: 'center',
    marginTop: 12,
    marginRight: 0,
  },
  originChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  originChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  // Navigation buttons
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 12,
    marginTop: 0,
    marginBottom: 10,
  },
  navigationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationButtonDisabled: {
    backgroundColor: '#F5F5F5',
  },
  navigationInfo: {
    flex: 1,
    alignItems: 'center',
  },
  navigationText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  previousCardButton: {
    position: 'absolute',
    bottom: 20, // Same as bottomLeft and bottomRight for Y-axis centering
    left: '50%',
    transform: [{ translateX: -75 }], // Half of button width to center horizontally
    backgroundColor: '#14B8A6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  previousCardButtonDisabled: {
    opacity: 0.3,
    backgroundColor: '#CCCCCC',
  },
  previousCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previousCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  previousCardTextDisabled: {
    color: '#666666', // Dark gray for disabled state
  },
  previousCardTranslit: {
    fontSize: 11,
    color: '#E0E0E0',
    fontStyle: 'italic',
    marginTop: 2,
    textAlign: 'center',
  },
  previousCardTranslitDisabled: {
    color: '#888888', // Slightly lighter dark gray for disabled transliteration
  },

  // ── Language picker button (match PracticeScreen background shade) ──
  langPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    flexShrink: 0,
  },
  countryCodeBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  nativeCharText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  countryCodeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  languageButtonContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginRight: 4,
  },
  languageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  languageNativeName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  // Legacy names (kept for modal options that may still reference)
  langPickerBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langPickerChar: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  langPickerCode: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  langPickerTextCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  langPickerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  langPickerNative: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 1,
  },

  // ── Language picker modal ──
  langModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langModalMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  langModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  langModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  langModalOptionSelected: {
    backgroundColor: '#F0F7FF',
  },
  langModalCodeBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  langModalNativeChar: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  langModalCodeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  langModalOptionContent: {
    flex: 1,
    flexDirection: 'column',
  },
  langModalOptionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  langModalOptionTextSelected: {
    fontWeight: '600',
    color: '#4A90E2',
  },
  langModalOptionTextDisabled: {
    color: '#999',
  },
  langModalNativeName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  langModalNativeNameSelected: {
    color: '#4A90E2',
  },

  // SRS chips inside language picker
  langSrsChips: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  langSrsChipNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  langSrsChipTextNew: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A90E2',
  },
  langSrsChipDue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  langSrsChipTextDue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B6B',
  },
});
