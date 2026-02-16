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
import { useActivityCompletion } from './shared/hooks/useActivityCompletion';
import { useRecording } from './shared/hooks/useRecording';
import { VocabularyDictionary, APIDebugModal, TopicSelectionModal, AudioPlayer } from './shared/components';
import { ACTIVITY_COLORS } from './shared/constants';
import { normalizeText } from './shared/utils/textProcessing';
import {
  getProgressTitleLabel,
  getSentenceNumberLabel,
  getOfLabel,
  getTranslateThisLabel,
  getYourTranslationLabel,
  getTypeTranslationPlaceholderLabel,
  getPreviousButtonLabel,
  getNextButtonLabel,
  getAllSentencesLabel,
  getSubmitForGradingLabel,
  getGradingButtonLabel,
  getResultsLabel,
  getCompleteActivityLabel,
  getSubmissionNumberLabel,
  getOverallScoreLabel,
  getSentenceAnalysisLabel,
  getSentenceLabel,
  getSourceLabel,
  getYourTranslationSingleLabel,
  getExpectedLabel,
  getFeedbackLabel,
  getTranslationActivityLabel,
  getInputMethodLabel,
  getTextInputModeLabel,
  getAudioInputModeLabel,
  getStartRecordingLabel,
  getStopRecordingLabel,
  getProcessingAudioLabel,
  getRecordAgainLabel,
} from '../../constants/ui_labels';

/**
 * TranslationActivity Component
 * Handles translation exercises from other languages the user is learning
 * Language-agnostic design with full transliteration and dictionary support
 */
