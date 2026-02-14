import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../components/SafeText';
import { LanguageContext } from '../../contexts/LanguageContext';
import { useActivityData } from './shared/hooks/useActivityData';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import { useConversation } from './shared/hooks/useConversation';
import { useAudio } from './shared/hooks/useAudio';
import { useRecording } from './shared/hooks/useRecording';
import { useGeminiLive } from './shared/hooks/useGeminiLive';
import { ACTIVITY_COLORS } from './shared/constants';
import { normalizeText } from './shared/utils/textProcessing';
import { VocabularyDictionary, TopicSelectionModal } from './shared/components';
import {
  getConversationHeaderLabel,
  getSpeakerProfileLabel,
  getSpeakerNameLabel,
  getSpeakerGenderLabel,
  getSpeakerAgeLabel,
  getSpeakerCityLabel,
  getSpeakerStateLabel,
  getSpeakerCountryLabel,
  getSpeakerDialectLabel,
  getSpeakerBackgroundLabel,
  getTopicLabel,
  getTasksTitleLabel,
  getStartConversationLabel,
  getResetConversationLabel,
  getThinkingLabel,
  getGeneratingAudioLabel,
  getLiveModeTitleLabel,
  getLiveModeDescriptionLabel,
  getClassicModeDescriptionLabel,
} from '../../constants/ui_labels';

/**
 * ConversationActivity Component
 * Handles interactive conversations with AI
 */
