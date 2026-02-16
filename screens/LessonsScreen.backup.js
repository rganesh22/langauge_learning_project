import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../components/SafeText';
import LessonRenderer from '../components/LessonRenderer';
import { LanguageContext } from '../contexts/LanguageContext';
import { allSampleLessons } from '../constants/sampleLessons';

const API_BASE_URL = __DEV__ ? 'http://localhost:5001' : 'http://localhost:5001';

// Helpers to build grouped lessons of ~5 items.
const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const makeLessonArticle = ({ title, type, chars = [], diacritics = [] }) => {
  const list = [...chars, ...diacritics].join(', ');
  const what = type === 'vowel'
    ? 'These are open sounds; keep the mouth relaxed and clear.'
    : type === 'consonant'
      ? 'Pair each with a vowel sign later; keep the base sound crisp.'
      : type === 'matra'
        ? 'These marks latch onto consonants to supply the vowel sound.'
        : type === 'numeral'
          ? 'Digits you will meet in prices, dates, and addresses.'
          : 'Blend everything you have learned so far.';

  const how = type === 'vowel'
    ? 'Hold each vowel cleanly—no schwa drift. Say them slowly first, then in quick succession.'
    : type === 'consonant'
      ? 'Most Kannada consonants carry an inherent “a” unless a vowel sign changes it. Listen for aspiration (h puff) in ಖ, ಛ, ಠ, ಥ, ಫ.'
      : type === 'matra'
        ? 'Signs can appear before, after, above, or around the consonant. Read left-to-right even when the mark wraps.'
        : type === 'numeral'
          ? 'Numbers flow the same direction as text. Practice reading phone numbers and years.'
          : 'Read whole words out loud: consonant + vowel sign + nasal/visarga if present.';

  const feel = type === 'vowel'
    ? 'Aim for pure tones: ಅ (a), ಆ (aa), ಇ (i), ಈ (ii), ಉ (u), ಊ (uu), ಋ (ri), ಎ (e), ಏ (ee), ಐ (ai), ಒ (o), ಓ (oo), ಔ (au), ಅಂ (am), ಅಃ (ah).'
    : type === 'consonant'
      ? 'Group similar sounds: ಕ-ಖ, ಗ-ಘ, ಚ-ಛ, ಜ-ಝ, ಟ-ಠ, ಡ-ಢ, ತ-ಥ, ದ-ಧ, ಪ-ಫ, ಬ-ಭ. Notice retroflex vs. dental pairs.'
      : type === 'matra'
        ? 'Try mapping: ಾ (aa), ಿ (i), ೀ (ii), ು (u), ೂ (uu), ೃ (r̥), ೆ (e), ೇ (ee), ೈ (ai), ೊ (o), ೋ (oo), ೌ (au), ಂ (nasal), ಃ (breathy end).'
        : type === 'numeral'
          ? 'Read aloud like phone numbers: ೧೨೩ (one two three), ೪೫೬ (four five six).'
          : 'Mix easy words first (two or three syllables). Keep a steady rhythm and avoid inserting extra vowels.';

  const practice = `Say these out loud: ${list || title}. Then trace them with your finger or stylus.`;

  return [
    `${title}: ${list || '—'}`,
    what,
    how,
    feel,
    practice,
  ];
};

const VOWELS = ['ಅ', 'ಆ', 'ಇ', 'ಈ', 'ಉ', 'ಊ', 'ಋ', 'ಎ', 'ಏ', 'ಐ', 'ಒ', 'ಓ', 'ಔ', 'ಅಂ', 'ಅಃ'];
const CONSONANTS = ['ಕ', 'ಖ', 'ಗ', 'ಘ', 'ಙ', 'ಚ', 'ಛ', 'ಜ', 'ಝ', 'ಞ', 'ಟ', 'ಠ', 'ಡ', 'ಢ', 'ಣ', 'ತ', 'ಥ', 'ದ', 'ಧ', 'ನ', 'ಪ', 'ಫ', 'ಬ', 'ಭ', 'ಮ', 'ಯ', 'ರ', 'ಲ', 'ವ', 'ಶ', 'ಷ', 'ಸ', 'ಹ', 'ಳ', 'ಕ್ಷ', 'ಜ್ಞ'];
const MATRAS = ['ಾ', 'ಿ', 'ೀ', 'ು', 'ೂ', 'ೃ', 'ೆ', 'ೇ', 'ೈ', 'ೊ', 'ೋ', 'ೌ', 'ಂ', 'ಃ'];
const NUMERALS = ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'];

