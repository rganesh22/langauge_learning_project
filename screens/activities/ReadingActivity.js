import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../components/SafeText';
import { LanguageContext } from '../../contexts/LanguageContext';
import { useActivityData } from './shared/hooks/useActivityData';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import { useActivityCompletion } from './shared/hooks/useActivityCompletion';
import { VocabularyDictionary, APIDebugModal, TopicSelectionModal } from './shared/components';
import { ACTIVITY_COLORS } from './shared/constants';
import { normalizeText, normalizeField } from './shared/utils/textProcessing';
import { getQuestionLabel, getSubmitLabel, getShowAnswersLabel, getHideAnswersLabel, getReadingHeaderLabel, getYourScoreLabel, getCorrectAnswersLabel } from '../../constants/ui_labels';

/**
 * ReadingActivity Component
 * Handles reading comprehension activities with story and multiple-choice questions
 */
export default function ReadingActivity({ route, navigation }) {
  const { activityId, fromHistory, activityData: routeActivityData } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  const routeLang = (route && route.params && route.params.language) || null;
  const language = ctxLanguage || routeLang || 'kannada';

  // Use shared hooks
  const activityData = useActivityData('reading', language, activityId, fromHistory, routeActivityData);
  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);
  const { complete } = useActivityCompletion(language, 'reading');

  // Reading-specific state
  const [selectedOptions, setSelectedOptions] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [showAnswers, setShowAnswers] = useState(false);
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(!fromHistory); // Show modal for new activities

  const colors = ACTIVITY_COLORS.reading;

  const handleTopicSelection = (selectedTopic) => {
    setShowTopicModal(false);
    // Load activity with selected topic (null for random)
    activityData.loadActivity(selectedTopic);
  };

  // Don't auto-load activity on mount - wait for topic selection
  // (unless loading from history)
  useEffect(() => {
    if (fromHistory) {
      activityData.loadActivity();
    }
  }, []);

  // Create transliteration and native script for Questions heading
  useEffect(() => {
    if (activityData.activity) {
      const questionsLabel = getQuestionLabel(language);
      const headerLabel = getReadingHeaderLabel(language);
      
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

  // Create native script and transliteration for button labels
  useEffect(() => {
    if (activityData.activity) {
      const buttonLabels = {
        showAnswers: getShowAnswersLabel(language),
        hideAnswers: getHideAnswersLabel(language),
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
          activityType="reading"
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
              : getReadingHeaderLabel(language)}
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
            {/* Story Title */}
            {activity.story_name && (
              <View style={styles.storyTitleContainer}>
                <View style={styles.storyTitleWrapper}>
                  {renderText(
                    (language === 'urdu' && transliteration.nativeScriptRenderings.storyName)
                      ? transliteration.nativeScriptRenderings.storyName
                      : activity.story_name,
                    styles.storyTitle,
                    true
                  )}
                </View>
                {transliteration.showTransliterations && transliteration.transliterations.storyName && (
                  <View style={styles.storyTitleTransliterationWrapper}>
                    {renderText(transliteration.transliterations.storyName, styles.storyTitleTransliteration, true)}
                  </View>
                )}
              </View>
            )}

            {/* Story Text */}
            <View style={styles.textBox}>
              {(() => {
                const storyStr = normalizeText(activity.story);
                let displayStoryStr = storyStr;
                
                // Use native script for Urdu if available
                if (language === 'urdu' && transliteration.nativeScriptRenderings.story) {
                  displayStoryStr = normalizeText(transliteration.nativeScriptRenderings.story);
                }

                // Split into paragraphs
                const paragraphs = displayStoryStr.split(/\n\s*\n/).filter(p => p.trim());
                const elements = [];

                paragraphs.forEach((para, i) => {
                  elements.push(
                    <View key={`para-${i}`} style={{ marginBottom: i < paragraphs.length - 1 ? 16 : 0 }}>
                      {renderText(para.trim(), styles.targetText, true)}
                    </View>
                  );

                  // Add transliteration if available
                  if (transliteration.showTransliterations && transliteration.transliterations.story) {
                    const translitParagraphs = transliteration.transliterations.story.split(/\n\s*\n/).filter(p => p.trim());
                    if (i < translitParagraphs.length && translitParagraphs[i].trim()) {
                      elements.push(
                        <View key={`translit-${i}`} style={{ marginTop: 4, marginBottom: i < paragraphs.length - 1 ? 16 : 0 }}>
                          {renderText(translitParagraphs[i].trim(), styles.transliterationText, true)}
                        </View>
                      );
                    }
                  }
                });

                return elements;
              })()}
            </View>

            {/* Questions */}
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
                          console.log(`[Q${qIndex}] lang=${language} hasNative=${!!hasNativeScript} keys=${Object.keys(transliteration.nativeScriptRenderings).length}`);
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
                              if (qIndex === 0 && oIndex === 0) {
                                console.log(`[Opt${qIndex}_${oIndex}] lang=${language} hasNative=${!!hasNativeScript} value=${hasNativeScript || option}`);
                              }
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
                <SafeText style={[
                  styles.resultTitle, 
                  { color: colors.primary },
                  language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                ]}>
                  {transliteration.nativeScriptRenderings.yourScore || getYourScoreLabel(language)}
                </SafeText>
                {transliteration.showTransliterations && transliteration.transliterations.yourScore && (
                  <SafeText style={[
                    styles.translitText,
                    language === 'urdu' && { textAlign: 'right' }
                  ]}>
                    {transliteration.transliterations.yourScore}
                  </SafeText>
                )}
                <Text style={styles.scoreText}>{(score * 100).toFixed(0)}%</Text>
                <SafeText style={[
                  styles.scoreSubtext,
                  language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right' }
                ]}>
                  {activity.questions.filter((q, idx) => {
                    const selectedValue = selectedOptions[idx];
                    if (selectedValue) {
                      const selectedIndex = parseInt(selectedValue.split('-')[1]);
                      return selectedIndex === q.correct;
                    }
                    return false;
                  }).length} / {activity.questions.length} {transliteration.nativeScriptRenderings.correctAnswers || getCorrectAnswersLabel(language)}
                </SafeText>
                {transliteration.showTransliterations && transliteration.transliterations.correctAnswers && (
                  <SafeText style={[
                    styles.translitText,
                    language === 'urdu' && { textAlign: 'right' }
                  ]}>
                    {activity.questions.filter((q, idx) => {
                      const selectedValue = selectedOptions[idx];
                      if (selectedValue) {
                        const selectedIndex = parseInt(selectedValue.split('-')[1]);
                        return selectedIndex === q.correct;
                      }
                      return false;
                    }).length} / {activity.questions.length} {transliteration.transliterations.correctAnswers}
                  </SafeText>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Dictionary Modal */}
      <VocabularyDictionary
        visible={dictionary.showDictionary}
        onClose={() => dictionary.setShowDictionary(false)}
        initialLanguage={language}
        initialSearchQuery={dictionary.initialSearchQuery}
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
    backgroundColor: '#F0F8FF',
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