export default function ConversationActivity({ route, navigation }) {
  const { activityId, fromHistory, activityData: providedActivityData } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  const routeLang = (route && route.params && route.params.language) || null;
  const language = ctxLanguage || routeLang || 'kannada';

  // Use shared hooks
  const activityData = useActivityData('conversation', language, activityId, fromHistory, providedActivityData);
  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);
  const conversation = useConversation(language);
  const audio = useAudio();
  const recording = useRecording(language);
  const geminiLive = useGeminiLive();

  // Conversation-specific state
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [useTextInput, setUseTextInput] = useState(true); // Toggle between text and audio input
  const [useLiveMode, setUseLiveMode] = useState(true); // Real-time audio is now the default
  const [speakerProfileExpanded, setSpeakerProfileExpanded] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(!fromHistory);
  const scrollViewRef = useRef(null);

  const colors = ACTIVITY_COLORS.conversation;

  const handleTopicSelection = (selectedTopic) => {
    setShowTopicModal(false);
    activityData.loadActivity(selectedTopic);
  };

  // Load activity data when coming from history
  useEffect(() => {
    if (fromHistory && providedActivityData) {
      activityData.loadActivity();
    }
  }, []);

  // Load historical conversation if fromHistory
  useEffect(() => {
    if (fromHistory && activity && activity.messages) {
      conversation.loadConversation(
        activity.messages,
        activity.id || activityId,
        activity.voice
      );
    }
  }, [fromHistory, activity]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current && conversation.conversationMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversation.conversationMessages]);

  // Request transliterations for UI labels and speaker profile
  useEffect(() => {
    if (activityData.activity && transliteration.showTransliterations) {
      const transliterateText = async () => {
        const { transliterateText: doTranslit } = require('./shared/utils/textProcessing');
        
        // UI labels
        transliteration.ensureAndShowTransliterationForKey('header', getConversationHeaderLabel(language));
        transliteration.ensureAndShowTransliterationForKey('speaker_profile', getSpeakerProfileLabel(language));
        transliteration.ensureAndShowTransliterationForKey('topic_label', getTopicLabel(language));
        transliteration.ensureAndShowTransliterationForKey('tasks_title', getTasksTitleLabel(language));
        transliteration.ensureAndShowTransliterationForKey('start_conversation', getStartConversationLabel(language));
        transliteration.ensureAndShowTransliterationForKey('reset_conversation', getResetConversationLabel(language));
        
        // Speaker profile field labels
        transliteration.ensureAndShowTransliterationForKey('speaker_name_label', getSpeakerNameLabel(language));
        transliteration.ensureAndShowTransliterationForKey('speaker_gender_label', getSpeakerGenderLabel(language));
        transliteration.ensureAndShowTransliterationForKey('speaker_age_label', getSpeakerAgeLabel(language));
        transliteration.ensureAndShowTransliterationForKey('speaker_city_label', getSpeakerCityLabel(language));
        transliteration.ensureAndShowTransliterationForKey('speaker_state_label', getSpeakerStateLabel(language));
        transliteration.ensureAndShowTransliterationForKey('speaker_country_label', getSpeakerCountryLabel(language));
        
        // Speaker profile field values
        if (activityData.activity._speaker_profile) {
          const profile = activityData.activity._speaker_profile;
          if (profile.name) transliteration.ensureAndShowTransliterationForKey('speaker_name', profile.name);
          if (profile.gender) transliteration.ensureAndShowTransliterationForKey('speaker_gender', profile.gender);
          if (profile.city) transliteration.ensureAndShowTransliterationForKey('speaker_city', profile.city);
          if (profile.state) transliteration.ensureAndShowTransliterationForKey('speaker_state', profile.state);
          if (profile.country) transliteration.ensureAndShowTransliterationForKey('speaker_country', profile.country);
        }
        
        // Activity content
        if (activityData.activity.activity_name) {
          transliteration.ensureAndShowTransliterationForKey('activity_name', activityData.activity.activity_name);
        }
        if (activityData.activity.introduction) {
          transliteration.ensureAndShowTransliterationForKey('introduction', activityData.activity.introduction);
        }
        
        // Tasks
        if (activityData.activity.tasks) {
          activityData.activity.tasks.forEach((task, index) => {
            transliteration.ensureAndShowTransliterationForKey(`task_${index}`, task);
          });
        }
        
        // AI responses
        conversation.conversationMessages.forEach((msg, index) => {
          if (msg.ai_response) {
            transliteration.ensureAndShowTransliterationForKey(`ai_response_${index}`, msg.ai_response);
          }
        });
      };
      
      transliterateText();
    }
  }, [activityData.activity, transliteration.showTransliterations, conversation.conversationMessages]);

  // Load audio for AI messages
  useEffect(() => {
    conversation.conversationMessages.forEach((msg, index) => {
      if (msg.audio_data && !msg._loading) {
        audio.loadAudio(index, msg.audio_data);
      }
    });
  }, [conversation.conversationMessages]);

  // Cleanup Live Mode on unmount or mode change
  useEffect(() => {
    return () => {
      if (useLiveMode && geminiLive.isConnected) {
        geminiLive.disconnect();
      }
    };
  }, [useLiveMode, geminiLive.isConnected]);

  // Show error alerts for Live Mode
  useEffect(() => {
    if (useLiveMode && geminiLive.error) {
      Alert.alert('Live Mode Error', geminiLive.error, [{ text: 'OK' }]);
    }
  }, [useLiveMode, geminiLive.error]);

  // Render text with clickable words for dictionary lookup
  const renderText = (text, style = {}) => {
    if (!text) return null;
    const safeText = normalizeText(text);
    const words = safeText.split(/(\s+|[.,!?;:—\-()[\]{}\"\']+)/);
    
    // Determine if Urdu font should be applied
    const urduFontStyle = (language === 'urdu' && !transliteration.showTransliterations) 
      ? { fontFamily: 'NotoNastaliqUrdu' } 
      : {};
    
    const combinedStyle = Array.isArray(style) ? StyleSheet.flatten(style) : style;
    
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
              style={[{ color: combinedStyle.color || '#000' }, urduFontStyle]}
              onPress={() => dictionary.handleWordClick(word.trim(), language)}
            >
              {word}
            </Text>
          );
        })}
      </Text>
    );
  };

  const handleSendMessage = async () => {
    if (userInput.trim()) {
      const message = userInput;
      setUserInput('');
      
      if (useLiveMode) {
        // Send via WebSocket
        geminiLive.sendText(message);
      } else {
        // Send via REST API
        await conversation.sendMessage(message);
      }
    }
  };

  const handleToggleRecording = async () => {
    try {
      if (useLiveMode) {
        // Live Mode: Stream audio in real-time
        if (geminiLive.isRecording) {
          await geminiLive.stopRecording();
        } else {
          await geminiLive.startRecording();
        }
      } else {
        // Classic Mode: Record then transcribe
        if (recording.recordingStatus === 'recording') {
          // Stop recording
          const audioUri = await recording.stopRecording();
          if (audioUri) {
            // Transcribe the audio to text
            const transcript = await recording.convertAudioToText(audioUri);
            
            if (transcript && transcript.trim()) {
              // Send the transcribed text as a message
              await conversation.sendMessage(transcript);
            } else {
              alert('Could not transcribe audio. Please try again or use text input.');
            }
          }
        } else {
          // Start recording
          await recording.startRecording();
        }
      }
    } catch (error) {
      console.error('Error with recording:', error);
      if (error.message && error.message.includes('Only one Recording object')) {
        alert('Please wait for the previous recording to finish processing.');
      } else {
        alert('Failed to record audio. Please check microphone permissions.');
      }
    }
  };

  const handleStartConversation = async () => {
    // Start the conversation
    conversation.startConversation();
    
    // If Live Mode is enabled, connect to WebSocket
    if (useLiveMode) {
      try {
        await geminiLive.connect({
          conversation_id: activityData.activity.id,
          language: language,
          voice_name: conversation.selectedVoice || 'Kore',
          speaker_profile: activityData.activity._speaker_profile,
          tasks: activityData.activity.tasks,
          topic: activityData.activity.activity_name,
        });
      } catch (error) {
        console.error('Failed to connect to Live Mode:', error);
        Alert.alert(
          'Connection Error',
          'Failed to connect to Live Mode. Using classic mode instead.',
          [{ text: 'OK' }]
        );
        setUseLiveMode(false);
      }
    }
  };

  const handleToggleLiveMode = (value) => {
    if (conversation.conversationMessages.length > 0) {
      Alert.alert(
        'Cannot Change Mode',
        'You cannot switch modes during an active conversation. Please restart the conversation to change modes.',
        [{ text: 'OK' }]
      );
      return;
    }
    setUseLiveMode(value);
  };

  const conversationTasks = activityData.activity?.tasks || [];

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
          activityType="conversation"
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

  const { activity } = activityData;

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <SafeText style={styles.headerTitle}>{getConversationHeaderLabel(language)}</SafeText>
            {useLiveMode && (
              <View style={[styles.statusBadge, { 
                backgroundColor: geminiLive.isConnected ? '#4CAF50' : '#F44336',
                marginLeft: 8,
              }]}>
                <Text style={styles.statusBadgeText}>
                  {geminiLive.isConnected ? 'LIVE' : 'OFFLINE'}
                </Text>
              </View>
            )}
          </View>
          {transliteration.showTransliterations && transliteration.transliterations.header && (
            <SafeText style={styles.headerSubtitle}>{transliteration.transliterations.header}</SafeText>
          )}
        </View>
        <View style={styles.headerRight}>
          {conversation.conversationStarted && (
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => {
                Alert.alert(
                  'Restart Conversation',
                  'Are you sure you want to restart? All messages will be lost.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Restart', 
                      style: 'destructive',
                      onPress: () => conversation.resetConversation()
                    }
                  ]
                );
              }}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
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

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {activity && (
          <View>
            {/* Live Mode Toggle */}
            {!conversation.conversationStarted && (
              <View style={styles.liveModeContainer}>
                <View style={styles.liveModeToggle}>
                  <SafeText style={styles.liveModeLabel}>🎙️ {getLiveModeTitleLabel(language)}</SafeText>
                  <Switch
                    value={useLiveMode}
                    onValueChange={handleToggleLiveMode}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={useLiveMode ? '#FFFFFF' : '#f4f3f4'}
                  />
                </View>
                <SafeText style={styles.liveModeDescription}>
                  {useLiveMode 
                    ? getLiveModeDescriptionLabel(language)
                    : getClassicModeDescriptionLabel(language)}
                </SafeText>
              </View>
            )}

            {/* AI Status Indicator */}
            {useLiveMode && conversation.conversationStarted && geminiLive.isConnected && (
              <View style={styles.aiStatusContainer}>
                <View style={styles.aiStatusIndicator}>
                  {geminiLive.aiStatus === 'listening' && (
                    <>
                      <Ionicons name="mic" size={16} color="#4CAF50" />
                      <Text style={[styles.aiStatusText, { color: '#4CAF50' }]}>Listening...</Text>
                    </>
                  )}
                  {geminiLive.aiStatus === 'thinking' && (
                    <>
                      <ActivityIndicator size="small" color="#FF9800" />
                      <Text style={[styles.aiStatusText, { color: '#FF9800' }]}>Thinking...</Text>
                    </>
                  )}
                  {geminiLive.aiStatus === 'speaking' && (
                    <>
                      <Ionicons name="volume-high" size={16} color="#2196F3" />
                      <Text style={[styles.aiStatusText, { color: '#2196F3' }]}>Speaking...</Text>
                    </>
                  )}
                  {geminiLive.isStreaming && (
                    <View style={styles.streamingDot} />
                  )}
                </View>
              </View>
            )}

            {/* Activity Title (Left-aligned) */}
            {activity.activity_name && (
              <View style={styles.titleContainer}>
                <View style={styles.titleWrapper}>
                  {renderText(activity.activity_name, styles.title)}
                </View>
                {transliteration.showTransliterations && transliteration.transliterations.activity_name && (
                  <View style={styles.titleTransliterationWrapper}>
                    <SafeText style={styles.titleTransliteration}>
                      {transliteration.transliterations.activity_name}
                    </SafeText>
                  </View>
                )}
              </View>
            )}

            {/* AI-Generated Conversation Title (Centered) */}
            {activity.introduction && (
              <View style={styles.conversationTitleContainer}>
                {renderText(activity.introduction, styles.conversationTitle)}
                {transliteration.showTransliterations && transliteration.transliterations.introduction && (
                  <SafeText style={styles.conversationTitleTransliteration}>
                    {transliteration.transliterations.introduction}
                  </SafeText>
                )}
              </View>
            )}

            {/* Scenario Card - Grey background */}
            {activity.content && (
              <View style={styles.scenarioCard}>
                {renderText(activity.content, styles.scenarioText)}
                {transliteration.showTransliterations && transliteration.transliterations.content && (
                  <SafeText style={styles.scenarioTransliteration}>
                    {transliteration.transliterations.content}
                  </SafeText>
                )}
              </View>
            )}

            {/* Speaker Profile - Collapsible */}
            {activity._speaker_profile && (
              <View style={[styles.speakerProfileBox, { backgroundColor: '#F5F5F5' }]}>
                <TouchableOpacity
                  style={styles.speakerProfileHeader}
                  onPress={() => setSpeakerProfileExpanded(!speakerProfileExpanded)}
                >
                  <View style={{ flex: 1 }}>
                    <SafeText style={[styles.sectionTitle, { marginBottom: 0, fontWeight: 'bold' }]}>
                      {getSpeakerProfileLabel(language)}
                    </SafeText>
                    {transliteration.showTransliterations && transliteration.transliterations.speaker_profile && (
                      <SafeText style={[styles.transliterationText, { marginTop: 4 }]}>
                        {transliteration.transliterations.speaker_profile}
                      </SafeText>
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
                    <View style={styles.speakerDetailRow}>
                      <SafeText style={{ fontWeight: 'bold' }}>{getSpeakerNameLabel(language)}: </SafeText>
                      {transliteration.showTransliterations && transliteration.transliterations.speaker_name_label && (
                        <SafeText style={styles.transliterationText}>({transliteration.transliterations.speaker_name_label}): </SafeText>
                      )}
                      {renderText(activity._speaker_profile.name, styles.speakerDetailText)}
                      {transliteration.showTransliterations && transliteration.transliterations.speaker_name && (
                        <SafeText style={[styles.transliterationText, { marginLeft: 8 }]}>
                          ({transliteration.transliterations.speaker_name})
                        </SafeText>
                      )}
                    </View>
                    <View style={styles.speakerDetailRow}>
                      <SafeText style={{ fontWeight: 'bold' }}>{getSpeakerGenderLabel(language)}: </SafeText>
                      {transliteration.showTransliterations && transliteration.transliterations.speaker_gender_label && (
                        <SafeText style={styles.transliterationText}>({transliteration.transliterations.speaker_gender_label}): </SafeText>
                      )}
                      {renderText(activity._speaker_profile.gender, styles.speakerDetailText)}
                      {transliteration.showTransliterations && transliteration.transliterations.speaker_gender && (
                        <SafeText style={[styles.transliterationText, { marginLeft: 8 }]}>
                          ({transliteration.transliterations.speaker_gender})
                        </SafeText>
                      )}
                    </View>
                    <View style={styles.speakerDetailRow}>
                      <SafeText style={{ fontWeight: 'bold' }}>{getSpeakerAgeLabel(language)}: </SafeText>
                      {transliteration.showTransliterations && transliteration.transliterations.speaker_age_label && (
                        <SafeText style={styles.transliterationText}>({transliteration.transliterations.speaker_age_label}): </SafeText>
                      )}
                      <SafeText style={styles.speakerDetailText}>{activity._speaker_profile.age}</SafeText>
                    </View>
                    {activity._speaker_profile.city && (
                      <View style={styles.speakerDetailRow}>
                        <SafeText style={{ fontWeight: 'bold' }}>{getSpeakerCityLabel(language)}: </SafeText>
                        {transliteration.showTransliterations && transliteration.transliterations.speaker_city_label && (
                          <SafeText style={styles.transliterationText}>({transliteration.transliterations.speaker_city_label}): </SafeText>
                        )}
                        {renderText(activity._speaker_profile.city, styles.speakerDetailText)}
                        {transliteration.showTransliterations && transliteration.transliterations.speaker_city && (
                          <SafeText style={[styles.transliterationText, { marginLeft: 8 }]}>
                            ({transliteration.transliterations.speaker_city})
                          </SafeText>
                        )}
                      </View>
                    )}
                    {activity._speaker_profile.state && (
                      <View style={styles.speakerDetailRow}>
                        <SafeText style={{ fontWeight: 'bold' }}>{getSpeakerStateLabel(language)}: </SafeText>
                        {transliteration.showTransliterations && transliteration.transliterations.speaker_state_label && (
                          <SafeText style={styles.transliterationText}>({transliteration.transliterations.speaker_state_label}): </SafeText>
                        )}
                        {renderText(activity._speaker_profile.state, styles.speakerDetailText)}
                        {transliteration.showTransliterations && transliteration.transliterations.speaker_state && (
                          <SafeText style={[styles.transliterationText, { marginLeft: 8 }]}>
                            ({transliteration.transliterations.speaker_state})
                          </SafeText>
                        )}
                      </View>
                    )}
                    {activity._speaker_profile.country && (
                      <View style={styles.speakerDetailRow}>
                        <SafeText style={{ fontWeight: 'bold' }}>{getSpeakerCountryLabel(language)}: </SafeText>
                        {transliteration.showTransliterations && transliteration.transliterations.speaker_country_label && (
                          <SafeText style={styles.transliterationText}>({transliteration.transliterations.speaker_country_label}): </SafeText>
                        )}
                        {renderText(activity._speaker_profile.country, styles.speakerDetailText)}
                        {transliteration.showTransliterations && transliteration.transliterations.speaker_country && (
                          <SafeText style={[styles.transliterationText, { marginLeft: 8 }]}>
                            ({transliteration.transliterations.speaker_country})
                          </SafeText>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Tasks - Collapsible */}
            {conversationTasks.length > 0 && (
              <View style={[styles.tasksBox, { backgroundColor: '#FFF9E6' }]}>
                <TouchableOpacity
                  style={styles.tasksHeader}
                  onPress={() => setTasksExpanded(!tasksExpanded)}
                >
                  <View style={{ flex: 1 }}>
                    <SafeText style={[styles.sectionTitle, { marginBottom: 0, fontWeight: 'bold' }]}>
                      {getTasksTitleLabel(language)}
                    </SafeText>
                    {transliteration.showTransliterations && transliteration.transliterations.tasks_title && (
                      <SafeText style={[styles.transliterationText, { marginTop: 4 }]}>
                        {transliteration.transliterations.tasks_title}
                      </SafeText>
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
                    {conversationTasks.map((task, index) => (
                      <View
                        key={index}
                        style={styles.taskItem}
                      >
                        <View style={styles.taskCheckbox}>
                          {conversation.tasksCompleted.has(index) ? (
                            <Ionicons name="checkmark-circle" size={24} color="#50C878" />
                          ) : (
                            <Ionicons name="ellipse-outline" size={24} color="#666" />
                          )}
                        </View>
                        <View style={styles.taskText}>
                          {renderText(task, styles.taskTextContent)}
                          {transliteration.showTransliterations && transliteration.transliterations[`task_${index}`] && (
                            <SafeText style={[styles.transliterationText, { marginTop: 4, fontSize: 12 }]}>
                              {transliteration.transliterations[`task_${index}`]}
                            </SafeText>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Start Conversation Button */}
            {!conversation.conversationStarted && (
              <TouchableOpacity
                style={[styles.startButton, { backgroundColor: colors.primary }]}
                onPress={handleStartConversation}
              >
                <View style={{ alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="chatbubbles" size={24} color="#FFFFFF" />
                    <SafeText style={styles.startButtonText}>{getStartConversationLabel(language)}</SafeText>
                  </View>
                  {transliteration.showTransliterations && transliteration.transliterations.start_conversation && (
                    <SafeText style={[styles.startButtonSubtext]}>
                      {transliteration.transliterations.start_conversation}
                    </SafeText>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Conversation Messages */}
            {conversation.conversationMessages.length > 0 && (
              <View style={styles.messagesContainer}>
                {conversation.conversationMessages.map((msg, index) => (
                  <View key={index}>
                    {/* User Message */}
                    {msg.user_message && (
                      <View style={styles.userMessageContainer}>
                        <View style={[styles.userMessageBubble, { backgroundColor: colors.light }]}>
                          <Text style={styles.userMessageText}>{msg.user_message}</Text>
                        </View>
                      </View>
                    )}

                    {/* AI Response */}
                    {msg._loading ? (
                      <View style={styles.aiMessageContainer}>
                        <View style={styles.aiMessageBubble}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={[styles.loadingText, { color: colors.primary, marginLeft: 8 }]}>
                            {conversation.loadingStage === 'generating_text' ? getThinkingLabel(language) : getGeneratingAudioLabel(language)}
                          </Text>
                        </View>
                      </View>
                    ) : msg.ai_response ? (
                      <View style={styles.aiMessageContainer}>
                        <View style={styles.aiMessageBubble}>
                          {/* Audio playback if available */}
                          {msg.audio_data && (
                            <TouchableOpacity
                              style={styles.audioButton}
                              onPress={() => audio.toggleAudio(index)}
                            >
                              <Ionicons
                                name={audio.playingParagraph === index ? "pause" : "play"}
                                size={20}
                                color={colors.primary}
                              />
                              <SafeText style={styles.audioButtonText}>
                                {audio.playingParagraph === index ? 'Pause' : 'Play Audio'}
                              </SafeText>
                            </TouchableOpacity>
                          )}
                          {renderText(msg.ai_response, styles.aiMessageText)}
                          {transliteration.showTransliterations && transliteration.transliterations[`ai_response_${index}`] && (
                            <SafeText style={[styles.transliterationText, { marginTop: 8 }]}>
                              {transliteration.transliterations[`ai_response_${index}`]}
                            </SafeText>
                          )}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {/* Reset Button */}
            {conversation.conversationStarted && (
              <TouchableOpacity
                style={[styles.resetButton, { borderColor: colors.primary }]}
                onPress={conversation.resetConversation}
              >
                <View style={{ alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="refresh" size={20} color={colors.primary} />
                    <SafeText style={[styles.resetButtonText, { color: colors.primary }]}>
                      {getResetConversationLabel(language)}
                    </SafeText>
                  </View>
                  {transliteration.showTransliterations && transliteration.transliterations.reset_conversation && (
                    <SafeText style={[styles.transliterationText, { marginTop: 4 }]}>
                      {transliteration.transliterations.reset_conversation}
                    </SafeText>
                  )}
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Message Input (fixed at bottom) */}
      {conversation.conversationStarted && (
        <View style={[styles.inputContainer, { borderTopColor: colors.primary }]}>
          {/* Toggle between text and audio input */}
          <TouchableOpacity
            style={styles.inputToggleButton}
            onPress={() => setUseTextInput(!useTextInput)}
          >
            <Ionicons 
              name={useTextInput ? "mic" : "text"} 
              size={24} 
              color={colors.primary} 
            />
          </TouchableOpacity>

          {useTextInput ? (
            <>
              {/* Text Input */}
              <TextInput
                style={styles.messageInput}
                placeholder={`Type your message in ${language}...`}
                value={userInput}
                onChangeText={setUserInput}
                multiline
                maxLength={500}
                editable={!conversation.messageLoading}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: userInput.trim() ? colors.primary : '#E0E0E0' }
                ]}
                onPress={handleSendMessage}
                disabled={!userInput.trim() || conversation.messageLoading}
              >
                {conversation.messageLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={24} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Audio Recording */}
              <View style={styles.recordingContainer}>
                <TouchableOpacity
                  style={[
                    styles.recordButton,
                    { 
                      backgroundColor: recording.recordingStatus === 'recording' 
                        ? '#FF4444' 
                        : recording.recordingStatus === 'processing'
                        ? '#FFA500'
                        : colors.primary 
                    }
                  ]}
                  onPress={handleToggleRecording}
                  disabled={conversation.messageLoading || recording.recordingStatus === 'processing'}
                >
                  {(recording.recordingStatus === 'processing' || (useLiveMode && geminiLive.isStreaming)) ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons 
                      name={(recording.recordingStatus === 'recording' || geminiLive.isRecording) ? "stop" : "mic"} 
                      size={32} 
                      color="#FFFFFF" 
                    />
                  )}
                </TouchableOpacity>
                {useLiveMode ? (
                  // Live Mode status
                  <>
                    {geminiLive.isRecording && (
                      <SafeText style={styles.recordingText}>
                        {geminiLive.isStreaming ? '🔴 Streaming... (Tap to stop)' : 'Recording... (Tap to stop)'}
                      </SafeText>
                    )}
                    {!geminiLive.isRecording && (
                      <SafeText style={styles.recordingHintText}>Tap to start streaming</SafeText>
                    )}
                  </>
                ) : (
                  // Classic Mode status
                  <>
                    {recording.recordingStatus === 'recording' && (
                      <SafeText style={styles.recordingText}>Recording... (Tap to stop)</SafeText>
                    )}
                    {recording.recordingStatus === 'processing' && (
                      <SafeText style={styles.recordingText}>Processing audio...</SafeText>
                    )}
                    {recording.recordingStatus === 'idle' && (
                      <SafeText style={styles.recordingHintText}>Tap to record</SafeText>
                    )}
                  </>
                )}
              </View>
            </>
          )}
        </View>
      )}

      {/* Dictionary Modal */}
      <VocabularyDictionary
        visible={dictionary.showDictionary}
        onClose={() => dictionary.setShowDictionary(false)}
        language={language}
        initialSearchQuery={dictionary.initialSearchQuery}
      />
    </KeyboardAvoidingView>
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
  headerSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    fontStyle: 'italic',
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
    paddingBottom: 100,
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
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  conversationTitleContainer: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  conversationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  conversationTitleTransliteration: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  speakerProfileBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  speakerProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scenarioCard: {
    backgroundColor: '#E8E8E8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  scenarioText: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  scenarioTransliteration: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#1A1A1A',
  },
  speakerDetailText: {
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 8,
    lineHeight: 20,
  },
  speakerDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    alignItems: 'center',
  },
  topicBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  topicText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  tasksBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  taskCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  taskText: {
    flex: 1,
  },
  taskTextContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1A1A1A',
  },
  transliterationText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  startButtonSubtext: {
    color: '#FFFFFF',
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.9,
  },
  messagesContainer: {
    marginBottom: 20,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  userMessageBubble: {
    maxWidth: '75%',
    padding: 14,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    backgroundColor: '#E3F2FD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userMessageText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  aiMessageBubble: {
    maxWidth: '75%',
    padding: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: '#F5F5F5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  aiMessageText: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  audioButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 20,
    gap: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  inputToggleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  messageInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingText: {
    fontSize: 16,
    color: '#FF4444',
    fontWeight: '600',
  },
  recordingHintText: {
    fontSize: 14,
    color: '#999',
  },
  // Live Mode styles
  liveModeContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  liveModeToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveModeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  liveModeDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  aiStatusContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  aiStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiStatusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
    marginLeft: 'auto',
  },
});
