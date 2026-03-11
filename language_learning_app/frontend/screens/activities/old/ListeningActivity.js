import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../components/SafeText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageContext } from '../../contexts/LanguageContext';
import { useActivityData } from './shared/hooks/useActivityData';
import { useGenerationCallbacks } from './shared/hooks/useGenerationCallbacks';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import { useAudio } from './shared/hooks/useAudio';
import { useTTSProgress } from './shared/hooks/useTTSProgress';
import { useActivityCompletion } from './shared/hooks/useActivityCompletion';
import { VocabularyDictionary, APIDebugModal, AudioPlayer, TopicSelectionModal } from './shared/components';
import TextImportModal from '../../components/TextImportModal';
import { useTranslationJob } from '../../contexts/TranslationJobContext';
import { ACTIVITY_COLORS } from './shared/constants';
import { normalizeText } from './shared/utils/textProcessing';
import { 
  getQuestionLabel, 
  getSubmitLabel,
  getListeningHeaderLabel,
  getSpeakerDetailsLabel,
  getSpeakerNameLabel,
  getSpeakerGenderLabel,
  getSpeakerAgeLabel,
  getYourScoreLabel,
  getCorrectAnswersLabel,
  getSpeakerCityLabel,
  getSpeakerStateLabel,
  getSpeakerCountryLabel,
  getSpeakerDialectLabel,
  getSpeakerBackgroundLabel,
  getSpeakerFormalityLabel,
  getShowTranscriptLabel,
  getHideTranscriptLabel,
  getShowAnswersLabel,
  getHideAnswersLabel,
  getListenToAllLabel,
  getStopAutoPlayLabel,
  getParagraphLabel,
  getOfLabel,
  formatParagraphLabel,
  getImportVocabFromTranscriptLabel,
} from '../../constants/ui_labels';

/**
 * ListeningActivity Component
 * Handles listening comprehension with audio playback and questions
 * Language-agnostic design with full transliteration, dictionary, and debug support
 */
