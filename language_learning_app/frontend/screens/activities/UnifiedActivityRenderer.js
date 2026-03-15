import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../components/SafeText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageContext } from '../../contexts/LanguageContext';
import { useActivityData } from './shared/hooks/useActivityData';
import { useGenerationCallbacks } from './shared/hooks/useGenerationCallbacks';
import { API_BASE_URL } from './shared/constants';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import { useActivityCompletion } from './shared/hooks/useActivityCompletion';
import {
  VocabularyDictionary,
  APIDebugModal,
  TopicSelectionModal,
  renderItem,
  itemStyles,
} from './shared/components';
import { ACTIVITY_COLORS } from './shared/constants';
import { normalizeText, isDevanagari } from './shared/utils/textProcessing';
import { useTranslationJob } from '../../contexts/TranslationJobContext';
import { useRecording } from './shared/hooks/useRecording';

const HEADER_LABELS = {
  transliteration: "Transliteration",
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
  translation: "Translation"
};

const HEADER_ICONS = {
  transliteration: 'swap-horizontal-outline',
  reading: 'book-outline',
  listening: 'headset-outline',
  writing: 'create-outline',
  speaking: 'mic-outline',
  translation: 'language-outline',
};

export default function UnifiedActivityRenderer({ route, navigation, themeColor }) {
  const insets = useSafeAreaInsets();
  const { activityId, fromHistory, activityData: routeActivityData, activityType = 'reading' } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  const routeLang = (route && route.params && route.params.language) || null;
  const language = routeLang || ctxLanguage || null;

  const genCallbacks = useGenerationCallbacks();
  const activityData = useActivityData(`unified/${activityType}`, language, activityId, fromHistory, routeActivityData, null, genCallbacks);

  // ── Listening SSE: poll for completed activity when sessionId is set ──
  useEffect(() => {
    if (!activityData.sessionId || activityType !== 'listening') return;
    const sid = activityData.sessionId;
    let cancelled = false;
    let eventSource = null;
    setListeningGenerationError(null);

    const connectSSE = () => {
      try {
        eventSource = new EventSource(`${API_BASE_URL}/api/activity/listening/progress/${sid}`);
        eventSource.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'status' && msg.message) {
              activityData.setLoadingStatus(msg.message);
            }
            if (msg.type === 'generation_complete') {
              // Fetch the completed activity
              fetchResult();
              if (eventSource) eventSource.close();
            }
          } catch (err) {
            console.log('[ListeningSSE] Parse error', err);
          }
        };
        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
          // Fallback: poll for the result
          setTimeout(() => { if (!cancelled) fetchResult(); }, 3000);
        };
      } catch (err) {
        // SSE not supported, fallback to polling
        setTimeout(() => { if (!cancelled) fetchResult(); }, 3000);
      }
    };

    const fetchResult = async () => {
      if (cancelled) return;
      try {
        const data = await activityData.fetchCompletedActivity(sid);
        if (data && data.activity) {
          activityData.setLoading(false);
          setListeningGenerationError(null);
          activityData.notifyGenerationComplete({
            title: data.activity.topic || data.activity.title || null,
            activityId: data.activity.activity_id ? String(data.activity.activity_id) : null,
            activityData: data.activity,
          });
        } else if (!cancelled) {
          // Still generating, retry
          setTimeout(() => fetchResult(), 3000);
        }
      } catch (err) {
        console.error('[ListeningSSE] Error fetching result:', err);
        activityData.setLoading(false);
        setListeningGenerationError(err.message || 'Activity generation failed.');
        activityData.notifyGenerationFailed(err.message);
      }
    };

    connectSSE();
    return () => {
      cancelled = true;
      if (eventSource) eventSource.close();
    };
  }, [activityData.sessionId]);

  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);
  const { complete } = useActivityCompletion(language, activityType);
  const { openModalWithPrefill, closeModal } = useTranslationJob();

  const [answers, setAnswers] = useState({});
  const [textAnswers, setTextAnswers] = useState({});
  
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(!fromHistory);
  const [gradingFeedback, setGradingFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  // Listening audio state — same shape as PlacementTestScreen so shared ItemRenderer works identically
  const [listeningAudio, setListeningAudio] = useState({});
  const [listeningGenerationError, setListeningGenerationError] = useState(null);
  const audioFetchedRef = useRef({});

  const {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    convertAudioToText,
  } = useRecording(language);

  const [activeRecordingItemId, setActiveRecordingItemId] = useState(null);

  const handleStartRecording = (itemId) => {
    setActiveRecordingItemId(itemId);
    startRecording();
  };

  const stopAndSaveAudio = async (itemId) => {
    try {
      const uri = await stopRecording();
      if (!uri) {
        setActiveRecordingItemId(null);
        return;
      }
      
      const result = await convertAudioToText(uri);
      if (result && result.audioBase64) {
        setAnswers(prev => ({
          ...prev,
          [itemId]: {
            audio_base64: result.audioBase64,
            audio_format: result.audioFormat || (Platform.OS === 'web' ? 'webm' : 'm4a'),
            transcript: result.transcriptText || ''
          }
        }));
      } else {
        Alert.alert('Error', 'Could not save recorded audio.');
      }
    } catch (err) {
      console.log('Error saving audio:', err);
      Alert.alert('Error', 'Could not save recorded audio.');
    } finally {
      setActiveRecordingItemId(null);
    }
  };

  const colors = themeColor || ACTIVITY_COLORS[activityType] || ACTIVITY_COLORS.reading;

  const handleTopicSelection = (selectedTopic) => {
    setShowTopicModal(false);
    activityData.loadActivity(selectedTopic);
  };

  useEffect(() => {
    if (fromHistory) {
      activityData.loadActivity();
    }
  }, []);

  useEffect(() => {
    if (activityData?.activity?.sections?.[0]?.items) {
      if (fromHistory) {
         if (activityData.activity.answers) {
             setAnswers(activityData.activity.answers);
             setTextAnswers(activityData.activity.answers);
             setShowResult(true);
             setShowAnswers(true);
         }
      }
    }
  }, [activityData?.activity]);

  // For listening activities, prefetch audio for all transcript items as soon as the activity is loaded
  useEffect(() => {
    if (activityType !== 'listening' || !activityData?.activity?.sections) return;
    const act = activityData.activity;
    const transcripts = [];
    (act.sections || []).forEach(sec => {
      (sec.items || []).forEach(it => {
        if (it.type === 'transcript') transcripts.push(it);
      });
    });
    transcripts.forEach(t => loadListeningAudio(t));
  }, [activityType, activityData?.activity, loadListeningAudio]);

  // Derive listening audio embedded on the activity (if backend TTS succeeded)
  const derivedListeningAudio = useMemo(() => {
    if (activityType !== 'listening' || !activityData?.activity?.sections) return {};
    const act = activityData.activity;
    const out = {};
    (act.sections || []).forEach(sec => {
      (sec.items || []).forEach(it => {
        if (it.type !== 'transcript') return;
        const b64 = it.audio_base64 || it.audioBase64;
        if (b64 && it.item_id) {
          out[it.item_id] = { loading: false, audioBase64: b64, error: null };
        }
      });
    });
    return out;
  }, [activityType, activityData?.activity]);

  // onLoadAudio for listening — mirrors PlacementTestScreen: if no embedded audio, generate it on demand via TTS endpoint
  const loadListeningAudio = useCallback(async (transcriptItem) => {
    if (activityType !== 'listening') return;
    const itemId = transcriptItem?.item_id;
    if (!itemId) return;

    // If backend already embedded audio, just cache it into state
    const directBase64 = transcriptItem.audio_base64 || transcriptItem.audioBase64;
    if (directBase64) {
      setListeningAudio(prev => ({
        ...prev,
        [itemId]: { loading: false, audioBase64: directBase64, error: null },
      }));
      return;
    }

    // Avoid duplicate fetches
    if (audioFetchedRef.current[itemId]) return;
    audioFetchedRef.current[itemId] = true;

    setListeningAudio(prev => ({
      ...prev,
      [itemId]: { loading: true, audioBase64: null, error: null },
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/placement-test/listening-audio/${language}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_text: transcriptItem.transcript_text || '',
          speakers: transcriptItem.speakers || [],
          dialogue: transcriptItem.dialogue || [],
        }),
      });
      if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);
      const data = await res.json();
      if (!data.audio_base64) throw new Error('Server returned no audio data');
      setListeningAudio(prev => ({
        ...prev,
        [itemId]: { loading: false, audioBase64: data.audio_base64, error: null },
      }));
    } catch (e) {
      console.warn('[UnifiedListening] TTS fetch error:', e.message);
      audioFetchedRef.current[itemId] = false; // allow retry
      setListeningAudio(prev => ({
        ...prev,
        [itemId]: { loading: false, audioBase64: null, error: e.message },
      }));
    }
  }, [activityType, language]);

  // Merged listening audio: embedded on activity + any runtime state from Load Audio / TTS
  const listeningAudioResolved = activityType === 'listening'
    ? { ...derivedListeningAudio, ...listeningAudio }
    : {};

  // Dictionary integration — interactive text with word click + transliteration
  const renderInteractiveText = (text, style = {}, enableWordClick = false, transliterationText = null, transliterationStyle = null) => {
    const safeText = normalizeText(text);
    let textComponent;

    if (!enableWordClick) {
      textComponent = <SafeText style={style}>{safeText}</SafeText>;
    } else {
      const isArabicScript = (str) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || "");
      const words = safeText.split(/(\s+|[.,!?;:\-()[\]{}""'']+)/);
      const hasArabicScript = isArabicScript(safeText);
      const urduFontStyle = hasArabicScript ? { fontFamily: 'Noto Nastaliq Urdu' } : {};
      const combinedStyle = hasArabicScript ? [style, urduFontStyle] : style;
      
      textComponent = (
        <Text style={combinedStyle}>
          {words.map((word, idx) => {
            const isWord = word.trim() && !/^[\s.,!?;:\-()[\]{}""'']+$/.test(word);
            if (!isWord) return <Text key={idx} style={urduFontStyle}>{word}</Text>;
            return (
              <Text
                key={idx}
                style={[{ color: style.color }, urduFontStyle]}
                onPress={() => dictionary.handleWordClick(word.trim(), language)}
              >
                {word}
              </Text>
            );
          })}
        </Text>
      );
    }
    
    if (transliteration.showTransliterations && transliterationText) {
      const translitStyle = transliterationStyle || itemStyles.transliterationText;
      return (
        <View style={itemStyles.textWithTransliteration}>
          {textComponent}
          <SafeText style={translitStyle}>{transliterationText}</SafeText>
        </View>
      );
    }
    return textComponent;
  };

  const calculateScore = () => {
    const act = activityData.activity;
    if (!act || !act.sections || !act.sections[0]) return 0;
    const items = act.sections[0].items || [];

    let totalGradable = 0;
    let correctCount = 0;

    items.forEach(item => {
        if (item.type === 'multiple_choice' || item.type === 'translation_choice' || item.type === 'translation_choice_reverse' || item.type === 'transliteration_choice') {
            totalGradable++;
            if (answers[item.item_id] === item.correct_index) correctCount++;
        } else if (item.type === 'free_response') {
            totalGradable++;
            const val = textAnswers[item.item_id] || answers[item.item_id] || "";
            if (val.trim().length > (item.min_words || 2)) correctCount++;
        } else if (item.type === 'speaking_prompt') {
            totalGradable++;
            const val = answers[item.item_id];
            if (val && val.audio_base64) correctCount++;
        } else if (item.type === 'conversation_task') {
            totalGradable++;
            const val = answers[item.item_id];
            if (val && val.isFinished && val.completedTaskIndices?.length > 0) {
              const fraction = val.completedTaskIndices.length / (item.tasks?.length || 1);
              correctCount += fraction;
            }
        }
    });

    if (totalGradable === 0) return 1;
    return correctCount / totalGradable;
  };

  const handleSubmit = async () => {
    const finalAnswers = { ...answers, ...textAnswers };
    setAnswers(finalAnswers);
    setSubmitting(true);
    setGradingFeedback(null);

    const act = activityData.activity;
    const section = act?.sections?.[0];
    let items = (section && Array.isArray(section.items)) ? section.items : [];
    if (!items.length && Array.isArray(act?.sections)) {
      items = act.sections.flatMap(s => Array.isArray(s?.items) ? s.items : []);
    }

    let finalScore = 0;

    if (activityType === 'writing') {
      const freeResponseItems = items.filter(i => i.type === 'free_response');
      const userText = freeResponseItems.map(i => (finalAnswers[i.item_id] || '').trim()).filter(Boolean).join('\n\n');
      const writingPrompt = freeResponseItems.map((i, idx) => `${idx + 1}. ${i.prompt_native || i.prompt_en || ''}`).join('\n\n');
      let requiredWords = (act._words_used_data || []).slice(0, 10).map(w => w.translation || w.english_word || '').filter(Boolean);
      if (requiredWords.length === 0) requiredWords = ['response'];
      if (userText && writingPrompt && requiredWords.length > 0) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/activity/writing/${language}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_text: userText,
              writing_prompt: writingPrompt,
              required_words: requiredWords,
              evaluation_criteria: section?.instruction_en || 'Use appropriate vocabulary and grammar. Write clearly and coherently.',
              learned_words: [],
              learning_words: act._words_used_data || [],
            }),
          });
          const data = await res.json();
          if (data && typeof data.score === 'number') {
            finalScore = data.score / 100;
            setGradingFeedback(data.feedback || null);
          } else {
            finalScore = calculateScore();
          }
        } catch (e) {
          console.warn('Writing grading API error:', e);
          finalScore = calculateScore();
        }
      } else {
        finalScore = calculateScore();
      }
    } else if (activityType === 'speaking') {
      const speakingItems = items.filter(i => i.type === 'speaking_prompt');
      const audioItems = speakingItems.filter(i => {
        const a = finalAnswers[i.item_id];
        return a && a.audio_base64;
      });
      if (audioItems.length > 0) {
        try {
          const scores = [];
          let firstFeedback = null;
          for (const item of audioItems) {
            const a = finalAnswers[item.item_id];
            const res = await fetch(`${API_BASE_URL}/api/activity/speaking/${language}/grade`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audio_base64: a.audio_base64,
                audio_format: a.audio_format || 'webm',
                speaking_topic: act.topic || 'Speaking practice',
                tasks: speakingItems.map(i => i.prompt_native || i.prompt_en || 'Respond in the target language'),
                required_words: (act._words_used_data || []).slice(0, 5).map(w => w.translation || w.english_word || '').filter(Boolean).length > 0
                  ? (act._words_used_data || []).slice(0, 5).map(w => w.translation || w.english_word || '').filter(Boolean)
                  : ['practice'],
                learned_words: [],
                learning_words: act._words_used_data || [],
              }),
            });
            const data = await res.json();
            if (data && typeof data.score === 'number') {
              scores.push(data.score / 100);
              if (data.feedback && !firstFeedback) firstFeedback = data.feedback;
            }
          }
          if (scores.length > 0) {
            finalScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (firstFeedback) setGradingFeedback(firstFeedback);
          } else {
            finalScore = calculateScore();
          }
        } catch (e) {
          console.warn('Speaking grading API error:', e);
          finalScore = calculateScore();
        }
      } else {
        finalScore = calculateScore();
      }
    } else {
      finalScore = calculateScore();
    }

    setScore(finalScore);
    setShowResult(true);
    setSubmitting(false);

    let wordUpdates = [];
    if (act?._words_used_data) {
       wordUpdates = act._words_used_data.map(word => ({
         word_id: word.id,
         correct: finalScore > 0.5
       }));
    }

    await complete({
      score: finalScore,
      wordUpdates,
      activityData: { ...act, answers: finalAnswers },
      activityId: act?.activity_id || null
    });
  };

  // Build the config object for the shared ItemRenderer (same shape as PlacementTestScreen for listening)
  // renderText accepts optional third arg: transliterationText — show under native script when Aa is on
  const itemRendererConfig = {
    answers,
    setAnswers,
    sectionColor: colors.primary,
    showResult,
    showAnswers,
    language,
    renderText: (text, style, transliterationText, transliterationStyle) => renderInteractiveText(text, style, true, transliterationText ?? null, transliterationStyle ?? null),
    getTextValue: (itemId) => textAnswers[itemId] || answers[itemId] || '',
    onTextChange: (itemId, val) => setTextAnswers(prev => ({ ...prev, [itemId]: val })),
    onStartRecording: handleStartRecording,
    onStopRecording: stopAndSaveAudio,
    isRecordingItem: (itemId) => activeRecordingItemId === itemId && isRecording,
    isSavingItem: (itemId) => activeRecordingItemId === itemId && isProcessing,
    listeningAudio: activityType === 'listening' ? listeningAudioResolved : {},
    onLoadAudio: activityType === 'listening' ? loadListeningAudio : undefined,
    showDialogue: false,
  };

  // ----- RENDER CORE LOGIC -----

  const renderContent = () => {
    if (activityData.loading && !activityData.activity) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <SafeText style={styles.loadingText}>
            Generating {language ? language.charAt(0).toUpperCase() + language.slice(1) : ''} Activity...
          </SafeText>
        </View>
      );
    }

    if (activityData.error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <SafeText style={styles.errorText}>{activityData.error}</SafeText>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => activityData.loadActivity()}>
            <SafeText style={styles.retryButtonText}>Retry</SafeText>
          </TouchableOpacity>
        </View>
      );
    }

    if (listeningGenerationError && !activityData.activity) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="volume-mute-outline" size={48} color="#EF4444" />
          <SafeText style={styles.errorText}>Listening activity could not be generated</SafeText>
          <SafeText style={[styles.errorText, { fontSize: 14, marginTop: 8, opacity: 0.9 }]}>{listeningGenerationError}</SafeText>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={() => { setListeningGenerationError(null); setShowTopicModal(true); }}>
            <SafeText style={styles.retryButtonText}>Try again</SafeText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: '#6B7280', marginTop: 8 }]} onPress={() => navigation.goBack()}>
            <SafeText style={styles.retryButtonText}>Back</SafeText>
          </TouchableOpacity>
        </View>
      );
    }

    if (!activityData.activity) return null;

    const act = activityData.activity;
    const titleObj = act.topic || 'Practice';
    const section = act.sections && act.sections[0] ? act.sections[0] : null;

    // Normalize items — support current sections schema and all older flat schemas
    let items = [];
    if (section && Array.isArray(section.items)) {
      // Current schema: sections → items
      items = section.items;
    } else if (act.sections && Array.isArray(act.sections)) {
      // Sections array exists but no items on first section — flatten all sections
      items = act.sections.flatMap(s => Array.isArray(s.items) ? s.items : []);
    } else if (Array.isArray(act.questions)) {
      // Old flat reading/listening schema: { questions: [...], story: "..." }
      items = act.questions.map((q, i) => ({
        ...q,
        item_id: q.item_id || `q${i}`,
        type: q.type || 'multiple_choice',
        correct_index: q.correct_index ?? q.correct,
      }));
      if (act.story) items.unshift({ type: 'passage', passage_text: act.story, passage_title: act.story_name || 'Passage', item_id: 'p1' });
    } else if (Array.isArray(act.words)) {
      // Old transliteration flat schema: { words: [{ native, options, correct }] }
      items = act.words.map((w, i) => ({
        item_id: w.item_id || `tl${i}`,
        type: 'transliteration_choice',
        source_phrase: w.native || w.source_phrase || '',
        question_en: w.question_en || 'How is this pronounced?',
        options: w.options || [],
        correct_index: w.correct_index ?? w.correct ?? 0,
      }));
    } else if (Array.isArray(act.prompts)) {
      // Old speaking/writing flat schema
      items = act.prompts.map((p, i) => ({
        item_id: p.item_id || `pr${i}`,
        type: activityType === 'speaking' ? 'speaking_prompt' : 'free_response',
        prompt_native: p.prompt_native || p.prompt || '',
        prompt_en: p.prompt_en || '',
      }));
    }
    // Guard: ensure items is always an array
    if (!Array.isArray(items)) items = [];

    // Resolve transliteration key for this item (section schema vs legacy flat schema)
    const firstIsPassage = items.length > 0 && items[0].type === 'passage';
    const useSectionKeys = !!(section && Array.isArray(section.items));
    const getTransliterationForItem = (item, index, field) => {
      if (useSectionKeys) return transliteration.transliterations[`s0_i${index}_${field}`];
      if (field === 'passage') return index === 0 ? transliteration.transliterations['story'] : undefined;
      if (field === 'passageTitle') return index === 0 ? transliteration.transliterations['storyName'] : undefined;
      if (field === 'question') return transliteration.transliterations[`question_${index - (firstIsPassage ? 1 : 0)}`];
      if (field && field.startsWith('opt')) {
        const oi = parseInt(field.replace('opt', ''), 10);
        const qIndex = index - (firstIsPassage ? 1 : 0);
        return transliteration.transliterations[`option_${qIndex}_${oi}`];
      }
      return transliteration.transliterations[`s0_i${index}_${field}`];
    };
    const getDisplayText = (item, index, field) => {
      if (language !== 'urdu') return null;
      if (useSectionKeys) return transliteration.nativeScriptRenderings[`s0_i${index}_${field}`] || null;
      if (field === 'passage') return index === 0 ? (transliteration.nativeScriptRenderings['story'] || null) : null;
      if (field === 'passageTitle') return index === 0 ? (transliteration.nativeScriptRenderings['storyName'] || null) : null;
      if (field === 'question') return transliteration.nativeScriptRenderings[`question_${index - (firstIsPassage ? 1 : 0)}`] || null;
      if (field && field.startsWith('opt')) {
        const oi = parseInt(field.replace('opt', ''), 10);
        const qIndex = index - (firstIsPassage ? 1 : 0);
        return transliteration.nativeScriptRenderings[`option_${qIndex}_${oi}`] || null;
      }
      return transliteration.nativeScriptRenderings[`s0_i${index}_${field}`] || null;
    };
    const QUESTION_ITEM_TYPES = ['multiple_choice', 'translation_choice', 'translation_choice_reverse', 'transliteration_choice', 'free_response', 'speaking_prompt'];
    const getQuestionNumber = (idx) => {
      let n = 0;
      for (let i = 0; i <= idx; i++) {
        if (QUESTION_ITEM_TYPES.includes(items[i]?.type)) n++;
      }
      return n;
    };
    const itemConfig = { ...itemRendererConfig, getTransliterationForItem, getDisplayText, getQuestionNumber };

    return (
      <View style={styles.contentContainer}>

        {section?.instruction_en && (
            <SafeText style={styles.instructionText}>{section.instruction_en}</SafeText>
        )}
        {section?.instruction_native && renderInteractiveText(
          (language === 'urdu' && isDevanagari(section.instruction_native))
            ? (transliteration.nativeScriptRenderings['s0_instruction'] || '')
            : section.instruction_native,
          styles.instructionText,
          true,
          transliteration.transliterations['s0_instruction']
        )}

        {/* Use shared ItemRenderer for each item */}
        {items.map((item, index) => (
          <React.Fragment key={item.item_id || `item-${index}`}>
            {renderItem(item, index, itemConfig)}

            {/* Collapsible transcript view directly under the listening playback card */}
            {activityType === 'listening' && item.type === 'transcript' && (
              <View style={{ marginBottom: 16 }}>
                <TouchableOpacity
                  style={styles.transcriptToggle}
                  onPress={() => setShowTranscript(prev => !prev)}
                >
                  <Ionicons
                    name={showTranscript ? 'chatbubbles' : 'chatbubbles-outline'}
                    size={20}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <SafeText style={[styles.transcriptToggleText, { color: colors.primary, flex: 1 }]}>
                    {showTranscript ? 'Hide full transcript' : 'Show full transcript'}
                  </SafeText>
                  <Ionicons
                    name={showTranscript ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                {showTranscript && (
                  <View style={styles.transcriptCard}>
                    {(() => {
                      const tItem = item;
                      const speakers = tItem.speakers || [];
                      const dialogue = tItem.dialogue || [];
                      const speakerColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
                      const itemIndex = index;
                      const keyPrefix = `s0_i${itemIndex}`;

                      return (
                        <View style={{ marginBottom: 4 }}>
                          {speakers.length > 0 && (
                            <View style={styles.transcriptSpeakerLegend}>
                              {speakers.map((sp, i) => {
                                const color = speakerColors[i % speakerColors.length];
                                const speakerKey = `${keyPrefix}_speaker${i}`;
                                const speakerName =
                                  (language === 'urdu' &&
                                    transliteration.nativeScriptRenderings[speakerKey]) ||
                                  sp.name ||
                                  '';
                                const speakerTranslit =
                                  transliteration.transliterations[speakerKey] || '';
                                return (
                                  <View
                                    key={i}
                                    style={[
                                      styles.transcriptSpeakerPill,
                                      { backgroundColor: color + '18' },
                                    ]}
                                  >
                                    <Ionicons
                                      name={sp.gender === 'male' ? 'man-outline' : 'woman-outline'}
                                      size={14}
                                      color={color}
                                    />
                                    <View>
                                      <SafeText
                                        style={[
                                          styles.transcriptSpeakerName,
                                          { color },
                                        ]}
                                      >
                                        {speakerName}
                                      </SafeText>
                                      {!!speakerTranslit && (
                                        <SafeText style={styles.transcriptSpeakerTranslit}>
                                          {speakerTranslit}
                                        </SafeText>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          )}

                          <View style={styles.transcriptDialogue}>
                            {dialogue.map((line, li) => {
                              const idx = line.speaker_index ?? 0;
                              const color = speakerColors[idx % speakerColors.length];
                              const sp = speakers[idx];
                              const isRight = idx % 2 === 1;
                              const dialKey = `${keyPrefix}_dial${li}`;
                              const lineDisplayText =
                                (language === 'urdu' &&
                                  transliteration.nativeScriptRenderings[dialKey]) ||
                                line.text ||
                                '';
                              const lineTranslit =
                                transliteration.transliterations[dialKey] || '';

                              return (
                                <View
                                  key={li}
                                  style={[
                                    styles.transcriptLine,
                                    isRight && styles.transcriptLineRight,
                                  ]}
                                >
                                  {!isRight && (
                                    <Ionicons
                                      name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'}
                                      size={14}
                                      color={color}
                                      style={{ marginTop: 3 }}
                                    />
                                  )}
                                  <View
                                    style={[
                                      styles.transcriptBubble,
                                      { borderColor: color + '40', backgroundColor: color + '08' },
                                      isRight && styles.transcriptBubbleRight,
                                    ]}
                                  >
                                    <SafeText style={styles.transcriptBubbleText}>
                                      {lineDisplayText}
                                    </SafeText>
                                    {!!lineTranslit && (
                                      <SafeText style={styles.transcriptBubbleTranslit}>
                                        {lineTranslit}
                                      </SafeText>
                                    )}
                                  </View>
                                  {isRight && (
                                    <Ionicons
                                      name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'}
                                      size={14}
                                      color={color}
                                      style={{ marginTop: 3 }}
                                    />
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })()}
                  </View>
                )}
              </View>
            )}
          </React.Fragment>
        ))}

        {!showResult && items.length > 0 && (
          <TouchableOpacity 
            style={[styles.submitButton, { backgroundColor: colors.primary }]} 
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <ActivityIndicator size="small" color="#FFF" />
                <SafeText style={styles.submitButtonText}>Grading…</SafeText>
              </>
            ) : (
              <>
                <SafeText style={styles.submitButtonText}>Submit Answers</SafeText>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        )}

        {showResult && (
          <View style={[styles.resultBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
            <SafeText style={[styles.resultTitle, { color: colors.primary }]}>Activity Complete!</SafeText>
            <SafeText style={[styles.resultScore, { color: colors.primary }]}>{Math.round(score * 100)}% Correct</SafeText>
            {gradingFeedback ? (
              <SafeText style={styles.gradingFeedback}>{gradingFeedback}</SafeText>
            ) : null}
            
            <View style={styles.resultActions}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: colors.primary }]} 
                onPress={() => setShowAnswers(true)}
              >
                <Ionicons name="eye-outline" size={18} color="#FFF" />
                <SafeText style={styles.actionButtonText}>Review Answers</SafeText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#6B7280' }]} 
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={18} color="#FFF" />
                <SafeText style={styles.actionButtonText}>Back to Practice</SafeText>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Ionicons name={HEADER_ICONS[activityType] || 'help-outline'} size={20} color="#FFF" style={{ marginLeft: 8 }} />
        <SafeText style={styles.headerTitle}>{HEADER_LABELS[activityType] || 'Practice'}</SafeText>
        
        <View style={styles.headerToolsRow}>
          {activityData.activity && (
            <TouchableOpacity 
              style={[styles.headerIconButton, transliteration.showTransliterations && styles.headerIconButtonActive]} 
              onPress={() => transliteration.setShowTransliterations(prev => !prev)}
            >
              <SafeText style={styles.headerIconButtonAa}>Aa</SafeText>
            </TouchableOpacity>
          )}

          {activityData.activity && (
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={() => dictionary.setShowDictionary(true)}
            >
              <Ionicons name="book-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
          
          {activityData.activity && (
            <TouchableOpacity 
              style={styles.headerIconButton} 
              onPress={() => activityData.setShowApiModal(true)}
            >
              <Ionicons name="bug-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {renderContent()}
      </ScrollView>

      {/* Shared Modals & Components */}
      {showTopicModal && !fromHistory && (
        <TopicSelectionModal 
          visible={showTopicModal}
          onClose={() => {
            if (!activityData.activity) navigation.goBack();
            setShowTopicModal(false);
          }}
          onSelectTopic={handleTopicSelection}
          color={colors.primary}
          language={language}
          activityType={activityType}
        />
      )}


      {activityData.showApiModal && (
        <APIDebugModal 
          visible={activityData.showApiModal}
          onClose={() => activityData.setShowApiModal(false)}
          allApiDetails={activityData.allApiDetails}
        />
      )}

      {dictionary.showDictionary && (
        <VocabularyDictionary
          onClose={() => dictionary.setShowDictionary(false)}
          initialSearchMode={true}
          autoFocus={!dictionary.initialSearchQuery}
          language={dictionary.dictionaryLanguage || language}
          initialSearchQuery={dictionary.initialSearchQuery}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
    marginLeft: 16,
  },
  headerToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  headerIconButtonAa: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  topicText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  instructionText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 20,
    marginTop: 8,
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 6,
  },
  transcriptToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  transcriptSpeakerLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  transcriptSpeakerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  transcriptSpeakerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  transcriptSpeakerTranslit: {
    fontSize: 11,
    color: '#6B7280',
  },
  transcriptDialogue: {
    gap: 8,
  },
  transcriptLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    maxWidth: '90%',
  },
  transcriptLineRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  transcriptBubble: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  transcriptBubbleRight: {
    borderBottomRightRadius: 4,
  },
  transcriptBubbleText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
  },
  transcriptBubbleTranslit: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FEE2E2',
    margin: 20,
    borderRadius: 12,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
    fontSize: 15,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  resultBox: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    marginTop: 10,
    marginBottom: 40,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 20,
  },
  gradingFeedback: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 22,
    textAlign: 'left',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});