const ITRANS_CHART = {
  vowels: [
    ['ಅ', 'a'], ['ಆ', 'aa'], ['ಇ', 'i'], ['ಈ', 'ii'], ['ಉ', 'u'], ['ಊ', 'uu'],
    ['ಋ', 'r'], ['ಎ', 'e'], ['ಏ', 'ee'], ['ಐ', 'ai'], ['ಒ', 'o'], ['ಓ', 'oo'], ['ಔ', 'au'],
    ['ಅಂ', 'am'], ['ಅಃ', 'ah'],
  ],
  consonants: [
    ['ಕ', 'ka'], ['ಖ', 'kha'], ['ಗ', 'ga'], ['ಘ', 'gha'], ['ಙ', 'nga'],
    ['ಚ', 'cha'], ['ಛ', 'chha'], ['ಜ', 'ja'], ['ಝ', 'jha'], ['ಞ', 'nya'],
    ['ಟ', 'ta'], ['ಠ', 'tha'], ['ಡ', 'da'], ['ಢ', 'dha'], ['ಣ', 'na'],
    ['ತ', 'ta'], ['ಥ', 'tha'], ['ದ', 'da'], ['ಧ', 'dha'], ['ನ', 'na'],
    ['ಪ', 'pa'], ['ಫ', 'pha'], ['ಬ', 'ba'], ['ಭ', 'bha'], ['ಮ', 'ma'],
    ['ಯ', 'ya'], ['ರ', 'ra'], ['ಲ', 'la'], ['ವ', 'va'],
    ['ಶ', 'sha'], ['ಷ', 'ssa'], ['ಸ', 'sa'], ['ಹ', 'ha'], ['ಳ', 'la'], ['ಕ್ಷ', 'ksha'], ['ಜ್ಞ', 'jna'],
  ],
  matras: [
    ['ಾ', 'aa'], ['ಿ', 'i'], ['ೀ', 'ii'], ['ು', 'u'], ['ೂ', 'uu'], ['ೃ', 'r'],
    ['ೆ', 'e'], ['ೇ', 'ee'], ['ೈ', 'ai'], ['ೊ', 'o'], ['ೋ', 'oo'], ['ೌ', 'au'],
    ['ಂ', 'm'], ['ಃ', 'h'],
  ],
  numerals: [
    ['೦', '0'], ['೧', '1'], ['೨', '2'], ['೩', '3'], ['೪', '4'],
    ['೫', '5'], ['೬', '6'], ['೭', '7'], ['೮', '8'], ['೯', '9'],
  ],
};

const buildKannadaModules = () => {
  const vowelLessons = chunk(VOWELS, 5).map((chars, idx) => ({
    id: `kn-vowels-${idx + 1}`,
    title: `Vowels ${idx + 1}`,
    subtitle: 'Learn base vowels',
    level: 'A1',
    characters: chars,
    diacritics: [],
    focus: 'Practice sounds and shapes.',
    article: makeLessonArticle({ title: `Vowels ${idx + 1}`, type: 'vowel', chars }),
  }));

  const consonantLessons = chunk(CONSONANTS, 5).map((chars, idx) => ({
    id: `kn-cons-${idx + 1}`,
    title: `Consonants ${idx + 1}`,
    subtitle: 'Core letters',
    level: 'A1',
    characters: chars,
    diacritics: [],
    focus: 'Attach vowels later with matras.',
    article: makeLessonArticle({ title: `Consonants ${idx + 1}`, type: 'consonant', chars }),
  }));

  const matraLessons = chunk(MATRAS, 5).map((chars, idx) => ({
    id: `kn-matra-${idx + 1}`,
    title: `Vowel Signs ${idx + 1}`,
    subtitle: 'Build syllables',
    level: 'A2',
    characters: [],
    diacritics: chars,
    focus: 'Combine with consonants to form syllables.',
    article: makeLessonArticle({ title: `Vowel Signs ${idx + 1}`, type: 'matra', diacritics: chars }),
  }));

  const numeralLessons = chunk(NUMERALS, 5).map((chars, idx) => ({
    id: `kn-num-${idx + 1}`,
    title: `Numerals ${idx + 1}`,
    subtitle: 'Digits',
    level: 'A1',
    characters: chars,
    diacritics: [],
    focus: 'Use in prices, dates, addresses.',
    article: makeLessonArticle({ title: `Numerals ${idx + 1}`, type: 'numeral', chars }),
  }));

  const practiceLesson = {
    id: 'kn-practice',
    title: 'Whole-Word Practice',
    subtitle: 'Blend everything',
    level: 'A2',
    characters: [],
    diacritics: [],
    focus: 'Read full words with all learned pieces.',
    article: makeLessonArticle({ title: 'Whole-Word Practice', type: 'practice', chars: [], diacritics: [] }),
  };

  // Interleave lessons to accelerate reading: vowel, consonant, vowel, consonant, then matras, numerals, practice.
  const interleaved = [];
  const maxLen = Math.max(vowelLessons.length, consonantLessons.length);
  for (let i = 0; i < maxLen; i++) {
    if (vowelLessons[i]) interleaved.push(vowelLessons[i]);
    if (consonantLessons[i]) interleaved.push(consonantLessons[i]);
  }
  interleaved.push(...matraLessons, ...numeralLessons, practiceLesson);

  // Apply a global prereq chain based on the interleaved order.
  interleaved.forEach((lesson, idx) => {
    lesson.prereq = idx === 0 ? null : interleaved[idx - 1].id;
  });

  return [
    {
      id: 'kn-mod-script',
      title: 'Learning the Script',
      lessons: interleaved,
    },
  ];
};

const SCRIPT_MODULES = {
  kannada: buildKannadaModules(),
};

