import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../components/SafeText';
import { LanguageContext } from '../../contexts/LanguageContext';
import { useActivityData } from './shared/hooks/useActivityData';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import { useGrading } from './shared/hooks/useGrading';
import { useActivityCompletion } from './shared/hooks/useActivityCompletion';
import { VocabularyDictionary, APIDebugModal, TopicSelectionModal } from './shared/components';
import { ACTIVITY_COLORS } from './shared/constants';
import { normalizeText } from './shared/utils/textProcessing';
import {
  getQuestionLabel,
  getSubmitLabel,
  getSubmittingLabel,
  getWritingHeaderLabel,
  getWritingExerciseLabel,
  getRequiredWordsLabel,
  getRubricTitleLabel,
  getWriteAnswerPlaceholderLabel,
  getSubmitForGradingLabel,
  getGradingProgressLabel,
  getSubmissionsFeedbackLabel,
  getSubmissionNumberLabel,
  getYourWritingLabel,
  getOverallScoreLabel,
  getVocabularyScoreLabel,
  getGrammarScoreLabel,
  getCoherenceScoreLabel,
  getDetailedFeedbackLabel,
  getWordUsageFeedbackLabel,
} from '../../constants/ui_labels';

/**
 * WritingActivity Component
 * Handles writing exercises with AI grading and feedback
 * Language-agnostic design with full transliteration and dictionary support
 */
