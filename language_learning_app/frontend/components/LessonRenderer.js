import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import SafeText from './SafeText';
import VocabularyDictionary from '../screens/activities/shared/components/VocabularyDictionary';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

/**
 * LessonRenderer Component
 * 
 * A dynamic, modular renderer for structured language learning lessons.
 * Supports multiple step types including content, multiple choice, and free response.
 * 
 * @param {Object} lessonData - The complete lesson JSON structure
 * @param {string} language - Current learning language (e.g., 'kannada', 'spanish')
 * @param {Function} onComplete - Callback when lesson is completed
 * @param {string} userCefrLevel - User's CEFR level (e.g., 'A1', 'B1')
 * @param {string} languageColor - Color theme for the current language
 */
export default function LessonRenderer({ lessonData, language, onComplete, userCefrLevel = 'A1', languageColor = '#F97316', reviewMode = false }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepAnswers, setStepAnswers] = useState({});
  const [stepFeedback, setStepFeedback] = useState({});
  const [isGrading, setIsGrading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]); // Track which steps have been completed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Start collapsed by default
  
  // Dictionary states - using VocabularyDictionary
  const [showDictionary, setShowDictionary] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');

  // Load progress from backend when component mounts
  useEffect(() => {
    loadProgress();
    // If in review mode, pre-fill correct answers and mark all steps as completed
    if (reviewMode) {
      const correctAnswers = {};
      const correctFeedback = {};
      const allStepsCompleted = [];
      
      lessonData.steps.forEach((step, index) => {
        // Mark all steps as completed
        allStepsCompleted.push(index);
        
        if (step.type === 'multiple_choice') {
          // Handle both correct_index and correct_answer formats
          let correctIndex = step.correct_index;
          
          if (correctIndex === undefined && step.correct_answer && step.options) {
            correctIndex = step.options.findIndex(
              opt => opt.trim() === step.correct_answer.trim()
            );
          }
          
          if (correctIndex !== undefined && correctIndex !== -1) {
            correctAnswers[step.id] = correctIndex;
            correctFeedback[step.id] = {
              isCorrect: true,
              message: step.feedback || 'Correct!'
            };
          }
        } else if (step.type === 'free_response') {
          // Priority: accepted_responses > answer_key
          if (step.accepted_responses) {
            const responses = Array.isArray(step.accepted_responses) 
              ? step.accepted_responses 
              : [step.accepted_responses];
            correctAnswers[step.id] = responses[0]; // Show first accepted response
            correctFeedback[step.id] = {
              isCorrect: true,
              message: 'Correct answer',
              acceptedResponses: responses,
            };
          } else if (step.answer_key) {
            correctAnswers[step.id] = step.answer_key;
            correctFeedback[step.id] = {
              isCorrect: true,
              message: 'Correct answer'
            };
          }
        }
      });
      
      setStepAnswers(correctAnswers);
      setStepFeedback(correctFeedback);
      setCompletedSteps(allStepsCompleted);
    }
  }, [lessonData.lesson_id, reviewMode]);

  // Save progress whenever step changes or completedSteps change
  useEffect(() => {
    if (lessonData.lesson_id) {
      saveProgress();
    }
  }, [currentStepIndex, completedSteps]);

  const loadProgress = async () => {
    // In review mode, always start from the beginning
    if (reviewMode) {
      setCurrentStepIndex(0);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/lessons/progress/${lessonData.lesson_id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.current_step !== undefined) {
          setCurrentStepIndex(data.current_step);
        }
        if (data.completed_steps && Array.isArray(data.completed_steps)) {
          setCompletedSteps(data.completed_steps);
        }
      }
    } catch (error) {
      console.error('Error loading lesson progress:', error);
    }
  };

  const saveProgress = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/lessons/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: lessonData.lesson_id,
          current_step: currentStepIndex,
          completed_steps: completedSteps,
        }),
      });
    } catch (error) {
      console.error('Error saving lesson progress:', error);
    }
  };

  if (!lessonData || !lessonData.steps || lessonData.steps.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <SafeText style={styles.errorText}>No lesson data available</SafeText>
      </View>
    );
  }

  const currentStep = lessonData.steps[currentStepIndex];
  const isLastStep = currentStepIndex === lessonData.steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  // Render markdown content (audio functionality removed)
  const renderMarkdownContent = (markdown) => {
    if (!markdown) return null;
    
    // Convert $text$ format to bold for phonetic notation (e.g., $R$ → R in bold)
    // This handles phonetic symbols like $R$, $T$, $N$, etc.
    const processedMarkdown = markdown.replace(/\$([^$]+)\$/g, '**$1**');
    
    return (
      <Markdown style={markdownStyles}>
        {processedMarkdown}
      </Markdown>
    );
  };

  // Helper function to remove $ symbols from text (for non-markdown content)
  const cleanPhoneticNotation = (text) => {
    if (!text) return text;
    // Remove $ symbols but keep the text inside (e.g., $R$ → R)
    return text.replace(/\$([^$]+)\$/g, '$1');
  };

  // Handle multiple choice answer
  const handleMultipleChoiceAnswer = (optionIndex) => {
    // Don't allow changing answer if feedback already exists (answer already submitted)
    if (stepFeedback[currentStep.id]) {
      return;
    }

    setStepAnswers({
      ...stepAnswers,
      [currentStep.id]: optionIndex,
    });

    // Determine correct index from either correct_index or correct_answer
    let correctIndex = currentStep.correct_index;
    
    // If correct_answer is provided (text), find its index in options
    if (correctIndex === undefined && currentStep.correct_answer) {
      correctIndex = currentStep.options.findIndex(
        option => option.trim() === currentStep.correct_answer.trim()
      );
    }

    // Grade immediately if we have a correct index
    if (correctIndex !== undefined && correctIndex !== -1) {
      const isCorrect = optionIndex === correctIndex;
      const newFeedback = {
        isCorrect,
        message: isCorrect 
          ? (currentStep.feedback || 'Correct!') 
          : `Incorrect. The correct answer is: ${currentStep.options[correctIndex]}`,
      };
      
      // Update feedback state
      setStepFeedback({
        ...stepFeedback,
        [currentStep.id]: newFeedback,
      });
      
      console.log('Multiple choice feedback set:', newFeedback);
    }
  };

  // Handle free response input
  const handleFreeResponseChange = (text) => {
    setStepAnswers({
      ...stepAnswers,
      [currentStep.id]: text,
    });
  };

  // Grade free response (rule-based or AI)
  const gradeFreeResponse = async () => {
    if (!currentStep.id || !stepAnswers[currentStep.id]) {
      return; // Just return, don't block
    }

    // Rule-based grading with multiple accepted responses
    if (currentStep.accepted_responses && !currentStep.ai_grading) {
      const userAnswer = stepAnswers[currentStep.id].trim().toLowerCase();
      const acceptedResponses = Array.isArray(currentStep.accepted_responses) 
        ? currentStep.accepted_responses 
        : [currentStep.accepted_responses];
      
      // Check if user's answer matches any accepted response
      const isCorrect = acceptedResponses.some(
        response => userAnswer === response.trim().toLowerCase()
      );

      setStepFeedback({
        ...stepFeedback,
        [currentStep.id]: {
          isCorrect,
          message: isCorrect 
            ? 'Correct!' 
            : `Accepted responses:\n${acceptedResponses.map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
          acceptedResponses: acceptedResponses,
        },
      });
      return;
    }

    // Legacy: Single answer_key support (backward compatibility)
    if (currentStep.answer_key && !currentStep.ai_grading) {
      const userAnswer = stepAnswers[currentStep.id].trim().toLowerCase();
      const correctAnswer = currentStep.answer_key.trim().toLowerCase();
      const isCorrect = userAnswer === correctAnswer;

      setStepFeedback({
        ...stepFeedback,
        [currentStep.id]: {
          isCorrect,
          message: isCorrect 
            ? 'Correct!' 
            : `The expected answer was: ${currentStep.answer_key}`,
        },
      });
      return;
    }

    // AI grading (only if explicitly enabled)
    if (currentStep.ai_grading) {
      setIsGrading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/lessons/grade-free-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language,
            user_cefr_level: userCefrLevel,
            question: currentStep.question,
            user_answer: stepAnswers[currentStep.id],
            lesson_context: {
              lesson_id: lessonData.lesson_id,
              title: lessonData.title,
              current_step: currentStepIndex,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to grade response');
        }

        const result = await response.json();
        setStepFeedback({
          ...stepFeedback,
          [currentStep.id]: {
            isCorrect: result.score >= 70, // 70% threshold
            message: result.feedback,
            score: result.score,
          },
        });
      } catch (error) {
        console.error('Error grading free response:', error);
        // Don't show alert, just provide neutral feedback
        setStepFeedback({
          ...stepFeedback,
          [currentStep.id]: {
            isCorrect: true,
            message: 'Thank you for your response!',
          },
        });
      } finally {
        setIsGrading(false);
      }
      return;
    }

    // No grading - just acknowledge
    setStepFeedback({
      ...stepFeedback,
      [currentStep.id]: {
        isCorrect: true,
        message: 'Thank you for your response!',
      },
    });
  };

  // Navigate to next step
  const goToNextStep = () => {
    const currentStep = lessonData.steps[currentStepIndex];
    
    // Validation: Require a response for free_response questions (only when NOT in review mode)
    if (!reviewMode && currentStep.type === 'free_response') {
      const userResponse = stepAnswers[currentStep.id];
      if (!userResponse || !userResponse.trim()) {
        // User hasn't provided a response - don't proceed
        return;
      }
    }
    
    // Mark current step as completed
    if (!completedSteps.includes(currentStepIndex)) {
      setCompletedSteps([...completedSteps, currentStepIndex]);
    }
    
    if (isLastStep) {
      // Lesson complete
      if (onComplete) {
        onComplete({
          lessonId: lessonData.lesson_id,
          answers: stepAnswers,
          feedback: stepFeedback,
        });
      }
    } else {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  // Navigate to previous step (only if that step was completed)
  const goToPreviousStep = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Navigate to specific step (only if that step was completed or is the next available step)
  const canNavigateToStep = (stepIndex) => {
    // Can navigate to current step
    if (stepIndex === currentStepIndex) return true;
    // Can navigate to any completed step
    if (completedSteps.includes(stepIndex)) return true;
    // Can navigate to next step if current step is complete
    if (stepIndex === currentStepIndex + 1 && completedSteps.includes(currentStepIndex)) return true;
    return false;
  };

  // Render different step types
  const renderStep = () => {
    switch (currentStep.type) {
      case 'content':
        return (
          <View style={styles.contentStep}>
            {currentStep.image_url && (
              <Image
                source={{ uri: currentStep.image_url }}
                style={styles.contentImage}
                resizeMode="cover"
              />
            )}
            {currentStep.content_markdown && (
              <View style={styles.markdownContainer}>
                {renderMarkdownContent(currentStep.content_markdown)}
              </View>
            )}
          </View>
        );

      case 'multiple_choice':
        return (
          <View style={styles.questionStep}>
            <View style={styles.questionMarkdownContainer}>
              <Markdown style={questionMarkdownStyles}>
                {currentStep.question}
              </Markdown>
            </View>
            <View style={styles.optionsContainer}>
              {currentStep.options.map((option, index) => {
                const isSelected = stepAnswers[currentStep.id] === index;
                const feedback = stepFeedback[currentStep.id];
                
                // Determine correct index from either correct_index or correct_answer
                let correctIndex = currentStep.correct_index;
                if (correctIndex === undefined && currentStep.correct_answer) {
                  correctIndex = currentStep.options.findIndex(
                    opt => opt.trim() === currentStep.correct_answer.trim()
                  );
                }
                
                const isCorrect = feedback && index === correctIndex;
                const isIncorrect = feedback && isSelected && !feedback.isCorrect;
                const hasBeenAnswered = feedback !== undefined;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonSelected,
                      isCorrect && styles.optionButtonCorrect,
                      isIncorrect && styles.optionButtonIncorrect,
                    ]}
                    onPress={() => handleMultipleChoiceAnswer(index)}
                    disabled={reviewMode || hasBeenAnswered}
                  >
                    <View style={styles.optionContent}>
                      <SafeText style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                        (isCorrect || isIncorrect) && { fontWeight: '600' },
                      ]}>
                        {option}
                      </SafeText>
                      {isCorrect && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                      {isIncorrect && <Ionicons name="close-circle" size={20} color="#EF4444" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {stepFeedback[currentStep.id] && (
              <View style={[
                styles.feedbackBox,
                stepFeedback[currentStep.id].isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect,
              ]}>
                <SafeText style={styles.feedbackText}>
                  {cleanPhoneticNotation(stepFeedback[currentStep.id].message)}
                </SafeText>
              </View>
            )}
          </View>
        );

      case 'free_response':
        return (
          <View style={styles.questionStep}>
            <View style={styles.questionMarkdownContainer}>
              <Markdown style={questionMarkdownStyles}>
                {currentStep.question}
              </Markdown>
            </View>
            {currentStep.hint && (
              <View style={styles.hintBox}>
                <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
                <SafeText style={styles.hintText}>{currentStep.hint}</SafeText>
              </View>
            )}
            <TextInput
              style={styles.freeResponseInput}
              multiline
              numberOfLines={4}
              placeholder="Type your answer here..."
              value={stepAnswers[currentStep.id] || ''}
              onChangeText={handleFreeResponseChange}
              editable={!reviewMode && !stepFeedback[currentStep.id]}
            />
            {!reviewMode && !stepFeedback[currentStep.id] && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!stepAnswers[currentStep.id] || isGrading) && styles.submitButtonDisabled,
                ]}
                onPress={gradeFreeResponse}
                disabled={!stepAnswers[currentStep.id] || isGrading}
              >
                {isGrading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <SafeText style={styles.submitButtonText}>Grading...</SafeText>
                  </>
                ) : (
                  <SafeText style={styles.submitButtonText}>Submit Answer</SafeText>
                )}
              </TouchableOpacity>
            )}
            {stepFeedback[currentStep.id] && (
              <View style={[
                styles.feedbackBox,
                stepFeedback[currentStep.id].isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect,
              ]}>
                {stepFeedback[currentStep.id].score !== undefined && (
                  <SafeText style={styles.feedbackScore}>
                    Score: {stepFeedback[currentStep.id].score}%
                  </SafeText>
                )}
                <SafeText style={styles.feedbackText}>
                  {cleanPhoneticNotation(stepFeedback[currentStep.id].message)}
                </SafeText>
              </View>
            )}
          </View>
        );

      default:
        return (
          <View style={styles.errorContainer}>
            <SafeText style={styles.errorText}>Unknown step type: {currentStep.type}</SafeText>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: languageColor }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleContainer}>
            <SafeText style={styles.lessonTitle}>{lessonData.title}</SafeText>
            <SafeText style={styles.lessonMeta}>
              {lessonData.language}{' '}•{' '}{lessonData.level}
            </SafeText>
          </View>
          <View style={styles.toolButtons}>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => setShowDictionary(true)}
            >
              <Ionicons name="book-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentStepIndex + 1) / lessonData.steps.length) * 100}%` }
            ]} 
          />
        </View>
        <SafeText style={styles.progressText}>
          Step {currentStepIndex + 1} of {lessonData.steps.length}
        </SafeText>
      </View>

      {/* Main Content Area with Side Navigation */}
      <View style={styles.contentContainer}>
        {/* Vertical Step Navigator */}
        <View style={[styles.stepNavigator, sidebarCollapsed && styles.stepNavigatorCollapsed]}>
          <TouchableOpacity 
            style={styles.collapseButton}
            onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Ionicons 
              name={sidebarCollapsed ? "chevron-forward" : "chevron-back"} 
              size={16} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          
          {!sidebarCollapsed && (
            <ScrollView 
              style={styles.stepNavigatorScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.stepNavigatorContent}
            >
              {lessonData.steps.map((step, index) => {
                const isCompleted = completedSteps.includes(index);
                const isCurrent = index === currentStepIndex;
                const canNavigate = canNavigateToStep(index);
                const stepName = step.step_title || step.step_name || `Step ${index + 1}`;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.stepItem,
                      isCurrent && styles.stepItemCurrent,
                      !canNavigate && styles.stepItemLocked,
                    ]}
                    onPress={() => canNavigate && setCurrentStepIndex(index)}
                    disabled={!canNavigate}
                  >
                    <View style={[
                      styles.stepDot,
                      isCurrent && styles.stepDotCurrent,
                      isCompleted && styles.stepDotCompleted,
                      !canNavigate && styles.stepDotLocked,
                    ]}>
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={12} color="#FFF" />
                      ) : isCurrent ? (
                        <View style={styles.stepDotCurrentInner} />
                      ) : (
                        <Ionicons name="lock-closed" size={10} color="#CCC" />
                      )}
                    </View>
                    <SafeText 
                      style={[
                        styles.stepName,
                        isCurrent && styles.stepNameCurrent,
                        !canNavigate && styles.stepNameLocked,
                      ]}
                      numberOfLines={2}
                    >
                      {stepName}
                    </SafeText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Step Content */}
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>
      </View>

      {/* Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, isFirstStep && styles.navButtonDisabled]}
          onPress={goToPreviousStep}
          disabled={isFirstStep}
        >
          <Ionicons name="arrow-back" size={20} color={isFirstStep ? "#CCC" : "#4A90E2"} />
          <SafeText style={[styles.navButtonText, isFirstStep && styles.navButtonTextDisabled]}>
            Previous
          </SafeText>
        </TouchableOpacity>

        {/* Always show Next button, but disable it if step not answered */}
        {(() => {
          const isContentStep = currentStep.type === 'content';
          const isMultipleChoice = currentStep.type === 'multiple_choice';
          const isFreeResponse = currentStep.type === 'free_response';
          
          // Check if step is answered/can proceed
          const canProceed = reviewMode || 
            isContentStep || 
            (isMultipleChoice && stepAnswers[currentStep.id] !== undefined) ||
            (isFreeResponse && stepFeedback[currentStep.id] !== undefined);
          
          return (
            <TouchableOpacity
              style={[
                styles.navButton, 
                styles.navButtonPrimary,
                !canProceed && styles.navButtonDisabled
              ]}
              onPress={goToNextStep}
              disabled={!canProceed}
            >
              <SafeText style={[
                styles.navButtonTextPrimary,
                !canProceed && styles.navButtonTextDisabled
              ]}>
                {isLastStep ? 'Complete' : 'Next'}
              </SafeText>
              <Ionicons 
                name={isLastStep ? "checkmark" : "arrow-forward"} 
                size={20} 
                color={canProceed ? "#FFF" : "#CCC"} 
              />
            </TouchableOpacity>
          );
        })()}
      </View>

      {/* VocabularyDictionary Component - Same as Activities */}
      <VocabularyDictionary
        visible={showDictionary}
        onClose={() => setShowDictionary(false)}
        language={language}
        initialSearchQuery={initialSearchQuery}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    paddingTop: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleContainer: {
    flex: 1,
  },
  toolButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lessonTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  lessonMeta: {
    fontSize: 14,
    color: '#E0F2FF',
  },
  progressContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  stepNavigator: {
    width: 180,
    backgroundColor: '#F9FAFB',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    paddingVertical: 8,
  },
  stepNavigatorCollapsed: {
    width: 32,
  },
  collapseButton: {
    width: '100%',
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  stepNavigatorScroll: {
    flex: 1,
  },
  stepNavigatorContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  stepItemCurrent: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stepItemLocked: {
    opacity: 0.5,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stepDotCurrent: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
    transform: [{ scale: 1.2 }],
  },
  stepDotCurrentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  stepDotCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  stepDotLocked: {
    backgroundColor: '#F3F4F6',
    opacity: 0.5,
  },
  stepName: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  stepNameCurrent: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  stepNameLocked: {
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  contentStep: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  contentImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  markdownContainer: {
    // Markdown styles handled by markdownStyles below
  },
  questionStep: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  questionMarkdownContainer: {
    marginBottom: 16,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
    lineHeight: 26,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  hintText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionButton: {
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: '#4A90E2',
    backgroundColor: '#E0F2FF',
  },
  optionButtonCorrect: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  optionButtonIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  freeResponseInput: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  feedbackBox: {
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  feedbackCorrect: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  feedbackIncorrect: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  feedbackScore: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  feedbackText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
    backgroundColor: '#F0F0F0',
  },
  navButtonPrimary: {
    backgroundColor: '#4A90E2',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  navButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  navButtonTextDisabled: {
    color: '#CCC',
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
});

// Markdown styles for react-native-markdown-display
const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    marginTop: 20,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
    marginTop: 16,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    marginTop: 12,
  },
  paragraph: {
    marginBottom: 12,
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
  table: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 16,
  },
  tr: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  th: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    fontWeight: '700',
  },
  td: {
    padding: 12,
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    marginBottom: 6,
  },
};

// Markdown styles specifically for question headers
const questionMarkdownStyles = {
  body: {
    fontSize: 20,
    lineHeight: 28,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  paragraph: {
    marginBottom: 0,
  },
  strong: {
    fontWeight: '700',
    color: '#1A1A1A',
  },
  em: {
    fontStyle: 'italic',
  },
};
