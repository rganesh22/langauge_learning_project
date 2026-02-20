import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import SafeText from '../../components/SafeText';
import { LanguageContext } from '../../contexts/LanguageContext';
import { useActivityData } from './shared/hooks/useActivityData';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import { useGrading } from './shared/hooks/useGrading';
import { useRecording } from './shared/hooks/useRecording';
import { ACTIVITY_COLORS } from './shared/constants';
import { normalizeText } from './shared/utils/textProcessing';
import {
  getSpeakingHeaderLabel,
  getSpeakingPracticeLabel,
  getRequiredWordsTitleLabel,
  getRubricTitleLabel,
  getTasksTitleLabel,
  getInputMethodLabel,
  getTextInputModeLabel,
  getAudioInputModeLabel,
  getStartRecordingLabel,
  getStopRecordingLabel,
  getProcessingAudioLabel,
  getYourRecordingLabel,
  getRecordAgainLabel,
  getTranscriptLabel,
  getTypeResponsePlaceholderLabel,
  getSubmitForGradingLabel,
  getGradingSpeechWaitLabel,
  getSubmissionsFeedbackLabel,
  getSubmissionNumberLabel,
  getOverallScoreLabel,
  getVocabularyScoreLabel,
  getGrammarScoreLabel,
  getFluencyScoreLabel,
  getTaskCompletionScoreLabel,
  getDetailedFeedbackLabel,
  getWordUsageFeedbackLabel,
  getTopicLabel,
  getInstructionsLabel,
} from '../../constants/ui_labels';
import VocabularyDictionary from './shared/components/VocabularyDictionary';
import { AudioPlayer } from './shared/components/AudioPlayer';
import { TopicSelectionModal } from './shared/components';
import { API_BASE_URL } from './shared/constants';

/**
 * SpeakingActivity Component
 * Handles speaking exercises with recording and AI grading
 */
