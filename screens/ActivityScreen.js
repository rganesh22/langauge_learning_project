import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  Platform,
  PanResponder,
} from 'react-native';
import SafeText from '../components/SafeText';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { MASTERY_FILTERS, WORD_CLASSES as SHARED_WORD_CLASSES, LEVELS as SHARED_LEVELS, LEVEL_COLORS as SHARED_LEVEL_COLORS } from '../constants/filters';
import { LanguageContext } from '../contexts/LanguageContext';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

const ACTIVITY_COLORS = {
  reading: { primary: '#4A90E2', light: '#E8F4FD' },
  listening: { primary: '#2B654A', light: '#E8F5EF' },
  writing: { primary: '#FF6B6B', light: '#FFE8E8' },
  speaking: { primary: '#FF9500', light: '#FFF4E6' },
  translation: { primary: '#8B5CF6', light: '#F3E8FF' },
  conversation: { primary: '#9B59B6', light: '#F4E6FF' },
};

const WORD_CLASSES = SHARED_WORD_CLASSES;
const LEVELS = SHARED_LEVELS;
const LEVEL_COLORS = SHARED_LEVEL_COLORS;

import { QUESTIONS_LABELS, getQuestionLabel, getSubmitLabel } from '../constants/ui_labels';

export default function ActivityScreen({ route, navigation }) {
  const { activityType, activityId, fromHistory } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  // Prefer context language; fall back to route param if provided
  const routeLang = (route && route.params && route.params.language) || null;
  const language = ctxLanguage || routeLang || 'kannada';
  const [resolvedActivityId, setResolvedActivityId] = useState(activityId || null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [wordsUsed, setWordsUsed] = useState([]);
  const [transliterations, setTransliterations] = useState({});
  const [showApiModal, setShowApiModal] = useState(false);
  const [allApiDetails, setAllApiDetails] = useState([]); // Array to store all API calls
  const [expandedApiCards, setExpandedApiCards] = useState(new Set()); // Track which API cards are expanded
  const [showDictionary, setShowDictionary] = useState(false);
  const [showTransliterations, setShowTransliterations] = useState(false); // Start false, load from settings
  const [dictionarySearch, setDictionarySearch] = useState('');
  const [highlightVocab, setHighlightVocab] = useState(false); // Toggle for vocabulary highlighting (off by default)
  const [showAnswers, setShowAnswers] = useState(false);
  const [dictionaryResults, setDictionaryResults] = useState([]);
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  // Initialize filters with all values enabled by default (except "All" which means empty array)
  // Dictionary filters - by default all are selected (empty array means "All")
  const [dictionaryMasteryFilter, setDictionaryMasteryFilter] = useState([]); // Empty = all selected
  const [dictionaryWordClassFilter, setDictionaryWordClassFilter] = useState([]); // Empty = all selected
  const [dictionaryLevelFilter, setDictionaryLevelFilter] = useState([]); // Empty = all selected
  const [dictionaryFiltersExpanded, setDictionaryFiltersExpanded] = useState(false);
  // Listening activity states
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [playingParagraph, setPlayingParagraph] = useState(null);
  const [audioSounds, setAudioSounds] = useState({}); // Store sound objects for each paragraph
  const [audioStatus, setAudioStatus] = useState({}); // Store playback status for each paragraph
  const audioSoundsRef = useRef({}); // Ref to track sound objects
  const paragraphScrollViewRef = useRef(null); // Ref to track paragraph ScrollView
  const seekBarWidthsRef = useRef({}); // Ref to track seek bar widths for each paragraph
  // Audio playback position and duration tracking
  const [audioPosition, setAudioPosition] = useState({}); // { paragraphIndex: currentTime }
  const [audioDuration, setAudioDuration] = useState({}); // { paragraphIndex: duration }
  const positionUpdateIntervalRef = useRef({}); // Track intervals for position updates
  // Auto-playthrough tracking
  const [isFirstPlaythrough, setIsFirstPlaythrough] = useState(true);

  // Runtime guard: log any transliteration entries that are not plain strings.
  // This helps catch remaining places that may write objects/arrays into the transliterations map
  // which then render as "[object Object]" in the UI.
  useEffect(() => {
    try {
      Object.entries(transliterations || {}).forEach(([k, v]) => {
        if (v !== null && typeof v !== 'string' && typeof v !== 'undefined') {
          console.warn(`[Transliteration] Non-string value for key ${k}:`, v);
        }
      });
    } catch (e) {
      console.warn('[Transliteration] Error while checking transliterations:', e);
    }
  }, [transliterations]);
  const [userInteracted, setUserInteracted] = useState(false); // Track if user stopped/seeked/interacted
  const autoPlayTimeoutRef = useRef(null); // Track auto-play timeout
  // Writing activity states
  const [gradingResult, setGradingResult] = useState(null);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [rubricExpanded, setRubricExpanded] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState([]); // Array of all submissions with feedback
  const [expandedSubmissions, setExpandedSubmissions] = useState(new Set()); // Track which submissions are expanded
  // Audio playback state for recording
  const [recordingAudioPlaying, setRecordingAudioPlaying] = useState(false);
  const [recordingAudioPosition, setRecordingAudioPosition] = useState(0);
  const [recordingAudioDuration, setRecordingAudioDuration] = useState(0);
  const recordingAudioRef = useRef(null);
  // Audio playback state for submissions (keyed by submission index)
  const [submissionAudioStates, setSubmissionAudioStates] = useState({});
  const submissionAudioRefs = useRef({});
  // Speaking activity recording states
  const [recording, setRecording] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState('idle'); // 'idle', 'recording', 'stopped'
  const [recordingUri, setRecordingUri] = useState(null);
  const [useAudioInput, setUseAudioInput] = useState(false); // Toggle between text and audio input
  const recordingRef = useRef(null);
  const [expandedDebugSubmissions, setExpandedDebugSubmissions] = useState(new Set()); // Track which submission debug sections are expanded
  const [speakerProfileExpanded, setSpeakerProfileExpanded] = useState(false); // Track speaker profile expansion
  const recordingProgressBarWidthRef = useRef(0);
  const submissionProgressBarWidthRefs = useRef({});
  const [tasksExpanded, setTasksExpanded] = useState(false); // Track tasks expansion
  // Conversation activity states
  const [conversationTopic, setConversationTopic] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]); // Array of {user_message, ai_response, audio_data, etc}
  const [conversationTasks, setConversationTasks] = useState([]); // Tasks to complete
  const [tasksCompleted, setTasksCompleted] = useState(new Set()); // Track completed tasks by index
  const [useSpeechInput, setUseSpeechInput] = useState(false); // Default to text input
  const [conversationRating, setConversationRating] = useState(null); // Rating result when tasks complete
  const [conversationRatings, setConversationRatings] = useState([]); // Array of all ratings/submissions
  const [ratingLoading, setRatingLoading] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false); // Track if conversation has started
  const [conversationVoice, setConversationVoice] = useState(null); // Store voice for conversation
  const [expandedRatings, setExpandedRatings] = useState(new Set()); // Track which ratings are expanded
  const [messageLoading, setMessageLoading] = useState(false); // Track if message is being sent
  const [loadingStage, setLoadingStage] = useState(''); // Track loading stage: 'generating_text', 'generating_audio', etc.
  const conversationAudioRefs = useRef({}); // Store audio refs for each AI response
  const [validationError, setValidationError] = useState(null); // Store validation error message to display in UI
  const [validationErrorTranslit, setValidationErrorTranslit] = useState(null); // Transliteration for validation error

  const colors = ACTIVITY_COLORS[activityType] || ACTIVITY_COLORS.reading;

  // Helper: ensure transliteration map values are strings to avoid rendering objects
  const coerceTranslitMapToStrings = (map) => {
    const out = {};
    if (!map) return out;
    Object.keys(map).forEach(k => {
      const v = map[k];
      if (v === null || v === undefined) {
        out[k] = '';
      } else if (typeof v === 'string') {
        out[k] = v;
      } else if (Array.isArray(v)) {
        out[k] = v.filter(Boolean).join('\n');
      } else if (typeof v === 'object') {
        try {
          // prefer joining object values when possible
          const vals = Object.values(v).filter(Boolean).map(x => (typeof x === 'string' ? x : JSON.stringify(x)));
          out[k] = vals.length > 0 ? vals.join(' ') : JSON.stringify(v);
        } catch (e) {
          out[k] = JSON.stringify(v);
        }
      } else {
        out[k] = String(v);
      }
    });
    return out;
  };

  // Enable debug logging when normalization coerces non-string values.
  // For development, show these normalization warnings by default.
  // To explicitly disable debug logging, start Metro/Expo with NORMALIZE_DEBUG=false.
  const NORMALIZE_DEBUG = typeof process !== 'undefined'
    ? (String(process?.env?.NORMALIZE_DEBUG).toLowerCase() === 'false' ? false : true)
    : true;

  // Normalize text-like values into displayable strings to avoid '[object Object]' in UI
  const normalizeText = (v) => {
    if (v === null || typeof v === 'undefined') return '';
    if (typeof v === 'string') return v;
    const originalType = typeof v;
    let out = '';
    if (typeof v === 'number' || typeof v === 'boolean') {
      out = String(v);
    } else if (Array.isArray(v)) {
      // Flatten array elements recursively and join by newline for paragraphs
      out = v.map(item => normalizeText(item)).filter(Boolean).join('\n');
    } else if (typeof v === 'object') {
      // Prefer common fields
      for (const key of ['text', 'content', 'value', 'label']) {
        if (v[key] && (typeof v[key] === 'string' || typeof v[key] === 'number')) {
          out = String(v[key]);
          break;
        }
      }
      // If object has a 'parts' or 'paragraphs' array, join them
      if (!out && Array.isArray(v.parts)) out = normalizeText(v.parts);
      if (!out && Array.isArray(v.paragraphs)) out = normalizeText(v.paragraphs);
      if (!out) {
        try {
          out = JSON.stringify(v);
        } catch (e) {
          out = String(v);
        }
      }
    } else {
      out = String(v);
    }

    if (NORMALIZE_DEBUG && originalType !== 'string') {
      try {
        // Truncate long outputs for readability
        const preview = typeof out === 'string' && out.length > 200 ? out.substring(0, 200) + '...(truncated)' : out;
        console.warn('[normalizeText] coerced', { originalType, preview });
      } catch (e) {
        console.warn('[normalizeText] coerced non-string value (unable to preview)');
      }
    }

    return out;
  };

  // Helper that normalizes a value and logs the field key when debug is enabled.
  const normalizeField = (key, v) => {
    const res = normalizeText(v);
  // Only warn when value is present but not a string; skip undefined/null which are expected
  if (NORMALIZE_DEBUG && v !== null && typeof v !== 'undefined' && typeof v !== 'string') {
      try {
        const preview = typeof res === 'string' && res.length > 200 ? res.substring(0, 200) + '...(truncated)' : res;
        // Capture a short stack snippet to help trace the caller
        let stackSnippet = '';
        try {
          const st = (new Error()).stack || '';
          stackSnippet = st.split('\n').slice(2, 5).map(s => s.trim()).join(' | ');
        } catch (e) {
          stackSnippet = '';
        }
        console.warn('[normalizeField]', { key, originalType: typeof v, preview, activityType, resolvedActivityId, stack: stackSnippet });
      } catch (e) {
        console.warn('[normalizeField] key=', key, 'coerced non-string value');
      }
    }
    return res;
  };

  const sanitizeActivity = (act) => {
    if (!act || typeof act !== 'object') return act;
    const a = { ...act };
    // Normalize common fields
    ['story', 'story_name', 'passage', 'passage_name', 'activity_name', 'topic', 'hint'].forEach(k => {
      if (a[k]) a[k] = normalizeField(k, a[k]);
    });
    // Questions
    if (a.questions && Array.isArray(a.questions)) {
      a.questions = a.questions.map((q, qi) => ({
        ...q,
        question: normalizeField(`question_${qi}`, q.question),
        options: Array.isArray(q.options) ? q.options.map((o, oi) => normalizeField(`option_${qi}_${oi}`, o)) : q.options,
      }));
    }
    // Required words
    if (a.required_words && Array.isArray(a.required_words)) {
      a.required_words = a.required_words.map((w, wi) => normalizeField(`required_word_${wi}`, w));
    }
    return a;
  };

  useEffect(() => {
    loadActivity();
  }, []);

  // Auto-search dictionary when dictionarySearch or filters change and dictionary modal is open
  useEffect(() => {
    if (showDictionary) {
      const searchDictionary = async () => {
        setDictionaryLoading(true);
        try {
          const params = new URLSearchParams();
          if (dictionarySearch.trim()) {
            params.append('search', dictionarySearch.trim());
          }
          // Add filters as query parameters (only if they have values)
          // Empty arrays mean "All" is selected, so don't send filter params
          if (dictionaryMasteryFilter.length > 0) {
            dictionaryMasteryFilter.forEach(filter => {
              if (filter) params.append('mastery_filter', filter);
            });
          }
          if (dictionaryWordClassFilter.length > 0) {
            dictionaryWordClassFilter.forEach(filter => {
              if (filter) params.append('word_class_filter', filter);
            });
          }
          if (dictionaryLevelFilter.length > 0) {
            dictionaryLevelFilter.forEach(filter => {
              if (filter) params.append('level_filter', filter);
            });
          }
          params.append('limit', '100');

          const response = await fetch(`${API_BASE_URL}/api/vocabulary/${language}?${params.toString()}`);
          const data = await response.json();
          setDictionaryResults(data.words || []);
        } catch (error) {
          console.error('Error searching dictionary:', error);
          setDictionaryResults([]);
        } finally {
          setDictionaryLoading(false);
        }
      };
      
      // Always search when modal opens (with default filters if no search term)
      searchDictionary();
    } else {
      // Clear results when modal closes
      setDictionaryResults([]);
    }
  }, [dictionarySearch, showDictionary, language, dictionaryMasteryFilter, dictionaryWordClassFilter, dictionaryLevelFilter]);

  const transliterateText = async (text, toScript = 'IAST') => {
    // Normalize non-string inputs so we never send objects/arrays to the backend
    const normalizeToString = (v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return v.filter(Boolean).join('\n');
      if (typeof v === 'object') {
        // Prefer joining string values from the object, fallback to JSON
        try {
          const vals = Object.values(v).filter(Boolean).map(x => (typeof x === 'string' ? x : JSON.stringify(x)));
          if (vals.length > 0) return vals.join(' ');
        } catch (e) {
          // fallthrough
        }
        return JSON.stringify(v);
      }
      return String(v);
    };
    text = normalizeToString(text);
    if (!text || typeof text !== 'string' || !text.trim()) return '';
    if (!language || typeof language !== 'string') {
      console.warn('Transliteration skipped: invalid language', language);
      return '';
    }
    try {
      // Guess source script to help backend choose correct aksharamukha mapping.
      // If text contains Arabic/Perso-Arabic range, mark from_script as 'Urdu';
      // if text contains Devanagari characters, mark as 'Devanagari'. Otherwise omit.
      let from_script = null;
      try {
        if (/[\u0900-\u097F]/.test(text)) from_script = 'Devanagari';
        else if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) from_script = 'Urdu';
      } catch (e) {}

      const response = await fetch(`${API_BASE_URL}/api/transliterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), language, to_script: toScript, from_script }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Transliteration failed (${response.status}):`, errorText);
        return '';
      }
      
      const data = await response.json();
      try {
        // Log short preview for debugging transliteration mismatches (Urdu showing Arabic)
        const previewIn = (text || '').substring(0, 200).replace(/\n/g, '\\n');
        const previewOut = (data.transliteration || '').substring(0, 200).replace(/\n/g, '\\n');
        console.log('[transliterateText] language=', language, 'toScript=', toScript, 'in=', previewIn, 'out=', previewOut);
      } catch (e) {}
      return data.transliteration || '';
    } catch (error) {
      console.error('Transliteration error:', error);
      return '';
    }
  };

    // State: store native-script renderings (e.g., Urdu Nastaliq) for keys
    const [nativeScriptRenderings, setNativeScriptRenderings] = useState({});

    // Ensure native-script rendering (Arabic/Nastaliq) for a specific key when language is Urdu
    const ensureNativeScriptForKey = async (key, sourceText) => {
      if (!key || !sourceText) return;
      if (language !== 'urdu') return;
      try {
        // If already present, skip
        if (nativeScriptRenderings && nativeScriptRenderings[key]) return;
        // Request Arabic/Perso-Arabic script rendering from backend
  const arabic = await transliterateText(sourceText, 'Urdu');
        if (arabic) {
          setNativeScriptRenderings(prev => ({ ...prev, [key]: arabic }));
        }
      } catch (err) {
        console.error('Error ensuring native script rendering for key', key, err);
      }
    };

    // Ensure native-script renderings for the loaded activity (run after activity loads)
    const ensureNativeScriptForActivity = async () => {
      if (!activity) return;
      if (language !== 'urdu') return;
      const toFetch = [];
      if (activity.story && !nativeScriptRenderings.story) toFetch.push({ key: 'story', text: activity.story });
      if (activity.story_name && !nativeScriptRenderings.storyName) toFetch.push({ key: 'storyName', text: activity.story_name });
      if (activity.passage && !nativeScriptRenderings.passage) toFetch.push({ key: 'passage', text: activity.passage });
      if (activity.passage_name && !nativeScriptRenderings.passageName) toFetch.push({ key: 'passageName', text: activity.passage_name });
      if (activity.questions && Array.isArray(activity.questions)) {
        for (let i = 0; i < activity.questions.length; i++) {
          const q = activity.questions[i];
          if (q.question && !nativeScriptRenderings[`question_${i}`]) toFetch.push({ key: `question_${i}`, text: q.question });
          if (q.options && Array.isArray(q.options)) {
            for (let o = 0; o < q.options.length; o++) {
              if (q.options[o] && !nativeScriptRenderings[`option_${i}_${o}`]) toFetch.push({ key: `option_${i}_${o}`, text: q.options[o] });
            }
          }
        }
      }
      if (toFetch.length === 0) return;
      try {
        for (const item of toFetch) {
          try {
            const a = await transliterateText(item.text, 'Urdu');
            if (a) setNativeScriptRenderings(prev => ({ ...prev, [item.key]: a }));
          } catch (e) {
            console.error('Error fetching native script for', item.key, e);
          }
        }
      } catch (e) {
        console.error('Error ensuring native script for activity', e);
      }
    };

  // Ensure transliteration for a specific activity key (e.g., 'question_0') and show transliterations
  const ensureAndShowTransliterationForKey = async (key, sourceText) => {
    if (!sourceText || !key) return;
    try {
      // Show transliterations UI immediately
      setShowTransliterations(true);

      // If we already have it, nothing else to do
      if (transliterations && transliterations[key]) return;

      const t = await transliterateText(sourceText);
      if (t) {
        setTransliterations(prev => ({ ...prev, [key]: t }));
      }
    } catch (err) {
      console.error('Error ensuring transliteration for key', key, err);
    }
  };

  // Ensure transliterations for the loaded activity are available when user enables them
  const ensureTransliterationsForActivity = async () => {
    if (!activity || !showTransliterations) return;
    const toFetch = [];
    // Story / passage
    if (activity.story && !transliterations.story) toFetch.push({ key: 'story', text: activity.story });
    if (activity.story_name && !transliterations.storyName) toFetch.push({ key: 'storyName', text: activity.story_name });
    if (activity.passage && !transliterations.passage) toFetch.push({ key: 'passage', text: activity.passage });
    if (activity.passage_name && !transliterations.passageName) toFetch.push({ key: 'passageName', text: activity.passage_name });

    // Questions and options
    if (activity.questions && Array.isArray(activity.questions)) {
      for (let i = 0; i < activity.questions.length; i++) {
        const q = activity.questions[i];
        if (q.question && !transliterations[`question_${i}`]) toFetch.push({ key: `question_${i}`, text: q.question });
        if (q.options && Array.isArray(q.options)) {
          for (let o = 0; o < q.options.length; o++) {
            if (q.options[o] && !transliterations[`option_${i}_${o}`]) toFetch.push({ key: `option_${i}_${o}`, text: q.options[o] });
          }
        }
      }
    }

    if (toFetch.length === 0) return;

    try {
      // Batch transliterate sequentially to avoid overloading backend
      const newTrans = {};
      for (const item of toFetch) {
        try {
          // For longer story/passage texts, transliterate per-paragraph so the
          // reading activity can show transliteration after each paragraph.
          const src = normalizeText(item.text);
            if (item.key === 'story' || item.key === 'passage') {
            // Split into paragraphs and transliterate each paragraph sequentially
            const paras = [];
            const doubleNewlineSplit = src.split(/\n\s*\n/).filter(p => p.trim());
            let paragraphs = [];
            if (doubleNewlineSplit.length > 1) paragraphs = doubleNewlineSplit;
            else {
              const singleNewlineSplit = src.split(/\n/).filter(p => p.trim());
              paragraphs = singleNewlineSplit.length > 1 ? singleNewlineSplit : [src];
            }
            for (const p of paragraphs) {
              // Force Roman transliteration for the transliteration pane (IAST)
              const tpara = await transliterateText(p.trim(), 'IAST');
              paras.push(tpara || '');
            }
            // Join with double-newline to preserve paragraph boundaries when rendering
            const joined = paras.join('\n\n');
            try {
              console.log('[ensureTransliterationsForActivity] key=', item.key, 'paragraphs=', paragraphs.length, 'joinedPreview=', (joined||'').substring(0,200).replace(/\n/g,'\\n'));
            } catch (e) {}
            if (joined) newTrans[item.key] = joined;
          } else {
            // Shorter items: transliterate normally to default target (IAST)
            const t = await transliterateText(item.text, 'IAST');
            if (t) newTrans[item.key] = t;
          }
        } catch (err) {
          console.error('Error transliterating', item.key, err);
        }
      }
  if (Object.keys(newTrans).length > 0) setTransliterations(prev => ({ ...prev, ...coerceTranslitMapToStrings(newTrans) }));
    try {
      console.log('[ensureTransliterationsForActivity] newTrans keys=', Object.keys(newTrans), 'sample=', JSON.stringify(Object.fromEntries(Object.entries(newTrans).slice(0,5))))
    } catch (e) {}
    } catch (err) {
      console.error('Error ensuring transliterations for activity:', err);
    }
  };

  useEffect(() => {
    if (showTransliterations) ensureTransliterationsForActivity();
  }, [showTransliterations, activity]);

  // Load language-specific default transliteration setting
  useEffect(() => {
    const loadLanguageSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/language-personalization/${language}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`[ActivityScreen] Loading settings for ${language}:`, data);
          // Use the actual setting value, defaulting to false if not set
          const shouldShowTranslit = data.default_transliterate !== undefined ? data.default_transliterate : false;
          console.log(`[ActivityScreen] Setting showTransliterations to:`, shouldShowTranslit);
          setShowTransliterations(shouldShowTranslit);
        } else {
          console.log(`[ActivityScreen] No settings found for ${language}, keeping default false`);
          // Don't change from initial false state
        }
      } catch (error) {
        console.error('Error loading language settings:', error);
        // Don't change from initial false state
      }
    };
    loadLanguageSettings();
  }, [language]);

  // For Urdu activities, prefetch native-script (Arabic/Nastaliq) renderings once activity is loaded
  useEffect(() => {
    if (activity && language === 'urdu') {
      ensureNativeScriptForActivity();
    }
  }, [activity, language]);

  const handleWordClick = (word) => {
    if (word) {
      performDictionarySearch(word);
    }
  };

  // Perform dictionary search immediately (used by click handlers)
  const performDictionarySearch = async (rawWord) => {
    if (!rawWord || typeof rawWord !== 'string') return;
    const candidate = rawWord.trim();
    if (!candidate) return;

    // Open dictionary UI
    setShowDictionary(true);

    // Set the visible search term immediately for UI
    setDictionarySearch(candidate);

    // Also perform the fetch immediately to avoid relying solely on useEffect timing
    try {
      setDictionaryLoading(true);
      const params = new URLSearchParams();
      if (candidate) params.append('search', candidate);
      if (dictionaryMasteryFilter.length > 0) {
        dictionaryMasteryFilter.forEach(filter => {
          if (filter) params.append('mastery_filter', filter);
        });
      }
      if (dictionaryWordClassFilter.length > 0) {
        dictionaryWordClassFilter.forEach(filter => {
          if (filter) params.append('word_class_filter', filter);
        });
      }
      if (dictionaryLevelFilter.length > 0) {
        dictionaryLevelFilter.forEach(filter => {
          if (filter) params.append('level_filter', filter);
        });
      }
      params.append('limit', '100');

      const response = await fetch(`${API_BASE_URL}/api/vocabulary/${language}?${params.toString()}`);
      const data = await response.json();
      setDictionaryResults(data.words || []);
    } catch (err) {
      console.error('Error performing dictionary search:', err);
      setDictionaryResults([]);
    } finally {
      setDictionaryLoading(false);
    }
  };

  // Audio player functions for recording playback
  const playRecordingAudio = async (audioUri) => {
    try {
      if (Platform.OS === 'web') {
        const BrowserAudio = typeof window !== 'undefined' && window.Audio ? window.Audio : null;
        if (!BrowserAudio) {
          Alert.alert('ದೋಷ', 'ಆಡಿಯೋ ಪ್ಲೇಬ್ಯಾಕ್ ಬೆಂಬಲಿಸಲಾಗಿಲ್ಲ');
          return;
        }
        
        // Reuse existing audio element to resume instead of restarting
        let audioElement = recordingAudioRef.current;
        if (!audioElement) {
          audioElement = new BrowserAudio(audioUri);
          audioElement.volume = 1.0;
          
          audioElement.addEventListener('loadedmetadata', () => {
            setRecordingAudioDuration(audioElement.duration);
          });
          
          audioElement.addEventListener('timeupdate', () => {
            setRecordingAudioPosition(audioElement.currentTime);
          });
          
          audioElement.addEventListener('ended', () => {
            setRecordingAudioPlaying(false);
            setRecordingAudioPosition(0);
          });
          
          audioElement.addEventListener('play', () => {
            setRecordingAudioPlaying(true);
          });
          
          audioElement.addEventListener('pause', () => {
            setRecordingAudioPlaying(false);
          });
          
          recordingAudioRef.current = audioElement;
        }
        
        await audioElement.play();
      } else {
        // Reuse existing sound to resume instead of recreating
        let sound = recordingAudioRef.current;
        if (!sound) {
          const created = await Audio.Sound.createAsync({ uri: audioUri });
          sound = created.sound;
          recordingAudioRef.current = sound;
          
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              setRecordingAudioPosition(status.positionMillis / 1000);
              setRecordingAudioDuration(status.durationMillis / 1000);
              setRecordingAudioPlaying(status.isPlaying);
              
              if (status.didJustFinish) {
                setRecordingAudioPlaying(false);
                setRecordingAudioPosition(0);
              }
            }
          });
        }
        
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error playing recording audio:', error);
      Alert.alert('ದೋಷ', 'ಆಡಿಯೋವನ್ನು ಪ್ಲೇ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ');
    }
  };

  const pauseRecordingAudio = () => {
    if (Platform.OS === 'web') {
      const audioElement = recordingAudioRef.current;
      if (audioElement) {
        audioElement.pause();
      }
    } else {
      const sound = recordingAudioRef.current;
      if (sound) {
        sound.pauseAsync();
      }
    }
  };

  const replayRecordingAudio = () => {
    if (Platform.OS === 'web') {
      const audioElement = recordingAudioRef.current;
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play();
      }
    } else {
      const sound = recordingAudioRef.current;
      if (sound) {
        sound.setPositionAsync(0);
        sound.playAsync();
      }
    }
  };

  const seekRecordingAudio = (position) => {
    if (Platform.OS === 'web') {
      const audioElement = recordingAudioRef.current;
      if (audioElement) {
        audioElement.currentTime = position;
      }
    } else {
      const sound = recordingAudioRef.current;
      if (sound) {
        sound.setPositionAsync(position * 1000);
      }
    }
  };

  // Audio player functions for submission playback
  const playSubmissionAudio = async (audioUri, submissionIndex) => {
    try {
      if (Platform.OS === 'web') {
        const BrowserAudio = typeof window !== 'undefined' && window.Audio ? window.Audio : null;
        if (!BrowserAudio) {
          Alert.alert('ದೋಷ', 'ಆಡಿಯೋ ಪ್ಲೇಬ್ಯಾಕ್ ಬೆಂಬಲಿಸಲಾಗಿಲ್ಲ');
          return;
        }
        
        const audioElement = new BrowserAudio(audioUri);
        audioElement.volume = 1.0;
        
        audioElement.addEventListener('loadedmetadata', () => {
          setSubmissionAudioStates(prev => ({
            ...prev,
            [submissionIndex]: {
              ...prev[submissionIndex],
              duration: audioElement.duration,
            }
          }));
        });
        
        audioElement.addEventListener('timeupdate', () => {
          setSubmissionAudioStates(prev => ({
            ...prev,
            [submissionIndex]: {
              ...prev[submissionIndex],
              position: audioElement.currentTime,
            }
          }));
        });
        
        audioElement.addEventListener('ended', () => {
          setSubmissionAudioStates(prev => ({
            ...prev,
            [submissionIndex]: {
              ...prev[submissionIndex],
              playing: false,
              position: 0,
            }
          }));
        });
        
        audioElement.addEventListener('play', () => {
          setSubmissionAudioStates(prev => ({
            ...prev,
            [submissionIndex]: {
              ...prev[submissionIndex],
              playing: true,
            }
          }));
        });
        
        audioElement.addEventListener('pause', () => {
          setSubmissionAudioStates(prev => ({
            ...prev,
            [submissionIndex]: {
              ...prev[submissionIndex],
              playing: false,
            }
          }));
        });
        
        submissionAudioRefs.current[submissionIndex] = audioElement;
        await audioElement.play();
      } else {
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
        submissionAudioRefs.current[submissionIndex] = sound;
        
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setSubmissionAudioStates(prev => ({
              ...prev,
              [submissionIndex]: {
                position: status.positionMillis / 1000,
                duration: status.durationMillis / 1000,
                playing: status.isPlaying,
              }
            }));
            
            if (status.didJustFinish) {
              setSubmissionAudioStates(prev => ({
                ...prev,
                [submissionIndex]: {
                  ...prev[submissionIndex],
                  playing: false,
                  position: 0,
                }
              }));
            }
          }
        });
        
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error playing submission audio:', error);
      Alert.alert('ದೋಷ', 'ಆಡಿಯೋವನ್ನು ಪ್ಲೇ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ');
    }
  };

  const pauseSubmissionAudio = (submissionIndex) => {
    if (Platform.OS === 'web') {
      const audioElement = submissionAudioRefs.current[submissionIndex];
      if (audioElement) {
        audioElement.pause();
      }
    } else {
      const sound = submissionAudioRefs.current[submissionIndex];
      if (sound) {
        sound.pauseAsync();
      }
    }
  };

  const replaySubmissionAudio = (submissionIndex) => {
    if (Platform.OS === 'web') {
      const audioElement = submissionAudioRefs.current[submissionIndex];
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play();
      }
    } else {
      const sound = submissionAudioRefs.current[submissionIndex];
      if (sound) {
        sound.setPositionAsync(0);
        sound.playAsync();
      }
    }
  };

  const seekSubmissionAudio = (submissionIndex, position) => {
    if (Platform.OS === 'web') {
      const audioElement = submissionAudioRefs.current[submissionIndex];
      if (audioElement) {
        audioElement.currentTime = position;
      }
    } else {
      const sound = submissionAudioRefs.current[submissionIndex];
      if (sound) {
        sound.setPositionAsync(position * 1000);
      }
    }
  };

  // Audio recording functions for speaking activity
  const startRecording = async () => {
    try {
      // Request permissions
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (permissionResponse.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setRecordingStatus('recording');
      recordingRef.current = newRecording;
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const convertAudioToText = async (audioUri, audioFormat = null) => {
    try {
      console.log('Converting audio to text...', { audioUri, audioFormat });
      
      // Read audio as base64
      let audioBase64;
      if (Platform.OS === 'web') {
        // For web, fetch the blob URL and convert to base64
        const response = await fetch(audioUri);
        const blob = await response.blob();
        audioBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            // Remove data URL prefix (e.g., "data:audio/wav;base64,")
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        // Detect format from blob type or URI
        if (!audioFormat) {
          if (blob.type.includes('webm')) {
            audioFormat = 'webm';
          } else if (blob.type.includes('wav')) {
            audioFormat = 'wav';
          } else if (blob.type.includes('flac')) {
            audioFormat = 'flac';
          }
        }
      } else {
        // For native platforms, use FileSystem
        audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Try to detect format from file extension
        if (!audioFormat && audioUri) {
          const ext = audioUri.split('.').pop().toLowerCase();
          if (['webm', 'wav', 'flac', 'm4a'].includes(ext)) {
            audioFormat = ext;
          }
        }
      }
      
      // Call speech-to-text API
      const response = await fetch(`${API_BASE_URL}/api/speech-to-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_base64: audioBase64,
          language: language || 'kannada',
          audio_format: audioFormat,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
      }
      
      const data = await response.json();
      return data.transcript || '';
    } catch (error) {
      console.error('Error converting audio to text:', error);
      throw error;
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    try {
      setRecordingStatus('stopped');
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
      recordingRef.current = null;
      
      // Automatically convert audio to text when recording stops
      if (useAudioInput && uri) {
        try {
          setRecordingStatus('transcribing');
          const transcript = await convertAudioToText(uri);
          if (transcript && transcript.trim()) {
            setUserAnswer(transcript);
            setRecordingStatus('stopped');
          } else {
            setRecordingStatus('stopped');
            Alert.alert('Info', 'Audio transcribed but no text was detected. You can still submit the audio for grading.');
          }
        } catch (error) {
          console.error('Error converting audio to text:', error);
          setRecordingStatus('stopped');
          Alert.alert('Error', `Failed to convert audio to text: ${error.message}. You can still submit the audio for grading.`);
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
      setRecordingStatus('idle');
    }
  };


  const loadActivity = async () => {
    setLoading(true);
    setLoadingStatus('Initializing...');
    
    // Helper to rebuild transliterations when loading from history/DB
    const buildTransliterationsFromActivity = async (activityData) => {
      if (!activityData) return;
      try {
        const newTransliterations = {};
        // Core labels
        newTransliterations.transcriptLabel = await transliterateText('ಪಠ್ಯ:');
        newTransliterations.detailedFeedbackLabel = await transliterateText('ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆ:');
        newTransliterations.wordUsageFeedbackLabel = await transliterateText('ಪದಗಳ ಬಳಕೆಯ ಬಗ್ಗೆ ಪ್ರತಿಕ್ರಿಯೆ:');
        newTransliterations.fluencyScoreLabel = await transliterateText('ನಿರರ್ಗಳತೆ:');
        newTransliterations.taskCompletionScoreLabel = await transliterateText('ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ:');
        newTransliterations.audioLabel = await transliterateText('ಆಡಿಯೋ:');
        // Input method + buttons
        newTransliterations.inputMethodLabel = await transliterateText('ಇನ್ಪುಟ್ ವಿಧಾನ:');
        newTransliterations.textButtonLabel = await transliterateText('ಪಠ್ಯ');
        newTransliterations.audioButtonLabel = await transliterateText('ಆಡಿಯೋ');
        // Instructions label + text (if present)
        newTransliterations.instructionsLabel = await transliterateText('ಸೂಚನೆಗಳು');
        if (activityData.instructions && typeof activityData.instructions === 'string') {
          newTransliterations.instructions = await transliterateText(activityData.instructions);
        }
        // Rubric title + evaluation criteria
        newTransliterations.rubricTitle = await transliterateText('ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು');
        if (activityData.evaluation_criteria && typeof activityData.evaluation_criteria === 'string') {
          newTransliterations.evaluation_criteria = await transliterateText(activityData.evaluation_criteria);
        }
        // General guidelines
        const defaultGeneralGuidelines = [
          "ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.",
          "ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.",
          "ಭಾಷಣವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು.",
          "ಕಾರ್ಯಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಬೇಕು ಮತ್ತು ನೀಡಲಾದ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ ಮಾತನಾಡಬೇಕು."
        ];
        const guidelines = activityData._general_guidelines || defaultGeneralGuidelines;
        if (guidelines && Array.isArray(guidelines)) {
          for (let i = 0; i < guidelines.length; i++) {
            const g = guidelines[i];
            if (g && typeof g === 'string') {
              newTransliterations[`general_guideline_${i}`] = await transliterateText(g);
            }
          }
        }
        // Tasks
        if (activityData.tasks && Array.isArray(activityData.tasks)) {
          newTransliterations.tasks_title = await transliterateText('ಕಾರ್ಯಗಳು');
          for (let i = 0; i < activityData.tasks.length; i++) {
            if (activityData.tasks[i]) {
              newTransliterations[`task_${i}`] = await transliterateText(activityData.tasks[i]);
            }
          }
        }
        // Activity name and topic
        if (activityData.activity_name && typeof activityData.activity_name === 'string') {
          newTransliterations.activity_name = await transliterateText(activityData.activity_name);
        }
        if (activityData.topic && typeof activityData.topic === 'string') {
          newTransliterations.topic = await transliterateText(activityData.topic);
        }
        // Required words
        if (activityData.required_words && Array.isArray(activityData.required_words)) {
          for (let i = 0; i < activityData.required_words.length; i++) {
            const word = activityData.required_words[i];
            if (word) {
              newTransliterations[`required_word_${i}`] = await transliterateText(word);
            }
          }
        }
        // Submission labels
        newTransliterations.submissionLabel = await transliterateText('ಸಲ್ಲಿಕೆ');
        newTransliterations.submissionsTitle = await transliterateText('ಸಲ್ಲಿಕೆಗಳು ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆಗಳು');
        // Generate transliteration for each submission title if submissions exist
        if (activityData.submissions && Array.isArray(activityData.submissions)) {
          for (let i = 0; i < activityData.submissions.length; i++) {
            newTransliterations[`submission_${i}_title`] = await transliterateText(`ಸಲ್ಲಿಕೆ ${i + 1}`);
          }
        }
  setTransliterations(prev => ({ ...prev, ...coerceTranslitMapToStrings(newTransliterations) }));
      } catch (err) {
        console.error('Error building transliterations (history/DB):', err);
      }
    };
    setSelectedOptions({});
    setShowResult(false);
    setUserAnswer('');
    try {
      // Check if we're loading from history (activity data passed via route params)
      const savedActivityData = route?.params?.activityData;
      // Use fromHistory from component params (already extracted) or fallback to route params
      const isFromHistory = fromHistory !== undefined ? fromHistory : (route?.params?.fromHistory || false);
      
      console.log('[ActivityScreen] Loading state:', {
        activityType,
        activityId,
        resolvedActivityId,
        isFromHistory,
        hasSavedActivityData: !!savedActivityData,
      });
      
      // Handle conversation activities differently
      if (activityType === 'conversation') {
        if (isFromHistory && savedActivityData) {
          // Load conversation from history
          console.log('Loading conversation from history...');
          setLoadingStatus('Loading conversation...');
          // Normalize text-like fields before setting into state
          const sanitized = { ...savedActivityData };
          if (sanitized.story) sanitized.story = normalizeField('story', sanitized.story);
          if (sanitized.story_name) sanitized.story_name = normalizeField('story_name', sanitized.story_name);
          if (sanitized.passage) sanitized.passage = normalizeField('passage', sanitized.passage);
          if (sanitized.passage_name) sanitized.passage_name = normalizeField('passage_name', sanitized.passage_name);
          if (sanitized.activity_name) sanitized.activity_name = normalizeField('activity_name', sanitized.activity_name);
          if (sanitized.topic) sanitized.topic = normalizeField('topic', sanitized.topic);
          if (sanitized.hint) sanitized.hint = normalizeField('hint', sanitized.hint);
          if (sanitized.questions && Array.isArray(sanitized.questions)) {
            sanitized.questions = sanitized.questions.map(q => ({
              ...q,
              question: normalizeField(`question_${i}`, q.question),
              options: Array.isArray(q.options) ? q.options.map((o, oi) => normalizeField(`option_${i}_${oi}`, o)) : q.options,
            }));
          }
          setActivity(sanitized);
          // Use conversation_id from activity data first, then activityId as fallback
          // conversation_id is what the backend uses to continue conversations
          const convId = savedActivityData.conversation_id || route?.params?.activityId || '';
          setConversationId(String(convId));
          setConversationTopic(savedActivityData._topic || '');
          setConversationTasks(savedActivityData.tasks || []);
          const loadedMessages = savedActivityData.messages || [];
          // Debug: Check for missing audio in messages
          loadedMessages.forEach((msg, idx) => {
            if (msg.ai_response && (!msg._audio_data || !msg._audio_data.audio_base64)) {
              console.warn(`[DEBUG] Message ${idx} missing audio data:`, {
                has_ai_response: !!msg.ai_response,
                has_audio_data: !!msg._audio_data,
                has_audio_base64: !!(msg._audio_data && msg._audio_data.audio_base64),
                message_preview: msg.ai_response.substring(0, 50),
              });
            }
          });
          setConversationMessages(loadedMessages);
          setConversationVoice(savedActivityData._voice_used || null);
          
          // If there are messages, conversation has started
          if (savedActivityData.messages && savedActivityData.messages.length > 0) {
            setConversationStarted(true);
          }
          
          // Load completed tasks
          const completedTasksSet = new Set();
          if (savedActivityData._tasks_completed) {
            savedActivityData._tasks_completed.forEach(idx => completedTasksSet.add(idx));
          }
          setTasksCompleted(completedTasksSet);
          
          // Load ratings if exists
          if (savedActivityData.ratings && Array.isArray(savedActivityData.ratings)) {
            setConversationRatings(savedActivityData.ratings);
            if (savedActivityData.ratings.length > 0) {
              setConversationRating(savedActivityData.ratings[savedActivityData.ratings.length - 1]);
            }
          } else if (savedActivityData.rating) {
            // Legacy: single rating
            setConversationRatings([savedActivityData.rating]);
            setConversationRating(savedActivityData.rating);
          }
          
          // Extract words_used_data
          if (savedActivityData._words_used_data && Array.isArray(savedActivityData._words_used_data)) {
            const words_used_data = savedActivityData._words_used_data.map(w => ({
              id: w.id,
              word: w.english_word || w.word,
              kannada: w.translation || w.kannada,
              transliteration: w.transliteration || '',
              word_class: w.word_class || '',
              level: w.level || '',
              mastery_level: w.mastery_level || 'new',
              verb_transitivity: w.verb_transitivity || '',
            }));
            setWordsUsed(words_used_data);
          }
          
          // Generate transliterations for conversation content
          // Initialize newTransliterations first to avoid undefined errors
          const newTransliterations = {};
          
          // Generate transliterations for existing ratings (after newTransliterations is declared)
          if (savedActivityData.ratings && Array.isArray(savedActivityData.ratings) && savedActivityData.ratings.length > 0) {
            try {
              newTransliterations.ratings_title = await transliterateText('ಸಲ್ಲಿಸಿದ ಮೌಲ್ಯಮಾಪನಗಳು');
              for (let i = 0; i < savedActivityData.ratings.length; i++) {
                const rating = savedActivityData.ratings[i];
                // Transliterate labels
                newTransliterations[`rating_title_${i}`] = await transliterateText('ಸಂಭಾಷಣೆಯ ಮೌಲ್ಯಮಾಪನ');
                newTransliterations[`rating_overall_${i}`] = await transliterateText('ಒಟ್ಟು ಅಂಕ');
                newTransliterations[`rating_vocab_${i}`] = await transliterateText('ಶಬ್ದಕೋಶ');
                newTransliterations[`rating_grammar_${i}`] = await transliterateText('ವ್ಯಾಕರಣ');
                newTransliterations[`rating_fluency_${i}`] = await transliterateText('ನಿರರ್ಗಳತೆ');
                newTransliterations[`rating_task_${i}`] = await transliterateText('ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ');
                newTransliterations[`rating_general_${i}`] = await transliterateText('ಸಾಮಾನ್ಯ ಪ್ರತಿಕ್ರಿಯೆ');
                newTransliterations[`rating_targeted_${i}`] = await transliterateText('ಗುರಿ-ಕೇಂದ್ರಿತ ಪ್ರತಿಕ್ರಿಯೆ');
                newTransliterations[`task_feedback_label_${i}`] = await transliterateText('ಪ್ರತಿಕ್ರಿಯೆ');
                
                // Transliterate feedback
                if (rating.general_feedback) {
                  newTransliterations[`rating_general_feedback_${i}`] = await transliterateText(rating.general_feedback);
                }
                if (rating.targeted_feedback) {
                  newTransliterations[`rating_targeted_feedback_${i}`] = await transliterateText(rating.targeted_feedback);
                }
                if (rating.feedback) {
                  newTransliterations[`rating_feedback_${i}`] = await transliterateText(rating.feedback);
                }
                if (rating.task_assessment) {
                  for (const [taskKey, assessment] of Object.entries(rating.task_assessment)) {
                    if (assessment.feedback) {
                      newTransliterations[`task_assessment_${i}_${taskKey}`] = await transliterateText(assessment.feedback);
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error generating rating transliterations:', error);
            }
          }
          if (savedActivityData.activity_name) {
            newTransliterations.activity_name = await transliterateText(savedActivityData.activity_name);
          }
          if (savedActivityData.introduction) {
            newTransliterations.introduction = await transliterateText(savedActivityData.introduction);
          }
          // Transliterate tasks title
          newTransliterations.tasks_title = await transliterateText('ಕಾರ್ಯಗಳು');
          if (savedActivityData.tasks && Array.isArray(savedActivityData.tasks)) {
            for (let i = 0; i < savedActivityData.tasks.length; i++) {
              newTransliterations[`task_${i}`] = await transliterateText(savedActivityData.tasks[i]);
            }
          }
          // Transliterate speaker profile fields
          if (savedActivityData._speaker_profile) {
            const profile = savedActivityData._speaker_profile;
            if (profile.name) newTransliterations.speaker_name = await transliterateText(profile.name);
            if (profile.gender) newTransliterations.speaker_gender = await transliterateText(profile.gender);
            if (profile.age) newTransliterations.speaker_age = await transliterateText(profile.age);
            if (profile.city) newTransliterations.speaker_city = await transliterateText(profile.city);
            if (profile.state) newTransliterations.speaker_state = await transliterateText(profile.state);
            if (profile.country) newTransliterations.speaker_country = await transliterateText(profile.country);
            if (profile.dialect) newTransliterations.speaker_dialect = await transliterateText(profile.dialect);
            if (profile.background) newTransliterations.speaker_background = await transliterateText(profile.background);
            // Transliterate labels
            newTransliterations.speaker_profile_title = await transliterateText('ಮಾತನಾಡುವವರ ವಿವರ');
            newTransliterations.speaker_name_label = await transliterateText('ಹೆಸರು');
            newTransliterations.speaker_gender_label = await transliterateText('ಲಿಂಗ');
            newTransliterations.speaker_age_label = await transliterateText('ವಯಸ್ಸು');
            newTransliterations.speaker_city_label = await transliterateText('ನಗರ');
            newTransliterations.speaker_state_label = await transliterateText('ರಾಜ್ಯ');
            newTransliterations.speaker_country_label = await transliterateText('ದೇಶ');
            newTransliterations.speaker_dialect_label = await transliterateText('ಉಪಭಾಷೆ');
            newTransliterations.speaker_background_label = await transliterateText('ಹಿನ್ನೆಲೆ');
          }
          // Transliterate messages (use savedActivityData.messages directly since state hasn't updated yet)
          const messagesToTransliterate = savedActivityData.messages || [];
          for (let i = 0; i < messagesToTransliterate.length; i++) {
            const msg = messagesToTransliterate[i];
            if (msg.user_message) {
              newTransliterations[`user_msg_${i}`] = await transliterateText(msg.user_message);
            }
            if (msg.ai_response) {
              newTransliterations[`ai_msg_${i}`] = await transliterateText(msg.ai_response);
            }
          }
          setTransliterations(coerceTranslitMapToStrings(newTransliterations));
          
          setLoading(false);
          return;
        } else {
          // New conversation - automatically create it (topic is randomly selected on backend)
          // Continue to the automatic creation flow below
        }
      }

      // For conversation activities that aren't from history, create automatically
      if (activityType === 'conversation' && !isFromHistory && !savedActivityData) {
        console.log('Creating new conversation activity...');
        setLoadingStatus('Creating conversation activity...');
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/activity/conversation/${language}/create`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            }
          );
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}: ${errorText}`);
          }
          
          const data = await response.json();
          
          if (!data.activity || data.activity._error) {
            throw new Error(data.activity?._error || 'Failed to create conversation activity');
          }
          
          setActivity(sanitizeActivity(data.activity));
          setConversationId(data.conversation_id);
          setConversationTopic(data.activity._topic || '');
          setConversationTasks(data.activity.tasks || []);
          setConversationMessages([]);
          setTasksCompleted(new Set());
          setConversationStarted(false); // Don't auto-start
          setConversationVoice(data.activity._voice_used || null); // Store voice
          
          // Extract words used
          if (data.words_used) {
            setWordsUsed(data.words_used);
          }
          
          // Store API details (append to array)
          if (data.api_details) {
            const apiCall = {
              id: Date.now(),
              timestamp: new Date().toISOString(),
              endpoint: data.api_details.endpoint || `POST /api/activity/conversation/${language}/create`,
              prompt: data.api_details.prompt || 'No prompt available',
              wordsUsed: data.words_used || [],
              responseTime: data.api_details?.response_time || 0,
              rawResponse: data.api_details?.raw_response || '',
              tokenInfo: data.api_details?.token_info || null,
              ttsCost: data.api_details?.tts_cost || null,
              ttsResponseTime: data.api_details?.tts_response_time || null,
              totalCost: data.api_details?.total_cost || null,
              parseError: data.api_details?.parse_error || null,
            };
            setAllApiDetails(prev => [...prev, apiCall]);
          }
          
          // Generate transliterations
          const newTransliterations = {};
          if (data.activity.activity_name) {
            newTransliterations.activity_name = await transliterateText(data.activity.activity_name);
          }
          if (data.activity.introduction) {
            // Extract just the topic/theme from introduction (remove any greeting/question)
            let introText = data.activity.introduction;
            // Remove common greeting patterns
            introText = introText.replace(/^ಹಲೋ[!.]?\s*/i, '');
            introText = introText.replace(/^ಹೇಗಿದ್ದೀರಾ[?]?\s*/i, '');
            introText = introText.replace(/^ನಮಸ್ಕಾರ[!.]?\s*/i, '');
            introText = introText.trim();
            if (introText) {
              newTransliterations.introduction = await transliterateText(introText);
            }
          }
          // Transliterate tasks title
          newTransliterations.tasks_title = await transliterateText('ಕಾರ್ಯಗಳು');
          if (data.activity.tasks && Array.isArray(data.activity.tasks)) {
            for (let i = 0; i < data.activity.tasks.length; i++) {
              newTransliterations[`task_${i}`] = await transliterateText(data.activity.tasks[i]);
            }
          }
          // Transliterate start conversation button
          newTransliterations.start_conversation_button = await transliterateText('ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ');
          newTransliterations.conversation_hint = await transliterateText('ಕನ್ನಡದಲ್ಲಿ ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ');
          // Transliterate speaker profile fields
          if (data.activity._speaker_profile) {
            const profile = data.activity._speaker_profile;
            if (profile.name) newTransliterations.speaker_name = await transliterateText(profile.name);
            if (profile.gender) newTransliterations.speaker_gender = await transliterateText(profile.gender);
            if (profile.age) newTransliterations.speaker_age = await transliterateText(profile.age);
            if (profile.city) newTransliterations.speaker_city = await transliterateText(profile.city);
            if (profile.state) newTransliterations.speaker_state = await transliterateText(profile.state);
            if (profile.country) newTransliterations.speaker_country = await transliterateText(profile.country);
            if (profile.dialect) newTransliterations.speaker_dialect = await transliterateText(profile.dialect);
            if (profile.background) newTransliterations.speaker_background = await transliterateText(profile.background);
            // Transliterate labels
            newTransliterations.speaker_profile_title = await transliterateText('ಮಾತನಾಡುವವರ ವಿವರ');
            newTransliterations.speaker_name_label = await transliterateText('ಹೆಸರು');
            newTransliterations.speaker_gender_label = await transliterateText('ಲಿಂಗ');
            newTransliterations.speaker_age_label = await transliterateText('ವಯಸ್ಸು');
            newTransliterations.speaker_city_label = await transliterateText('ನಗರ');
            newTransliterations.speaker_state_label = await transliterateText('ರಾಜ್ಯ');
            newTransliterations.speaker_country_label = await transliterateText('ದೇಶ');
            newTransliterations.speaker_dialect_label = await transliterateText('ಉಪಭಾಷೆ');
            newTransliterations.speaker_background_label = await transliterateText('ಹಿನ್ನೆಲೆ');
            newTransliterations.topic_label = await transliterateText('ವಿಷಯ');
          }
          setTransliterations(coerceTranslitMapToStrings(newTransliterations));
          
          // Don't auto-play introduction audio - wait for user to start
          
          setLoading(false);
          return;
        } catch (error) {
          console.error('Error creating conversation activity:', error);
          Alert.alert('ದೋಷ', `ಸಂಭಾಷಣೆ ಚಟುವಟಿಕೆಯನ್ನು ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ\n\n${error.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }
      }

      // Check if we're loading from history (activity data passed via route params)
      // If we already have savedActivityData, prefer that to avoid 404s on stale IDs
      if (isFromHistory && activityId && savedActivityData) {
        console.log('[ActivityScreen] Path 1: Loading from route savedActivityData');
        console.log('Loading activity from history (route data) with ID:', activityId);
        setLoadingStatus('Loading from history...');
        setResolvedActivityId(null); // avoid stale DB fetches when using route data

  setActivity(sanitizeActivity(savedActivityData));
        if (savedActivityData.submissions && Array.isArray(savedActivityData.submissions)) {
          setAllSubmissions(savedActivityData.submissions);
        } else {
          setAllSubmissions([]);
        }
        await buildTransliterationsFromActivity(savedActivityData);
        // Ensure task transliterations from saved data
        if (savedActivityData.tasks && Array.isArray(savedActivityData.tasks)) {
          try {
            const tasksTitle = await transliterateText('ಕಾರ್ಯಗಳು');
            const taskTransliterations = {};
            for (let i = 0; i < savedActivityData.tasks.length; i++) {
              if (savedActivityData.tasks[i]) {
                taskTransliterations[`task_${i}`] = await transliterateText(savedActivityData.tasks[i]);
              }
            }
            setTransliterations(prev => ({
              ...prev,
              tasks_title: tasksTitle,
              ...taskTransliterations,
            }));
          } catch (err) {
            console.error('Error transliterating tasks (route data):', err);
          }
        }
        console.log('[ActivityScreen] Path 1 complete, returning');
        return;
      }

      // If activityId is provided (no route data), fetch fresh data from database to ensure we have latest submissions
      if (isFromHistory && resolvedActivityId) {
        console.log('[ActivityScreen] Path 2: Fetching from DB with ID:', resolvedActivityId);
        console.log('Loading activity from history with ID:', resolvedActivityId);
        setLoadingStatus('Loading from history...');
        try {
          const response = await fetch(`${API_BASE_URL}/api/activity/${resolvedActivityId}`);
          console.log('[ActivityScreen] DB fetch response status:', response.status);
          if (!response.ok) {
            if (response.status === 404) {
              console.warn('Activity not found in DB, falling back to route data if available');
              setResolvedActivityId(null); // avoid future fetches with stale id
              if (savedActivityData) {
                // Fall through to the route-data branch below to reuse transliteration setup
                setActivity(sanitizeActivity(savedActivityData));
                if (savedActivityData.submissions && Array.isArray(savedActivityData.submissions)) {
                  setAllSubmissions(savedActivityData.submissions);
                } else {
                  setAllSubmissions([]);
                }
                await buildTransliterationsFromActivity(savedActivityData);
                if (savedActivityData.tasks && Array.isArray(savedActivityData.tasks)) {
                  try {
                    const tasksTitle = await transliterateText('ಕಾರ್ಯಗಳು');
                    const taskTransliterations = {};
                    for (let i = 0; i < savedActivityData.tasks.length; i++) {
                      if (savedActivityData.tasks[i]) {
                        taskTransliterations[`task_${i}`] = await transliterateText(savedActivityData.tasks[i]);
                      }
                    }
                    setTransliterations(prev => ({
                      ...prev,
                      tasks_title: tasksTitle,
                      ...taskTransliterations,
                    }));
                  } catch (err) {
                    console.error('Error transliterating tasks (fallback):', err);
                  }
                }
              } else {
                Alert.alert('ದೋಷ', 'ಈ ಚಟುವಟಿಕೆ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಹೊಸ ಚಟುವಟಿಕೆಯನ್ನು ಪ್ರಯತ್ನಿಸಿ.');
                setLoading(false);
                return;
              }
            } else {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
          } else {
            const activityData = await response.json();
            const freshActivityData = activityData.activity_data || {};
            // If DB fetch succeeded, lock in the resolved id
            setResolvedActivityId(activityId);
            
            console.log('Loaded fresh activity data with', freshActivityData.submissions?.length || 0, 'submissions');
            
            // Use the fresh activity data from database
            setActivity(sanitizeActivity(freshActivityData));
            // Ensure task transliterations when loading from DB
            if (freshActivityData.tasks && Array.isArray(freshActivityData.tasks)) {
              try {
                const tasksTitle = await transliterateText('ಕಾರ್ಯಗಳು');
                const taskTransliterations = {};
                for (let i = 0; i < freshActivityData.tasks.length; i++) {
                  if (freshActivityData.tasks[i]) {
                    taskTransliterations[`task_${i}`] = await transliterateText(freshActivityData.tasks[i]);
                  }
                }
                setTransliterations(prev => ({
                  ...prev,
                  tasks_title: tasksTitle,
                  ...taskTransliterations,
                }));
              } catch (err) {
                console.error('Error transliterating tasks (DB load):', err);
              }
            }
            
            // Load all submissions from fresh data
            if (freshActivityData.submissions && Array.isArray(freshActivityData.submissions)) {
              // New format: submissions array
              // Convert audio_base64 to blob URLs for web platform
              const processedSubmissions = freshActivityData.submissions.map(submission => {
                if (submission.audio_base64 && !submission.audio_uri && Platform.OS === 'web') {
                  try {
                    const audioBlob = new Blob([Uint8Array.from(atob(submission.audio_base64), c => c.charCodeAt(0))], { type: 'audio/wav' });
                    submission.audio_uri = URL.createObjectURL(audioBlob);
                  } catch (e) {
                    console.error('Error creating blob URL from audio_base64:', e);
                  }
                }
                return submission;
              });
              setAllSubmissions(processedSubmissions);
            } else if (activityType === 'writing' && freshActivityData.user_writing && freshActivityData.grading_result) {
              // Legacy format: single writing submission
              setAllSubmissions([{
                user_writing: freshActivityData.user_writing,
                grading_result: freshActivityData.grading_result,
                submitted_at: freshActivityData.submitted_at || new Date().toISOString(),
              }]);
            } else if (activityType === 'speaking' && freshActivityData.transcript && freshActivityData.grading_result) {
              // Legacy format: single speaking submission
              // Convert audio_base64 to blob URL if audio_uri is not available
              let audioUri = freshActivityData.audio_uri;
              if (!audioUri && freshActivityData.audio_base64 && Platform.OS === 'web') {
                try {
                  const audioBlob = new Blob([Uint8Array.from(atob(freshActivityData.audio_base64), c => c.charCodeAt(0))], { type: 'audio/wav' });
                  audioUri = URL.createObjectURL(audioBlob);
                } catch (e) {
                  console.error('Error creating blob URL from audio_base64:', e);
                }
              }
              setAllSubmissions([{
                transcript: freshActivityData.transcript,
                audio_base64: freshActivityData.audio_base64,
                audio_uri: audioUri,
                grading_result: freshActivityData.grading_result,
                submitted_at: freshActivityData.submitted_at || new Date().toISOString(),
              }]);
            } else {
              setAllSubmissions([]);
            }
            return; // Successfully loaded from DB
          }
        } catch (error) {
          console.error('Error loading activity from database:', error);
          // Continue to fallback below
        }
      }

      if (isFromHistory && savedActivityData) {
        console.log('Loading activity from history (no ID, using route params)...');
        setLoadingStatus('Loading from history...');
  // Use the saved activity data directly (sanitized)
  setActivity(sanitizeActivity(savedActivityData));
        
        // Load all submissions from history
        if (savedActivityData.submissions && Array.isArray(savedActivityData.submissions)) {
          // New format: submissions array
          // Convert audio_base64 to blob URLs for web platform
          const processedSubmissions = savedActivityData.submissions.map(submission => {
            if (submission.audio_base64 && !submission.audio_uri && Platform.OS === 'web') {
              try {
                const audioBlob = new Blob([Uint8Array.from(atob(submission.audio_base64), c => c.charCodeAt(0))], { type: 'audio/wav' });
                submission.audio_uri = URL.createObjectURL(audioBlob);
              } catch (e) {
                console.error('Error creating blob URL from audio_base64:', e);
              }
            }
            return submission;
          });
          setAllSubmissions(processedSubmissions);
        } else if (activityType === 'writing' && savedActivityData.user_writing && savedActivityData.grading_result) {
          // Legacy format: single writing submission
          setAllSubmissions([{
            user_writing: savedActivityData.user_writing,
            grading_result: savedActivityData.grading_result,
            submitted_at: savedActivityData.submitted_at || new Date().toISOString(),
          }]);
        } else if (activityType === 'speaking' && savedActivityData.transcript && savedActivityData.grading_result) {
          // Legacy format: single speaking submission
          // Convert audio_base64 to blob URL if audio_uri is not available
          let audioUri = savedActivityData.audio_uri;
          if (!audioUri && savedActivityData.audio_base64 && Platform.OS === 'web') {
            try {
              const audioBlob = new Blob([Uint8Array.from(atob(savedActivityData.audio_base64), c => c.charCodeAt(0))], { type: 'audio/wav' });
              audioUri = URL.createObjectURL(audioBlob);
            } catch (e) {
              console.error('Error creating blob URL from audio_base64:', e);
            }
          }
          setAllSubmissions([{
            transcript: savedActivityData.transcript,
            audio_base64: savedActivityData.audio_base64,
            audio_uri: audioUri,
            grading_result: savedActivityData.grading_result,
            submitted_at: savedActivityData.submitted_at || new Date().toISOString(),
          }]);
        } else {
          setAllSubmissions([]);
        }
        
        // Reset audio playback state for listening activities
        if (activityType === 'listening') {
          setIsFirstPlaythrough(true);
          setUserInteracted(false);
          setAudioPosition({});
          setAudioDuration({});
        }
        
        // Extract words_used from activity if available
        if (savedActivityData._words_used_data && Array.isArray(savedActivityData._words_used_data)) {
          const words_used_data = savedActivityData._words_used_data.map(w => ({
            id: w.id || w.get?.('id'),
            word: w.english_word || w.get?.('english_word'),
            kannada: w.translation || w.get?.('translation', '') || '',
            transliteration: w.transliteration || w.get?.('transliteration', '') || '',
            word_class: w.word_class || w.get?.('word_class', '') || '',
            level: w.level || w.get?.('level', '') || '',
            mastery_level: w.mastery_level || w.get?.('mastery_level', 'new') || 'new',
            verb_transitivity: w.verb_transitivity || w.get?.('verb_transitivity', '') || '',
          }));
          setWordsUsed(words_used_data);
        } else if (savedActivityData._words && Array.isArray(savedActivityData._words)) {
          // Fallback: if _words_used_data not available, try to reconstruct from _words
          // This is a fallback - ideally _words_used_data should be present
          setWordsUsed([]);
        }
        
        // Load API details from saved activity data
        if (savedActivityData._prompt || savedActivityData._token_info || savedActivityData._raw_response) {
          setAllApiDetails([{
            endpoint: `POST /api/activity/${activityType}/${language}`,
            timestamp: new Date().toISOString(),
            prompt: savedActivityData._prompt || 'No prompt available',
            wordsUsed: savedActivityData._words || [],
            responseTime: savedActivityData._response_time || 0,
            rawResponse: savedActivityData._raw_response || '',
            learnedWords: savedActivityData._learned_words || [],
            learningWords: savedActivityData._learning_words || [],
            tokenInfo: savedActivityData._token_info || null,
            parseError: savedActivityData._parse_error || null,
          }]);
        }
        
        // Get transliterations for the saved activity
        const newTransliterations = {};
        if (savedActivityData.story_name) {
          newTransliterations.storyName = await transliterateText(savedActivityData.story_name);
        }
        if (savedActivityData.activity_name) {
          newTransliterations.activity_name = await transliterateText(savedActivityData.activity_name);
        }
        if (savedActivityData.passage_name) {
          newTransliterations.passageName = await transliterateText(savedActivityData.passage_name);
        }
        if (savedActivityData.story) {
          newTransliterations.story = await transliterateText(savedActivityData.story);
        }
        // Transliterate passage paragraphs for listening activities
        if (savedActivityData.passage) {
          const paragraphs = savedActivityData.passage.split('\n\n').filter(p => p.trim());
          for (let i = 0; i < paragraphs.length; i++) {
            if (paragraphs[i].trim()) {
              newTransliterations[`passage_para_${i}`] = await transliterateText(paragraphs[i].trim());
            }
          }
        }
        // Transliterate speaker profile for listening activities when loading from history
        if (savedActivityData._speaker_profile) {
          const profile = savedActivityData._speaker_profile;
          if (profile.name) newTransliterations.speaker_name = await transliterateText(profile.name);
          if (profile.gender) newTransliterations.speaker_gender = await transliterateText(profile.gender);
          if (profile.age) newTransliterations.speaker_age = await transliterateText(profile.age);
          if (profile.city) newTransliterations.speaker_city = await transliterateText(profile.city);
          if (profile.country) newTransliterations.speaker_country = await transliterateText(profile.country);
          if (profile.dialect) newTransliterations.speaker_dialect = await transliterateText(profile.dialect);
          if (profile.background) newTransliterations.speaker_background = await transliterateText(profile.background);
          // Transliterate labels
          newTransliterations.speaker_profile_title = await transliterateText('ಮಾತನಾಡುವವರ ವಿವರ');
          newTransliterations.speaker_name_label = await transliterateText('ಹೆಸರು');
          newTransliterations.speaker_gender_label = await transliterateText('ಲಿಂಗ');
          newTransliterations.speaker_age_label = await transliterateText('ವಯಸ್ಸು');
          newTransliterations.speaker_city_label = await transliterateText('ನಗರ');
          newTransliterations.speaker_country_label = await transliterateText('ದೇಶ');
          newTransliterations.speaker_dialect_label = await transliterateText('ಉಪಭಾಷೆ');
          newTransliterations.speaker_background_label = await transliterateText('ಹಿನ್ನೆಲೆ');
        }
        if (savedActivityData.writing_prompt) {
          newTransliterations.writing_prompt = await transliterateText(savedActivityData.writing_prompt);
        }
        // Transliterate topic and instructions for speaking activities
        if (savedActivityData.topic) {
          newTransliterations.topic = await transliterateText(savedActivityData.topic);
        }
        if (savedActivityData.instructions) {
          newTransliterations.instructions = await transliterateText(savedActivityData.instructions);
          newTransliterations.instructionsLabel = await transliterateText('ಸೂಚನೆಗಳು:');
        }
        // Transliterate feedback for all submissions
        if (savedActivityData.submissions && Array.isArray(savedActivityData.submissions)) {
          for (let i = 0; i < savedActivityData.submissions.length; i++) {
            const submission = savedActivityData.submissions[i];
            if (submission.grading_result?.feedback && typeof submission.grading_result.feedback === 'string' && submission.grading_result.feedback.trim()) {
              newTransliterations[`submission_${i}_feedback`] = await transliterateText(submission.grading_result.feedback);
            }
            if (submission.grading_result?.required_words_feedback && typeof submission.grading_result.required_words_feedback === 'object') {
              for (const [word, feedback] of Object.entries(submission.grading_result.required_words_feedback)) {
                if (feedback && typeof feedback === 'string' && feedback.trim()) {
                  newTransliterations[`submission_${i}_word_${word}_feedback`] = await transliterateText(feedback);
                }
              }
            }
          }
        } else if (savedActivityData.grading_result?.feedback && typeof savedActivityData.grading_result.feedback === 'string' && savedActivityData.grading_result.feedback.trim()) {
          // Legacy format
          newTransliterations.grading_feedback = await transliterateText(savedActivityData.grading_result.feedback);
        }
        // Transliterate general guidelines when reopening from history
          if (savedActivityData._general_guidelines && Array.isArray(savedActivityData._general_guidelines)) {
          const ggTranslit = [];
          for (let i = 0; i < savedActivityData._general_guidelines.length; i++) {
            const line = savedActivityData._general_guidelines[i];
            if (line) {
              const translit = await transliterateText(line);
              ggTranslit.push(translit);
              // Also store individual guideline transliterations for rendering
              newTransliterations[`general_guideline_${i}`] = translit;
            }
          }
          // Store joined string to avoid placing array into transliterations state
          newTransliterations.general_guidelines = ggTranslit.join('\n');
        }
  const questionsLabel = getQuestionLabel(language);
  newTransliterations.questionsTitle = await transliterateText(String(questionsLabel));
        newTransliterations.sectionTitle_writing = await transliterateText('ಬರವಣಿಗೆ ಅಭ್ಯಾಸ');
        newTransliterations.sectionTitle_speaking = await transliterateText('ಭಾಷಣ ಅಭ್ಯಾಸ');
        newTransliterations.requiredWordsLabel = await transliterateText('ಈ ಪದಗಳನ್ನು ಬಳಸಬೇಕು:');
        newTransliterations.inputMethodLabel = await transliterateText('ಇನ್ಪುಟ್ ವಿಧಾನ:');
        newTransliterations.textButtonLabel = await transliterateText('ಪಠ್ಯ');
        newTransliterations.audioButtonLabel = await transliterateText('ಆಡಿಯೋ');
        newTransliterations.startRecordingLabel = await transliterateText('ರೆಕಾರ್ಡ್ ಪ್ರಾರಂಭಿಸಿ');
        newTransliterations.recordingInProgressLabel = await transliterateText('ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...');
        newTransliterations.stopRecordingLabel = await transliterateText('ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಿ');
        newTransliterations.recordingCompletedLabel = await transliterateText('ರೆಕಾರ್ಡಿಂಗ್ ಪೂರ್ಣಗೊಂಡಿದೆ');
        newTransliterations.deleteRecordingLabel = await transliterateText('ರೆಕಾರ್ಡಿಂಗ್ ಅಳಿಸಿ');
        newTransliterations.transcribingLabel = await transliterateText('ಪಠ್ಯಕ್ಕೆ ಪರಿವರ್ತಿಸಲಾಗುತ್ತಿದೆ...');
        newTransliterations.playRecordingLabel = await transliterateText('ಪ್ಲೇ ಮಾಡಿ');
        newTransliterations.rubricTitle = await transliterateText('ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು');
        newTransliterations.gradingResultTitle = await transliterateText('ಮೌಲ್ಯಮಾಪನ ಫಲಿತಾಂಶ');
        // Transliterate submission section labels
        newTransliterations.submissionsTitle = await transliterateText('ಸಲ್ಲಿಕೆಗಳು ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆಗಳು');
        newTransliterations.submissionLabel = await transliterateText('ಸಲ್ಲಿಕೆ');
        newTransliterations.yourWritingLabel = await transliterateText('ನಿಮ್ಮ ಬರವಣಿಗೆ:');
        newTransliterations.totalScoreLabel = await transliterateText('ಒಟ್ಟು ಸ್ಕೋರ್:');
        newTransliterations.vocabularyScoreLabel = await transliterateText('ಪದಕೋಶ:');
        newTransliterations.grammarScoreLabel = await transliterateText('ವ್ಯಾಕರಣ:');
        newTransliterations.coherenceScoreLabel = await transliterateText('ಸಂಬಂಧಿತತೆ:');
        newTransliterations.fluencyScoreLabel = await transliterateText('ನಿರರ್ಗಳತೆ:');
        newTransliterations.taskCompletionScoreLabel = await transliterateText('ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ:');
        newTransliterations.detailedFeedbackLabel = await transliterateText('ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆ:');
        newTransliterations.wordUsageFeedbackLabel = await transliterateText('ಪದಗಳ ಬಳಕೆಯ ಬಗ್ಗೆ ಪ್ರತಿಕ್ರಿಯೆ:');
        newTransliterations.transcriptLabel = await transliterateText('ಪಠ್ಯ:');
        newTransliterations.audioLabel = await transliterateText('ಆಡಿಯೋ:');
        // Generate transliteration for each submission title
        if (savedActivityData.submissions && Array.isArray(savedActivityData.submissions)) {
          for (let i = 0; i < savedActivityData.submissions.length; i++) {
            newTransliterations[`submission_${i}_title`] = await transliterateText(`ಸಲ್ಲಿಕೆ ${i + 1}`);
          }
        }
        if (savedActivityData.required_words && Array.isArray(savedActivityData.required_words)) {
          for (let i = 0; i < savedActivityData.required_words.length; i++) {
            const word = savedActivityData.required_words[i];
            if (word) {
              newTransliterations[`required_word_${i}`] = await transliterateText(word);
            }
          }
        }
        if (savedActivityData.questions) {
          for (let i = 0; i < savedActivityData.questions.length; i++) {
            const q = savedActivityData.questions[i];
            if (q.question) {
              newTransliterations[`question_${i}`] = await transliterateText(q.question);
            }
            if (q.options) {
              for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
                const opt = q.options[optIdx];
                if (opt) {
                  newTransliterations[`option_${i}_${optIdx}`] = await transliterateText(opt);
                }
              }
            }
          }
        }
  setTransliterations(coerceTranslitMapToStrings(newTransliterations));
        
        setLoading(false);
        return;
      }

      console.log('[ActivityScreen] Path 3: Creating NEW activity');
      console.log(`Loading ${activityType} activity for ${language}...`);
      
      // Set initial status based on activity type
      if (activityType === 'listening') {
        setLoadingStatus('Generating passage and questions...');
      } else if (activityType === 'reading') {
        setLoadingStatus('Generating story and questions...');
      } else if (activityType === 'writing') {
        setLoadingStatus('Generating writing prompt...');
      } else if (activityType === 'speaking') {
        setLoadingStatus('Generating speaking topic...');
      } else {
        setLoadingStatus('Loading activity...');
      }
      
      // Add timeout to fetch - increased for reading and listening activities which can take longer
      // Listening activities need extra time for TTS generation for multiple paragraphs
      const controller = new AbortController();
      const timeoutDuration = activityType === 'reading' ? 120000 : 
                              activityType === 'listening' ? 180000 : 
                              activityType === 'speaking' ? 60000 : 60000; // 120s for reading, 180s for listening, 60s for others
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
      
      // For listening activities, simulate status updates during loading
      let statusUpdateInterval;
      if (activityType === 'listening') {
        let paragraphNum = 1;
        statusUpdateInterval = setInterval(() => {
          // Update status to show progress through audio generation
          // This is approximate since we don't have real-time updates
          const elapsed = Date.now() - (statusUpdateInterval._startTime || Date.now());
          if (elapsed < 30000) {
            setLoadingStatus('Generating passage and questions...');
          } else if (elapsed < 60000) {
            setLoadingStatus('Generating audio for paragraph 1...');
          } else if (elapsed < 90000) {
            setLoadingStatus('Generating audio for paragraph 2...');
          } else if (elapsed < 120000) {
            setLoadingStatus('Generating audio for paragraph 3...');
          } else if (elapsed < 150000) {
            setLoadingStatus('Generating audio for paragraph 4...');
          } else {
            setLoadingStatus('Finalizing activity...');
          }
        }, 2000); // Update every 2 seconds
        statusUpdateInterval._startTime = Date.now();
      }
      
      let response;
      try {
        response = await fetch(
          `${API_BASE_URL}/api/activity/${activityType}/${language}`,
          { 
            method: 'POST',
            signal: controller.signal
          }
        );
        clearTimeout(timeoutId);
        if (statusUpdateInterval) {
          clearInterval(statusUpdateInterval);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (statusUpdateInterval) {
          clearInterval(statusUpdateInterval);
        }
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout: The server took too long to respond. Please try again.');
        }
        throw new Error(`Network error: ${fetchError.message}`);
      }
      
      // Update status when response is received
      if (activityType === 'listening') {
        setLoadingStatus('Processing audio data...');
      } else {
        setLoadingStatus('Processing response...');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Invalid response from server. Please try again.');
      }

      if (!data || !data.activity) {
        console.error('No activity data in response:', data);
        throw new Error('Server returned empty activity. Please try again.');
      }

      console.log('Activity loaded successfully');
      setLoadingStatus('Finalizing...');
  setActivity(sanitizeActivity(data.activity));
      setWordsUsed(data.words_used || []);

      // Store API details for modal (but don't show by default)
      if (data.api_details || data.activity?._prompt) {
        const apiCall = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          endpoint: data.api_details?.endpoint || `POST /api/activity/${activityType}/${language}`,
          prompt: data.api_details?.prompt || data.activity?._prompt || '',
          wordsUsed: data.api_details?.words || data.words_used?.map(w => w.word || w) || [],
          responseTime: data.api_details?.response_time || 0,
          rawResponse: data.api_details?.raw_response || '',
          learnedWords: data.api_details?.learned_words || [],
          learningWords: data.api_details?.learning_words || [],
          tokenInfo: data.api_details?.token_info || null,
          parseError: data.api_details?.parse_error || null,
          // TTS/Audio generation details for listening activities
          ttsCost: data.api_details?.tts_cost || null,
          ttsResponseTime: data.api_details?.tts_response_time || null,
          totalCost: data.api_details?.total_cost || null,
          voiceUsed: data.api_details?.voice_used || null,
          ttsErrors: data.api_details?.tts_errors || null,
          debugSteps: data.api_details?.debug_steps || null,
        };
        setAllApiDetails([apiCall]);
        // Don't show modal automatically - user must click debug button
      }

      // Get transliterations for all Kannada text (with error handling)
      const newTransliterations = {};
      if (data.activity) {
        try {
          // Story name (reading activity)
          if (data.activity.story_name) {
            newTransliterations.storyName = await transliterateText(data.activity.story_name);
          }
          // Passage name (listening activity)
          if (data.activity.passage_name) {
            newTransliterations.passageName = await transliterateText(data.activity.passage_name);
          }
          // Topic and instructions (speaking activity)
          if (data.activity.topic) {
            newTransliterations.topic = await transliterateText(data.activity.topic);
            newTransliterations.topicLabel = await transliterateText('ವಿಷಯ:');
            newTransliterations.inputMethodLabel = await transliterateText('ಇನ್ಪುಟ್ ವಿಧಾನ:');
            newTransliterations.textButtonLabel = await transliterateText('ಪಠ್ಯ');
            newTransliterations.audioButtonLabel = await transliterateText('ಆಡಿಯೋ');
            newTransliterations.startRecordingLabel = await transliterateText('ರೆಕಾರ್ಡ್ ಪ್ರಾರಂಭಿಸಿ');
            newTransliterations.recordingInProgressLabel = await transliterateText('ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...');
            newTransliterations.stopRecordingLabel = await transliterateText('ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಿ');
            newTransliterations.recordingCompletedLabel = await transliterateText('ರೆಕಾರ್ಡಿಂಗ್ ಪೂರ್ಣಗೊಂಡಿದೆ');
            newTransliterations.deleteRecordingLabel = await transliterateText('ರೆಕಾರ್ಡಿಂಗ್ ಅಳಿಸಿ');
            newTransliterations.transcribingLabel = await transliterateText('ಪಠ್ಯಕ್ಕೆ ಪರಿವರ್ತಿಸಲಾಗುತ್ತಿದೆ...');
            newTransliterations.playRecordingLabel = await transliterateText('ಪ್ಲೇ ಮಾಡಿ');
          }
          if (data.activity.instructions) {
            newTransliterations.instructions = await transliterateText(data.activity.instructions);
            newTransliterations.instructionsLabel = await transliterateText('ಸೂಚನೆಗಳು:');
          }
          // Speaking activity tasks transliteration
          if (data.activity.tasks && Array.isArray(data.activity.tasks)) {
            newTransliterations.tasks_title = await transliterateText('ಕಾರ್ಯಗಳು');
            for (let i = 0; i < data.activity.tasks.length; i++) {
              if (data.activity.tasks[i]) {
                newTransliterations[`task_${i}`] = await transliterateText(data.activity.tasks[i]);
              }
            }
          }
          if (data.activity.activity_name && activityType === 'speaking') {
            newTransliterations.yourSpeechLabel = await transliterateText('ನಿಮ್ಮ ಭಾಷಣ:');
            newTransliterations.speechPlaceholder = await transliterateText('ನಿಮ್ಮ ಭಾಷಣವನ್ನು ಇಲ್ಲಿ ಬರೆಯಿರಿ...');
          }
          // Story text
          if (data.activity.story) {
            newTransliterations.story = await transliterateText(data.activity.story);
          }
          // Passage paragraphs (listening activity)
          if (data.activity.passage) {
            const paragraphs = data.activity.passage.split('\n\n').filter(p => p.trim());
            for (let i = 0; i < paragraphs.length; i++) {
              if (paragraphs[i].trim()) {
                newTransliterations[`passage_para_${i}`] = await transliterateText(paragraphs[i].trim());
              }
            }
          }
          
          // Transliterate speaker profile for listening activity
          if (data.activity._speaker_profile) {
            const profile = data.activity._speaker_profile;
            if (profile.name) newTransliterations.speaker_name = await transliterateText(profile.name);
            if (profile.gender) newTransliterations.speaker_gender = await transliterateText(profile.gender);
            if (profile.age) newTransliterations.speaker_age = await transliterateText(profile.age);
            if (profile.city) newTransliterations.speaker_city = await transliterateText(profile.city);
            if (profile.state) newTransliterations.speaker_state = await transliterateText(profile.state);
            if (profile.country) newTransliterations.speaker_country = await transliterateText(profile.country);
            if (profile.dialect) newTransliterations.speaker_dialect = await transliterateText(profile.dialect);
            if (profile.background) newTransliterations.speaker_background = await transliterateText(profile.background);
            // Transliterate labels
            newTransliterations.speaker_profile_title = await transliterateText('ಮಾತನಾಡುವವರ ವಿವರ');
            newTransliterations.speaker_name_label = await transliterateText('ಹೆಸರು');
            newTransliterations.speaker_gender_label = await transliterateText('ಲಿಂಗ');
            newTransliterations.speaker_age_label = await transliterateText('ವಯಸ್ಸು');
            newTransliterations.speaker_city_label = await transliterateText('ನಗರ');
            newTransliterations.speaker_state_label = await transliterateText('ರಾಜ್ಯ');
            newTransliterations.speaker_country_label = await transliterateText('ದೇಶ');
            newTransliterations.speaker_dialect_label = await transliterateText('ಉಪಭಾಷೆ');
            newTransliterations.speaker_background_label = await transliterateText('ಹಿನ್ನೆಲೆ');
          }
          
          // Reset audio playback state for new listening activities
          if (activityType === 'listening') {
            setIsFirstPlaythrough(true);
            setUserInteracted(false);
            setAudioPosition({});
            setAudioDuration({});
          }
          // Section titles
          const questionsLabel = getQuestionLabel(language);
          newTransliterations.questionsTitle = await transliterateText(String(questionsLabel));
          // Score display transliterations
          newTransliterations.score_title = await transliterateText('ನಿಮ್ಮ ಸ್ಕೋರ್');
          // Listening text
          if (data.activity.kannada_text) {
            newTransliterations.kannada_text = await transliterateText(data.activity.kannada_text);
          }
          if (data.activity.hint) {
            newTransliterations.hint = await transliterateText(data.activity.hint);
          }
          // Writing prompt
          if (data.activity.prompt) {
            newTransliterations.prompt = await transliterateText(data.activity.prompt);
          }
          if (data.activity.writing_prompt) {
            newTransliterations.writing_prompt = await transliterateText(data.activity.writing_prompt);
          }
          if (data.activity.activity_name) {
            newTransliterations.activity_name = await transliterateText(data.activity.activity_name);
          }
          // Transliterate topic for speaking activities
          if (data.activity.topic && typeof data.activity.topic === 'string') {
            newTransliterations.topic = await transliterateText(data.activity.topic);
          }
          if (data.activity.evaluation_criteria) {
            newTransliterations.evaluation_criteria = await transliterateText(data.activity.evaluation_criteria);
          }
          // Transliterate general guidelines (use default if not provided)
          const defaultGeneralGuidelines = [
            "ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.",
            "ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.",
            "ಲೇಖನವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು."
          ];
          const generalGuidelinesToUse = data.activity._general_guidelines || defaultGeneralGuidelines;
          for (let i = 0; i < generalGuidelinesToUse.length; i++) {
            const line = generalGuidelinesToUse[i];
            if (line) {
              newTransliterations[`general_guideline_${i}`] = await transliterateText(line);
            }
          }
          // Transliterate general guidelines (array)
          if (data.activity._general_guidelines && Array.isArray(data.activity._general_guidelines)) {
            const ggTranslit = [];
            for (let i = 0; i < data.activity._general_guidelines.length; i++) {
              const line = data.activity._general_guidelines[i];
              if (line) {
                ggTranslit.push(await transliterateText(line));
              }
            }
            newTransliterations.general_guidelines = ggTranslit.join('\n');
          }
          // Transliterate section titles
          newTransliterations.sectionTitle_writing = await transliterateText('ಬರವಣಿಗೆ ಅಭ್ಯಾಸ');
          newTransliterations.sectionTitle_speaking = await transliterateText('ಭಾಷಣ ಅಭ್ಯಾಸ');
          newTransliterations.requiredWordsLabel = await transliterateText('ಈ ಪದಗಳನ್ನು ಬಳಸಬೇಕು:');
          newTransliterations.rubricTitle = await transliterateText('ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು');
          newTransliterations.gradingResultTitle = await transliterateText('ಮೌಲ್ಯಮಾಪನ ಫಲಿತಾಂಶ');
          // Transliterate submission section labels
          newTransliterations.submissionsTitle = await transliterateText('ಸಲ್ಲಿಕೆಗಳು ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆಗಳು');
          newTransliterations.submissionLabel = await transliterateText('ಸಲ್ಲಿಕೆ');
          newTransliterations.yourWritingLabel = await transliterateText('ನಿಮ್ಮ ಬರವಣಿಗೆ:');
          newTransliterations.totalScoreLabel = await transliterateText('ಒಟ್ಟು ಸ್ಕೋರ್:');
          newTransliterations.vocabularyScoreLabel = await transliterateText('ಪದಕೋಶ:');
          newTransliterations.grammarScoreLabel = await transliterateText('ವ್ಯಾಕರಣ:');
          newTransliterations.coherenceScoreLabel = await transliterateText('ಸಂಬಂಧಿತತೆ:');
          newTransliterations.fluencyScoreLabel = await transliterateText('ನಿರರ್ಗಳತೆ:');
          newTransliterations.taskCompletionScoreLabel = await transliterateText('ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ:');
          newTransliterations.detailedFeedbackLabel = await transliterateText('ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆ:');
          newTransliterations.wordUsageFeedbackLabel = await transliterateText('ಪದಗಳ ಬಳಕೆಯ ಬಗ್ಗೆ ಪ್ರತಿಕ್ರಿಯೆ:');
          newTransliterations.transcriptLabel = await transliterateText('ಪಠ್ಯ:');
          newTransliterations.audioLabel = await transliterateText('ಆಡಿಯೋ:');
          // Transliterate required words
          if (data.activity.required_words && Array.isArray(data.activity.required_words)) {
            for (let i = 0; i < data.activity.required_words.length; i++) {
              const word = data.activity.required_words[i];
              if (word) {
                newTransliterations[`required_word_${i}`] = await transliterateText(word);
              }
            }
          }
          if (data.activity.example) {
            newTransliterations.example = await transliterateText(data.activity.example);
          }
          // Questions and options
          if (data.activity.questions && Array.isArray(data.activity.questions)) {
            for (let i = 0; i < data.activity.questions.length; i++) {
              const q = data.activity.questions[i];
              if (q.question) {
                newTransliterations[`question_${i}`] = await transliterateText(q.question);
              }
              if (q.options && Array.isArray(q.options)) {
                for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
                  const opt = q.options[optIdx];
                  if (opt) {
                    newTransliterations[`option_${i}_${optIdx}`] = await transliterateText(opt);
                  }
                }
              }
            }
          }
          // Conversation response
          if (data.activity.response_kannada) {
            newTransliterations.response_kannada = await transliterateText(data.activity.response_kannada);
          }
        } catch (transError) {
          console.error('Error getting transliterations:', transError);
          // Continue even if transliterations fail
        }
      }
  setTransliterations(coerceTranslitMapToStrings(newTransliterations));
    } catch (error) {
      console.error('Error loading activity:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      Alert.alert(
        'ದೋಷ', 
        `ಚಟುವಟಿಕೆಯನ್ನು ಲೋಡ್ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ\n\n${errorMessage}\n\nPlease check:\n- Backend server is running\n- Network connection\n- Try again`,
        [
          { text: 'OK', onPress: () => navigation.goBack() },
          { text: 'Retry', onPress: () => loadActivity() }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  // Removed createConversationActivity function - conversation activities are now created automatically in loadActivity

  const playConversationAudio = async (audioData, messageIndex) => {
    try {
      if (!audioData || !audioData.audio_base64 || audioData.format === 'text_only') {
        return;
      }
      
      const audioFormat = audioData.format || 'wav';
      const mimeType = audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg';
      const dataUri = `data:${mimeType};base64,${audioData.audio_base64}`;
      
      if (Platform.OS === 'web') {
        const BrowserAudio = typeof window !== 'undefined' && window.Audio ? window.Audio : null;
        if (!BrowserAudio) return;
        
        const audioElement = new BrowserAudio(dataUri);
        audioElement.volume = 1.0;
        await audioElement.play();
        conversationAudioRefs.current[messageIndex] = audioElement;
      } else {
        const { sound } = await Audio.Sound.createAsync(
          { uri: dataUri },
          { shouldPlay: true, volume: 1.0 }
        );
        conversationAudioRefs.current[messageIndex] = sound;
      }
    } catch (error) {
      console.error('Error playing conversation audio:', error);
    }
  };

  const sendConversationMessage = async () => {
    if (!userAnswer.trim()) {
      Alert.alert('ದಯವಿಟ್ಟು', 'ದಯವಿಟ್ಟು ಸಂದೇಶವನ್ನು ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ');
      return;
    }

    const userMessage = userAnswer.trim();
    setUserAnswer(''); // Clear input immediately
    
    // Generate transliteration for user message immediately if toggle is on
    if (showTransliterations) {
      const userTranslit = await transliterateText(userMessage);
      const msgIndex = conversationMessages.length;
      setTransliterations(prev => ({
        ...prev,
        [`user_msg_${msgIndex}`]: userTranslit
      }));
    }
    
    // Show user message immediately with loading state for AI response
    const tempMessage = {
      user_message: userMessage,
      ai_response: null, // Will be filled when response arrives
      _loading: true,
      timestamp: new Date().toISOString(),
    };
    const updatedMessages = [...conversationMessages, tempMessage];
    setConversationMessages(updatedMessages);
    setMessageLoading(true);
    setLoadingStage('generating_text');

    try {
      const requestBody = {
        message: userMessage,
      };
      // Only include conversation_id and voice if they have valid values (not null, not undefined, not empty string)
      if (conversationId !== null && conversationId !== undefined && conversationId !== '') {
        requestBody.conversation_id = String(conversationId);
      }
      if (conversationVoice !== null && conversationVoice !== undefined && conversationVoice !== '') {
        requestBody.voice = String(conversationVoice);
      }
      
      const response = await fetch(
        `${API_BASE_URL}/api/activity/conversation/${language}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`);
      }
      
      setLoadingStage('generating_audio');
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response text:', responseText);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
      }
      
      // Check if data is null or missing required fields
      if (!data) {
        console.error('Response data is null or undefined');
        throw new Error('Empty response from server');
      }
      
      if (!data.response && !data._error) {
        console.error('Response missing both response and _error fields:', data);
        throw new Error('Invalid response format from server');
      }
      
      // Update conversation state with AI response
      const finalMessage = {
        user_message: userMessage,
        ai_response: data.response || data._error || '',
        _audio_data: data._audio_data || null,
        _voice_used: data._voice_used || null,
        _speaker_profile: data._speaker_profile || null,
        timestamp: tempMessage.timestamp,
      };
      
      // Replace the temporary loading message with the final one
      // Use updatedMessages (which includes all previous messages + temp loading message) 
      const finalMessages = updatedMessages.map((m, idx) => 
        (idx === updatedMessages.length - 1 && m._loading) ? finalMessage : m
      );
      setConversationMessages(finalMessages);
      setLoadingStage('');
      setMessageLoading(false);
      
      // Update words used (merge with existing) - use functional update to ensure we have latest state
      if (data.words_used) {
        setWordsUsed(prev => {
          const existingIds = new Set((prev || []).map(w => w.id));
          const newWords = data.words_used.filter(w => !existingIds.has(w.id));
          return [...(prev || []), ...newWords];
        });
      }
      
      // Store API details (append to array)
      if (data.api_details) {
        const apiCall = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          endpoint: data.api_details.endpoint || `POST /api/activity/conversation/${language}`,
          prompt: data.api_details.prompt || data.api_details._prompt || 'No prompt available',
          wordsUsed: wordsUsed.map(w => w.word || w),
          responseTime: data.api_details?.response_time || 0,
          rawResponse: data.api_details?.raw_response || data.response || '',
          tokenInfo: data.api_details?.token_info || null,
          voiceUsed: data._voice_used,
          ttsCost: data._tts_cost || data.api_details?.tts_cost || null,
          ttsResponseTime: data._tts_response_time || data.api_details?.tts_response_time || null,
          ttsError: data.api_details?.tts_error || null,  // Store TTS error if any
          totalCost: data.api_details?.total_cost || null,
          parseError: data.api_details?.parse_error || null,
          speakerProfileContext: data.api_details?._speaker_profile_context || null,
          selectedRegion: data.api_details?._selected_region || null,
          formalityChoice: data.api_details?._formality_choice || null,
          topic: data.api_details?._topic || null,
        };
        setAllApiDetails(prev => [...prev, apiCall]);
      }
      
      // Update conversation ID if returned
      const currentConvId = data.conversation_id || conversationId;
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
      
      // Update activity with new message (preserve all existing messages)
      // Sanitize messages and speaker profile to ensure display fields are strings
      const sanitizedMessages = Array.isArray(finalMessages) ? finalMessages.map((m, mi) => ({
        ...m,
        user_message: normalizeField(`messages_${mi}_user_message`, m.user_message),
        ai_response: normalizeField(`messages_${mi}_ai_response`, m.ai_response),
      })) : finalMessages;
      if (data._speaker_profile) {
        const sanitizedProfile = {
          ...data._speaker_profile,
          name: normalizeField('speaker_name', data._speaker_profile.name),
          gender: normalizeField('speaker_gender', data._speaker_profile.gender),
          age: normalizeField('speaker_age', data._speaker_profile.age),
          city: normalizeField('speaker_city', data._speaker_profile.city),
          state: normalizeField('speaker_state', data._speaker_profile.state),
          country: normalizeField('speaker_country', data._speaker_profile.country),
          dialect: normalizeField('speaker_dialect', data._speaker_profile.dialect),
          background: normalizeField('speaker_background', data._speaker_profile.background),
        };
        setActivity(prev => ({
          ...prev,
          _speaker_profile: sanitizedProfile,
          _voice_used: data._voice_used,
          messages: sanitizedMessages,
        }));
      } else {
        setActivity(prev => ({
          ...prev,
          messages: sanitizedMessages,
        }));
      }
      
      // Save conversation history to backend (backend already saves it, but ensure it's updated)
      // The backend saves automatically when we send a message, so this is just for safety

      // Get transliterations for AI response (user message transliteration already generated above)
      // Calculate msgIndex before the conditional block so it's available for audio playback
      const msgIndex = finalMessages.length - 1;
      
      // Only generate if showTransliterations toggle is on
      if (showTransliterations) {
        const newTranslit = {};
        try {
          // User message transliteration already generated above when message was sent
          // Only generate AI response transliteration if we have a response
          if (data.response) {
            newTranslit[`ai_msg_${msgIndex}`] = await transliterateText(data.response);
            setTransliterations(prev => ({ ...prev, ...newTranslit }));
          }
        } catch (translitError) {
          console.error('Error generating transliterations for AI response:', translitError);
          // Continue even if transliteration fails
        }
      }
      
      // Play AI response audio (only if audio data exists)
      if (data && data._audio_data && data._audio_data.audio_base64) {
        try {
          await playConversationAudio(data._audio_data, `ai_${msgIndex}`);
        } catch (audioError) {
          console.error('Error playing conversation audio:', audioError);
          // Don't throw - audio playback failure shouldn't break the conversation
        }
      } else if (data && data.response) {
        console.warn(`[DEBUG] Message ${msgIndex} has response but no audio data. TTS error: ${data.api_details?.tts_error || 'Unknown'}`);
      }
      
      // Check task completion (simple check - can be enhanced with AI analysis)
      checkTaskCompletion(userMessage, (data && data.response) || '');
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('ದೋಷ', 'ಸಂದೇಶವನ್ನು ಕಳುಹಿಸಲು ವಿಫಲವಾಗಿದೆ');
      // Remove the temporary loading message on error
      setConversationMessages(prev => prev.filter(m => !m._loading));
      setMessageLoading(false);
      setLoadingStage('');
    }
  };

  const checkTaskCompletion = (userMessage, aiResponse) => {
    // Simple keyword-based task completion check
    // Can be enhanced with AI analysis
    conversationTasks.forEach((task, index) => {
      if (!tasksCompleted.has(index)) {
        // Check if task-related keywords are present in conversation
        const taskLower = task.toLowerCase();
        const combinedText = (userMessage + ' ' + aiResponse).toLowerCase();
        // Simple heuristic: if task mentions something and user/ai discuss it
        // This is a simplified check - in production, you might want AI-based analysis
        const taskWords = taskLower.split(/\s+/).filter(w => w.length > 3);
        const mentionedWords = taskWords.filter(word => combinedText.includes(word));
        if (mentionedWords.length >= Math.min(2, taskWords.length / 2)) {
          setTasksCompleted(prev => new Set([...prev, index]));
        }
      }
    });
  };

  const rateConversation = async () => {
    if (!conversationId || conversationMessages.length === 0) {
      Alert.alert('ದೋಷ', 'ಸಂಭಾಷಣೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ಸಾಕಷ್ಟು ಸಂದೇಶಗಳಿಲ್ಲ');
      return;
    }
    
    setRatingLoading(true);
    try {
      // Build conversation transcript
      const transcript = conversationMessages.map((msg, idx) => {
        return `ಬಳಕೆದಾರ: ${msg.user_message}\nAI: ${msg.ai_response}`;
      }).join('\n\n');
      
      const response = await fetch(
        `${API_BASE_URL}/api/activity/conversation/${language}/rate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            conversation_transcript: transcript,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setConversationRating(data);
      setShowResult(true);
      
      // Generate transliterations for rating
      const newTranslit = {};
      if (data.feedback) {
        newTranslit.rating_feedback = await transliterateText(data.feedback);
      }
      if (data.task_assessment) {
        for (const [taskKey, assessment] of Object.entries(data.task_assessment)) {
          if (assessment.feedback) {
            newTranslit[`task_assessment_${taskKey}`] = await transliterateText(assessment.feedback);
          }
        }
      }
      setTransliterations(prev => ({ ...prev, ...newTranslit }));
      
    } catch (error) {
      console.error('Error rating conversation:', error);
      Alert.alert('ದೋಷ', 'ಸಂಭಾಷಣೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleSubmit = async () => {
    console.log('handleSubmit called', { activityType, hasActivity: !!activity });
    
    if (activityType === 'conversation') {
      // For conversation activities, handleSubmit means rating/submitting the conversation
      if (!conversationId || conversationMessages.length === 0) {
        Alert.alert('ದೋಷ', 'ಸಂಭಾಷಣೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ಸಾಕಷ್ಟು ಸಂದೇಶಗಳಿಲ್ಲ');
        return;
      }
      
      setRatingLoading(true);
      try {
        // Build conversation transcript
        const transcript = conversationMessages
          .filter(msg => msg.user_message && msg.ai_response)
          .map((msg, idx) => {
            return `ಬಳಕೆದಾರ: ${msg.user_message}\nAI: ${msg.ai_response}`;
          })
          .join('\n\n');
        
        const response = await fetch(
          `${API_BASE_URL}/api/activity/conversation/${language}/rate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversation_id: conversationId,
              conversation_transcript: transcript,
            }),
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Generate transliterations for rating
        const newTranslit = {};
        const ratingIndex = conversationRatings.length;
        
        // Transliterate labels
        newTranslit[`rating_title_${ratingIndex}`] = await transliterateText('ಸಂಭಾಷಣೆಯ ಮೌಲ್ಯಮಾಪನ');
        newTranslit[`rating_overall_${ratingIndex}`] = await transliterateText('ಒಟ್ಟು ಅಂಕ');
        newTranslit[`rating_vocab_${ratingIndex}`] = await transliterateText('ಶಬ್ದಕೋಶ');
        newTranslit[`rating_grammar_${ratingIndex}`] = await transliterateText('ವ್ಯಾಕರಣ');
        newTranslit[`rating_fluency_${ratingIndex}`] = await transliterateText('ನಿರರ್ಗಳತೆ');
        newTranslit[`rating_task_${ratingIndex}`] = await transliterateText('ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ');
        newTranslit[`rating_general_${ratingIndex}`] = await transliterateText('ಸಾಮಾನ್ಯ ಪ್ರತಿಕ್ರಿಯೆ');
        newTranslit[`rating_targeted_${ratingIndex}`] = await transliterateText('ಗುರಿ-ಕೇಂದ್ರಿತ ಪ್ರತಿಕ್ರಿಯೆ');
        newTranslit[`task_feedback_label_${ratingIndex}`] = await transliterateText('ಪ್ರತಿಕ್ರಿಯೆ');
        
        // Transliterate feedback (support both old and new format)
        if (data.general_feedback) {
          newTranslit[`rating_general_feedback_${ratingIndex}`] = await transliterateText(data.general_feedback);
        }
        if (data.targeted_feedback) {
          newTranslit[`rating_targeted_feedback_${ratingIndex}`] = await transliterateText(data.targeted_feedback);
        }
        if (data.feedback) {
          // Legacy format - use as general feedback
          newTranslit[`rating_feedback_${ratingIndex}`] = await transliterateText(data.feedback);
        }
        if (data.task_assessment) {
          for (const [taskKey, assessment] of Object.entries(data.task_assessment)) {
            if (assessment.feedback) {
              newTranslit[`task_assessment_${ratingIndex}_${taskKey}`] = await transliterateText(assessment.feedback);
            }
          }
        }
        setTransliterations(prev => ({ ...prev, ...newTranslit }));
        
        // Add rating to array with timestamp
        const ratingWithMeta = {
          ...data,
          submitted_at: new Date().toISOString(),
          index: conversationRatings.length,
        };
        setConversationRatings(prev => [...prev, ratingWithMeta]);
        setConversationRating(ratingWithMeta); // Also set as current rating
        
        // Update activity data to save rating
        const updatedActivity = {
          ...activity,
          ratings: [...(activity?.ratings || []), ratingWithMeta],
          messages: conversationMessages, // Ensure messages are saved
        };
  setActivity(sanitizeActivity(updatedActivity));
        
        // Save conversation history with rating
        await saveConversationHistory(conversationMessages, conversationId);
        
      } catch (error) {
        console.error('Error rating conversation:', error);
        Alert.alert('ದೋಷ', 'ಸಂಭಾಷಣೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ವಿಫಲವಾಗಿದೆ');
      } finally {
        setRatingLoading(false);
      }
      return;
    }

    if (activityType === 'reading' || activityType === 'listening') {
      // Check if all questions are answered
      if (!activity || !activity.questions) {
        console.error('Activity or questions not loaded');
        Alert.alert('ದೋಷ', 'ಕ್ರಿಯಾವಿಧಿಯನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ');
        return;
      }
      
      console.log('Checking for unanswered questions...', { 
        totalQuestions: activity.questions.length, 
        selectedOptions: Object.keys(selectedOptions).length,
        selectedOptionsKeys: Object.keys(selectedOptions)
      });
      
      const unansweredQuestions = [];
      activity.questions.forEach((q, index) => {
        const selected = selectedOptions[index];
        // Check if question is unanswered (undefined, null, or empty string)
        if (selected === undefined || selected === null || selected === '') {
          unansweredQuestions.push(index + 1); // Question numbers are 1-indexed
          console.log(`Question ${index + 1} is unanswered, selected value:`, selected);
        }
      });
      
      if (unansweredQuestions.length > 0) {
        const questionList = unansweredQuestions.join(', ');
        console.log('Unanswered questions found:', unansweredQuestions);
        const errorMessage = `ದಯವಿಟ್ಟು ಎಲ್ಲಾ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ.\n\nಉತ್ತರಿಸದ ಪ್ರಶ್ನೆಗಳು: ${questionList}`;
        setValidationError(errorMessage);
        // Generate transliteration for error message
        transliterateText(errorMessage).then(translit => {
          setValidationErrorTranslit(translit);
        }).catch(err => {
          console.error('Error transliterating validation error:', err);
        });
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setValidationError(null);
          setValidationErrorTranslit(null);
        }, 5000);
        return;
      }
      
      console.log('All questions answered, proceeding with submission');
    }
    if (activityType === 'writing' && !userAnswer.trim()) {
      const errorMessage = 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಬರೆಯಿರಿ';
      setValidationError(errorMessage);
      // Generate transliteration for error message
      transliterateText(errorMessage).then(translit => {
        setValidationErrorTranslit(translit);
      }).catch(err => {
        console.error('Error transliterating validation error:', err);
      });
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setValidationError(null);
        setValidationErrorTranslit(null);
      }, 5000);
      return;
    }
    if (activityType === 'conversation') {
      // Conversation activities are handled separately in the conversation section
      // But if someone tries to submit without any messages, alert them
      if (!conversationMessages || conversationMessages.length === 0) {
        const errorMessage = 'ಸಂಭಾಷಣೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡಲು ಸಾಕಷ್ಟು ಸಂದೇಶಗಳಿಲ್ಲ';
        setValidationError(errorMessage);
        // Generate transliteration for error message
        transliterateText(errorMessage).then(translit => {
          setValidationErrorTranslit(translit);
        }).catch(err => {
          console.error('Error transliterating validation error:', err);
        });
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
          setValidationError(null);
          setValidationErrorTranslit(null);
        }, 5000);
        return;
      }
    }
    
    // Clear any previous validation errors if we get here (all validations passed)
    setValidationError(null);

    let calculatedScore = 0;
    const wordUpdates = [];
    let updatedActivity = activity; // Store updated activity data (for writing with grading result)

    if (activityType === 'reading') {
      // Calculate score based on all questions
      let correctCount = 0;
      activity.questions.forEach((q, qIndex) => {
        const selectedValue = selectedOptions[qIndex];
        if (selectedValue) {
          const selectedIndex = parseInt(selectedValue.split('-')[1] || '-1');
          if (selectedIndex === q.correct) {
            correctCount++;
          }
        }
      });
      calculatedScore = correctCount / activity.questions.length;
      wordsUsed.forEach((word) => {
        wordUpdates.push({ word_id: word.id, correct: calculatedScore > 0.5 });
      });
    } else if (activityType === 'writing') {
      // Grade writing using Gemini API
      setGradingLoading(true);
      setShowResult(true); // Show grading progress message
      try {
        // Get learned and learning words for context
        const learnedWords = wordsUsed.filter(w => w.mastery_level === 'mastered');
        const learningWords = wordsUsed.filter(w => w.mastery_level === 'learning' || w.mastery_level === 'review');
        
        const response = await fetch(`${API_BASE_URL}/api/activity/writing/${language}/grade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_text: userAnswer,
            writing_prompt: activity.writing_prompt || activity.prompt || '',
            required_words: activity.required_words || [],
            evaluation_criteria: (() => {
              // Combine general guidelines with Gemini's criteria for grading
              const generalGuidelines = activity._general_guidelines || [
                "ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.",
                "ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.",
                "ಲೇಖನವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು."
              ];
              const geminiCriteria = activity.evaluation_criteria || '';
              return [...generalGuidelines, geminiCriteria].join('\n');
            })(),
            learned_words: learnedWords,
            learning_words: learningWords,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const gradingData = await response.json();
        setGradingResult(gradingData);
        calculatedScore = gradingData.score / 100; // Convert to 0-1 range
        
        // Store API details for grading (for debug modal)
        // Merge with existing API details if any (from activity generation)
        if (gradingData.api_details) {
          setApiDetails(prev => ({
            ...prev,
            endpoint: gradingData.api_details.endpoint || `POST /api/activity/writing/${language}/grade`,
            prompt: gradingData.api_details.prompt || 'No prompt available',
            wordsUsed: wordsUsed?.map(w => w.word || w) || [],
            responseTime: gradingData.api_details.response_time || 0,
            rawResponse: gradingData.api_details.raw_response || '',
            learnedWords: learnedWords || [],
            learningWords: learningWords || [],
            tokenInfo: gradingData.api_details.token_info || null,
            inputCost: gradingData.api_details.input_cost || 0,
            outputCost: gradingData.api_details.output_cost || 0,
            totalCost: gradingData.api_details.total_cost || 0,
            parseError: gradingData.api_details.parse_error || null,
          }));
        }
        
        // Create new submission object
        const newSubmission = {
          user_writing: userAnswer,
          grading_result: gradingData,
          submitted_at: new Date().toISOString(),
        };
        
        // Add to all submissions array
        const updatedSubmissions = [...allSubmissions, newSubmission];
        setAllSubmissions(updatedSubmissions);
        
        // Auto-expand the new submission
        const submissionIndex = updatedSubmissions.length - 1;
        setExpandedSubmissions(prev => new Set([...prev, submissionIndex]));
        
        // Generate transliteration for submission title
        try {
          const submissionTitleTranslit = await transliterateText(`ಸಲ್ಲಿಕೆ ${submissionIndex + 1}`);
          setTransliterations(prev => ({
            ...prev,
            [`submission_${submissionIndex}_title`]: submissionTitleTranslit,
          }));
        } catch (transError) {
          console.error('Error transliterating submission title:', transError);
        }
        
        // Generate transliteration for feedback
        if (gradingData.feedback && typeof gradingData.feedback === 'string' && gradingData.feedback.trim()) {
          try {
            const feedbackTranslit = await transliterateText(gradingData.feedback);
            setTransliterations(prev => ({ 
              ...prev, 
              grading_feedback: feedbackTranslit,
              [`submission_${submissionIndex}_feedback`]: feedbackTranslit,
            }));
          } catch (transError) {
            console.error('Error transliterating feedback:', transError);
          }
        }
        
        // Transliterate required words feedback
        if (gradingData.required_words_feedback && typeof gradingData.required_words_feedback === 'object') {
          try {
            for (const [word, feedback] of Object.entries(gradingData.required_words_feedback)) {
              if (feedback && typeof feedback === 'string' && feedback.trim()) {
                const wordFeedbackTranslit = await transliterateText(feedback);
                setTransliterations(prev => ({
                  ...prev,
                  [`submission_${submissionIndex}_word_${word}_feedback`]: wordFeedbackTranslit,
                }));
              }
            }
          } catch (transError) {
            console.error('Error transliterating word feedback:', transError);
          }
        }
        
        // Update words based on vocabulary score
        wordsUsed.forEach((word) => {
          wordUpdates.push({
            word_id: word.id,
            correct: gradingData.vocabulary_score >= 70, // 70% threshold
          });
        });
        
        // Store grading data in updated activity for saving later (include all submissions)
        updatedActivity = {
          ...activity,
          submissions: updatedSubmissions,
          _words_used_data: wordsUsed,
          // Keep legacy fields for backward compatibility
          user_writing: userAnswer,
          grading_result: gradingData,
        };
        
        // Clear input and current grading result so user can submit again
        setUserAnswer('');
        setGradingResult(null);
      } catch (error) {
        console.error('Error grading writing:', error);
        Alert.alert('ದೋಷ', 'ಬರವಣಿಗೆಯನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡುವಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.');
        setGradingLoading(false);
        return;
      } finally {
        setGradingLoading(false);
      }
    } else if (activityType === 'speaking') {
      // Grade speaking using Gemini API
      setGradingLoading(true);
      setShowResult(true); // Show grading progress message
      try {
        let finalTranscript = userAnswer;
        let audioBase64 = null;
        
        // If using audio input, read audio as base64 for storage
        if (useAudioInput && recordingUri) {
          // Read audio as base64 for storage - handle web vs native
          if (Platform.OS === 'web') {
            // For web, fetch the blob URL and convert to base64
            const response = await fetch(recordingUri);
            const blob = await response.blob();
            audioBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                // Remove data URL prefix (e.g., "data:audio/wav;base64,")
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } else {
            // For native platforms, use FileSystem
            audioBase64 = await FileSystem.readAsStringAsync(recordingUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }
          
          // For audio-only submissions, use empty transcript (backend will handle audio)
          if (!finalTranscript || !finalTranscript.trim()) {
            finalTranscript = '';
          }
        }
        
        if (!finalTranscript || !finalTranscript.trim()) {
          // Allow empty transcript if audio is provided
          if (!audioBase64) {
            throw new Error('No transcript or audio available for grading');
          }
        }
        
        // Validate required fields before sending
        const requiredWords = activity.required_words || [];
        const tasks = activity.tasks || [];
        const speakingTopic = activity.topic || '';
        
        if (!requiredWords || requiredWords.length === 0) {
          Alert.alert('ದೋಷ', 'ಅನಿವಾರ್ಯ ಪದಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಚಟುವಟಿಕೆಯನ್ನು ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ.');
          setGradingLoading(false);
          return;
        }
        
        if (!tasks || tasks.length === 0) {
          Alert.alert('ದೋಷ', 'ಕಾರ್ಯಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಚಟುವಟಿಕೆಯನ್ನು ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ.');
          setGradingLoading(false);
          return;
        }
        
        if (!speakingTopic || !speakingTopic.trim()) {
          Alert.alert('ದೋಷ', 'ವಿಷಯ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ಚಟುವಟಿಕೆಯನ್ನು ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ.');
          setGradingLoading(false);
          return;
        }
        
        // Get learned and learning words for context
        const learnedWords = wordsUsed.filter(w => w.mastery_level === 'mastered');
        const learningWords = wordsUsed.filter(w => w.mastery_level === 'learning' || w.mastery_level === 'review');
        
        const response = await fetch(`${API_BASE_URL}/api/activity/speaking/${language}/grade`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_transcript: finalTranscript,
            speaking_topic: speakingTopic,
            tasks: tasks,
            required_words: requiredWords,
            learned_words: learnedWords,
            learning_words: learningWords,
          }),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const gradingData = await response.json();
        setGradingResult(gradingData);
        calculatedScore = gradingData.score / 100; // Convert to 0-1 range
        
        // Generate transliterations for current grading result (before adding to submissions)
        if (gradingData.feedback) {
          try {
            const feedbackTranslit = await transliterateText(gradingData.feedback);
            setTransliterations(prev => ({ 
              ...prev, 
              grading_feedback: feedbackTranslit,
            }));
          } catch (transError) {
            console.error('Error transliterating feedback:', transError);
          }
        }
        
        // Transliterate required words feedback for current grading result
        if (gradingData.required_words_feedback) {
          try {
            for (const [word, feedback] of Object.entries(gradingData.required_words_feedback)) {
              const wordFeedbackTranslit = await transliterateText(feedback);
              setTransliterations(prev => ({
                ...prev,
                [`word_${word}_feedback`]: wordFeedbackTranslit,
              }));
            }
          } catch (transError) {
            console.error('Error transliterating word feedback:', transError);
          }
        }
        
        // Store API details for grading (for debug modal)
        if (gradingData.api_details) {
          const apiCall = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            endpoint: gradingData.api_details.endpoint || `POST /api/activity/speaking/${language}/grade`,
            prompt: gradingData.api_details.prompt || 'No prompt available',
            wordsUsed: wordsUsed?.map(w => w.word || w) || [],
            responseTime: gradingData.api_details.response_time || 0,
            rawResponse: gradingData.api_details.raw_response || '',
            learnedWords: learnedWords || [],
            learningWords: learningWords || [],
            tokenInfo: gradingData.api_details.token_info || null,
            inputCost: gradingData.api_details.input_cost || 0,
            outputCost: gradingData.api_details.output_cost || 0,
            totalCost: gradingData.api_details.total_cost || 0,
            parseError: gradingData.api_details.parse_error || null,
          };
          setAllApiDetails(prev => [...prev, apiCall]);
        }
        
        // Create new submission object
        const newSubmission = {
          transcript: finalTranscript,
          audio_base64: audioBase64,
          audio_uri: recordingUri,
          grading_result: gradingData,
          submitted_at: new Date().toISOString(),
        };
        
        // Add to all submissions array
        const updatedSubmissions = [...allSubmissions, newSubmission];
        setAllSubmissions(updatedSubmissions);
        console.log('✓ Speaking submission added to allSubmissions:', {
          totalSubmissions: updatedSubmissions.length,
          submissionIndex: updatedSubmissions.length - 1,
          hasGradingResult: !!newSubmission.grading_result,
          hasFeedback: !!newSubmission.grading_result?.feedback,
        });
        
        // Auto-expand the new submission
        const submissionIndex = updatedSubmissions.length - 1;
        setExpandedSubmissions(prev => new Set([...prev, submissionIndex]));
        
        // Generate transliteration for submission title
        try {
          const submissionTitleTranslit = await transliterateText(`ಸಲ್ಲಿಕೆ ${submissionIndex + 1}`);
          setTransliterations(prev => ({
            ...prev,
            [`submission_${submissionIndex}_title`]: submissionTitleTranslit,
          }));
        } catch (transError) {
          console.error('Error transliterating submission title:', transError);
        }
        
        // Generate transliteration for feedback
        if (gradingData.feedback && typeof gradingData.feedback === 'string' && gradingData.feedback.trim()) {
          try {
            const feedbackTranslit = await transliterateText(gradingData.feedback);
            setTransliterations(prev => ({ 
              ...prev, 
              [`submission_${submissionIndex}_feedback`]: feedbackTranslit,
              grading_feedback: feedbackTranslit, // Also store for current grading result
            }));
          } catch (transError) {
            console.error('Error transliterating feedback:', transError);
          }
        }
        
        // Transliterate required words feedback
        if (gradingData.required_words_feedback && typeof gradingData.required_words_feedback === 'object') {
          try {
            for (const [word, feedback] of Object.entries(gradingData.required_words_feedback)) {
              if (feedback && typeof feedback === 'string' && feedback.trim()) {
                const wordFeedbackTranslit = await transliterateText(feedback);
                setTransliterations(prev => ({
                  ...prev,
                  [`submission_${submissionIndex}_word_${word}_feedback`]: wordFeedbackTranslit,
                  [`word_${word}_feedback`]: wordFeedbackTranslit, // Also store for current grading result
                }));
              }
            }
          } catch (transError) {
            console.error('Error transliterating word feedback:', transError);
          }
        }
        
        // Transliterate tasks feedback
        if (gradingData.tasks_feedback) {
          try {
            for (const [taskKey, feedback] of Object.entries(gradingData.tasks_feedback)) {
              const taskFeedbackTranslit = await transliterateText(feedback);
              setTransliterations(prev => ({
                ...prev,
                [`submission_${submissionIndex}_task_${taskKey}_feedback`]: taskFeedbackTranslit,
              }));
            }
          } catch (transError) {
            console.error('Error transliterating task feedback:', transError);
          }
        }
        
        // Update words based on vocabulary score
        wordsUsed.forEach((word) => {
          wordUpdates.push({
            word_id: word.id,
            correct: gradingData.vocabulary_score >= 70, // 70% threshold
          });
        });
        
        // Store grading data in updated activity for saving later (include all submissions)
        updatedActivity = {
          ...activity,
          submissions: updatedSubmissions,
          _words_used_data: wordsUsed,
        };
        
        // Clear input and reset recording
        setUserAnswer('');
        setRecordingUri(null);
        setRecordingStatus('idle');
        setGradingResult(null);
        // Keep showResult true so submissions are visible
        setShowResult(true);
      } catch (error) {
        console.error('Error grading speaking:', error);
        Alert.alert('ದೋಷ', 'ಭಾಷಣವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡುವಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.');
        setGradingLoading(false);
        setShowResult(false);
        return;
      } finally {
        setGradingLoading(false);
      }
    } else if (activityType === 'listening') {
      // Calculate score based on all questions
      let correctCount = 0;
      activity.questions.forEach((q, qIndex) => {
        const selectedValue = selectedOptions[qIndex];
        if (selectedValue) {
          const selectedIndex = parseInt(selectedValue.split('-')[1] || '-1');
          if (selectedIndex === q.correct) {
            correctCount++;
          }
        }
      });
      calculatedScore = correctCount / activity.questions.length;
      wordsUsed.forEach((word) => {
        wordUpdates.push({ word_id: word.id, correct: calculatedScore > 0.5 });
      });
    } else {
      calculatedScore = 0.8;
      wordsUsed.forEach((word) => {
        wordUpdates.push({ word_id: word.id, correct: true });
      });
    }

    setScore(calculatedScore);
    // Only set showResult for non-writing activities (writing activities can have multiple submissions)
    if (activityType !== 'writing') {
      setShowResult(true);
      // Auto-show answers when result is shown (user can toggle to hide)
      setShowAnswers(true);
      
      // Generate transliterations for score display
      try {
        const scoreTitleTranslit = await transliterateText('ನಿಮ್ಮ ಸ್ಕೋರ್');
        const scoreSubtextTranslit = await transliterateText(
          activity.questions ? `${activity.questions.filter((q, idx) => {
            const selectedValue = selectedOptions[idx];
            if (selectedValue) {
              const selectedIndex = parseInt(selectedValue.split('-')[1] || '-1');
              return selectedIndex === q.correct;
            }
            return false;
          }).length} / ${activity.questions.length} ಸರಿಯಾದ ಉತ್ತರಗಳು` : ''
        );
        setTransliterations(prev => ({
          ...prev,
          score_title: scoreTitleTranslit,
          score_subtext: scoreSubtextTranslit,
        }));
      } catch (transError) {
        console.error('Error generating score transliterations:', transError);
      }
    }

    try {
      // Prepare activity data for saving
      // For writing and speaking activities, ensure we include all submissions
      let activityDataToSave = updatedActivity || activity;
      
      // Ensure submissions array is included for writing and speaking activities
      if ((activityType === 'writing' || activityType === 'speaking') && allSubmissions.length > 0) {
        activityDataToSave = {
          ...activityDataToSave,
          submissions: allSubmissions,
        };
        console.log(`✓ Saving ${activityType} activity with ${allSubmissions.length} submission(s)`);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/activity/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          activity_type: activityType,
          score: calculatedScore,
          word_updates: wordUpdates,
          activity_data: activityDataToSave,
          activity_id: resolvedActivityId || null, // Pass activity ID if reopening from history and resolved
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error completing activity:', response.status, errorText);
      } else {
        console.log('✓ Activity completed and logged successfully');
        
        // If reopening from history with activityId, refresh activity data from database
        // to ensure we have the latest submissions
        const fromHistoryFlag = (typeof fromHistory !== 'undefined') ? fromHistory : (route?.params?.fromHistory || false);
        if (fromHistoryFlag && resolvedActivityId && (activityType === 'writing' || activityType === 'speaking')) {
          try {
            console.log('Refreshing activity data from database...');
            const refreshResponse = await fetch(`${API_BASE_URL}/api/activity/${resolvedActivityId}`);
            if (refreshResponse.ok) {
              const refreshedData = await refreshResponse.json();
              const freshActivityData = refreshedData.activity_data || {};
              
              // Update activity and submissions with fresh data (sanitized)
              setActivity(sanitizeActivity(freshActivityData));
              if (freshActivityData.submissions && Array.isArray(freshActivityData.submissions)) {
                setAllSubmissions(freshActivityData.submissions);
                console.log(`✓ Refreshed: now showing ${freshActivityData.submissions.length} submission(s)`);
              }
            }
          } catch (refreshError) {
            console.error('Error refreshing activity data:', refreshError);
            // Non-critical error, continue with current state
          }
        }
      }
    } catch (error) {
      console.error('Error completing activity:', error);
      Alert.alert('Error', 'Failed to save activity. Please try again.');
    }
  };

  const handleNext = () => {
    navigation.goBack();
  };

  // Format time helper
  const formatTime = (seconds) => {
    // Handle null, undefined, NaN, or negative values
    if (seconds == null || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    // Ensure seconds is a number and handle floating point
    const totalSeconds = Number(seconds);
    if (!isFinite(totalSeconds) || totalSeconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Update audio position periodically
  const startPositionUpdates = (paragraphIndex) => {
    // Clear any existing interval for this paragraph
    if (positionUpdateIntervalRef.current[paragraphIndex]) {
      clearInterval(positionUpdateIntervalRef.current[paragraphIndex]);
    }
    
    const interval = setInterval(() => {
      const sound = audioSoundsRef.current[paragraphIndex];
      if (!sound) {
        clearInterval(interval);
        return;
      }
      
      if (Platform.OS === 'web') {
        // HTML5 Audio API
        if (sound && typeof sound.currentTime !== 'undefined') {
          // Ensure we get valid numeric values
          const currentTime = Number(sound.currentTime) || 0;
          const duration = Number(sound.duration) || 0;
          
          // Only update if values are valid and finite
          if (isFinite(currentTime) && currentTime >= 0) {
            setAudioPosition(prev => ({ ...prev, [paragraphIndex]: currentTime }));
          }
          if (isFinite(duration) && duration >= 0) {
            setAudioDuration(prev => ({ ...prev, [paragraphIndex]: duration }));
          }
          
          // Check if finished (for auto-playthrough)
          if (duration > 0 && currentTime >= duration - 0.1 && isFirstPlaythrough && !userInteracted) {
            // Audio finished, auto-play next paragraph
            handleAutoPlayNext(paragraphIndex);
          }
        }
      } else {
        // expo-av
        sound.getStatusAsync().then(status => {
          if (status.isLoaded) {
            // Convert milliseconds to seconds and ensure valid numeric values
            const currentTimeMs = Number(status.positionMillis) || 0;
            const durationMs = Number(status.durationMillis) || 0;
            const currentTime = currentTimeMs / 1000;
            const duration = durationMs / 1000;
            
            // Only update if values are valid and finite
            if (isFinite(currentTime) && currentTime >= 0) {
              setAudioPosition(prev => ({ ...prev, [paragraphIndex]: currentTime }));
            }
            if (isFinite(duration) && duration >= 0) {
              setAudioDuration(prev => ({ ...prev, [paragraphIndex]: duration }));
            }
            
            // Check if finished (for auto-playthrough)
            if (status.didJustFinish && isFirstPlaythrough && !userInteracted) {
              // Audio finished, auto-play next paragraph
              handleAutoPlayNext(paragraphIndex);
            }
          }
        }).catch(() => {
          clearInterval(interval);
        });
      }
    }, 100); // Update every 100ms
    
    positionUpdateIntervalRef.current[paragraphIndex] = interval;
  };

  // Handle auto-play next paragraph
  const handleAutoPlayNext = (currentIndex) => {
    if (!isFirstPlaythrough || userInteracted) return;
    
    const paragraphs = activity?.passage?.split('\n\n').filter(p => p.trim()) || [];
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < paragraphs.length) {
      // Clear any existing timeout
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
      }
      
      // Small delay before auto-playing next paragraph
      autoPlayTimeoutRef.current = setTimeout(() => {
        // Scroll to next paragraph
        const screenWidth = Dimensions.get('window').width;
        paragraphScrollViewRef.current?.scrollTo({
          x: nextIndex * (screenWidth - 40),
          animated: true,
        });
        setCurrentParagraphIndex(nextIndex);
        
        // Auto-play next paragraph
        setTimeout(() => {
          playAudio(nextIndex, paragraphs[nextIndex].trim());
        }, 300); // Small delay for scroll animation
      }, 500); // 500ms delay after current audio finishes
    } else {
      // All paragraphs played, mark first playthrough as complete
      setIsFirstPlaythrough(false);
    }
  };

  // Seek audio
  const seekAudio = async (paragraphIndex, seekTo) => {
    // Mark user interaction
    setUserInteracted(true);
    setIsFirstPlaythrough(false);
    
    // Clear auto-play timeout
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
    
    const sound = audioSoundsRef.current[paragraphIndex];
    if (!sound) return;
    
    try {
      if (Platform.OS === 'web') {
        // HTML5 Audio API
        if (sound && typeof sound.currentTime !== 'undefined') {
          sound.currentTime = seekTo;
          setAudioPosition(prev => ({ ...prev, [paragraphIndex]: seekTo }));
        }
      } else {
        // expo-av
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.setPositionAsync(seekTo * 1000); // Convert to milliseconds
          setAudioPosition(prev => ({ ...prev, [paragraphIndex]: seekTo }));
        }
      }
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  };

  // Replay audio (reset to beginning)
  const replayAudio = async (paragraphIndex) => {
    // Mark user interaction
    setUserInteracted(true);
    setIsFirstPlaythrough(false);
    
    // Clear auto-play timeout
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
    
    await seekAudio(paragraphIndex, 0);
    const sound = audioSoundsRef.current[paragraphIndex];
    if (sound) {
      if (Platform.OS === 'web') {
        if (sound && typeof sound.play === 'function') {
          await sound.play();
          setPlayingParagraph(paragraphIndex);
          setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'playing' }));
        }
      } else {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.playAsync();
          setPlayingParagraph(paragraphIndex);
          setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'playing' }));
        }
      }
    }
  };

  // Audio playback functions for listening activity
  const playAudio = async (paragraphIndex, paragraphText) => {
    try {
      // Check if we already have a sound object for this paragraph (resume from pause)
      if (audioSoundsRef.current[paragraphIndex]) {
        const sound = audioSoundsRef.current[paragraphIndex];
        
        if (Platform.OS === 'web') {
          // HTML5 Audio API - resume from current position (don't reset currentTime)
          if (sound && typeof sound.play === 'function') {
            // Don't reset currentTime - resume from where it was paused
            await sound.play();
            setPlayingParagraph(paragraphIndex);
            setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'playing' }));
            startPositionUpdates(paragraphIndex);
            return;
          }
        } else {
          // expo-av - resume from current position
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            // playAsync() will resume from current position if paused
            await sound.playAsync();
            setPlayingParagraph(paragraphIndex);
            setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'playing' }));
            startPositionUpdates(paragraphIndex);
            return;
          }
        }
      }
      
      // If no existing sound or can't resume, stop other audio and create new
      // Stop any currently playing audio (preserve positions for paused audio)
      await stopAllAudio(true); // preservePosition = true to keep paused positions
      
      // Get audio data from activity
      const audioDataList = activity._audio_data || [];
      const audioData = audioDataList[paragraphIndex];
      
      console.log(`[Audio] Paragraph ${paragraphIndex}:`, {
        hasAudioData: !!audioData,
        hasBase64: !!(audioData?.audio_base64),
        format: audioData?.format,
        model: audioData?.model,
        audioDataLength: audioData?.audio_base64?.length
      });
      
      if (audioData && audioData.audio_base64 && audioData.format !== 'text_only') {
        // Use backend-generated audio (base64 encoded MP3)
        try {
          console.log(`[Audio] Loading audio from base64, length: ${audioData.audio_base64.length} chars`);
          
          // Convert base64 directly to data URI
          // Handle both WAV and MP3 formats
          const audioFormat = audioData.format || 'wav'; // Default to WAV for Gemini TTS
          const mimeType = audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg';
          const dataUri = `data:${mimeType};base64,${audioData.audio_base64}`;
          
          if (Platform.OS === 'web') {
            // Use HTML5 Audio API for web (expo-av doesn't work well on web)
            // Use the native browser Audio constructor, not expo-av's Audio
            console.log(`[Audio] Using HTML5 Audio API for web`);
            // Use native browser Audio constructor, not expo-av's Audio
            // In web, window.Audio is the native HTML5 Audio constructor
            const BrowserAudio = typeof window !== 'undefined' && window.Audio ? window.Audio : null;
            if (!BrowserAudio) {
              throw new Error('HTML5 Audio API not available in this environment');
            }
            const audioElement = new BrowserAudio(dataUri);
            
            // Set up event listeners
            audioElement.onloadeddata = () => {
              console.log(`[Audio] Audio loaded for paragraph ${paragraphIndex}`);
            };
            
            audioElement.onplay = () => {
              console.log(`[Audio] Playback started for paragraph ${paragraphIndex}`);
              setPlayingParagraph(paragraphIndex);
              setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'playing' }));
              // Start position updates
              startPositionUpdates(paragraphIndex);
              // Get duration when loaded
              if (audioElement.duration) {
                setAudioDuration(prev => ({ ...prev, [paragraphIndex]: audioElement.duration }));
              }
            };
            
            audioElement.onloadedmetadata = () => {
              if (audioElement.duration) {
                setAudioDuration(prev => ({ ...prev, [paragraphIndex]: audioElement.duration }));
              }
            };
            
            audioElement.onpause = () => {
              console.log(`[Audio] Playback paused for paragraph ${paragraphIndex}`);
              setPlayingParagraph(null);
              setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'paused' }));
              // Clear position update interval
              if (positionUpdateIntervalRef.current[paragraphIndex]) {
                clearInterval(positionUpdateIntervalRef.current[paragraphIndex]);
                delete positionUpdateIntervalRef.current[paragraphIndex];
              }
            };
            
            audioElement.onended = () => {
              console.log(`[Audio] Playback finished for paragraph ${paragraphIndex}`);
              setPlayingParagraph(null);
              setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'stopped' }));
              // Clear position update interval
              if (positionUpdateIntervalRef.current[paragraphIndex]) {
                clearInterval(positionUpdateIntervalRef.current[paragraphIndex]);
                delete positionUpdateIntervalRef.current[paragraphIndex];
              }
              // Reset position to 0 when finished (for replay)
              setAudioPosition(prev => ({ ...prev, [paragraphIndex]: 0 }));
              // Handle auto-playthrough if first playthrough and no user interaction
              if (isFirstPlaythrough && !userInteracted) {
                handleAutoPlayNext(paragraphIndex);
              }
            };
            
            audioElement.onerror = (error) => {
              // Some browsers fire error events even when audio works
              // Check if audio is actually playing or loaded - if so, ignore the error
              console.warn(`[Audio] HTML5 Audio event for paragraph ${paragraphIndex}:`, error);
              // Only set error state if audio is truly not working after a delay
              setTimeout(() => {
                // Check multiple conditions to ensure audio really failed
                const isLoaded = audioElement.readyState >= 2; // HAVE_CURRENT_DATA or higher
                const isPlaying = !audioElement.paused && audioElement.currentTime > 0;
                const hasError = audioElement.error !== null;
                
                // Only log error if audio is not loaded AND has an error AND is not playing
                if (!isLoaded && hasError && !isPlaying) {
                  console.error(`[Audio] Audio failed to load/play for paragraph ${paragraphIndex}:`, audioElement.error);
                  setPlayingParagraph(null);
                  setAudioStatus({ ...audioStatus, [paragraphIndex]: 'error' });
                  Alert.alert('Audio Error', 'Could not play audio. Please try again.');
                } else {
                  // Audio is working fine, just log info
                  console.log(`[Audio] Audio event for paragraph ${paragraphIndex} - loaded: ${isLoaded}, playing: ${isPlaying}, error: ${hasError}`);
                }
              }, 1000); // Increased delay to give audio more time to load
            };
            
            // Store audio element reference
            audioSoundsRef.current[paragraphIndex] = audioElement;
            
            // Initialize position to 0 if starting fresh (no saved position)
            const savedPosition = audioPosition[paragraphIndex] || 0;
            if (savedPosition > 0 && audioElement.readyState >= 2) {
              audioElement.currentTime = savedPosition;
              setAudioPosition(prev => ({ ...prev, [paragraphIndex]: savedPosition }));
            } else {
              // Initialize to 0 for fresh playback
              audioElement.currentTime = 0;
              setAudioPosition(prev => ({ ...prev, [paragraphIndex]: 0 }));
            }
            
            // Start playback
            audioElement.volume = 1.0;
            await audioElement.play();
            console.log(`[Audio] Successfully started playback for paragraph ${paragraphIndex} on web`);
          } else {
            // Use expo-av for mobile platforms
            console.log(`[Audio] Using expo-av for mobile platform`);
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: dataUri },
              { 
                shouldPlay: true,
                isMuted: false,
                volume: 1.0,
              }
            );
            
            console.log(`[Audio] Sound created successfully, setting up status listener`);
            
            // Set up playback status listener
            newSound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded) {
                const currentTime = (status.positionMillis || 0) / 1000;
                const duration = (status.durationMillis || 0) / 1000;
                setAudioPosition(prev => ({ ...prev, [paragraphIndex]: currentTime }));
                setAudioDuration(prev => ({ ...prev, [paragraphIndex]: duration }));
                
                if (status.didJustFinish) {
                  console.log(`[Audio] Playback finished for paragraph ${paragraphIndex}`);
                  setPlayingParagraph(null);
                  setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'stopped' }));
                  // Clear position update interval
                  if (positionUpdateIntervalRef.current[paragraphIndex]) {
                    clearInterval(positionUpdateIntervalRef.current[paragraphIndex]);
                    delete positionUpdateIntervalRef.current[paragraphIndex];
                  }
                  // Reset position to 0 when finished (for replay)
                  setAudioPosition(prev => ({ ...prev, [paragraphIndex]: 0 }));
                  // Handle auto-playthrough if first playthrough and no user interaction
                  if (isFirstPlaythrough && !userInteracted) {
                    handleAutoPlayNext(paragraphIndex);
                  }
                } else if (status.isPlaying) {
                  setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'playing' }));
                } else if (status.isBuffering) {
                  console.log(`[Audio] Buffering paragraph ${paragraphIndex}`);
                }
              } else {
                console.log(`[Audio] Status not loaded for paragraph ${paragraphIndex}:`, status);
              }
            });
            
            audioSoundsRef.current[paragraphIndex] = newSound;
            
            // Restore position if resuming (not starting fresh)
            const savedPosition = audioPosition[paragraphIndex] || 0;
            if (savedPosition > 0) {
              const positionMillis = savedPosition * 1000;
              await newSound.setPositionAsync(positionMillis);
              setAudioPosition(prev => ({ ...prev, [paragraphIndex]: savedPosition }));
            } else {
              // Initialize to 0 for fresh playback
              await newSound.setPositionAsync(0);
              setAudioPosition(prev => ({ ...prev, [paragraphIndex]: 0 }));
            }
            
            setPlayingParagraph(paragraphIndex);
            setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'playing' }));
            // Get initial duration
            const initialStatus = await newSound.getStatusAsync();
            if (initialStatus.isLoaded && initialStatus.durationMillis) {
              setAudioDuration(prev => ({ ...prev, [paragraphIndex]: initialStatus.durationMillis / 1000 }));
            }
            console.log(`[Audio] Successfully started playback for paragraph ${paragraphIndex} on mobile`);
          }
        } catch (audioError) {
          console.error('[Audio] Error loading audio from base64:', audioError);
          console.error('[Audio] Error details:', {
            message: audioError.message,
            stack: audioError.stack,
            audioDataFormat: audioData?.format,
            base64Length: audioData?.audio_base64?.length,
            platform: Platform.OS
          });
          
          // Show user-friendly error
          Alert.alert(
            'Audio Error', 
            `Could not play audio: ${audioError.message}. Please check the console for details.`,
            [{ text: 'OK' }]
          );
          setPlayingParagraph(null);
          setAudioStatus({ ...audioStatus, [paragraphIndex]: 'error' });
        }
      } else {
        // No valid audio data available
        const reason = !audioData 
          ? 'No audio data in activity'
          : audioData.format === 'text_only'
          ? 'Backend returned text-only (TTS generation failed)'
          : !audioData.audio_base64
          ? 'Audio data missing base64 content'
          : 'Unknown reason';
        
        console.error(`[Audio] Cannot play paragraph ${paragraphIndex}: ${reason}`);
        console.error('[Audio] Audio data:', audioData);
        console.error('[Audio] Activity _audio_data:', activity._audio_data);
        
        Alert.alert(
          'Audio Not Available',
          `Audio for this paragraph is not available: ${reason}. The backend TTS may have failed. Please check backend logs.`,
          [{ text: 'OK' }]
        );
        setPlayingParagraph(null);
        setAudioStatus({ ...audioStatus, [paragraphIndex]: 'error' });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Could not play audio. Please try again.');
      setPlayingParagraph(null);
    }
  };

  // Removed playAudioFallback - we no longer use Web Speech API as fallback
  // If backend TTS fails, we show an error instead

  const pauseAudio = async (paragraphIndex) => {
    // Mark user interaction
    setUserInteracted(true);
    setIsFirstPlaythrough(false);
    
    // Clear auto-play timeout
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
    
    try {
      if (audioSoundsRef.current[paragraphIndex]) {
        const sound = audioSoundsRef.current[paragraphIndex];
        
        if (Platform.OS === 'web') {
          // HTML5 Audio API
          if (sound && typeof sound.pause === 'function') {
            sound.pause();
          }
        } else {
          // expo-av
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await sound.pauseAsync();
          }
        }
      }
      
      setPlayingParagraph(null);
      setAudioStatus(prev => ({ ...prev, [paragraphIndex]: 'paused' }));
      // Clear position update interval
      if (positionUpdateIntervalRef.current[paragraphIndex]) {
        clearInterval(positionUpdateIntervalRef.current[paragraphIndex]);
        delete positionUpdateIntervalRef.current[paragraphIndex];
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  };

  const stopAllAudio = async (preservePosition = false) => {
    // Mark user interaction
    setUserInteracted(true);
    setIsFirstPlaythrough(false);
    
    // Clear auto-play timeout
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
    
    try {
      // Clear all position update intervals
      Object.values(positionUpdateIntervalRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
      positionUpdateIntervalRef.current = {};
      
      // Stop all sound objects (but preserve position if requested)
      for (const [index, sound] of Object.entries(audioSoundsRef.current)) {
        if (sound) {
          try {
            if (Platform.OS === 'web') {
              // HTML5 Audio API
              if (sound && typeof sound.pause === 'function') {
                sound.pause();
                // Only reset to 0 if not preserving position (for stop, not pause)
                if (!preservePosition) {
                  sound.currentTime = 0;
                }
                // Don't clear src - keep audio loaded for replay
              }
            } else {
              // expo-av
              const status = await sound.getStatusAsync();
              if (status.isLoaded) {
                // Only stop (reset to 0) if not preserving position
                if (!preservePosition) {
                  await sound.stopAsync();
                } else {
                  // Just pause to preserve position
                  await sound.pauseAsync();
                }
                // Don't unload - keep audio loaded for replay
              }
            }
          } catch (e) {
            // Ignore errors when stopping
            console.error(`Error stopping sound ${index}:`, e);
          }
        }
      }
      setPlayingParagraph(null);
      // Don't clear audioStatus completely - preserve paused state
      if (!preservePosition) {
        setAudioStatus({});
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  // Configure audio mode and cleanup on mount/unmount (only for listening activities)
  useEffect(() => {
    // Only configure audio for listening activities
    if (activityType !== 'listening') {
      return;
    }
    
    // Configure audio mode for playback (only on mobile platforms)
    const configureAudio = async () => {
      if (Platform.OS !== 'web') {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          console.log('[Audio] Audio mode configured successfully');
        } catch (error) {
          console.error('[Audio] Error configuring audio mode:', error);
        }
      } else {
        console.log('[Audio] Skipping audio mode configuration on web (using HTML5 Audio)');
      }
    };
    
    configureAudio();
    
    return () => {
      stopAllAudio();
      // Clear all intervals and timeouts
      Object.values(positionUpdateIntervalRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
      }
    };
  }, [activityType]);

  // Function to render text with bold vocabulary words
  const handleWordPress = async (word) => {
    // Open dictionary and search for the word
    setShowDictionary(true);
    
    // Normalize the word (trim whitespace)
    word = word.trim();
    if (!word) return;
    
    // First, check if this word matches or is part of an already-matched word
    // IMPORTANT: Only match if the clicked word is a prefix or suffix of the matched word,
    // not if it's embedded in the middle (e.g., "ಭಾಗ" should NOT match "ಹಿಂಭಾಗ")
    if (wordsUsed && wordsUsed.length > 0) {
      // Check if word matches any variant in wordsUsed (Kannada or transliteration)
      for (const matchedWord of wordsUsed) {
        // Check Kannada variants - if word matches any variant, search for the matched word's Kannada
        const kannadaVariants = (matchedWord.kannada || '').split(' /').map(v => v.trim());
        for (const variant of kannadaVariants) {
          // Exact match - highest priority
          if (variant === word) {
            // Search for the first variant (the backend will find the full entry)
            setDictionarySearch(kannadaVariants[0]);
            return;
          }
          // Word is a prefix (e.g., "ಕಂಪನಿ" in "ಕಂಪನಿಗಳು")
          // Only match if the variant starts with the word
          // This is safe because if "ಕಂಪನಿ" starts "ಕಂಪನಿಗಳು", it's likely the root word
          if (variant.startsWith(word) && variant !== word) {
            setDictionarySearch(variant);
            return;
          }
          // Skip suffix matching (endsWith) to avoid false positives
          // Example: "ಭಾಗ" should NOT match "ಹಿಂಭಾಗ" even though "ಹಿಂಭಾಗ".endsWith("ಭಾಗ")
          // because "ಭಾಗ" is embedded in a compound word, not a true suffix
          // If we need suffix matching later, we should only do it for space-separated compounds
        }
        // Also check transliteration variants
        const translitVariants = (matchedWord.transliteration || '').split(' /').map(v => v.trim());
        const wordLower = word.toLowerCase();
        for (const variant of translitVariants) {
          const variantLower = variant.toLowerCase();
          // Exact match - highest priority
          if (variantLower === wordLower) {
            // Search for the first transliteration variant
            setDictionarySearch(translitVariants[0]);
            return;
          }
          // Word is a prefix (e.g., "kaṁpani" in "kaṁpanigaḷu")
          if (variantLower.startsWith(wordLower) && variantLower !== wordLower) {
            setDictionarySearch(variant);
            return;
          }
          // Skip suffix matching for transliteration too to avoid false positives
        }
      }
    }
    
    // Try to find root word by removing suffixes (for both Kannada and transliteration)
    let rootWord = word;
    let foundMatch = false;
    
    // If word is in Kannada script, try to find root word by removing Kannada suffixes
    if (/[\u0C80-\u0CFF]/.test(word)) {
      // Common Kannada suffixes - comprehensive list (same as in renderTextWithHighlighting)
      const suffixes = [
        // Plural markers (longest first for proper matching)
        'ಗಳನ್ನು', 'ಗಳಿಗೆ', 'ಗಳಿಂದ', 'ಗಳಲ್ಲಿ', 'ಗಳು',
        'ಗಳ', 'ಗಳನ್ನು', 'ಗಳಿಗೆ', 'ಗಳಿಂದ', 'ಗಳಲ್ಲಿ',
        
        // Dative/Accusative case endings
        'ಕ್ಕೆ', 'ಗೆ', 'ಗೆ', 'ಕ್ಕೆ',
        'ನ್ನು', 'ನು', 'ನ್ನು', 'ನು',
        
        // Ablative/Instrumental case endings
        'ನಿಂದ', 'ದಿಂದ', 'ವಿಂದ', 'ರಿಂದ', 'ಲಿಂದ', 'ಯಿಂದ',
        'ಇಂದ', 'ಇಂತ',
        
        // Locative case endings
        'ದಲ್ಲಿ', 'ನಲ್ಲಿ', 'ವಲ್ಲಿ', 'ರಲ್ಲಿ', 'ಲಲ್ಲಿ', 'ಯಲ್ಲಿ',
        'ದಲಿ', 'ನಲಿ', 'ವಲಿ', 'ರಲಿ', 'ಲಲಿ', 'ಯಲಿ',
        'ಲ್ಲಿ', 'ಲಿ',
        
        // Genitive/Possessive markers
        'ನ', 'ದ', 'ವ', 'ರ', 'ಲ', 'ಯ',
        'ನಾ', 'ದಾ', 'ವಾ', 'ರಾ', 'ಲಾ', 'ಯಾ',
        
        // Verb endings (present tense)
        'ತ್ತಾನೆ', 'ತ್ತಾರೆ', 'ತ್ತದೆ', 'ತ್ತವೆ', 'ತ್ತೀರಿ', 'ತ್ತೀರ',
        'ತ್ತೇನೆ', 'ತ್ತೇವೆ', 'ತ್ತೀಯೆ', 'ತ್ತೀಯ',
        'ತ್ತಾ', 'ತ್ತ',
        
        // Verb endings (past tense)
        'ಯಿತು', 'ಯಿತು', 'ಯಿತು', 'ಯಿತು',
        'ದಿತು', 'ದಿತು', 'ದಿತು',
        'ವಿತು', 'ವಿತು',
        'ರಿತು', 'ರಿತು',
        'ಲಿತು', 'ಲಿತು',
        'ಯಿತು',
        
        // Verb endings (perfect/continuous)
        'ಆಗಿದೆ', 'ಆಗಿದೆ', 'ಆಗಿದೆ',
        'ಇದೆ', 'ಇದೆ', 'ಇದೆ',
        'ಉತ್ತದೆ', 'ಉತ್ತದೆ',
        'ಆಗುತ್ತದೆ', 'ಆಗುತ್ತದೆ',
        'ಇರುತ್ತದೆ', 'ಇರುತ್ತದೆ',
        
        // Other common endings
        'ದು', 'ನು', 'ವು', 'ರು', 'ಲು', 'ಯು',
        'ದೆ', 'ನೆ', 'ವೆ', 'ರೆ', 'ಲೆ', 'ಯೆ',
        'ದಾ', 'ನಾ', 'ವಾ', 'ರಾ', 'ಲಾ', 'ಯಾ',
        'ದಿ', 'ನಿ', 'ವಿ', 'ರಿ', 'ಲಿ', 'ಯಿ',
      ];
      
      // Try removing suffixes (longest first) to find the best root word
      // Strategy: Find all possible roots, prefer ones in wordsUsed, but use the best root regardless
      const sortedSuffixes = [...suffixes].sort((a, b) => b.length - a.length);
      let bestRoot = word; // Default to original word
      let bestRootInVocab = false;
      let bestRootLength = 0;
      
      for (const suffix of sortedSuffixes) {
        if (word.endsWith(suffix) && word.length > suffix.length) {
          const candidate = word.slice(0, -suffix.length);
          
          // Skip if candidate is too short (not a valid root)
          if (candidate.length < 2) continue;
          
          // Check if this root exists in wordsUsed
          const foundInVocab = wordsUsed && wordsUsed.some(w => {
            const kannadaVariants = (w.kannada || '').split(' /').map(v => v.trim());
            return kannadaVariants.some(v => {
              // Exact match
              if (v === candidate) return true;
              // Candidate starts with vocab word
              if (candidate.startsWith(v) && candidate.length >= v.length) return true;
              // Vocab word starts with candidate
              if (v.startsWith(candidate) && v.length >= candidate.length) return true;
              return false;
            });
          });
          
          // Update best root if:
          // 1. This root is in vocab and we haven't found a vocab root yet, OR
          // 2. This root is in vocab and is longer than current best vocab root, OR
          // 3. This root is not in vocab but is longer than current best non-vocab root
          const shouldUpdate = 
            (foundInVocab && (!bestRootInVocab || candidate.length > bestRootLength)) ||
            (!foundInVocab && !bestRootInVocab && candidate.length > bestRootLength);
          
          if (shouldUpdate) {
            bestRoot = candidate;
            bestRootInVocab = foundInVocab;
            bestRootLength = candidate.length;
            
            // If we found a vocab root, we can break early (prefer vocab matches)
            // But continue if we want to find the longest vocab root
            if (foundInVocab && candidate.length >= 3) {
              // Good enough - prefer vocab matches and break
              break;
            }
          }
        }
      }
      
      // Always use the best root found (even if not in wordsUsed - dictionary API will find it)
      // This ensures "ಕಂಪನಿಗಳು" -> "ಕಂಪನಿ" even if "ಕಂಪನಿ" wasn't in wordsUsed
      if (bestRoot !== word && bestRoot.length >= 2) {
        setDictionarySearch(bestRoot);
      } else {
        setDictionarySearch(word);
      }
    } else {
      // For transliteration words, try removing transliteration suffixes
      // Common transliteration suffixes (IAST format)
      const translitSuffixes = [
        // Plural markers
        'gaḷu', 'gaḷannu', 'gaḷige', 'gaḷinda', 'gaḷalli', 'gaḷa',
        
        // Case endings (dative/accusative)
        'kke', 'ge', 'nnu', 'nu',
        
        // Case endings (ablative/instrumental)
        'ninda', 'dinda', 'vinda', 'rinda', 'linda', 'yinda',
        'inda', 'inta',
        
        // Case endings (locative)
        'dalli', 'nalli', 'valli', 'ralli', 'lalli', 'yalli',
        'dali', 'nali', 'vali', 'rali', 'lali', 'yali',
        'lli', 'li',
        
        // Genitive/possessive
        'na', 'da', 'va', 'ra', 'la', 'ya',
        'n', 'd', 'v', 'r', 'l', 'y',
        
        // Verb endings (present)
        'ttāne', 'ttāre', 'ttade', 'ttave', 'ttīri', 'ttīr',
        'ttēne', 'ttēve', 'ttīye', 'ttīy',
        'ttā', 'tta',
        
        // Verb endings (past)
        'yitu', 'ditu', 'vitu', 'ritu', 'litu',
        
        // Verb endings (perfect/continuous)
        'āgide', 'ide', 'uttade', 'āguttade', 'iruttade',
        
        // Other endings
        'du', 'nu', 'vu', 'ru', 'lu', 'yu',
        'de', 'ne', 've', 're', 'le', 'ye',
        'di', 'ni', 'vi', 'ri', 'yi',
      ];
      
      const sortedTranslitSuffixes = [...translitSuffixes].sort((a, b) => b.length - a.length);
      
      // Use same strategy as Kannada: find best root, prefer vocab matches but use best root regardless
      let bestRoot = word;
      let bestRootInVocab = false;
      let bestRootLength = 0;
      
      for (const suffix of sortedTranslitSuffixes) {
        if (word.toLowerCase().endsWith(suffix) && word.length > suffix.length) {
          const candidate = word.slice(0, -suffix.length);
          
          // Skip if candidate is too short
          if (candidate.length < 2) continue;
          
          // Check if this root exists in wordsUsed (by transliteration)
          const foundInVocab = wordsUsed && wordsUsed.some(w => {
            const translitVariants = (w.transliteration || '').split(' /').map(v => v.trim().toLowerCase());
            return translitVariants.some(v => {
              const candidateLower = candidate.toLowerCase();
              if (v === candidateLower) return true;
              if (candidateLower.startsWith(v) && candidateLower.length >= v.length) return true;
              if (v.startsWith(candidateLower) && v.length >= candidateLower.length) return true;
              return false;
            });
          });
          
          // Update best root using same logic as Kannada
          const shouldUpdate = 
            (foundInVocab && (!bestRootInVocab || candidate.length > bestRootLength)) ||
            (!foundInVocab && !bestRootInVocab && candidate.length > bestRootLength);
          
          if (shouldUpdate) {
            bestRoot = candidate;
            bestRootInVocab = foundInVocab;
            bestRootLength = candidate.length;
            
            if (foundInVocab && candidate.length >= 3) {
              break;
            }
          }
        }
      }
      
      // Always use the best root found (even if not in wordsUsed - dictionary API will find it)
      if (bestRoot !== word && bestRoot.length >= 2) {
        setDictionarySearch(bestRoot);
      } else {
        setDictionarySearch(word);
      }
    }
    
    // Note: We always set a search term above, so dictionary will always search for the word
    // This works for both known and unknown words
  };

  // Helper to strip markdown/numbering artifacts
  const cleanText = (line = '') => {
    return line
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/^\s*[-•]\s*/g, '')
      .replace(/^\s*\d+\.\s*/g, '')
      .trim();
  };


  const renderTextWithHighlighting = (text, vocabWords, transliterationText, style = {}, isTransliteration = false, preserveFontWeight = false, outerOnPress = null) => {
  // Coerce inputs to readable strings using normalizeText to avoid '[object Object]' rendering
  const safeText = normalizeText(text);
  if (!safeText) return <SafeText style={style}></SafeText>;
  text = safeText;
  // Transliteration may be undefined; normalize to empty string
  transliterationText = transliterationText ? normalizeText(transliterationText) : '';
    
    // Helper to pick a reasonable word from a segment for dictionary lookup
    const getClickableWord = (segment, isTranslit) => {
      if (!segment || typeof segment !== 'string') return '';
      if (isTranslit) {
        const m = segment.match(/[a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ']{2,}/i);
        return m ? m[0] : segment.trim().split(/\s+/)[0] || '';
      }
      // Kannada script match
      const kannadaMatch = segment.match(/[\u0C80-\u0CFF]+/);
      if (kannadaMatch) return kannadaMatch[0];
      // Fallback to first word
      return segment.trim().split(/\s+/)[0] || '';
    };

    // Create maps for both Kannada and transliteration matching
    const kannadaWordMap = {};
    const transliterationWordMap = {};
    
    if (vocabWords && vocabWords.length > 0) {
      vocabWords.forEach(word => {
        if (word.kannada) {
          // Split by " /" to handle multiple translations (e.g., "ಸುಂದರ / ಅಂದವಾದ")
          const kannadaVariants = word.kannada.split(' /').map(w => w.trim()).filter(w => w);
          kannadaVariants.forEach(variant => {
            kannadaWordMap[variant] = word.mastery_level || 'new';
          });
        }
        if (word.transliteration) {
          // Split transliteration by " /" as well
          const translitVariants = word.transliteration.split(' /').map(w => w.trim()).filter(w => w);
          translitVariants.forEach(variant => {
            transliterationWordMap[variant.toLowerCase()] = {
              mastery: word.mastery_level || 'new',
              kannada: word.kannada,
            };
          });
        }
      });
    }

    // Find all word positions in the text
    const wordPositions = [];
    
    if (isTransliteration) {
      // For transliteration, match against transliteration strings
      Object.keys(transliterationWordMap).forEach(transWord => {
        const lowerText = text.toLowerCase();
        const lowerTransWord = transWord.toLowerCase();
        let startIndex = 0;
        while (true) {
          const index = lowerText.indexOf(lowerTransWord, startIndex);
          if (index === -1) break;
          // Check word boundaries
          const before = index > 0 ? text[index - 1] : ' ';
          const after = index + lowerTransWord.length < text.length ? text[index + lowerTransWord.length] : ' ';
          if (/[\s,.;:!?]/.test(before) && /[\s,.;:!?]/.test(after)) {
            wordPositions.push({
              start: index,
              end: index + lowerTransWord.length,
              word: text.substring(index, index + lowerTransWord.length),
              mastery: transliterationWordMap[transWord].mastery,
              kannada: transliterationWordMap[transWord].kannada,
              isVocab: true,
            });
          }
          startIndex = index + 1;
        }
      });
      
      // Also make ALL transliteration words clickable (even if not in vocabWords)
      // Split by word boundaries, matching IAST transliteration words
      // Use a more robust pattern that handles IAST diacritics properly
      // Match sequences of letters (including IAST diacritics) separated by spaces/punctuation
      // Pattern: word characters (ASCII + IAST) followed by optional apostrophes, bounded by non-word chars or start/end
      // Improved regex for transliteration words - explicitly match IAST characters and handle word boundaries
      // This regex matches words that start with a letter (including IAST diacritics) and can contain letters, diacritics, and apostrophes
      const transliterationWordRegex = /(?:^|[^a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ'])([a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ][a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ']*)(?=[^a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ']|$)/g;
      let match;
      while ((match = transliterationWordRegex.exec(text)) !== null) {
        // match[1] is the captured word (without the leading boundary character)
        const word = match[1];
        // Adjust index to account for the non-capturing group at the start
        const start = match.index + (match[0].length - word.length);
        const end = start + word.length;
        
        // Check if this word is already in wordPositions
        const alreadyAdded = wordPositions.some(pos => 
          pos.start === start && pos.end === end
        );
        
        if (!alreadyAdded) {
          // Filter out words that are clearly not Kannada transliterations
          // If a word contains only ASCII letters (no diacritics) and is short, it might be a false match
          // But we still want to allow it to be clickable for dictionary search
          const hasIASTDiacritics = /[āēīōūṛṝḷḹṃṁṇṭḍṣśḥ]/.test(word);
          const isShortASCII = word.length <= 4 && !hasIASTDiacritics && /^[a-z]+$/i.test(word);
          
          // Skip very short ASCII-only words that are likely false matches (like "strada" from "śāstrada")
          // But allow longer words or words with diacritics
          if (isShortASCII && word.length < 4) {
            // Skip very short ASCII-only words
            continue;
          }
          
          // Try to find root word by removing transliteration suffixes
          let rootWord = word;
          let foundRoot = false;
          
          // Common transliteration suffixes (IAST format)
          const translitSuffixes = [
            // Plural markers
            'gaḷu', 'gaḷannu', 'gaḷige', 'gaḷinda', 'gaḷalli', 'gaḷa',
            
            // Case endings (dative/accusative)
            'kke', 'ge', 'nnu', 'nu',
            
            // Case endings (ablative/instrumental)
            'ninda', 'dinda', 'vinda', 'rinda', 'linda', 'yinda',
            'inda', 'inta',
            
            // Case endings (locative)
            'dalli', 'nalli', 'valli', 'ralli', 'lalli', 'yalli',
            'dali', 'nali', 'vali', 'rali', 'lali', 'yali',
            'lli', 'li',
            
            // Genitive/possessive
            'na', 'da', 'va', 'ra', 'la', 'ya',
            'n', 'd', 'v', 'r', 'l', 'y',
            
            // Verb endings (present)
            'ttāne', 'ttāre', 'ttade', 'ttave', 'ttīri', 'ttīr',
            'ttēne', 'ttēve', 'ttīye', 'ttīy',
            'ttā', 'tta',
            
            // Verb endings (past)
            'yitu', 'ditu', 'vitu', 'ritu', 'litu',
            
            // Verb endings (perfect/continuous)
            'āgide', 'ide', 'uttade', 'āguttade', 'iruttade',
            
            // Other endings
            'du', 'nu', 'vu', 'ru', 'lu', 'yu',
            'de', 'ne', 've', 're', 'le', 'ye',
            'di', 'ni', 'vi', 'ri', 'yi',
          ];
          
          const sortedTranslitSuffixes = [...translitSuffixes].sort((a, b) => b.length - a.length);
          
          for (const suffix of sortedTranslitSuffixes) {
            if (word.toLowerCase().endsWith(suffix) && word.length > suffix.length) {
              const candidate = word.slice(0, -suffix.length);
              // Check if this root exists in vocabWords (by transliteration)
              const foundInVocab = vocabWords && vocabWords.some(w => {
                const translitVariants = (w.transliteration || '').split(' /').map(v => v.trim().toLowerCase());
                return translitVariants.some(v => {
                  const candidateLower = candidate.toLowerCase();
                  if (v === candidateLower) return true;
                  if (candidateLower.startsWith(v) && candidateLower.length >= v.length) return true;
                  if (v.startsWith(candidateLower) && v.length >= candidateLower.length) return true;
                  return false;
                });
              });
              
              if (foundInVocab) {
                rootWord = candidate;
                foundRoot = true;
                // Find the vocab word to get mastery level
                const vocabWord = vocabWords.find(w => {
                  const translitVariants = (w.transliteration || '').split(' /').map(v => v.trim().toLowerCase());
                  return translitVariants.some(v => {
                    const candidateLower = candidate.toLowerCase();
                    if (v === candidateLower) return true;
                    if (candidateLower.startsWith(v) && candidateLower.length >= v.length) return true;
                    if (v.startsWith(candidateLower) && v.length >= candidateLower.length) return true;
                    return false;
                  });
                });
                
                wordPositions.push({
                  start: start,
                  end: end,
                  word: word, // Highlight the full word
                  mastery: vocabWord?.mastery_level || null,
                  isVocab: true, // Mark as vocab so it gets colored
                  kannada: vocabWord?.kannada || null,
                  rootWord: rootWord, // Store root for dictionary search
                });
                break;
              }
            }
          }
          
          if (!foundRoot) {
            wordPositions.push({
              start: start,
              end: end,
              word: word,
              mastery: null,
              isVocab: false,
              kannada: null, // Will search by transliteration
            });
          }
        }
      }
    } else {
      // For Kannada text, match against Kannada words
      // Sort by length (longest first) to prefer longer matches over shorter substrings
      const sortedKannadaWords = Object.keys(kannadaWordMap).sort((a, b) => b.length - a.length);
      
      sortedKannadaWords.forEach(kannadaWord => {
        let startIndex = 0;
        while (true) {
          const index = text.indexOf(kannadaWord, startIndex);
          if (index === -1) break;
          
          // Check if this position is already covered by a longer word
          const alreadyCovered = wordPositions.some(pos => 
            pos.start <= index && pos.end >= index + kannadaWord.length
          );
          
          if (!alreadyCovered) {
            wordPositions.push({
              start: index,
              end: index + kannadaWord.length,
              word: kannadaWord,
              mastery: kannadaWordMap[kannadaWord],
              isVocab: true,
            });
          }
          startIndex = index + 1;
        }
      });
      
      // Also make ALL Kannada words clickable (even if not in vocabWords)
      // Split text by Kannada word boundaries (Kannada script range: U+0C80 to U+0CFF)
      const kannadaWordRegex = /[\u0C80-\u0CFF]+/g;
      let match;
      while ((match = kannadaWordRegex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const word = match[0];
        
        // Check if this word is already in wordPositions
        const alreadyAdded = wordPositions.some(pos => 
          pos.start === start && pos.end === end
        );
        
        if (!alreadyAdded) {
          // First, check if the word itself is in vocab (exact match or variant)
          // This handles cases where the word is in vocab but might have different forms
          let directVocabMatch = false;
          let vocabWord = null;
          
          if (vocabWords && vocabWords.length > 0) {
            for (const w of vocabWords) {
              const kannadaVariants = (w.kannada || '').split(' /').map(v => v.trim());
              for (const variant of kannadaVariants) {
                // Exact match
                if (variant === word) {
                  directVocabMatch = true;
                  vocabWord = w;
                  break;
                }
                // Word starts with variant or variant starts with word (for inflected forms)
                if (word.startsWith(variant) || variant.startsWith(word)) {
                  // Make sure it's a meaningful match (not just a single character)
                  if (variant.length >= 2 && word.length >= 2) {
                    directVocabMatch = true;
                    vocabWord = w;
                    break;
                  }
                }
              }
              if (directVocabMatch) break;
            }
          }
          
          if (directVocabMatch && vocabWord) {
            // Word is directly in vocab - mark it as vocab with its mastery level
            wordPositions.push({
              start: start,
              end: end,
              word: word,
              mastery: vocabWord.mastery_level || 'new',
              isVocab: true,
            });
          } else {
            // Word not directly in vocab - try to find root word by removing common suffixes
            let rootWord = word;
            let foundRoot = false;
            
      // Common Kannada suffixes - comprehensive list (same as in handleWordPress)
      // Case endings, postpositions, verb endings, plural markers, etc.
      const suffixes = [
            // Plural markers (longest first for proper matching)
            'ಗಳನ್ನು', 'ಗಳಿಗೆ', 'ಗಳಿಂದ', 'ಗಳಲ್ಲಿ', 'ಗಳು',
            'ಗಳ', 'ಗಳನ್ನು', 'ಗಳಿಗೆ', 'ಗಳಿಂದ', 'ಗಳಲ್ಲಿ',
            
            // Dative/Accusative case endings
            'ಕ್ಕೆ', 'ಗೆ', 'ಗೆ', 'ಕ್ಕೆ',
            'ನ್ನು', 'ನು', 'ನ್ನು', 'ನು',
            
            // Ablative/Instrumental case endings
            'ನಿಂದ', 'ದಿಂದ', 'ವಿಂದ', 'ರಿಂದ', 'ಲಿಂದ', 'ಯಿಂದ',
            'ಇಂದ', 'ಇಂತ',
            
            // Locative case endings
            'ದಲ್ಲಿ', 'ನಲ್ಲಿ', 'ವಲ್ಲಿ', 'ರಲ್ಲಿ', 'ಲಲ್ಲಿ', 'ಯಲ್ಲಿ',
            'ದಲಿ', 'ನಲಿ', 'ವಲಿ', 'ರಲಿ', 'ಲಲಿ', 'ಯಲಿ',
            'ಲ್ಲಿ', 'ಲಿ',
            
            // Genitive/Possessive markers
            'ನ', 'ದ', 'ವ', 'ರ', 'ಲ', 'ಯ',
            'ನಾ', 'ದಾ', 'ವಾ', 'ರಾ', 'ಲಾ', 'ಯಾ',
            
            // Verb endings (present tense)
            'ತ್ತಾನೆ', 'ತ್ತಾರೆ', 'ತ್ತದೆ', 'ತ್ತವೆ', 'ತ್ತೀರಿ', 'ತ್ತೀರ',
            'ತ್ತೇನೆ', 'ತ್ತೇವೆ', 'ತ್ತೀಯೆ', 'ತ್ತೀಯ',
            'ತ್ತಾ', 'ತ್ತ',
            
            // Verb endings (past tense)
            'ಯಿತು', 'ಯಿತು', 'ಯಿತು', 'ಯಿತು',
            'ದಿತು', 'ದಿತು', 'ದಿತು',
            'ವಿತು', 'ವಿತು',
            'ರಿತು', 'ರಿತು',
            'ಲಿತು', 'ಲಿತು',
            'ಯಿತು',
            
            // Verb endings (perfect/continuous)
            'ಆಗಿದೆ', 'ಆಗಿದೆ', 'ಆಗಿದೆ',
            'ಇದೆ', 'ಇದೆ', 'ಇದೆ',
            'ಉತ್ತದೆ', 'ಉತ್ತದೆ',
            'ಆಗುತ್ತದೆ', 'ಆಗುತ್ತದೆ',
            'ಇರುತ್ತದೆ', 'ಇರುತ್ತದೆ',
            
            // Other common endings
            'ದು', 'ನು', 'ವು', 'ರು', 'ಲು', 'ಯು',
            'ದೆ', 'ನೆ', 'ವೆ', 'ರೆ', 'ಲೆ', 'ಯೆ',
            'ದಾ', 'ನಾ', 'ವಾ', 'ರಾ', 'ಲಾ', 'ಯಾ',
            'ದಿ', 'ನಿ', 'ವಿ', 'ರಿ', 'ಲಿ', 'ಯಿ',
          ];
          
          // Try removing suffixes (longest first) and check if root exists in vocab
          const sortedSuffixes = [...suffixes].sort((a, b) => b.length - a.length);
          for (const suffix of sortedSuffixes) {
            if (word.endsWith(suffix) && word.length > suffix.length) {
              const candidate = word.slice(0, -suffix.length);
              // Check if this root exists in wordsUsed - try exact match first, then substring
              const foundInVocab = vocabWords && vocabWords.some(w => {
                const kannadaVariants = (w.kannada || '').split(' /').map(v => v.trim());
                return kannadaVariants.some(v => {
                  // Exact match
                  if (v === candidate) return true;
                  // Candidate starts with vocab word (e.g., candidate="pustaka", vocab="pustak")
                  if (candidate.startsWith(v) && candidate.length >= v.length) return true;
                  // Vocab word starts with candidate (e.g., candidate="pustak", vocab="pustaka")
                  if (v.startsWith(candidate) && v.length >= candidate.length) return true;
                  return false;
                });
              });
              
              if (foundInVocab) {
                rootWord = candidate;
                foundRoot = true;
                // Find the vocab word to get mastery level
                const vocabWord = vocabWords.find(w => {
                  const kannadaVariants = (w.kannada || '').split(' /').map(v => v.trim());
                  return kannadaVariants.some(v => {
                    if (v === candidate) return true;
                    if (candidate.startsWith(v) && candidate.length >= v.length) return true;
                    if (v.startsWith(candidate) && v.length >= candidate.length) return true;
                    return false;
                  });
                });
                
                wordPositions.push({
                  start: start,
                  end: end,
                  word: word, // Highlight the full word
                  mastery: vocabWord?.mastery_level || null,
                  isVocab: true, // Mark as vocab so it gets colored
                  rootWord: rootWord, // Store root for dictionary search
                });
                break;
              }
            }
            }
            
            if (!foundRoot) {
              // Word not found even after suffix removal - mark as unmatched
              wordPositions.push({
                start: start,
                end: end,
                word: word,
                mastery: null,
                isVocab: false,
              });
            }
          }
        }
      }
    }

    // Sort and merge overlapping positions (keep longer matches)
    wordPositions.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - a.end; // Longer first if same start
    });
    
    const merged = [];
    for (const pos of wordPositions) {
      if (merged.length === 0 || merged[merged.length - 1].end <= pos.start) {
        merged.push(pos);
      } else {
        // Overlapping - keep the longer one, or vocab word over non-vocab
        const existing = merged[merged.length - 1];
        if (pos.end - pos.start > existing.end - existing.start) {
          merged[merged.length - 1] = pos;
        } else if (pos.isVocab && !existing.isVocab && pos.end - pos.start === existing.end - existing.start) {
          // Prefer vocab word if same length
          merged[merged.length - 1] = pos;
        }
      }
    }

    // Build text components
    const parts = [];
    let lastIndex = 0;

    merged.forEach((pos, index) => {
      if (lastIndex < pos.start) {
        const segment = text.substring(lastIndex, pos.start);
        if (isTransliteration) {
          // Use transliteration regex to split into words and non-words
          const regex = /(?:^|[^a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ'])([a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ][a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ']*)(?=[^a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ']|$)/g;
          let last = 0;
          let m;
          let tokIdx = 0;
          while ((m = regex.exec(segment)) !== null) {
            const tokStart = m.index + (m[0].length - m[1].length);
            const tokEnd = tokStart + m[1].length;
            if (tokStart > last) {
              parts.push(<SafeText key={`text-${index}-seg-${tokIdx++}`}>{segment.slice(last, tokStart)}</SafeText>);
            }
            const token = segment.slice(tokStart, tokEnd);
            parts.push(
              <SafeText
                key={`text-${index}-tok-${tokIdx++}`}
                style={{ color: style && style.color ? style.color : undefined }}
                onPress={() => {
                  try { if (outerOnPress) outerOnPress(); } catch (e) {}
                  handleWordPress(token);
                }}
              >
                {token}
              </SafeText>
            );
            last = tokEnd;
          }
          if (last < segment.length) parts.push(<SafeText key={`text-${index}-seg-${tokIdx++}`}>{segment.slice(last)}</SafeText>);
        } else {
          // Kannada / native script tokenization
          const kannadaRegex = /[\u0C80-\u0CFF]+/g;
          let last = 0;
          let m;
          let tokIdx = 0;
          while ((m = kannadaRegex.exec(segment)) !== null) {
            const s = m.index;
            const e = s + m[0].length;
            if (s > last) parts.push(<SafeText key={`text-${index}-seg-${tokIdx++}`}>{segment.slice(last, s)}</SafeText>);
            const wordTok = segment.slice(s, e);
            parts.push(
              <SafeText
                key={`text-${index}-word-${tokIdx++}`}
                onPress={() => {
                  try { if (outerOnPress) outerOnPress(); } catch (e) {}
                  handleWordPress(wordTok);
                }}
              >
                {wordTok}
              </SafeText>
            );
            last = e;
          }
          if (last < segment.length) parts.push(<SafeText key={`text-${index}-seg-${tokIdx++}`}>{segment.slice(last)}</SafeText>);
        }
      }
      
      const isLearning = pos.mastery === 'learning';
      const isReview = pos.mastery === 'review';
      const isMastered = pos.mastery === 'mastered';
      const isNew = pos.mastery === 'new' || (pos.isVocab && !isMastered && !isLearning && !isReview);
      // Use text color for highlighting:
      // - Light gray (#888888) for unmatched words (not in vocab) - only when highlighting enabled
      // - Black (#000000) for matched "new" words (in vocab but mastery level is "new")
      // - Green (#006400) for mastered words (if highlighting enabled)
      // - Blue (#00008B) for learning words, orange (#FF9500) for review words (if highlighting enabled)
      // - When highlighting is off, all words are black
      let textColor = undefined;
      if (highlightVocab) {
        if (!pos.isVocab) {
          // Unmatched word (not in vocabulary) - show in light gray
          textColor = '#888888'; // Light gray
        } else if (isNew) {
          // Matched "new" word (in vocab but mastery level is "new") - show in black
          textColor = '#000000'; // Black
        } else if (isMastered) {
          // Mastered word - show in green
          textColor = '#006400'; // Green
        } else if (isLearning) {
          // Learning word - show in blue
          textColor = '#00008B'; // Blue
        } else if (isReview) {
          // Review word - show in orange
          textColor = '#FF9500'; // Orange
        } else {
          // Fallback: matched word with unknown mastery level - show in black
          textColor = '#000000'; // Black
        }
      } else {
        // When highlighting is off, use base style color if provided, otherwise black
        // Check if base style has a color defined (handle both object and array styles)
        let baseColor = null;
        if (Array.isArray(style)) {
          for (const s of style) {
            if (s && s.color) {
              baseColor = s.color;
              break;
            }
          }
        } else if (style && style.color) {
          baseColor = style.color;
        }
        textColor = baseColor || '#000000'; // Use base style color or default to black
      }
      
      const wordText = text.substring(pos.start, pos.end);
      // Store the actual clicked word text and position info for dictionary search
      // We'll let handleWordPress determine the best search term based on the actual word
      // This avoids issues with incorrect root words or mismatched Kannada/transliteration mappings
      
      parts.push(
        <SafeText
          key={`word-${index}`}
          style={{
            color: textColor,
            fontWeight: preserveFontWeight ? (style.fontWeight || 'normal') : 'normal', // Preserve fontWeight if requested
          }}
          onPress={() => {
            try { handleWordPress(wordText); } catch (e) { console.error('Error in handleWordPress from renderTextWithHighlighting:', e); }
            // Also trigger outer onPress (e.g., to ensure transliteration for the whole line)
            if (typeof outerOnPress === 'function') {
              try { outerOnPress(); } catch (e) { console.error('Error calling outerOnPress from renderTextWithHighlighting:', e); }
            }
          }}
        >
          {wordText}
        </SafeText>
      );
      lastIndex = pos.end;
    });

    if (lastIndex < text.length) {
      const segment = text.substring(lastIndex);
      if (isTransliteration) {
        const regex = /(?:^|[^a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ'])([a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ][a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ']*)(?=[^a-zA-Zāēīōūṛṝḷḹṃṁṇṭḍṣśḥ']|$)/g;
        let last = 0;
        let m;
        let tokIdx = 0;
        while ((m = regex.exec(segment)) !== null) {
          const tokStart = m.index + (m[0].length - m[1].length);
          const tokEnd = tokStart + m[1].length;
    if (tokStart > last) parts.push(<SafeText key={`text-end-seg-${tokIdx++}`}>{segment.slice(last, tokStart)}</SafeText>);
          const token = segment.slice(tokStart, tokEnd);
          parts.push(
            <SafeText
              key={`text-end-tok-${tokIdx++}`}
              style={{ color: style && style.color ? style.color : undefined }}
              onPress={() => {
                try { if (outerOnPress) outerOnPress(); } catch (e) {}
                handleWordPress(token);
              }}
            >
              {token}
            </SafeText>
          );
          last = tokEnd;
        }
        if (last < segment.length) parts.push(
          <SafeText
            key={`text-end-seg-${tokIdx++}`}
            onPress={() => {
              try { if (outerOnPress) outerOnPress(); } catch (e) {}
              try { handleWordPress(getClickableWord(segment.slice(last), true)); } catch (e) {}
            }}
          >
            {segment.slice(last)}
          </SafeText>
        );
      } else {
        const kannadaRegex = /[\u0C80-\u0CFF]+/g;
        let last = 0;
        let m;
        let tokIdx = 0;
        while ((m = kannadaRegex.exec(segment)) !== null) {
          const s = m.index;
          const e = s + m[0].length;
    if (s > last) parts.push(<SafeText key={`text-end-seg-${tokIdx++}`}>{segment.slice(last, s)}</SafeText>);
          const wordTok = segment.slice(s, e);
          parts.push(
            <SafeText
              key={`text-end-word-${tokIdx++}`}
              onPress={() => {
                try { if (outerOnPress) outerOnPress(); } catch (e) {}
                handleWordPress(wordTok);
              }}
            >
              {wordTok}
            </SafeText>
          );
          last = e;
        }
        if (last < segment.length) parts.push(
          <SafeText
            key={`text-end-seg-${tokIdx++}`}
            onPress={() => {
              try { if (outerOnPress) outerOnPress(); } catch (e) {}
              try { handleWordPress(getClickableWord(segment.slice(last), false)); } catch (e) {}
            }}
          >
            {segment.slice(last)}
          </SafeText>
        );
      }
    }

  return <SafeText style={style} selectable onPress={outerOnPress}>{parts}</SafeText>;
  };

  const renderTextWithBoldWords = (text, vocabWords, style = {}) => {
    if (!text) {
      return <Text style={style}></Text>;
    }
    
    if (!vocabWords || vocabWords.length === 0) {
      return <Text style={style}>{text}</Text>;
    }
    
    // Get Kannada translations of vocabulary words
    const kannadaWords = vocabWords
      .map(w => w.kannada)
      .filter(w => w && w.trim())
      .sort((a, b) => b.length - a.length); // Sort by length to match longer words first
    
    const wordPositions = [];
    
    kannadaWords.forEach(kannadaWord => {
      // Escape special regex characters
      const escaped = kannadaWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      let match;
      while ((match = regex.exec(text)) !== null) {
        wordPositions.push({
          start: match.index,
          end: match.index + match[0].length,
          word: match[0],
        });
      }
    });
    
    // Sort positions and merge overlapping
    wordPositions.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const pos of wordPositions) {
      if (merged.length === 0 || merged[merged.length - 1].end < pos.start) {
        merged.push(pos);
      } else {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, pos.end);
      }
    }
    
    // Build text components - all nested inside a single Text component
    const parts = [];
    let lastIndex = 0;
    
    merged.forEach((pos, index) => {
      if (lastIndex < pos.start) {
        parts.push(text.substring(lastIndex, pos.start));
      }
      parts.push(
        <Text key={`bold-${index}`} style={{ fontWeight: 'bold' }}>
          {text.substring(pos.start, pos.end)}
        </Text>
      );
      lastIndex = pos.end;
    });
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return <Text style={style}>{parts}</Text>;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
  <SafeText style={styles.loadingText}>{loadingStatus}</SafeText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <SafeText style={styles.headerTitle}>
          {activityType.charAt(0).toUpperCase() + activityType.slice(1)}
        </SafeText>
        <View style={styles.headerRight}>
          {/* Show tools for reading, listening, writing, and conversation activities */}
          {(activityType === 'reading' || activityType === 'listening' || activityType === 'writing' || activityType === 'speaking' || activityType === 'conversation') && (
            <>
              <TouchableOpacity
                style={[
                  styles.headerIconButton,
                  showTransliterations && styles.headerIconButtonActive
                ]}
                onPress={() => setShowTransliterations(!showTransliterations)}
              >
                <Ionicons 
                  name={showTransliterations ? "text" : "text-outline"} 
                  size={20} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              {/* Highlight Vocab Toggle */}
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  highlightVocab && styles.toggleButtonActive
                ]}
                onPress={() => setHighlightVocab(!highlightVocab)}
              >
                <Ionicons 
                  name={highlightVocab ? "color-palette" : "color-palette-outline"} 
                  size={20} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
              {/* Dictionary Button */}
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => setShowDictionary(true)}
              >
                <Ionicons name="book" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}
          {/* Debug Button - always visible */}
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => setShowApiModal(true)}
          >
            <Ionicons name="bug" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Validation Error Toast */}
      {validationError && (
        <View style={styles.validationToast}>
          <Ionicons name="alert-circle" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <View>
              {renderTextWithHighlighting(
                validationError || '',
                [], // Empty words array to prevent vocabulary highlighting
                null, // Don't pass transliteration to renderTextWithHighlighting, show it separately
                [styles.validationToastText, { color: '#FFFFFF' }],
                false,
                false
              )}
              {showTransliterations && validationErrorTranslit && (
                <>
                  <Text style={{ height: 6 }} />
                  {renderTextWithHighlighting(
                    validationErrorTranslit,
                    [],
                    null,
                    [styles.transliterationText, { color: '#FFFFFF', fontSize: 12, opacity: 0.9 }],
                    true,
                    false,
                    () => handleWordClick(validationErrorTranslit)
                  )}
                </>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              setValidationError(null);
              setValidationErrorTranslit(null);
            }}
            style={styles.validationToastClose}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activityType === 'reading' && activity && (
          <View>
            {activity.story_name && (
              <View style={styles.storyTitleContainer}>
                <View style={styles.storyTitleWrapper}>
                  {renderTextWithHighlighting(
                    (language === 'urdu' && nativeScriptRenderings.storyName) ? nativeScriptRenderings.storyName : activity.story_name,
                    wordsUsed,
                    transliterations.storyName,
                    styles.storyTitle,
                    language === 'urdu' ? true : false, // treat as transliteration-like for Urdu display
                    true,
                    () => {
                      ensureAndShowTransliterationForKey('storyName', activity.story_name);
                      if (language === 'urdu') ensureNativeScriptForKey('storyName', activity.story_name);
                    }
                  )}
                </View>
                {showTransliterations && transliterations.storyName && (
                  <View style={styles.storyTitleTransliterationWrapper}>
                    {renderTextWithHighlighting(
                      transliterations.storyName,
                      wordsUsed,
                      null,
                      styles.storyTitleTransliteration,
                      true, // isTransliteration = true for transliteration
                      false // preserveFontWeight = false for transliteration (it's italic, not bold)
                    )}
                  </View>
                )}
              </View>
            )}
            <View style={styles.textBox}>
              {(() => {
                // Split story into paragraphs
                // Coerce to string at render time to guard against unsanitized state
                const rawStory = activity.story;
                if (NORMALIZE_DEBUG && rawStory && typeof rawStory !== 'string') {
                  try {
                    console.warn('[render] activity.story type', typeof rawStory, Array.isArray(rawStory) ? `array(len=${rawStory.length})` : 'object', typeof rawStory === 'object' ? (rawStory && rawStory.text ? 'has.text' : '') : '');
                  } catch (e) {}
                }
                const storyStr = normalizeText(rawStory);
                // First try splitting by double newlines (paragraph breaks)
                // If that doesn't work, split by single newlines
                // If no newlines, treat as single paragraph
                let storyParagraphs = [];
                if (storyStr) {
                  const doubleNewlineSplit = storyStr.split(/\n\s*\n/).filter(p => p.trim());
                  if (doubleNewlineSplit.length > 1) {
                    storyParagraphs = doubleNewlineSplit;
                  } else {
                    // Try single newlines
                    const singleNewlineSplit = storyStr.split(/\n/).filter(p => p.trim());
                    if (singleNewlineSplit.length > 1) {
                      storyParagraphs = singleNewlineSplit;
                    } else {
                      // Single paragraph
                      storyParagraphs = [storyStr];
                    }
                  }
                }
                
                // If language is Urdu and we have a native-script (Arabic) rendering for the story,
                // prefer that for on-screen display (Nastaliq). The transliteration pane will
                // continue to show the Roman transliteration (IAST) stored in `transliterations.story`.
                let displayStoryStr = storyStr;
                if (language === 'urdu' && nativeScriptRenderings && nativeScriptRenderings.story) {
                  displayStoryStr = normalizeText(nativeScriptRenderings.story);
                }

                // Split transliteration into paragraphs (same logic)
                let translitParagraphs = [];
                if (showTransliterations) {
                  const translitStr = normalizeField('transliterations.story', transliterations.story);
                  const doubleNewlineSplit = translitStr.split(/\n\s*\n/).filter(p => p.trim());
                  if (doubleNewlineSplit.length > 1) {
                    translitParagraphs = doubleNewlineSplit;
                  } else {
                    const singleNewlineSplit = translitStr.split(/\n/).filter(p => p.trim());
                    if (singleNewlineSplit.length > 1) {
                      translitParagraphs = singleNewlineSplit;
                    } else {
                      translitParagraphs = [translitStr];
                    }
                  }
                }
                
                // Render paragraphs interleaved: paragraph 1, transliteration 1, paragraph 2, transliteration 2, etc.
                const elements = [];
                const displayParagraphs = (displayStoryStr ? (() => {
                  const doubleNewlineSplit = displayStoryStr.split(/\n\s*\n/).filter(p => p.trim());
                  if (doubleNewlineSplit.length > 1) return doubleNewlineSplit;
                  const singleNewlineSplit = displayStoryStr.split(/\n/).filter(p => p.trim());
                  return singleNewlineSplit.length > 1 ? singleNewlineSplit : [displayStoryStr];
                })() : []);

                try {
                  console.log('[reading render] displayParagraphs=', displayParagraphs.length, 'translitParagraphs=', translitParagraphs.length,
                    'displayPreview=', (displayParagraphs[0]||'').substring(0,120).replace(/\n/g,'\\n'),
                    'translitPreview=', (translitParagraphs[0]||'').substring(0,120).replace(/\n/g,'\\n'));
                } catch (e) {}

                for (let i = 0; i < displayParagraphs.length; i++) {
                  // Add paragraph (source or Arabic native rendering for Urdu)
                  elements.push(
                    <View key={`story-para-${i}`}>
                      {renderTextWithHighlighting(
                        displayParagraphs[i].trim(),
                        wordsUsed,
                        i < translitParagraphs.length ? translitParagraphs[i].trim() : null,
                        styles.targetText,
                        false
                      )}
                    </View>
                  );
                  
                  // Add transliteration paragraph if available and enabled
                  if (showTransliterations && i < translitParagraphs.length && translitParagraphs[i].trim()) {
                    // Add margin bottom except for the last paragraph
                    const isLastParagraph = i === displayParagraphs.length - 1;
                    elements.push(
                      <View key={`translit-para-${i}`} style={{ marginTop: 4, marginBottom: isLastParagraph ? 0 : 16 }}>
                        {renderTextWithHighlighting(
                          translitParagraphs[i].trim(),
                          wordsUsed,
                          null,
                          styles.transliterationText,
                          true
                        )}
                      </View>
                    );
                  }
                }
                
                return elements;
              })()}
            </View>

            {activity.questions && activity.questions.length > 0 && (
              <View style={styles.questionsContainer}>
                <View style={styles.questionsHeader}>
                  <View>
                    {renderTextWithHighlighting(
                      getQuestionLabel(language),
                      wordsUsed,
                      transliterations.questionsTitle,
                      [styles.questionTitle, styles.boldText],
                      false,
                      true,
                      () => ensureAndShowTransliterationForKey('questionsTitle', getQuestionLabel(language))
                    )}
                    {(transliterations.questionsTitle) && (
                          renderTextWithHighlighting(
                            transliterations.questionsTitle,
                            wordsUsed,
                            null,
                            styles.transliterationText,
                            true,
                            false,
                            () => handleWordClick(transliterations.questionsTitle)
                          )
                        )}
                  </View>
                  {(showResult || (route?.params?.fromHistory && activity)) && (
                    <TouchableOpacity
                      style={styles.showAnswersToggle}
                      onPress={() => {
                        setShowAnswers(!showAnswers);
                        // Don't set showResult to true when toggling - allow user to answer questions first
                      }}
                    >
                      <Ionicons 
                        name={showAnswers ? "eye" : "eye-off"} 
                        size={20} 
                        color={colors.primary} 
                      />
                      <Text style={[styles.showAnswersText, { color: colors.primary }]}>
                        {showAnswers ? 'Hide Answers' : 'Show Answers'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {activity.questions.map((q, qIndex) => (
                  <View key={qIndex} style={styles.questionItem}>
                    <View style={styles.questionBox}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            <Text style={styles.questionText}>
                              {qIndex + 1}.{' '}
                            </Text>
                            {renderTextWithHighlighting(
                              q.question,
                              wordsUsed,
                              transliterations[`question_${qIndex}`],
                              styles.questionText,
                              false,
                              false,
                              () => ensureAndShowTransliterationForKey(`question_${qIndex}`, q.question)
                            )}
                      </View>
                      {showTransliterations && transliterations[`question_${qIndex}`] && (
                        renderTextWithHighlighting(
                          transliterations[`question_${qIndex}`],
                          wordsUsed,
                          null,
                          styles.transliterationText,
                          true
                        )
                      )}
                    </View>
                    {q.options.map((option, oIndex) => {
                      const isSelected = selectedOptions[qIndex] === `${qIndex}-${oIndex}`;
                      const shouldShowAnswers = (showResult && showAnswers) || (route?.params?.fromHistory && showAnswers);
                      return (
                        <TouchableOpacity
                        key={oIndex}
                        style={[
                          styles.optionButton,
                          isSelected && [styles.optionButtonSelected, { borderColor: colors.primary }],
                          shouldShowAnswers &&
                            oIndex === q.correct &&
                            [styles.optionButtonCorrect, { borderColor: colors.primary }],
                          shouldShowAnswers &&
                            isSelected &&
                            oIndex !== q.correct &&
                            styles.optionButtonIncorrect,
                        ]}
                        onPress={() => !showResult && setSelectedOptions({ ...selectedOptions, [qIndex]: `${qIndex}-${oIndex}` })}
                        disabled={showResult}
                      >
                        <View style={styles.optionContent}>
                          {renderTextWithHighlighting(
                            option,
                            wordsUsed,
                            transliterations[`option_${qIndex}_${oIndex}`],
                            styles.optionText,
                            false,
                            false,
                            () => ensureAndShowTransliterationForKey(`option_${qIndex}_${oIndex}`, option)
                          )}
                          {showTransliterations && transliterations[`option_${qIndex}_${oIndex}`] && (
                            renderTextWithHighlighting(
                              transliterations[`option_${qIndex}_${oIndex}`],
                              wordsUsed,
                              null,
                              styles.transliterationText,
                              true
                            )
                          )}
                        </View>
                        {shouldShowAnswers && oIndex === q.correct && (
                          <Ionicons name="checkmark-circle" size={24} color="#50C878" />
                        )}
                        {shouldShowAnswers && isSelected && oIndex !== q.correct && (
                          <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                        )}
                      </TouchableOpacity>
                      )
                    })}
                  </View>
                ))}
              </View>
            )}

            {!showResult && (
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 20, marginBottom: 20 }]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>{getSubmitLabel(language)}</Text>
              </TouchableOpacity>
            )}
            
            {showResult && (
              <View style={[styles.resultBox, { backgroundColor: colors.light, marginTop: 20, marginBottom: 20 }]}>
                <View>
                  {renderTextWithHighlighting(
                    'ನಿಮ್ಮ ಸ್ಕೋರ್',
                    wordsUsed,
                    transliterations.score_title,
                    [styles.resultTitle, { color: colors.primary }],
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.score_title && (
                  renderTextWithHighlighting(
                    transliterations.score_title,
                    wordsUsed,
                    null,
                    [styles.transliterationText, { marginTop: 4, fontSize: 12, marginBottom: 8 }],
                    true,
                    false,
                    () => handleWordClick(transliterations.score_title)
                  )
                )}
                <Text style={styles.scoreText}>{(score * 100).toFixed(0)}%</Text>
                <View>
                  {renderTextWithHighlighting(
                    activity.questions ? `${activity.questions.filter((q, idx) => {
                      const selectedValue = selectedOptions[idx];
                      if (selectedValue) {
                        const selectedIndex = parseInt(selectedValue.split('-')[1] || '-1');
                        return selectedIndex === q.correct;
                      }
                      return false;
                    }).length} / ${activity.questions.length} ಸರಿಯಾದ ಉತ್ತರಗಳು` : '',
                    wordsUsed,
                    transliterations.score_subtext,
                    styles.scoreSubtext,
                    false,
                    false
                  )}
                </View>
                {showTransliterations && transliterations.score_subtext && (
                  renderTextWithHighlighting(
                    transliterations.score_subtext,
                    wordsUsed,
                    null,
                    [styles.transliterationText, { marginTop: 4, fontSize: 12 }],
                    true,
                    false,
                    () => handleWordClick(transliterations.score_subtext)
                  )
                )}
              </View>
            )}
          </View>
        )}

        {activityType === 'listening' && activity && (
          <View>
            {activity.passage_name && (
              <View style={styles.storyTitleContainer}>
                <View style={styles.storyTitleWrapper}>
                  {renderTextWithHighlighting(
                    normalizeField('passage_name', activity.passage_name),
                    wordsUsed,
                    transliterations.passageName,
                    styles.storyTitle,
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.passageName && (
                  <View style={styles.storyTitleTransliterationWrapper}>
                    {renderTextWithHighlighting(
                      normalizeText(transliterations.passageName),
                      wordsUsed,
                      null,
                      styles.storyTitleTransliteration,
                      true,
                      false
                    )}
                  </View>
                )}
              </View>
            )}
            
            {/* Speaker Profile for Listening - Collapsible like conversation activity */}
            {activity._speaker_profile && (
              <View style={[styles.textBox, { backgroundColor: '#F5F5F5', marginBottom: 16 }]}>
                <TouchableOpacity
                  onPress={() => setSpeakerProfileExpanded(!speakerProfileExpanded)}
                  style={styles.taskHeader}
                >
                  <View style={{ flex: 1 }}>
                    <View>
                      {renderTextWithHighlighting(
                        'ಮಾತನಾಡುವವರ ವಿವರ',
                        wordsUsed,
                        null,
                        { ...styles.sectionTitle, marginBottom: 0, fontWeight: 'bold' },
                        false,
                        true
                      )}
                    </View>
                    {showTransliterations && transliterations.speaker_profile_title && (
                      <Text 
                        style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                        onPress={() => handleWordClick(transliterations.speaker_profile_title)}
                      >
                        {transliterations.speaker_profile_title}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={speakerProfileExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.primary}
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
                {speakerProfileExpanded && (
                  <View style={{ marginTop: 12 }}>
                    <View style={styles.taskItem}>
                      <View style={styles.taskText}>
                        <Text style={styles.taskTextContent}>
                          <Text style={{ fontWeight: 'bold' }}>ಹೆಸರು</Text>
                          {showTransliterations && transliterations.speaker_name_label && (
                            <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                              {' '}{transliterations.speaker_name_label}
                            </Text>
                          )}
                          <Text>: </Text>
                          {renderTextWithHighlighting(
                            activity._speaker_profile.name,
                            wordsUsed,
                            null,
                            {},
                            false,
                            false
                          )}
                        </Text>
                        {showTransliterations && transliterations.speaker_name && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.speaker_name)}
                          >
                            {transliterations.speaker_name}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.taskItem}>
                      <View style={styles.taskText}>
                        <Text style={styles.taskTextContent}>
                          <Text style={{ fontWeight: 'bold' }}>ಲಿಂಗ</Text>
                          {showTransliterations && transliterations.speaker_gender_label && (
                            <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                              {' '}{transliterations.speaker_gender_label}
                            </Text>
                          )}
                          <Text>: </Text>
                          {renderTextWithHighlighting(
                            activity._speaker_profile.gender,
                            wordsUsed,
                            null,
                            {},
                            false,
                            false
                          )}
                        </Text>
                        {showTransliterations && transliterations.speaker_gender && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.speaker_gender)}
                          >
                            {transliterations.speaker_gender}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.taskItem}>
                      <View style={styles.taskText}>
                        <Text style={styles.taskTextContent}>
                          <Text style={{ fontWeight: 'bold' }}>ವಯಸ್ಸು</Text>
                          {showTransliterations && transliterations.speaker_age_label && (
                            <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                              {' '}{transliterations.speaker_age_label}
                            </Text>
                          )}
                          <Text>: </Text>
                          {renderTextWithHighlighting(
                            activity._speaker_profile.age,
                            wordsUsed,
                            null,
                            {},
                            false,
                            false
                          )}
                        </Text>
                        {showTransliterations && transliterations.speaker_age && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.speaker_age)}
                          >
                            {transliterations.speaker_age}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.taskItem}>
                      <View style={styles.taskText}>
                        <Text style={styles.taskTextContent}>
                          <Text style={{ fontWeight: 'bold' }}>ನಗರ</Text>
                          {showTransliterations && transliterations.speaker_city_label && (
                            <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                              {' '}{transliterations.speaker_city_label}
                            </Text>
                          )}
                          <Text>: </Text>
                          {renderTextWithHighlighting(
                            activity._speaker_profile.city,
                            wordsUsed,
                            null,
                            {},
                            false,
                            false
                          )}
                        </Text>
                        {showTransliterations && transliterations.speaker_city && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.speaker_city)}
                          >
                            {transliterations.speaker_city}
                          </Text>
                        )}
                      </View>
                    </View>
                    {activity._speaker_profile.state && (
                      <View style={styles.taskItem}>
                        <View style={styles.taskText}>
                          <Text style={styles.taskTextContent}>
                            <Text style={{ fontWeight: 'bold' }}>ರಾಜ್ಯ</Text>
                            {showTransliterations && transliterations.speaker_state_label && (
                              <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                {' '}{transliterations.speaker_state_label}
                              </Text>
                            )}
                            <Text>: </Text>
                            {renderTextWithHighlighting(
                              activity._speaker_profile.state,
                              wordsUsed,
                              null,
                              {},
                              false,
                              false
                            )}
                          </Text>
                          {showTransliterations && transliterations.speaker_state && (
                            <Text 
                              style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                              onPress={() => handleWordClick(transliterations.speaker_state)}
                            >
                              {transliterations.speaker_state}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                    <View style={styles.taskItem}>
                      <View style={styles.taskText}>
                        <Text style={styles.taskTextContent}>
                          <Text style={{ fontWeight: 'bold' }}>ದೇಶ</Text>
                          {showTransliterations && transliterations.speaker_country_label && (
                            <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                              {' '}{transliterations.speaker_country_label}
                            </Text>
                          )}
                          <Text>: </Text>
                          {renderTextWithHighlighting(
                            activity._speaker_profile.country,
                            wordsUsed,
                            null,
                            {},
                            false,
                            false
                          )}
                        </Text>
                        {showTransliterations && transliterations.speaker_country && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.speaker_country)}
                          >
                            {transliterations.speaker_country}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.taskItem}>
                      <View style={styles.taskText}>
                        <Text style={styles.taskTextContent}>
                          <Text style={{ fontWeight: 'bold' }}>ಉಪಭಾಷೆ</Text>
                          {showTransliterations && transliterations.speaker_dialect_label && (
                            <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                              {' '}{transliterations.speaker_dialect_label}
                            </Text>
                          )}
                          <Text>: </Text>
                          {renderTextWithHighlighting(
                            activity._speaker_profile.dialect,
                            wordsUsed,
                            null,
                            {},
                            false,
                            false
                          )}
                        </Text>
                        {showTransliterations && transliterations.speaker_dialect && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.speaker_dialect)}
                          >
                            {transliterations.speaker_dialect}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.taskItem}>
                      <View style={styles.taskText}>
                        <Text style={styles.taskTextContent}>
                          <Text style={{ fontWeight: 'bold' }}>ಹಿನ್ನೆಲೆ</Text>
                          {showTransliterations && transliterations.speaker_background_label && (
                            <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                              {' '}{transliterations.speaker_background_label}
                            </Text>
                          )}
                          <Text>: </Text>
                          {renderTextWithHighlighting(
                            activity._speaker_profile.background,
                            wordsUsed,
                            null,
                            {},
                            false,
                            false
                          )}
                        </Text>
                        {showTransliterations && transliterations.speaker_background && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.speaker_background)}
                          >
                            {transliterations.speaker_background}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
            
            {/* Paragraph-based listening with TTS */}
            {(() => {
              const passageText = normalizeText(activity.passage) || '';
              const paragraphs = passageText.split('\n\n').filter(p => p.trim());
              const audioDataList = activity._audio_data || [];
              
              return (
                <View>
                  {/* Transcript Toggle */}
                  <TouchableOpacity
                    style={styles.transcriptToggle}
                    onPress={() => setShowTranscript(!showTranscript)}
                  >
                    <Ionicons 
                      name={showTranscript ? "eye" : "eye-off"} 
                      size={20} 
                      color={colors.primary} 
                    />
                    <Text style={[styles.transcriptToggleText, { color: colors.primary }]}>
                      {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
                    </Text>
                  </TouchableOpacity>
                  
                  {/* Paragraphs with audio controls */}
                  <ScrollView 
                    ref={paragraphScrollViewRef}
                    horizontal 
                    pagingEnabled 
                    showsHorizontalScrollIndicator={false}
                    onScroll={(event) => {
                      const index = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
                      if (index !== currentParagraphIndex && index >= 0 && index < paragraphs.length) {
                        setCurrentParagraphIndex(index);
                      }
                    }}
                    onMomentumScrollEnd={(event) => {
                      const index = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
                      if (index >= 0 && index < paragraphs.length) {
                        setCurrentParagraphIndex(index);
                      }
                    }}
                    scrollEventThrottle={16}
                  >
                    {paragraphs.map((para, index) => (
                      <View key={index} style={styles.listeningParagraphContainer}>
                        <View style={[styles.listeningBox, { backgroundColor: colors.light }]}>
                          {/* Paragraph Number */}
                          <View style={styles.paragraphNumberContainer}>
                            <Text style={[styles.paragraphNumber, { color: colors.primary }]}>
                              Paragraph {index + 1} of {paragraphs.length}
                            </Text>
                          </View>
                          
                          {/* Audio Player Controls */}
                          <View style={styles.audioPlayerContainer}>
                            {/* Play/Pause Button */}
                            <TouchableOpacity
                              style={[styles.audioPlayPauseButton, { backgroundColor: colors.primary }]}
                              onPress={() => {
                                if (playingParagraph === index) {
                                  pauseAudio(index);
                                } else {
                                  playAudio(index, para.trim());
                                }
                              }}
                            >
                              <Ionicons 
                                name={playingParagraph === index ? "pause" : "play"} 
                                size={24} 
                                color="#FFFFFF" 
                              />
                            </TouchableOpacity>
                            
                            {/* Seek Bar and Time Display */}
                            <View style={styles.audioSeekContainer}>
                              {/* Time Display */}
                              <View style={styles.audioTimeContainer}>
                                <Text style={styles.audioTimeText}>
                                  {formatTime(audioPosition[index] || 0)}
                                </Text>
                                <Text style={styles.audioTimeText}>
                                  {formatTime(audioDuration[index] || 0)}
                                </Text>
                              </View>
                              
                              {/* Seek Bar */}
                              <View style={styles.seekBarContainer}>
                                <TouchableOpacity
                                  style={styles.seekBarTouchable}
                                  activeOpacity={1}
                                  onLayout={(e) => {
                                    const { width } = e.nativeEvent.layout;
                                    seekBarWidthsRef.current[index] = width;
                                  }}
                                  onPress={(e) => {
                                    const seekBarWidth = seekBarWidthsRef.current[index] || Dimensions.get('window').width - 200;
                                    const duration = audioDuration[index] || 0;
                                    if (duration > 0 && e.nativeEvent) {
                                      const locationX = e.nativeEvent.locationX || 0;
                                      const seekTo = Math.max(0, Math.min((locationX / seekBarWidth) * duration, duration));
                                      seekAudio(index, seekTo);
                                    }
                                  }}
                                >
                                  <View 
                                    style={[
                                      styles.seekBarTrack, 
                                      { backgroundColor: '#E0E0E0' } // More visible gray track
                                    ]}
                                  >
                                    <View 
                                      style={[
                                        styles.seekBarProgress, 
                                        { 
                                          width: `${audioDuration[index] > 0 ? ((audioPosition[index] || 0) / audioDuration[index]) * 100 : 0}%`,
                                          backgroundColor: colors.primary
                                        }
                                      ]}
                                    />
                                    <View 
                                      style={[
                                        styles.seekBarThumb,
                                        { 
                                          left: `${audioDuration[index] > 0 ? ((audioPosition[index] || 0) / audioDuration[index]) * 100 : 0}%`,
                                          backgroundColor: colors.primary
                                        }
                                      ]}
                                    />
                                  </View>
                                </TouchableOpacity>
                              </View>
                            </View>
                            
                            {/* Replay Button */}
                            <TouchableOpacity
                              style={[styles.audioReplayButton, { borderColor: colors.primary }]}
                              onPress={() => replayAudio(index)}
                            >
                              <Ionicons 
                                name="reload" 
                                size={20} 
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                          </View>
                          
                          {/* Transcript (toggleable) */}
                          {showTranscript && (
                            <View style={styles.textBox}>
                              {renderTextWithHighlighting(
                                para.trim(),
                                wordsUsed,
                                null,
                                styles.targetText,
                                false
                              )}
                              {showTransliterations && transliterations[`passage_para_${index}`] && (
                                <View style={{ marginTop: 4 }}>
                                  {renderTextWithHighlighting(
                                    transliterations[`passage_para_${index}`],
                                    wordsUsed,
                                    null,
                                    styles.transliterationText,
                                    true
                                  )}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  
                  {/* Paragraph Indicators */}
                  <View style={styles.paragraphIndicators}>
                    {paragraphs.map((_, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          // Scroll to the specific paragraph
                          const screenWidth = Dimensions.get('window').width;
                          paragraphScrollViewRef.current?.scrollTo({
                            x: index * (screenWidth - 40),
                            animated: true,
                          });
                          setCurrentParagraphIndex(index);
                        }}
                        style={[
                          styles.paragraphIndicator,
                          { backgroundColor: currentParagraphIndex === index ? colors.primary : '#CCC' }
                        ]}
                      />
                    ))}
                  </View>
                </View>
              );
            })()}
            
            {/* Questions */}
            {activity.questions && activity.questions.length > 0 && (
              <View style={styles.questionsContainer}>
                <View style={styles.questionsHeader}>
                  <View>
                    <SafeText style={styles.questionTitle}><SafeText style={styles.boldText}>{getQuestionLabel(language)}</SafeText></SafeText>
                    {(transliterations.questionsTitle) && (
                      renderTextWithHighlighting(
                        transliterations.questionsTitle,
                        wordsUsed,
                        null,
                        styles.transliterationText,
                        true
                      )
                    )}
                  </View>
                  {(showResult || (route?.params?.fromHistory && activity)) && (
                    <TouchableOpacity
                      style={styles.showAnswersToggle}
                      onPress={() => setShowAnswers(!showAnswers)}
                    >
                      <Ionicons 
                        name={showAnswers ? "eye" : "eye-off"} 
                        size={20} 
                        color={colors.primary} 
                      />
                      <Text style={[styles.showAnswersText, { color: colors.primary }]}>
                        {showAnswers ? 'Hide Answers' : 'Show Answers'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {activity.questions.map((q, qIndex) => (
                  <View key={qIndex} style={styles.questionItem}>
                    <View style={styles.questionBox}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        <Text style={styles.questionText}>
                          {qIndex + 1}.{' '}
                        </Text>
                        {renderTextWithHighlighting(
                          q.question,
                          wordsUsed,
                          transliterations[`question_${qIndex}`],
                          styles.questionText,
                          false
                        )}
                      </View>
                      {showTransliterations && transliterations[`question_${qIndex}`] && (
                        renderTextWithHighlighting(
                          transliterations[`question_${qIndex}`],
                          wordsUsed,
                          null,
                          styles.transliterationText,
                          true
                        )
                      )}
                    </View>
                    {q.options.map((option, oIndex) => {
                      const isSelected = selectedOptions[qIndex] === `${qIndex}-${oIndex}`;
                      const shouldShowAnswers = (showResult && showAnswers) || (route?.params?.fromHistory && showAnswers);
                      return (
                        <TouchableOpacity
                          key={oIndex}
                          style={[
                            styles.optionButton,
                            isSelected && [styles.optionButtonSelected, { borderColor: colors.primary }],
                            shouldShowAnswers &&
                              oIndex === q.correct &&
                              [styles.optionButtonCorrect, { borderColor: colors.primary }],
                            shouldShowAnswers &&
                              isSelected &&
                              oIndex !== q.correct &&
                              styles.optionButtonIncorrect,
                          ]}
                          onPress={() => !showResult && setSelectedOptions({ ...selectedOptions, [qIndex]: `${qIndex}-${oIndex}` })}
                          disabled={showResult}
                        >
                          <View style={styles.optionContent}>
                            {renderTextWithHighlighting(
                              option,
                              wordsUsed,
                              transliterations[`option_${qIndex}_${oIndex}`],
                              styles.optionText,
                              false
                            )}
                            {showTransliterations && transliterations[`option_${qIndex}_${oIndex}`] && (
                              renderTextWithHighlighting(
                                transliterations[`option_${qIndex}_${oIndex}`],
                                wordsUsed,
                                null,
                                styles.transliterationText,
                                true
                              )
                            )}
                          </View>
                          {shouldShowAnswers && oIndex === q.correct && (
                            <Ionicons name="checkmark-circle" size={24} color="#50C878" />
                          )}
                          {shouldShowAnswers && isSelected && oIndex !== q.correct && (
                            <Ionicons name="close-circle" size={24} color="#FF6B6B" />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
            
            {/* Submit Button and Result Display */}
            {!showResult && (
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 20, marginBottom: 20 }]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>{getSubmitLabel(language)}</Text>
              </TouchableOpacity>
            )}
            
            {showResult && (
              <View style={[styles.resultBox, { backgroundColor: colors.light, marginTop: 20, marginBottom: 20 }]}>
                <View>
                  {renderTextWithHighlighting(
                    'ನಿಮ್ಮ ಸ್ಕೋರ್',
                    wordsUsed,
                    transliterations.score_title,
                    [styles.resultTitle, { color: colors.primary }],
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.score_title && (
                  <Text 
                    style={[styles.transliterationText, { marginTop: 4, fontSize: 12, marginBottom: 8 }]}
                    onPress={() => handleWordClick(transliterations.score_title)}
                  >
                    {transliterations.score_title}
                  </Text>
                )}
                <Text style={styles.scoreText}>{(score * 100).toFixed(0)}%</Text>
                <View>
                  {renderTextWithHighlighting(
                    activity.questions ? `${activity.questions.filter((q, idx) => {
                      const selectedValue = selectedOptions[idx];
                      if (selectedValue) {
                        const selectedIndex = parseInt(selectedValue.split('-')[1] || '-1');
                        return selectedIndex === q.correct;
                      }
                      return false;
                    }).length} / ${activity.questions.length} ಸರಿಯಾದ ಉತ್ತರಗಳು` : '',
                    wordsUsed,
                    transliterations.score_subtext,
                    styles.scoreSubtext,
                    false,
                    false
                  )}
                </View>
                {showTransliterations && transliterations.score_subtext && (
                  <Text 
                    style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                    onPress={() => handleWordClick(transliterations.score_subtext)}
                  >
                    {transliterations.score_subtext}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {activityType === 'writing' && activity && (
          <View>
            {/* Activity Name */}
            {activity.activity_name && (
              <View style={styles.storyTitleContainer}>
                <View style={styles.storyTitleWrapper}>
                  {renderTextWithHighlighting(
                    activity.activity_name,
                    wordsUsed,
                    transliterations.activity_name,
                    styles.storyTitle,
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.activity_name && (
                  <View style={styles.storyTitleTransliterationWrapper}>
                    {renderTextWithHighlighting(
                      transliterations.activity_name,
                      wordsUsed,
                      null,
                      styles.storyTitleTransliteration,
                      true,
                      false
                    )}
                  </View>
                )}
              </View>
            )}
            
            {/* Speaker Profile Section - for conversation activities that might be opened from writing */}
            {activity._speaker_profile && (
              <View style={styles.speakerProfileContainer}>
                <TouchableOpacity
                  onPress={() => setSpeakerProfileExpanded(!speakerProfileExpanded)}
                  style={styles.speakerProfileHeader}
                >
                  <Text style={styles.speakerProfileHeaderText}>Speaker Profile</Text>
                  <Ionicons
                    name={speakerProfileExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                {speakerProfileExpanded && (
                  <View style={styles.speakerProfileContent}>
                    <View style={styles.speakerProfileRow}>
                      <SafeText style={styles.speakerProfileLabel}>Name:</SafeText>
                      <SafeText style={styles.speakerProfileValue}>{normalizeText(activity._speaker_profile.name)}</SafeText>
                    </View>
                    <View style={styles.speakerProfileRow}>
                      <SafeText style={styles.speakerProfileLabel}>Gender:</SafeText>
                      <SafeText style={styles.speakerProfileValue}>{normalizeText(activity._speaker_profile.gender)}</SafeText>
                    </View>
                    <View style={styles.speakerProfileRow}>
                      <SafeText style={styles.speakerProfileLabel}>Age:</SafeText>
                      <SafeText style={styles.speakerProfileValue}>{normalizeText(activity._speaker_profile.age)}</SafeText>
                    </View>
                    <View style={styles.speakerProfileRow}>
                      <SafeText style={styles.speakerProfileLabel}>City:</SafeText>
                      <SafeText style={styles.speakerProfileValue}>{normalizeText(activity._speaker_profile.city)}</SafeText>
                    </View>
                    <View style={styles.speakerProfileRow}>
                      <SafeText style={styles.speakerProfileLabel}>Country:</SafeText>
                      <SafeText style={styles.speakerProfileValue}>{normalizeText(activity._speaker_profile.country)}</SafeText>
                    </View>
                    <View style={styles.speakerProfileRow}>
                      <SafeText style={styles.speakerProfileLabel}>Dialect:</SafeText>
                      <SafeText style={styles.speakerProfileValue}>{normalizeText(activity._speaker_profile.dialect)}</SafeText>
                    </View>
                    <View style={styles.speakerProfileRow}>
                      <SafeText style={styles.speakerProfileLabel}>Background:</SafeText>
                      <SafeText style={styles.speakerProfileValue}>{normalizeText(activity._speaker_profile.background)}</SafeText>
                    </View>
                  </View>
                )}
              </View>
            )}
            
            <View>
              {renderTextWithHighlighting(
                'ಬರವಣಿಗೆ ಅಭ್ಯಾಸ',
                wordsUsed,
                transliterations.sectionTitle_writing,
                { ...styles.sectionTitle, fontWeight: 'bold' },
                false,
                true
              )}
              {showTransliterations && transliterations.sectionTitle_writing && (
                renderTextWithHighlighting(
                  transliterations.sectionTitle_writing,
                  wordsUsed,
                  null,
                  styles.transliterationText,
                  true
                )
              )}
            </View>
            
            {/* Writing Prompt - with transliteration interspersed */}
            <View style={styles.promptBox}>
              {(() => {
                const promptText = activity.writing_prompt || activity.prompt || '';
                const translitText = transliterations.writing_prompt || transliterations.prompt;
                
                // Split into paragraphs
                let promptParagraphs = [];
                if (promptText) {
                  const doubleNewlineSplit = promptText.split(/\n\s*\n/).filter(p => p.trim());
                  if (doubleNewlineSplit.length > 1) {
                    promptParagraphs = doubleNewlineSplit;
                  } else {
                    const singleNewlineSplit = promptText.split(/\n/).filter(p => p.trim());
                    if (singleNewlineSplit.length > 1) {
                      promptParagraphs = singleNewlineSplit;
                    } else {
                      promptParagraphs = [promptText];
                    }
                  }
                }
                
                let translitParagraphs = [];
                if (showTransliterations && translitText) {
                  const doubleNewlineSplit = translitText.split(/\n\s*\n/).filter(p => p.trim());
                  if (doubleNewlineSplit.length > 1) {
                    translitParagraphs = doubleNewlineSplit;
                  } else {
                    const singleNewlineSplit = translitText.split(/\n/).filter(p => p.trim());
                    if (singleNewlineSplit.length > 1) {
                      translitParagraphs = singleNewlineSplit;
                    } else {
                      translitParagraphs = [translitText];
                    }
                  }
                }
                
                const elements = [];
                for (let i = 0; i < promptParagraphs.length; i++) {
                  elements.push(
                    <View key={`prompt-para-${i}`}>
                      {renderTextWithHighlighting(
                        (language === 'urdu' && nativeScriptRenderings[`prompt_para_${i}`]) ? nativeScriptRenderings[`prompt_para_${i}`] : promptParagraphs[i].trim(),
                        wordsUsed,
                        i < translitParagraphs.length ? translitParagraphs[i].trim() : null,
                        styles.promptText,
                        language === 'urdu',
                        false,
                        () => { if (language === 'urdu') ensureNativeScriptForKey(`prompt_para_${i}`, promptParagraphs[i].trim()); }
                      )}
                    </View>
                  );
                  
                  if (showTransliterations && i < translitParagraphs.length && translitParagraphs[i].trim()) {
                    const isLastParagraph = i === promptParagraphs.length - 1;
                    elements.push(
                      <View key={`prompt-translit-${i}`} style={{ marginTop: 4, marginBottom: isLastParagraph ? 0 : 12 }}>
                        {renderTextWithHighlighting(
                          translitParagraphs[i].trim(),
                          wordsUsed,
                          null,
                          styles.transliterationText,
                          true,
                          false
                        )}
                      </View>
                    );
                  }
                }
                
                return elements;
              })()}
            </View>
            
            {/* Required Words */}
            {activity.required_words && activity.required_words.length > 0 && (
              <View style={styles.requiredWordsBox}>
                <View>
                  {renderTextWithHighlighting(
                    'ಈ ಪದಗಳನ್ನು ಬಳಸಬೇಕು:',
                    wordsUsed,
                    transliterations.requiredWordsLabel,
                    { ...styles.requiredWordsLabel, fontWeight: 'bold' },
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.requiredWordsLabel && (
                  renderTextWithHighlighting(
                    transliterations.requiredWordsLabel,
                    wordsUsed,
                    null,
                    styles.transliterationText,
                    true
                  )
                )}
                <View style={styles.wordsList}>
                  {activity.required_words.map((word, index) => {
                  const vocabWord = wordsUsed.find(w => w.kannada === word || w.word === word);
                  const wordTranslit = transliterations[`required_word_${index}`] || vocabWord?.transliteration;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.wordTag, { backgroundColor: colors.light }]}
                        onPress={() => handleWordPress(word)}
                      >
                        {renderTextWithHighlighting(
                          vocabWord?.kannada || word,
                          wordsUsed,
                          wordTranslit,
                          [styles.wordTagText, { color: colors.primary }],
                          false,
                          false
                        )}
                        {showTransliterations && wordTranslit && (
                          <Text style={[styles.wordTagTranslit, { color: colors.primary }]}>{wordTranslit}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            
            {/* Collapsible Rubric Section */}
            <View style={[styles.rubricSection, { backgroundColor: colors.light }]}>
              <TouchableOpacity
                style={styles.rubricHeader}
                onPress={() => setRubricExpanded(!rubricExpanded)}
              >
                <View style={{ flex: 1 }}>
                  {renderTextWithHighlighting(
                    'ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು',
                    wordsUsed,
                    null, // Don't pass transliteration to renderTextWithHighlighting, show it separately
                    [styles.rubricHeaderText, { color: colors.primary, fontWeight: 'bold' }],
                    false,
                    true
                  )}
                  {showTransliterations && transliterations.rubricTitle && (
                    renderTextWithHighlighting(
                      transliterations.rubricTitle,
                      wordsUsed,
                      null,
                      [styles.transliterationText, { marginTop: 4 }],
                      true,
                      false,
                      () => handleWordClick(transliterations.rubricTitle)
                    )
                  )}
                </View>
                <Ionicons
                  name={rubricExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
              
              {rubricExpanded && (
                <View style={styles.rubricContent}>
                  {(() => {
                    // Combine general guidelines with Gemini's criteria
                    const generalGuidelines = activity._general_guidelines || [
                      "ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.",
                      "ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.",
                      "ಲೇಖನವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು."
                    ];
                    
                    // Helper to aggressively clean markdown/numbering
                    const cleanLine = (line) => {
                      if (!line) return '';
                      return line
                        .replace(/[*_`]/g, '') // remove *, _, `
                        .replace(/^\s*[-•●]\s*/g, '') // leading bullets
                        .replace(/^\s*\d+\.\s*/g, '') // leading numbered list
                        .trim();
                    };
                    
                    // Clean and split Gemini's criteria
                    let geminiCriteria = [];
                    if (activity.evaluation_criteria) {
                      let criteriaText = activity.evaluation_criteria;
                      criteriaText = criteriaText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
                      geminiCriteria = criteriaText
                        .split('\n')
                        .map(line => cleanLine(line))
                        .filter(line => line.length > 0);
                    }
                    
                    // Combine all criteria
                    const allCriteria = [...generalGuidelines.map(cleanLine), ...geminiCriteria];
                    
                    return (
                      <View style={styles.criteriaList}>
                        {allCriteria.map((line, index) => {
                          const guidelineTranslit = transliterations[`general_guideline_${index}`];
                          return (
                            <View key={index} style={styles.criteriaBulletItem}>
                              <Text style={styles.criteriaBullet}>•</Text>
                              <View style={styles.criteriaBulletText}>
                                {renderTextWithHighlighting(
                                  line,
                                  wordsUsed,
                                  guidelineTranslit,
                                  styles.criteriaText,
                                  false,
                                  false
                                )}
                                {showTransliterations && guidelineTranslit && (
                                  <View style={{ marginTop: 4 }}>
                                    {renderTextWithHighlighting(
                                      guidelineTranslit,
                                      wordsUsed,
                                      null,
                                      styles.transliterationText,
                                      true,
                                      false
                                    )}
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}
                  {showTransliterations && transliterations.evaluation_criteria && (
                    renderTextWithHighlighting(
                      transliterations.evaluation_criteria,
                      wordsUsed,
                      null,
                      styles.transliterationText,
                      true
                    )
                  )}
                </View>
              )}
            </View>
            
            {/* Text Input - Always editable for writing activities, even when viewing from history */}
            <TextInput
              style={styles.writingInput}
              placeholder="ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಇಲ್ಲಿ ಕನ್ನಡದಲ್ಲಿ ಬರೆಯಿರಿ (2-3 ಪ್ಯಾರಾಗ್ರಾಫ್‌ಗಳು)..."
              value={userAnswer}
              onChangeText={setUserAnswer}
              multiline
              numberOfLines={10}
              editable={!gradingLoading}
              placeholderTextColor="#999"
            />
            
            {/* Grading Progress */}
            {gradingLoading && (
              <View style={[styles.gradingProgressBox, { backgroundColor: colors.light }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                {renderTextWithHighlighting(
                  'ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ... ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ',
                  [],
                  null,
                  [styles.gradingProgressText, { color: colors.primary }],
                  false
                )}
              </View>
            )}
            
            {/* All Submissions History */}
            {allSubmissions.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View>
                  {renderTextWithHighlighting(
                    'ಸಲ್ಲಿಕೆಗಳು ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆಗಳು',
                    wordsUsed,
                    transliterations.submissionsTitle,
                    [{ ...styles.sectionTitle, fontWeight: 'bold' }, { marginBottom: 16 }],
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.submissionsTitle && (
                  renderTextWithHighlighting(
                    transliterations.submissionsTitle,
                    wordsUsed,
                    null,
                    [styles.transliterationText, { marginBottom: 16 }],
                    true
                  )
                )}
                {allSubmissions.map((submission, index) => {
                  const submissionResult = submission.grading_result;
                  const submissionIndex = index;
                  const isExpanded = expandedSubmissions.has(index);
                  return (
                    <View key={index} style={[styles.gradingResultBox, { backgroundColor: colors.light, marginBottom: 20 }]}>
                      <TouchableOpacity
                        style={styles.submissionHeader}
                        onPress={() => {
                          const newExpanded = new Set(expandedSubmissions);
                          if (isExpanded) {
                            newExpanded.delete(index);
                          } else {
                            newExpanded.add(index);
                          }
                          setExpandedSubmissions(newExpanded);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          {renderTextWithHighlighting(
                            `ಸಲ್ಲಿಕೆ ${index + 1}`,
                            wordsUsed,
                            transliterations[`submission_${index}_title`] || (transliterations.submissionLabel ? `${transliterations.submissionLabel} ${index + 1}` : null),
                            [styles.gradingResultTitle, { color: colors.primary }],
                            false,
                            false
                          )}
                          {showTransliterations && (transliterations[`submission_${index}_title`] || transliterations.submissionLabel) && (
                            <Text style={[styles.transliterationText, { marginTop: 4 }]}>
                              {transliterations[`submission_${index}_title`] || `${transliterations.submissionLabel} ${index + 1}`}
                            </Text>
                          )}
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={20}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      
                      {isExpanded && (
                        <>
                          {/* User's Input - Writing or Speaking */}
                          <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
                            {activityType === 'speaking' ? (
                              <>
                                {/* Audio Player (if available) */}
                                {submission.audio_uri && (() => {
                                  const audioState = submissionAudioStates[index] || { position: 0, duration: 0, playing: false };
                                  return (
                                    <View style={{ marginBottom: 12 }}>
                                      <View>
                                        {renderTextWithHighlighting(
                                          'ರೆಕಾರ್ಡಿಂಗ್:',
                                          wordsUsed,
                                          transliterations.recordingLabel,
                                          [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: '600', marginBottom: 8 }],
                                          false,
                                          false
                                        )}
                                      </View>
                                      {showTransliterations && transliterations.recordingLabel && (
                                        renderTextWithHighlighting(
                                          transliterations.recordingLabel,
                                          wordsUsed,
                                          null,
                                          styles.transliterationText,
                                          true,
                                          false,
                                          () => handleWordClick(transliterations.recordingLabel)
                                        )
                                      )}
                                      
                                      {/* Audio Player */}
                                      {(() => {
                                        const progressPercentage = audioState.duration > 0 ? (audioState.position / audioState.duration) * 100 : 0;
                                        
                                        return (
                                          <View style={{ marginTop: 8, padding: 12, backgroundColor: colors.light, borderRadius: 8 }}>
                                            {/* Progress Bar */}
                                            <View style={{ marginBottom: 8 }}>
                                              <TouchableOpacity
                                                activeOpacity={1}
                                                onLayout={(e) => {
                                                  const { width } = e.nativeEvent.layout;
                                                  submissionProgressBarWidthRefs.current[index] = width;
                                                }}
                                                onPress={(e) => {
                                                  if (audioState.duration > 0 && submissionProgressBarWidthRefs.current[index] > 0) {
                                                    const { locationX } = e.nativeEvent;
                                                    const newPosition = (locationX / submissionProgressBarWidthRefs.current[index]) * audioState.duration;
                                                    seekSubmissionAudio(index, Math.max(0, Math.min(newPosition, audioState.duration)));
                                                  }
                                                }}
                                                style={{ height: 20, justifyContent: 'center', paddingVertical: 8 }}
                                              >
                                                <View style={{ height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, position: 'relative' }}>
                                                  <View 
                                                    style={{ 
                                                      height: 4, 
                                                      backgroundColor: colors.primary, 
                                                      borderRadius: 2,
                                                      width: `${progressPercentage}%`
                                                    }} 
                                                  />
                                                  <View
                                                    style={{
                                                      position: 'absolute',
                                                      left: `${progressPercentage}%`,
                                                      top: -6,
                                                      width: 16,
                                                      height: 16,
                                                      borderRadius: 8,
                                                      backgroundColor: colors.primary,
                                                      marginLeft: -8,
                                                    }}
                                                  />
                                                </View>
                                              </TouchableOpacity>
                                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                                <Text style={{ fontSize: 12, color: '#666' }}>{formatTime(audioState.position)}</Text>
                                                <Text style={{ fontSize: 12, color: '#666' }}>{formatTime(audioState.duration)}</Text>
                                              </View>
                                            </View>
                                            
                                            {/* Controls */}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                              <TouchableOpacity
                                                style={{ padding: 8 }}
                                                onPress={() => replaySubmissionAudio(index)}
                                              >
                                                <Ionicons name="reload" size={24} color={colors.primary} />
                                              </TouchableOpacity>
                                              <TouchableOpacity
                                                style={{ padding: 8, backgroundColor: colors.primary, borderRadius: 20 }}
                                                onPress={() => {
                                                  if (audioState.playing) {
                                                    pauseSubmissionAudio(index);
                                                  } else {
                                                    playSubmissionAudio(submission.audio_uri, index);
                                                  }
                                                }}
                                              >
                                                <Ionicons 
                                                  name={audioState.playing ? "pause" : "play"} 
                                                  size={24} 
                                                  color="#FFFFFF" 
                                                />
                                              </TouchableOpacity>
                                            </View>
                                          </View>
                                        );
                                      })()}
                                    </View>
                                  );
                                })()}
                                
                                {/* Transcript */}
                                {submission.transcript && submission.transcript.trim() && (
                                  <View>
                                    <View>
                                      {renderTextWithHighlighting(
                                        'ಪಠ್ಯ:',
                                        wordsUsed,
                                        transliterations.transcriptLabel,
                                        [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                                      false,
                                      true
                                      )}
                                    </View>
                                    {showTransliterations && transliterations.transcriptLabel && (
                                      renderTextWithHighlighting(
                                        transliterations.transcriptLabel,
                                        wordsUsed,
                                        null,
                                        [styles.transliterationText, { marginTop: 4, marginBottom: 12 }],
                                        true,
                                        false,
                                        () => handleWordClick(transliterations.transcriptLabel)
                                      )
                                    )}
                                    {renderTextWithHighlighting(
                                      submission.transcript,
                                      wordsUsed,
                                      null,
                                      styles.gradingFeedbackText,
                                      false,
                                      false
                                    )}
                                  </View>
                                )}
                              </>
                            ) : (
                              <>
                                <View>
                                  {renderTextWithHighlighting(
                                    'ನಿಮ್ಮ ಬರವಣಿಗೆ:',
                                    wordsUsed,
                                    transliterations.yourWritingLabel,
                                    [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: '600', marginBottom: 8 }],
                                    false,
                                    false
                                  )}
                                </View>
                                {showTransliterations && transliterations.yourWritingLabel && (
                                  renderTextWithHighlighting(
                                    transliterations.yourWritingLabel,
                                    wordsUsed,
                                    null,
                                    styles.transliterationText,
                                    true,
                                    false,
                                    () => handleWordClick(transliterations.yourWritingLabel)
                                  )
                                )}
                                {renderTextWithHighlighting(
                                  submission.user_writing,
                                  wordsUsed,
                                  null,
                                  styles.gradingFeedbackText,
                                  false,
                                  false
                                )}
                              </>
                            )}
                          </View>
                      
                      {/* Grading Results */}
                      {submissionResult && (
                        <>
                          <View style={styles.gradingScores}>
                            <View style={styles.gradingScoreItem}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ಒಟ್ಟು ಸ್ಕೋರ್:',
                                  wordsUsed,
                                  transliterations.totalScoreLabel,
                                  styles.gradingScoreLabel,
                                  false,
                                  false
                                )}
                              </View>
                              {showTransliterations && transliterations.totalScoreLabel && (
                                renderTextWithHighlighting(
                                  transliterations.totalScoreLabel,
                                  wordsUsed,
                                  null,
                                  styles.transliterationText,
                                  true,
                                  false,
                                  () => handleWordClick(transliterations.totalScoreLabel)
                                )
                              )}
                              <Text style={[styles.gradingScoreValue, { color: colors.primary, fontSize: 20, fontWeight: '700' }]}>
                                {Math.round(submissionResult.score || 0)}%
                              </Text>
                            </View>
                            <View style={styles.gradingScoreItem}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ಪದಕೋಶ:',
                                  wordsUsed,
                                  transliterations.vocabularyScoreLabel,
                                  styles.gradingScoreLabel,
                                  false,
                                  false
                                )}
                              </View>
                              {showTransliterations && transliterations.vocabularyScoreLabel && (
                                renderTextWithHighlighting(
                                  transliterations.vocabularyScoreLabel,
                                  wordsUsed,
                                  null,
                                  styles.transliterationText,
                                  true,
                                  false,
                                  () => handleWordClick(transliterations.vocabularyScoreLabel)
                                )
                              )}
                              <Text style={styles.gradingScoreValue}>{submissionResult.vocabulary_score}%</Text>
                            </View>
                            <View style={styles.gradingScoreItem}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ವ್ಯಾಕರಣ:',
                                  wordsUsed,
                                  transliterations.grammarScoreLabel,
                                  styles.gradingScoreLabel,
                                  false,
                                  false
                                )}
                              </View>
                              {showTransliterations && transliterations.grammarScoreLabel && (
                                    renderTextWithHighlighting(
                                      transliterations.grammarScoreLabel,
                                      wordsUsed,
                                      null,
                                      styles.transliterationText,
                                      true,
                                      false,
                                      () => handleWordClick(transliterations.grammarScoreLabel)
                                    )
                              )}
                              <Text style={styles.gradingScoreValue}>{submissionResult.grammar_score}%</Text>
                            </View>
                            {activityType === 'speaking' ? (
                              <>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    {renderTextWithHighlighting(
                                      'ನಿರರ್ಗಳತೆ:',
                                      wordsUsed,
                                      transliterations.fluencyScoreLabel,
                                      styles.gradingScoreLabel,
                                      false,
                                      false
                                    )}
                                  </View>
                                  {showTransliterations && transliterations.fluencyScoreLabel && (
                                    renderTextWithHighlighting(
                                      transliterations.fluencyScoreLabel,
                                      wordsUsed,
                                      null,
                                      styles.transliterationText,
                                      true,
                                      false,
                                      () => handleWordClick(transliterations.fluencyScoreLabel)
                                    )
                                  )}
                                  <Text style={styles.gradingScoreValue}>{submissionResult.fluency_score || 0}%</Text>
                                </View>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    {renderTextWithHighlighting(
                                      'ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ:',
                                      wordsUsed,
                                      transliterations.taskCompletionScoreLabel,
                                      styles.gradingScoreLabel,
                                      false,
                                      false
                                    )}
                                  </View>
                                  {showTransliterations && transliterations.taskCompletionScoreLabel && (
                                      renderTextWithHighlighting(
                                        transliterations.taskCompletionScoreLabel,
                                        wordsUsed,
                                        null,
                                        styles.transliterationText,
                                        true,
                                        false,
                                        () => handleWordClick(transliterations.taskCompletionScoreLabel)
                                      )
                                  )}
                                  <Text style={styles.gradingScoreValue}>{submissionResult.task_completion_score || 0}%</Text>
                                </View>
                              </>
                            ) : (
                              <View style={styles.gradingScoreItem}>
                                <View>
                                  {renderTextWithHighlighting(
                                    'ಸಂಬಂಧಿತತೆ:',
                                    wordsUsed,
                                    transliterations.coherenceScoreLabel,
                                    styles.gradingScoreLabel,
                                    false,
                                    false
                                  )}
                                </View>
                                {showTransliterations && transliterations.coherenceScoreLabel && (
                                  renderTextWithHighlighting(
                                    transliterations.coherenceScoreLabel,
                                    wordsUsed,
                                    null,
                                    styles.transliterationText,
                                    true,
                                    false,
                                    () => handleWordClick(transliterations.coherenceScoreLabel)
                                  )
                                )}
                                <Text style={styles.gradingScoreValue}>{submissionResult.coherence_score}%</Text>
                              </View>
                            )}
                          </View>
                          {submissionResult.feedback && (
                            <View style={styles.gradingFeedback}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆ:',
                                  wordsUsed,
                                  transliterations.detailedFeedbackLabel,
                                  [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                                  false,
                                  true
                                )}
                              </View>
                              {showTransliterations && transliterations.detailedFeedbackLabel && (
                                renderTextWithHighlighting(
                                  transliterations.detailedFeedbackLabel,
                                  wordsUsed,
                                  null,
                                  [styles.transliterationText, { marginTop: 4, marginBottom: 12 }],
                                  true,
                                  false,
                                  () => handleWordClick(transliterations.detailedFeedbackLabel)
                                )
                              )}
                              {(() => {
                                const feedbackText = submissionResult.feedback;
                                const feedbackTranslit = transliterations[`submission_${submissionIndex}_feedback`] || transliterations.grading_feedback;
                                
                                // Split feedback into paragraphs
                                let feedbackParagraphs = [];
                                if (feedbackText) {
                                  const doubleNewlineSplit = feedbackText.split(/\n\s*\n/).filter(p => p.trim());
                                  if (doubleNewlineSplit.length > 1) {
                                    feedbackParagraphs = doubleNewlineSplit;
                                  } else {
                                    const singleNewlineSplit = feedbackText.split(/\n/).filter(p => p.trim());
                                    if (singleNewlineSplit.length > 1) {
                                      feedbackParagraphs = singleNewlineSplit;
                                    } else {
                                      feedbackParagraphs = [feedbackText];
                                    }
                                  }
                                }
                                
                                let translitParagraphs = [];
                                if (showTransliterations && feedbackTranslit) {
                                  const doubleNewlineSplit = feedbackTranslit.split(/\n\s*\n/).filter(p => p.trim());
                                  if (doubleNewlineSplit.length > 1) {
                                    translitParagraphs = doubleNewlineSplit;
                                  } else {
                                    const singleNewlineSplit = feedbackTranslit.split(/\n/).filter(p => p.trim());
                                    if (singleNewlineSplit.length > 1) {
                                      translitParagraphs = singleNewlineSplit;
                                    } else {
                                      translitParagraphs = [feedbackTranslit];
                                    }
                                  }
                                }
                                
                                const elements = [];
                                for (let i = 0; i < feedbackParagraphs.length; i++) {
                                  elements.push(
                                    <View key={`feedback-para-${i}`}>
                                      {renderTextWithHighlighting(
                                        feedbackParagraphs[i].trim(),
                                        wordsUsed,
                                        i < translitParagraphs.length ? translitParagraphs[i].trim() : null,
                                        styles.gradingFeedbackText,
                                        false,
                                        false
                                      )}
                                    </View>
                                  );
                                  
                                  if (showTransliterations && i < translitParagraphs.length && translitParagraphs[i].trim()) {
                                    const isLastParagraph = i === feedbackParagraphs.length - 1;
                                    elements.push(
                                      <View key={`feedback-translit-${i}`} style={{ marginTop: 4, marginBottom: isLastParagraph ? 0 : 12 }}>
                                        {renderTextWithHighlighting(
                                          translitParagraphs[i].trim(),
                                          wordsUsed,
                                          null,
                                          styles.transliterationText,
                                          true,
                                          false
                                        )}
                                      </View>
                                    );
                                  }
                                }
                                
                                return elements;
                              })()}
                            </View>
                          )}
                          {submissionResult.required_words_feedback && Object.keys(submissionResult.required_words_feedback).length > 0 && (
                            <View style={styles.gradingWordsFeedback}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ಪದಗಳ ಬಳಕೆಯ ಬಗ್ಗೆ ಪ್ರತಿಕ್ರಿಯೆ:',
                                  wordsUsed,
                                  transliterations.wordUsageFeedbackLabel,
                                  [styles.gradingFeedbackLabel, { fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                                  false,
                                  true
                                )}
                              </View>
                              {showTransliterations && transliterations.wordUsageFeedbackLabel && (
                                renderTextWithHighlighting(
                                  transliterations.wordUsageFeedbackLabel,
                                  wordsUsed,
                                  null,
                                  [styles.transliterationText, { marginTop: 4, marginBottom: 12 }],
                                  true,
                                  false,
                                  () => handleWordClick(transliterations.wordUsageFeedbackLabel)
                                )
                              )}
                              {Object.entries(submissionResult.required_words_feedback).map(([word, feedback]) => {
                                const wordFeedbackTranslit = transliterations[`submission_${submissionIndex}_word_${word}_feedback`];
                                return (
                                  <View key={word} style={styles.gradingWordFeedbackItem}>
                                    <View>
                                      {renderTextWithHighlighting(
                                        typeof word === 'string' ? `${word}:` : '',
                                        wordsUsed,
                                        null,
                                        styles.gradingWordFeedbackWord,
                                        false,
                                        false
                                      )}
                                    </View>
                                    <View>
                                      {renderTextWithHighlighting(
                                        typeof feedback === 'string' ? feedback : (feedback == null ? '' : String(feedback)),
                                        wordsUsed,
                                        wordFeedbackTranslit,
                                        styles.gradingWordFeedbackText,
                                        false,
                                        false
                                      )}
                                      {showTransliterations && wordFeedbackTranslit && (
                                        <View style={{ marginTop: 4 }}>
                                          {renderTextWithHighlighting(
                                            wordFeedbackTranslit,
                                            wordsUsed,
                                            null,
                                            styles.transliterationText,
                                            true,
                                            false
                                          )}
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </>
                      )}
                      </>
                    )}
                    </View>
                  );
                })}
              </View>
            )}
            
            {/* Current Grading Result (for newly submitted, before it's added to allSubmissions) */}
            {gradingResult && !allSubmissions.some(s => s.grading_result === gradingResult) && (
              <View style={[styles.gradingResultBox, { backgroundColor: colors.light }]}>
                <Text style={[styles.gradingResultTitle, { color: colors.primary }]}>ಮೌಲ್ಯಮಾಪನ ಫಲಿತಾಂಶ</Text>
                <View style={styles.gradingScores}>
                  <View style={styles.gradingScoreItem}>
                    <View>
                      {renderTextWithHighlighting(
                        'ಒಟ್ಟು ಸ್ಕೋರ್:',
                        wordsUsed,
                        transliterations.totalScoreLabel,
                        styles.gradingScoreLabel,
                        false,
                        false
                      )}
                    </View>
                    {showTransliterations && transliterations.totalScoreLabel && (
                      renderTextWithHighlighting(
                        transliterations.totalScoreLabel,
                        wordsUsed,
                        null,
                        styles.transliterationText,
                        true,
                        false,
                        () => handleWordClick(transliterations.totalScoreLabel)
                      )
                    )}
                    <Text style={[styles.gradingScoreValue, { color: colors.primary, fontSize: 20, fontWeight: '700' }]}>
                      {Math.round(gradingResult.score || 0)}%
                    </Text>
                  </View>
                  <View style={styles.gradingScoreItem}>
                    <View>
                      {renderTextWithHighlighting(
                        'ಪದಕೋಶ:',
                        wordsUsed,
                        transliterations.vocabularyScoreLabel,
                        styles.gradingScoreLabel,
                        false,
                        false
                      )}
                    </View>
                    {showTransliterations && transliterations.vocabularyScoreLabel && (
                      renderTextWithHighlighting(
                        transliterations.vocabularyScoreLabel,
                        wordsUsed,
                        null,
                        styles.transliterationText,
                        true,
                        false,
                        () => handleWordClick(transliterations.vocabularyScoreLabel)
                      )
                    )}
                    <Text style={styles.gradingScoreValue}>{gradingResult.vocabulary_score}%</Text>
                  </View>
                  <View style={styles.gradingScoreItem}>
                    <View>
                      {renderTextWithHighlighting(
                        'ವ್ಯಾಕರಣ:',
                        wordsUsed,
                        transliterations.grammarScoreLabel,
                        styles.gradingScoreLabel,
                        false,
                        false
                      )}
                    </View>
                    {showTransliterations && transliterations.grammarScoreLabel && (
                      renderTextWithHighlighting(
                        transliterations.grammarScoreLabel,
                        wordsUsed,
                        null,
                        styles.transliterationText,
                        true,
                        false,
                        () => handleWordClick(transliterations.grammarScoreLabel)
                      )
                    )}
                    <Text style={styles.gradingScoreValue}>{gradingResult.grammar_score}%</Text>
                  </View>
                  <View style={styles.gradingScoreItem}>
                    <View>
                      {renderTextWithHighlighting(
                        'ಸಂಬಂಧಿತತೆ:',
                        wordsUsed,
                        transliterations.coherenceScoreLabel,
                        styles.gradingScoreLabel,
                        false,
                        false
                      )}
                    </View>
                    {showTransliterations && transliterations.coherenceScoreLabel && (
                      renderTextWithHighlighting(
                        transliterations.coherenceScoreLabel,
                        wordsUsed,
                        null,
                        styles.transliterationText,
                        true,
                        false,
                        () => handleWordClick(transliterations.coherenceScoreLabel)
                      )
                    )}
                    <Text style={styles.gradingScoreValue}>{gradingResult.coherence_score}%</Text>
                  </View>
                </View>
                {gradingResult.feedback && (
                  <View style={styles.gradingFeedback}>
                    <View>
                      {renderTextWithHighlighting(
                        'ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆ:',
                        wordsUsed,
                        transliterations.detailedFeedbackLabel,
                        [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                        false,
                        false
                      )}
                    </View>
                    {showTransliterations && transliterations.detailedFeedbackLabel && (
                      renderTextWithHighlighting(
                        transliterations.detailedFeedbackLabel,
                        wordsUsed,
                        null,
                        styles.transliterationText,
                        true,
                        false,
                        () => handleWordClick(transliterations.detailedFeedbackLabel)
                      )
                    )}
                    {(() => {
                      const feedbackText = gradingResult.feedback;
                      const feedbackTranslit = transliterations.grading_feedback;
                      
                      // Split feedback into paragraphs
                      let feedbackParagraphs = [];
                      if (feedbackText) {
                        const doubleNewlineSplit = feedbackText.split(/\n\s*\n/).filter(p => p.trim());
                        if (doubleNewlineSplit.length > 1) {
                          feedbackParagraphs = doubleNewlineSplit;
                        } else {
                          const singleNewlineSplit = feedbackText.split(/\n/).filter(p => p.trim());
                          if (singleNewlineSplit.length > 1) {
                            feedbackParagraphs = singleNewlineSplit;
                          } else {
                            feedbackParagraphs = [feedbackText];
                          }
                        }
                      }
                      
                      let translitParagraphs = [];
                      if (showTransliterations && feedbackTranslit) {
                        const doubleNewlineSplit = feedbackTranslit.split(/\n\s*\n/).filter(p => p.trim());
                        if (doubleNewlineSplit.length > 1) {
                          translitParagraphs = doubleNewlineSplit;
                        } else {
                          const singleNewlineSplit = feedbackTranslit.split(/\n/).filter(p => p.trim());
                          if (singleNewlineSplit.length > 1) {
                            translitParagraphs = singleNewlineSplit;
                          } else {
                            translitParagraphs = [feedbackTranslit];
                          }
                        }
                      }
                      
                      const elements = [];
                      for (let i = 0; i < feedbackParagraphs.length; i++) {
                        elements.push(
                          <View key={`feedback-para-${i}`}>
                            {renderTextWithHighlighting(
                              feedbackParagraphs[i].trim(),
                              wordsUsed,
                              i < translitParagraphs.length ? translitParagraphs[i].trim() : null,
                              styles.gradingFeedbackText,
                              false,
                              false
                            )}
                          </View>
                        );
                        
                        if (showTransliterations && i < translitParagraphs.length && translitParagraphs[i].trim()) {
                          const isLastParagraph = i === feedbackParagraphs.length - 1;
                          elements.push(
                            <View key={`feedback-translit-${i}`} style={{ marginTop: 4, marginBottom: isLastParagraph ? 0 : 12 }}>
                              {renderTextWithHighlighting(
                                translitParagraphs[i].trim(),
                                wordsUsed,
                                null,
                                styles.transliterationText,
                                true,
                                false
                              )}
                            </View>
                          );
                        }
                      }
                      
                      return elements;
                    })()}
                  </View>
                )}
                {gradingResult.required_words_feedback && Object.keys(gradingResult.required_words_feedback).length > 0 && (
                  <View style={styles.gradingWordsFeedback}>
                    <View>
                      {renderTextWithHighlighting(
                        'ಪದಗಳ ಬಳಕೆಯ ಬಗ್ಗೆ ಪ್ರತಿಕ್ರಿಯೆ:',
                        wordsUsed,
                        transliterations.wordUsageFeedbackLabel,
                        [styles.gradingFeedbackLabel, { fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                        false,
                        false
                      )}
                    </View>
                    {showTransliterations && transliterations.wordUsageFeedbackLabel && (
                      renderTextWithHighlighting(
                        transliterations.wordUsageFeedbackLabel,
                        wordsUsed,
                        null,
                        styles.transliterationText,
                        true,
                        false,
                        () => handleWordClick(transliterations.wordUsageFeedbackLabel)
                      )
                    )}
                    {Object.entries(gradingResult.required_words_feedback).map(([word, feedback]) => {
                      const wordFeedbackTranslit = transliterations[`word_${word}_feedback`] || null;
                      return (
                        <View key={word} style={styles.gradingWordFeedbackItem}>
                          <View>
                            {renderTextWithHighlighting(
                                        typeof word === 'string' ? `${word}:` : '',
                              wordsUsed,
                              null,
                              styles.gradingWordFeedbackWord,
                              false,
                              false
                            )}
                          </View>
                          <View>
                            {renderTextWithHighlighting(
                              feedback,
                              wordsUsed,
                              wordFeedbackTranslit,
                              styles.gradingWordFeedbackText,
                              false,
                              false
                            )}
                            {showTransliterations && wordFeedbackTranslit && (
                              <View style={{ marginTop: 4 }}>
                                {renderTextWithHighlighting(
                                  wordFeedbackTranslit,
                                  wordsUsed,
                                  null,
                                  styles.transliterationText,
                                  true,
                                  false
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {activityType === 'speaking' && activity && (
          <View>
            {/* Activity Name */}
            {activity.activity_name && (
              <View style={styles.storyTitleContainer}>
                <View style={styles.storyTitleWrapper}>
                  {renderTextWithHighlighting(
                    activity.activity_name,
                    wordsUsed,
                    transliterations.activity_name,
                    styles.storyTitle,
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.activity_name && (
                  <View style={styles.storyTitleTransliterationWrapper}>
                    {renderTextWithHighlighting(
                      transliterations.activity_name,
                      wordsUsed,
                      null,
                      styles.storyTitleTransliteration,
                      true,
                      false
                    )}
                  </View>
                )}
              </View>
            )}
            
            {/* Section Title */}
            <View style={{ marginBottom: 16 }}>
              {renderTextWithHighlighting(
                'ಭಾಷಣ ಅಭ್ಯಾಸ',
                wordsUsed,
                null,
                { ...styles.sectionTitle, fontWeight: 'bold' },
                false,
                true
              )}
              {showTransliterations && transliterations.sectionTitle_speaking && (
                renderTextWithHighlighting(
                  transliterations.sectionTitle_speaking,
                  wordsUsed,
                  null,
                  [styles.transliterationText, { marginTop: 4, marginBottom: 12 }],
                  true,
                  false,
                  () => handleWordClick(transliterations.sectionTitle_speaking)
                )
              )}
            </View>
            
            {/* Speaking Prompt - Topic and Instructions combined (like writing prompt) */}
            <View style={styles.promptBox}>
              {(() => {
                // Combine topic and instructions into a single prompt text
                let promptText = '';
                if (activity.topic) {
                  promptText += activity.topic;
                  if (activity.instructions) {
                    promptText += '\n\n' + activity.instructions;
                  }
                } else if (activity.instructions) {
                  promptText = activity.instructions;
                }
                
                // Get transliterations
                let translitText = '';
                if (activity.topic && transliterations.topic) {
                  translitText += transliterations.topic;
                  if (activity.instructions && transliterations.instructions) {
                    translitText += '\n\n' + transliterations.instructions;
                  }
                } else if (activity.instructions && transliterations.instructions) {
                  translitText = transliterations.instructions;
                }
                
                // Split into paragraphs
                let promptParagraphs = [];
                if (promptText) {
                  const doubleNewlineSplit = promptText.split(/\n\s*\n/).filter(p => p.trim());
                  if (doubleNewlineSplit.length > 1) {
                    promptParagraphs = doubleNewlineSplit;
                  } else {
                    const singleNewlineSplit = promptText.split(/\n/).filter(p => p.trim());
                    if (singleNewlineSplit.length > 1) {
                      promptParagraphs = singleNewlineSplit;
                    } else {
                      promptParagraphs = [promptText];
                    }
                  }
                }
                
                let translitParagraphs = [];
                if (showTransliterations && translitText) {
                  const doubleNewlineSplit = translitText.split(/\n\s*\n/).filter(p => p.trim());
                  if (doubleNewlineSplit.length > 1) {
                    translitParagraphs = doubleNewlineSplit;
                  } else {
                    const singleNewlineSplit = translitText.split(/\n/).filter(p => p.trim());
                    if (singleNewlineSplit.length > 1) {
                      translitParagraphs = singleNewlineSplit;
                    } else {
                      translitParagraphs = [translitText];
                    }
                  }
                }
                
                const elements = [];
                for (let i = 0; i < promptParagraphs.length; i++) {
                  elements.push(
                    <View key={`prompt-para-${i}`}>
                      {renderTextWithHighlighting(
                        promptParagraphs[i].trim(),
                        wordsUsed,
                        i < translitParagraphs.length ? translitParagraphs[i].trim() : null,
                        styles.promptText,
                        false,
                        false
                      )}
                    </View>
                  );
                  
                  if (showTransliterations && i < translitParagraphs.length && translitParagraphs[i].trim()) {
                    const isLastParagraph = i === promptParagraphs.length - 1;
                    elements.push(
                      <View key={`prompt-translit-${i}`} style={{ marginTop: 4, marginBottom: isLastParagraph ? 0 : 12 }}>
                        {renderTextWithHighlighting(
                          translitParagraphs[i].trim(),
                          wordsUsed,
                          null,
                          styles.transliterationText,
                          true,
                          false
                        )}
                      </View>
                    );
                  }
                }
                
                return elements;
              })()}
            </View>
            
            {/* Required Words */}
            {activity.required_words && activity.required_words.length > 0 && (
              <View style={styles.requiredWordsBox}>
                <View>
                  {renderTextWithHighlighting(
                    'ಈ ಪದಗಳನ್ನು ಬಳಸಬೇಕು:',
                    wordsUsed,
                    transliterations.requiredWordsLabel,
                    { ...styles.requiredWordsLabel, fontWeight: 'bold' },
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.requiredWordsLabel && (
                  renderTextWithHighlighting(
                    transliterations.requiredWordsLabel,
                    wordsUsed,
                    null,
                    styles.transliterationText,
                    true,
                    false,
                    () => handleWordClick(transliterations.requiredWordsLabel)
                  )
                )}
                <View style={styles.wordsList}>
                  {activity.required_words.map((word, index) => {
                    const vocabWord = wordsUsed.find(w => w.kannada === word || w.word === word);
                    const wordTranslit = transliterations[`required_word_${index}`] || vocabWord?.transliteration;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.wordTag, { backgroundColor: colors.light }]}
                        onPress={() => handleWordPress(word)}
                      >
                        {renderTextWithHighlighting(
                          vocabWord?.kannada || word,
                          wordsUsed,
                          wordTranslit,
                          [styles.wordTagText, { color: colors.primary }],
                          false,
                          false
                        )}
                        {showTransliterations && wordTranslit && (
                          <Text style={[styles.wordTagTranslit, { color: colors.primary }]}>{wordTranslit}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            
            {/* Collapsible Rubric Section */}
            <View style={[styles.rubricSection, { backgroundColor: colors.light, marginTop: 20 }]}>
              <TouchableOpacity
                style={styles.rubricHeader}
                onPress={() => setRubricExpanded(!rubricExpanded)}
              >
                <View style={{ flex: 1 }}>
                  {renderTextWithHighlighting(
                    'ಮೌಲ್ಯಮಾಪನ ಮಾನದಂಡಗಳು',
                    wordsUsed,
                    null,
                    [styles.rubricHeaderText, { color: colors.primary, fontWeight: 'bold' }],
                    false,
                    true
                  )}
                  {showTransliterations && transliterations.rubricTitle && (
                    <Text 
                      style={[styles.transliterationText, { marginTop: 4 }]}
                      onPress={() => handleWordClick(transliterations.rubricTitle)}
                    >
                      {transliterations.rubricTitle}
                    </Text>
                  )}
                </View>
                <Ionicons
                  name={rubricExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
              
              {rubricExpanded && (
                <View style={styles.rubricContent}>
                  {(() => {
                    // Combine general guidelines with Gemini's criteria
                    const generalGuidelines = activity._general_guidelines || [
                      "ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.",
                      "ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.",
                      "ಭಾಷಣವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು.",
                      "ಕಾರ್ಯಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಬೇಕು ಮತ್ತು ನೀಡಲಾದ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ ಮಾತನಾಡಬೇಕು."
                    ];
                    
                    // Helper to aggressively clean markdown/numbering
                    const cleanLine = (line) => {
                      if (!line) return '';
                      return line
                        .replace(/[*_`]/g, '') // remove *, _, `
                        .replace(/^\s*[-•●]\s*/g, '') // leading bullets
                        .replace(/^\s*\d+\.\s*/g, '') // leading numbered list
                        .trim();
                    };
                    
                    // Clean and split Gemini's criteria
                    let geminiCriteria = [];
                    if (activity.evaluation_criteria) {
                      let criteriaText = activity.evaluation_criteria;
                      criteriaText = criteriaText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
                      geminiCriteria = criteriaText
                        .split('\n')
                        .map(line => cleanLine(line))
                        .filter(line => line.length > 0);
                    }
                    
                    // Combine all criteria
                    const allCriteria = [...generalGuidelines.map(cleanLine), ...geminiCriteria];
                    
                    return (
                      <View style={styles.criteriaList}>
                        {allCriteria.map((line, index) => {
                          const guidelineTranslit = transliterations[`general_guideline_${index}`];
                          return (
                            <View key={index} style={styles.criteriaBulletItem}>
                              <Text style={styles.criteriaBullet}>•</Text>
                              <View style={styles.criteriaBulletText}>
                                {renderTextWithHighlighting(
                                  line,
                                  wordsUsed,
                                  guidelineTranslit,
                                  styles.criteriaText,
                                  false,
                                  false
                                )}
                                {showTransliterations && guidelineTranslit && (
                                  <View style={{ marginTop: 4 }}>
                                    {renderTextWithHighlighting(
                                      guidelineTranslit,
                                      wordsUsed,
                                      null,
                                      styles.transliterationText,
                                      true,
                                      false
                                    )}
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}
                </View>
              )}
            </View>
            
            {/* Tasks Display - Collapsible */}
            {activity.tasks && activity.tasks.length > 0 && (
              <View style={[styles.textBox, { backgroundColor: '#FFF9E6', marginBottom: 16 }]}>
                <TouchableOpacity
                  onPress={() => setTasksExpanded(!tasksExpanded)}
                  style={styles.taskHeader}
                >
                  <View style={{ flex: 1 }}>
                    <View>
                      {renderTextWithHighlighting(
                        'ಕಾರ್ಯಗಳು',
                        wordsUsed,
                        transliterations.tasks_title,
                        { ...styles.sectionTitle, marginBottom: 0, fontWeight: 'bold' },
                        false,
                        true
                      )}
                    </View>
                    {showTransliterations && transliterations.tasks_title && (
                      <Text 
                        style={[styles.transliterationText, { marginTop: 4, fontSize: 14 }]}
                        onPress={() => handleWordClick(transliterations.tasks_title)}
                      >
                        {transliterations.tasks_title}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={tasksExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.primary}
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
                {tasksExpanded && (
                  <View style={{ marginTop: 12 }}>
                    {activity.tasks.map((task, index) => {
                      // Split task at colon to bold "ಕಾರ್ಯ" + number + colon
                      const colonIndex = task.indexOf(':');
                      let taskLabel = '';
                      let taskDescription = task;
                      let translitLabel = '';
                      let translitDescription = '';
                      const taskTranslit = transliterations[`task_${index}`] || '';
                      
                      if (colonIndex !== -1) {
                        // Extract everything up to and including the colon (e.g., "ಕಾರ್ಯ 1:")
                        taskLabel = task.substring(0, colonIndex + 1);
                        taskDescription = task.substring(colonIndex + 1).trim();
                        
                        if (taskTranslit) {
                          const translitColonIndex = taskTranslit.indexOf(':');
                          if (translitColonIndex !== -1) {
                            translitLabel = taskTranslit.substring(0, translitColonIndex + 1);
                            translitDescription = taskTranslit.substring(translitColonIndex + 1).trim();
                          } else {
                            translitDescription = taskTranslit;
                          }
                        }
                      }
                      
                      return (
                        <View key={index} style={styles.taskItem}>
                          <View style={styles.taskCheckbox}>
                            <Ionicons name="ellipse-outline" size={24} color="#666" />
                          </View>
                          <View style={styles.taskText}>
                            {taskLabel ? (
                              <>
                                <Text style={styles.taskTextContent}>
                                  <Text style={{ fontWeight: 'bold' }}>
                                    {taskLabel}
                                  </Text>
                                  {taskDescription ? (
                                    <>
                                      {' '}
                                      {renderTextWithHighlighting(
                                        taskDescription,
                                        wordsUsed,
                                        null,
                                        {},
                                        false,
                                        false
                                      )}
                                    </>
                                  ) : null}
                                </Text>
                                {showTransliterations && translitLabel && (
                                  <Text style={[styles.transliterationText, { marginTop: 2, fontSize: 12, fontWeight: 'bold' }]}>
                                    {translitLabel}
                                  </Text>
                                )}
                                {showTransliterations && translitDescription && (
                                  <Text style={[styles.transliterationText, { marginTop: 2, fontSize: 12 }]}>
                                    {translitDescription}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <>
                                <Text style={styles.taskTextContent}>
                                  {renderTextWithHighlighting(
                                    task,
                                    wordsUsed,
                                    null,
                                    {},
                                    false,
                                    false
                                  )}
                                </Text>
                                {showTransliterations && taskTranslit && (
                                  <Text 
                                    style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                    onPress={() => handleWordClick(taskTranslit)}
                                  >
                                    {taskTranslit}
                                  </Text>
                                )}
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
            
            {/* Input Mode Toggle */}
            <View style={[styles.promptBox, { marginBottom: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View>
                  {renderTextWithHighlighting(
                    'ಇನ್ಪುಟ್ ವಿಧಾನ:',
                    wordsUsed,
                    null,
                    { ...styles.sectionTitle, fontWeight: 'bold', marginBottom: 0 },
                    false,
                    true
                  )}
                  {showTransliterations && transliterations.inputMethodLabel && (
                    renderTextWithHighlighting(
                      transliterations.inputMethodLabel,
                      wordsUsed,
                      null,
                      styles.transliterationText,
                      true,
                      false,
                      () => handleWordClick(transliterations.inputMethodLabel)
                    )
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setUseAudioInput(false)}
                    style={[
                      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
                      !useAudioInput ? { backgroundColor: colors.primary } : { backgroundColor: '#E0E0E0' }
                    ]}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: !useAudioInput ? '#FFFFFF' : '#666', fontWeight: 'bold' }}>
                        ಪಠ್ಯ
                      </Text>
                      {showTransliterations && transliterations.textButtonLabel && (
                        <Text style={{ color: !useAudioInput ? '#FFFFFF' : '#666', fontSize: 10, marginTop: 2 }}>
                          {transliterations.textButtonLabel}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setUseAudioInput(true)}
                    style={[
                      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
                      useAudioInput ? { backgroundColor: colors.primary } : { backgroundColor: '#E0E0E0' }
                    ]}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: useAudioInput ? '#FFFFFF' : '#666', fontWeight: 'bold' }}>
                        ಆಡಿಯೋ
                      </Text>
                      {showTransliterations && transliterations.audioButtonLabel && (
                        <Text style={{ color: useAudioInput ? '#FFFFFF' : '#666', fontSize: 10, marginTop: 2 }}>
                          {transliterations.audioButtonLabel}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Text Input */}
            {!useAudioInput && (
              <TextInput
                style={[styles.writingInput, { borderColor: colors.primary }]}
                value={userAnswer}
                onChangeText={setUserAnswer}
                placeholder="ನಿಮ್ಮ ಭಾಷಣವನ್ನು ಇಲ್ಲಿ ಬರೆಯಿರಿ..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                editable={!gradingLoading}
              />
            )}

            {/* Audio Recording Controls */}
            {useAudioInput && (
              <View style={styles.promptBox}>
                {recordingStatus === 'idle' && !recordingUri && (
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.primary, marginBottom: 0 }]}
                    onPress={startRecording}
                    disabled={gradingLoading}
                  >
                    <Ionicons name="mic" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.submitButtonText}>ರೆಕಾರ್ಡ್ ಪ್ರಾರಂಭಿಸಿ</Text>
                      {showTransliterations && transliterations.startRecordingLabel && (
                        <Text style={[styles.submitButtonText, { fontSize: 10, marginTop: 2 }]}>
                          {transliterations.startRecordingLabel}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                
                {recordingStatus === 'recording' && (
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF0000', marginRight: 8 }} />
                      <View>
                        {renderTextWithHighlighting(
                          'ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
                          wordsUsed,
                          transliterations.recordingInProgressLabel,
                          { color: colors.primary, fontWeight: 'bold' },
                          false,
                          false
                        )}
                        {showTransliterations && transliterations.recordingInProgressLabel && (
                          <Text style={[styles.transliterationText, { fontSize: 10, marginTop: 2 }]}>
                            {transliterations.recordingInProgressLabel}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.submitButton, { backgroundColor: '#FF6B6B', marginBottom: 0 }]}
                      onPress={stopRecording}
                    >
                      <Ionicons name="stop" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.submitButtonText}>ರೆಕಾರ್ಡಿಂಗ್ ನಿಲ್ಲಿಸಿ</Text>
                        {showTransliterations && transliterations.stopRecordingLabel && (
                          <Text style={[styles.submitButtonText, { fontSize: 10, marginTop: 2 }]}>
                            {transliterations.stopRecordingLabel}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {recordingStatus === 'stopped' && recordingUri && (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons name="checkmark-circle" size={20} color="#50C878" style={{ marginRight: 8 }} />
                      <View>
                        {renderTextWithHighlighting(
                          'ರೆಕಾರ್ಡಿಂಗ್ ಪೂರ್ಣಗೊಂಡಿದೆ',
                          wordsUsed,
                          transliterations.recordingCompletedLabel,
                          { color: colors.primary, fontWeight: 'bold' },
                          false,
                          false
                        )}
                        {showTransliterations && transliterations.recordingCompletedLabel && (
                          <Text style={[styles.transliterationText, { fontSize: 12, marginTop: 4 }]}>
                            {transliterations.recordingCompletedLabel}
                          </Text>
                        )}
                      </View>
                    </View>
                    {/* Audio Player */}
                    {(() => {
                      const progressPercentage = recordingAudioDuration > 0 ? (recordingAudioPosition / recordingAudioDuration) * 100 : 0;
                      
                      return (
                        <View style={{ marginBottom: 12, padding: 12, backgroundColor: colors.light, borderRadius: 8 }}>
                          {/* Progress Bar */}
                          <View style={{ marginBottom: 8 }}>
                            <TouchableOpacity
                              activeOpacity={1}
                              onLayout={(e) => {
                                const { width } = e.nativeEvent.layout;
                                recordingProgressBarWidthRef.current = width;
                              }}
                              onPress={(e) => {
                                if (recordingAudioDuration > 0 && recordingProgressBarWidthRef.current > 0) {
                                  const { locationX } = e.nativeEvent;
                                  const newPosition = (locationX / recordingProgressBarWidthRef.current) * recordingAudioDuration;
                                  seekRecordingAudio(Math.max(0, Math.min(newPosition, recordingAudioDuration)));
                                }
                              }}
                              style={{ height: 20, justifyContent: 'center', paddingVertical: 8 }}
                            >
                              <View style={{ height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, position: 'relative' }}>
                                <View 
                                  style={{ 
                                    height: 4, 
                                    backgroundColor: colors.primary, 
                                    borderRadius: 2,
                                    width: `${progressPercentage}%`
                                  }} 
                                />
                                <View
                                  style={{
                                    position: 'absolute',
                                    left: `${progressPercentage}%`,
                                    top: -6,
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    backgroundColor: colors.primary,
                                    marginLeft: -8,
                                  }}
                                />
                              </View>
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                              <Text style={{ fontSize: 12, color: '#666' }}>{formatTime(recordingAudioPosition)}</Text>
                              <Text style={{ fontSize: 12, color: '#666' }}>{formatTime(recordingAudioDuration)}</Text>
                            </View>
                          </View>
                          
                          {/* Controls */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <TouchableOpacity
                              style={{ padding: 8 }}
                              onPress={replayRecordingAudio}
                            >
                              <Ionicons name="reload" size={24} color={colors.primary} />
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center' }}>
                              <TouchableOpacity
                                style={{ padding: 8, backgroundColor: colors.primary, borderRadius: 20 }}
                                onPress={() => {
                                  if (recordingAudioPlaying) {
                                    pauseRecordingAudio();
                                  } else {
                                    playRecordingAudio(recordingUri);
                                  }
                                }}
                              >
                                <Ionicons 
                                  name={recordingAudioPlaying ? "pause" : "play"} 
                                  size={24} 
                                  color="#FFFFFF" 
                                />
                              </TouchableOpacity>
                              {showTransliterations && transliterations.playRecordingLabel && (
                                <Text style={[styles.transliterationText, { fontSize: 10, marginTop: 4 }]}>
                                  {transliterations.playRecordingLabel}
                                </Text>
                              )}
                            </View>
                            <TouchableOpacity
                              style={[styles.submitButton, { backgroundColor: '#999', marginBottom: 0, paddingHorizontal: 16, paddingVertical: 8 }]}
                              onPress={() => {
                                // Stop and reset audio
                                if (Platform.OS === 'web') {
                                  const audioElement = recordingAudioRef.current;
                                  if (audioElement) {
                                    audioElement.pause();
                                    audioElement.currentTime = 0;
                                  }
                                } else {
                                  const sound = recordingAudioRef.current;
                                  if (sound) {
                                    sound.stopAsync();
                                    sound.unloadAsync();
                                  }
                                }
                                setRecordingAudioPlaying(false);
                                setRecordingAudioPosition(0);
                                setRecordingAudioDuration(0);
                                setRecordingUri(null);
                                setRecordingStatus('idle');
                              }}
                            >
                              <View style={{ alignItems: 'center' }}>
                                <Text style={styles.submitButtonText}>ರೆಕಾರ್ಡಿಂಗ್ ಅಳಿಸಿ</Text>
                                {showTransliterations && transliterations.deleteRecordingLabel && (
                                  <Text style={[styles.submitButtonText, { fontSize: 10, marginTop: 2 }]}>
                                    {transliterations.deleteRecordingLabel}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </View>
            )}
            
            {/* Grading Progress */}
            {gradingLoading && (
              <View style={[styles.gradingProgressBox, { backgroundColor: colors.light }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.gradingProgressText, { color: colors.primary }]}>
                  ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗುತ್ತಿದೆ... ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ
                </Text>
              </View>
            )}
            
            {/* Grading Result Display */}
            {gradingResult && (
              <View style={[styles.gradingResultBox, { backgroundColor: colors.light, marginTop: 20 }]}>
                <View>
                  {renderTextWithHighlighting(
                    'ಮೌಲ್ಯಮಾಪನ ಫಲಿತಾಂಶ',
                    wordsUsed,
                    transliterations.gradingResultTitle,
                    [styles.gradingResultTitle, { color: colors.primary }],
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.gradingResultTitle && (
                  renderTextWithHighlighting(
                    transliterations.gradingResultTitle,
                    wordsUsed,
                    null,
                    styles.transliterationText,
                    true,
                    false,
                    () => handleWordClick(transliterations.gradingResultTitle)
                  )
                )}
                
                {/* Score Display */}
                <View style={styles.gradingScoresContainer}>
                  <View style={styles.gradingScoreItem}>
                    <View>
                      {renderTextWithHighlighting(
                        'ಒಟ್ಟು ಸ್ಕೋರ್:',
                        wordsUsed,
                        transliterations.totalScoreLabel,
                        styles.gradingScoreLabel,
                        false,
                        true
                      )}
                    </View>
                    {showTransliterations && transliterations.totalScoreLabel && (
                      renderTextWithHighlighting(
                        transliterations.totalScoreLabel,
                        wordsUsed,
                        null,
                        styles.transliterationText,
                        true,
                        false,
                        () => handleWordClick(transliterations.totalScoreLabel)
                      )
                    )}
                    <Text style={styles.gradingScoreValue}>{Math.round(gradingResult.score || 0)}%</Text>
                  </View>
                  
                  {gradingResult.vocabulary_score !== undefined && (
                    <View style={styles.gradingScoreItem}>
                      <View>
                        {renderTextWithHighlighting(
                          'ಪದಕೋಶ:',
                          wordsUsed,
                          transliterations.vocabularyScoreLabel,
                          styles.gradingScoreLabel,
                          false,
                          true
                        )}
                      </View>
                      {showTransliterations && transliterations.vocabularyScoreLabel && (
                        renderTextWithHighlighting(
                          transliterations.vocabularyScoreLabel,
                          wordsUsed,
                          null,
                          styles.transliterationText,
                          true,
                          false,
                          () => handleWordClick(transliterations.vocabularyScoreLabel)
                        )
                      )}
                      <Text style={styles.gradingScoreValue}>{gradingResult.vocabulary_score}%</Text>
                    </View>
                  )}
                  
                  {gradingResult.grammar_score !== undefined && (
                    <View style={styles.gradingScoreItem}>
                      <View>
                        {renderTextWithHighlighting(
                          'ವ್ಯಾಕರಣ:',
                          wordsUsed,
                          transliterations.grammarScoreLabel,
                          styles.gradingScoreLabel,
                          false,
                          true
                        )}
                      </View>
                      {showTransliterations && transliterations.grammarScoreLabel && (
                        renderTextWithHighlighting(
                          transliterations.grammarScoreLabel,
                          wordsUsed,
                          null,
                          styles.transliterationText,
                          true,
                          false,
                          () => handleWordClick(transliterations.grammarScoreLabel)
                        )
                      )}
                      <Text style={styles.gradingScoreValue}>{gradingResult.grammar_score}%</Text>
                    </View>
                  )}
                  
                  {gradingResult.coherence_score !== undefined && (
                    <View style={styles.gradingScoreItem}>
                      <View>
                        {renderTextWithHighlighting(
                          'ಸಂಬಂಧಿತತೆ:',
                          wordsUsed,
                          transliterations.coherenceScoreLabel,
                          styles.gradingScoreLabel,
                          false,
                          true
                        )}
                      </View>
                      {showTransliterations && transliterations.coherenceScoreLabel && (
                        renderTextWithHighlighting(
                          transliterations.coherenceScoreLabel,
                          wordsUsed,
                          null,
                          styles.transliterationText,
                          true,
                          false,
                          () => handleWordClick(transliterations.coherenceScoreLabel)
                        )
                      )}
                      <Text style={styles.gradingScoreValue}>{gradingResult.coherence_score}%</Text>
                    </View>
                  )}
                </View>
                
                {/* Feedback */}
                {gradingResult.feedback && (
                  <View style={{ marginTop: 16 }}>
                    <View>
                      {renderTextWithHighlighting(
                        'ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆ:',
                        wordsUsed,
                        transliterations.detailedFeedbackLabel,
                        [styles.gradingFeedbackLabel, { fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                        false,
                        false
                      )}
                    </View>
                    {showTransliterations && transliterations.detailedFeedbackLabel && (
                      renderTextWithHighlighting(
                        transliterations.detailedFeedbackLabel,
                        wordsUsed,
                        null,
                        [styles.transliterationText, { marginTop: 4, marginBottom: 12 }],
                        true,
                        false,
                        () => handleWordClick(transliterations.detailedFeedbackLabel)
                      )
                    )}
                    {!showTransliterations && <View style={{ marginTop: 12 }} />}
                    {(() => {
                      const feedbackText = gradingResult.feedback;
                      const feedbackTranslit = transliterations.grading_feedback || transliterations[`submission_0_feedback`];
                      
                      // Split into paragraphs
                      let feedbackParagraphs = [];
                      if (feedbackText) {
                        const doubleNewlineSplit = feedbackText.split(/\n\s*\n/).filter(p => p.trim());
                        if (doubleNewlineSplit.length > 1) {
                          feedbackParagraphs = doubleNewlineSplit;
                        } else {
                          const singleNewlineSplit = feedbackText.split(/\n/).filter(p => p.trim());
                          if (singleNewlineSplit.length > 1) {
                            feedbackParagraphs = singleNewlineSplit;
                          } else {
                            feedbackParagraphs = [feedbackText];
                          }
                        }
                      }
                      
                      let translitParagraphs = [];
                      if (showTransliterations && feedbackTranslit) {
                        const doubleNewlineSplit = feedbackTranslit.split(/\n\s*\n/).filter(p => p.trim());
                        if (doubleNewlineSplit.length > 1) {
                          translitParagraphs = doubleNewlineSplit;
                        } else {
                          const singleNewlineSplit = feedbackTranslit.split(/\n/).filter(p => p.trim());
                          if (singleNewlineSplit.length > 1) {
                            translitParagraphs = singleNewlineSplit;
                          } else {
                            translitParagraphs = [feedbackTranslit];
                          }
                        }
                      }
                      
                      const elements = [];
                      for (let i = 0; i < feedbackParagraphs.length; i++) {
                        elements.push(
                          <View key={`feedback-para-${i}`} style={{ marginBottom: 8 }}>
                            {renderTextWithHighlighting(
                              feedbackParagraphs[i].trim(),
                              wordsUsed,
                              i < translitParagraphs.length ? translitParagraphs[i].trim() : null,
                              styles.promptText,
                              false,
                              false
                            )}
                          </View>
                        );
                        
                        if (showTransliterations && i < translitParagraphs.length && translitParagraphs[i].trim()) {
                          elements.push(
                            <View key={`feedback-translit-${i}`} style={{ marginTop: 4, marginBottom: 12 }}>
                              {renderTextWithHighlighting(
                                translitParagraphs[i].trim(),
                                wordsUsed,
                                null,
                                styles.transliterationText,
                                true,
                                false
                              )}
                            </View>
                          );
                        }
                      }
                      
                      return elements;
                    })()}
                  </View>
                )}
              </View>
            )}
            
            {/* All Submissions History - for speaking activities */}
            {allSubmissions.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View>
                  {renderTextWithHighlighting(
                    'ಸಲ್ಲಿಕೆಗಳು ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆಗಳು',
                    wordsUsed,
                    transliterations.submissionsTitle,
                    [{ ...styles.sectionTitle, fontWeight: 'bold' }, { marginBottom: 16 }],
                    false,
                    true
                  )}
                </View>
                {showTransliterations && transliterations.submissionsTitle && (
                  renderTextWithHighlighting(
                    transliterations.submissionsTitle,
                    wordsUsed,
                    null,
                    [styles.transliterationText, { marginBottom: 16 }],
                    true,
                    false,
                    () => handleWordClick(transliterations.submissionsTitle)
                  )
                )}
                {allSubmissions.map((submission, index) => {
                  const submissionResult = submission.grading_result;
                  const submissionIndex = index;
                  const isExpanded = expandedSubmissions.has(index);
                  return (
                    <View key={index} style={[styles.gradingResultBox, { backgroundColor: colors.light, marginBottom: 20 }]}>
                      <TouchableOpacity
                        style={styles.submissionHeader}
                        onPress={() => {
                          const newExpanded = new Set(expandedSubmissions);
                          if (isExpanded) {
                            newExpanded.delete(index);
                          } else {
                            newExpanded.add(index);
                          }
                          setExpandedSubmissions(newExpanded);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          {renderTextWithHighlighting(
                            `ಸಲ್ಲಿಕೆ ${index + 1}`,
                            wordsUsed,
                            transliterations[`submission_${index}_title`] || (transliterations.submissionLabel ? `${transliterations.submissionLabel} ${index + 1}` : null),
                            [styles.gradingResultTitle, { color: colors.primary }],
                            false,
                            false
                          )}
                          {showTransliterations && (transliterations[`submission_${index}_title`] || transliterations.submissionLabel) && (
                            <Text style={[styles.transliterationText, { marginTop: 4 }]}>
                              {transliterations[`submission_${index}_title`] || `${transliterations.submissionLabel} ${index + 1}`}
                            </Text>
                          )}
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={20}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      
                      {isExpanded && submissionResult && (
                        <View style={styles.gradingResultContent}>
                          {/* Scores */}
                          <View style={styles.gradingScoresContainer}>
                            {submissionResult.score !== undefined && (
                              <View style={styles.gradingScoreItem}>
                                <View>
                                  {renderTextWithHighlighting(
                                    'ಒಟ್ಟು ಸ್ಕೋರ್:',
                                    wordsUsed,
                                    transliterations.totalScoreLabel,
                                    styles.gradingScoreLabel,
                                    false,
                                    true
                                  )}
                                </View>
                                {showTransliterations && transliterations.totalScoreLabel && (
                                  renderTextWithHighlighting(
                                    transliterations.totalScoreLabel,
                                    wordsUsed,
                                    null,
                                    styles.transliterationText,
                                    true,
                                    false,
                                    () => handleWordClick(transliterations.totalScoreLabel)
                                  )
                                )}
                                <Text style={styles.gradingScoreValue}>{submissionResult.score}%</Text>
                              </View>
                            )}
                            {submissionResult.fluency_score !== undefined && (
                              <View style={styles.gradingScoreItem}>
                                <View>
                                  {renderTextWithHighlighting(
                                    'ನಿರರ್ಗಳತೆ:',
                                    wordsUsed,
                                    transliterations.fluencyScoreLabel,
                                    styles.gradingScoreLabel,
                                    false,
                                    true
                                  )}
                                </View>
                                {showTransliterations && transliterations.fluencyScoreLabel && (
                                  renderTextWithHighlighting(
                                    transliterations.fluencyScoreLabel,
                                    wordsUsed,
                                    null,
                                    styles.transliterationText,
                                    true,
                                    false,
                                    () => handleWordClick(transliterations.fluencyScoreLabel)
                                  )
                                )}
                                <Text style={styles.gradingScoreValue}>{submissionResult.fluency_score}%</Text>
                              </View>
                            )}
                            {submissionResult.task_completion_score !== undefined && (
                              <View style={styles.gradingScoreItem}>
                                <View>
                                  {renderTextWithHighlighting(
                                    'ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ:',
                                    wordsUsed,
                                    transliterations.taskCompletionScoreLabel,
                                    styles.gradingScoreLabel,
                                    false,
                                    true
                                  )}
                                </View>
                                {showTransliterations && transliterations.taskCompletionScoreLabel && (
                                  renderTextWithHighlighting(
                                    transliterations.taskCompletionScoreLabel,
                                    wordsUsed,
                                    null,
                                    styles.transliterationText,
                                    true,
                                    false,
                                    () => handleWordClick(transliterations.taskCompletionScoreLabel)
                                  )
                                )}
                                <Text style={styles.gradingScoreValue}>{submissionResult.task_completion_score}%</Text>
                              </View>
                            )}
                          </View>
                          
                          {/* Transcript */}
                          {submission.transcript && submission.transcript.trim() && (
                            <View style={{ marginTop: 16 }}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ಪಠ್ಯ:',
                                  wordsUsed,
                                  transliterations.transcriptLabel,
                                  [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                                  false,
                                  true
                                )}
                              </View>
                              {showTransliterations && transliterations.transcriptLabel && (
                                renderTextWithHighlighting(
                                  transliterations.transcriptLabel,
                                  wordsUsed,
                                  null,
                                  [styles.transliterationText, { marginTop: 4, marginBottom: 12 }],
                                  true,
                                  false,
                                  () => handleWordClick(transliterations.transcriptLabel)
                                )
                              )}
                              {!showTransliterations && <View style={{ marginTop: 12 }} />}
                              {renderTextWithHighlighting(
                                submission.transcript,
                                wordsUsed,
                                null,
                                styles.gradingFeedbackText,
                                false,
                                false
                              )}
                            </View>
                          )}
                          
                          {/* Audio playback for submission */}
                          {submission.audio_uri && (
                            <View style={{ marginTop: 16 }}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ಆಡಿಯೋ:',
                                  wordsUsed,
                                  transliterations.audioLabel,
                                  [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: '600', marginBottom: 8 }],
                                  false,
                                  false
                                )}
                              </View>
                              {(() => {
                                const audioState = submissionAudioStates[submissionIndex] || { playing: false, position: 0, duration: 0 };
                                const progressPercentage = audioState.duration > 0 ? (audioState.position / audioState.duration) * 100 : 0;
                                
                                return (
                                  <View style={{ marginTop: 8, padding: 12, backgroundColor: '#F5F5F5', borderRadius: 8 }}>
                                    {/* Progress Bar */}
                                    <View style={{ marginBottom: 8 }}>
                                      <TouchableOpacity
                                        activeOpacity={1}
                                        onLayout={(e) => {
                                          const { width } = e.nativeEvent.layout;
                                          if (!submissionProgressBarWidthRefs.current[submissionIndex]) {
                                            submissionProgressBarWidthRefs.current[submissionIndex] = {};
                                          }
                                          submissionProgressBarWidthRefs.current[submissionIndex].width = width;
                                        }}
                                        onPress={(e) => {
                                          if (audioState.duration > 0 && submissionProgressBarWidthRefs.current[submissionIndex]?.width > 0) {
                                            const { locationX } = e.nativeEvent;
                                            const newPosition = (locationX / submissionProgressBarWidthRefs.current[submissionIndex].width) * audioState.duration;
                                            seekSubmissionAudio(submissionIndex, Math.max(0, Math.min(newPosition, audioState.duration)));
                                          }
                                        }}
                                        style={{ height: 20, justifyContent: 'center', paddingVertical: 8 }}
                                      >
                                        <View style={{ height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, position: 'relative' }}>
                                          <View 
                                            style={{ 
                                              height: 4, 
                                              backgroundColor: colors.primary, 
                                              borderRadius: 2,
                                              width: `${progressPercentage}%`
                                            }} 
                                          />
                                          <View
                                            style={{
                                              position: 'absolute',
                                              left: `${progressPercentage}%`,
                                              top: -6,
                                              width: 16,
                                              height: 16,
                                              borderRadius: 8,
                                              backgroundColor: colors.primary,
                                              marginLeft: -8,
                                            }}
                                          />
                                        </View>
                                      </TouchableOpacity>
                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                        <Text style={{ fontSize: 12, color: '#666' }}>{formatTime(audioState.position)}</Text>
                                        <Text style={{ fontSize: 12, color: '#666' }}>{formatTime(audioState.duration)}</Text>
                                      </View>
                                    </View>
                                    
                                    {/* Controls */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                      <TouchableOpacity
                                        style={{ padding: 8 }}
                                        onPress={() => replaySubmissionAudio(submissionIndex)}
                                      >
                                        <Ionicons name="reload" size={24} color={colors.primary} />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={{ padding: 8, backgroundColor: colors.primary, borderRadius: 20 }}
                                        onPress={() => {
                                          if (audioState.playing) {
                                            pauseSubmissionAudio(submissionIndex);
                                          } else {
                                            playSubmissionAudio(submissionIndex, submission.audio_uri);
                                          }
                                        }}
                                      >
                                        <Ionicons
                                          name={audioState.playing ? "pause" : "play"}
                                          size={24}
                                          color="#FFFFFF"
                                        />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                );
                              })()}
                            </View>
                          )}
                          
                          {/* Feedback */}
                          {submissionResult.feedback && (
                            <View style={{ marginTop: 16 }}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ವಿವರವಾದ ಪ್ರತಿಕ್ರಿಯೆ:',
                                  wordsUsed,
                                  transliterations.detailedFeedbackLabel,
                                  [styles.gradingFeedbackLabel, { fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                                false,
                                true
                                )}
                              </View>
                              {showTransliterations && transliterations.detailedFeedbackLabel && (
                                renderTextWithHighlighting(
                                  transliterations.detailedFeedbackLabel,
                                  wordsUsed,
                                  null,
                                  [styles.transliterationText, { marginTop: 4, marginBottom: 12 }],
                                  true,
                                  false,
                                  () => handleWordClick(transliterations.detailedFeedbackLabel)
                                )
                              )}
                              {!showTransliterations && <View style={{ marginTop: 12 }} />}
                              {(() => {
                                const feedbackText = submissionResult.feedback;
                                const feedbackTranslit = transliterations[`submission_${submissionIndex}_feedback`];
                                
                                // Split into paragraphs (reuse logic from main grading view)
                                let feedbackParagraphs = [];
                                if (feedbackText) {
                                  const doubleNewlineSplit = feedbackText.split(/\n\s*\n/).filter(p => p.trim());
                                  if (doubleNewlineSplit.length > 1) {
                                    feedbackParagraphs = doubleNewlineSplit;
                                  } else {
                                    const singleNewlineSplit = feedbackText.split(/\n/).filter(p => p.trim());
                                    feedbackParagraphs = singleNewlineSplit.length > 1 ? singleNewlineSplit : [feedbackText];
                                  }
                                }
                                
                                let translitParagraphs = [];
                                if (showTransliterations && feedbackTranslit) {
                                  const doubleNewlineSplit = feedbackTranslit.split(/\n\s*\n/).filter(p => p.trim());
                                  if (doubleNewlineSplit.length > 1) {
                                    translitParagraphs = doubleNewlineSplit;
                                  } else {
                                    const singleNewlineSplit = feedbackTranslit.split(/\n/).filter(p => p.trim());
                                    translitParagraphs = singleNewlineSplit.length > 1 ? singleNewlineSplit : [feedbackTranslit];
                                  }
                                }
                                
                                return feedbackParagraphs.map((para, idx) => (
                                  <View key={`submission-feedback-${submissionIndex}-${idx}`} style={{ marginBottom: 8 }}>
                                    {renderTextWithHighlighting(
                                      para.trim(),
                                      wordsUsed,
                                      idx < translitParagraphs.length ? translitParagraphs[idx].trim() : null,
                                      styles.gradingFeedbackText,
                                      false,
                                      false
                                    )}
                                    {showTransliterations && idx < translitParagraphs.length && translitParagraphs[idx].trim() && (
                                      <View style={{ marginTop: 4 }}>
                                        {renderTextWithHighlighting(
                                          translitParagraphs[idx].trim(),
                                          wordsUsed,
                                          null,
                                          styles.transliterationText,
                                          true,
                                          false
                                        )}
                                      </View>
                                    )}
                                  </View>
                                ));
                              })()}
                            </View>
                          )}
                          
                          {/* Required Words Feedback */}
                          {submissionResult.required_words_feedback && Object.keys(submissionResult.required_words_feedback).length > 0 && (
                            <View style={{ marginTop: 16 }}>
                              <View>
                                {renderTextWithHighlighting(
                                  'ಪದಗಳ ಬಳಕೆಯ ಬಗ್ಗೆ ಪ್ರತಿಕ್ರಿಯೆ:',
                                  wordsUsed,
                                  transliterations.wordUsageFeedbackLabel,
                                  [styles.gradingFeedbackLabel, { fontWeight: 'bold', fontSize: 17, marginBottom: 0 }],
                              false,
                              true
                                )}
                              </View>
                                {showTransliterations && transliterations.wordUsageFeedbackLabel && (
                                  renderTextWithHighlighting(
                                    transliterations.wordUsageFeedbackLabel,
                                    wordsUsed,
                                    null,
                                    [styles.transliterationText, { marginTop: 4, marginBottom: 12 }],
                                    true,
                                    false,
                                    () => handleWordClick(transliterations.wordUsageFeedbackLabel)
                                  )
                                )}
                              {!showTransliterations && <View style={{ marginTop: 12 }} />}
                              {Object.entries(submissionResult.required_words_feedback).map(([word, feedback], wordIdx) => (
                                <View key={wordIdx} style={{ marginTop: 8 }}>
                                  <Text style={[styles.gradingFeedbackText, { fontWeight: '600', color: colors.primary }]}>
                                    {word}:
                                  </Text>
                                  {renderTextWithHighlighting(
                                    feedback,
                                    wordsUsed,
                                    transliterations[`submission_${submissionIndex}_word_${word}_feedback`] || transliterations[`word_${word}_feedback`],
                                    styles.gradingFeedbackText,
                                    false,
                                    false
                                  )}
                                  {showTransliterations && (transliterations[`submission_${submissionIndex}_word_${word}_feedback`] || transliterations[`word_${word}_feedback`]) && (
                                    <Text style={styles.transliterationText}>
                                      {transliterations[`submission_${submissionIndex}_word_${word}_feedback`] || transliterations[`word_${word}_feedback`]}
                                    </Text>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {activityType === 'conversation' && (
          <View>

            {/* Conversation Activity (when activity is created) */}
            {activity && (
              <>
                <View style={{ marginBottom: 16 }}>
                  <View>
                    {renderTextWithHighlighting(
                      activity.activity_name || 'ಸಂಭಾಷಣೆ ಅಭ್ಯಾಸ',
                      wordsUsed,
                      null,
                      { ...styles.sectionTitle, fontWeight: 'bold' },
                      false,
                      true
                    )}
                  </View>
                  {showTransliterations && transliterations.activity_name && (
                    <Text 
                      style={[styles.transliterationText, { marginTop: 4, fontSize: 14 }]}
                      onPress={() => handleWordClick(transliterations.activity_name)}
                    >
                      {transliterations.activity_name}
                    </Text>
                  )}
                </View>

                {/* Speaker Profile for Conversation - Collapsible like tasks */}
                {activity._speaker_profile && (
                  <View style={[styles.textBox, { backgroundColor: '#F5F5F5', marginBottom: 16 }]}>
                    <TouchableOpacity
                      onPress={() => setSpeakerProfileExpanded(!speakerProfileExpanded)}
                      style={styles.taskHeader}
                    >
                      <View style={{ flex: 1 }}>
                        <View>
                          {renderTextWithHighlighting(
                            'ಮಾತನಾಡುವವರ ವಿವರ',
                            wordsUsed,
                            null,
                            { ...styles.sectionTitle, marginBottom: 0, fontWeight: 'bold' },
                            false,
                            true
                          )}
                        </View>
                        {showTransliterations && transliterations.speaker_profile_title && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.speaker_profile_title)}
                          >
                            {transliterations.speaker_profile_title}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={speakerProfileExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.primary}
                        style={{ marginLeft: 8 }}
                      />
                    </TouchableOpacity>
                    {speakerProfileExpanded && (
                      <View style={{ marginTop: 12 }}>
                        <View style={styles.taskItem}>
                          <View style={styles.taskText}>
                            <Text style={styles.taskTextContent}>
                              <Text style={{ fontWeight: 'bold' }}>ಹೆಸರು</Text>
                              {showTransliterations && transliterations.speaker_name_label && (
                                <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                  {' '}{transliterations.speaker_name_label}
                                </Text>
                              )}
                              <Text>: </Text>
                              {renderTextWithHighlighting(
                                activity._speaker_profile.name,
                                wordsUsed,
                                null,
                                {},
                                false,
                                false
                              )}
                            </Text>
                            {showTransliterations && transliterations.speaker_name && (
                              <Text 
                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                onPress={() => handleWordClick(transliterations.speaker_name)}
                              >
                                {transliterations.speaker_name}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.taskItem}>
                          <View style={styles.taskText}>
                            <Text style={styles.taskTextContent}>
                              <Text style={{ fontWeight: 'bold' }}>ಲಿಂಗ</Text>
                              {showTransliterations && transliterations.speaker_gender_label && (
                                <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                  {' '}{transliterations.speaker_gender_label}
                                </Text>
                              )}
                              <Text>: </Text>
                              {renderTextWithHighlighting(
                                activity._speaker_profile.gender,
                                wordsUsed,
                                null,
                                {},
                                false,
                                false
                              )}
                            </Text>
                            {showTransliterations && transliterations.speaker_gender && (
                              <Text 
                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                onPress={() => handleWordClick(transliterations.speaker_gender)}
                              >
                                {transliterations.speaker_gender}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.taskItem}>
                          <View style={styles.taskText}>
                            <Text style={styles.taskTextContent}>
                              <Text style={{ fontWeight: 'bold' }}>ವಯಸ್ಸು</Text>
                              {showTransliterations && transliterations.speaker_age_label && (
                                <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                  {' '}{transliterations.speaker_age_label}
                                </Text>
                              )}
                              <Text>: </Text>
                              {renderTextWithHighlighting(
                                activity._speaker_profile.age,
                                wordsUsed,
                                null,
                                {},
                                false,
                                false
                              )}
                            </Text>
                            {showTransliterations && transliterations.speaker_age && (
                              <Text 
                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                onPress={() => handleWordClick(transliterations.speaker_age)}
                              >
                                {transliterations.speaker_age}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.taskItem}>
                          <View style={styles.taskText}>
                            <Text style={styles.taskTextContent}>
                              <Text style={{ fontWeight: 'bold' }}>ನಗರ</Text>
                              {showTransliterations && transliterations.speaker_city_label && (
                                <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                  {' '}{transliterations.speaker_city_label}
                                </Text>
                              )}
                              <Text>: </Text>
                              {renderTextWithHighlighting(
                                activity._speaker_profile.city,
                                wordsUsed,
                                null,
                                {},
                                false,
                                false
                              )}
                            </Text>
                            {showTransliterations && transliterations.speaker_city && (
                              <Text 
                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                onPress={() => handleWordClick(transliterations.speaker_city)}
                              >
                                {transliterations.speaker_city}
                              </Text>
                            )}
                          </View>
                        </View>
                        {activity._speaker_profile.state && (
                          <View style={styles.taskItem}>
                            <View style={styles.taskText}>
                              <Text style={styles.taskTextContent}>
                                <Text style={{ fontWeight: 'bold' }}>ರಾಜ್ಯ</Text>
                                {showTransliterations && transliterations.speaker_state_label && (
                                  <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                    {' '}{transliterations.speaker_state_label}
                                  </Text>
                                )}
                                <Text>: </Text>
                                {renderTextWithHighlighting(
                                  activity._speaker_profile.state,
                                  wordsUsed,
                                  null,
                                  {},
                                  false,
                                  false
                                )}
                              </Text>
                              {showTransliterations && transliterations.speaker_state && (
                                <Text 
                                  style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                  onPress={() => handleWordClick(transliterations.speaker_state)}
                                >
                                  {transliterations.speaker_state}
                                </Text>
                              )}
                            </View>
                          </View>
                        )}
                        <View style={styles.taskItem}>
                          <View style={styles.taskText}>
                            <Text style={styles.taskTextContent}>
                              <Text style={{ fontWeight: 'bold' }}>ದೇಶ</Text>
                              {showTransliterations && transliterations.speaker_country_label && (
                                <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                  {' '}{transliterations.speaker_country_label}
                                </Text>
                              )}
                              <Text>: </Text>
                              {renderTextWithHighlighting(
                                activity._speaker_profile.country,
                                wordsUsed,
                                null,
                                {},
                                false,
                                false
                              )}
                            </Text>
                            {showTransliterations && transliterations.speaker_country && (
                              <Text 
                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                onPress={() => handleWordClick(transliterations.speaker_country)}
                              >
                                {transliterations.speaker_country}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.taskItem}>
                          <View style={styles.taskText}>
                            <Text style={styles.taskTextContent}>
                              <Text style={{ fontWeight: 'bold' }}>ಉಪಭಾಷೆ</Text>
                              {showTransliterations && transliterations.speaker_dialect_label && (
                                <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                  {' '}{transliterations.speaker_dialect_label}
                                </Text>
                              )}
                              <Text>: </Text>
                              {renderTextWithHighlighting(
                                activity._speaker_profile.dialect,
                                wordsUsed,
                                null,
                                {},
                                false,
                                false
                              )}
                            </Text>
                            {showTransliterations && transliterations.speaker_dialect && (
                              <Text 
                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                onPress={() => handleWordClick(transliterations.speaker_dialect)}
                              >
                                {transliterations.speaker_dialect}
                              </Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.taskItem}>
                          <View style={styles.taskText}>
                            <Text style={styles.taskTextContent}>
                              <Text style={{ fontWeight: 'bold' }}>ಹಿನ್ನೆಲೆ</Text>
                              {showTransliterations && transliterations.speaker_background_label && (
                                <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                  {' '}{transliterations.speaker_background_label}
                                </Text>
                              )}
                              <Text>: </Text>
                              {renderTextWithHighlighting(
                                activity._speaker_profile.background,
                                wordsUsed,
                                null,
                                {},
                                false,
                                false
                              )}
                            </Text>
                            {showTransliterations && transliterations.speaker_background && (
                              <Text 
                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                onPress={() => handleWordClick(transliterations.speaker_background)}
                              >
                                {transliterations.speaker_background}
                              </Text>
                            )}
                          </View>
                        </View>
                        {/* Conversation topic/theme description (from introduction) */}
                        {activity.introduction && (
                          <View style={[styles.taskItem, { marginTop: 16, paddingTop: 16, borderTopWidth: 1.5, borderTopColor: '#D0D0D0' }]}>
                            <View style={styles.taskText}>
                              <Text style={styles.taskTextContent}>
                                <Text style={{ fontWeight: 'bold' }}>ವಿಷಯ</Text>
                                {showTransliterations && transliterations.topic_label && (
                                  <Text style={[styles.transliterationText, { fontSize: 11, marginLeft: 4 }]}>
                                    {' '}{transliterations.topic_label}
                                  </Text>
                                )}
                                <Text>: </Text>
                                {renderTextWithHighlighting(
                                  activity.introduction,
                                  wordsUsed,
                                  null,
                                  {},
                                  false,
                                  false
                                )}
                              </Text>
                              {showTransliterations && transliterations.introduction && (
                                <Text 
                                  style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                  onPress={() => handleWordClick(transliterations.introduction)}
                                >
                                  {transliterations.introduction}
                                </Text>
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}


                {/* Tasks Display - Collapsible */}
                {conversationTasks.length > 0 && (
                  <View style={[styles.textBox, { backgroundColor: '#FFF9E6', marginBottom: 16 }]}>
                    <TouchableOpacity
                      onPress={() => setTasksExpanded(!tasksExpanded)}
                      style={styles.taskHeader}
                    >
                      <View style={{ flex: 1 }}>
                        <View>
                          {renderTextWithHighlighting(
                            'ಕಾರ್ಯಗಳು',
                            wordsUsed,
                            transliterations.tasks_title,
                            { ...styles.sectionTitle, marginBottom: 0, fontWeight: 'bold' },
                            false,
                            true
                          )}
                        </View>
                        {showTransliterations && transliterations.tasks_title && (
                          <Text 
                            style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                            onPress={() => handleWordClick(transliterations.tasks_title)}
                          >
                            {transliterations.tasks_title}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={tasksExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.primary}
                        style={{ marginLeft: 8 }}
                      />
                    </TouchableOpacity>
                    {tasksExpanded && (
                      <View style={{ marginTop: 12 }}>
                        {conversationTasks.map((task, index) => {
                          // Split task at colon to bold the label part
                          const colonIndex = task.indexOf(':');
                          const taskLabel = colonIndex !== -1 ? task.substring(0, colonIndex + 1) : '';
                          const taskDescription = colonIndex !== -1 ? task.substring(colonIndex + 1).trim() : task;
                          const taskTranslit = transliterations[`task_${index}`] || '';
                          const translitLabel = taskTranslit && colonIndex !== -1 ? taskTranslit.substring(0, taskTranslit.indexOf(':') + 1) : '';
                          const translitDescription = taskTranslit && colonIndex !== -1 ? taskTranslit.substring(taskTranslit.indexOf(':') + 1).trim() : taskTranslit;
                          
                          return (
                            <View key={index} style={styles.taskItem}>
                              <View style={styles.taskCheckbox}>
                                {tasksCompleted.has(index) ? (
                                  <Ionicons name="checkmark-circle" size={24} color="#50C878" />
                                ) : (
                                  <Ionicons name="ellipse-outline" size={24} color="#666" />
                                )}
                              </View>
                              <View style={styles.taskText}>
                                <Text style={styles.taskTextContent}>
                                  {taskLabel ? (
                                    <>
                                      <Text style={{ fontWeight: 'bold' }}>
                                        {taskLabel}
                                      </Text>
                                      {showTransliterations && translitLabel && (
                                        <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#666', marginTop: 2 }}>
                                          {translitLabel}
                                        </Text>
                                      )}
                                      {taskDescription ? (
                                        <>
                                          {' '}
                                          {renderTextWithHighlighting(
                                            taskDescription,
                                            wordsUsed,
                                            translitDescription,
                                            {},
                                            false,
                                            false
                                          )}
                                        </>
                                      ) : null}
                                    </>
                                  ) : (
                                    renderTextWithHighlighting(
                                      task,
                                      wordsUsed,
                                      taskTranslit,
                                      {},
                                      false,
                                      false
                                    )
                                  )}
                                </Text>
                                {showTransliterations && translitDescription && taskLabel && (
                                  <Text style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}>
                                    {translitDescription}
                                  </Text>
                                )}
                                {showTransliterations && taskTranslit && (
                                  <Text 
                                    style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                    onPress={() => handleWordClick(taskTranslit)}
                                  >
                                    {taskTranslit}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* Start Conversation Button */}
                {!conversationStarted && (
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.primary, marginBottom: 16 }]}
                    onPress={async () => {
                      setConversationStarted(true);
                      setMessageLoading(true);
                      setLoadingStage('generating_text');
                      
                      // Add loading indicator for AI's first message (agent initiates conversation)
                      const tempMessage = {
                        user_message: null, // No user message yet - agent starts
                        ai_response: null,
                        _loading: true,
                        timestamp: new Date().toISOString(),
                      };
                      setConversationMessages([tempMessage]);
                      
                      // Send empty message to trigger AI's first message (agent initiates conversation)
                      try {
                        const requestBody = {
                          message: '', // Empty message to trigger AI's first message
                        };
                        // Only include conversation_id and voice if they have valid values
                        if (conversationId !== null && conversationId !== undefined && conversationId !== '') {
                          requestBody.conversation_id = String(conversationId);
                        }
                        if (conversationVoice !== null && conversationVoice !== undefined && conversationVoice !== '') {
                          requestBody.voice = String(conversationVoice);
                        }
                        
                        setLoadingStage('generating_audio');
                        const response = await fetch(
                          `${API_BASE_URL}/api/activity/conversation/${language}`,
                          {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody),
                          }
                        );
                        
                        if (response.ok) {
                          const data = await response.json();
                          // Replace loading message with AI's first message (agent initiates)
                          if (data.response) {
                            const initialMessage = {
                              user_message: null, // No user message - agent started conversation
                              ai_response: data.response,
                              _audio_data: data._audio_data,
                              _voice_used: data._voice_used,
                              _speaker_profile: data._speaker_profile,
                              timestamp: tempMessage.timestamp,
                            };
                            setConversationMessages([initialMessage]);
                            
                            // Update conversation voice and speaker profile from response
                            if (data._voice_used) {
                              setConversationVoice(data._voice_used);
                            }
                            if (data._speaker_profile) {
                              setActivity(prev => ({
                                ...prev,
                                _speaker_profile: data._speaker_profile,
                                _voice_used: data._voice_used,
                                messages: [initialMessage],
                                ratings: prev?.ratings || [], // Preserve ratings if reopening
                              }));
                            } else {
                              // Update activity with initial message without overwriting speaker profile
                              setActivity(prev => ({
                                ...prev,
                                messages: [initialMessage],
                                ratings: prev?.ratings || [], // Preserve ratings if reopening
                              }));
                            }
                            
                            // Get transliterations for AI's first message only (no user message yet)
                            if (showTransliterations) {
                              const newTranslit = {};
                              newTranslit['ai_msg_0'] = await transliterateText(data.response);
                              setTransliterations(prev => ({ ...prev, ...newTranslit }));
                            }
                            
                            // Play AI response audio
                            if (data._audio_data && data._audio_data.audio_base64) {
                              await playConversationAudio(data._audio_data, 'ai_0');
                            }
                          }
                          
                          // Update conversation ID if returned
                          if (data.conversation_id) {
                            setConversationId(data.conversation_id);
                          }
                          
                          setMessageLoading(false);
                          setLoadingStage('');
                        } else {
                          // Error response - remove loading message and show error
                          setConversationMessages([]);
                          setConversationStarted(false);
                          setMessageLoading(false);
                          setLoadingStage('');
                          const errorText = await response.text();
                          console.error('Error starting conversation:', errorText);
                          Alert.alert('ದೋಷ', 'ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.');
                        }
                      } catch (error) {
                        // Error - remove loading message and reset state
                        setConversationMessages([]);
                        setConversationStarted(false);
                        setMessageLoading(false);
                        setLoadingStage('');
                        console.error('Error starting conversation:', error);
                        Alert.alert('ದೋಷ', 'ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.');
                      }
                    }}
                  >
                    <Text style={styles.submitButtonText}>ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ</Text>
                    {showTransliterations && transliterations.start_conversation_button && (
                      <Text style={[styles.transliterationText, { fontSize: 12, marginTop: 4, color: '#FFFFFF' }]}>
                        {transliterations.start_conversation_button}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* Conversation Messages - Simple Chat Interface */}
                {conversationStarted && (
                  <>
                    <View style={[styles.conversationBox, { maxHeight: 400, marginBottom: 16 }]}>
                      <ScrollView 
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 16 }}
                        showsVerticalScrollIndicator={true}
                      >
                        {conversationMessages.length === 0 && (
                          <View>
                            <Text style={styles.conversationHint}>
                              ಕನ್ನಡದಲ್ಲಿ ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ
                            </Text>
                            {showTransliterations && transliterations.conversation_hint && (
                              <Text 
                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12, textAlign: 'center' }]}
                                onPress={() => handleWordClick(transliterations.conversation_hint)}
                              >
                                {transliterations.conversation_hint}
                              </Text>
                            )}
                          </View>
                        )}
                        {conversationMessages.map((msg, index) => {
                          const hasUserMessage = !!(msg.user_message && typeof msg.user_message === 'string' && msg.user_message.trim());
                          const hasAiResponse = !!(msg.ai_response && typeof msg.ai_response === 'string' && msg.ai_response.trim());
                          
                          return (
                            <View key={index} style={{ marginBottom: 16 }}>
                              {/* User Message - only show if it exists and is not empty */}
                              {hasUserMessage ? (
                                <View style={[styles.userMessageBox, { backgroundColor: colors.light, alignSelf: 'flex-end', maxWidth: '80%' }]}>
                                  {renderTextWithHighlighting(
                                    msg.user_message,
                                    wordsUsed || [], // Ensure wordsUsed is always an array for highlighting and dictionary lookup
                                    null,
                                    styles.messageText,
                                    false,
                                    false
                                  )}
                                  {showTransliterations && transliterations[`user_msg_${index}`] ? (
                                    <Text 
                                      style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                      onPress={() => handleWordClick(transliterations[`user_msg_${index}`])}
                                    >
                                      {transliterations[`user_msg_${index}`]}
                                    </Text>
                                  ) : null}
                                </View>
                              ) : null}

                              {/* AI Response */}
                              {msg._loading ? (
                                <View style={[styles.aiMessageBox, { backgroundColor: '#F0F0F0', alignSelf: 'flex-start', maxWidth: '80%', marginTop: 8 }]}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                    <TouchableOpacity 
                                      style={{ marginLeft: 8 }}
                                      onPress={() => {
                                        const loadingText = loadingStage === 'generating_text' ? 'ಪಠ್ಯವನ್ನು ಉತ್ಪಾದಿಸಲಾಗುತ್ತಿದೆ...' : 
                                                           loadingStage === 'generating_audio' ? 'ಧ್ವನಿಯನ್ನು ಉತ್ಪಾದಿಸಲಾಗುತ್ತಿದೆ...' : 
                                                           'ಪ್ರತಿಕ್ರಿಯಿಸಲಾಗುತ್ತಿದೆ...';
                                        handleWordClick(loadingText);
                                      }}
                                    >
                                      <Text style={{ color: '#666', fontSize: 12 }}>
                                        {loadingStage === 'generating_text' ? 'ಪಠ್ಯವನ್ನು ಉತ್ಪಾದಿಸಲಾಗುತ್ತಿದೆ...' : 
                                         loadingStage === 'generating_audio' ? 'ಧ್ವನಿಯನ್ನು ಉತ್ಪಾದಿಸಲಾಗುತ್ತಿದೆ...' : 
                                         'ಪ್ರತಿಕ್ರಿಯಿಸಲಾಗುತ್ತಿದೆ...'}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                  {showTransliterations ? (
                                    <TouchableOpacity 
                                      style={{ marginLeft: 28, marginTop: 4 }}
                                      onPress={() => {
                                        const loadingTranslit = loadingStage === 'generating_text' ? 'paṭhyavannu utpādisalāguttide...' : 
                                                                loadingStage === 'generating_audio' ? 'dhvaniyannu utpādisalāguttide...' : 
                                                                'pratikriyisalāguttide...';
                                        handleWordClick(loadingTranslit);
                                      }}
                                    >
                                      <Text style={{ color: '#999', fontSize: 11 }}>
                                        {loadingStage === 'generating_text' ? 'paṭhyavannu utpādisalāguttide...' : 
                                         loadingStage === 'generating_audio' ? 'dhvaniyannu utpādisalāguttide...' : 
                                         'pratikriyisalāguttide...'}
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              ) : hasAiResponse ? (
                                <View style={[styles.aiMessageBox, { backgroundColor: '#F0F0F0', alignSelf: 'flex-start', maxWidth: '80%', marginTop: 8 }]}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    {msg._audio_data && msg._audio_data.audio_base64 ? (
                                      <TouchableOpacity
                                        onPress={() => playConversationAudio(msg._audio_data, `ai_${index}`)}
                                        style={[styles.audioPlayButtonSmall, { marginRight: 8 }]}
                                      >
                                        <Ionicons name="volume-high" size={16} color={colors.primary} />
                                      </TouchableOpacity>
                                    ) : null}
                                  </View>
                                  {renderTextWithHighlighting(
                                    msg.ai_response,
                                    wordsUsed || [], // Ensure wordsUsed is always an array for highlighting and dictionary lookup
                                    null,
                                    styles.messageText,
                                    false,
                                    false
                                  )}
                                  {showTransliterations && transliterations[`ai_msg_${index}`] ? (
                                    <Text 
                                      style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                      onPress={() => handleWordClick(transliterations[`ai_msg_${index}`])}
                                    >
                                      {transliterations[`ai_msg_${index}`]}
                                    </Text>
                                  ) : null}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Simple Chat Input */}
                    <View style={styles.conversationInputContainer}>
                      <TextInput
                        style={[styles.conversationInput, { flex: 1, marginRight: 8 }]}
                        placeholder="ನಿಮ್ಮ ಸಂದೇಶವನ್ನು ಕನ್ನಡದಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ..."
                        value={userAnswer}
                        onChangeText={setUserAnswer}
                        placeholderTextColor="#999"
                        multiline
                        onSubmitEditing={sendConversationMessage}
                        editable={!ratingLoading && !messageLoading && conversationStarted && conversationMessages.length > 0 && conversationMessages[0] && conversationMessages[0].ai_response}
                      />
                      <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: colors.primary }]}
                        onPress={sendConversationMessage}
                        disabled={!userAnswer.trim() || ratingLoading || messageLoading || !conversationStarted || !conversationMessages.length || !conversationMessages[0] || !conversationMessages[0].ai_response}
                      >
                        <Ionicons name="send" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Assessment Progress Indicator */}
                    {ratingLoading && (
                      <View style={[styles.gradingProgressBox, { backgroundColor: colors.light, marginTop: 16 }]}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.gradingProgressText, { color: colors.primary }]}>
                          ಮೌಲ್ಯಮಾಪನ ನಡೆಯುತ್ತಿದೆ...
                        </Text>
                      </View>
                    )}

                  </>
                )}

                {/* Conversation Rating Results - Multiple Submissions */}
                {conversationRatings.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <View>
                      <Text style={[styles.sectionTitle, { fontWeight: 'bold', marginBottom: 12 }]}>
                        ಸಲ್ಲಿಸಿದ ಮೌಲ್ಯಮಾಪನಗಳು
                      </Text>
                      {showTransliterations && transliterations.ratings_title && (
                        <Text 
                          style={[styles.transliterationText, { marginTop: -8, marginBottom: 8, fontSize: 12 }]}
                          onPress={() => handleWordClick(transliterations.ratings_title)}
                        >
                          {transliterations.ratings_title}
                        </Text>
                      )}
                    </View>
                    {conversationRatings.map((rating, ratingIndex) => {
                      const isExpanded = expandedRatings.has(ratingIndex);
                      return (
                        <View key={ratingIndex} style={[styles.gradingResultBox, { backgroundColor: colors.light, marginBottom: 12 }]}>
                          <TouchableOpacity
                            onPress={() => {
                              const newExpanded = new Set(expandedRatings);
                              if (isExpanded) {
                                newExpanded.delete(ratingIndex);
                              } else {
                                newExpanded.add(ratingIndex);
                              }
                              setExpandedRatings(newExpanded);
                            }}
                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.gradingResultTitle, { color: colors.primary }]}>
                                ಸಂಭಾಷಣೆಯ ಮೌಲ್ಯಮಾಪನ #{ratingIndex + 1}
                              </Text>
                              {showTransliterations && transliterations[`rating_title_${ratingIndex}`] && (
                                <Text 
                                  style={[styles.transliterationText, { marginTop: 2, fontSize: 11 }]}
                                  onPress={() => handleWordClick(transliterations[`rating_title_${ratingIndex}`])}
                                >
                                  {transliterations[`rating_title_${ratingIndex}`]}
                                </Text>
                              )}
                            </View>
                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-down'}
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          {isExpanded && (
                            <View>
                              <View style={styles.gradingScores}>
                                <View style={styles.gradingScoreItem}>
                                  <Text style={styles.gradingScoreLabel}>
                                    <Text style={{ fontWeight: 'bold' }}>ಒಟ್ಟು ಅಂಕ</Text>
                                    {showTransliterations && transliterations[`rating_overall_${ratingIndex}`] && (
                                      <Text style={[styles.transliterationText, { fontSize: 10, marginLeft: 4 }]}>
                                        ({transliterations[`rating_overall_${ratingIndex}`]})
                                      </Text>
                                    )}
                                    :
                                  </Text>
                                  <Text style={[styles.gradingScoreValue, { color: colors.primary }]}>
                                    {rating.score || 0}%
                                  </Text>
                                </View>
                                {showTransliterations && transliterations[`rating_overall_${ratingIndex}`] && (
                                  <Text style={[styles.transliterationText, { marginLeft: 0, marginTop: 2, fontSize: 11, marginBottom: 4 }]}>
                                    {transliterations[`rating_overall_${ratingIndex}`]}
                                  </Text>
                                )}
                                <View style={styles.gradingScoreItem}>
                                  <Text style={styles.gradingScoreLabel}>
                                    <Text style={{ fontWeight: 'bold' }}>ಶಬ್ದಕೋಶ</Text>
                                    {showTransliterations && transliterations[`rating_vocab_${ratingIndex}`] && (
                                      <Text style={[styles.transliterationText, { fontSize: 10, marginLeft: 4 }]}>
                                        ({transliterations[`rating_vocab_${ratingIndex}`]})
                                      </Text>
                                    )}
                                    :
                                  </Text>
                                  <Text style={styles.gradingScoreValue}>
                                    {rating.vocabulary_score || 0}%
                                  </Text>
                                </View>
                                {showTransliterations && transliterations[`rating_vocab_${ratingIndex}`] && (
                                  <Text style={[styles.transliterationText, { marginLeft: 0, marginTop: 2, fontSize: 11, marginBottom: 4 }]}>
                                    {transliterations[`rating_vocab_${ratingIndex}`]}
                                  </Text>
                                )}
                                <View style={styles.gradingScoreItem}>
                                  <Text style={styles.gradingScoreLabel}>
                                    <Text style={{ fontWeight: 'bold' }}>ವ್ಯಾಕರಣ</Text>
                                    {showTransliterations && transliterations[`rating_grammar_${ratingIndex}`] && (
                                      <Text style={[styles.transliterationText, { fontSize: 10, marginLeft: 4 }]}>
                                        ({transliterations[`rating_grammar_${ratingIndex}`]})
                                      </Text>
                                    )}
                                    :
                                  </Text>
                                  <Text style={styles.gradingScoreValue}>
                                    {rating.grammar_score || 0}%
                                  </Text>
                                </View>
                                {showTransliterations && transliterations[`rating_grammar_${ratingIndex}`] && (
                                  <Text style={[styles.transliterationText, { marginLeft: 0, marginTop: 2, fontSize: 11, marginBottom: 4 }]}>
                                    {transliterations[`rating_grammar_${ratingIndex}`]}
                                  </Text>
                                )}
                                <View style={styles.gradingScoreItem}>
                                  <Text style={styles.gradingScoreLabel}>
                                    <Text style={{ fontWeight: 'bold' }}>ನಿರರ್ಗಳತೆ</Text>
                                    {showTransliterations && transliterations[`rating_fluency_${ratingIndex}`] && (
                                      <Text style={[styles.transliterationText, { fontSize: 10, marginLeft: 4 }]}>
                                        ({transliterations[`rating_fluency_${ratingIndex}`]})
                                      </Text>
                                    )}
                                    :
                                  </Text>
                                  <Text style={styles.gradingScoreValue}>
                                    {rating.fluency_score || 0}%
                                  </Text>
                                </View>
                                {showTransliterations && transliterations[`rating_fluency_${ratingIndex}`] && (
                                  <Text style={[styles.transliterationText, { marginLeft: 0, marginTop: 2, fontSize: 11, marginBottom: 4 }]}>
                                    {transliterations[`rating_fluency_${ratingIndex}`]}
                                  </Text>
                                )}
                                <View style={styles.gradingScoreItem}>
                                  <Text style={styles.gradingScoreLabel}>
                                    <Text style={{ fontWeight: 'bold' }}>ಕಾರ್ಯ ಪೂರ್ಣಗೊಳಿಸುವಿಕೆ</Text>
                                    {showTransliterations && transliterations[`rating_task_${ratingIndex}`] && (
                                      <Text style={[styles.transliterationText, { fontSize: 10, marginLeft: 4 }]}>
                                        ({transliterations[`rating_task_${ratingIndex}`]})
                                      </Text>
                                    )}
                                    :
                                  </Text>
                                  <Text style={styles.gradingScoreValue}>
                                    {rating.task_completion_score || 0}%
                                  </Text>
                                </View>
                                {showTransliterations && transliterations[`rating_task_${ratingIndex}`] && (
                                  <Text style={[styles.transliterationText, { marginLeft: 0, marginTop: 2, fontSize: 11, marginBottom: 4 }]}>
                                    {transliterations[`rating_task_${ratingIndex}`]}
                                  </Text>
                                )}
                              </View>
                              
                              {/* General Feedback */}
                              {(rating.general_feedback || rating.feedback) && (
                                <View style={styles.gradingFeedback}>
                                  <Text style={styles.gradingFeedbackLabel}>
                                    <Text style={{ fontWeight: 'bold' }}>ಸಾಮಾನ್ಯ ಪ್ರತಿಕ್ರಿಯೆ</Text>
                                    :
                                  </Text>
                                  {showTransliterations && transliterations[`rating_general_${ratingIndex}`] && (
                                    <Text 
                                      style={[styles.transliterationText, { marginTop: 2, fontSize: 11, marginBottom: 4 }]}
                                      onPress={() => handleWordClick(transliterations[`rating_general_${ratingIndex}`])}
                                    >
                                      {transliterations[`rating_general_${ratingIndex}`]}
                                    </Text>
                                  )}
                                  {renderTextWithHighlighting(
                                    rating.general_feedback || rating.feedback,
                                    wordsUsed || [], // Ensure wordsUsed is always an array for dictionary lookup and highlighting
                                    transliterations[`rating_general_feedback_${ratingIndex}`] || transliterations[`rating_feedback_${ratingIndex}`],
                                    styles.gradingFeedbackText,
                                    false,
                                    false
                                  )}
                                  {showTransliterations && (transliterations[`rating_general_feedback_${ratingIndex}`] || transliterations[`rating_feedback_${ratingIndex}`]) && (
                                    <Text 
                                      style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                      onPress={() => handleWordClick(transliterations[`rating_general_feedback_${ratingIndex}`] || transliterations[`rating_feedback_${ratingIndex}`])}
                                    >
                                      {transliterations[`rating_general_feedback_${ratingIndex}`] || transliterations[`rating_feedback_${ratingIndex}`]}
                                    </Text>
                                  )}
                                </View>
                              )}
                              
                              {/* Targeted Feedback */}
                              {rating.targeted_feedback && (
                                <View style={[styles.gradingFeedback, { marginTop: 12 }]}>
                                  <Text style={styles.gradingFeedbackLabel}>
                                    <Text style={{ fontWeight: 'bold' }}>ಗುರಿ-ಕೇಂದ್ರಿತ ಪ್ರತಿಕ್ರಿಯೆ</Text>
                                    :
                                  </Text>
                                  {showTransliterations && transliterations[`rating_targeted_${ratingIndex}`] && (
                                    <Text 
                                      style={[styles.transliterationText, { marginTop: 2, fontSize: 11, marginBottom: 4 }]}
                                      onPress={() => handleWordClick(transliterations[`rating_targeted_${ratingIndex}`])}
                                    >
                                      {transliterations[`rating_targeted_${ratingIndex}`]}
                                    </Text>
                                  )}
                                  {renderTextWithHighlighting(
                                    rating.targeted_feedback,
                                    wordsUsed || [], // Ensure wordsUsed is always an array for dictionary lookup and highlighting
                                    transliterations[`rating_targeted_feedback_${ratingIndex}`],
                                    styles.gradingFeedbackText,
                                    false,
                                    false
                                  )}
                                  {showTransliterations && transliterations[`rating_targeted_feedback_${ratingIndex}`] && (
                                    <Text 
                                      style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                      onPress={() => handleWordClick(transliterations[`rating_targeted_feedback_${ratingIndex}`])}
                                    >
                                      {transliterations[`rating_targeted_feedback_${ratingIndex}`]}
                                    </Text>
                                  )}
                                </View>
                              )}
                              
                              {/* Task Assessment Feedback */}
                              {rating.task_assessment && Object.keys(rating.task_assessment).length > 0 && (
                                <View style={[styles.gradingFeedback, { marginTop: 12 }]}>
                                  <Text style={[styles.gradingFeedbackLabel, { fontWeight: 'bold' }]}>ಕಾರ್ಯಗಳ ಮೌಲ್ಯಮಾಪನ:</Text>
                                  {Object.entries(rating.task_assessment).map(([taskKey, assessment]) => {
                                    const taskIndex = parseInt(taskKey.split('_')[1]);
                                    const taskText = conversationTasks[taskIndex] || `ಕಾರ್ಯ ${taskIndex + 1}`;
                                    // Extract the main part before colon for highlighting
                                    const taskLabelMatch = taskText.match(/^([^:]+)/);
                                    const taskLabel = taskLabelMatch ? taskLabelMatch[1].trim() : taskText;
                                    return (
                                      <View key={taskKey} style={{ marginTop: 12, marginBottom: 8 }}>
                                        <TouchableOpacity 
                                          onPress={() => handleWordClick(taskLabel)}
                                          activeOpacity={0.7}
                                        >
                                          <Text style={[styles.gradingFeedbackLabel, { fontSize: 13, fontWeight: 'bold' }]}>
                                            {renderTextWithHighlighting(
                                              taskLabel,
                                              wordsUsed,
                                              null,
                                              { fontWeight: 'bold' },
                                              false,
                                              false
                                            )}
                                            :
                                          </Text>
                                        </TouchableOpacity>
                                        {showTransliterations && transliterations[`task_${taskIndex}`] && (
                                          <Text 
                                            style={[styles.transliterationText, { marginTop: 2, fontSize: 11, marginBottom: 4 }]}
                                            onPress={() => handleWordClick(transliterations[`task_${taskIndex}`])}
                                          >
                                            {transliterations[`task_${taskIndex}`]}
                                          </Text>
                                        )}
                                        {assessment.feedback && (
                                          <>
                                            <TouchableOpacity 
                                              onPress={() => handleWordClick('ಪ್ರತಿಕ್ರಿಯೆ')}
                                              activeOpacity={0.7}
                                            >
                                              <Text style={[styles.gradingFeedbackLabel, { fontSize: 12, marginTop: 4, fontWeight: 'bold' }]}>
                                                <Text style={{ fontWeight: 'bold' }}>ಪ್ರತಿಕ್ರಿಯೆ</Text>
                                                :
                                              </Text>
                                            </TouchableOpacity>
                                            {showTransliterations && transliterations[`task_feedback_label_${ratingIndex}`] && (
                                              <Text 
                                                style={[styles.transliterationText, { marginTop: 2, fontSize: 11, marginBottom: 4 }]}
                                                onPress={() => handleWordClick(transliterations[`task_feedback_label_${ratingIndex}`])}
                                              >
                                                {transliterations[`task_feedback_label_${ratingIndex}`]}
                                              </Text>
                                            )}
                                            {renderTextWithHighlighting(
                                              assessment.feedback,
                                              wordsUsed || [], // Ensure wordsUsed is always an array for dictionary lookup and highlighting
                                              transliterations[`task_assessment_${ratingIndex}_${taskKey}`],
                                              styles.gradingFeedbackText,
                                              false,
                                              false
                                            )}
                                            {showTransliterations && transliterations[`task_assessment_${ratingIndex}_${taskKey}`] && (
                                              <Text 
                                                style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}
                                                onPress={() => handleWordClick(transliterations[`task_assessment_${ratingIndex}_${taskKey}`])}
                                              >
                                                {transliterations[`task_assessment_${ratingIndex}_${taskKey}`]}
                                              </Text>
                                            )}
                                          </>
                                        )}
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

              </>
            )}
          </View>
        )}

        <View style={styles.actionButtons}>
          {activityType === 'writing' || activityType === 'conversation' || activityType === 'speaking' ? (
            // For writing, conversation, and speaking activities, always show submit button (can submit multiple times)
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: (gradingLoading || ratingLoading) ? '#999' : colors.primary },
              ]}
              onPress={(gradingLoading || ratingLoading) ? undefined : handleSubmit}
              disabled={gradingLoading || ratingLoading}
            >
              <Text style={styles.submitButtonText}>
                {(gradingLoading || ratingLoading) ? getSubmittingLabel(language) : getSubmitLabel(language)}
              </Text>
            </TouchableOpacity>
          ) : activityType === 'reading' || activityType === 'listening' ? (
            // Reading and listening activities have their submit buttons in their own sections
            null
          ) : !showResult ? (
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: gradingLoading ? '#999' : colors.primary },
              ]}
              onPress={gradingLoading ? undefined : handleSubmit}
              disabled={gradingLoading}
            >
              <Text style={styles.submitButtonText}>
                {gradingLoading ? getSubmittingLabel(language) : getSubmitLabel(language)}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: colors.primary }]}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>▶ ಮುಂದುವರಿಸಿ</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* API Details Modal */}
      <Modal
        visible={showApiModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowApiModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>API Request Details</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowApiModal(false)}
              >
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {/* Cumulative Totals - Show at top */}
              {allApiDetails.length > 0 && (() => {
                const cumulative = allApiDetails.reduce((acc, apiCall) => {
                  const tokenInfo = apiCall.tokenInfo || {};
                  const inputTokens = tokenInfo.input_tokens || tokenInfo.prompt_tokens || 0;
                  const outputTokens = tokenInfo.output_tokens || tokenInfo.completion_tokens || 0;
                  const inputCost = tokenInfo.input_cost || 0;
                  const outputCost = tokenInfo.output_cost || 0;
                  const textTotalCost = tokenInfo.total_cost || (inputCost + outputCost);
                  const ttsCost = apiCall.ttsCost || 0;
                  const totalCost = apiCall.totalCost || (textTotalCost + ttsCost);
                  
                  return {
                    totalInputTokens: acc.totalInputTokens + inputTokens,
                    totalOutputTokens: acc.totalOutputTokens + outputTokens,
                    totalInputCost: acc.totalInputCost + inputCost,
                    totalOutputCost: acc.totalOutputCost + outputCost,
                    totalTtsCost: acc.totalTtsCost + ttsCost,
                    totalCost: acc.totalCost + totalCost,
                    totalCalls: acc.totalCalls + 1,
                  };
                }, {
                  totalInputTokens: 0,
                  totalOutputTokens: 0,
                  totalInputCost: 0,
                  totalOutputCost: 0,
                  totalTtsCost: 0,
                  totalCost: 0,
                  totalCalls: 0,
                });

                return (
                  <View style={[styles.detailSection, { backgroundColor: '#F0F8FF', padding: 16, borderRadius: 8, marginBottom: 16 }]}>
                    <Text style={[styles.detailLabel, { fontSize: 18, fontWeight: 'bold', marginBottom: 12 }]}>
                      Cumulative Totals ({cumulative.totalCalls} API {cumulative.totalCalls === 1 ? 'Call' : 'Calls'})
                    </Text>
                    <View style={styles.tokenStatsContainer}>
                      <View style={styles.tokenStatRow}>
                        <Text style={styles.tokenStatLabel}>Total Input Tokens:</Text>
                        <Text style={[styles.tokenStatValue, { fontWeight: 'bold' }]}>
                          {cumulative.totalInputTokens.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.tokenStatRow}>
                        <Text style={styles.tokenStatLabel}>Total Output Tokens:</Text>
                        <Text style={[styles.tokenStatValue, { fontWeight: 'bold' }]}>
                          {cumulative.totalOutputTokens.toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.tokenStatRow}>
                        <Text style={styles.tokenStatLabel}>Total Input Cost:</Text>
                        <Text style={[styles.tokenStatValue, { fontWeight: 'bold' }]}>
                          ${cumulative.totalInputCost.toFixed(6)}
                        </Text>
                      </View>
                      <View style={styles.tokenStatRow}>
                        <Text style={styles.tokenStatLabel}>Total Output Cost:</Text>
                        <Text style={[styles.tokenStatValue, { fontWeight: 'bold' }]}>
                          ${cumulative.totalOutputCost.toFixed(6)}
                        </Text>
                      </View>
                      {cumulative.totalTtsCost > 0 && (
                        <View style={styles.tokenStatRow}>
                          <Text style={styles.tokenStatLabel}>Total TTS Cost:</Text>
                          <Text style={[styles.tokenStatValue, { fontWeight: 'bold' }]}>
                            ${cumulative.totalTtsCost.toFixed(6)}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.tokenStatRow, styles.totalCostRow]}>
                        <Text style={styles.totalCostLabel}>Grand Total Cost:</Text>
                        <Text style={[styles.totalCostValue, { fontSize: 18 }]}>
                          ${cumulative.totalCost.toFixed(6)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* All API Calls as Collapsible Cards */}
              {allApiDetails.length === 0 ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>No API calls recorded yet.</Text>
                </View>
              ) : (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailLabel, { fontSize: 16, fontWeight: 'bold', marginBottom: 12 }]}>
                    All API Calls:
                  </Text>
                  {allApiDetails.map((apiCall, index) => {
                    const isExpanded = expandedApiCards.has(apiCall.id);
                    const tokenInfo = apiCall.tokenInfo || {};
                    const inputTokens = tokenInfo.input_tokens || tokenInfo.prompt_tokens || 0;
                    const outputTokens = tokenInfo.output_tokens || tokenInfo.completion_tokens || 0;
                    const inputCost = tokenInfo.input_cost || 0;
                    const outputCost = tokenInfo.output_cost || 0;
                    const textTotalCost = tokenInfo.total_cost || (inputCost + outputCost);
                    const totalCost = apiCall.totalCost || (textTotalCost + (apiCall.ttsCost || 0));
                    const timestamp = apiCall.timestamp ? new Date(apiCall.timestamp).toLocaleString() : `Call ${index + 1}`;

                    return (
                      <View key={apiCall.id || index} style={[styles.submissionDebugSection, { marginBottom: 12 }]}>
                        <TouchableOpacity
                          style={styles.submissionDebugHeader}
                          onPress={() => {
                            const newExpanded = new Set(expandedApiCards);
                            if (isExpanded) {
                              newExpanded.delete(apiCall.id);
                            } else {
                              newExpanded.add(apiCall.id);
                            }
                            setExpandedApiCards(newExpanded);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.submissionDebugTitle}>
                              {apiCall.endpoint || `API Call ${index + 1}`}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                              {timestamp} • ${totalCost.toFixed(6)} • {inputTokens + outputTokens} tokens
                            </Text>
                          </View>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#666"
                          />
                        </TouchableOpacity>
                        
                        {isExpanded && (
                          <View style={styles.submissionDebugContent}>
                            {/* Parse Error */}
                            {apiCall.parseError && (
                              <View style={[styles.detailSection, styles.errorSection]}>
                                <Text style={styles.errorLabel}>⚠️ Parse Error:</Text>
                                <Text style={styles.errorText}>{apiCall.parseError}</Text>
                              </View>
                            )}

                            {/* TTS Error */}
                            {apiCall.ttsError && (
                              <View style={[styles.detailSection, styles.errorSection]}>
                                <Text style={styles.errorLabel}>🔊 TTS Error (No Audio Generated):</Text>
                                <Text style={styles.errorText}>{apiCall.ttsError}</Text>
                              </View>
                            )}

                            {/* Token Stats */}
                            {tokenInfo && (inputTokens > 0 || outputTokens > 0) && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Token Usage & Cost:</Text>
                                <View style={styles.tokenStatsContainer}>
                                  <View style={styles.tokenStatRow}>
                                    <Text style={styles.tokenStatLabel}>Input Tokens:</Text>
                                    <Text style={styles.tokenStatValue}>{inputTokens.toLocaleString()}</Text>
                                  </View>
                                  <View style={styles.tokenStatRow}>
                                    <Text style={styles.tokenStatLabel}>Output Tokens:</Text>
                                    <Text style={styles.tokenStatValue}>{outputTokens.toLocaleString()}</Text>
                                  </View>
                                  <View style={styles.tokenStatRow}>
                                    <Text style={styles.tokenStatLabel}>Input Cost:</Text>
                                    <Text style={styles.tokenStatValue}>${inputCost.toFixed(6)}</Text>
                                  </View>
                                  <View style={styles.tokenStatRow}>
                                    <Text style={styles.tokenStatLabel}>Output Cost:</Text>
                                    <Text style={styles.tokenStatValue}>${outputCost.toFixed(6)}</Text>
                                  </View>
                                  {apiCall.ttsCost > 0 && (
                                    <View style={styles.tokenStatRow}>
                                      <Text style={styles.tokenStatLabel}>TTS Cost:</Text>
                                      <Text style={styles.tokenStatValue}>${apiCall.ttsCost.toFixed(6)}</Text>
                                    </View>
                                  )}
                                  <View style={[styles.tokenStatRow, styles.totalCostRow]}>
                                    <Text style={styles.totalCostLabel}>Total Cost:</Text>
                                    <Text style={styles.totalCostValue}>${totalCost.toFixed(6)}</Text>
                                  </View>
                                </View>
                              </View>
                            )}

                            {/* Response Time */}
                            {apiCall.responseTime !== undefined && apiCall.responseTime !== null && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Response Time:</Text>
                                <Text style={styles.detailValue}>
                                  {apiCall.responseTime ? `${apiCall.responseTime.toFixed(2)}s` : 'N/A'}
                                </Text>
                              </View>
                            )}

                            {/* Endpoint */}
                            {apiCall.endpoint && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>API Endpoint:</Text>
                                <Text style={styles.detailValue}>{apiCall.endpoint}</Text>
                              </View>
                            )}

                            {/* Speaker Profile Context (for conversation) */}
                            {apiCall.speakerProfileContext && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Speaker Profile Context:</Text>
                                <View style={styles.promptBox}>
                                  <Text style={styles.promptText}>{apiCall.speakerProfileContext}</Text>
                                </View>
                              </View>
                            )}

                            {/* Selected Region, Formality, Topic */}
                            {(apiCall.selectedRegion || apiCall.formalityChoice || apiCall.topic) && (
                              <View style={styles.detailSection}>
                                {apiCall.selectedRegion && (
                                  <View style={{ marginBottom: 8 }}>
                                    <Text style={styles.detailLabel}>Selected Region:</Text>
                                    <Text style={styles.detailValue}>{apiCall.selectedRegion}</Text>
                                  </View>
                                )}
                                {apiCall.formalityChoice && (
                                  <View style={{ marginBottom: 8 }}>
                                    <Text style={styles.detailLabel}>Formality:</Text>
                                    <Text style={styles.detailValue}>{apiCall.formalityChoice}</Text>
                                  </View>
                                )}
                                {apiCall.topic && (
                                  <View>
                                    <Text style={styles.detailLabel}>Topic:</Text>
                                    <Text style={styles.detailValue}>{apiCall.topic}</Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {/* AI Prompt */}
                            {apiCall.prompt && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>AI Prompt:</Text>
                                <View style={styles.promptBox}>
                                  <Text style={styles.promptText}>{apiCall.prompt}</Text>
                                </View>
                              </View>
                            )}

                            {/* API Response */}
                            {apiCall.rawResponse && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>API Response:</Text>
                                <View style={styles.promptBox}>
                                  <Text style={styles.promptText}>{apiCall.rawResponse}</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Writing Activity Submissions Debug Sections */}
              {activityType === 'writing' && allSubmissions.length > 0 && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Submissions & Grading API Details:</Text>
                  {allSubmissions.map((submission, index) => {
                    const submissionApiDetails = submission.grading_result?.api_details;
                    const isExpanded = expandedDebugSubmissions.has(index);
                    
                    if (!submissionApiDetails) return null;
                    
                    return (
                      <View key={index} style={styles.submissionDebugSection}>
                        <TouchableOpacity
                          style={styles.submissionDebugHeader}
                          onPress={() => {
                            const newExpanded = new Set(expandedDebugSubmissions);
                            if (isExpanded) {
                              newExpanded.delete(index);
                            } else {
                              newExpanded.add(index);
                            }
                            setExpandedDebugSubmissions(newExpanded);
                          }}
                        >
                          <Text style={styles.submissionDebugTitle}>
                            Submission {index + 1} - Grading API Details
                          </Text>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#666"
                          />
                        </TouchableOpacity>
                        
                        {isExpanded && (
                          <View style={styles.submissionDebugContent}>
                            {/* Parse Error */}
                            {submissionApiDetails.parse_error && (
                              <View style={[styles.detailSection, styles.errorSection]}>
                                <Text style={styles.errorLabel}>⚠️ Parse Error:</Text>
                                <Text style={styles.errorText}>{submissionApiDetails.parse_error}</Text>
                              </View>
                            )}

                            {/* Token Stats */}
                            {submissionApiDetails.token_info && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Token Usage & Cost:</Text>
                                <View style={styles.tokenStatsContainer}>
                                  <View style={styles.tokenStatRow}>
                                    <Text style={styles.tokenStatLabel}>Input Tokens:</Text>
                                    <Text style={styles.tokenStatValue}>
                                      {submissionApiDetails.token_info.input_tokens?.toLocaleString() || 
                                       submissionApiDetails.token_info.prompt_tokens?.toLocaleString() || 0}
                                    </Text>
                                  </View>
                                  <View style={styles.tokenStatRow}>
                                    <Text style={styles.tokenStatLabel}>Output Tokens:</Text>
                                    <Text style={styles.tokenStatValue}>
                                      {submissionApiDetails.token_info.output_tokens?.toLocaleString() || 
                                       submissionApiDetails.token_info.completion_tokens?.toLocaleString() || 0}
                                    </Text>
                                  </View>
                                  <View style={styles.tokenStatRow}>
                                    <Text style={styles.tokenStatLabel}>Input Cost:</Text>
                                    <Text style={styles.tokenStatValue}>
                                      ${(submissionApiDetails.input_cost || submissionApiDetails.token_info?.input_cost || 0).toFixed(6)}
                                    </Text>
                                  </View>
                                  <View style={styles.tokenStatRow}>
                                    <Text style={styles.tokenStatLabel}>Output Cost:</Text>
                                    <Text style={styles.tokenStatValue}>
                                      ${(submissionApiDetails.output_cost || submissionApiDetails.token_info?.output_cost || 0).toFixed(6)}
                                    </Text>
                                  </View>
                                  <View style={[styles.tokenStatRow, styles.totalCostRow]}>
                                    <Text style={styles.totalCostLabel}>Total Cost:</Text>
                                    <Text style={styles.totalCostValue}>
                                      ${(submissionApiDetails.total_cost || submissionApiDetails.token_info?.total_cost || 0).toFixed(6)}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            )}

                            {/* Response Time */}
                            {submissionApiDetails.response_time !== undefined && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>Response Time:</Text>
                                <Text style={styles.detailValue}>
                                  {submissionApiDetails.response_time ? `${(submissionApiDetails.response_time).toFixed(2)}s` : 'N/A'}
                                </Text>
                              </View>
                            )}

                            {/* Endpoint */}
                            {submissionApiDetails.endpoint && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>API Endpoint:</Text>
                                <Text style={styles.detailValue}>{submissionApiDetails.endpoint}</Text>
                              </View>
                            )}

                            {/* AI Prompt */}
                            {submissionApiDetails.prompt && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>AI Prompt:</Text>
                                <View style={styles.promptBox}>
                                  <Text style={styles.promptText}>{submissionApiDetails.prompt}</Text>
                                </View>
                              </View>
                            )}

                            {/* API Response */}
                            {submissionApiDetails.raw_response && (
                              <View style={styles.detailSection}>
                                <Text style={styles.detailLabel}>API Response:</Text>
                                <View style={styles.promptBox}>
                                  <Text style={styles.promptText}>{submissionApiDetails.raw_response}</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Dictionary Modal */}
      <Modal
        visible={showDictionary}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDictionary(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dictionary</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowDictionary(false);
                  // Reset filters to default ("All" selected = empty arrays) when closing
                  setDictionaryMasteryFilter([]);
                  setDictionaryWordClassFilter([]);
                  setDictionaryLevelFilter([]);
                  setDictionaryFiltersExpanded(false);
                }}
              >
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            
            {/* Filters Section - Collapsible */}
            <View style={styles.dictionaryFiltersSection}>
              <TouchableOpacity
                style={styles.dictionaryFiltersHeader}
                onPress={() => setDictionaryFiltersExpanded(!dictionaryFiltersExpanded)}
              >
                <Text style={styles.dictionaryFiltersHeaderText}>Filters</Text>
                <Ionicons
                  name={dictionaryFiltersExpanded ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
              
              {dictionaryFiltersExpanded && (
                <>
                  {/* Mastery Filter */}
                  <View style={styles.dictionaryFilterGroup}>
                    <Text style={styles.dictionaryFilterGroupLabel}>Status</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.dictionaryFilterScroll}
                      contentContainerStyle={styles.dictionaryFilterContent}
                    >
                      {MASTERY_FILTERS.map((filter) => {
                        const isAll = filter.value === '';
                        const isSelected = isAll ? dictionaryMasteryFilter.length === 0 : dictionaryMasteryFilter.includes(filter.value);
                        return (
                          <TouchableOpacity
                            key={filter.value}
                            style={[
                              styles.dictionaryFilterChip,
                              {
                                backgroundColor: isSelected ? filter.color.bg : filter.color.bg + '20',
                                borderColor: filter.color.bg,
                              },
                            ]}
                            onPress={() => {
                              if (isAll) {
                                // "All" clicked - always set to empty array (deselect all specific filters)
                                setDictionaryMasteryFilter([]);
                              } else {
                                // Specific filter clicked
                                if (isSelected) {
                                  // Remove this filter
                                  const newFilters = dictionaryMasteryFilter.filter(f => f !== filter.value);
                                  // If no filters left, "All" is selected (empty array)
                                  setDictionaryMasteryFilter(newFilters);
                                } else {
                                  // Add this filter - if "All" was selected (empty array), replace with just this filter
                                  if (dictionaryMasteryFilter.length === 0) {
                                    // "All" was selected, now select only this filter
                                    setDictionaryMasteryFilter([filter.value]);
                                  } else {
                                    // Add to existing filters
                                    setDictionaryMasteryFilter([...dictionaryMasteryFilter, filter.value]);
                                  }
                                }
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.dictionaryFilterChipText,
                                {
                                  color: isSelected ? filter.color.text : filter.color.bg,
                                  fontWeight: isSelected ? '600' : '500',
                                },
                              ]}
                            >
                              {filter.emoji} {filter.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Word Class Filter */}
                  <View style={styles.dictionaryFilterGroup}>
                    <Text style={styles.dictionaryFilterGroupLabel}>Part of Speech</Text>
                    <View style={styles.dictionaryFilterWrapContainer}>
                      {WORD_CLASSES.map((cls) => {
                        const isAll = cls.value === 'All';
                        const isSelected = isAll ? dictionaryWordClassFilter.length === 0 : dictionaryWordClassFilter.includes(cls.value);
                        return (
                          <TouchableOpacity
                            key={cls.value}
                            style={[
                              styles.dictionaryFilterChip,
                              {
                                backgroundColor: isSelected ? cls.color.bg : cls.color.bg + '20',
                                borderColor: cls.color.bg,
                              },
                            ]}
                            onPress={() => {
                              if (isAll) {
                                // "All" clicked - always set to empty array (deselect all specific filters)
                                setDictionaryWordClassFilter([]);
                              } else {
                                // Specific filter clicked
                                if (isSelected) {
                                  // Remove this filter
                                  const newFilters = dictionaryWordClassFilter.filter(f => f !== cls.value);
                                  // If no filters left, "All" is selected (empty array)
                                  setDictionaryWordClassFilter(newFilters);
                                } else {
                                  // Add this filter - if "All" was selected (empty array), replace with just this filter
                                  if (dictionaryWordClassFilter.length === 0) {
                                    // "All" was selected, now select only this filter
                                    setDictionaryWordClassFilter([cls.value]);
                                  } else {
                                    // Add to existing filters
                                    setDictionaryWordClassFilter([...dictionaryWordClassFilter, cls.value]);
                                  }
                                }
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.dictionaryFilterChipText,
                                {
                                  color: isSelected ? cls.color.text : cls.color.bg,
                                  fontWeight: isSelected ? '600' : '500',
                                },
                              ]}
                            >
                              {cls.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Level Filter */}
                  <View style={styles.dictionaryFilterGroup}>
                    <Text style={styles.dictionaryFilterGroupLabel}>Level</Text>
                    <View style={styles.dictionaryFilterWrapContainer}>
                      {LEVELS.map((level) => {
                        const isAll = level === 'All';
                        const isSelected = isAll ? dictionaryLevelFilter.length === 0 : dictionaryLevelFilter.includes(level);
                        return (
                          <TouchableOpacity
                            key={level}
                            style={[
                              styles.dictionaryFilterChip,
                              {
                                backgroundColor: isSelected ? LEVEL_COLORS[level].bg : LEVEL_COLORS[level].bg + '20',
                                borderColor: LEVEL_COLORS[level].bg,
                              },
                            ]}
                            onPress={() => {
                              if (isAll) {
                                // "All" clicked - always set to empty array (deselect all specific filters)
                                setDictionaryLevelFilter([]);
                              } else {
                                // Specific filter clicked
                                if (isSelected) {
                                  // Remove this filter
                                  const newFilters = dictionaryLevelFilter.filter(f => f !== level);
                                  // If no filters left, "All" is selected (empty array)
                                  setDictionaryLevelFilter(newFilters);
                                } else {
                                  // Add this filter - if "All" was selected (empty array), replace with just this filter
                                  if (dictionaryLevelFilter.length === 0) {
                                    // "All" was selected, now select only this filter
                                    setDictionaryLevelFilter([level]);
                                  } else {
                                    // Add to existing filters
                                    setDictionaryLevelFilter([...dictionaryLevelFilter, level]);
                                  }
                                }
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.dictionaryFilterChipText,
                                {
                                  color: isSelected ? LEVEL_COLORS[level].text : LEVEL_COLORS[level].bg,
                                  fontWeight: isSelected ? '600' : '500',
                                },
                              ]}
                            >
                              {level}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
            </View>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search words..."
                value={dictionarySearch}
                onChangeText={(text) => {
                  setDictionarySearch(text);
                  // The useEffect will handle the search with filters
                }}
                placeholderTextColor="#999"
              />
              {dictionarySearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setDictionarySearch('');
                    setDictionaryResults([]);
                  }}
                  style={styles.clearSearchButton}
                >
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
            
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {(() => {
                
                // Combine wordsUsed (prioritized) with dictionary results
                let allWords = [];
                const wordsUsedIds = new Set((wordsUsed || []).map(w => w.id));
                
                // Add wordsUsed first (prioritized)
                if (wordsUsed && wordsUsed.length > 0) {
                  let filteredWordsUsed = [...wordsUsed];
                  if (dictionarySearch.trim()) {
                    const searchLower = dictionarySearch.toLowerCase();
                    const searchTerm = dictionarySearch; // Keep original for Kannada matching
                    filteredWordsUsed = filteredWordsUsed.filter(word => {
                      // Check English word
                      if (word.word?.toLowerCase().includes(searchLower) || 
                          word.english_word?.toLowerCase().includes(searchLower)) {
                        return true;
                      }
                      // Check Kannada - split by " /" and check each variant
                      if (word.kannada) {
                        const kannadaVariants = word.kannada.split(' /').map(v => v.trim());
                        if (kannadaVariants.some(v => v.includes(searchTerm))) {
                          return true;
                        }
                      }
                      // Check transliteration - split by " /" and check each variant
                      if (word.transliteration) {
                        const translitVariants = word.transliteration.split(' /').map(v => v.trim().toLowerCase());
                        if (translitVariants.some(v => v.includes(searchLower))) {
                          return true;
                        }
                      }
                      return false;
                    });
                  }
                  allWords = filteredWordsUsed;
                }
                
                // Add dictionary results that aren't already in wordsUsed
                if (dictionarySearch.trim() && dictionaryResults.length > 0) {
                  const additionalWords = dictionaryResults
                    .filter(word => !wordsUsedIds.has(word.id))
                    .map(word => ({
                      id: word.id,
                      word: word.english_word,
                      kannada: word.translation,
                      transliteration: word.transliteration,
                      word_class: word.word_class,
                      level: word.level,
                      mastery_level: word.mastery_level || 'new',
                      verb_transitivity: word.verb_transitivity || '',
                    }));
                  allWords = [...allWords, ...additionalWords];
                } else if (!dictionarySearch.trim()) {
                  // If no search, just show wordsUsed
                  allWords = wordsUsed || [];
                }
                
                if (dictionaryLoading) {
                  return (
                    <View style={styles.emptyState}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={styles.emptyStateText}>Searching...</Text>
                    </View>
                  );
                }
                
                if (allWords.length === 0) {
                  return (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No words found</Text>
                    </View>
                  );
                }
                
                // Sort: learning/review first, then mastered, then new
                const sortedWords = allWords.sort((a, b) => {
                  const aOrder = a.mastery_level === 'learning' || a.mastery_level === 'review' ? 0 
                    : a.mastery_level === 'mastered' ? 1 : 2;
                  const bOrder = b.mastery_level === 'learning' || b.mastery_level === 'review' ? 0 
                    : b.mastery_level === 'mastered' ? 1 : 2;
                  return aOrder - bOrder;
                });
                
                return sortedWords.map((word, index) => {
                const wordTransliteration = word.transliteration || transliterations[`word_${word.id}`] || '';
                const levelColors = {
                  'A1': { bg: '#FF4444', text: '#FFFFFF' },      // Red
                  'A2': { bg: '#FFA500', text: '#FFFFFF' },      // Orange
                  'B1': { bg: '#50C878', text: '#FFFFFF' },      // Green
                  'B2': { bg: '#14B8A6', text: '#FFFFFF' },      // Teal (same as conjunction)
                  'C1': { bg: '#4A90E2', text: '#FFFFFF' },      // Blue
                  'C2': { bg: '#9B59B6', text: '#FFFFFF' },      // Purple
                };
                const levelColor = word.level ? levelColors[word.level.toUpperCase()] : null;
                
                // Get mastery level colors
                const masteryColors = {
                  'new': { bg: '#999999', text: '#FFFFFF' },
                  'learning': { bg: '#4A90E2', text: '#FFFFFF' }, // Swapped: now blue
                  'review': { bg: '#FF9500', text: '#FFFFFF' }, // Swapped: now orange
                  'mastered': { bg: '#50C878', text: '#FFFFFF' },
                };
                const masteryLevel = word.mastery_level || 'new';
                const masteryColor = masteryColors[masteryLevel] || masteryColors['new'];
                const masteryLabel = masteryLevel === 'learning' || masteryLevel === 'review' 
                  ? 'Learning' 
                  : masteryLevel === 'mastered' 
                    ? 'Mastered' 
                    : 'New';
                
                return (
                  <View key={index} style={styles.dictionaryEntry}>
                    <View style={styles.dictionaryEntryHeader}>
                      <View style={styles.dictionaryWordMain}>
                        <View style={styles.dictionaryWordRow}>
                          <Text style={styles.dictionaryWordKannada}>{word.kannada}</Text>
                          <View style={[
                            styles.dictionaryTag,
                            { backgroundColor: masteryColor.bg, marginLeft: 8 }
                          ]}>
                            <Text style={[
                              styles.dictionaryTagText,
                              { color: masteryColor.text }
                            ]}>
                              {masteryLabel}
                            </Text>
                          </View>
                        </View>
                        {wordTransliteration && (
                          <Text style={styles.dictionaryTransliteration}>{wordTransliteration}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.dictionaryWordEnglish}>{word.word}</Text>
                    
                    {/* Additional descriptive info */}
                    <View style={styles.dictionaryDetails}>
                      {word.verb_transitivity && word.verb_transitivity !== 'N/A' && (() => {
                        const isTransitive = word.verb_transitivity.toLowerCase().includes('transitive');
                        const transitivityColor = isTransitive 
                          ? { bg: '#4A90E2', text: '#FFFFFF' }  // Blue for transitive
                          : { bg: '#9B59B6', text: '#FFFFFF' };  // Purple for intransitive
                        return (
                          <View style={[
                            styles.dictionaryTag,
                            { backgroundColor: transitivityColor.bg }
                          ]}>
                            <Text style={[
                              styles.dictionaryTagText,
                              { color: transitivityColor.text }
                            ]}>
                              {word.verb_transitivity}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    
                    <View style={styles.dictionaryMeta}>
                      {word.word_class && (
                        <View style={styles.dictionaryTag}>
                          <Text style={styles.dictionaryTagText}>{word.word_class}</Text>
                        </View>
                      )}
                      {word.level && (
                        <View style={[
                          styles.dictionaryTag,
                          levelColor && { backgroundColor: levelColor.bg }
                        ]}>
                          <Text style={[
                            styles.dictionaryTagText,
                            levelColor && { color: levelColor.text }
                          ]}>
                            {word.level.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })})()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  debugButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginLeft: 'auto', // Push to the right
  },
  boldText: {
    fontWeight: 'bold',
  },
  questionItem: {
    marginBottom: 24,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  storyTitleContainer: {
    marginTop: 0,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
  },
  storyTitleWrapper: {
    marginBottom: 8,
  },
  storyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  storyTitleTransliterationWrapper: {
    marginTop: 4,
  },
  storyTitleTransliteration: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4, // Reduced spacing to transliteration
  },
  sectionTransliteration: {
    marginTop: 0, // No top margin
    marginBottom: 16, // Space before story title or passage block
  },
  textBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  targetText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  promptText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  transliterationText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  questionsContainer: {
    marginTop: 20,
  },
  questionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  showAnswersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  showAnswersText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  boldText: {
    fontWeight: 'bold',
  },
  questionBox: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  optionContent: {
    flex: 1,
  },
  optionTransliteration: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  hintBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  hintLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  optionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderWidth: 2,
  },
  optionButtonCorrect: {
    borderWidth: 2,
    borderColor: '#50C878',
    backgroundColor: '#E8F8F0',
  },
  optionButtonIncorrect: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF0F0',
  },
  optionText: {
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
  },
  listeningBox: {
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  translationBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: '100%',
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  translationText: {
    fontSize: 16,
    color: '#666',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 10,
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  promptBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  promptText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
    marginBottom: 16,
  },
  requiredWordsBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  requiredWordsLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  wordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  wordTagText: {
    fontSize: 14,
    fontWeight: '600',
  },
  wordTagTranslit: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  gradingProgressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  gradingProgressText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  writingInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 150,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  exampleBox: {
    borderRadius: 8,
    padding: 16,
    marginTop: 10,
  },
  exampleLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  rubricSection: {
    borderRadius: 8,
    marginBottom: 20,
    overflow: 'hidden',
  },
  rubricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  rubricHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rubricContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  criteriaBox: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  criteriaLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  criteriaList: {
    marginTop: 4,
  },
  criteriaBulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  criteriaBullet: {
    fontSize: 16,
    color: '#1A1A1A',
    marginRight: 8,
    marginTop: 2,
    fontWeight: '600',
  },
  criteriaBulletText: {
    flex: 1,
  },
  criteriaText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  transcriptToggleText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  audioControlsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  audioControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    flex: 1,
  },
  audioControlButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  audioControlButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  audioPlayPauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioSeekContainer: {
    flex: 1,
  },
  audioTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  audioTimeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  seekBarContainer: {
    height: 40,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  seekBarTouchable: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  seekBarTrack: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
    width: '100%',
  },
  seekBarProgress: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  seekBarThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
    top: -6,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  audioReplayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  listeningParagraphContainer: {
    width: Dimensions.get('window').width - 40,
    marginHorizontal: 20,
  },
  audioPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  audioPlayButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paragraphIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  paragraphIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  paragraphNumberContainer: {
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  paragraphNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  gradingResultBox: {
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  gradingResultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  gradingScores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  gradingScoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 8,
  },
  gradingScoreLabel: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#666',
    marginRight: 8,
  },
  gradingScoreValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  gradingFeedback: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  gradingFeedbackLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  gradingFeedbackText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  gradingWordsFeedback: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  gradingWordsFeedbackLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  gradingWordFeedbackItem: {
    marginBottom: 12,
  },
  gradingWordFeedbackWord: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  gradingWordFeedbackText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  conversationBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  conversationHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  conversationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  conversationInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  responseBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultBox: {
    borderRadius: 12,
    padding: 20,
    margin: 20,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 18,
    fontWeight: '600',
  },
  actionButtons: {
    padding: 20,
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nextButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: '#1A1A1A',
    fontFamily: 'monospace',
  },
  wordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  wordChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  learnedWordChip: {
    backgroundColor: '#E8F8F0', // Light green for learned
  },
  learningWordChip: {
    backgroundColor: '#E8F4FD', // Light blue for learning
  },
  wordChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  promptBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  promptText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  errorSection: {
    backgroundColor: '#FFE8E8',
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#CC0000',
    lineHeight: 20,
  },
  tokenStatsContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  tokenStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  totalCostRow: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#4A90E2',
    marginTop: 4,
    paddingTop: 8,
  },
  totalCostContainer: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  tokenStatLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tokenStatValue: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  totalCostLabel: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: 'bold',
  },
  totalCostValue: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  errorResponseBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFAAAA',
  },
  errorResponseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CC0000',
    marginBottom: 6,
  },
  errorResponseText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  dictionaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    margin: 20,
    marginTop: 16,
  },
  dictionaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  dictionaryEntry: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  dictionaryEntryHeader: {
    marginBottom: 8,
  },
  dictionaryWordMain: {
    marginBottom: 4,
  },
  dictionaryWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  learningBadge: {
    backgroundColor: '#4A90E2', // Swapped: now blue for learning
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  learningBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerIconButtonActive: {
    backgroundColor: 'rgba(173, 216, 230, 0.4)', // Light blue background when active
  },
  dictionaryWordKannada: {
    fontSize: 20,
    color: '#1A1A1A',
    fontWeight: '600',
    marginBottom: 4,
  },
  dictionaryTransliteration: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  dictionaryWordEnglish: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  dictionaryDetails: {
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dictionaryDetailText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  dictionaryDetailLabel: {
    fontWeight: '600',
    color: '#333',
  },
  dictionaryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dictionaryTag: {
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  dictionaryTagText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 10,
  },
  clearSearchButton: {
    padding: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
  },
  questionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  showAnswersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  showAnswersText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  transliterationIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  transliterationIconText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  transliterationIconArrow: {
    fontSize: 12,
    color: '#FFFFFF',
    marginHorizontal: 4,
  },
  dictionaryFiltersSection: {
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dictionaryFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dictionaryFiltersHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dictionaryFilterGroup: {
    marginBottom: 12,
  },
  dictionaryFilterGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  dictionaryFilterScroll: {
    marginBottom: 0,
  },
  dictionaryFilterContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dictionaryFilterWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  dictionaryFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dictionaryFilterChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  submissionDebugSection: {
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  submissionDebugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F8F8',
  },
  submissionDebugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  submissionDebugContent: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  speakerProfileContainer: {
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    backgroundColor: '#F8F8F8',
  },
  speakerProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  speakerProfileHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  speakerProfileContent: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  speakerProfileRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  speakerProfileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 100,
  },
  speakerProfileValue: {
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 12,
  },
  topicButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
    minWidth: '45%',
  },
  topicButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taskCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  taskText: {
    flex: 1,
  },
  taskTextContent: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  conversationMessageContainer: {
    marginBottom: 16,
  },
  userMessageBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  aiMessageBox: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  aiMessageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
  },
  audioPlayButtonSmall: {
    padding: 4,
  },
  inputModeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  inputModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  inputModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultBox: {
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  scoreSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  validationToast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    backgroundColor: '#E63946',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  validationToastText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    flex: 1,
  },
  validationToastClose: {
    padding: 4,
    marginLeft: 10,
  },
});