export default function WritingActivity({ route, navigation }) {
  const { activityId, fromHistory, activityData: routeActivityData } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  const routeLang = (route && route.params && route.params.language) || null;
  // Prefer the language explicitly passed via route (activity's language), then context
  const language = routeLang || ctxLanguage || null;

  // Use shared hooks
  const activityData = useActivityData('writing', language, activityId, fromHistory, routeActivityData);
  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);
  const grading = useGrading('writing', language);
  const { complete } = useActivityCompletion(language, 'writing');

  // Writing-specific state
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [rubricExpanded, setRubricExpanded] = useState(false);
  const [showAPIDebug, setShowAPIDebug] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(!fromHistory);

  const colors = ACTIVITY_COLORS.writing;

  const handleTopicSelection = (selectedTopic) => {
    setShowTopicModal(false);
    activityData.loadActivity(selectedTopic);
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

  // Create native script and transliteration for UI labels
  useEffect(() => {
    if (activityData.activity) {
      const uiLabels = {
        activity_name: activityData.activity.activity_name,
        writingExercise: getWritingExerciseLabel(language),
        requiredWords: getRequiredWordsLabel(language),
        rubricTitle: getRubricTitleLabel(language),
        submitLabel: getSubmitForGradingLabel(language),
        submittingLabel: getGradingProgressLabel(language),
        submissionsFeedback: getSubmissionsFeedbackLabel(language),
        submissionNumber: getSubmissionNumberLabel(language),
        yourWriting: getYourWritingLabel(language),
        overallScore: getOverallScoreLabel(language),
        vocabularyScore: getVocabularyScoreLabel(language),
        grammarScore: getGrammarScoreLabel(language),
        coherenceScore: getCoherenceScoreLabel(language),
        detailedFeedback: getDetailedFeedbackLabel(language),
        wordUsageFeedback: getWordUsageFeedbackLabel(language),
        headerLabel: getWritingHeaderLabel(language),
        placeholder: getWriteAnswerPlaceholderLabel(language),
      };

      Object.entries(uiLabels).forEach(([key, label]) => {
        // For Urdu, get native script rendering (Devanagari -> Nastaliq)
        if (language === 'urdu' && label && !transliteration.nativeScriptRenderings[key]) {
          transliteration.ensureNativeScriptForKey(key, label);
        }
        
        // Create transliteration when enabled (to Roman script)
        if (transliteration.showTransliterations && label && !transliteration.transliterations[key]) {
          transliteration.ensureAndShowTransliterationForKey(key, label);
        }
      });
      
      // Add transliteration for writing prompt paragraphs
      const promptText = normalizeText(activityData.activity?.writing_prompt || activityData.activity?.prompt) || '';
      const promptParagraphs = promptText.split('\n\n').filter(p => p.trim());
      promptParagraphs.forEach((para, index) => {
        const key = `prompt_para_${index}`;
        
        // For Urdu, get native script rendering (Devanagari -> Nastaliq)
        if (language === 'urdu' && para && !transliteration.nativeScriptRenderings[key]) {
          transliteration.ensureNativeScriptForKey(key, para.trim());
        }
        
        if (transliteration.showTransliterations && para && !transliteration.transliterations[key]) {
          transliteration.ensureAndShowTransliterationForKey(key, para.trim());
        }
      });
      
      // Add transliteration for required words
      if (activityData.activity.required_words) {
        activityData.activity.required_words.forEach((word, index) => {
          const key = `required_word_${index}`;
          
          // For Urdu, get native script rendering (Devanagari -> Nastaliq)
          if (language === 'urdu' && word && !transliteration.nativeScriptRenderings[key]) {
            transliteration.ensureNativeScriptForKey(key, word);
          }
          
          if (transliteration.showTransliterations && word && !transliteration.transliterations[key]) {
            transliteration.ensureAndShowTransliterationForKey(key, word);
          }
        });
      }
      
      // Add transliteration for rubric guidelines
      if (activityData.activity._general_guidelines) {
        activityData.activity._general_guidelines.forEach((guideline, index) => {
          const key = `guideline_${index}`;
          
          // For Urdu, get native script rendering (Devanagari -> Nastaliq)
          if (language === 'urdu' && guideline && !transliteration.nativeScriptRenderings[key]) {
            transliteration.ensureNativeScriptForKey(key, guideline);
          }
          
          if (transliteration.showTransliterations && guideline && !transliteration.transliterations[key]) {
            transliteration.ensureAndShowTransliterationForKey(key, guideline);
          }
        });
      }
    }
  }, [activityData.activity, language, transliteration.showTransliterations]);

  // Create transliterations for submission feedback paragraphs
  useEffect(() => {
    if (grading.allSubmissions && grading.allSubmissions.length > 0) {
      grading.allSubmissions.forEach((submission, subIndex) => {
        if (submission.grading_result && submission.grading_result.feedback) {
          const feedbackParagraphs = submission.grading_result.feedback.split('\n\n');
          feedbackParagraphs.forEach((para, pIndex) => {
            const key = `feedback_${subIndex}_para_${pIndex}`;
            
            // For Urdu, get native script rendering (Devanagari -> Nastaliq)
            if (language === 'urdu' && para && !transliteration.nativeScriptRenderings[key]) {
              transliteration.ensureNativeScriptForKey(key, para.trim());
            }
            
            // Create transliteration when enabled
            if (transliteration.showTransliterations && para && !transliteration.transliterations[key]) {
              transliteration.ensureAndShowTransliterationForKey(key, para.trim());
            }
          });
        }
        
        // Create transliteration for user writing
        if (submission.user_writing) {
          const key = `user_writing_${subIndex}`;
          
          // For Urdu, get native script rendering
          if (language === 'urdu' && !transliteration.nativeScriptRenderings[key]) {
            transliteration.ensureNativeScriptForKey(key, submission.user_writing);
          }
          
          // Create transliteration when enabled
          if (transliteration.showTransliterations && !transliteration.transliterations[key]) {
            transliteration.ensureAndShowTransliterationForKey(key, submission.user_writing);
          }
        }
        
        // Create transliterations for required words feedback
        if (submission.grading_result && submission.grading_result.required_words_feedback) {
          Object.entries(submission.grading_result.required_words_feedback).forEach(([word, feedback], fIndex) => {
            const wordKey = `word_feedback_word_${subIndex}_${fIndex}`;
            const feedbackKey = `word_feedback_text_${subIndex}_${fIndex}`;
            
            // For Urdu, get native script rendering
            if (language === 'urdu') {
              if (!transliteration.nativeScriptRenderings[wordKey]) {
                transliteration.ensureNativeScriptForKey(wordKey, word);
              }
              if (!transliteration.nativeScriptRenderings[feedbackKey]) {
                transliteration.ensureNativeScriptForKey(feedbackKey, String(feedback));
              }
            }
            
            // Create transliterations when enabled
            if (transliteration.showTransliterations) {
              if (!transliteration.transliterations[wordKey]) {
                transliteration.ensureAndShowTransliterationForKey(wordKey, word);
              }
              if (!transliteration.transliterations[feedbackKey]) {
                transliteration.ensureAndShowTransliterationForKey(feedbackKey, String(feedback));
              }
            }
          });
        }
      });
    }
  }, [grading.allSubmissions, language, transliteration.showTransliterations]);

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
    await grading.submitWriting(activityData.activity, grading.userAnswer);
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
          activityType="writing"
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
  const promptText = normalizeText(activity?.writing_prompt || activity?.prompt) || '';
  const promptParagraphs = promptText.split('\n\n').filter(p => p.trim());

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <SafeText style={styles.headerTitle}>
            {language === 'urdu' && transliteration.nativeScriptRenderings.headerLabel
              ? transliteration.nativeScriptRenderings.headerLabel
              : getWritingHeaderLabel(language)}
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
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowAPIDebug(true)}
          >
            <Ionicons name="bug" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activity && (
          <View>
            {/* Activity Title */}
            {activity.activity_name && (
              <View style={styles.titleContainer}>
                <View style={styles.titleWrapper}>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings.activity_name
                      ? transliteration.nativeScriptRenderings.activity_name
                      : activity.activity_name,
                    styles.title,
                    true
                  )}
                </View>
                {transliteration.showTransliterations && transliteration.transliterations.activity_name && (
                  <View style={styles.titleTransliterationWrapper}>
                    {renderText(transliteration.transliterations.activity_name, styles.titleTransliteration, true)}
                  </View>
                )}
              </View>
            )}

            {/* Section Title */}
            <View style={styles.sectionTitleContainer}>
              {renderText(
                language === 'urdu' && transliteration.nativeScriptRenderings.writingExercise
                  ? transliteration.nativeScriptRenderings.writingExercise
                  : getWritingExerciseLabel(language),
                [
                  styles.sectionTitle,
                  styles.boldText,
                  language === 'urdu' && { textAlign: 'left' }
                ],
                true
              )}
              {transliteration.showTransliterations && transliteration.transliterations.writingExercise && (
                <View style={{ marginTop: 4 }}>
                  {renderText(transliteration.transliterations.writingExercise, styles.transliterationText, true)}
                </View>
              )}
            </View>

            {/* Writing Prompt */}
            <View style={styles.promptBox}>
              {promptParagraphs.map((para, index) => (
                <View key={`prompt-para-${index}`} style={{ marginBottom: index < promptParagraphs.length - 1 ? 12 : 0 }}>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings[`prompt_para_${index}`]
                      ? transliteration.nativeScriptRenderings[`prompt_para_${index}`]
                      : para.trim(),
                    styles.promptText,
                    true
                  )}
                  {transliteration.showTransliterations && transliteration.transliterations[`prompt_para_${index}`] && (
                    <View style={{ marginTop: 4 }}>
                      {renderText(transliteration.transliterations[`prompt_para_${index}`], styles.transliterationText, true)}
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Required Words */}
            {activity.required_words && activity.required_words.length > 0 && (
              <View style={styles.requiredWordsBox}>
                <View>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings.requiredWords
                      ? transliteration.nativeScriptRenderings.requiredWords
                      : getRequiredWordsLabel(language),
                    [styles.requiredWordsLabel, styles.boldText]
                  )}
                  {transliteration.showTransliterations && transliteration.transliterations.requiredWords && (
                    <View style={{ marginTop: 4, marginBottom: 8 }}>
                      {renderText(transliteration.transliterations.requiredWords, styles.transliterationText, true)}
                    </View>
                  )}
                </View>
                <View style={styles.wordsList}>
                  {activity.required_words.map((word, index) => {
                    const vocabWord = wordsUsed.find(w => w.kannada === word || w.word === word);
                    const wordTranslit = transliteration.transliterations[`required_word_${index}`] || vocabWord?.transliteration;
                    const nativeWord = language === 'urdu' && transliteration.nativeScriptRenderings[`required_word_${index}`]
                      ? transliteration.nativeScriptRenderings[`required_word_${index}`]
                      : (vocabWord?.kannada || word);
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[styles.wordTag, { backgroundColor: colors.light }]}
                        onPress={() => dictionary.handleWordClick(word, language)}
                      >
                        {renderText(nativeWord, [styles.wordTagText, { color: colors.primary }])}
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
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings.rubricTitle
                      ? transliteration.nativeScriptRenderings.rubricTitle
                      : getRubricTitleLabel(language),
                    [styles.rubricHeaderText, { color: colors.primary, fontWeight: 'bold' }]
                  )}
                  {transliteration.showTransliterations && transliteration.transliterations.rubricTitle && (
                    <View style={{ marginTop: 4 }}>
                      {renderText(transliteration.transliterations.rubricTitle, styles.transliterationText)}
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
                      "ಲೇಖನವು ಸಂಬಂಧಿತವಾಗಿರಬೇಕು, ಸ್ಪಷ್ಟವಾಗಿರಬೇಕು, ಮತ್ತು ಪೂರ್ಣವಾಗಿರಬೇಕು."
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
                          const guidelineTranslit = transliteration.transliterations[`guideline_${index}`];
                          const nativeGuideline = language === 'urdu' && transliteration.nativeScriptRenderings[`guideline_${index}`]
                            ? transliteration.nativeScriptRenderings[`guideline_${index}`]
                            : line;
                          return (
                            <View key={index} style={styles.criteriaBulletItem}>
                              <Text style={styles.criteriaBullet}>•</Text>
                              <View style={styles.criteriaBulletText}>
                                {renderText(nativeGuideline, styles.criteriaText, true)}
                                {transliteration.showTransliterations && guidelineTranslit && (
                                  <View style={{ marginTop: 4 }}>
                                    {renderText(guidelineTranslit, styles.transliterationText, true)}
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

            {/* Text Input */}
            <TextInput
              style={[
                styles.writingInput,
                language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
              ]}
              placeholder={
                language === 'urdu' && transliteration.nativeScriptRenderings.placeholder
                  ? transliteration.nativeScriptRenderings.placeholder
                  : getWriteAnswerPlaceholderLabel(language)
              }
              value={grading.userAnswer}
              onChangeText={grading.setUserAnswer}
              multiline
              numberOfLines={10}
              editable={!grading.gradingLoading}
              placeholderTextColor="#999"
            />

            {/* Submit Button */}
            {!grading.gradingResult && (
              <View>
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleSubmit}
                  disabled={grading.gradingLoading}
                >
                  {grading.gradingLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <SafeText style={styles.submitButtonText}>
                        {language === 'urdu' && transliteration.nativeScriptRenderings.submitLabel
                          ? transliteration.nativeScriptRenderings.submitLabel
                          : getSubmitForGradingLabel(language)}
                      </SafeText>
                      {transliteration.showTransliterations && transliteration.transliterations.submitLabel && (
                        <SafeText style={[styles.submitButtonText, { fontSize: 12, marginTop: 4, opacity: 0.9 }]}>
                          {transliteration.transliterations.submitLabel}
                        </SafeText>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Grading Progress */}
            {grading.gradingLoading && (
              <View style={[styles.gradingProgressBox, { backgroundColor: colors.light }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <SafeText style={[styles.gradingProgressText, { color: colors.primary }]}>
                    {language === 'urdu' && transliteration.nativeScriptRenderings.submittingLabel
                      ? transliteration.nativeScriptRenderings.submittingLabel
                      : getGradingProgressLabel(language)}
                  </SafeText>
                  {transliteration.showTransliterations && transliteration.transliterations.submittingLabel && (
                    <SafeText style={[styles.transliterationText, { marginTop: 4 }]}>
                      {transliteration.transliterations.submittingLabel}
                    </SafeText>
                  )}
                </View>
              </View>
            )}

            {/* All Submissions History */}
            {grading.allSubmissions.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={{ marginBottom: 16 }}>
                  {renderText(
                    language === 'urdu' && transliteration.nativeScriptRenderings.submissionsFeedback
                      ? transliteration.nativeScriptRenderings.submissionsFeedback
                      : getSubmissionsFeedbackLabel(language),
                    [styles.sectionTitle, styles.boldText]
                  )}
                  {transliteration.showTransliterations && transliteration.transliterations.submissionsFeedback && (
                    <View style={{ marginTop: 4 }}>
                      {renderText(transliteration.transliterations.submissionsFeedback, styles.transliterationText)}
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
                          <SafeText style={[styles.gradingResultTitle, { color: colors.primary }]}>
                            {language === 'urdu' && transliteration.nativeScriptRenderings.submissionNumber
                              ? transliteration.nativeScriptRenderings.submissionNumber
                              : getSubmissionNumberLabel(language)} {index + 1}
                          </SafeText>
                          {transliteration.showTransliterations && transliteration.transliterations.submissionNumber && (
                            <SafeText style={[styles.transliterationText, { marginTop: 2 }]}>
                              {transliteration.transliterations.submissionNumber} {index + 1}
                            </SafeText>
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
                          {/* User's Writing */}
                          <View style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
                            <View style={{ marginBottom: 8 }}>
                              <SafeText style={[styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: '600' }]}>
                                {language === 'urdu' && transliteration.nativeScriptRenderings.yourWriting
                                  ? transliteration.nativeScriptRenderings.yourWriting
                                  : getYourWritingLabel(language)}
                              </SafeText>
                              {transliteration.showTransliterations && transliteration.transliterations.yourWriting && (
                                renderText(transliteration.transliterations.yourWriting, [styles.transliterationText, { marginTop: 4 }], true)
                              )}
                            </View>
                            {renderText(
                              language === 'urdu' && transliteration.nativeScriptRenderings[`user_writing_${index}`]
                                ? transliteration.nativeScriptRenderings[`user_writing_${index}`]
                                : submission.user_writing,
                              styles.gradingFeedbackText,
                              true
                            )}
                            {transliteration.showTransliterations && transliteration.transliterations[`user_writing_${index}`] && (
                              renderText(transliteration.transliterations[`user_writing_${index}`], [styles.transliterationText, { marginTop: 8 }], true)
                            )}
                          </View>

                          {/* Grading Results */}
                          {submissionResult && (
                            <>
                              <View style={styles.gradingScores}>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    <SafeText style={styles.gradingScoreLabel}>
                                      {language === 'urdu' && transliteration.nativeScriptRenderings.overallScore
                                        ? transliteration.nativeScriptRenderings.overallScore
                                        : getOverallScoreLabel(language)}
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.overallScore && (
                                      renderText(transliteration.transliterations.overallScore, [styles.transliterationText, { fontSize: 10 }], true)
                                    )}
                                  </View>
                                  <Text style={[styles.gradingScoreValue, { color: colors.primary, fontSize: 20, fontWeight: '700' }]}>
                                    {Math.round(submissionResult.score || 0)}%
                                  </Text>
                                </View>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    <SafeText style={styles.gradingScoreLabel}>
                                      {language === 'urdu' && transliteration.nativeScriptRenderings.vocabularyScore
                                        ? transliteration.nativeScriptRenderings.vocabularyScore
                                        : getVocabularyScoreLabel(language)}
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.vocabularyScore && (
                                      renderText(transliteration.transliterations.vocabularyScore, [styles.transliterationText, { fontSize: 10 }], true)
                                    )}
                                  </View>
                                  <Text style={styles.gradingScoreValue}>{submissionResult.vocabulary_score}%</Text>
                                </View>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    <SafeText style={styles.gradingScoreLabel}>
                                      {language === 'urdu' && transliteration.nativeScriptRenderings.grammarScore
                                        ? transliteration.nativeScriptRenderings.grammarScore
                                        : getGrammarScoreLabel(language)}
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.grammarScore && (
                                      renderText(transliteration.transliterations.grammarScore, [styles.transliterationText, { fontSize: 10 }], true)
                                    )}
                                  </View>
                                  <Text style={styles.gradingScoreValue}>{submissionResult.grammar_score}%</Text>
                                </View>
                                <View style={styles.gradingScoreItem}>
                                  <View>
                                    <SafeText style={styles.gradingScoreLabel}>
                                      {language === 'urdu' && transliteration.nativeScriptRenderings.coherenceScore
                                        ? transliteration.nativeScriptRenderings.coherenceScore
                                        : getCoherenceScoreLabel(language)}
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.coherenceScore && (
                                      renderText(transliteration.transliterations.coherenceScore, [styles.transliterationText, { fontSize: 10 }], true)
                                    )}
                                  </View>
                                  <Text style={styles.gradingScoreValue}>{submissionResult.coherence_score}%</Text>
                                </View>
                              </View>

                              {/* Feedback */}
                              {submissionResult.feedback && (
                                <View style={styles.gradingFeedback}>
                                  <View style={{ marginBottom: 12 }}>
                                    <SafeText style={[styles.gradingFeedbackLabel, { color: colors.primary, fontWeight: 'bold', fontSize: 17 }]}>
                                      {language === 'urdu' && transliteration.nativeScriptRenderings.detailedFeedback
                                        ? transliteration.nativeScriptRenderings.detailedFeedback
                                        : getDetailedFeedbackLabel(language)}
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.detailedFeedback && (
                                      renderText(transliteration.transliterations.detailedFeedback, [styles.transliterationText, { marginTop: 4 }], true)
                                    )}
                                  </View>
                                  {submissionResult.feedback.split('\n\n').map((para, pIndex) => {
                                    const key = `feedback_${index}_para_${pIndex}`;
                                    return (
                                      <View key={pIndex} style={{ marginBottom: pIndex < submissionResult.feedback.split('\n\n').length - 1 ? 16 : 0 }}>
                                        {renderText(
                                          language === 'urdu' && transliteration.nativeScriptRenderings[key]
                                            ? transliteration.nativeScriptRenderings[key]
                                            : para.trim(),
                                          styles.gradingFeedbackText,
                                          true
                                        )}
                                        {transliteration.showTransliterations && transliteration.transliterations[key] && (
                                          renderText(transliteration.transliterations[key], [styles.transliterationText, { marginTop: 8 }], true)
                                        )}
                                      </View>
                                    );
                                  })}
                                </View>
                              )}

                              {/* Word Feedback */}
                              {submissionResult.required_words_feedback && Object.keys(submissionResult.required_words_feedback).length > 0 && (
                                <View style={styles.gradingWordsFeedback}>
                                  <View style={{ marginBottom: 12 }}>
                                    <SafeText style={[styles.gradingFeedbackLabel, { fontWeight: 'bold', fontSize: 17 }]}>
                                      {language === 'urdu' && transliteration.nativeScriptRenderings.wordUsageFeedback
                                        ? transliteration.nativeScriptRenderings.wordUsageFeedback
                                        : getWordUsageFeedbackLabel(language)}
                                    </SafeText>
                                    {transliteration.showTransliterations && transliteration.transliterations.wordUsageFeedback && (
                                      renderText(transliteration.transliterations.wordUsageFeedback, [styles.transliterationText, { marginTop: 4 }], true)
                                    )}
                                  </View>
                                  {Object.entries(submissionResult.required_words_feedback).map(([word, feedback], fIndex) => {
                                    const wordKey = `word_feedback_word_${index}_${fIndex}`;
                                    const feedbackKey = `word_feedback_text_${index}_${fIndex}`;
                                    return (
                                      <View key={word} style={styles.gradingWordFeedbackItem}>
                                        <View style={{ marginBottom: 4 }}>
                                          {renderText(
                                            language === 'urdu' && transliteration.nativeScriptRenderings[wordKey]
                                              ? transliteration.nativeScriptRenderings[wordKey]
                                              : word,
                                            styles.gradingWordFeedbackWord,
                                            true
                                          )}
                                          {transliteration.showTransliterations && transliteration.transliterations[wordKey] && (
                                            renderText(`(${transliteration.transliterations[wordKey]})`, [styles.transliterationText, { fontSize: 11, marginLeft: 4 }], true)
                                          )}
                                        </View>
                                        {renderText(
                                          language === 'urdu' && transliteration.nativeScriptRenderings[feedbackKey]
                                            ? transliteration.nativeScriptRenderings[feedbackKey]
                                            : String(feedback),
                                          styles.gradingWordFeedbackText,
                                          true
                                        )}
                                        {transliteration.showTransliterations && transliteration.transliterations[feedbackKey] && (
                                          renderText(transliteration.transliterations[feedbackKey], [styles.transliterationText, { marginTop: 4 }], true)
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
        language={language}
        initialSearchQuery={dictionary.initialSearchQuery}
        dictionaryLanguage={dictionary.dictionaryLanguage}
        setDictionaryLanguage={dictionary.setDictionaryLanguage}
        highlightVocab={highlightVocab}
      />

      {/* API Debug Modal */}
      <APIDebugModal
        visible={showAPIDebug}
        onClose={() => setShowAPIDebug(false)}
        allApiDetails={[...(activityData.allApiDetails || []), ...(grading.gradingApiDetails || [])]}
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
    lineHeight: 20,
    marginTop: 2,
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
    marginTop: 4,
    fontStyle: 'italic',
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
  writingInput: {
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
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
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
    marginTop: 8,
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
    lineHeight: 20,
    color: '#666',
  },
});