export default function SpeakingActivity({ route, navigation }) {
  const { activityId, fromHistory, activityData: providedActivityData } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  const routeLang = (route && route.params && route.params.language) || null;
  // Prefer the language explicitly passed via route (activity's language), then context
  const language = routeLang || ctxLanguage || null;

  // Use shared hooks - pass providedActivityData for history reopening
  const activityData = useActivityData('speaking', language, activityId, fromHistory, providedActivityData);
  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);
  
  // Initialize grading with submissions from history if available
  const initialSubmissions = (fromHistory && providedActivityData && providedActivityData.submissions) 
    ? providedActivityData.submissions 
    : [];
  const grading = useGrading('speaking', language, initialSubmissions);
  const recording = useRecording(language);

  // Speaking-specific state
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [rubricExpanded, setRubricExpanded] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [useAudioInput, setUseAudioInput] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(!fromHistory);
  
  // Submission audio playback state
  const [submissionAudioStates, setSubmissionAudioStates] = useState({});
  const submissionAudioRefs = useRef({});

  const colors = ACTIVITY_COLORS.speaking;

  const handleTopicSelection = (selectedTopic) => {
    setShowTopicModal(false);
    activityData.loadActivity(selectedTopic);
  };

  useEffect(() => {
    if (fromHistory) {
      activityData.loadActivity();
    }
  }, []);

  // Request transliterations for speaking-specific content
  useEffect(() => {
    if (activityData.activity && transliteration.showTransliterations) {
      const activity = activityData.activity;
      
      // Section titles and labels
      transliteration.ensureAndShowTransliterationForKey('sectionTitle_speaking', getSpeakingPracticeLabel(language));
      transliteration.ensureAndShowTransliterationForKey('topicLabel', getTopicLabel(language));
      transliteration.ensureAndShowTransliterationForKey('instructionsLabel', getInstructionsLabel(language));
      transliteration.ensureAndShowTransliterationForKey('requiredWordsLabel', getRequiredWordsTitleLabel(language));
      transliteration.ensureAndShowTransliterationForKey('rubricTitle', getRubricTitleLabel(language));
      transliteration.ensureAndShowTransliterationForKey('tasks_title', getTasksTitleLabel(language));
      transliteration.ensureAndShowTransliterationForKey('inputMethodLabel', getInputMethodLabel(language));
      transliteration.ensureAndShowTransliterationForKey('textMode', getTextInputModeLabel(language));
      transliteration.ensureAndShowTransliterationForKey('audioMode', getAudioInputModeLabel(language));
      transliteration.ensureAndShowTransliterationForKey('placeholder', getTypeResponsePlaceholderLabel(language));
      transliteration.ensureAndShowTransliterationForKey('headerTitle', getSpeakingHeaderLabel(language));
      transliteration.ensureAndShowTransliterationForKey('startRecording', getStartRecordingLabel(language));
      transliteration.ensureAndShowTransliterationForKey('stopRecording', getStopRecordingLabel(language));
      transliteration.ensureAndShowTransliterationForKey('yourRecording', getYourRecordingLabel(language));
      transliteration.ensureAndShowTransliterationForKey('recordAgain', getRecordAgainLabel(language));
      transliteration.ensureAndShowTransliterationForKey('submitButton', getSubmitForGradingLabel(language));
      transliteration.ensureAndShowTransliterationForKey('gradingSpeechWait', getGradingSpeechWaitLabel(language));
      
      // Submission-related labels
      transliteration.ensureAndShowTransliterationForKey('submissionsFeedback', getSubmissionsFeedbackLabel(language));
      transliteration.ensureAndShowTransliterationForKey('submissionNumber', getSubmissionNumberLabel(language));
      transliteration.ensureAndShowTransliterationForKey('transcriptLabel', getTranscriptLabel(language));
      transliteration.ensureAndShowTransliterationForKey('overallScore', getOverallScoreLabel(language));
      transliteration.ensureAndShowTransliterationForKey('vocabularyScore', getVocabularyScoreLabel(language));
      transliteration.ensureAndShowTransliterationForKey('grammarScore', getGrammarScoreLabel(language));
      transliteration.ensureAndShowTransliterationForKey('fluencyScore', getFluencyScoreLabel(language));
      transliteration.ensureAndShowTransliterationForKey('taskCompletionScore', getTaskCompletionScoreLabel(language));
      transliteration.ensureAndShowTransliterationForKey('detailedFeedback', getDetailedFeedbackLabel(language));
      transliteration.ensureAndShowTransliterationForKey('wordUsageFeedback', getWordUsageFeedbackLabel(language));

      // Activity content
      if (activity.activity_name) {
        transliteration.ensureAndShowTransliterationForKey('activity_name', activity.activity_name);
      }
      
      // Prompt paragraphs (topic + instructions)
      let promptText = '';
      if (activity.topic) {
        promptText += activity.topic;
        if (activity.instructions) {
          promptText += '\n\n' + activity.instructions;
        }
      } else if (activity.instructions) {
        promptText = activity.instructions;
      }
      const promptParagraphs = promptText.split('\n\n').filter(p => p.trim());
      promptParagraphs.forEach((para, idx) => {
        if (para && para.trim()) {
          transliteration.ensureAndShowTransliterationForKey(`prompt_para_${idx}`, para.trim());
        }
      });
      
      // Required words
      if (activity.required_words && Array.isArray(activity.required_words)) {
        activity.required_words.forEach((word, idx) => {
          transliteration.ensureAndShowTransliterationForKey(`required_word_${idx}`, word);
        });
      }
      
      // Tasks
      if (activity.tasks && Array.isArray(activity.tasks)) {
        activity.tasks.forEach((task, idx) => {
          transliteration.ensureAndShowTransliterationForKey(`task_${idx}`, task);
        });
      }
      
      // Evaluation criteria / rubric guidelines
      if (activity.evaluation_criteria) {
        transliteration.ensureAndShowTransliterationForKey('evaluation_criteria', activity.evaluation_criteria);
      }
      
      // General guidelines
      const generalGuidelines = activity._general_guidelines || [];
      generalGuidelines.forEach((guideline, idx) => {
        transliteration.ensureAndShowTransliterationForKey(`general_guideline_${idx}`, guideline);
      });
    }
  }, [activityData.activity, transliteration.showTransliterations, language]);

  // Request transliterations for submissions (transcripts and feedback)
  useEffect(() => {
    if (grading.allSubmissions.length > 0 && transliteration.showTransliterations) {
      grading.allSubmissions.forEach((submission, index) => {
        // Transcript
        if (submission.transcript) {
          transliteration.ensureAndShowTransliterationForKey(`transcript_${index}`, submission.transcript);
        }
        
        // Feedback paragraphs
        if (submission.grading_result && submission.grading_result.feedback) {
          const feedbackParagraphs = submission.grading_result.feedback.split('\n\n').filter(p => p.trim());
          feedbackParagraphs.forEach((para, pIndex) => {
            if (para && para.trim()) {
              transliteration.ensureAndShowTransliterationForKey(`feedback_${index}_para_${pIndex}`, para.trim());
            }
          });
        }
        
        // Required words feedback
        if (submission.grading_result && submission.grading_result.required_words_feedback) {
          Object.entries(submission.grading_result.required_words_feedback).forEach(([word, feedback], fIndex) => {
            transliteration.ensureAndShowTransliterationForKey(`word_feedback_word_${index}_${fIndex}`, word);
            // Ensure feedback is a string before transliteration
            const feedbackText = typeof feedback === 'string' ? feedback : (feedback?.text || JSON.stringify(feedback));
            transliteration.ensureAndShowTransliterationForKey(`word_feedback_text_${index}_${fIndex}`, feedbackText);
          });
        }
        
        // Tasks feedback
        if (submission.grading_result && submission.grading_result.tasks_feedback) {
          Object.entries(submission.grading_result.tasks_feedback).forEach(([taskKey, feedback], tIndex) => {
            // Ensure feedback is a string before transliteration
            const feedbackText = typeof feedback === 'string' ? feedback : (feedback?.text || JSON.stringify(feedback));
            transliteration.ensureAndShowTransliterationForKey(`task_feedback_text_${index}_${tIndex}`, feedbackText);
          });
        }
      });
    }
  }, [grading.allSubmissions, transliteration.showTransliterations, language]);

  // Add native script rendering for Urdu (Devanagari -> Nastaliq)
  useEffect(() => {
    if (language === 'urdu' && activityData.activity) {
      const activity = activityData.activity;
      
      // Section titles and labels
      transliteration.ensureNativeScriptForKey('sectionTitle_speaking', getSpeakingPracticeLabel(language));
      transliteration.ensureNativeScriptForKey('topicLabel', getTopicLabel(language));
      transliteration.ensureNativeScriptForKey('instructionsLabel', getInstructionsLabel(language));
      transliteration.ensureNativeScriptForKey('requiredWordsLabel', getRequiredWordsTitleLabel(language));
      transliteration.ensureNativeScriptForKey('rubricTitle', getRubricTitleLabel(language));
      transliteration.ensureNativeScriptForKey('tasks_title', getTasksTitleLabel(language));
      transliteration.ensureNativeScriptForKey('inputMethodLabel', getInputMethodLabel(language));
      transliteration.ensureNativeScriptForKey('textMode', getTextInputModeLabel(language));
      transliteration.ensureNativeScriptForKey('audioMode', getAudioInputModeLabel(language));
      transliteration.ensureNativeScriptForKey('placeholder', getTypeResponsePlaceholderLabel(language));
      transliteration.ensureNativeScriptForKey('gradingSpeechWait', getGradingSpeechWaitLabel(language));
      transliteration.ensureNativeScriptForKey('wordUsageFeedback', getWordUsageFeedbackLabel(language));
      transliteration.ensureNativeScriptForKey('startRecording', getStartRecordingLabel(language));
      transliteration.ensureNativeScriptForKey('stopRecording', getStopRecordingLabel(language));
      transliteration.ensureNativeScriptForKey('yourRecording', getYourRecordingLabel(language));
      transliteration.ensureNativeScriptForKey('recordAgain', getRecordAgainLabel(language));
      transliteration.ensureNativeScriptForKey('submitButton', getSubmitForGradingLabel(language));
      
      // Submission labels
      transliteration.ensureNativeScriptForKey('submissionsFeedback', getSubmissionsFeedbackLabel(language));
      transliteration.ensureNativeScriptForKey('submissionNumber', getSubmissionNumberLabel(language));
      transliteration.ensureNativeScriptForKey('transcriptLabel', getTranscriptLabel(language));
      transliteration.ensureNativeScriptForKey('overallScore', getOverallScoreLabel(language));
      transliteration.ensureNativeScriptForKey('vocabularyScore', getVocabularyScoreLabel(language));
      transliteration.ensureNativeScriptForKey('grammarScore', getGrammarScoreLabel(language));
      transliteration.ensureNativeScriptForKey('fluencyScore', getFluencyScoreLabel(language));
      transliteration.ensureNativeScriptForKey('taskCompletionScore', getTaskCompletionScoreLabel(language));
      transliteration.ensureNativeScriptForKey('detailedFeedback', getDetailedFeedbackLabel(language));
      transliteration.ensureNativeScriptForKey('headerTitle', getSpeakingHeaderLabel(language));

      // Activity content
      if (activity.activity_name) {
        transliteration.ensureNativeScriptForKey('activity_name', activity.activity_name);
      }
      
      // Prompt paragraphs (topic + instructions)
      let promptText = '';
      if (activity.topic) {
        promptText += activity.topic;
        if (activity.instructions) {
          promptText += '\n\n' + activity.instructions;
        }
      } else if (activity.instructions) {
        promptText = activity.instructions;
      }
      const promptParagraphs = promptText.split('\n\n').filter(p => p.trim());
      promptParagraphs.forEach((para, idx) => {
        if (para && para.trim()) {
          transliteration.ensureNativeScriptForKey(`prompt_para_${idx}`, para.trim());
        }
      });
      
      // Required words
      if (activity.required_words && Array.isArray(activity.required_words)) {
        activity.required_words.forEach((word, idx) => {
          transliteration.ensureNativeScriptForKey(`required_word_${idx}`, word);
        });
      }
      
      // Tasks
      if (activity.tasks && Array.isArray(activity.tasks)) {
        activity.tasks.forEach((task, idx) => {
          transliteration.ensureNativeScriptForKey(`task_${idx}`, task);
        });
      }
      
      // Evaluation criteria / rubric guidelines
      if (activity.evaluation_criteria) {
        transliteration.ensureNativeScriptForKey('evaluation_criteria', activity.evaluation_criteria);
      }
      
      // General guidelines
      const generalGuidelines = activity._general_guidelines || [];
      generalGuidelines.forEach((guideline, idx) => {
        transliteration.ensureNativeScriptForKey(`general_guideline_${idx}`, guideline);
      });
    }
  }, [language, activityData.activity]);

  // Native script rendering for Urdu submissions
  useEffect(() => {
    if (language === 'urdu' && grading.allSubmissions.length > 0) {
      grading.allSubmissions.forEach((submission, index) => {
        // Transcript
        if (submission.transcript) {
          transliteration.ensureNativeScriptForKey(`transcript_${index}`, submission.transcript);
        }
        
        // Feedback paragraphs
        if (submission.grading_result && submission.grading_result.feedback) {
          const feedbackParagraphs = submission.grading_result.feedback.split('\n\n').filter(p => p.trim());
          feedbackParagraphs.forEach((para, pIndex) => {
            if (para && para.trim()) {
              transliteration.ensureNativeScriptForKey(`feedback_${index}_para_${pIndex}`, para.trim());
            }
          });
        }
        
        // Required words feedback
        if (submission.grading_result && submission.grading_result.required_words_feedback) {
          Object.entries(submission.grading_result.required_words_feedback).forEach(([word, feedback], fIndex) => {
            transliteration.ensureNativeScriptForKey(`word_feedback_word_${index}_${fIndex}`, word);
            // Ensure feedback is a string before native script conversion
            const feedbackText = typeof feedback === 'string' ? feedback : (feedback?.text || JSON.stringify(feedback));
            transliteration.ensureNativeScriptForKey(`word_feedback_text_${index}_${fIndex}`, feedbackText);
          });
        }
        
        // Tasks feedback
        if (submission.grading_result && submission.grading_result.tasks_feedback) {
          Object.entries(submission.grading_result.tasks_feedback).forEach(([taskKey, feedback], tIndex) => {
            // Ensure feedback is a string before native script conversion
            const feedbackText = typeof feedback === 'string' ? feedback : (feedback?.text || JSON.stringify(feedback));
            transliteration.ensureNativeScriptForKey(`task_feedback_text_${index}_${tIndex}`, feedbackText);
          });
        }
      });
    }
  }, [language, grading.allSubmissions]);

  // Enhanced text renderer with word-level click support for dictionary
  const renderText = (text, style = {}, enableWordClick = false) => {
    // Handle null, undefined, or empty values
    if (!text || text === '' || typeof text !== 'string') {
      return null;
    }
    
    const safeText = normalizeText(text);
    
    // If still empty after normalization, return null to avoid rendering
    if (!safeText || safeText.trim() === '') {
      return null;
    }
    
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
    
    // Return Text component with nested Text for clickable words
    return (
      <Text style={combinedStyle}>
        {words.map((word, idx) => {
          // Check if it's a word (not whitespace or punctuation)
          const isWord = word.trim() && !/^[\s.,!?;:—\-()[\]{}\"\']+$/.test(word);
          
          if (!isWord) {
            return <Text key={idx}>{word}</Text>;
          }
          
          return (
            <Text
              key={idx}
              onPress={() => dictionary.handleWordClick(word.trim(), language)}
            >
              {word}
            </Text>
          );
        })}
      </Text>
    );
  };

  // Helper to render transliteration text with word click support
  const renderTransliteration = (text, style = {}) => {
    if (!text || text === '' || typeof text !== 'string') {
      return null;
    }
    
    const safeText = normalizeText(text);
    if (!safeText || safeText.trim() === '') {
      return null;
    }
    
    // Split into words for dictionary lookup on transliteration
    const words = safeText.split(/(\s+|[.,!?;:—\-()[\]{}\"\']+)/);
    
    return (
      <Text style={style}>
        {words.map((word, idx) => {
          const isWord = word.trim() && !/^[\s.,!?;:—\-()[\]{}\"\']+$/.test(word);
          
          if (!isWord) {
            return <Text key={idx}>{word}</Text>;
          }
          
          return (
            <Text
              key={idx}
              onPress={() => dictionary.handleWordClick(word.trim(), language)}
            >
              {word}
            </Text>
          );
        })}
      </Text>
    );
  };

  const handleRecord = async () => {
    if (recording.isRecording) {
      // Just stop recording - no transcription needed
      const uri = await recording.stopRecording();
      if (uri) {
        // Load audio for playback
        await recording.loadAudio(uri);
      }
    } else {
      // Start recording
      await recording.startRecording();
    }
  };

  const handleNewRecording = () => {
    // Reset recording state to allow new recording
    recording.resetRecording();
    grading.setUserAnswer('');
  };

  // Submission audio playback functions
  const loadSubmissionAudio = async (submissionIndex, audioBase64) => {
    try {
      // Create blob URL from base64
      const audioBlob = await fetch(`data:audio/webm;base64,${audioBase64}`).then(r => r.blob());
      const audioUrl = URL.createObjectURL(audioBlob);

      // Clean up previous audio if exists
      if (submissionAudioRefs.current[submissionIndex]) {
        const oldAudio = submissionAudioRefs.current[submissionIndex];
        oldAudio.pause();
        URL.revokeObjectURL(oldAudio.src);
      }

      // Create new audio element
      const audio = document.createElement('audio');
      audio.src = audioUrl;
      submissionAudioRefs.current[submissionIndex] = audio;

      // Set up event listeners
      audio.onloadedmetadata = () => {
        setSubmissionAudioStates(prev => ({
          ...prev,
          [submissionIndex]: {
            ...prev[submissionIndex],
            duration: audio.duration * 1000,
            isLoaded: true,
          }
        }));
      };

      audio.ontimeupdate = () => {
        setSubmissionAudioStates(prev => ({
          ...prev,
          [submissionIndex]: {
            ...prev[submissionIndex],
            position: audio.currentTime * 1000,
          }
        }));
      };

      audio.onended = () => {
        setSubmissionAudioStates(prev => ({
          ...prev,
          [submissionIndex]: {
            ...prev[submissionIndex],
            isPlaying: false,
            position: 0,
          }
        }));
      };

      audio.onplay = () => {
        setSubmissionAudioStates(prev => ({
          ...prev,
          [submissionIndex]: { ...prev[submissionIndex], isPlaying: true }
        }));
      };

      audio.onpause = () => {
        setSubmissionAudioStates(prev => ({
          ...prev,
          [submissionIndex]: { ...prev[submissionIndex], isPlaying: false }
        }));
      };

    } catch (error) {
      console.error('Error loading submission audio:', error);
    }
  };

  const toggleSubmissionPlayback = async (submissionIndex, audioBase64) => {
    const audioState = submissionAudioStates[submissionIndex];
    const audio = submissionAudioRefs.current[submissionIndex];

    // Load audio if not loaded yet
    if (!audio || !audioState?.isLoaded) {
      await loadSubmissionAudio(submissionIndex, audioBase64);
      // Wait a bit for audio to load, then play
      setTimeout(() => {
        const newAudio = submissionAudioRefs.current[submissionIndex];
        if (newAudio) {
          newAudio.play();
        }
      }, 100);
      return;
    }

    // Toggle play/pause
    if (audioState?.isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const seekSubmissionAudio = (submissionIndex, timeInMs) => {
    const audio = submissionAudioRefs.current[submissionIndex];
    if (audio) {
      audio.currentTime = timeInMs / 1000;
    }
  };

  const replaySubmissionAudio = (submissionIndex) => {
    const audio = submissionAudioRefs.current[submissionIndex];
    if (audio) {
      audio.currentTime = 0;
      audio.play();
    }
  };

  const handleSubmit = async () => {
    if (useAudioInput) {
      // Audio input mode - send audio directly to backend
      if (!recording.recordingUri) {
        alert('No audio recording found. Please record your speech first.');
        return;
      }

      try {
        // Convert audio to base64
        let audioBase64;
        if (Platform.OS === 'web') {
          const response = await fetch(recording.recordingUri);
          const blob = await response.blob();
          audioBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = reader.result.split(',')[1];
              resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          audioBase64 = await FileSystem.readAsStringAsync(recording.recordingUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        await grading.submitSpeaking(activityData.activity, recording.recordingUri, audioBase64);
      } catch (error) {
        console.error('Error preparing audio for submission:', error);
        alert('Failed to prepare audio. Please try again.');
      }
    } else {
      // Text input mode (if we want to keep this option)
      if (!grading.userAnswer || !grading.userAnswer.trim()) {
        alert('Please type your response before submitting.');
        return;
      }
      // For text mode, we'd need to implement text-based grading
      // For now, just show a message
      alert('Please use audio recording mode for speaking activities.');
    }
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
          activityType="speaking"
          color={colors.primary}
        />
      </View>
    );
  }

  if (activityData.loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <SafeText style={styles.loadingText}>{activityData.loadingStatus}</SafeText>
      </View>
    );
  }

  const { activity, wordsUsed } = activityData;
  
  // Combine topic and instructions
  let promptText = '';
  if (activity?.topic) {
    promptText += activity.topic;
    if (activity.instructions) {
      promptText += '\n\n' + activity.instructions;
    }
  } else if (activity?.instructions) {
    promptText = activity.instructions;
  }
  const promptParagraphs = promptText.split('\n\n').filter(p => p.trim());

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {renderText(
            language === 'urdu' && transliteration.nativeScriptRenderings.headerTitle
              ? transliteration.nativeScriptRenderings.headerTitle
              : getSpeakingHeaderLabel(language),
            styles.headerTitle,
            true
          )}
          {transliteration.showTransliterations && transliteration.transliterations.headerTitle && (
            renderTransliteration(
              transliteration.transliterations.headerTitle,
              [styles.headerTransliteration, { color: '#FFFFFF', fontSize: 14, fontStyle: 'italic', marginTop: 2 }]
            )
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.toggleButton, transliteration.showTransliterations && styles.toggleButtonActive]}
            onPress={() => transliteration.setShowTransliterations(!transliteration.showTransliterations)}
          >
            <Ionicons name={transliteration.showTransliterations ? "text" : "text-outline"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, highlightVocab && styles.toggleButtonActive]}
            onPress={() => setHighlightVocab(!highlightVocab)}
          >
            <Ionicons name={highlightVocab ? "color-palette" : "color-palette-outline"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => dictionary.setShowDictionary(!dictionary.showDictionary)}
          >
            <Ionicons name="book-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activity && (
          <View>
            {/* Activity Title */}
            {activity.activity_name && (
              <View style={styles.titleContainer}>
                <View style={[styles.titleWrapper, language === 'urdu' && { alignItems: 'flex-start' }]}>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings.activity_name
                      ? transliteration.nativeScriptRenderings.activity_name
                      : activity.activity_name,
                    styles.title,
                    true // Enable word click for title
                  )}
                </View>
                {transliteration.showTransliterations && transliteration.transliterations.activity_name && (
                  <View style={[styles.titleTransliterationWrapper, language === 'urdu' && { alignItems: 'flex-end' }]}>
                    {renderTransliteration(transliteration.transliterations.activity_name, styles.titleTransliteration)}
                  </View>
                )}
              </View>
            )}

            {/* Section Title */}
            <View style={[styles.sectionTitleContainer, language === 'urdu' && { alignItems: 'flex-start' }]}>
              {renderText(
                language === 'urdu' && transliteration.nativeScriptRenderings.sectionTitle_speaking
                  ? transliteration.nativeScriptRenderings.sectionTitle_speaking
                  : getSpeakingPracticeLabel(language),
                [styles.sectionTitle, styles.boldText],
                true // Enable word click for section title
              )}
              {transliteration.showTransliterations && transliteration.transliterations.sectionTitle_speaking && (
                <View style={{ marginTop: 4 }}>
                  {renderTransliteration(transliteration.transliterations.sectionTitle_speaking, styles.transliterationText)}
                </View>
              )}
            </View>

            {/* Speaking Prompt */}
            <View style={styles.promptBox}>
              {promptParagraphs.map((para, index) => (
                <View key={`prompt-para-${index}`} style={{ marginBottom: index < promptParagraphs.length - 1 ? 12 : 0 }}>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings[`prompt_para_${index}`]
                      ? transliteration.nativeScriptRenderings[`prompt_para_${index}`]
                      : para.trim(),
                    styles.promptText,
                    true // Enable word click for dictionary lookup
                  )}
                  {transliteration.showTransliterations && transliteration.transliterations[`prompt_para_${index}`] && (
                    <View style={{ marginTop: 4 }}>
                      {renderTransliteration(transliteration.transliterations[`prompt_para_${index}`], styles.transliterationText)}
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Required Words */}
            {activity.required_words && activity.required_words.length > 0 && (
              <View style={styles.requiredWordsBox}>
                <View style={language === 'urdu' && { alignItems: 'flex-start' }}>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings.requiredWordsLabel
                      ? transliteration.nativeScriptRenderings.requiredWordsLabel
                      : getRequiredWordsTitleLabel(language),
                    [styles.requiredWordsLabel, styles.boldText],
                    true
                  )}
                </View>
                {transliteration.showTransliterations && transliteration.transliterations.requiredWordsLabel && (
                  <View style={[{ marginTop: 4, marginBottom: 8 }, language === 'urdu' && { alignItems: 'flex-end' }]}>
                    {renderTransliteration(transliteration.transliterations.requiredWordsLabel, styles.transliterationText)}
                  </View>
                )}
                <View style={styles.wordsList}>
                  {activity.required_words.map((word, index) => {
                    const vocabWord = wordsUsed.find(w => w.kannada === word || w.word === word);
                    const wordTranslit = transliteration.transliterations[`required_word_${index}`] || vocabWord?.transliteration;
                    const displayWord = language === 'urdu' && transliteration.nativeScriptRenderings[`required_word_${index}`]
                      ? transliteration.nativeScriptRenderings[`required_word_${index}`]
                      : (vocabWord?.kannada || word);
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.wordTag, { backgroundColor: colors.light }]}
                        onPress={() => dictionary.handleWordClick(word, language)}
                      >
                        {renderText(displayWord, [styles.wordTagText, { color: colors.primary }])}
                        {transliteration.showTransliterations && wordTranslit && (
                          <Text style={[styles.wordTagTranslit, { color: colors.primary }]}>{wordTranslit}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Collapsible Rubric */}
            <View style={[styles.rubricSection, { backgroundColor: colors.light }]}>
              <TouchableOpacity
                style={styles.rubricHeader}
                onPress={() => setRubricExpanded(!rubricExpanded)}
              >
                <View style={{ flex: 1 }}>
                  <View style={language === 'urdu' && { alignItems: 'flex-start' }}>
                    {renderText(
                      language === 'urdu' && transliteration.nativeScriptRenderings.rubricTitle
                        ? transliteration.nativeScriptRenderings.rubricTitle
                        : getRubricTitleLabel(language),
                      [styles.rubricHeaderText, { color: colors.primary, fontWeight: 'bold' }],
                      true
                    )}
                  </View>
                  {transliteration.showTransliterations && transliteration.transliterations.rubricTitle && (
                    <View style={[{ marginTop: 4 }, language === 'urdu' && { alignItems: 'flex-end' }]}>
                      {renderTransliteration(transliteration.transliterations.rubricTitle, styles.transliterationText)}
                    </View>
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
                    const generalGuidelines = activity._general_guidelines || [
                      "ನೀಡಲಾದ ಎಲ್ಲಾ ಅನಿವಾರ್ಯ ಪದಗಳನ್ನು ಬಳಸಬೇಕು ಮತ್ತು ಸಾಧ್ಯವಾದಷ್ಟು ಕಲಿತ ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಪದಗಳನ್ನು ಸಹೃದಯವಾಗಿ ಬಳಸಬೇಕು.",
                      "ವ್ಯಾಕರಣದ ನಿಖರತೆ, ಪದಗಳ ಸರಿಯಾದ ಬಳಕೆ, ಮತ್ತು ಸ್ಪಷ್ಟತೆಯನ್ನು ಕಾಪಾಡಿಕೊಳ್ಳಬೇಕು.",
                      "ಭಾಷಣವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು.",
                      "ಕಾರ್ಯಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಬೇಕು ಮತ್ತು ನೀಡಲಾದ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ ಮಾತನಾಡಬೇಕು."
                    ];

                    let geminiCriteria = [];
                    if (activity.evaluation_criteria) {
                      let criteriaText = activity.evaluation_criteria
                        .replace(/\*\*/g, '')
                        .replace(/\*/g, '')
                        .replace(/`/g, '');
                      geminiCriteria = criteriaText
                        .split('\n')
                        .map(line => line.replace(/^\s*[-•●]\s*/g, '').replace(/^\s*\d+\.\s*/g, '').trim())
                        .filter(line => line.length > 0);
                    }

                    const allCriteria = [...generalGuidelines, ...geminiCriteria];

                    return (
                      <View style={styles.criteriaList}>
                        {allCriteria.map((line, index) => {
                          const guidelineTranslit = transliteration.transliterations[`general_guideline_${index}`];
                          const displayLine = language === 'urdu' && transliteration.nativeScriptRenderings[`general_guideline_${index}`]
                            ? transliteration.nativeScriptRenderings[`general_guideline_${index}`]
                            : line;
                          return (
                            <View key={index} style={styles.criteriaBulletItem}>
                              <SafeText style={styles.criteriaBullet}>•</SafeText>
                              <View style={styles.criteriaBulletText}>
                                {renderText(displayLine, styles.criteriaText, true)}
                                {transliteration.showTransliterations && guidelineTranslit && (
                                  <View style={{ marginTop: 4 }}>
                                    {renderTransliteration(guidelineTranslit, styles.transliterationText)}
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

            {/* Tasks Display */}
            {activity.tasks && activity.tasks.length > 0 && (
              <View style={[styles.tasksBox, { backgroundColor: '#FFF9E6' }]}>
                <TouchableOpacity
                  style={styles.tasksHeader}
                  onPress={() => setTasksExpanded(!tasksExpanded)}
                >
                  <View style={{ flex: 1 }}>
                    <View style={language === 'urdu' && { alignItems: 'flex-start' }}>
                      {renderText(
                        language === 'urdu' && transliteration.nativeScriptRenderings.tasks_title
                          ? transliteration.nativeScriptRenderings.tasks_title
                          : getTasksTitleLabel(language),
                        [styles.sectionTitle, styles.boldText],
                        true
                      )}
                    </View>
                    {transliteration.showTransliterations && transliteration.transliterations.tasks_title && (
                      <View style={[{ marginTop: 4 }, language === 'urdu' && { alignItems: 'flex-end' }]}>
                        {renderTransliteration(transliteration.transliterations.tasks_title, styles.transliterationText)}
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name={tasksExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                {tasksExpanded && (
                  <View style={{ marginTop: 12 }}>
                    {activity.tasks.map((task, index) => {
                      const taskTranslit = transliteration.transliterations[`task_${index}`] || '';
                      const displayTask = language === 'urdu' && transliteration.nativeScriptRenderings[`task_${index}`]
                        ? transliteration.nativeScriptRenderings[`task_${index}`]
                        : task;
                      return (
                        <View key={index} style={styles.taskItem}>
                          <View style={styles.taskCheckbox}>
                            <Ionicons name="ellipse-outline" size={24} color="#666" />
                          </View>
                          <View style={styles.taskText}>
                            {renderText(displayTask, styles.taskTextContent, true)}
                            {transliteration.showTransliterations && taskTranslit && (
                              <View style={{ marginTop: 4 }}>
                                {renderTransliteration(taskTranslit, [styles.transliterationText, { fontSize: 12 }])}
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

            {/* Input Mode Toggle */}
            <View style={[styles.inputModeBox, { backgroundColor: colors.light }]}>
              <View style={{ marginBottom: 12 }}>
                <View style={language === 'urdu' && { alignItems: 'flex-start' }}>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings.inputMethodLabel
                      ? transliteration.nativeScriptRenderings.inputMethodLabel
                      : getInputMethodLabel(language),
                    [styles.sectionTitle, styles.boldText],
                    true
                  )}
                </View>
                {transliteration.showTransliterations && transliteration.transliterations.inputMethodLabel && (
                  <View style={[{ marginTop: 4 }, language === 'urdu' && { alignItems: 'flex-end' }]}>
                    {renderTransliteration(transliteration.transliterations.inputMethodLabel, styles.transliterationText)}
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setUseAudioInput(false)}
                  style={[
                    styles.modeButton,
                    !useAudioInput && { backgroundColor: colors.primary }
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Ionicons 
                      name="create-outline" 
                      size={20} 
                      color={!useAudioInput ? '#FFFFFF' : '#666'}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      {renderText(
                        language === 'urdu' && transliteration.nativeScriptRenderings.textMode
                          ? transliteration.nativeScriptRenderings.textMode
                          : getTextInputModeLabel(language),
                        [styles.modeButtonText, !useAudioInput && { color: '#FFFFFF' }]
                      )}
                      {transliteration.showTransliterations && transliteration.transliterations.textMode && (
                        renderTransliteration(
                          transliteration.transliterations.textMode,
                          [styles.transliterationText, { fontSize: 11, color: !useAudioInput ? '#FFFFFF' : '#666' }]
                        )
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setUseAudioInput(true)}
                  style={[
                    styles.modeButton,
                    useAudioInput && { backgroundColor: colors.primary }
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Ionicons 
                      name="mic-outline" 
                      size={20} 
                      color={useAudioInput ? '#FFFFFF' : '#666'}
                      style={{ marginRight: 8 }}
                    />
                    <View style={{ flex: 1 }}>
                      {renderText(
                        language === 'urdu' && transliteration.nativeScriptRenderings.audioMode
                          ? transliteration.nativeScriptRenderings.audioMode
                          : getAudioInputModeLabel(language),
                        [styles.modeButtonText, useAudioInput && { color: '#FFFFFF' }]
                      )}
                      {transliteration.showTransliterations && transliteration.transliterations.audioMode && (
                        renderTransliteration(
                          transliteration.transliterations.audioMode,
                          [styles.transliterationText, { fontSize: 11, color: useAudioInput ? '#FFFFFF' : '#666' }]
                        )
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Audio Input Mode */}
            {useAudioInput ? (
              <View>
                {/* Recording Controls - Only show if no recording exists */}
                {!recording.recordingUri && (
                  <View style={styles.recordingBox}>
                    <TouchableOpacity
                      style={[
                        styles.recordButton,
                        { backgroundColor: recording.isRecording ? '#FF6B6B' : colors.primary }
                      ]}
                      onPress={handleRecord}
                      disabled={recording.isProcessing || grading.gradingLoading}
                    >
                      <Ionicons
                        name={recording.isRecording ? "stop-circle" : "mic"}
                        size={32}
                        color="#FFFFFF"
                      />
                      <View>
                        {renderText(
                          recording.isRecording 
                            ? (language === 'urdu' && transliteration.nativeScriptRenderings.stopRecording
                                ? transliteration.nativeScriptRenderings.stopRecording
                                : getStopRecordingLabel(language))
                            : (language === 'urdu' && transliteration.nativeScriptRenderings.startRecording
                                ? transliteration.nativeScriptRenderings.startRecording
                                : getStartRecordingLabel(language)),
                          styles.recordButtonText
                        )}
                        {transliteration.showTransliterations && (
                          recording.isRecording 
                            ? transliteration.transliterations.stopRecording
                            : transliteration.transliterations.startRecording
                        ) && (
                          renderTransliteration(
                            recording.isRecording 
                              ? transliteration.transliterations.stopRecording
                              : transliteration.transliterations.startRecording,
                            [styles.recordButtonTranslit, { color: '#FFFFFF', fontSize: 12, fontStyle: 'italic', marginTop: 2 }]
                          )
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Recording Duration Display */}
                    {recording.isRecording && recording.recordingDuration > 0 && (
                      <View style={styles.recordingDurationBox}>
                        <Text style={styles.recordingDurationText}>
                          {Math.floor((300000 - recording.recordingDuration) / 1000)}s remaining (5:00 max)
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Audio Player - Show after recording */}
                {recording.recordingUri && !recording.isRecording && (
                  <View style={styles.audioPlayerBox}>
                    {/* Title with transliteration - centered */}
                    <View style={{ marginBottom: 12, alignItems: 'center' }}>
                      {renderText(
                        language === 'urdu' && transliteration.nativeScriptRenderings.yourRecording
                          ? transliteration.nativeScriptRenderings.yourRecording
                          : getYourRecordingLabel(language),
                        [{ fontSize: 16, fontWeight: '600', color: colors.primary }]
                      )}
                      {transliteration.showTransliterations && transliteration.transliterations.yourRecording && (
                        <View style={{ marginTop: 4 }}>
                          {renderTransliteration(
                            transliteration.transliterations.yourRecording,
                            [styles.transliterationText, { fontSize: 12 }]
                          )}
                        </View>
                      )}
                    </View>
                    
                    <AudioPlayer
                      isPlaying={recording.isPlaying}
                      currentTime={recording.playbackPosition / 1000}
                      duration={recording.playbackDuration / 1000}
                      onPlayPause={recording.togglePlayback}
                      onSeek={(timeInSeconds) => recording.seekAudio(timeInSeconds * 1000)}
                      onReplay={recording.replayAudio}
                      volume={1.0}
                      onVolumeChange={() => {}}
                      primaryColor={colors.primary}
                      showVolumeControl={false}
                      paragraphLabel={null}
                      language={language}
                    />
                    
                    {/* New Recording Button */}
                    <TouchableOpacity
                      style={styles.newRecordingButton}
                      onPress={handleNewRecording}
                    >
                      <Ionicons name="refresh" size={20} color={colors.primary} />
                      <View style={{ marginLeft: 8 }}>
                        {renderText(
                          language === 'urdu' && transliteration.nativeScriptRenderings.recordAgain
                            ? transliteration.nativeScriptRenderings.recordAgain
                            : getRecordAgainLabel(language),
                          [styles.newRecordingButtonText, { color: colors.primary }]
                        )}
                        {transliteration.showTransliterations && transliteration.transliterations.recordAgain && (
                          renderTransliteration(
                            transliteration.transliterations.recordAgain,
                            [styles.transliterationText, { fontSize: 11, color: colors.primary, marginTop: 2 }]
                          )
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              /* Text Input Mode */
              <TextInput
                style={[
                  styles.textInput,
                  language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                ]}
                placeholder={
                  language === 'urdu' && transliteration.nativeScriptRenderings.placeholder
                    ? transliteration.nativeScriptRenderings.placeholder
                    : getTypeResponsePlaceholderLabel(language)
                }
                value={grading.userAnswer}
                onChangeText={grading.setUserAnswer}
                multiline
                numberOfLines={10}
                editable={!grading.gradingLoading}
                placeholderTextColor="#999"
              />
            )}

            {/* Submit Button */}
            {((useAudioInput && recording.recordingUri) || (!useAudioInput && grading.userAnswer)) && !grading.gradingResult && (
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={handleSubmit}
                disabled={grading.gradingLoading}
              >
                {grading.gradingLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <View>
                      {renderText(
                        language === 'urdu' && transliteration.nativeScriptRenderings.submitButton
                          ? transliteration.nativeScriptRenderings.submitButton
                          : getSubmitForGradingLabel(language),
                        styles.submitButtonText
                      )}
                      {transliteration.showTransliterations && transliteration.transliterations.submitButton && (
                        renderTransliteration(
                          transliteration.transliterations.submitButton,
                          [styles.submitButtonTranslit, { color: '#FFFFFF', fontSize: 12, fontStyle: 'italic', marginTop: 2 }]
                        )
                      )}
                    </View>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Grading Progress */}
            {grading.gradingLoading && (
              <View style={[styles.gradingProgressBox, { backgroundColor: colors.light }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings.gradingSpeechWait
                      ? transliteration.nativeScriptRenderings.gradingSpeechWait
                      : getGradingSpeechWaitLabel(language),
                    [styles.gradingProgressText, { color: colors.primary }],
                    false
                  )}
                  {transliteration.showTransliterations && transliteration.transliterations.gradingSpeechWait && (
                    <View style={{ marginTop: 4 }}>
                      {renderText(transliteration.transliterations.gradingSpeechWait, [styles.transliterationText, { fontSize: 11 }], false)}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Submissions History */}
            {grading.allSubmissions.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={{ marginBottom: 16 }}>
                  <View style={language === 'urdu' && { alignItems: 'flex-start' }}>
                    {renderText(
                      language === 'urdu' && transliteration.nativeScriptRenderings.submissionsFeedback
                        ? transliteration.nativeScriptRenderings.submissionsFeedback
                        : getSubmissionsFeedbackLabel(language),
                      [styles.sectionTitle, styles.boldText],
                      true
                    )}
                  </View>
                  {transliteration.showTransliterations && transliteration.transliterations.submissionsFeedback && (
                    <View style={[{ marginTop: 4 }, language === 'urdu' && { alignItems: 'flex-end' }]}>
                      {renderTransliteration(transliteration.transliterations.submissionsFeedback, styles.transliterationText)}
                    </View>
                  )}
                </View>

                {grading.allSubmissions.map((submission, index) => {
                  const submissionResult = submission.grading_result;
                  const isExpanded = grading.expandedSubmissions.has(index);

                  return (
                    <View key={index} style={[styles.gradingResultBox, { backgroundColor: colors.light, marginBottom: 20 }]}>
                      <TouchableOpacity
                        style={styles.submissionHeader}
                        onPress={() => grading.toggleSubmissionExpansion(index)}
                      >
                        <View style={{ flex: 1 }}>
                          {renderText(
                            language === 'urdu' && transliteration.nativeScriptRenderings.submissionNumber
                              ? `${transliteration.nativeScriptRenderings.submissionNumber} ${index + 1}`
                              : `${getSubmissionNumberLabel(language)} ${index + 1}`,
                            [styles.gradingResultTitle, { color: colors.primary }]
                          )}
                          {transliteration.showTransliterations && transliteration.transliterations.submissionNumber && (
                            <View style={{ marginTop: 2 }}>
                              {renderTransliteration(
                                `${transliteration.transliterations.submissionNumber} ${index + 1}`,
                                styles.transliterationText
                              )}
                            </View>
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
                          {/* Audio Player */}
                          {submission.audio_base64 && (
                            <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
                              {/* Audio Player Label with transliteration */}
                              <View style={{ marginBottom: 8, alignItems: 'center' }}>
                                {renderText(
                                  `${language === 'urdu' && transliteration.nativeScriptRenderings.yourRecording
                                    ? transliteration.nativeScriptRenderings.yourRecording
                                    : getYourRecordingLabel(language)} #${index + 1}`,
                                  [{ fontSize: 14, fontWeight: '600', color: colors.primary }]
                                )}
                                {transliteration.showTransliterations && transliteration.transliterations.yourRecording && (
                                  <View style={{ marginTop: 4 }}>
                                    {renderTransliteration(
                                      `${transliteration.transliterations.yourRecording} #${index + 1}`,
                                      [styles.transliterationText, { fontSize: 11 }]
                                    )}
                                  </View>
                                )}
                              </View>
                              
                              <AudioPlayer
                                isPlaying={submissionAudioStates[index]?.isPlaying || false}
                                currentTime={(submissionAudioStates[index]?.position || 0) / 1000}
                                duration={(submissionAudioStates[index]?.duration || 0) / 1000}
                                onPlayPause={() => toggleSubmissionPlayback(index, submission.audio_base64)}
                                onSeek={(timeInSeconds) => seekSubmissionAudio(index, timeInSeconds * 1000)}
                                onReplay={() => replaySubmissionAudio(index)}
                                volume={1.0}
                                onVolumeChange={() => {}}
                                primaryColor={colors.primary}
                                showVolumeControl={false}
                                language={language}
                              />
                            </View>
                          )}

                          {/* Transcript */}
                          {submission.transcript && (
                            <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
                              <View style={{ marginBottom: 8 }}>
                                {renderText(
                                  language === 'urdu' && transliteration.nativeScriptRenderings.transcriptLabel
                                    ? transliteration.nativeScriptRenderings.transcriptLabel
                                    : getTranscriptLabel(language),
                                  [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: '600' }],
                                  true
                                )}
                                {transliteration.showTransliterations && transliteration.transliterations.transcriptLabel && (
                                  <View style={{ marginTop: 4 }}>
                                    {renderTransliteration(transliteration.transliterations.transcriptLabel, styles.transliterationText)}
                                  </View>
                                )}
                              </View>
                              {renderText(
                                language === 'urdu' && transliteration.nativeScriptRenderings[`transcript_${index}`]
                                  ? transliteration.nativeScriptRenderings[`transcript_${index}`]
                                  : submission.transcript,
                                styles.gradingFeedbackText,
                                true
                              )}
                              {transliteration.showTransliterations && transliteration.transliterations[`transcript_${index}`] && (
                                <View style={{ marginTop: 8 }}>
                                  {renderTransliteration(transliteration.transliterations[`transcript_${index}`], styles.transliterationText)}
                                </View>
                              )}
                            </View>
                          )}

                          {/* Grading Results */}
                          {submissionResult && (
                            <>
                              <View style={styles.gradingScores}>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    {renderText(
                                      language === 'urdu' && transliteration.nativeScriptRenderings.overallScore
                                        ? transliteration.nativeScriptRenderings.overallScore
                                        : getOverallScoreLabel(language),
                                      styles.gradingScoreLabel,
                                      true
                                    )}
                                    {transliteration.showTransliterations && transliteration.transliterations.overallScore && (
                                      renderTransliteration(transliteration.transliterations.overallScore, [styles.transliterationText, { fontSize: 10 }])
                                    )}
                                  </View>
                                  <Text style={[styles.gradingScoreValue, { color: colors.primary, fontSize: 20, fontWeight: '700' }]}>
                                    {Math.round(submissionResult.score || 0)}%
                                  </Text>
                                </View>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    {renderText(
                                      language === 'urdu' && transliteration.nativeScriptRenderings.vocabularyScore
                                        ? transliteration.nativeScriptRenderings.vocabularyScore
                                        : getVocabularyScoreLabel(language),
                                      styles.gradingScoreLabel,
                                      true
                                    )}
                                    {transliteration.showTransliterations && transliteration.transliterations.vocabularyScore && (
                                      renderTransliteration(transliteration.transliterations.vocabularyScore, [styles.transliterationText, { fontSize: 10 }])
                                    )}
                                  </View>
                                  <Text style={styles.gradingScoreValue}>{submissionResult.vocabulary_score}%</Text>
                                </View>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    {renderText(
                                      language === 'urdu' && transliteration.nativeScriptRenderings.grammarScore
                                        ? transliteration.nativeScriptRenderings.grammarScore
                                        : getGrammarScoreLabel(language),
                                      styles.gradingScoreLabel,
                                      true
                                    )}
                                    {transliteration.showTransliterations && transliteration.transliterations.grammarScore && (
                                      renderTransliteration(transliteration.transliterations.grammarScore, [styles.transliterationText, { fontSize: 10 }])
                                    )}
                                  </View>
                                  <Text style={styles.gradingScoreValue}>{submissionResult.grammar_score}%</Text>
                                </View>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    {renderText(
                                      language === 'urdu' && transliteration.nativeScriptRenderings.fluencyScore
                                        ? transliteration.nativeScriptRenderings.fluencyScore
                                        : getFluencyScoreLabel(language),
                                      styles.gradingScoreLabel,
                                      true
                                    )}
                                    {transliteration.showTransliterations && transliteration.transliterations.fluencyScore && (
                                      renderTransliteration(transliteration.transliterations.fluencyScore, [styles.transliterationText, { fontSize: 10 }])
                                    )}
                                  </View>
                                  <Text style={styles.gradingScoreValue}>{submissionResult.fluency_score || 0}%</Text>
                                </View>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    {renderText(
                                      language === 'urdu' && transliteration.nativeScriptRenderings.taskCompletionScore
                                        ? transliteration.nativeScriptRenderings.taskCompletionScore
                                        : getTaskCompletionScoreLabel(language),
                                      styles.gradingScoreLabel,
                                      true
                                    )}
                                    {transliteration.showTransliterations && transliteration.transliterations.taskCompletionScore && (
                                      renderTransliteration(transliteration.transliterations.taskCompletionScore, [styles.transliterationText, { fontSize: 10 }])
                                    )}
                                  </View>
                                  <Text style={styles.gradingScoreValue}>{submissionResult.task_completion_score || 0}%</Text>
                                </View>
                              </View>

                              {/* Feedback */}
                              {submissionResult.feedback && (
                                <View style={styles.gradingFeedback}>
                                  <View style={{ marginBottom: 12 }}>
                                    {renderText(
                                      language === 'urdu' && transliteration.nativeScriptRenderings.detailedFeedback
                                        ? transliteration.nativeScriptRenderings.detailedFeedback
                                        : getDetailedFeedbackLabel(language),
                                      [styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: 'bold', fontSize: 17 }],
                                      true
                                    )}
                                    {transliteration.showTransliterations && transliteration.transliterations.detailedFeedback && (
                                      <View style={{ marginTop: 4 }}>
                                        {renderTransliteration(transliteration.transliterations.detailedFeedback, styles.transliterationText)}
                                      </View>
                                    )}
                                  </View>
                                  {submissionResult.feedback.split('\n\n').map((para, pIndex) => (
                                    <View key={pIndex} style={{ marginBottom: pIndex < submissionResult.feedback.split('\n\n').length - 1 ? 12 : 0 }}>
                                      {renderText(
                                        language === 'urdu' && transliteration.nativeScriptRenderings[`feedback_${index}_para_${pIndex}`]
                                          ? transliteration.nativeScriptRenderings[`feedback_${index}_para_${pIndex}`]
                                          : para.trim(),
                                        styles.gradingFeedbackText,
                                        true
                                      )}
                                      {transliteration.showTransliterations && transliteration.transliterations[`feedback_${index}_para_${pIndex}`] && (
                                        <View style={{ marginTop: 8 }}>
                                          {renderTransliteration(transliteration.transliterations[`feedback_${index}_para_${pIndex}`], styles.transliterationText)}
                                        </View>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              )}

                              {/* Word Usage Feedback */}
                              {submissionResult.required_words_feedback && Object.keys(submissionResult.required_words_feedback).length > 0 && (
                                <View style={styles.gradingWordsFeedback}>
                                  <View style={{ marginBottom: 12 }}>
                                    {renderText(
                                      language === 'urdu' && transliteration.nativeScriptRenderings.wordUsageFeedback
                                        ? transliteration.nativeScriptRenderings.wordUsageFeedback
                                        : getWordUsageFeedbackLabel(language),
                                      [styles.gradingFeedbackLabel, { fontWeight: 'bold', fontSize: 17 }],
                                      true
                                    )}
                                    {transliteration.showTransliterations && transliteration.transliterations.wordUsageFeedback && (
                                      <View style={{ marginTop: 4 }}>
                                        {renderTransliteration(transliteration.transliterations.wordUsageFeedback, styles.transliterationText)}
                                      </View>
                                    )}
                                  </View>
                                  {Object.entries(submissionResult.required_words_feedback).map(([word, feedback], fIndex) => {
                                    const wordKey = `word_feedback_word_${index}_${fIndex}`;
                                    const feedbackKey = `word_feedback_text_${index}_${fIndex}`;
                                    return (
                                      <View key={word} style={styles.gradingWordFeedbackItem}>
                                        <View style={{ marginBottom: 4, flexDirection: 'row', alignItems: 'center' }}>
                                          {renderText(
                                            language === 'urdu' && transliteration.nativeScriptRenderings[wordKey]
                                              ? transliteration.nativeScriptRenderings[wordKey]
                                              : word,
                                            styles.gradingWordFeedbackWord,
                                            true
                                          )}
                                          {transliteration.showTransliterations && transliteration.transliterations[wordKey] && (
                                            renderText(` (${transliteration.transliterations[wordKey]})`, [styles.transliterationText, { fontSize: 11, marginLeft: 4 }], true)
                                          )}
                                        </View>
                                        {renderText(
                                          language === 'urdu' && transliteration.nativeScriptRenderings[feedbackKey]
                                            ? transliteration.nativeScriptRenderings[feedbackKey]
                                            : (typeof feedback === 'string' ? feedback : (feedback?.text || '')),
                                          styles.gradingWordFeedbackText,
                                          true
                                        )}
                                        {transliteration.showTransliterations && transliteration.transliterations[feedbackKey] && (
                                          <View style={{ marginTop: 4 }}>
                                            {renderTransliteration(transliteration.transliterations[feedbackKey], styles.transliterationText)}
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })}
                                </View>
                              )}

                              {/* Tasks Feedback */}
                              {submissionResult.tasks_feedback && Object.keys(submissionResult.tasks_feedback).length > 0 && (
                                <View style={styles.gradingWordsFeedback}>
                                  <View style={{ marginBottom: 12 }}>
                                    <View style={language === 'urdu' && { alignItems: 'flex-start' }}>
                                      {renderText(
                                        language === 'urdu' && transliteration.nativeScriptRenderings.tasksFeedback
                                          ? transliteration.nativeScriptRenderings.tasksFeedback
                                          : (language === 'kannada' ? 'ಕಾರ್ಯ ಪ್ರತಿಕ್ರಿಯೆ:' : 'Tasks Feedback:'),
                                        [styles.gradingFeedbackLabel, { fontWeight: 'bold', fontSize: 17 }],
                                        true
                                      )}
                                    </View>
                                    {transliteration.showTransliterations && transliteration.transliterations.tasksFeedback && (
                                      <View style={[{ marginTop: 4 }, language === 'urdu' && { alignItems: 'flex-end' }]}>
                                        {renderTransliteration(transliteration.transliterations.tasksFeedback, styles.transliterationText)}
                                      </View>
                                    )}
                                  </View>
                                  {Object.entries(submissionResult.tasks_feedback).map(([taskKey, feedback], tIndex) => {
                                    const taskLabelKey = `task_feedback_label_${index}_${tIndex}`;
                                    const taskFeedbackKey = `task_feedback_text_${index}_${tIndex}`;
                                    return (
                                      <View key={taskKey} style={styles.gradingWordFeedbackItem}>
                                        <View style={{ marginBottom: 4, flexDirection: 'row', alignItems: 'center' }}>
                                          {renderText(
                                            `${language === 'kannada' ? 'ಕಾರ್ಯ' : 'Task'} ${tIndex + 1}`,
                                            styles.gradingWordFeedbackWord,
                                            true
                                          )}
                                        </View>
                                        {renderText(
                                          language === 'urdu' && transliteration.nativeScriptRenderings[taskFeedbackKey]
                                            ? transliteration.nativeScriptRenderings[taskFeedbackKey]
                                            : (typeof feedback === 'string' ? feedback : (feedback?.text || '')),
                                          styles.gradingWordFeedbackText,
                                          true
                                        )}
                                        {transliteration.showTransliterations && transliteration.transliterations[taskFeedbackKey] && (
                                          <View style={{ marginTop: 4 }}>
                                            {renderTransliteration(transliteration.transliterations[taskFeedbackKey], styles.transliterationText)}
                                          </View>
                                        )}
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
          </View>
        )}
      </ScrollView>

      {/* Vocabulary Dictionary Modal */}
      <VocabularyDictionary
        visible={dictionary.showDictionary}
        onClose={() => dictionary.setShowDictionary(false)}
        initialLanguage={language}
        initialSearchQuery={dictionary.initialSearchQuery}
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
  titleContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
  },
  titleWrapper: {
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  titleTransliterationWrapper: {
    marginTop: 4,
  },
  titleTransliteration: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sectionTitleContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  boldText: {
    fontWeight: 'bold',
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
  },
  transliterationText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  requiredWordsBox: {
    marginBottom: 20,
  },
  requiredWordsLabel: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  wordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  wordTagText: {
    fontSize: 14,
    fontWeight: '600',
  },
  wordTagTranslit: {
    fontSize: 12,
    marginTop: 2,
  },
  rubricSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  rubricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rubricHeaderText: {
    fontSize: 16,
  },
  rubricContent: {
    marginTop: 12,
  },
  criteriaList: {
    gap: 8,
  },
  criteriaBulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  criteriaBullet: {
    fontSize: 16,
    marginRight: 8,
    color: '#1A1A1A',
  },
  criteriaBulletText: {
    flex: 1,
  },
  criteriaText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
  },
  tasksBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  taskCheckbox: {
    marginRight: 12,
  },
  taskText: {
    flex: 1,
  },
  taskTextContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
  },
  inputModeBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  recordingBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  recordButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  recordingDurationBox: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    alignItems: 'center',
  },
  recordingDurationText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '600',
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  processingText: {
    fontSize: 16,
  },
  audioPlayerBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
  },
  newRecordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#4A90E2',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  newRecordingButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  transcriptLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 200,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  submitButton: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gradingProgressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  gradingProgressText: {
    marginLeft: 12,
    fontSize: 16,
  },
  gradingResultBox: {
    borderRadius: 12,
    padding: 20,
  },
  submissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gradingResultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  gradingScores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  gradingScoreItem: {
    flex: 1,
    minWidth: '40%',
  },
  gradingScoreLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  gradingScoreValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  gradingFeedback: {
    marginBottom: 16,
  },
  gradingFeedbackLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  gradingFeedbackText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
  },
  gradingWordsFeedback: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  gradingWordFeedbackItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  gradingWordFeedbackWord: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50',
  },
  gradingWordFeedbackText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
  },
});