export default function TranslationActivity({ route, navigation }) {
  const { activityId, fromHistory, activityData: routeActivityData } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  const routeLang = (route && route.params && route.params.language) || null;
  const language = ctxLanguage || routeLang || 'kannada';

  // Use shared hooks
  const activityData = useActivityData('translation', language, activityId, fromHistory, routeActivityData);
  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);
  const grading = useGrading('translation', language);
  const { complete } = useActivityCompletion(language, 'translation');

  // Translation-specific state
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [userTranslations, setUserTranslations] = useState({});
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [showAPIDebug, setShowAPIDebug] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(!fromHistory);
  const [allSentencesExpanded, setAllSentencesExpanded] = useState(false); // Start collapsed
  
  // Audio recording state
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'audio'
  const [sentenceRecordings, setSentenceRecordings] = useState({}); // { sentenceIndex: { uri, base64, isRecording } }
  const [recordingStates, setRecordingStates] = useState({}); // { sentenceIndex: 'idle'|'recording'|'processing' }
  const recordingRefs = useRef({}); // Store recording instances per sentence
  
  // For audio playback of recordings
  const [audioStates, setAudioStates] = useState({});
  const audioRefs = useRef({});

  const colors = ACTIVITY_COLORS.translation;

  const handleTopicSelection = (selectedTopic) => {
    setShowTopicModal(false);
    activityData.loadActivity(selectedTopic);
  };

  const handleCloseTopicModal = () => {
    setShowTopicModal(false);
    navigation.goBack();
  };

  useEffect(() => {
    if (fromHistory) {
      activityData.loadActivity();
    }
  }, []);

  // Load existing submissions from activity data (when reopening from history)
  useEffect(() => {
    if (activityData.activity?.submissions && Array.isArray(activityData.activity.submissions)) {
      // Only load if grading hook doesn't already have submissions
      if (grading.allSubmissions.length === 0 && activityData.activity.submissions.length > 0) {
        // Backend stores chronologically, display most recent first
        const existingSubmissions = [...activityData.activity.submissions].reverse();
        grading.setAllSubmissions(existingSubmissions);
      }
    }
  }, [activityData.activity?.submissions]);

  // Fetch native script and transliterations for UI labels
  useEffect(() => {
    // Fetch native script for "Translation" activity type label
    const activityTypeLabel = getTranslationActivityLabel(language);
    transliteration.ensureNativeScriptForKey('activityType', activityTypeLabel);
    transliteration.ensureAndShowTransliterationForKey('activityType', activityTypeLabel);
    
    // Fetch native script for AI-generated activity name (title)
    if (activityData.activity?.activity_name) {
      transliteration.ensureNativeScriptForKey('activity_name', activityData.activity.activity_name);
      transliteration.ensureAndShowTransliterationForKey('activity_name', activityData.activity.activity_name);
    }
    if (activityData.activity?.instructions) {
      transliteration.ensureNativeScriptForKey('instructions', activityData.activity.instructions);
      transliteration.ensureAndShowTransliterationForKey('instructions', activityData.activity.instructions);
    }
    
    // Fetch native script for all UI labels
    const uiLabels = [
      { key: 'progressTitle', text: getProgressTitleLabel(language) },
      { key: 'sentenceNumber', text: getSentenceNumberLabel(language) },
      { key: 'of', text: getOfLabel(language) },
      { key: 'translateThis', text: getTranslateThisLabel(language) },
      { key: 'yourTranslation', text: getYourTranslationLabel(language) },
      { key: 'typePlaceholder', text: getTypeTranslationPlaceholderLabel(language) },
      { key: 'previous', text: getPreviousButtonLabel(language) },
      { key: 'next', text: getNextButtonLabel(language) },
      { key: 'allSentences', text: getAllSentencesLabel(language) },
      { key: 'submitGrading', text: getSubmitForGradingLabel(language) },
      { key: 'grading', text: getGradingButtonLabel(language) },
      { key: 'results', text: getResultsLabel(language) },
      { key: 'completeActivity', text: getCompleteActivityLabel(language) },
      { key: 'submissionNumber', text: getSubmissionNumberLabel(language) },
      { key: 'overallScore', text: getOverallScoreLabel(language) },
      { key: 'sentenceAnalysis', text: getSentenceAnalysisLabel(language) },
      { key: 'sentenceLabel', text: getSentenceLabel(language) },
      { key: 'source', text: getSourceLabel(language) },
      { key: 'yourTranslationSingle', text: getYourTranslationSingleLabel(language) },
      { key: 'expected', text: getExpectedLabel(language) },
      { key: 'feedback', text: getFeedbackLabel(language) },
    ];
    
    uiLabels.forEach(({ key, text }) => {
      transliteration.ensureNativeScriptForKey(key, text);
      transliteration.ensureAndShowTransliterationForKey(key, text);
    });
    
    // Fetch native script for sentences and submissions
    if (activityData.activity?.sentences) {
      activityData.activity.sentences.forEach((sentence, idx) => {
        if (sentence.text) {
          transliteration.ensureNativeScriptForKey(`sentence_${idx}_text`, sentence.text);
        }
        if (sentence.expected_translation) {
          transliteration.ensureNativeScriptForKey(`sentence_${idx}_expected`, sentence.expected_translation);
        }
        if (sentence.language_display) {
          transliteration.ensureNativeScriptForKey(`language_${idx}`, sentence.language_display);
          transliteration.ensureAndShowTransliterationForKey(`language_${idx}`, sentence.language_display);
        }
      });
    }
    
    // Fetch native script for submissions
    grading.allSubmissions.forEach((submission, subIdx) => {
      if (submission.feedback) {
        transliteration.ensureNativeScriptForKey(`submission_${subIdx}_feedback`, submission.feedback);
        transliteration.ensureAndShowTransliterationForKey(`submission_${subIdx}_feedback`, submission.feedback);
      }
      if (submission.sentence_feedback && Array.isArray(submission.sentence_feedback)) {
        submission.sentence_feedback.forEach((sentenceFb, sentIdx) => {
          if (sentenceFb.source_text) {
            transliteration.ensureNativeScriptForKey(`submission_${subIdx}_sentence_${sentIdx}_source`, sentenceFb.source_text);
          }
          if (sentenceFb.user_translation) {
            transliteration.ensureNativeScriptForKey(`submission_${subIdx}_sentence_${sentIdx}_user`, sentenceFb.user_translation);
          }
          if (sentenceFb.expected_translation) {
            transliteration.ensureNativeScriptForKey(`submission_${subIdx}_sentence_${sentIdx}_expected`, sentenceFb.expected_translation);
          }
          if (sentenceFb.feedback) {
            transliteration.ensureNativeScriptForKey(`submission_${subIdx}_sentence_${sentIdx}_feedback`, sentenceFb.feedback);
            transliteration.ensureAndShowTransliterationForKey(`submission_${subIdx}_sentence_${sentIdx}_feedback`, sentenceFb.feedback);
          }
        });
      }
    });
  }, [activityData.activity?.activity_name, activityData.activity?.instructions, activityData.activity?.sentences, grading.allSubmissions, language]);

  // Handle sentence navigation
  const goToNextSentence = () => {
    if (activityData.activity && currentSentenceIndex < activityData.activity.sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
    }
  };

  const goToPreviousSentence = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(currentSentenceIndex - 1);
    }
  };

  // Handle translation input
  const handleTranslationChange = (index, text) => {
    setUserTranslations(prev => ({
      ...prev,
      [index]: text
    }));
  };

  // Submit all translations for grading
  const handleSubmit = async () => {
    if (!activityData.activity || !activityData.activity.sentences || activityData.activity.sentences.length === 0) return;

    const translations = activityData.activity.sentences.map((sentence, index) => ({
      source_text: sentence.text,
      source_language: sentence.language,
      user_translation: userTranslations[index] || '',
      expected_translation: sentence.expected_translation,
    }));

    await grading.submitTranslation(activityData.activity, translations);
  };

  // Complete activity and log
  const handleComplete = async () => {
    if (!activityData.activity || grading.allSubmissions.length === 0) return;

    const latestSubmission = grading.allSubmissions[0];
    const score = (latestSubmission.overall_score || 0) / 100; // Convert percentage to decimal

    await complete({
      score,
      wordUpdates: [],
      activityData: {
        ...activityData.activity,
        submissions: grading.allSubmissions,
      },
      activityId: activityData.activity?.activity_id || null
    });

    navigation.goBack();
  };

  // Enhanced text renderer with word-level click support for dictionary
  const renderText = (text, style = {}, enableWordClick = false, wordLanguage = null) => {
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
              onPress={() => dictionary.handleWordClick(word.trim(), wordLanguage)}
            >
              {word}
            </Text>
          );
        })}
      </Text>
    );
  };

  if (activityData.loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <SafeText style={styles.loadingText}>Loading translation activity...</SafeText>
        </View>
      </View>
    );
  }

  if (activityData.error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
          <SafeText style={styles.errorText}>{activityData.error}</SafeText>
          <TouchableOpacity style={styles.retryButton} onPress={() => activityData.loadActivity()}>
            <SafeText style={styles.retryButtonText}>Retry</SafeText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Additional safety check for sentences array
  if (activityData.activity && (!activityData.activity.sentences || activityData.activity.sentences.length === 0)) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF9500" />
          <SafeText style={styles.errorText}>No sentences available for this activity.</SafeText>
          <TouchableOpacity style={styles.retryButton} onPress={() => activityData.loadActivity()}>
            <SafeText style={styles.retryButtonText}>Retry</SafeText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const activity = activityData.activity;
  const currentSentence = activity?.sentences?.[currentSentenceIndex];
  const allTranslationsComplete = Array.isArray(activity?.sentences) && activity.sentences.length > 0 && activity.sentences.every((_, idx) => userTranslations[idx]?.trim());
  const hasSubmissions = grading.allSubmissions && grading.allSubmissions.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <SafeText style={[
            styles.headerTitle,
            language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
          ]}>
            {transliteration.nativeScriptRenderings.activityType || getTranslationActivityLabel(language)}
          </SafeText>
          {transliteration.showTransliterations && transliteration.transliterations.activityType && (
            <SafeText style={[
              styles.headerTransliteration,
              language === 'urdu' && { textAlign: 'right' }
            ]}>
              {transliteration.transliterations.activityType}
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
          <TouchableOpacity
            style={[styles.toggleButton, highlightVocab && styles.toggleButtonActive]}
            onPress={() => setHighlightVocab(!highlightVocab)}
          >
            <Ionicons name={highlightVocab ? "color-palette" : "color-palette-outline"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => dictionary.setShowDictionary(true)}
          >
            <Ionicons name="book" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAPIDebug(true)} style={styles.toggleButton}>
            <Ionicons name="bug" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activity && activity.sentences && activity.sentences.length > 0 && (
          <>
            {/* AI-Generated Activity Title */}
            {activity?.activity_name && (
              <View style={[styles.activityTitleCard, { marginBottom: hasSubmissions ? 20 : 12 }]}>
                <SafeText style={[
                  styles.activityTitleText,
                  language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'center' }
                ]}>
                  {transliteration.nativeScriptRenderings.activity_name || activity.activity_name}
                </SafeText>
                {transliteration.showTransliterations && transliteration.transliterations.activity_name && (
                  <SafeText style={[
                    styles.activityTitleTranslit,
                    language === 'urdu' && { textAlign: 'center' }
                  ]}>
                    {transliteration.transliterations.activity_name}
                  </SafeText>
                )}
              </View>
            )}

            {/* Instructions */}
            <View style={styles.instructionsCard}>
              <SafeText style={[
                styles.instructionsTitle,
                language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
              ]}>
                {transliteration.nativeScriptRenderings.instructions || activity?.instructions || 'No instructions available'}
              </SafeText>
              {transliteration.showTransliterations && transliteration.transliterations.instructions && (
                <SafeText style={[
                  styles.translitText,
                  language === 'urdu' && { textAlign: 'right' }
                ]}>
                  {transliteration.transliterations.instructions}
                </SafeText>
              )}
            </View>

            {/* Progress Indicator */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <SafeText style={[
                  styles.progressTitle,
                  language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                ]}>
                  {transliteration.nativeScriptRenderings.progressTitle || getProgressTitleLabel(language)}
                </SafeText>
                <SafeText style={styles.progressCount}>
                  {Object.keys(userTranslations).filter(k => userTranslations[k]?.trim()).length} / {activity?.sentences?.length || 0}
                </SafeText>
              </View>
              {transliteration.showTransliterations && transliteration.transliterations.progressTitle && (
                <SafeText style={[
                  styles.translitText,
                  language === 'urdu' && { textAlign: 'right' }
                ]}>
                  {transliteration.transliterations.progressTitle}
                </SafeText>
              )}
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: (activity?.sentences?.length && activity.sentences.length > 0) 
                        ? `${(Object.keys(userTranslations).filter(k => userTranslations[k]?.trim()).length / activity.sentences.length) * 100}%` 
                        : '0%',
                      backgroundColor: colors.primary 
                    }
                  ]} 
                />
              </View>
            </View>

            {/* Current Sentence Card */}
            {currentSentence && (
              <View style={styles.sentenceCard}>
                <View style={styles.sentenceHeader}>
                  <SafeText style={[
                    styles.sentenceNumber,
                    language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                  ]}>
                    {transliteration.nativeScriptRenderings.sentenceNumber || getSentenceNumberLabel(language)} {currentSentenceIndex + 1} {transliteration.nativeScriptRenderings.of || getOfLabel(language)} {activity.sentences.length}
                  </SafeText>
                  {transliteration.showTransliterations && transliteration.transliterations.sentenceNumber && transliteration.transliterations.of && (
                    <SafeText style={[
                      styles.translitText,
                      language === 'urdu' && { textAlign: 'right' }
                    ]}>
                      {transliteration.transliterations.sentenceNumber} {currentSentenceIndex + 1} {transliteration.transliterations.of} {activity.sentences.length}
                    </SafeText>
                  )}
                  <View style={[styles.languageBadge, { backgroundColor: colors.light }]}>
                    <SafeText style={[styles.languageBadgeText, { color: colors.primary }]}>
                      {transliteration.nativeScriptRenderings[`language_${currentSentenceIndex}`] || currentSentence.language_display || currentSentence.language}
                    </SafeText>
                    {transliteration.showTransliterations && transliteration.transliterations[`language_${currentSentenceIndex}`] && (
                      <SafeText style={[styles.languageBadgeTranslit, { color: colors.primary }]}>
                        {transliteration.transliterations[`language_${currentSentenceIndex}`]}
                      </SafeText>
                    )}
                  </View>
                </View>

                {/* Source Sentence */}
                <View style={styles.sourceSentenceContainer}>
                  <SafeText style={[
                    styles.sourceSentenceLabel,
                    language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                  ]}>
                    {transliteration.nativeScriptRenderings.translateThis || getTranslateThisLabel(language)}
                  </SafeText>
                  {transliteration.showTransliterations && transliteration.transliterations.translateThis && (
                    <SafeText style={[
                      styles.translitText,
                      language === 'urdu' && { textAlign: 'right' }
                    ]}>
                      {transliteration.transliterations.translateThis}
                    </SafeText>
                  )}
                  {renderText(
                    currentSentence.text,
                    [
                      styles.sourceSentenceText,
                      currentSentence.language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ],
                    true,
                    currentSentence.language
                  )}
                  {currentSentence.transliteration && renderText(
                    currentSentence.transliteration,
                    styles.sourceSentenceTranslit,
                    true,
                    currentSentence.language
                  )}
                </View>

                {/* Translation Input */}
                <View style={styles.translationInputContainer}>
                  <SafeText style={[
                    styles.translationInputLabel,
                    language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                  ]}>
                    {transliteration.nativeScriptRenderings.yourTranslation || getYourTranslationLabel(language)}
                  </SafeText>
                  {transliteration.showTransliterations && transliteration.transliterations.yourTranslation && (
                    <SafeText style={[
                      styles.translitText,
                      language === 'urdu' && { textAlign: 'right' }
                    ]}>
                      {transliteration.transliterations.yourTranslation}
                    </SafeText>
                  )}
                  <TextInput
                    style={[
                      styles.translationInput,
                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}
                    value={userTranslations[currentSentenceIndex] || ''}
                    onChangeText={(text) => handleTranslationChange(currentSentenceIndex, text)}
                    placeholder={transliteration.nativeScriptRenderings.typePlaceholder || getTypeTranslationPlaceholderLabel(language)}
                    placeholderTextColor="#999"
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Navigation Buttons */}
                <View style={styles.navigationButtons}>
                  <TouchableOpacity
                    style={[
                      styles.navButton,
                      currentSentenceIndex === 0 && styles.navButtonDisabled
                    ]}
                    onPress={goToPreviousSentence}
                    disabled={currentSentenceIndex === 0}
                  >
                    <Ionicons 
                      name="chevron-back" 
                      size={20} 
                      color={currentSentenceIndex === 0 ? '#CCC' : colors.primary} 
                    />
                    <View style={styles.navButtonTextContainer}>
                      <SafeText style={[
                        styles.navButtonText,
                        { color: currentSentenceIndex === 0 ? '#CCC' : colors.primary },
                        language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                      ]}>
                        {transliteration.nativeScriptRenderings.previous || getPreviousButtonLabel(language)}
                      </SafeText>
                      {transliteration.showTransliterations && transliteration.transliterations.previous && (
                        <SafeText style={[
                          styles.navButtonTranslit,
                          { color: currentSentenceIndex === 0 ? '#CCC' : colors.primary }
                        ]}>
                          {transliteration.transliterations.previous}
                        </SafeText>
                      )}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.navButton,
                      currentSentenceIndex === activity.sentences.length - 1 && styles.navButtonDisabled
                    ]}
                    onPress={goToNextSentence}
                    disabled={currentSentenceIndex === activity.sentences.length - 1}
                  >
                    <View style={styles.navButtonTextContainer}>
                      <SafeText style={[
                        styles.navButtonText,
                        { color: currentSentenceIndex === activity.sentences.length - 1 ? '#CCC' : colors.primary },
                        language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                      ]}>
                        {transliteration.nativeScriptRenderings.next || getNextButtonLabel(language)}
                      </SafeText>
                      {transliteration.showTransliterations && transliteration.transliterations.next && (
                        <SafeText style={[
                          styles.navButtonTranslit,
                          { color: currentSentenceIndex === activity.sentences.length - 1 ? '#CCC' : colors.primary }
                        ]}>
                          {transliteration.transliterations.next}
                        </SafeText>
                      )}
                    </View>
                    <Ionicons 
                      name="chevron-forward" 
                      size={20} 
                      color={currentSentenceIndex === activity.sentences.length - 1 ? '#CCC' : colors.primary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* All Sentences Overview */}
            <View style={styles.overviewCard}>
              <TouchableOpacity 
                style={styles.overviewHeaderButton}
                onPress={() => setAllSentencesExpanded(!allSentencesExpanded)}
              >
                <View style={{ flex: 1 }}>
                  <SafeText style={[
                    styles.overviewTitle,
                    language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                  ]}>
                    {transliteration.nativeScriptRenderings.allSentences || getAllSentencesLabel(language)}
                  </SafeText>
                  {transliteration.showTransliterations && transliteration.transliterations.allSentences && (
                    <SafeText style={[
                      styles.translitText,
                      language === 'urdu' && { textAlign: 'right' }
                    ]}>
                      {transliteration.transliterations.allSentences}
                    </SafeText>
                  )}
                </View>
                <Ionicons
                  name={allSentencesExpanded ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
              
              {allSentencesExpanded && activity.sentences.map((sentence, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.overviewItem,
                    currentSentenceIndex === index && styles.overviewItemActive
                  ]}
                  onPress={() => setCurrentSentenceIndex(index)}
                >
                  <View style={styles.overviewItemLeft}>
                    <View style={[
                      styles.overviewItemNumber,
                      userTranslations[index]?.trim() && { backgroundColor: colors.primary }
                    ]}>
                      {userTranslations[index]?.trim() ? (
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      ) : (
                        <SafeText style={styles.overviewItemNumberText}>{index + 1}</SafeText>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      {renderText(
                        transliteration.nativeScriptRenderings[`language_${index}`] || sentence.language_display || sentence.language,
                        [
                          styles.overviewItemLanguage,
                          sentence.language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                        ],
                        true,
                        sentence.language
                      )}
                      {transliteration.showTransliterations && transliteration.transliterations[`language_${index}`] && 
                        renderText(
                          transliteration.transliterations[`language_${index}`],
                          [
                            styles.overviewItemLanguageTranslit,
                            sentence.language === 'urdu' && { textAlign: 'right' }
                          ],
                          true,
                          sentence.language
                        )
                      }
                    </View>
                  </View>
                  <Ionicons 
                    name={currentSentenceIndex === index ? "chevron-down" : "chevron-forward"} 
                    size={20} 
                    color="#999" 
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Submit Button */}
            {!hasSubmissions && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  (!allTranslationsComplete || grading.gradingLoading) && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!allTranslationsComplete || grading.gradingLoading}
              >
                {grading.gradingLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <View style={styles.submitButtonTextContainer}>
                      <SafeText style={[
                        styles.submitButtonText,
                        language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                      ]}>
                        {transliteration.nativeScriptRenderings.grading || getGradingButtonLabel(language)}
                      </SafeText>
                      {transliteration.showTransliterations && transliteration.transliterations.grading && (
                        <SafeText style={styles.submitButtonTranslit}>
                          {transliteration.transliterations.grading}
                        </SafeText>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.submitButtonTextContainer}>
                    <SafeText style={[
                      styles.submitButtonText,
                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}>
                      {transliteration.nativeScriptRenderings.submitGrading || getSubmitForGradingLabel(language)}
                    </SafeText>
                    {transliteration.showTransliterations && transliteration.transliterations.submitGrading && (
                      <SafeText style={styles.submitButtonTranslit}>
                        {transliteration.transliterations.submitGrading}
                      </SafeText>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Grading Results */}
            {hasSubmissions && (
              <View style={styles.resultsSection}>
                <View style={{ marginBottom: 16 }}>
                  <SafeText style={[
                    styles.resultsSectionTitle,
                    language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                  ]}>
                    {transliteration.nativeScriptRenderings.results || getResultsLabel(language)}
                  </SafeText>
                  {transliteration.showTransliterations && transliteration.transliterations.results && (
                    <SafeText style={[
                      styles.translitText,
                      language === 'urdu' && { textAlign: 'right' }
                    ]}>
                      {transliteration.transliterations.results}
                    </SafeText>
                  )}
                </View>

                {grading.allSubmissions.map((submission, index) => {
                  const isExpanded = grading.expandedSubmissions.has(index);

                  return (
                    <View key={index} style={[styles.resultCard, { backgroundColor: colors.light, marginBottom: 20 }]}>
                      <TouchableOpacity
                        style={styles.submissionHeader}
                        onPress={() => grading.toggleSubmissionExpansion(index)}
                      >
                        <View style={{ flex: 1 }}>
                          <SafeText style={[
                            styles.resultCardTitle,
                            { color: colors.primary },
                            language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                          ]}>
                            {transliteration.nativeScriptRenderings.submissionNumber || getSubmissionNumberLabel(language)}{' '}{index + 1}
                          </SafeText>
                          {transliteration.showTransliterations && transliteration.transliterations.submissionNumber && (
                            <SafeText style={styles.translitText}>
                              {transliteration.transliterations.submissionNumber}{' '}{index + 1}
                            </SafeText>
                          )}
                          {isExpanded && (
                            <View style={styles.scoreContainer}>
                              <SafeText style={[
                                styles.scoreText,
                                { color: colors.primary },
                                language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                              ]}>
                                {transliteration.nativeScriptRenderings.overallScore || getOverallScoreLabel(language)}{' '}{Math.round(submission.overall_score || 0)}%
                              </SafeText>
                              {transliteration.showTransliterations && transliteration.transliterations.overallScore && (
                                <SafeText style={styles.translitText}>
                                  {transliteration.transliterations.overallScore}{' '}{Math.round(submission.overall_score || 0)}%
                                </SafeText>
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
                          {/* Overall Feedback */}
                          {submission.feedback && (
                            <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
                              <SafeText style={[
                                styles.feedbackTitle,
                                { color: colors.primary },
                                language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                              ]}>
                                {transliteration.nativeScriptRenderings.feedback || getFeedbackLabel(language)}
                              </SafeText>
                              {transliteration.showTransliterations && transliteration.transliterations.feedback && (
                                <SafeText style={[styles.translitText, { marginBottom: 8 }]}>
                                  {transliteration.transliterations.feedback}
                                </SafeText>
                              )}
                              {renderText(
                                transliteration.nativeScriptRenderings[`submission_${index}_feedback`] || submission.feedback,
                                [
                                  styles.feedbackText,
                                  language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                                ],
                                true,
                                language
                              )}
                              {transliteration.showTransliterations && transliteration.transliterations[`submission_${index}_feedback`] && renderText(
                                transliteration.transliterations[`submission_${index}_feedback`],
                                [styles.translitText, { marginTop: 8 }],
                                true,
                                language
                              )}
                            </View>
                          )}

                          {/* Sentence-by-sentence feedback */}
                          {submission.sentence_feedback && submission.sentence_feedback.length > 0 && (
                            <View style={styles.sentenceFeedbackContainer}>
                              <SafeText style={[
                                styles.sentenceFeedbackTitle,
                                { color: colors.primary },
                                language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                              ]}>
                                {transliteration.nativeScriptRenderings.sentenceAnalysis || getSentenceAnalysisLabel(language)}
                              </SafeText>
                              {transliteration.showTransliterations && transliteration.transliterations.sentenceAnalysis && (
                                <SafeText style={[styles.translitText, { marginBottom: 12 }]}>
                                  {transliteration.transliterations.sentenceAnalysis}
                                </SafeText>
                              )}
                              {submission.sentence_feedback.map((sentenceFb, sentenceIdx) => (
                                <View key={sentenceIdx} style={styles.sentenceFeedbackItem}>
                                  <View style={styles.sentenceFeedbackHeader}>
                                    <SafeText style={[
                                      styles.sentenceFeedbackNumber,
                                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                    ]}>
                                      {transliteration.nativeScriptRenderings.sentenceLabel || getSentenceLabel(language)}{' '}{sentenceIdx + 1}
                                    </SafeText>
                                    {sentenceFb.score !== undefined && (
                                      <View style={styles.sentenceScoreIndicator}>
                                        <Ionicons 
                                          name={sentenceFb.score >= 70 ? "checkmark-circle" : "close-circle"} 
                                          size={20} 
                                          color={sentenceFb.score >= 70 ? "#10B981" : "#EF4444"} 
                                        />
                                        <SafeText style={[
                                          styles.sentenceScoreText,
                                          { color: sentenceFb.score >= 70 ? "#10B981" : "#EF4444" }
                                        ]}>
                                          {Math.round(sentenceFb.score)}%
                                        </SafeText>
                                      </View>
                                    )}
                                  </View>
                                  {transliteration.showTransliterations && transliteration.transliterations.sentenceLabel && (
                                    <SafeText style={styles.translitText}>
                                      {transliteration.transliterations.sentenceLabel}{' '}{sentenceIdx + 1}
                                    </SafeText>
                                  )}
                                  
                                  {/* Source Text */}
                                  <View style={styles.sentenceFeedbackRow}>
                                    <SafeText style={[
                                      styles.sentenceFeedbackLabel,
                                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                    ]}>
                                      {transliteration.nativeScriptRenderings.source || getSourceLabel(language)}:
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.source && (
                                      <SafeText style={[styles.translitText, { marginBottom: 4 }]}>
                                        {transliteration.transliterations.source}:
                                      </SafeText>
                                    )}
                                    {renderText(
                                      transliteration.nativeScriptRenderings[`submission_${index}_sentence_${sentenceIdx}_source`] || sentenceFb.source_text,
                                      [
                                        styles.sentenceFeedbackText,
                                        language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                      ],
                                      true,
                                      sentenceFb.source_language || activity.sentences[sentenceIdx]?.language
                                    )}
                                  </View>

                                  {/* User Translation */}
                                  <View style={styles.sentenceFeedbackRow}>
                                    <SafeText style={[
                                      styles.sentenceFeedbackLabel,
                                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                    ]}>
                                      {transliteration.nativeScriptRenderings.yourTranslationSingle || getYourTranslationSingleLabel(language)}:
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.yourTranslationSingle && (
                                      <SafeText style={[styles.translitText, { marginBottom: 4 }]}>
                                        {transliteration.transliterations.yourTranslationSingle}:
                                      </SafeText>
                                    )}
                                    {renderText(
                                      transliteration.nativeScriptRenderings[`submission_${index}_sentence_${sentenceIdx}_user`] || sentenceFb.user_translation,
                                      [
                                        styles.sentenceFeedbackText,
                                        language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                      ],
                                      true,
                                      language
                                    )}
                                  </View>

                                  {/* Expected Translation */}
                                  <View style={styles.sentenceFeedbackRow}>
                                    <SafeText style={[
                                      styles.sentenceFeedbackLabel,
                                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                    ]}>
                                      {transliteration.nativeScriptRenderings.expected || getExpectedLabel(language)}:
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.expected && (
                                      <SafeText style={[styles.translitText, { marginBottom: 4 }]}>
                                        {transliteration.transliterations.expected}:
                                      </SafeText>
                                    )}
                                    {renderText(
                                      transliteration.nativeScriptRenderings[`submission_${index}_sentence_${sentenceIdx}_expected`] || sentenceFb.expected_translation,
                                      [
                                        styles.sentenceFeedbackText,
                                        language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                      ],
                                      true,
                                      language
                                    )}
                                  </View>

                                  {/* Sentence Feedback */}
                                  {sentenceFb.feedback && (
                                    <View style={styles.sentenceFeedbackRow}>
                                      <SafeText style={[
                                        styles.sentenceFeedbackLabel,
                                        language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                      ]}>
                                        {transliteration.nativeScriptRenderings.feedback || getFeedbackLabel(language)}:
                                      </SafeText>
                                      {transliteration.showTransliterations && transliteration.transliterations.feedback && (
                                        <SafeText style={[styles.translitText, { marginBottom: 4 }]}>
                                          {transliteration.transliterations.feedback}:
                                        </SafeText>
                                      )}
                                      {renderText(
                                        transliteration.nativeScriptRenderings[`submission_${index}_sentence_${sentenceIdx}_feedback`] || sentenceFb.feedback,
                                        [
                                          styles.sentenceFeedbackText,
                                          language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                        ],
                                        true,
                                        language
                                      )}
                                      {transliteration.showTransliterations && transliteration.transliterations[`submission_${index}_sentence_${sentenceIdx}_feedback`] && renderText(
                                        transliteration.transliterations[`submission_${index}_sentence_${sentenceIdx}_feedback`],
                                        [styles.translitText, { marginTop: 4 }],
                                        true,
                                        language
                                      )}
                                    </View>
                                  )}
                                </View>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}

                {/* Complete Button */}
                <TouchableOpacity
                  style={[styles.completeButton, { backgroundColor: '#10B981' }]}
                  onPress={handleComplete}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  <View style={styles.completeButtonTextContainer}>
                    <SafeText style={[
                      styles.completeButtonText,
                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}>
                      {transliteration.nativeScriptRenderings.completeActivity || getCompleteActivityLabel(language)}
                    </SafeText>
                    {transliteration.showTransliterations && transliteration.transliterations.completeActivity && (
                      <SafeText style={styles.completeButtonTranslit}>
                        {transliteration.transliterations.completeActivity}
                      </SafeText>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

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
        visible={showAPIDebug}
        onClose={() => setShowAPIDebug(false)}
        apiDetails={activityData.apiDetails}
      />

      {/* Topic Selection Modal */}
      <TopicSelectionModal
        visible={showTopicModal}
        onClose={handleCloseTopicModal}
        onSelectTopic={handleTopicSelection}
        language={language}
        activityType="translation"
        color={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'flex-start',
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerTransliteration: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  debugButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  activityTitleCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  activityTitleText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  activityTitleTranslit: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  instructionsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  translitText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  progressCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  progressCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sentenceCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sentenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sentenceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  languageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  languageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  languageBadgeTranslit: {
    fontSize: 10,
    opacity: 0.8,
    fontStyle: 'italic',
    marginTop: 2,
  },
  sourceSentenceContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  sourceSentenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  sourceSentenceText: {
    fontSize: 18,
    color: '#1A1A1A',
    lineHeight: 28,
  },
  sourceSentenceTranslit: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  translationInputContainer: {
    marginBottom: 16,
  },
  translationInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  translationInput: {
    minHeight: 100,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    color: '#1A1A1A',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
    gap: 6,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonTextContainer: {
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navButtonTranslit: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  overviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  overviewHeaderButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  overviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
  },
  overviewItemActive: {
    backgroundColor: '#E8F4FD',
    borderWidth: 2,
    borderColor: '#4A90E2',
  },
  overviewItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overviewItemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overviewItemNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  overviewItemLanguage: {
    fontSize: 14,
    color: '#333',
  },
  overviewItemLanguageTranslit: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonTextContainer: {
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  submitButtonTranslit: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.9,
    fontStyle: 'italic',
    marginTop: 2,
  },
  resultsSection: {
    marginBottom: 32,
  },
  resultsSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  resultCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scoreContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    marginTop: 12,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: '700',
  },
  detailedScores: {
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  feedbackContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  sentenceFeedbackContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  sentenceFeedbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  sentenceFeedbackItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  sentenceFeedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sentenceScoreIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sentenceScoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sentenceFeedbackNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  sentenceFeedbackRow: {
    marginBottom: 8,
  },
  sentenceFeedbackLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  sentenceFeedbackText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  sentenceFeedbackSource: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  sentenceFeedbackUser: {
    fontSize: 14,
    color: '#2563EB',
    marginBottom: 4,
  },
  sentenceFeedbackExpected: {
    fontSize: 14,
    color: '#10B981',
    marginBottom: 8,
  },
  sentenceFeedbackText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  completeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonTextContainer: {
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  completeButtonTranslit: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.9,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