export default function ListeningActivity({ route, navigation, themeColor }) {
  const insets = useSafeAreaInsets();
  const { activityId, fromHistory, activityData: routeActivityData } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  const routeLang = (route && route.params && route.params.language) || null;
  // Prefer the language explicitly passed via route (activity's language), then context
  const language = routeLang || ctxLanguage || null;

  // Use shared hooks
  const genCallbacks = useGenerationCallbacks();
  const activityData = useActivityData('listening', language, activityId, fromHistory, routeActivityData, null, genCallbacks);
  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);
  const audio = useAudio();
  const ttsProgress = useTTSProgress(activityData.sessionId);  // Real-time TTS progress
  const { complete } = useActivityCompletion(language, 'listening');
  const { openModalWithPrefill, closeModal } = useTranslationJob();

  // Listening-specific state
  const [selectedOptions, setSelectedOptions] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [speakerProfileExpanded, setSpeakerProfileExpanded] = useState(false);
  const [dialogueExpanded, setDialogueExpanded] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(!fromHistory);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Listen to All functionality
  const [isListeningToAll, setIsListeningToAll] = useState(false);
  const listenToAllStartIndexRef = useRef(null);
  const wasPlayingRef = useRef(false);  // Track if audio was playing before

  const colors = themeColor || ACTIVITY_COLORS.listening;
  const paragraphScrollViewRef = useRef(null);
  const [ttsComplete, setTtsComplete] = useState(false);

  const handleTopicSelection = (selectedTopic) => {
    setShowTopicModal(false);
    activityData.loadActivity(selectedTopic);
  };

  // Debug: Watch sessionId changes
  useEffect(() => {
    console.log('[ListeningActivity] sessionId changed:', activityData.sessionId);
  }, [activityData.sessionId]);

  // Update local progress state from SSE and handle TTS completion
  useEffect(() => {
    console.log('[ListeningActivity] TTS Progress Update:', {
      hasProgress: !!ttsProgress.progress,
      progressKeys: ttsProgress.progress ? Object.keys(ttsProgress.progress).length : 0,
      paragraphCount: ttsProgress.paragraphCount,
      isComplete: ttsProgress.isComplete,
      loading: activityData.loading,
      hasSessionId: !!activityData.sessionId,
      sessionId: activityData.sessionId
    });
    
    if (ttsProgress.progress && Object.keys(ttsProgress.progress).length > 0) {
      activityData.setTtsProgress(ttsProgress.progress);
      
      // Calculate completed paragraphs
      const completed = Object.values(ttsProgress.progress).filter(status => status === 'complete').length;
      const total = Object.keys(ttsProgress.progress).length;
      
      console.log('[ListeningActivity] Progress:', { completed, total });
      
      // Update loading status based on actual progress
      if (activityData.loading) {
        if (completed === 0) {
          activityData.setLoadingStatus('Starting audio generation...');
          activityData.updateTrayStatus?.('Starting audio generation...');
        } else if (completed < total) {
          activityData.setLoadingStatus(`Generating audio: ${completed} of ${total} paragraphs complete...`);
          activityData.updateTrayStatus?.(`Generating audio: ${completed} of ${total}...`);
        } else if (completed === total) {
          activityData.setLoadingStatus('All audio complete! Loading activity...');
          activityData.updateTrayStatus?.('All audio complete! Loading...');
        }
      }
    }
    
    if (ttsProgress.paragraphCount > 0 && ttsProgress.paragraphCount > activityData.paragraphCount) {
      // Sync paragraph count when backend sends update_count (e.g. actual 18 vs initial 5)
      activityData.setParagraphCount(ttsProgress.paragraphCount);
      console.log('[ListeningActivity] Set paragraph count:', ttsProgress.paragraphCount);
      
      if (!ttsProgress.progress || Object.keys(ttsProgress.progress).length === 0) {
        const initialProgress = {};
        for (let i = 0; i < ttsProgress.paragraphCount; i++) {
          initialProgress[i] = 'pending';
        }
        activityData.setTtsProgress(initialProgress);
        console.log(`[ListeningActivity] Initialized ${ttsProgress.paragraphCount} paragraphs as pending`);
      }
    }
    
    // When TTS is complete, fetch the completed activity (with retry if still generating)
    if (ttsProgress.isComplete && !ttsComplete && activityData.sessionId) {
      console.log('[ListeningActivity] TTS Complete! Fetching final activity...');
      setTtsComplete(true);
      activityData.setLoadingStatus('Finalizing activity...');
      activityData.updateTrayStatus?.('Finalizing activity...');

      const pollForResult = (retriesLeft = 10) => {
        activityData.fetchCompletedActivity(activityData.sessionId)
          .then(data => {
            if (data) {
              console.log('[ListeningActivity] Activity fetched successfully');
              activityData.setLoadingStatus('Activity ready!');
              activityData.updateTrayStatus?.('Activity ready!');
              const act = data.activity || {};
              const derivedTitle = act.activity_name || act.passage_name || act.title || act.topic || null;
              activityData.notifyGenerationComplete({
                title: derivedTitle,
                activityId: act.id || null,
                activityData: act,
              });
              setTimeout(() => {
                activityData.setLoading(false);
              }, 300);
            } else if (retriesLeft > 0) {
              activityData.setLoadingStatus('Loading activity...');
              setTimeout(() => pollForResult(retriesLeft - 1), 2000);
            } else {
              activityData.notifyGenerationFailed('Activity took too long to load');
              activityData.setLoading(false);
            }
          })
          .catch(error => {
            console.error('[ListeningActivity] Error fetching activity:', error);
            activityData.notifyGenerationFailed(error.message);
            activityData.setLoading(false);
          });
      };
      pollForResult();
    }
  }, [ttsProgress.progress, ttsProgress.paragraphCount, ttsProgress.isComplete, ttsComplete, activityData.sessionId]);

  useEffect(() => {
    if (fromHistory) {
      activityData.loadActivity();
    }
  }, []);

  // Load audio when activity is loaded (only when component is mounted and has valid data)
  useEffect(() => {
    if (!activityData.activity || !activityData.activity._audio_data) {
      return;
    }
    
    const audioDataList = activityData.activity._audio_data || [];
    
    // Additional safety check: ensure we have valid audio data before loading
    if (!Array.isArray(audioDataList) || audioDataList.length === 0) {
      console.warn('[Audio] No audio data available to load');
      return;
    }
    
    console.log('[Audio] Loading audio data:', audioDataList.length, 'paragraphs');
    
    audioDataList.forEach((audioData, index) => {
      if (audioData && audioData.audio_base64) {
        // Validate base64 data exists and has reasonable length
        if (typeof audioData.audio_base64 === 'string' && audioData.audio_base64.length > 1000) {
          console.log(`[Audio] Loading paragraph ${index}, base64 length:`, audioData.audio_base64.length);
          audio.loadAudio(index, audioData.audio_base64);  // Pass just the base64 string
        } else {
          console.warn(`[Audio] Invalid audio data for paragraph ${index}: length = ${audioData.audio_base64?.length || 0}`);
        }
      } else {
        console.warn(`[Audio] No audio data for paragraph ${index}`);
      }
    });
  }, [activityData.activity]);

  // Listen to All effect - plays from current paragraph to end
  // Handle auto-advance for "Listen to All" feature
  useEffect(() => {
    if (!activityData.activity || !activityData.activity._audio_data || !isListeningToAll) {
      wasPlayingRef.current = false;
      return;
    }
    
    const paragraphs = activityData.activity._audio_data || [];
    const totalParagraphs = paragraphs.length;
    
    // Track if we were playing in the previous render
    const wasPlaying = wasPlayingRef.current;
    const isPlayingNow = audio.playingParagraph !== null;
    wasPlayingRef.current = isPlayingNow;
    
    // If audio just stopped playing (was playing, now stopped) and we're in "Listen to All" mode
    if (wasPlaying && !isPlayingNow && listenToAllStartIndexRef.current !== null) {
      const lastPlayedIndex = listenToAllStartIndexRef.current;
      const nextIndex = lastPlayedIndex + 1;
      
      console.log(`[Listen to All] Paragraph ${lastPlayedIndex} finished, next: ${nextIndex}`);
      
      if (nextIndex < totalParagraphs) {
        // Auto-advance to next paragraph
        console.log(`[Listen to All] Advancing to paragraph ${nextIndex}`);
        
        // Update the ref to track the next paragraph we're about to play
        listenToAllStartIndexRef.current = nextIndex;
        
        // Scroll to next paragraph
        const screenWidth = Dimensions.get('window').width;
        paragraphScrollViewRef.current?.scrollTo({
          x: nextIndex * screenWidth,
          animated: true,
        });
        
        // Update current index
        setCurrentParagraphIndex(nextIndex);
        
        // Auto-play next paragraph after a short delay
        setTimeout(() => {
          audio.playAudio(nextIndex);
        }, 500);
      } else {
        // Reached the end of all paragraphs
        console.log('[Listen to All] Completed all paragraphs');
        setIsListeningToAll(false);
        listenToAllStartIndexRef.current = null;
        wasPlayingRef.current = false;
      }
    }
  }, [audio.playingParagraph, isListeningToAll, activityData.activity]);

  // Function to start "Listen to All" from current paragraph
  const handleListenToAll = () => {
    if (!activityData.activity || !activityData.activity._audio_data) return;
    
    console.log(`[Listen to All] Starting from paragraph ${currentParagraphIndex}`);
    setIsListeningToAll(true);
    listenToAllStartIndexRef.current = currentParagraphIndex;
    wasPlayingRef.current = false;  // Reset the flag before starting
    
    // Start playing current paragraph
    audio.playAudio(currentParagraphIndex);
  };

  // Function to stop "Listen to All"
  const handleStopListenToAll = () => {
    console.log('[Listen to All] Stopped by user');
    setIsListeningToAll(false);
    listenToAllStartIndexRef.current = null;
    wasPlayingRef.current = false;
    audio.pauseAudio(audio.playingParagraph);
  };

  // Create transliteration and native script for Questions heading
  useEffect(() => {
    if (activityData.activity) {
      const questionsLabel = getQuestionLabel(language);
      const headerLabel = getListeningHeaderLabel(language);
      
      // For Urdu, get native script (Nastaliq) rendering for header
      if (language === 'urdu' && headerLabel && !transliteration.nativeScriptRenderings.headerLabel) {
        transliteration.ensureNativeScriptForKey('headerLabel', headerLabel);
      }
      
      // Create transliteration for header when enabled
      if (transliteration.showTransliterations && headerLabel && !transliteration.transliterations.headerLabel) {
        transliteration.ensureAndShowTransliterationForKey('headerLabel', headerLabel);
      }
      
      // For Urdu, get native script (Nastaliq) rendering for questions
      if (language === 'urdu' && questionsLabel && !transliteration.nativeScriptRenderings.questionsTitle) {
        transliteration.ensureNativeScriptForKey('questionsTitle', questionsLabel);
      }
      
      // Create transliteration when enabled
      if (transliteration.showTransliterations && questionsLabel && !transliteration.transliterations.questionsTitle) {
        transliteration.ensureAndShowTransliterationForKey('questionsTitle', questionsLabel);
      }
    }
  }, [transliteration.showTransliterations, activityData.activity, language]);

  // Create native script for Submit button label
  useEffect(() => {
    if (activityData.activity) {
      const submitLabel = getSubmitLabel(language);
      
      // For Urdu, get native script (Nastaliq) rendering
      if (language === 'urdu' && submitLabel && !transliteration.nativeScriptRenderings.submitLabel) {
        transliteration.ensureNativeScriptForKey('submitLabel', submitLabel);
      }
      
      // Create transliteration when enabled
      if (transliteration.showTransliterations && submitLabel && !transliteration.transliterations.submitLabel) {
        transliteration.ensureAndShowTransliterationForKey('submitLabel', submitLabel);
      }
    }
  }, [activityData.activity, language, transliteration.showTransliterations]);

  // Create native script and transliteration for Speaker Profile fields
  useEffect(() => {
    if (activityData.activity && activityData.activity._speaker_profile) {
      const profile = activityData.activity._speaker_profile;
      
      // Name
      if (profile.name) {
        if (language === 'urdu' && !transliteration.nativeScriptRenderings.speakerName) {
          transliteration.ensureNativeScriptForKey('speakerName', profile.name);
        }
        if (transliteration.showTransliterations && !transliteration.transliterations.speakerName) {
          transliteration.ensureAndShowTransliterationForKey('speakerName', profile.name);
        }
      }
      
      // Gender
      if (profile.gender) {
        if (language === 'urdu' && !transliteration.nativeScriptRenderings.speakerGender) {
          transliteration.ensureNativeScriptForKey('speakerGender', profile.gender);
        }
        if (transliteration.showTransliterations && !transliteration.transliterations.speakerGender) {
          transliteration.ensureAndShowTransliterationForKey('speakerGender', profile.gender);
        }
      }
      
      // City
      if (profile.city) {
        if (language === 'urdu' && !transliteration.nativeScriptRenderings.speakerCity) {
          transliteration.ensureNativeScriptForKey('speakerCity', profile.city);
        }
        if (transliteration.showTransliterations && !transliteration.transliterations.speakerCity) {
          transliteration.ensureAndShowTransliterationForKey('speakerCity', profile.city);
        }
      }
      
      // State
      if (profile.state) {
        if (language === 'urdu' && !transliteration.nativeScriptRenderings.speakerState) {
          transliteration.ensureNativeScriptForKey('speakerState', profile.state);
        }
        if (transliteration.showTransliterations && !transliteration.transliterations.speakerState) {
          transliteration.ensureAndShowTransliterationForKey('speakerState', profile.state);
        }
      }
      
      // Country
      if (profile.country) {
        if (language === 'urdu' && !transliteration.nativeScriptRenderings.speakerCountry) {
          transliteration.ensureNativeScriptForKey('speakerCountry', profile.country);
        }
        if (transliteration.showTransliterations && !transliteration.transliterations.speakerCountry) {
          transliteration.ensureAndShowTransliterationForKey('speakerCountry', profile.country);
        }
      }
      
      // Dialect
      if (profile.dialect) {
        if (language === 'urdu' && !transliteration.nativeScriptRenderings.speakerDialect) {
          transliteration.ensureNativeScriptForKey('speakerDialect', profile.dialect);
        }
        if (transliteration.showTransliterations && !transliteration.transliterations.speakerDialect) {
          transliteration.ensureAndShowTransliterationForKey('speakerDialect', profile.dialect);
        }
      }
      
      // Background
      if (profile.background) {
        if (language === 'urdu' && !transliteration.nativeScriptRenderings.speakerBackground) {
          transliteration.ensureNativeScriptForKey('speakerBackground', profile.background);
        }
        if (transliteration.showTransliterations && !transliteration.transliterations.speakerBackground) {
          transliteration.ensureAndShowTransliterationForKey('speakerBackground', profile.background);
        }
      }
    }
  }, [activityData.activity, language, transliteration.showTransliterations]);

  // Create native script and transliteration for Speaker Field Labels
  useEffect(() => {
    if (activityData.activity) {
      const labels = {
        speakerDetailsTitle: getSpeakerDetailsLabel(language),
        speakerNameLabel: getSpeakerNameLabel(language),
        speakerGenderLabel: getSpeakerGenderLabel(language),
        speakerAgeLabel: getSpeakerAgeLabel(language),
        speakerCityLabel: getSpeakerCityLabel(language),
        speakerStateLabel: getSpeakerStateLabel(language),
        speakerCountryLabel: getSpeakerCountryLabel(language),
        speakerDialectLabel: getSpeakerDialectLabel(language),
        speakerBackgroundLabel: getSpeakerBackgroundLabel(language),
        speakerFormalityLabel: getSpeakerFormalityLabel(language),
      };

      Object.entries(labels).forEach(([key, label]) => {
        // For Urdu, get native script rendering
        if (language === 'urdu' && label && !transliteration.nativeScriptRenderings[key]) {
          transliteration.ensureNativeScriptForKey(key, label);
        }
        
        // Create transliteration when enabled
        if (transliteration.showTransliterations && label && !transliteration.transliterations[key]) {
          transliteration.ensureAndShowTransliterationForKey(key, label);
        }
      });
    }
  }, [activityData.activity, language, transliteration.showTransliterations]);

  // Create native script and transliteration for button labels
  useEffect(() => {
    if (activityData.activity) {
      const buttonLabels = {
        showTranscript: getShowTranscriptLabel(language),
        hideTranscript: getHideTranscriptLabel(language),
        showAnswers: getShowAnswersLabel(language),
        hideAnswers: getHideAnswersLabel(language),
        listenToAll: getListenToAllLabel(language),
        stopAutoPlay: getStopAutoPlayLabel(language),
        yourScore: getYourScoreLabel(language),
        correctAnswers: getCorrectAnswersLabel(language),
      };

      Object.entries(buttonLabels).forEach(([key, label]) => {
        // For Urdu, get native script rendering
        if (language === 'urdu' && label && !transliteration.nativeScriptRenderings[key]) {
          transliteration.ensureNativeScriptForKey(key, label);
        }
        
        // Create transliteration when enabled
        if (transliteration.showTransliterations && label && !transliteration.transliterations[key]) {
          transliteration.ensureAndShowTransliterationForKey(key, label);
        }
      });
    }
  }, [activityData.activity, language, transliteration.showTransliterations]);

  // Create native script and transliteration for paragraph labels
  useEffect(() => {
    if (activityData.activity && activityData.activity._audio_data) {
      const paragraphCount = activityData.activity._audio_data.length;
      
      // Generate paragraph labels for each index
      for (let i = 0; i < paragraphCount; i++) {
        const fullLabel = formatParagraphLabel(language, i, paragraphCount);
        const key = `paragraphLabel_${i}`;
        
        // For Urdu, get native script rendering (Devanagari -> Nastaliq)
        if (language === 'urdu' && !transliteration.nativeScriptRenderings[key]) {
          transliteration.ensureNativeScriptForKey(key, fullLabel);
        }
        
        // Create transliteration when enabled (to Roman script)
        if (transliteration.showTransliterations && !transliteration.transliterations[key]) {
          transliteration.ensureAndShowTransliterationForKey(key, fullLabel);
        }
      }
    }
  }, [activityData.activity, language, transliteration.showTransliterations]);

  // Create native script and transliteration for all passage paragraphs
  useEffect(() => {
    if (activityData.activity && activityData.activity.passage) {
      const passageText = normalizeText(activityData.activity.passage) || '';
      const paragraphs = passageText.split('\n\n').filter(p => p.trim());
      
      paragraphs.forEach((para, index) => {
        const key = `passage_para_${index}`;
        
        // For Urdu, get native script rendering
        if (language === 'urdu' && !transliteration.nativeScriptRenderings[key]) {
          transliteration.ensureNativeScriptForKey(key, para.trim());
        }
        
        // Create transliteration when enabled
        if (transliteration.showTransliterations && !transliteration.transliterations[key]) {
          transliteration.ensureAndShowTransliterationForKey(key, para.trim());
        }
      });
    }
  }, [activityData.activity, language, transliteration.showTransliterations]);

  // Create transliteration for each dialogue bubble line so transcript bubbles
  // always show a transliteration under the native text
  useEffect(() => {
    if (!activityData.activity || !activityData.activity._dialogue) return;
    if (!transliteration.showTransliterations) return;

    (activityData.activity._dialogue || []).forEach((line, index) => {
      if (!line || !line.text) return;
      const key = `dialogue_line_${index}`;
      if (!transliteration.transliterations[key]) {
        transliteration.ensureAndShowTransliterationForKey(key, normalizeText(line.text));
      }
    });
  }, [activityData.activity, transliteration.showTransliterations, language]);

  // Import Vocab button label: native script (Urdu Nastaliq) + transliteration
  useEffect(() => {
    if (activityData.activity) {
      const label = getImportVocabFromTranscriptLabel(language);
      if (language === 'urdu' && label && !transliteration.nativeScriptRenderings.importVocabFromTranscript) {
        transliteration.ensureNativeScriptForKey('importVocabFromTranscript', label);
      }
      if (transliteration.showTransliterations && label && !transliteration.transliterations.importVocabFromTranscript) {
        transliteration.ensureAndShowTransliterationForKey('importVocabFromTranscript', label);
      }
    }
  }, [activityData.activity, language, transliteration.showTransliterations]);

  // Enhanced text renderer with word-level click support for dictionary
  const renderText = (text, style = {}, enableWordClick = false) => {
    const safeText = normalizeText(text);
    
    if (!enableWordClick) {
      return <SafeText style={style}>{safeText}</SafeText>;
    }
    
    // Helper to detect Arabic/Urdu script
    const isArabicScript = (str) => {
      if (!str) return false;
      return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str);
    };
    
    // Split text into words and render each as clickable
    const words = safeText.split(/(\s+|[.,!?;:—\-()[\]{}\"\']+)/);
    
    // For Urdu text, apply Nastaliq font to each Text component
    const hasArabicScript = isArabicScript(safeText);
    const urduFontStyle = hasArabicScript ? { fontFamily: 'Noto Nastaliq Urdu' } : {};
    const combinedStyle = hasArabicScript ? [style, urduFontStyle] : style;
    
    return (
      <Text style={combinedStyle}>
        {words.map((word, idx) => {
          // Check if it's a word (not whitespace or punctuation)
          const isWord = word.trim() && !/^[\s.,!?;:—\-()[\]{}\"\']+$/.test(word);
          
          if (!isWord) {
            return <Text key={idx} style={urduFontStyle}>{word}</Text>;
          }
          
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
  };

  const handleSubmit = async () => {
    if (!activityData.activity || !activityData.activity.questions) return;

    let correctAnswers = 0;
    activityData.activity.questions.forEach((q, idx) => {
      const selectedValue = selectedOptions[idx];
      if (selectedValue) {
        const selectedIndex = parseInt(selectedValue.split('-')[1]);
        if (selectedIndex === q.correct) {
          correctAnswers++;
        }
      }
    });

    const finalScore = activityData.activity.questions.length > 0
      ? correctAnswers / activityData.activity.questions.length
      : 0;

    setScore(finalScore);
    setShowResult(true);

    // Save score to backend
    const wordUpdates = (activityData.activity._words_used_data || []).map(word => ({
      word_id: word.id,
      correct: finalScore > 0.5 // Consider activity successful if score > 50%
    }));

    await complete({
      score: finalScore,
      wordUpdates,
      activityData: activityData.activity,
      activityId: activityData.activity?.activity_id || null
    });
  };

  // Show topic modal first if it's a new activity
  if (showTopicModal) {
    return (
      <View style={styles.container}>
        <TopicSelectionModal
          visible={showTopicModal}
          onClose={() => {
            setShowTopicModal(false);
            if (!activityData.activity) {
              navigation.goBack();
            }
          }}
          onSelectTopic={handleTopicSelection}
          activityType="listening"
          color={colors.primary}
        />
      </View>
    );
  }

  if (activityData.loading) {
    const progressKeys = activityData.ttsProgress ? Object.keys(activityData.ttsProgress).length : 0;
    const total = Math.max(activityData.paragraphCount || 1, progressKeys, 1);
    const completed = activityData.ttsProgress
      ? Object.values(activityData.ttsProgress).filter(s => s === 'complete').length
      : 0;
    const chunksLabel = total > 0 ? `${completed} of ${total} chunks` : 'Initializing…';

    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <SafeText style={styles.headerTitle}>
              {language === 'urdu' && transliteration.nativeScriptRenderings.headerLabel
                ? transliteration.nativeScriptRenderings.headerLabel
                : getListeningHeaderLabel(language)}
            </SafeText>
            {transliteration.showTransliterations && transliteration.transliterations.headerLabel && (
              <SafeText style={styles.headerTransliteration}>
                {transliteration.transliterations.headerLabel}
              </SafeText>
            )}
          </View>
        </View>

        <View style={styles.centerContainer}>
          <SafeText style={styles.loadingTitle}>Generating listening activity</SafeText>
          <SafeText style={styles.loadingSubtext}>{chunksLabel}</SafeText>
          <View style={styles.loadingProgressBarBg}>
            <View
              style={[
                styles.loadingProgressBarFill,
                {
                  width: `${total > 0 ? (completed / total) * 100 : 0}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>
      </View>
    );
  }

  const { activity, wordsUsed } = activityData;
  const passageText = normalizeText(activity?.passage) || '';
  const paragraphs = passageText.split('\n\n').filter(p => p.trim());

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <SafeText style={styles.headerTitle}>
            {language === 'urdu' && transliteration.nativeScriptRenderings.headerLabel
              ? transliteration.nativeScriptRenderings.headerLabel
              : getListeningHeaderLabel(language)}
          </SafeText>
          {transliteration.showTransliterations && transliteration.transliterations.headerLabel && (
            <SafeText style={styles.headerTransliteration}>
              {transliteration.transliterations.headerLabel}
            </SafeText>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.toggleButton, transliteration.showTransliterations && styles.toggleButtonActive]}
            onPress={() => transliteration.setShowTransliterations(!transliteration.showTransliterations)}
          >
            <Ionicons name={transliteration.showTransliterations ? "text" : "text-outline"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
          {/* Highlight vocab toggle retained (no color palette icon) */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => openModalWithPrefill({
          language: language || 'kannada',
          prefillText: (activityData.activity?.paragraphs || []).map(p => p.text || p.content || '').join(' '),
          onMakeVocabCards: () => { closeModal(); setShowImportModal(true); },
        })}
          >
            <Ionicons name="language" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => dictionary.setShowDictionary(true)}
          >
            <Ionicons name="book" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => activityData.setShowApiModal(true)}
          >
            <Ionicons name="bug" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activity && (
          <View>
            {/* Passage Title */}
            {activity.passage_name && (
              <View style={styles.storyTitleContainer}>
                <View style={styles.storyTitleWrapper}>
                  {renderText(
                    (language === 'urdu' && transliteration.nativeScriptRenderings.passageName)
                      ? transliteration.nativeScriptRenderings.passageName
                      : activity.passage_name,
                    styles.storyTitle,
                    true
                  )}
                </View>
                {transliteration.showTransliterations && transliteration.transliterations.passageName && (
                  <View style={styles.storyTitleTransliterationWrapper}>
                    {renderText(transliteration.transliterations.passageName, styles.storyTitleTransliteration, true)}
                  </View>
                )}
              </View>
            )}

            {/* Speaker Profile - Collapsible */}
            {activity._speaker_profile && (
              <View style={[styles.textBox, { backgroundColor: '#F5F5F5', marginBottom: 16 }]}>
                <TouchableOpacity
                  onPress={() => setSpeakerProfileExpanded(!speakerProfileExpanded)}
                  style={styles.speakerProfileHeader}
                >
                  <View style={{ flex: 1 }}>
                    {renderText(
                      (language === 'urdu' && transliteration.nativeScriptRenderings.speakerDetailsTitle)
                        ? transliteration.nativeScriptRenderings.speakerDetailsTitle
                        : getSpeakerDetailsLabel(language),
                      [styles.sectionTitle, { marginBottom: 0 }],
                      false
                    )}
                    {transliteration.showTransliterations && transliteration.transliterations.speakerDetailsTitle && (
                      <View style={{ marginTop: 2 }}>
                        {renderText(transliteration.transliterations.speakerDetailsTitle, [styles.transliterationText, { fontSize: 12 }], false)}
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name={speakerProfileExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                {speakerProfileExpanded && (
                  <View style={{ marginTop: 12 }}>
                    {/* Name */}
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                        {renderText(
                          (language === 'urdu' && transliteration.nativeScriptRenderings.speakerNameLabel)
                            ? transliteration.nativeScriptRenderings.speakerNameLabel
                            : getSpeakerNameLabel(language),
                          [styles.speakerDetailText, { fontWeight: 'bold' }],
                          false
                        )}
                        {transliteration.showTransliterations && transliteration.transliterations.speakerNameLabel && (
                          <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                            {transliteration.transliterations.speakerNameLabel}
                          </Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
                        {renderText(
                          language === 'urdu' && transliteration.nativeScriptRenderings.speakerName
                            ? transliteration.nativeScriptRenderings.speakerName
                            : activity._speaker_profile.name,
                          styles.speakerDetailText
                        )}
                        {transliteration.showTransliterations && transliteration.transliterations.speakerName && (
                          <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                            {transliteration.transliterations.speakerName}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {/* Gender */}
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                        {renderText(
                          (language === 'urdu' && transliteration.nativeScriptRenderings.speakerGenderLabel)
                            ? transliteration.nativeScriptRenderings.speakerGenderLabel
                            : getSpeakerGenderLabel(language),
                          [styles.speakerDetailText, { fontWeight: 'bold' }],
                          false
                        )}
                        {transliteration.showTransliterations && transliteration.transliterations.speakerGenderLabel && (
                          <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                            {transliteration.transliterations.speakerGenderLabel}
                          </Text>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
                        {renderText(
                          language === 'urdu' && transliteration.nativeScriptRenderings.speakerGender
                            ? transliteration.nativeScriptRenderings.speakerGender
                            : activity._speaker_profile.gender,
                          styles.speakerDetailText
                        )}
                        {transliteration.showTransliterations && transliteration.transliterations.speakerGender && (
                          <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                            {transliteration.transliterations.speakerGender}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {/* Age */}
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                        {renderText(
                          (language === 'urdu' && transliteration.nativeScriptRenderings.speakerAgeLabel)
                            ? transliteration.nativeScriptRenderings.speakerAgeLabel
                            : getSpeakerAgeLabel(language),
                          [styles.speakerDetailText, { fontWeight: 'bold' }],
                          false
                        )}
                        {transliteration.showTransliterations && transliteration.transliterations.speakerAgeLabel && (
                          <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                            {transliteration.transliterations.speakerAgeLabel}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.speakerDetailText, { marginTop: 4 }]}>{activity._speaker_profile.age}</Text>
                    </View>
                    
                    {/* City */}
                    {activity._speaker_profile.city && (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          {renderText(
                            (language === 'urdu' && transliteration.nativeScriptRenderings.speakerCityLabel)
                              ? transliteration.nativeScriptRenderings.speakerCityLabel
                              : getSpeakerCityLabel(language),
                            [styles.speakerDetailText, { fontWeight: 'bold' }],
                            false
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerCityLabel && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerCityLabel}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
                          {renderText(
                            language === 'urdu' && transliteration.nativeScriptRenderings.speakerCity
                              ? transliteration.nativeScriptRenderings.speakerCity
                              : activity._speaker_profile.city,
                            styles.speakerDetailText
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerCity && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerCity}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                    
                    {/* State */}
                    {activity._speaker_profile.state && (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          {renderText(
                            (language === 'urdu' && transliteration.nativeScriptRenderings.speakerStateLabel)
                              ? transliteration.nativeScriptRenderings.speakerStateLabel
                              : getSpeakerStateLabel(language),
                            [styles.speakerDetailText, { fontWeight: 'bold' }],
                            false
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerStateLabel && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerStateLabel}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
                          {renderText(
                            language === 'urdu' && transliteration.nativeScriptRenderings.speakerState
                              ? transliteration.nativeScriptRenderings.speakerState
                              : activity._speaker_profile.state,
                            styles.speakerDetailText
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerState && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerState}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                    
                    {/* Country */}
                    {activity._speaker_profile.country && (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          {renderText(
                            (language === 'urdu' && transliteration.nativeScriptRenderings.speakerCountryLabel)
                              ? transliteration.nativeScriptRenderings.speakerCountryLabel
                              : getSpeakerCountryLabel(language),
                            [styles.speakerDetailText, { fontWeight: 'bold' }],
                            false
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerCountryLabel && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerCountryLabel}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
                          {renderText(
                            language === 'urdu' && transliteration.nativeScriptRenderings.speakerCountry
                              ? transliteration.nativeScriptRenderings.speakerCountry
                              : activity._speaker_profile.country,
                            styles.speakerDetailText
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerCountry && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerCountry}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                    
                    {/* Dialect */}
                    {activity._speaker_profile.dialect && (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          {renderText(
                            (language === 'urdu' && transliteration.nativeScriptRenderings.speakerDialectLabel)
                              ? transliteration.nativeScriptRenderings.speakerDialectLabel
                              : getSpeakerDialectLabel(language),
                            [styles.speakerDetailText, { fontWeight: 'bold' }],
                            false
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerDialectLabel && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerDialectLabel}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
                          {renderText(
                            language === 'urdu' && transliteration.nativeScriptRenderings.speakerDialect
                              ? transliteration.nativeScriptRenderings.speakerDialect
                              : activity._speaker_profile.dialect,
                            styles.speakerDetailText
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerDialect && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerDialect}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                    
                    {/* Background */}
                    {activity._speaker_profile.background && (
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          {renderText(
                            (language === 'urdu' && transliteration.nativeScriptRenderings.speakerBackgroundLabel)
                              ? transliteration.nativeScriptRenderings.speakerBackgroundLabel
                              : getSpeakerBackgroundLabel(language),
                            [styles.speakerDetailText, { fontWeight: 'bold' }],
                            false
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerBackgroundLabel && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerBackgroundLabel}
                            </Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 }}>
                          {renderText(
                            language === 'urdu' && transliteration.nativeScriptRenderings.speakerBackground
                              ? transliteration.nativeScriptRenderings.speakerBackground
                              : activity._speaker_profile.background,
                            styles.speakerDetailText
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerBackground && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerBackground}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}
                    
                    {/* Formality */}
                    {activity._speaker_profile.formality && (
                      <View style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          {renderText(
                            (language === 'urdu' && transliteration.nativeScriptRenderings.speakerFormalityLabel)
                              ? transliteration.nativeScriptRenderings.speakerFormalityLabel
                              : getSpeakerFormalityLabel(language),
                            [styles.speakerDetailText, { fontWeight: 'bold' }],
                            false
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.speakerFormalityLabel && (
                            <Text style={[styles.transliterationText, { marginLeft: 6 }]}>
                              {transliteration.transliterations.speakerFormalityLabel}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.speakerDetailText, { marginTop: 4 }]}>
                          {activity._speaker_profile.formality}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Transcript Toggle */}
            <TouchableOpacity
              style={styles.transcriptToggle}
              onPress={() => setShowTranscript(!showTranscript)}
            >
              <Ionicons name={showTranscript ? "eye" : "eye-off"} size={20} color={colors.primary} />
              <View style={{ marginLeft: 8 }}>
                {renderText(
                  showTranscript 
                    ? (language === 'urdu' && transliteration.nativeScriptRenderings.hideTranscript
                        ? transliteration.nativeScriptRenderings.hideTranscript
                        : getHideTranscriptLabel(language))
                    : (language === 'urdu' && transliteration.nativeScriptRenderings.showTranscript
                        ? transliteration.nativeScriptRenderings.showTranscript
                        : getShowTranscriptLabel(language)),
                  [styles.transcriptToggleText, { color: colors.primary }],
                  false
                )}
              </View>
            </TouchableOpacity>

            {/* ── DIALOGUE MODE (multi-speaker) ── */}
            {(() => {
              const dialogueLines = activity._dialogue || [];
              const speakers = activity._speakers || [];
              const SPEAKER_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];
              const audioDataList = activity._audio_data || [];

              if (dialogueLines.length > 0) {
                return (
                  <View style={{ marginBottom: 8 }}>
                    {/* Collapsible header for full conversation section */}
                    <TouchableOpacity
                      style={styles.transcriptToggle}
                      onPress={() => setDialogueExpanded(!dialogueExpanded)}
                    >
                      <Ionicons name={dialogueExpanded ? 'chatbubbles' : 'chatbubbles-outline'} size={20} color={colors.primary} />
                      <View style={{ marginLeft: 8, flex: 1 }}>
                        {renderText(
                          getListeningHeaderLabel(language),
                          [styles.transcriptToggleText, { color: colors.primary }],
                          true
                        )}
                      </View>
                      <Ionicons
                        name={dialogueExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.primary}
                      />
                    </TouchableOpacity>

                    {dialogueExpanded && (
                      <>
                        {/* Optional play-all for conversation */}
                        <View style={{ alignItems: 'flex-start', marginBottom: 8 }}>
                          {!isListeningToAll ? (
                            <TouchableOpacity
                              style={[styles.listenToAllButton, { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8 }]}
                              onPress={handleListenToAll}
                            >
                              <Ionicons name="play-skip-forward" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <SafeText style={[styles.listenToAllButtonText, { fontSize: 14 }]}>
                                {getListenToAllLabel(language)}
                              </SafeText>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[styles.listenToAllButton, { backgroundColor: '#666666', paddingHorizontal: 14, paddingVertical: 8 }]}
                              onPress={handleStopListenToAll}
                            >
                              <Ionicons name="stop" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <SafeText style={[styles.listenToAllButtonText, { fontSize: 14 }]}>
                                {getStopAutoPlayLabel(language)}
                              </SafeText>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Speaker legend */}
                        {speakers.length > 1 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {speakers.map((sp, i) => (
                              <View
                                key={i}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  backgroundColor: SPEAKER_COLORS[i % SPEAKER_COLORS.length] + '18',
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  borderRadius: 20,
                                }}
                              >
                                <Ionicons
                                  name="person-outline"
                                  size={14}
                                  color={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}
                                />
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
                                  }}
                                >
                                  {sp.name}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Dialogue lines — each has its own tiny play button */}
                        {dialogueLines.map((line, lineIdx) => {
                          const spIdx = line.speaker_index ?? 0;
                          const sp = speakers[spIdx] || {};
                          const color = SPEAKER_COLORS[spIdx % SPEAKER_COLORS.length];
                          const isRight = spIdx % 2 === 1;
                          const hasAudio =
                            audioDataList[lineIdx] &&
                            audioDataList[lineIdx].audio_base64 &&
                            audioDataList[lineIdx].format !== 'text_only';

                          return (
                            <View key={lineIdx} style={{ marginBottom: 10 }}>
                              {/* Bubble */}
                              <View
                                style={[
                                  { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
                                  isRight && { flexDirection: 'row-reverse' },
                                ]}
                              >
                                <Ionicons
                                  name="person-circle-outline"
                                  size={24}
                                  color={color}
                                  style={{ marginTop: 4 }}
                                />
                                <View
                                  style={{
                                    flex: 1,
                                    backgroundColor: color + '15',
                                    borderRadius: 14,
                                    padding: 12,
                                    borderWidth: 1,
                                    borderColor: color + '30',
                                    maxWidth: '85%',
                                  }}
                                >
                                  {showTranscript && (
                                    <View style={{ marginBottom: hasAudio ? 6 : 0 }}>
                                      {renderText(
                                        line.text,
                                        [styles.targetText, { fontSize: 16, color: '#111827' }],
                                        true
                                      )}
                                      {transliteration.showTransliterations &&
                                        transliteration.transliterations[`dialogue_line_${lineIdx}`] && (
                                          <View style={{ marginTop: 6 }}>
                                            {renderText(
                                              transliteration.transliterations[`dialogue_line_${lineIdx}`],
                                              styles.transliterationText,
                                              true
                                            )}
                                          </View>
                                        )}
                                    </View>
                                  )}
                                  {hasAudio && (
                                    <AudioPlayer
                                      isPlaying={audio.playingParagraph === lineIdx}
                                      currentTime={(audio.audioPosition[lineIdx] || 0) / 1000}
                                      duration={(audio.audioDuration[lineIdx] || 0) / 1000}
                                      onPlayPause={() => {
                                        if (audio.playingParagraph === lineIdx) {
                                          audio.pauseAudio(lineIdx);
                                        } else {
                                          audio.playAudio(lineIdx);
                                        }
                                      }}
                                      onSeek={(time) => audio.seekAudio(lineIdx, time)}
                                      onReplay={() => audio.seekAudio(lineIdx, 0)}
                                      primaryColor={color}
                                      language={language}
                                      paragraphLabel={sp.name || `Speaker ${spIdx + 1}`}
                                      showVolumeControl={false}
                                      showSpeedControl={false}
                                      compact
                                    />
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </>
                    )}
                  </View>
                );
              }

              // ── Grid of paragraph cards (no horizontal paging) ──
              const screenWidth = Dimensions.get('window').width;
              const gap = 12;
              const numCols = 2;
              const cardWidth = (screenWidth - 40 - gap * (numCols - 1)) / numCols; // 40 = horizontal padding

              return (
                <>
                  <ScrollView
                    ref={paragraphScrollViewRef}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ paddingBottom: 16 }}
                  >
                    <View style={[styles.paragraphGrid, { gap }]}>
                      {paragraphs.map((para, index) => (
                        <View key={index} style={[styles.paragraphContainer, { width: cardWidth }]}>
                          <View style={styles.textBox}>
                            <AudioPlayer
                              isPlaying={audio.playingParagraph === index}
                              currentTime={(audio.audioPosition[index] || 0) / 1000}
                              duration={(audio.audioDuration[index] || 0) / 1000}
                              onPlayPause={() => {
                                if (audio.playingParagraph === index) {
                                  if (isListeningToAll) { setIsListeningToAll(false); listenToAllStartIndexRef.current = null; }
                                  audio.pauseAudio(index);
                                } else {
                                  if (isListeningToAll) { setIsListeningToAll(false); listenToAllStartIndexRef.current = null; }
                                  audio.playAudio(index);
                                }
                              }}
                              onSeek={(time) => audio.seekAudio(index, time)}
                              onReplay={() => audio.seekAudio(index, 0)}
                              primaryColor={colors.primary}
                              language={language}
                              paragraphLabel={formatParagraphLabel(language, index, paragraphs.length)}
                              showVolumeControl={false}
                              showSpeedControl={false}
                            />
                            {showTranscript && (
                              <View style={{ marginTop: 16 }}>
                                {renderText(
                                  (language === 'urdu' && transliteration.nativeScriptRenderings[`passage_para_${index}`])
                                    ? transliteration.nativeScriptRenderings[`passage_para_${index}`]
                                    : para.trim(),
                                  styles.targetText,
                                  true
                                )}
                                {transliteration.showTransliterations && transliteration.transliterations[`passage_para_${index}`] && (
                                  <View style={{ marginTop: 8 }}>
                                    {renderText(transliteration.transliterations[`passage_para_${index}`], styles.transliterationText, true)}
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </ScrollView>

                  {/* Listen to All Button */}
                  <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    {!isListeningToAll ? (
                      <TouchableOpacity style={[styles.listenToAllButton, { backgroundColor: colors.primary }]} onPress={handleListenToAll}>
                        <Ionicons name="play-skip-forward" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        {renderText(getListenToAllLabel(language), styles.listenToAllButtonText, false)}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[styles.listenToAllButton, { backgroundColor: '#666' }]} onPress={handleStopListenToAll}>
                        <Ionicons name="stop" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        {renderText(getStopAutoPlayLabel(language), styles.listenToAllButtonText, false)}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Page indicator removed for grid; optional: dot strip for current playing */}
                  {paragraphs.length > 0 && (
                    <View style={[styles.pageIndicator, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }]}>
                      {paragraphs.map((_, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() => {
                            if (isListeningToAll) { setIsListeningToAll(false); listenToAllStartIndexRef.current = null; }
                            setCurrentParagraphIndex(index);
                            paragraphScrollViewRef.current?.scrollTo({ y: Math.floor(index / numCols) * 200, animated: true });
                          }}
                          style={[styles.pageIndicatorDot, index === currentParagraphIndex && { backgroundColor: colors.primary }]}
                        />
                      ))}
                    </View>
                  )}
                </>
              );
            })()}

            {/* Import Vocab button – directly under transcript; native text first, transliteration below; no dictionary on tap */}
            {activity && (
              <View style={{ alignItems: 'flex-start', marginTop: 4, marginBottom: 16 }}>
                <TouchableOpacity
                  style={[styles.listenToAllButton, { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 14 }]}
                  onPress={() => setShowImportModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <View>
                    {renderText(
                      (language === 'urdu' && transliteration.nativeScriptRenderings.importVocabFromTranscript)
                        ? transliteration.nativeScriptRenderings.importVocabFromTranscript
                        : getImportVocabFromTranscriptLabel(language),
                      [styles.listenToAllButtonText, { fontSize: 14 }],
                      false
                    )}
                    {transliteration.showTransliterations && transliteration.transliterations.importVocabFromTranscript ? (
                      <Text style={[styles.transliterationText, { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 }]}>
                        {transliteration.transliterations.importVocabFromTranscript}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Questions - Same as Reading Activity */}
            {activity.questions && activity.questions.length > 0 && (
              <View style={styles.questionsContainer}>
                <View style={styles.questionsHeader}>
                  <View>
                    {renderText(
                      (language === 'urdu' && transliteration.nativeScriptRenderings.questionsTitle)
                        ? transliteration.nativeScriptRenderings.questionsTitle
                        : getQuestionLabel(language),
                      [styles.questionTitle, styles.boldText]
                    )}
                    {transliteration.showTransliterations && transliteration.transliterations.questionsTitle && (
                      renderText(transliteration.transliterations.questionsTitle, styles.transliterationText)
                    )}
                  </View>
                  {(showResult || (fromHistory && activity)) && (
                    <TouchableOpacity
                      style={styles.showAnswersToggle}
                      onPress={() => setShowAnswers(!showAnswers)}
                    >
                      <Ionicons name={showAnswers ? "eye" : "eye-off"} size={20} color={colors.primary} />
                      <View style={{ marginLeft: 8 }}>
                        {renderText(
                          showAnswers 
                            ? (language === 'urdu' && transliteration.nativeScriptRenderings.hideAnswers
                                ? transliteration.nativeScriptRenderings.hideAnswers
                                : getHideAnswersLabel(language))
                            : (language === 'urdu' && transliteration.nativeScriptRenderings.showAnswers
                                ? transliteration.nativeScriptRenderings.showAnswers
                                : getShowAnswersLabel(language)),
                          [styles.showAnswersText, { color: colors.primary }],
                          false
                        )}
                        {transliteration.showTransliterations && (
                          <Text style={[styles.transliterationText, { fontSize: 11, color: colors.primary }]}>
                            {showAnswers 
                              ? transliteration.transliterations.hideAnswers
                              : transliteration.transliterations.showAnswers}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {activity.questions.map((q, qIndex) => (
                  <View key={qIndex} style={styles.questionItem}>
                    <View style={styles.questionBox}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        <Text style={styles.questionText}>{qIndex + 1}. </Text>
                        {(() => {
                          const hasNativeScript = language === 'urdu' && transliteration.nativeScriptRenderings[`question_${qIndex}`];
                          return renderText(
                            hasNativeScript
                              ? transliteration.nativeScriptRenderings[`question_${qIndex}`]
                              : q.question,
                            styles.questionText,
                            true
                          );
                        })()}
                      </View>
                      {transliteration.showTransliterations && transliteration.transliterations[`question_${qIndex}`] && (
                        renderText(transliteration.transliterations[`question_${qIndex}`], styles.transliterationText, true)
                      )}
                    </View>

                    {q.options.map((option, oIndex) => {
                      const isSelected = selectedOptions[qIndex] === `${qIndex}-${oIndex}`;
                      const shouldShowAnswers = (showResult && showAnswers) || (fromHistory && showAnswers);

                      return (
                        <TouchableOpacity
                          key={oIndex}
                          style={[
                            styles.optionButton,
                            isSelected && [styles.optionButtonSelected, { borderColor: colors.primary }],
                            shouldShowAnswers && oIndex === q.correct && [styles.optionButtonCorrect, { borderColor: colors.primary }],
                            shouldShowAnswers && isSelected && oIndex !== q.correct && styles.optionButtonIncorrect,
                          ]}
                          onPress={() => !showResult && setSelectedOptions({ ...selectedOptions, [qIndex]: `${qIndex}-${oIndex}` })}
                          disabled={showResult}
                        >
                          <View style={styles.optionContent}>
                            {(() => {
                              const hasNativeScript = language === 'urdu' && transliteration.nativeScriptRenderings[`option_${qIndex}_${oIndex}`];
                              return renderText(
                                hasNativeScript
                                  ? transliteration.nativeScriptRenderings[`option_${qIndex}_${oIndex}`]
                                  : option,
                                styles.optionText,
                                true
                              );
                            })()}
                            {transliteration.showTransliterations && transliteration.transliterations[`option_${qIndex}_${oIndex}`] && (
                              renderText(transliteration.transliterations[`option_${qIndex}_${oIndex}`], styles.transliterationText, true)
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

            {/* Submit Button */}
            {!showResult && (
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary, marginTop: 20, marginBottom: 20 }]}
                onPress={handleSubmit}
              >
                <SafeText style={styles.submitButtonText}>
                  {language === 'urdu' && transliteration.nativeScriptRenderings.submitLabel
                    ? transliteration.nativeScriptRenderings.submitLabel
                    : getSubmitLabel(language)}
                </SafeText>
                {transliteration.showTransliterations && transliteration.transliterations.submitLabel && (
                  <SafeText style={[styles.submitButtonText, { fontSize: 12, marginTop: 4, opacity: 0.9 }]}>
                    {transliteration.transliterations.submitLabel}
                  </SafeText>
                )}
              </TouchableOpacity>
            )}

            {/* Results */}
            {showResult && (
              <View style={[styles.resultBox, { backgroundColor: colors.light, marginTop: 20, marginBottom: 20 }]}>
                <SafeText 
                  style={[
                    styles.resultTitle, 
                    { color: colors.primary },
                    language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                  ]}
                >
                  {transliteration.nativeScriptRenderings.yourScore || getYourScoreLabel(language)}
                </SafeText>
                {transliteration.showTransliterations && transliteration.transliterations.yourScore && (
                  <SafeText style={[styles.translitText, language === 'urdu' && { textAlign: 'right' }]}>
                    {transliteration.transliterations.yourScore}
                  </SafeText>
                )}
                <Text style={styles.scoreText}>{(score * 100).toFixed(0)}%</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={styles.scoreSubtext}>
                    {activity.questions.filter((q, idx) => {
                      const selectedValue = selectedOptions[idx];
                      if (selectedValue) {
                        const selectedIndex = parseInt(selectedValue.split('-')[1]);
                        return selectedIndex === q.correct;
                      }
                      return false;
                    }).length} / {activity.questions.length}{' '}
                  </Text>
                  <SafeText 
                    style={[
                      styles.scoreSubtext,
                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                    ]}
                  >
                    {transliteration.nativeScriptRenderings.correctAnswers || getCorrectAnswersLabel(language)}
                  </SafeText>
                </View>
                {transliteration.showTransliterations && transliteration.transliterations.correctAnswers && (
                  <SafeText style={[styles.translitText, language === 'urdu' && { textAlign: 'right' }]}>
                    {transliteration.transliterations.correctAnswers}
                  </SafeText>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Import Vocab Modal — pre-filled with listening transcript (paragraphs or dialogue or passage) */}
      <TextImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        language={language}
        prefillText={
          (activityData.activity?.paragraphs && activityData.activity.paragraphs.length > 0)
            ? activityData.activity.paragraphs.map(p => p.text || p.content || '').join(' ')
            : (activityData.activity?._dialogue && activityData.activity._dialogue.length > 0)
            ? activityData.activity._dialogue.map(d => d.text || '').join(' ')
            : (activityData.activity?.passage || '')
        }
      />

      {/* Dictionary Modal */}
      <VocabularyDictionary
        visible={dictionary.showDictionary}
        onClose={() => dictionary.setShowDictionary(false)}
        language={language}
        initialSearchQuery={dictionary.initialSearchQuery}
        dictionaryLanguage={dictionary.dictionaryLanguage}
        setDictionaryLanguage={dictionary.setDictionaryLanguage}
      />

      {/* API Debug Modal */}
      <APIDebugModal
        visible={activityData.showApiModal}
        onClose={() => activityData.setShowApiModal(false)}
        allApiDetails={activityData.allApiDetails}
      />
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
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  loadingProgressBarBg: {
    width: '80%',
    maxWidth: 320,
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    overflow: 'hidden',
  },
  loadingProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerTransliteration: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  storyTitleContainer: {
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
  textBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  speakerProfileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  speakerDetailText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  transcriptToggleText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  paragraphContainer: {
    width: Dimensions.get('window').width - 40,
    paddingHorizontal: 0,
  },
  paragraphGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  audioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paragraphNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  listenToAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listenToAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 4,
  },
  targetText: {
    fontSize: 18,
    lineHeight: 28,
    color: '#1A1A1A',
  },
  transliterationText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
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
  translitText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
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
  questionItem: {
    marginBottom: 24,
  },
  questionBox: {
    marginBottom: 12,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  optionButtonSelected: {
    backgroundColor: '#E8F8F0',
  },
  optionButtonCorrect: {
    backgroundColor: '#E8F8F0',
  },
  optionButtonIncorrect: {
    backgroundColor: '#FFE8E8',
    borderColor: '#FF6B6B',
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultBox: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  scoreSubtext: {
    fontSize: 16,
    color: '#666',
  },
});