// Practice bank: only shows items whose required chars/diacritics are all known.
const SCRIPT_PRACTICE_BANK = [
  { id: 'w1', language: 'kannada', text: 'ಅಮರ', gloss: 'immortal', requires: ['ಅ', 'ಮ', 'ರ'] },
  { id: 'w2', language: 'kannada', text: 'ಕಲಾ', gloss: 'art', requires: ['ಕ', 'ಲ', 'ಾ'] },
  { id: 'w3', language: 'kannada', text: 'ಮನೆ', gloss: 'house', requires: ['ಮ', 'ನ', 'ೆ'] },
  { id: 'w4', language: 'kannada', text: 'ಭಾಷೆ', gloss: 'language', requires: ['ಭ', 'ಾ', 'ಷ', 'ೆ'] },
  { id: 'w5', language: 'kannada', text: 'ಪುಸ್ತಕ', gloss: 'book', requires: ['ಪ', 'ು', 'ಸ', '್', 'ತ', 'ಕ'] },
  { id: 'w6', language: 'kannada', text: 'ಕಾಫಿ', gloss: 'coffee', requires: ['ಕ', 'ಾ', 'ಫ', 'ಿ'] },
  { id: 'w7', language: 'kannada', text: 'ಸ್ನೇಹ', gloss: 'friendship', requires: ['ಸ', '್', 'ನ', 'ೇ', 'ಹ'] },
  { id: 'w8', language: 'kannada', text: '೧೨೩', gloss: '123', requires: ['೧', '೨', '೩'] },
  { id: 'w9', language: 'kannada', text: 'ಬೆಳೆ', gloss: 'crop', requires: ['ಬ', 'ೆ', 'ಳ', 'ೆ'] },
  { id: 'w10', language: 'kannada', text: 'ಹೊಸ', gloss: 'new', requires: ['ಹ', 'ೊ', 'ಸ'] },
  { id: 'w11', language: 'kannada', text: 'ಮಾವು', gloss: 'mango tree', requires: ['ಮ', 'ಾ', 'ವ', 'ು'] },
  { id: 'w12', language: 'kannada', text: 'ಪ್ರತಿ', gloss: 'every', requires: ['ಪ', '್', 'ರ', 'ತ', 'ಿ'] },
  { id: 'w13', language: 'kannada', text: 'ಶಕ್ತಿ', gloss: 'strength', requires: ['ಶ', 'ಕ', '್', 'ತ', 'ಿ'] },
];

const LOCK_COLOR = '#E0E0E0';

// Basic transliteration map for quick pronunciation hints (approximate).
// ITRANS transliteration will be fetched via API

export default function LessonsScreen() {
  const { selectedLanguage: ctxLanguage, setSelectedLanguage: setCtxLanguage, availableLanguages } = React.useContext(LanguageContext);
  const selectedLanguage = ctxLanguage || 'kannada';
  const setSelectedLanguage = (l) => setCtxLanguage(l);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [allLanguagesSrsStats, setAllLanguagesSrsStats] = useState({});
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [viewMode, setViewMode] = useState('modules'); // modules -> lessons -> lesson
  const [completedLessons, setCompletedLessons] = useState(new Set());
  const [quizWords, setQuizWords] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizInput, setQuizInput] = useState('');
  const [quizShowAnswer, setQuizShowAnswer] = useState(false);
  const [quizTransliterations, setQuizTransliterations] = useState({});
  const [lessonTransliterations, setLessonTransliterations] = useState({});
  const [showTranslitGuide, setShowTranslitGuide] = useState(false);

  const loadAllLanguagesSrsStats = async () => {
    try {
      const statsPromises = availableLanguages.map(async (lang) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/srs/stats/${lang.code}`);
          if (response.ok) {
            const data = await response.json();
            return {
              code: lang.code,
              new_count: data.new_count || 0,
              due_count: data.due_count || 0,
            };
          }
        } catch (error) {
          console.error(`Error loading SRS stats for ${lang.code}:`, error);
        }
        return { code: lang.code, new_count: 0, due_count: 0 };
      });

      const stats = await Promise.all(statsPromises);
      const statsMap = {};
      stats.forEach(stat => {
        statsMap[stat.code] = stat;
      });
      setAllLanguagesSrsStats(statsMap);
    } catch (error) {
      console.error('Error loading all languages SRS stats:', error);
    }
  };

  useEffect(() => {
    loadAllLanguagesSrsStats();
  }, [selectedLanguage]);

  const modules = SCRIPT_MODULES[selectedLanguage] || [];
  const lessons = useMemo(() => {
    const arr = [];
    modules.forEach((m) => m.lessons.forEach((l) => arr.push({ ...l, moduleId: m.id, moduleTitle: m.title })));
    return arr;
  }, [modules]);
  const currentLanguage = LANGUAGES.find(lang => lang.code === selectedLanguage) || LANGUAGES[0];

  // Unlock all lessons for now
  const isUnlocked = (_lesson) => true;

  const knownChars = useMemo(() => {
    const collected = new Set();
    const addFrom = (lessonId) => {
      const lesson = lessons.find(l => l.id === lessonId);
      if (!lesson) return;
      lesson.characters?.forEach(ch => collected.add(ch));
      lesson.diacritics?.forEach(ch => collected.add(ch));
    };
    lessons.forEach((lesson) => {
      if (completedLessons.has(lesson.id)) addFrom(lesson.id);
      if (lesson.id === activeLessonId) addFrom(lesson.id);
    });
    return collected;
  }, [lessons, completedLessons, activeLessonId]);

  // Get cumulative known characters up to and including current lesson
  const cumulativeKnownChars = useMemo(() => {
    const collected = new Set();
    if (!activeLessonId) return collected;
    
    // Find current lesson index
    const currentIndex = lessons.findIndex(l => l.id === activeLessonId);
    if (currentIndex === -1) return collected;
    
    // Collect all characters from lessons up to and including current
    for (let i = 0; i <= currentIndex; i++) {
      const lesson = lessons[i];
      if (lesson) {
        lesson.characters?.forEach(ch => collected.add(ch));
        lesson.diacritics?.forEach(ch => collected.add(ch));
      }
    }
    return collected;
  }, [lessons, activeLessonId]);

  const toggleComplete = (lessonId) => {
    const updated = new Set(completedLessons);
    if (updated.has(lessonId)) {
      updated.delete(lessonId);
    } else {
      updated.add(lessonId);
    }
    setCompletedLessons(updated);
  };

  const activeLesson = lessons.find(l => l.id === activeLessonId) || lessons[0];
  const activeModule = modules.find(m => m.id === activeModuleId) || modules[0];
  const lessonsInModule = lessons.filter(l => l.moduleId === (activeModule?.id || modules[0]?.id));
  const completedCount = completedLessons.size;

  // Utility: check if word only uses known characters/diacritics (ignores spaces/punctuation)
  const hasOnlyKnownChars = (text, allowedSet) => {
    if (!text || typeof text !== 'string') return false;
    const clean = text.replace(/[\s0-9.,;:'"!?()-]/g, '');
    if (!clean.length) return false;
    for (const ch of clean) {
      if (!allowedSet.has(ch)) return false;
    }
    return true;
  };

  const loadQuizWords = async () => {
    if (!activeLesson) return;
    setQuizLoading(true);
    try {
      const allowedChars = Array.from(cumulativeKnownChars);
      const resp = await fetch(`${API_BASE_URL}/api/lesson-words/${selectedLanguage}/${activeLesson.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowed_chars: allowedChars,
          target_count: 60,
          max_count: 70,
        }),
      });

      if (!resp.ok) {
        throw new Error(`Failed to load lesson words: ${resp.status}`);
      }

      const data = await resp.json();
      const words = data.words || [];

      setQuizWords(words);
      setQuizIndex(0);
      setQuizInput('');
      setQuizShowAnswer(false);
      
      // Pre-load transliterations for all quiz words
      const translitPromises = words.map(async (item) => {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/transliterate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: item.text, language: selectedLanguage, to_script: 'ITRANS' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            return { id: item.id, translit: simplifyDisplayTranslit(data.transliteration || '') };
          }
        } catch (err) {
          console.error(`Error transliterating ${item.text}:`, err);
        }
        return { id: item.id, translit: '' };
      });
      
      const translitResults = await Promise.all(translitPromises);
      const translitMap = {};
      translitResults.forEach(r => {
        translitMap[r.id] = r.translit;
      });
      setQuizTransliterations(translitMap);
    } catch (err) {
      console.error('Error loading quiz words:', err);
    } finally {
      setQuizLoading(false);
    }
  };

  useEffect(() => {
    if (!activeModuleId && modules[0]) setActiveModuleId(modules[0].id);
    if (!activeLessonId && lessonsInModule[0]) setActiveLessonId(lessonsInModule[0].id);
    if (!activeModuleId) setViewMode('modules');
    else if (!activeLessonId) setViewMode('lessons');
  }, [modules, lessonsInModule, activeModuleId, activeLessonId]);

  useEffect(() => {
    loadQuizWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLessonId, selectedLanguage, cumulativeKnownChars]);

  // Load ITRANS transliterations for lesson characters/marks
  useEffect(() => {
    const loadLessonTransliterations = async () => {
      if (!activeLesson) return;
      const chars = [...(activeLesson.characters || []), ...(activeLesson.diacritics || [])];
      if (chars.length === 0) return;
      setShowTranslitGuide(false);
      
      const translitMap = {};
      for (const ch of chars) {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/transliterate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: ch, language: selectedLanguage, to_script: 'ITRANS' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            translitMap[ch] = simplifyDisplayTranslit(data.transliteration || '');
          }
        } catch (err) {
          console.error(`Error transliterating ${ch}:`, err);
        }
      }
      setLessonTransliterations(translitMap);
    };
    
    loadLessonTransliterations();
  }, [activeLesson, selectedLanguage]);

  const currentQuizWord = quizWords[quizIndex] || null;
  const currentTranslit = currentQuizWord ? quizTransliterations[currentQuizWord.id] || '' : '';
  const simplifyDisplayTranslit = (val) => {
    if (!val) return '';
    let out = val;
    // Convert diacritics to double letters
    out = out
      .replace(/ā/g, 'aa')
      .replace(/ī/g, 'ii')
      .replace(/ū/g, 'uu')
      .replace(/ē/g, 'ee')
      .replace(/ō/g, 'oo');
    // Convert capital vowel markers (ITRANS style) to double letters
    out = out
      .replace(/A/g, 'aa')
      .replace(/I/g, 'ii')
      .replace(/U/g, 'uu')
      .replace(/E/g, 'ee')
      .replace(/O/g, 'oo')
      .replace(/RRi/g, 'rri')
      .replace(/RRI/g, 'rrri')
      .replace(/LLi/g, 'lli')
      .replace(/LLI/g, 'llli');
    return out.toLowerCase();
  };
  const normalizeTranslit = (val) => {
    if (!val) return '';
    let out = val.trim().toLowerCase();
    // Allow double vowels and simple ASCII
    out = out
      .replace(/ā/g, 'aa')
      .replace(/ī/g, 'ii')
      .replace(/ū/g, 'uu')
      .replace(/ṛ/g, 'r')
      .replace(/ṝ/g, 'rr')
      .replace(/ḷ/g, 'l')
      .replace(/ḹ/g, 'll')
      .replace(/[ṃṁ]/g, 'm')
      .replace(/ḥ/g, 'h')
      .replace(/ē/g, 'ee')
      .replace(/ō/g, 'oo')
      .replace(/ç/g, 'ch'); // fallback
    return out;
  };
  
  const handleQuizNext = () => {
    if (quizIndex < quizWords.length - 1) {
      setQuizIndex(quizIndex + 1);
      setQuizInput('');
      setQuizShowAnswer(false);
    }
  };
  
  const handleQuizCheck = () => {
    setQuizShowAnswer(true);
  };
  
  const isQuizCorrect = quizShowAnswer && currentTranslit &&
    normalizeTranslit(quizInput) === normalizeTranslit(currentTranslit);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="school" size={24} color="#4A90E2" style={styles.appIcon} />
          <Text style={styles.appTitle}>Lessons</Text>
        </View>
        <TouchableOpacity style={styles.languageButton} onPress={() => setLanguageMenuVisible(true)}>
          {(currentLanguage?.nativeChar || currentLanguage?.langCode) && (
            <View style={[styles.countryCodeBox, { backgroundColor: currentLanguage?.color || '#F5F5F5' }]}>
              {currentLanguage?.nativeChar ? (
                <Text style={[styles.nativeCharText, currentLanguage.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>{currentLanguage.nativeChar}</Text>
              ) : (
                <Text style={styles.countryCodeText}>{currentLanguage?.countryCode}</Text>
              )}
            </View>
          )}
          <View style={styles.languageButtonContent}>
            <Text style={styles.languageName}>{currentLanguage?.name}</Text>
            {currentLanguage?.nativeName && (
              <Text style={[styles.languageNativeName, currentLanguage.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' }]}>
                {currentLanguage.nativeName}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressSummary}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressCircleText}>{Math.round((completedCount / Math.max(1, lessons.length)) * 100)}%</Text>
        </View>
        <View style={styles.progressMetaRight}>
          <Text style={styles.progressLabel}>{completedCount}/{lessons.length} Lessons Completed</Text>
        </View>
      </View>

      {/* VIEW: MODULES */}
      {viewMode === 'modules' && (
        <ScrollView style={styles.fullPane} contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Text style={styles.sectionLabel}>Modules</Text>
          <View style={styles.moduleGrid}>
            {modules.map((mod) => {
              const moduleCompleted = mod.lessons.every(l => completedLessons.has(l.id));
              return (
                <TouchableOpacity
                  key={mod.id}
                  style={[styles.moduleCardLarge, moduleCompleted && styles.moduleCardCompleted]}
                  onPress={() => {
                    setActiveModuleId(mod.id);
                    const firstLesson = lessons.filter(l => l.moduleId === mod.id)[0];
                    if (firstLesson) setActiveLessonId(firstLesson.id);
                    setViewMode('lessons');
                  }}
                >
                  <View style={styles.moduleIconCircle}>
                    <Text style={styles.moduleIconText}>ಕ</Text>
                  </View>
                  <View style={styles.moduleHeader}>
                    <Text style={styles.moduleTitle}>{mod.title}</Text>
                    {moduleCompleted && <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />}
                  </View>
                  <Text style={styles.moduleMeta}>{mod.lessons.length} lessons • Tap to open</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* VIEW: LESSON LIST IN MODULE */}
      {viewMode === 'lessons' && (
        <ScrollView style={styles.fullPane} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('modules')}>
              <Ionicons name="arrow-back" size={16} color="#1A1A1A" />
              <Text style={styles.backText}>Modules</Text>
            </TouchableOpacity>
            <Text style={styles.sectionLabel}>Lessons in {activeModule?.title}</Text>
          </View>
          {lessonsInModule.map((lesson) => {
            const unlocked = isUnlocked(lesson);
            const completed = completedLessons.has(lesson.id);
            return (
              <TouchableOpacity
                key={lesson.id}
                style={[styles.lessonCardWide, !unlocked && styles.lessonCardLocked]}
                onPress={() => {
                  if (unlocked) {
                    setActiveLessonId(lesson.id);
                    setViewMode('lesson');
                  }
                }}
                disabled={!unlocked}
              >
                <View style={styles.lessonCardHeader}>
                  <View>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <Text style={styles.lessonSubtitle}>{lesson.subtitle}</Text>
                  </View>
                </View>
                <Text style={styles.lessonFocus}>{lesson.focus}</Text>
                <View style={styles.lessonMetaRow}>
                  <Text style={styles.lessonMetaText}>
                    {lesson.characters.length} chars • {lesson.diacritics.length} marks
                  </Text>
                  {completed && <Text style={styles.completedTag}>Completed</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* VIEW: LESSON DETAIL */}
      {viewMode === 'lesson' && (
        <ScrollView style={styles.detailPanel} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('lessons')}>
              <Ionicons name="arrow-back" size={16} color="#1A1A1A" />
              <Text style={styles.backText}>Lessons</Text>
            </TouchableOpacity>
            <Text style={styles.sectionLabel}>{activeModule?.title}</Text>
          </View>

          {activeLesson ? (
            <>
              <Text style={styles.detailTitle}>{activeLesson.title}</Text>
              <Text style={styles.detailSubtitle}>{activeLesson.subtitle}</Text>
              <Text style={styles.detailHint}>{activeLesson.focus}</Text>

              {/* Pronunciation & reading hints */}
              <View style={styles.hintCard}>
                <Text style={styles.hintTitle}>Pronunciation & Reading Tips</Text>
                <Text style={styles.hintBody}>• Break the syllable: consonant + vowel sign (ಮ + ಾ = ಮಾ).</Text>
                <Text style={styles.hintBody}>• Nasal marks: "ಂ" (ṁ) adds nasal sound; "ಃ" (ḥ) adds breathy end.</Text>
                <Text style={styles.hintBody}>• Read left to right; vowel signs wrap around consonants.</Text>
              </View>

              {(activeLesson.characters?.length || activeLesson.diacritics?.length) ? (
                <View style={styles.pillSection}>
                  {activeLesson.characters?.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Characters</Text>
                      <View style={styles.pillWrap}>
                        {activeLesson.characters.map((ch) => (
                          <View key={ch} style={styles.pill}>
                            <Text style={styles.pillText}>{ch}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                  {activeLesson.diacritics?.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Vowel Signs / Marks</Text>
                      <View style={styles.pillWrap}>
                        {activeLesson.diacritics.map((ch) => (
                          <View key={ch} style={[styles.pill, { backgroundColor: '#FFF7E6', borderColor: '#FFB347' }]}>
                            <Text style={[styles.pillText, { color: '#B25900' }]}>{ch}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              ) : null}

              {/* Blog-style lesson notes */}
              {activeLesson.article?.length ? (
                <View style={styles.blogCard}>
                  <Text style={styles.blogTitle}>How to read these</Text>
                  {activeLesson.article.map((para, idx) => {
                    const parts = para.split(': ');
                    const hasLabel = parts.length > 1;
                    const label = hasLabel ? parts[0] : '';
                    const rest = hasLabel ? parts.slice(1).join(': ') : para;
                    return (
                      <Text key={idx} style={styles.blogParagraph}>
                        {hasLabel ? (
                          <>
                            <Text style={styles.blogEmph}>{label}:</Text>{' '}
                            <Text>{rest}</Text>
                          </>
                        ) : (
                          para
                        )}
                      </Text>
                    );
                  })}
                </View>
              ) : null}

              {/* Lesson characters transliteration (current lesson only) */}
              {(activeLesson.characters?.length || activeLesson.diacritics?.length) ? (
                <View style={styles.hintCard}>
                  <Text style={styles.hintTitle}>This lesson: how to read these</Text>
                  {[...(activeLesson.characters || []), ...(activeLesson.diacritics || [])].map((ch) => (
                    <View key={ch} style={styles.translitRow}>
                      <Text style={styles.translitChar}>{ch}</Text>
                      <Text style={styles.translitText}>{lessonTransliterations[ch] || '...'}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Transliteration guide - full chart only (below characters) */}
              <View style={styles.hintCard}>
                <TouchableOpacity onPress={() => setShowTranslitGuide((v) => !v)} style={styles.translitToggle}>
                  <Text style={styles.hintTitle}>Transliteration Guide</Text>
                  <Ionicons name={showTranslitGuide ? 'chevron-up' : 'chevron-down'} size={18} color="#1A1A1A" />
                </TouchableOpacity>
                {showTranslitGuide && (
                  <View style={styles.translitGrid}>
                    <Text style={styles.translitGridHeader}>Full Chart</Text>
                    <View style={styles.translitGridSection}>
                      <Text style={styles.translitGridTitle}>Vowels</Text>
                      <View style={styles.translitGridWrap}>
                        {ITRANS_CHART.vowels.map(([kn, itr]) => (
                          <View key={`${kn}-${itr}`} style={styles.translitCell}>
                            <Text style={styles.translitCellChar}>{kn}</Text>
                            <Text style={styles.translitCellText}>{itr}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.translitGridSection}>
                      <Text style={styles.translitGridTitle}>Consonants</Text>
                      <View style={styles.translitGridWrap}>
                        {ITRANS_CHART.consonants.map(([kn, itr]) => (
                          <View key={`${kn}-${itr}`} style={styles.translitCell}>
                            <Text style={styles.translitCellChar}>{kn}</Text>
                            <Text style={styles.translitCellText}>{itr}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.translitGridSection}>
                      <Text style={styles.translitGridTitle}>Matras / Marks</Text>
                      <View style={styles.translitGridWrap}>
                        {ITRANS_CHART.matras.map(([kn, itr]) => (
                          <View key={`${kn}-${itr}`} style={styles.translitCell}>
                            <Text style={styles.translitCellChar}>{kn}</Text>
                            <Text style={styles.translitCellText}>{itr}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.translitGridSection}>
                      <Text style={styles.translitGridTitle}>Numbers</Text>
                      <View style={styles.translitGridWrap}>
                        {ITRANS_CHART.numerals.map(([kn, itr]) => (
                          <View key={`${kn}-${itr}`} style={styles.translitCell}>
                            <Text style={styles.translitCellChar}>{kn}</Text>
                            <Text style={styles.translitCellText}>{itr}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    isUnlocked(activeLesson) ? styles.actionButtonPrimary : styles.actionButtonDisabled,
                  ]}
                  onPress={() => isUnlocked(activeLesson) && toggleComplete(activeLesson.id)}
                  disabled={!isUnlocked(activeLesson)}
                >
                  <Ionicons name={completedLessons.has(activeLesson.id) ? 'checkmark-circle' : 'play'} size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionButtonText}>
                    {completedLessons.has(activeLesson.id) ? 'Mark as Incomplete' : 'Mark Complete'}
                  </Text>
                </TouchableOpacity>
                {activeLesson.prereq && !isUnlocked(activeLesson) && (
                  <View style={styles.lockNotice}>
                    <Ionicons name="lock-closed" size={14} color="#888" />
                    <Text style={styles.lockNoticeText}>Finish previous lesson to unlock</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <Text style={styles.practiceEmpty}>Select a lesson to view details.</Text>
          )}

          {/* Lesson-end quiz: type transliteration to self-check - one word at a time */}
          <View style={styles.practiceSection}>
            <View style={styles.practiceHeader}>
              <Text style={styles.sectionLabel}>Check Yourself</Text>
              <Text style={styles.practiceCount}>{quizIndex + 1} / {quizWords.length}</Text>
            </View>
            {quizLoading ? (
              <Text style={styles.practiceEmpty}>Loading quiz words...</Text>
            ) : quizWords.length === 0 ? (
              <Text style={styles.practiceEmpty}>No quiz words available yet.</Text>
            ) : currentQuizWord ? (
              <>
                <View style={styles.quizCard}>
                  <Text style={styles.practiceWord}>{currentQuizWord.text}</Text>
                  <Text style={styles.practiceGloss}>{currentQuizWord.gloss || 'English definition'}</Text>
                  {quizShowAnswer && (
                    <View style={styles.quizAnswerBox}>
                      <Text style={styles.quizAnswerLabel}>Correct transliteration:</Text>
                      <Text style={[styles.quizAnswerText, isQuizCorrect && { color: '#4CAF50' }]}>
                        {currentTranslit || 'Loading...'}
                      </Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[
                    styles.quizInputLarge,
                    quizShowAnswer && isQuizCorrect && { borderColor: '#4CAF50', backgroundColor: '#F0FDF4' },
                    quizShowAnswer && !isQuizCorrect && { borderColor: '#FF6B6B', backgroundColor: '#FEF2F2' },
                  ]}
                  placeholder="Type ITRANS transliteration (e.g. amara)"
                  value={quizInput}
                  onChangeText={setQuizInput}
                  autoCorrect={false}
                  editable={!quizShowAnswer}
                />
                <View style={styles.quizButtons}>
                  {!quizShowAnswer ? (
                    <TouchableOpacity style={styles.quizCheckBtn} onPress={handleQuizCheck}>
                      <Ionicons name="checkmark-done" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.quizButtonText}>Check Answer</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.quizNextBtn} 
                      onPress={handleQuizNext}
                      disabled={quizIndex >= quizWords.length - 1}
                    >
                      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.quizButtonText}>
                        {quizIndex < quizWords.length - 1 ? 'Next Word' : 'Done'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.practiceEmpty}>Quiz complete!</Text>
            )}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={languageMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLanguageMenuVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLanguageMenuVisible(false)}>
          <View style={styles.languageMenu}>
            <Text style={styles.menuTitle}>Select Language</Text>
            {availableLanguages.map((lang) => {
              const isSelected = selectedLanguage === lang.code;
              const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
              return (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  isSelected && styles.languageOptionSelected,
                ]}
                onPress={() => {
                  setSelectedLanguage(lang.code);
                  setLanguageMenuVisible(false);
                  const firstModule = SCRIPT_MODULES[lang.code]?.[0];
                  const firstLesson = firstModule?.lessons?.[0];
                  setActiveModuleId(firstModule?.id || null);
                  setActiveLessonId(firstLesson?.id || null);
                  setCompletedLessons(new Set());
                  setPracticeCorrect(0);
                  setPracticeIndex(0);
                }}
              >
                {(lang.nativeChar || lang.langCode) && (
                  <View style={[styles.countryCodeBox, { backgroundColor: lang.color }]}>
                    {lang.nativeChar ? (
                      <Text style={[styles.nativeCharText, lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>{lang.nativeChar}</Text>
                    ) : (
                      <Text style={styles.countryCodeText}>{lang.countryCode}</Text>
                    )}
                  </View>
                )}
                <View style={styles.languageOptionContent}>
                  <View style={styles.languageNameRow}>
                    <View>
                      <Text
                        style={[
                          styles.languageOptionText,
                          isSelected && styles.languageOptionTextSelected,
                          !lang.active && styles.languageOptionTextDisabled,
                        ]}
                      >
                        {lang.name}
                      </Text>
                      {lang.nativeName && (
                        <Text
                          style={[
                            styles.languageOptionNativeName,
                            isSelected && styles.languageOptionNativeNameSelected,
                            !lang.active && styles.languageOptionNativeNameDisabled,
                            lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' }
                          ]}
                        >
                          {lang.nativeName}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                {/* SRS Stats Chips - Right aligned, icon only */}
                <View style={styles.languageSrsChips}>
                  <View style={styles.languageSrsChipNew}>
                    <Ionicons name="add-circle" size={16} color="#5D8EDC" />
                    <Text style={styles.languageSrsChipTextNew}>
                      {langStats.new_count || 0}
                    </Text>
                  </View>
                  <View style={styles.languageSrsChipDue}>
                    <Ionicons name="alarm" size={16} color="#FF6B6B" />
                    <Text style={styles.languageSrsChipTextDue}>
                      {langStats.due_count || 0}
                    </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  appIcon: { marginRight: 8 },
  appTitle: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A' },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  countryCodeBox: {
    width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  nativeCharText: { fontSize: 18, color: '#FFFFFF', fontWeight: '600' },
  countryCodeText: { fontSize: 12, color: '#FFFFFF', fontWeight: 'bold' },
  languageButtonContent: { flexDirection: 'column', alignItems: 'flex-start', marginRight: 4 },
  languageName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  languageNativeName: { fontSize: 12, color: '#666', marginTop: 2 },

  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#F8FBFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5F0FF',
  },
  progressCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E6F0FF',
    borderWidth: 2,
    borderColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  progressCircleText: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  progressMetaRight: { flex: 1, alignItems: 'flex-end' },
  progressLabel: { fontSize: 13, color: '#1A1A1A', fontWeight: '700' },

  fullPane: { flex: 1, backgroundColor: '#F5F7FB' },
  contentRow: { flex: 1, flexDirection: 'row' },
  moduleColumn: { width: 360, paddingHorizontal: 12, paddingTop: 12, backgroundColor: '#F9FBFE' },
  lessonList: { flex: 1.1, backgroundColor: '#F9FBFE', paddingHorizontal: 16, paddingTop: 16 },
  detailPanel: { flex: 1.5, paddingHorizontal: 16, paddingTop: 16, backgroundColor: '#FFFFFF' },
  moduleGrid: { flexDirection: 'column', gap: 14 },
  moduleCardLarge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  moduleCardCompleted: { borderColor: '#4CAF50', shadowOpacity: 0.1 },
  moduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    marginBottom: 10,
  },
  moduleCardActive: {
    borderColor: '#4A90E2',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  moduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  moduleTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  moduleMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  moduleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F5F8FF',
    borderWidth: 1,
    borderColor: '#D9E6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleIconText: { fontSize: 28, fontWeight: '800', color: '#1A1A1A' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#EFF3FB' },
  backText: { fontSize: 13, color: '#1A1A1A', marginLeft: 6, fontWeight: '600' },

  lessonNode: { marginBottom: 20 },
  nodeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  nodeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginRight: 12,
    borderWidth: 1,
  },
  nodeIconCompleted: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  nodeIconActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  nodeIconLocked: { backgroundColor: '#F7F7F7', borderColor: LOCK_COLOR },

  connector: {
    height: 22,
    width: 2,
    backgroundColor: '#E0E0E0',
    marginLeft: 15,
    marginTop: 2,
  },

  lessonCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  lessonCardActive: { borderColor: '#4A90E2', shadowOpacity: 0.08 },
  lessonCardLocked: { opacity: 0.6 },
  lessonCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  lessonTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  lessonSubtitle: { fontSize: 13, color: '#555', marginTop: 2 },
  lessonFocus: { fontSize: 13, color: '#444', marginTop: 8, lineHeight: 18 },
  lessonMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' },
  lessonMetaText: { fontSize: 12, color: '#666' },
  completedTag: { fontSize: 12, color: '#4CAF50', fontWeight: '700' },
  lessonCardWide: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    marginBottom: 14,
  },
  hintCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    marginTop: 12,
  },
  hintTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  hintBody: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 4 },
  translitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  translitChar: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  translitText: { fontSize: 14, color: '#444' },
  translitToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  translitHint: { fontSize: 12, color: '#666', marginTop: 8 },
  translitGrid: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#E6ECF5', paddingTop: 10 },
  translitGridHeader: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  translitGridSection: { marginBottom: 8 },
  translitGridTitle: { fontSize: 12, fontWeight: '700', color: '#4A90E2', marginBottom: 4 },
  translitGridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  translitCell: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    backgroundColor: '#FFFFFF',
  },
  translitCellChar: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  translitCellText: { fontSize: 12, color: '#444', textAlign: 'center' },
  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  levelPillText: { fontSize: 12, fontWeight: '700', color: '#4A90E2' },

  detailTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  detailSubtitle: { fontSize: 14, color: '#555', marginTop: 4 },
  detailHint: { fontSize: 13, color: '#4A90E2', marginTop: 6 },

  pillSection: { marginTop: 16 },
  sectionLabel: { fontSize: 13, color: '#777', marginBottom: 6, textTransform: 'uppercase', fontWeight: '700' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F5F8FF',
    borderWidth: 1,
    borderColor: '#E6ECF5',
    marginRight: 8,
    marginBottom: 8,
  },
  pillText: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },

  practiceSection: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6ECF5',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  practiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  practiceCount: { fontSize: 12, color: '#4A90E2', fontWeight: '700' },
  practiceEmpty: { fontSize: 13, color: '#666', marginTop: 12, lineHeight: 18 },
  practiceCard: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  practiceWord: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  practiceGloss: { fontSize: 13, color: '#666', marginTop: 2 },
  quizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  quizCard: {
    backgroundColor: '#F8FBFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6ECF5',
  },
  quizInputLarge: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#E6ECF5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
  },
  quizAnswerBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E6ECF5',
  },
  quizAnswerLabel: { fontSize: 12, color: '#666', marginBottom: 4, fontWeight: '600' },
  quizAnswerText: { fontSize: 16, color: '#1A1A1A', fontWeight: '700' },
  quizButtons: { flexDirection: 'row', justifyContent: 'center' },
  quizCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
  },
  quizNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
  },

  blogCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F2E8D9',
    marginTop: 12,
    marginBottom: 8,
  },
  blogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  blogParagraph: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 6,
  },
  blogEmph: { fontWeight: '700', color: '#1A1A1A' },

  actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionButtonPrimary: { backgroundColor: '#4A90E2' },
  actionButtonDisabled: { backgroundColor: '#B0BEC5' },
  actionButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  lockNotice: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  lockNoticeText: { fontSize: 12, color: '#777', marginLeft: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  languageMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  menuTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 16 },
  languageOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 8 },
  languageOptionSelected: { backgroundColor: '#F0F7FF' },
  languageOptionDisabled: { opacity: 0.5 },
  languageOptionContent: { flex: 1, flexDirection: 'column' },
  languageOptionText: { fontSize: 16, color: '#1A1A1A' },
  languageOptionTextSelected: { fontWeight: '700', color: '#4A90E2' },
  languageOptionTextDisabled: { color: '#999' },
  languageOptionNativeName: { fontSize: 14, color: '#666', marginTop: 2 },
  languageOptionNativeNameSelected: { color: '#4A90E2' },
  languageOptionNativeNameDisabled: { color: '#999' },
  languageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  languageSrsChips: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  languageSrsChipNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  languageSrsChipTextNew: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5D8EDC',
  },
  languageSrsChipDue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  languageSrsChipTextDue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B6B',
  },
});
