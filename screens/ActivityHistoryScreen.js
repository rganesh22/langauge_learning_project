import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../components/SafeText';
import { 
  QUESTIONS_LABELS, 
  getQuestionLabel,
  getReopenActivityLabel,
  getPlayParagraphLabel,
  getPauseLabel,
  getPlayLabel,
  getWritingPromptLabel,
  getRequiredWordsTitleLabel,
  formatPlayParagraphLabel,
  getSubmissionNumberLabel,
  getOverallScoreLabel,
  getSubmissionsFeedbackLabel,
  getTopicLabel,
  getInstructionsLabel,
  getSentencesLabel,
  getSentenceLabel,
  getSourceTextLabel,
  getExpectedTranslationLabel,
} from '../constants/ui_labels';
import { Audio } from 'expo-av';

const API_BASE_URL = __DEV__ ? 'http://localhost:5001' : 'http://localhost:5001';

const ACTIVITY_COLORS = {
  reading: { primary: '#4A90E2', light: '#E8F4FD' },
  listening: { primary: '#2B654A', light: '#E8F5EF' },
  writing: { primary: '#FF6B6B', light: '#FFE8E8' },
  speaking: { primary: '#FF9500', light: '#FFF4E6' },
  translation: { primary: '#8B5CF6', light: '#F3E8FF' },
  conversation: { primary: '#9B59B6', light: '#F4E6FF' },
};

export default function ActivityHistoryScreen({ route, navigation }) {
  const { language, activityType } = route.params;
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [nativeRenderings, setNativeRenderings] = useState({});
  // Audio playback state
  const [playingParagraph, setPlayingParagraph] = useState(null);
  const [audioStatus, setAudioStatus] = useState({});
  const audioSoundsRef = useRef({});

  const colors = ACTIVITY_COLORS[activityType] || ACTIVITY_COLORS.reading;

  useEffect(() => {
    loadHistory();
  }, []);

  // Configure audio mode and cleanup on mount/unmount (only for listening activities)
  useEffect(() => {
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
        } catch (error) {
          console.error('[Audio] Error configuring audio mode:', error);
        }
      }
    };
    
    configureAudio();
    
    return () => {
      stopAllAudio();
    };
  }, [activityType]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/activity-history/${language}`);
      const data = await response.json();
      // Filter by activity type
      const filtered = (data.history || []).filter(h => h.activity_type === activityType);
      setHistory(filtered);
      // If Urdu, prefetch Arabic/Nastaliq renderings for all content
      if (language === 'urdu' && filtered.length > 0) {
        const toFetch = [];
        filtered.forEach((h, idx) => {
          const data = h.activity_data ? JSON.parse(h.activity_data) : null;
          if (!data) return;
          
          // Common fields
          if (h.story_name || data.story_name) toFetch.push({ key: `storyName_${idx}`, text: h.story_name || data.story_name });
          if (h.activity_name || data.activity_name) toFetch.push({ key: `activityName_${idx}`, text: h.activity_name || data.activity_name });
          if (h.story || data.story) toFetch.push({ key: `story_${idx}`, text: h.story || data.story });
          
          // Reading activity
          if (data.questions) {
            data.questions.forEach((q, qIdx) => {
              if (q.question) toFetch.push({ key: `question_${idx}_${qIdx}`, text: q.question });
              if (q.options) {
                q.options.forEach((opt, oIdx) => {
                  if (opt) toFetch.push({ key: `option_${idx}_${qIdx}_${oIdx}`, text: opt });
                });
              }
            });
          }
          
          // Listening activity
          if (data.passage_name) toFetch.push({ key: `passageName_${idx}`, text: data.passage_name });
          if (data.passage) toFetch.push({ key: `passage_${idx}`, text: data.passage });
          if (data.kannada_text) toFetch.push({ key: `kannadaText_${idx}`, text: data.kannada_text });
          
          // Writing/Speaking activities
          if (data.writing_prompt) toFetch.push({ key: `writingPrompt_${idx}`, text: data.writing_prompt });
          if (data.topic) toFetch.push({ key: `topic_${idx}`, text: data.topic });
          if (data.instructions) toFetch.push({ key: `instructions_${idx}`, text: data.instructions });
          if (data.required_words) {
            data.required_words.forEach((word, wIdx) => {
              if (word) toFetch.push({ key: `requiredWord_${idx}_${wIdx}`, text: word });
            });
          }
          
          // Writing submissions
          if (data.submissions) {
            data.submissions.forEach((sub, sIdx) => {
              if (sub.user_writing) toFetch.push({ key: `userWriting_${idx}_${sIdx}`, text: sub.user_writing });
              if (sub.grading_result && sub.grading_result.feedback) {
                toFetch.push({ key: `feedback_${idx}_${sIdx}`, text: sub.grading_result.feedback });
              }
            });
          } else if (data.user_writing) {
            toFetch.push({ key: `userWriting_${idx}_0`, text: data.user_writing });
            if (data.grading_result && data.grading_result.feedback) {
              toFetch.push({ key: `feedback_${idx}_0`, text: data.grading_result.feedback });
            }
          }
          
          // Speaking
          if (data.topic) toFetch.push({ key: `topic_${idx}`, text: data.topic });
          if (data.instructions) toFetch.push({ key: `instructions_${idx}`, text: data.instructions });
          if (data.user_speech) toFetch.push({ key: `userSpeech_${idx}`, text: data.user_speech });
          if (data.required_words && Array.isArray(data.required_words)) {
            data.required_words.forEach((word, wIdx) => {
              toFetch.push({ key: `requiredWord_${idx}_${wIdx}`, text: word });
            });
          }
          if (data.tasks && Array.isArray(data.tasks)) {
            data.tasks.forEach((task, tIdx) => {
              toFetch.push({ key: `task_${idx}_${tIdx}`, text: task });
            });
          }
          
          // Conversation activity
          if (data.introduction) toFetch.push({ key: `introduction_${idx}`, text: data.introduction });
          if (data.messages) {
            data.messages.forEach((msg, mIdx) => {
              if (msg.user_message) toFetch.push({ key: `userMessage_${idx}_${mIdx}`, text: msg.user_message });
              if (msg.ai_response) toFetch.push({ key: `aiResponse_${idx}_${mIdx}`, text: msg.ai_response });
            });
          }
          if (data.conversation_tasks) {
            data.conversation_tasks.forEach((task, tIdx) => {
              if (task) toFetch.push({ key: `convTask_${idx}_${tIdx}`, text: task });
            });
          }
          
          // Translation activity
          if (data.sentences && Array.isArray(data.sentences)) {
            data.sentences.forEach((sentence, sIdx) => {
              if (sentence.text) toFetch.push({ key: `sentenceText_${idx}_${sIdx}`, text: sentence.text });
              if (sentence.expected_translation) toFetch.push({ key: `expectedTranslation_${idx}_${sIdx}`, text: sentence.expected_translation });
            });
          }
          if (data.submissions && Array.isArray(data.submissions)) {
            data.submissions.forEach((sub, subIdx) => {
              if (sub.feedback) toFetch.push({ key: `submissionFeedback_${idx}_${subIdx}`, text: sub.feedback });
            });
          }
        });
        
        // Add UI labels for Urdu
        toFetch.push({ key: 'reopenActivity', text: getReopenActivityLabel(language) });
        toFetch.push({ key: 'writingPrompt', text: getWritingPromptLabel(language) });
        toFetch.push({ key: 'requiredWords', text: getRequiredWordsTitleLabel(language) });
        toFetch.push({ key: 'submissions', text: getSubmissionsFeedbackLabel(language) });
        toFetch.push({ key: 'submissionLabel', text: getSubmissionNumberLabel(language) });
        toFetch.push({ key: 'overallScore', text: getOverallScoreLabel(language) });
        toFetch.push({ key: 'topicLabel', text: getTopicLabel(language) });
        toFetch.push({ key: 'instructionsLabel', text: getInstructionsLabel(language) });
        toFetch.push({ key: 'yourSpeech', text: 'Your Speech:' }); // TODO: Add to ui_labels
        toFetch.push({ key: 'sentencesLabel', text: getSentencesLabel(language) });
        toFetch.push({ key: 'sentenceLabel', text: getSentenceLabel(language) });
        toFetch.push({ key: 'sourceTextLabel', text: getSourceTextLabel(language) });
        toFetch.push({ key: 'expectedTranslationLabel', text: getExpectedTranslationLabel(language) });
        
        if (toFetch.length > 0) {
          const newR = {};
          for (const item of toFetch) {
            try {
              const resp = await fetch(`${API_BASE_URL}/api/transliterate`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: item.text, language, to_script: 'Urdu' })
              });
              if (resp.ok) {
                const d = await resp.json();
                newR[item.key] = d.transliteration || '';
              }
            } catch (e) {
              console.error('Error fetching native rendering for history preview', e);
            }
          }
          setNativeRenderings(newR);
        }
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score) => {
    if (score >= 0.8) return '#50C878';
    if (score >= 0.6) return '#FFA500';
    return '#FF6B6B';
  };

  // Audio playback functions for listening activity
  const playAudio = async (paragraphIndex, activityData) => {
    try {
      // Stop any currently playing audio
      await stopAllAudio();
      
      // Check if we already have a sound object for this paragraph
      const soundKey = `${selectedActivity}-${paragraphIndex}`;
      if (audioSoundsRef.current[soundKey]) {
        const sound = audioSoundsRef.current[soundKey];
        
        if (Platform.OS === 'web') {
          // HTML5 Audio API - replay by resetting and playing
          if (sound && typeof sound.play === 'function') {
            sound.currentTime = 0;
            await sound.play();
            setPlayingParagraph(soundKey);
            setAudioStatus({ ...audioStatus, [soundKey]: 'playing' });
            return;
          }
        } else {
          // expo-av
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.replayAsync();
            setPlayingParagraph(soundKey);
            setAudioStatus({ ...audioStatus, [soundKey]: 'playing' });
            return;
          }
        }
      }
      
      // Get audio data from activity
      const audioDataList = activityData._audio_data || [];
      const audioData = audioDataList[paragraphIndex];
      
      if (audioData && audioData.audio_base64 && audioData.format !== 'text_only') {
        try {
          // Convert base64 to data URI
          const audioFormat = audioData.format || 'wav';
          const mimeType = audioFormat === 'wav' ? 'audio/wav' : 'audio/mpeg';
          const dataUri = `data:${mimeType};base64,${audioData.audio_base64}`;
          
          if (Platform.OS === 'web') {
            // Use HTML5 Audio API for web
            const BrowserAudio = typeof window !== 'undefined' && window.Audio ? window.Audio : null;
            if (!BrowserAudio) {
              throw new Error('HTML5 Audio API not available');
            }
            const audioElement = new BrowserAudio(dataUri);
            
            audioElement.onplay = () => {
              setPlayingParagraph(soundKey);
              setAudioStatus({ ...audioStatus, [soundKey]: 'playing' });
            };
            
            audioElement.onpause = () => {
              setPlayingParagraph(null);
              setAudioStatus({ ...audioStatus, [soundKey]: 'paused' });
            };
            
            audioElement.onended = () => {
              setPlayingParagraph(null);
              setAudioStatus({ ...audioStatus, [soundKey]: 'stopped' });
            };
            
            audioElement.onerror = (error) => {
              console.error(`[Audio] Error playing paragraph ${paragraphIndex}:`, error);
              setPlayingParagraph(null);
              setAudioStatus({ ...audioStatus, [soundKey]: 'error' });
            };
            
            audioSoundsRef.current[soundKey] = audioElement;
            audioElement.volume = 1.0;
            await audioElement.play();
          } else {
            // Use expo-av for mobile platforms
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: dataUri },
              { 
                shouldPlay: true,
                isMuted: false,
                volume: 1.0,
              }
            );
            
            newSound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded) {
                if (status.didJustFinish) {
                  setPlayingParagraph(null);
                  setAudioStatus({ ...audioStatus, [soundKey]: 'stopped' });
                } else if (status.isPlaying) {
                  setAudioStatus({ ...audioStatus, [soundKey]: 'playing' });
                }
              }
            });
            
            audioSoundsRef.current[soundKey] = newSound;
            setPlayingParagraph(soundKey);
            setAudioStatus({ ...audioStatus, [soundKey]: 'playing' });
          }
        } catch (audioError) {
          console.error('[Audio] Error loading audio:', audioError);
          Alert.alert('Audio Error', 'Could not play audio. Please try again.');
          setPlayingParagraph(null);
          setAudioStatus({ ...audioStatus, [soundKey]: 'error' });
        }
      } else {
        Alert.alert('Audio Not Available', 'Audio for this paragraph is not available.');
        setPlayingParagraph(null);
        setAudioStatus({ ...audioStatus, [soundKey]: 'error' });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Could not play audio. Please try again.');
      setPlayingParagraph(null);
    }
  };

  const pauseAudio = async (soundKey) => {
    try {
      if (audioSoundsRef.current[soundKey]) {
        const sound = audioSoundsRef.current[soundKey];
        
        if (Platform.OS === 'web') {
          if (sound && typeof sound.pause === 'function') {
            sound.pause();
          }
        } else {
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await sound.pauseAsync();
          }
        }
      }
      
      setPlayingParagraph(null);
      setAudioStatus({ ...audioStatus, [soundKey]: 'paused' });
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  };

  const stopAllAudio = async () => {
    try {
      for (const [key, sound] of Object.entries(audioSoundsRef.current)) {
        if (sound) {
          try {
            if (Platform.OS === 'web') {
              if (sound && typeof sound.pause === 'function') {
                sound.pause();
                sound.currentTime = 0;
                sound.src = '';
              }
            } else {
              const status = await sound.getStatusAsync();
              if (status.isLoaded) {
                await sound.stopAsync();
                await sound.unloadAsync();
              }
            }
          } catch (e) {
            console.error(`Error stopping sound ${key}:`, e);
          }
        }
      }
      audioSoundsRef.current = {};
      setPlayingParagraph(null);
      setAudioStatus({});
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  const renderActivityContent = (activityData, idx) => {
    if (!activityData) return null;
    
    try {
      const data = typeof activityData === 'string' ? JSON.parse(activityData) : activityData;
      
      if (activityType === 'reading' && data.story) {
        return (
          <View>
            {data.story_name && (
              <SafeText style={styles.activityStoryName}>{language === 'urdu' && nativeRenderings[`storyName_${idx}`] ? nativeRenderings[`storyName_${idx}`] : String(data.story_name)}</SafeText>
            )}
            <SafeText style={styles.activityStory}>{language === 'urdu' && nativeRenderings[`story_${idx}`] ? nativeRenderings[`story_${idx}`] : String(data.story)}</SafeText>
            {data.questions && data.questions.length > 0 && (
              <View style={styles.questionsSection}>
                <SafeText style={styles.questionsTitle}>
                  <SafeText style={styles.boldText}>{getQuestionLabel(language)}</SafeText>
                </SafeText>
                {data.questions.map((q, qIndex) => (
                  <View key={qIndex} style={styles.questionItem}>
                    <SafeText style={styles.questionText}>{`${qIndex + 1}. ${language === 'urdu' && nativeRenderings[`question_${idx}_${qIndex}`] ? nativeRenderings[`question_${idx}_${qIndex}`] : String(q.question)}`}</SafeText>
                    {/* Always show answers in history */}
                    <View style={styles.optionsContainer}>
                      {q.options.map((option, oIndex) => (
                        <View
                          key={oIndex}
                          style={[
                            styles.optionItem,
                            oIndex === q.correct && styles.correctOption,
                          ]}
                        >
                          <SafeText style={[
                            styles.optionText,
                            oIndex === q.correct && styles.correctOptionText,
                          ]}>
                            {language === 'urdu' && nativeRenderings[`option_${idx}_${qIndex}_${oIndex}`] ? nativeRenderings[`option_${idx}_${qIndex}_${oIndex}`] : String(option)}
                          </SafeText>
                          {oIndex === q.correct && (
                            <Ionicons name="checkmark-circle" size={16} color="#50C878" />
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      }
      
      if (activityType === 'listening') {
        // Split passage into paragraphs for audio playback
        const passageText = language === 'urdu' && nativeRenderings[`passage_${idx}`] ? nativeRenderings[`passage_${idx}`] : (data.passage || '');
        const paragraphs = passageText ? passageText.split('\n\n').filter(p => p.trim()) : [];
        const audioDataList = data._audio_data || [];
        
        return (
          <View>
            {data.passage_name && (
              <SafeText style={styles.activityStoryName}>{language === 'urdu' && nativeRenderings[`passageName_${idx}`] ? nativeRenderings[`passageName_${idx}`] : String(data.passage_name)}</SafeText>
            )}
            {paragraphs.length > 0 ? (
              paragraphs.map((para, paraIndex) => {
                const soundKey = `${selectedActivity}-${paraIndex}`;
                const isPlaying = playingParagraph === soundKey;
                const hasAudio = audioDataList[paraIndex] && 
                                 audioDataList[paraIndex].audio_base64 && 
                                 audioDataList[paraIndex].format !== 'text_only';
                
                return (
                  <View key={paraIndex} style={styles.paragraphContainer}>
                    {hasAudio && (
                      <TouchableOpacity
                        style={[styles.audioPlayButton, { backgroundColor: colors.primary }]}
                        onPress={() => {
                          if (isPlaying) {
                            pauseAudio(soundKey);
                          } else {
                            playAudio(paraIndex, data);
                          }
                        }}
                      >
                        <Ionicons 
                          name={isPlaying ? "pause" : "play"} 
                          size={20} 
                          color="#FFFFFF" 
                        />
                        <SafeText style={styles.audioPlayButtonText}>
                          {isPlaying ? getPauseLabel(language) : formatPlayParagraphLabel(language, paraIndex + 1)}
                        </SafeText>
                      </TouchableOpacity>
                    )}
                    <SafeText style={styles.activityStory}>{String(para.trim())}</SafeText>
                  </View>
                );
              })
            ) : passageText ? (
              <SafeText style={styles.activityStory}>{String(passageText)}</SafeText>
            ) : null}
            {data.kannada_text && (
              <View style={styles.translationBox}>
                <SafeText style={styles.translationLabel}>Kannada Text:</SafeText>
                <SafeText style={styles.translationText}>{language === 'urdu' && nativeRenderings[`kannadaText_${idx}`] ? nativeRenderings[`kannadaText_${idx}`] : String(data.kannada_text)}</SafeText>
              </View>
            )}
            {data.questions && data.questions.length > 0 && (
              <View style={styles.questionsSection}>
                <SafeText style={styles.questionsTitle}><SafeText style={styles.boldText}>{getQuestionLabel(language)}</SafeText></SafeText>
                {data.questions.map((q, qIndex) => (
                  <View key={qIndex} style={styles.questionItem}>
                    <SafeText style={styles.questionText}>{`${String(qIndex + 1)}. ${language === 'urdu' && nativeRenderings[`question_${idx}_${qIndex}`] ? nativeRenderings[`question_${idx}_${qIndex}`] : String(q.question)}`}</SafeText>
                    <View style={styles.optionsContainer}>
                      {q.options.map((option, oIndex) => (
                        <View
                          key={oIndex}
                          style={[
                            styles.optionItem,
                            oIndex === q.correct && styles.correctOption,
                          ]}
                        >
                          <SafeText style={[
                            styles.optionText,
                            oIndex === q.correct && styles.correctOptionText,
                          ]}>{language === 'urdu' && nativeRenderings[`option_${idx}_${qIndex}_${oIndex}`] ? nativeRenderings[`option_${idx}_${qIndex}_${oIndex}`] : String(option)}</SafeText>
                          {oIndex === q.correct && (
                            <Ionicons name="checkmark-circle" size={16} color="#50C878" />
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      }
      
      if (activityType === 'writing') {
        return (
          <View>
            {data.activity_name && (
              <SafeText style={styles.activityStoryName}>{language === 'urdu' && nativeRenderings[`activityName_${idx}`] ? nativeRenderings[`activityName_${idx}`] : String(data.activity_name)}</SafeText>
            )}
            {data.writing_prompt && (
              <View style={styles.promptBox}>
                <SafeText style={styles.promptLabel}>
                  {language === 'urdu' && nativeRenderings.writingPrompt
                    ? nativeRenderings.writingPrompt
                    : getWritingPromptLabel(language)}
                </SafeText>
                <SafeText style={styles.promptText}>{language === 'urdu' && nativeRenderings[`writingPrompt_${idx}`] ? nativeRenderings[`writingPrompt_${idx}`] : String(data.writing_prompt)}</SafeText>
              </View>
            )}
            {data.required_words && data.required_words.length > 0 && (
              <View style={styles.requiredWordsBox}>
                <SafeText style={styles.requiredWordsLabel}>
                  {language === 'urdu' && nativeRenderings.requiredWords
                    ? nativeRenderings.requiredWords
                    : getRequiredWordsTitleLabel(language)}
                </SafeText>
                <View style={styles.wordsList}>
                  {data.required_words.map((word, wIdx) => (
                    <View key={wIdx} style={styles.wordTag}>
                      <SafeText style={styles.wordTagText}>{language === 'urdu' && nativeRenderings[`requiredWord_${idx}_${wIdx}`] ? nativeRenderings[`requiredWord_${idx}_${wIdx}`] : String(word)}</SafeText>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {data.submissions && Array.isArray(data.submissions) && data.submissions.length > 0 && (
              <View style={styles.submissionsSection}>
                <SafeText style={styles.submissionsTitle}>
                  {language === 'urdu' && nativeRenderings.submissions
                    ? nativeRenderings.submissions
                    : getSubmissionsFeedbackLabel(language)} ({data.submissions.length})
                </SafeText>
                {data.submissions.map((submission, sIdx) => (
                  <View key={sIdx} style={styles.submissionItem}>
                    <SafeText style={styles.submissionNumber}>
                      {language === 'urdu' && nativeRenderings.submissionLabel
                        ? nativeRenderings.submissionLabel
                        : getSubmissionNumberLabel(language)} {sIdx + 1}
                    </SafeText>
                    {submission.user_writing && (
                      <SafeText style={styles.submissionText}>{language === 'urdu' && nativeRenderings[`userWriting_${idx}_${sIdx}`] ? nativeRenderings[`userWriting_${idx}_${sIdx}`] : String(submission.user_writing)}</SafeText>
                    )}
                    {submission.grading_result && (
                      <View style={styles.gradingResult}>
                        <SafeText style={styles.gradingScore}>
                          {language === 'urdu' && nativeRenderings.overallScore
                            ? nativeRenderings.overallScore
                            : getOverallScoreLabel(language)} {Math.round(submission.grading_result.score || 0)}%
                        </SafeText>
                        {submission.grading_result.feedback && (
                          <SafeText style={styles.gradingFeedback}>
                            {language === 'urdu' && nativeRenderings[`feedback_${idx}_${sIdx}`]
                              ? nativeRenderings[`feedback_${idx}_${sIdx}`].substring(0, 200) + '...'
                              : submission.grading_result.feedback.substring(0, 200) + '...'}
                          </SafeText>
                        )}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
            {/* Legacy format support */}
            {data.user_writing && !data.submissions && (
              <View style={styles.submissionItem}>
                <SafeText style={styles.submissionNumber}>
                  {language === 'urdu' && nativeRenderings.submissionLabel
                    ? nativeRenderings.submissionLabel
                    : getSubmissionNumberLabel(language)}:
                </SafeText>
                <SafeText style={styles.submissionText}>{language === 'urdu' && nativeRenderings[`userWriting_${idx}_0`] ? nativeRenderings[`userWriting_${idx}_0`] : String(data.user_writing)}</SafeText>
                {data.grading_result && (
                  <View style={styles.gradingResult}>
                    <SafeText style={styles.gradingScore}>
                      {language === 'urdu' && nativeRenderings.overallScore
                        ? nativeRenderings.overallScore
                        : getOverallScoreLabel(language)} {Math.round(data.grading_result.score || 0)}%
                    </SafeText>
                    {data.grading_result.feedback && (
                      <SafeText style={styles.gradingFeedback}>
                        {language === 'urdu' && nativeRenderings[`feedback_${idx}_0`]
                          ? nativeRenderings[`feedback_${idx}_0`].substring(0, 200) + '...'
                          : data.grading_result.feedback.substring(0, 200) + '...'}
                      </SafeText>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      }
      
      if (activityType === 'speaking') {
        return (
          <View>
            {data.activity_name && (
              <SafeText style={styles.activityStoryName}>{language === 'urdu' && nativeRenderings[`activityName_${idx}`] ? nativeRenderings[`activityName_${idx}`] : String(data.activity_name)}</SafeText>
            )}
            {data.topic && (
              <View style={styles.promptBox}>
                <SafeText style={styles.promptLabel}>
                  {language === 'urdu' && nativeRenderings.topicLabel
                    ? nativeRenderings.topicLabel
                    : getTopicLabel(language)}
                </SafeText>
                <SafeText style={styles.promptText}>{language === 'urdu' && nativeRenderings[`topic_${idx}`] ? nativeRenderings[`topic_${idx}`] : String(data.topic)}</SafeText>
              </View>
            )}
            {data.instructions && (
              <View style={styles.promptBox}>
                <SafeText style={styles.promptLabel}>
                  {language === 'urdu' && nativeRenderings.instructionsLabel
                    ? nativeRenderings.instructionsLabel
                    : getInstructionsLabel(language)}
                </SafeText>
                <SafeText style={styles.promptText}>{language === 'urdu' && nativeRenderings[`instructions_${idx}`] ? nativeRenderings[`instructions_${idx}`] : String(data.instructions)}</SafeText>
              </View>
            )}
            {data.required_words && data.required_words.length > 0 && (
              <View style={styles.requiredWordsBox}>
                <SafeText style={styles.requiredWordsLabel}>
                  {language === 'urdu' && nativeRenderings.requiredWords
                    ? nativeRenderings.requiredWords
                    : getRequiredWordsTitleLabel(language)}
                </SafeText>
                <View style={styles.wordsList}>
                  {data.required_words.map((word, wIdx) => (
                    <View key={wIdx} style={styles.wordTag}>
                      <SafeText style={styles.wordTagText}>{language === 'urdu' && nativeRenderings[`requiredWord_${idx}_${wIdx}`] ? nativeRenderings[`requiredWord_${idx}_${wIdx}`] : String(word)}</SafeText>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {data.user_speech && (
              <View style={styles.submissionItem}>
                <SafeText style={styles.submissionNumber}>
                  {language === 'urdu' && nativeRenderings.yourSpeech
                    ? nativeRenderings.yourSpeech
                    : 'Your Speech:'}
                </SafeText>
                <SafeText style={styles.submissionText}>{language === 'urdu' && nativeRenderings[`userSpeech_${idx}`] ? nativeRenderings[`userSpeech_${idx}`] : String(data.user_speech)}</SafeText>
              </View>
            )}
          </View>
        );
      }
      
      if (activityType === 'conversation') {
        // Render conversation activity with messages
        return (
          <View>
            {data.activity_name && (
              <SafeText style={styles.activityStoryName}>{language === 'urdu' && nativeRenderings[`activityName_${idx}`] ? nativeRenderings[`activityName_${idx}`] : String(data.activity_name)}</SafeText>
            )}
            {data.introduction && (
              <Text style={[styles.activityStory, { marginBottom: 16, fontStyle: 'italic', color: '#666' }]}>
                {language === 'urdu' && nativeRenderings[`introduction_${idx}`] ? nativeRenderings[`introduction_${idx}`] : data.introduction}
              </Text>
            )}
            {data.messages && Array.isArray(data.messages) && data.messages.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.boldText, { marginBottom: 12, fontSize: 16 }]}>ಸಂಭಾಷಣೆ:</Text>
                {data.messages.map((msg, mIdx) => {
                  const hasUserMessage = msg.user_message && msg.user_message.trim();
                  const hasAiResponse = msg.ai_response && msg.ai_response.trim();
                  
                  return (
                    <View key={mIdx} style={{ marginBottom: 16 }}>
                      {hasUserMessage ? (
                        <View style={[styles.userMessageBox, { backgroundColor: colors.light, alignSelf: 'flex-end', maxWidth: '80%', marginBottom: 8 }]}>
                          <SafeText style={styles.messageText}>{language === 'urdu' && nativeRenderings[`userMessage_${idx}_${mIdx}`] ? nativeRenderings[`userMessage_${idx}_${mIdx}`] : String(msg.user_message)}</SafeText>
                        </View>
                      ) : null}
                      {hasAiResponse ? (
                        <View style={[styles.aiMessageBox, { backgroundColor: '#F0F0F0', alignSelf: 'flex-start', maxWidth: '80%', marginTop: hasUserMessage ? 8 : 0 }]}>
                          <SafeText style={styles.messageText}>{language === 'urdu' && nativeRenderings[`aiResponse_${idx}_${mIdx}`] ? nativeRenderings[`aiResponse_${idx}_${mIdx}`] : String(msg.ai_response)}</SafeText>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
            {data.tasks && Array.isArray(data.tasks) && data.tasks.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.boldText, { marginBottom: 8 }]}>ಕಾರ್ಯಗಳು:</Text>
                {data.tasks.map((task, tIdx) => (
                  <Text key={tIdx} style={[styles.activityStory, { marginBottom: 4 }]}>
                    {tIdx + 1}. {language === 'urdu' && nativeRenderings[`task_${idx}_${tIdx}`] ? nativeRenderings[`task_${idx}_${tIdx}`] : task}
                  </Text>
                ))}
              </View>
            )}
          </View>
        );
      }
      
      if (activityType === 'translation') {
        return (
          <View>
            {data.activity_name && (
              <SafeText style={styles.activityStoryName}>{language === 'urdu' && nativeRenderings[`activityName_${idx}`] ? nativeRenderings[`activityName_${idx}`] : String(data.activity_name)}</SafeText>
            )}
            {data.sentences && data.sentences.length > 0 && (
              <SafeText style={styles.activityStory}>
                {data.sentences.length} {language === 'urdu' && nativeRenderings.sentencesLabel ? nativeRenderings.sentencesLabel : getSentencesLabel(language)}
              </SafeText>
            )}
            {data.submissions && Array.isArray(data.submissions) && data.submissions.length > 0 && (
              <View style={styles.submissionsSection}>
                {data.submissions.slice(0, 1).map((submission, subIdx) => (
                  <View key={subIdx} style={styles.submissionItem}>
                    {submission.overall_score !== undefined && (
                      <SafeText style={styles.gradingScore}>
                        {language === 'urdu' && nativeRenderings.overallScore
                          ? nativeRenderings.overallScore
                          : getOverallScoreLabel(language)} {Math.round(submission.overall_score || 0)}%
                      </SafeText>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      }
      
      // Fallback: show JSON for unknown activity types
      return <SafeText style={styles.activityText}>{JSON.stringify(data, null, 2)}</SafeText>;
    } catch (e) {
      return <SafeText style={styles.activityText}>{activityData}</SafeText>;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={styles.headerTitle}>
          {activityType.charAt(0).toUpperCase() + activityType.slice(1)} History
        </Text>
        <View style={styles.headerRight}>
          {/* Show Answers toggle removed - now in ActivityScreen */}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No activity history yet</Text>
            <Text style={styles.emptySubtext}>
              Complete some {activityType} activities to see them here
            </Text>
          </View>
        ) : (
          history.map((item, index) => {
            const activityData = item.activity_data ? JSON.parse(item.activity_data) : null;
            const isExpanded = selectedActivity === item.id;
            
            return (
              <View key={item.id} style={styles.historyCard}>
                <TouchableOpacity
                  style={styles.historyCardHeader}
                  onPress={() => {
                    // Stop audio when collapsing or switching activities
                    if (isExpanded || selectedActivity !== item.id) {
                      stopAllAudio();
                    }
                    setSelectedActivity(isExpanded ? null : item.id);
                  }}
                >
                  <View style={styles.historyCardLeft}>
                    {/* Show score badge for all activities with valid scores */}
                    {item.score != null && !isNaN(item.score) && (
                      <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(item.score) }]}>
                        <SafeText style={styles.scoreText}>{String(Math.round(item.score * 100))}%</SafeText>
                      </View>
                    )}
                    <View style={styles.historyInfo}>
                      {activityData && activityType === 'conversation' ? (
                        <>
                          <SafeText style={styles.historyStoryName}>{language === 'urdu' && nativeRenderings[`activityName_${index}`] ? nativeRenderings[`activityName_${index}`] : String(activityData.activity_name || 'ಸಂಭಾಷಣೆ')}</SafeText>
                          {item.completed_at && <SafeText style={styles.historyDate}>{formatDate(item.completed_at)}</SafeText>}
                          {activityData.messages && activityData.messages.length > 0 ? (
                            // Show first AI message if available, otherwise first user message
                            (() => {
                              const firstMsg = activityData.messages[0];
                              const previewText = firstMsg.ai_response || firstMsg.user_message || '';
                              const nativePreviewText = language === 'urdu' && nativeRenderings[`${firstMsg.ai_response ? 'aiResponse' : 'userMessage'}_${index}_0`] 
                                ? nativeRenderings[`${firstMsg.ai_response ? 'aiResponse' : 'userMessage'}_${index}_0`]
                                : previewText;
                              return nativePreviewText ? (
                                <SafeText style={[styles.historyType, { marginTop: 4, fontSize: 12, color: '#666' }]} numberOfLines={1}>
                                  {String(nativePreviewText.substring(0, 50))}{nativePreviewText.length > 50 ? '...' : ''}
                                </SafeText>
                              ) : null;
                            })()
                          ) : activityData.introduction ? (
                            <Text style={[styles.historyType, { marginTop: 4, fontSize: 12, color: '#666' }]} numberOfLines={1}>
                              {language === 'urdu' && nativeRenderings[`introduction_${index}`] ? nativeRenderings[`introduction_${index}`].substring(0, 50) : activityData.introduction.substring(0, 50)}{(language === 'urdu' && nativeRenderings[`introduction_${index}`] ? nativeRenderings[`introduction_${index}`] : activityData.introduction).length > 50 ? '...' : ''}
                            </Text>
                          ) : null}
                        </>
                      ) : activityData && activityType === 'speaking' ? (
                        <>
                          <SafeText style={styles.historyStoryName}>{language === 'urdu' && nativeRenderings[`activityName_${index}`] ? nativeRenderings[`activityName_${index}`] : String(activityData.activity_name || 'ಭಾಷಣ ಅಭ್ಯಾಸ')}</SafeText>
                          {item.completed_at && <SafeText style={styles.historyDate}>{String(formatDate(item.completed_at))}</SafeText>}
                          {activityData.topic && (
                            <SafeText style={[styles.historyType, { marginTop: 4, fontSize: 12, color: '#666' }]} numberOfLines={1}>
                              {language === 'urdu' && nativeRenderings[`topic_${index}`] ? String(nativeRenderings[`topic_${index}`].substring(0, 60)) : String(activityData.topic.substring(0, 60))}{(language === 'urdu' && nativeRenderings[`topic_${index}`] ? nativeRenderings[`topic_${index}`] : activityData.topic).length > 60 ? '...' : ''}
                            </SafeText>
                          )}
                        </>
                      ) : activityData && (activityData.story_name || activityData.activity_name || activityData.passage_name) ? (
                        <>
                          <SafeText style={styles.historyStoryName}>{language === 'urdu' && (nativeRenderings[`storyName_${index}`] || nativeRenderings[`activityName_${index}`] || nativeRenderings[`passageName_${index}`]) ? (nativeRenderings[`storyName_${index}`] || nativeRenderings[`activityName_${index}`] || nativeRenderings[`passageName_${index}`]) : String(activityData.story_name || activityData.activity_name || activityData.passage_name)}</SafeText>
                          {item.completed_at && <SafeText style={styles.historyDate}>{String(formatDate(item.completed_at))}</SafeText>}
                        </>
                      ) : (
                        <>
                          {item.completed_at && <SafeText style={styles.historyDate}>{String(formatDate(item.completed_at))}</SafeText>}
                          <SafeText style={styles.historyType}>{String(item.activity_type.charAt(0).toUpperCase() + item.activity_type.slice(1))}</SafeText>
                        </>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
                
                {isExpanded && activityData && (
                  <View style={styles.historyCardContent}>
                    <TouchableOpacity
                      style={[styles.reopenButton, { backgroundColor: colors.primary }]}
                      onPress={() => {
                        // Stop any playing audio before navigating
                        stopAllAudio();
                        // Navigate to ActivityScreen with the saved activity data
                        navigation.navigate('Activity', {
                          language: language,
                          activityType: activityType,
                          activityData: activityData, // Pass the saved activity data
                          activityId: item.id, // Pass the database ID for conversation activities
                          fromHistory: true, // Flag to indicate this is from history
                        });
                      }}
                    >
                      <Ionicons name="refresh" size={16} color="#FFFFFF" />
                      <SafeText style={styles.reopenButtonText}>
                        {language === 'urdu' && nativeRenderings.reopenActivity
                          ? nativeRenderings.reopenActivity
                          : getReopenActivityLabel(language)}
                      </SafeText>
                    </TouchableOpacity>
                    {renderActivityContent(activityData, index)}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
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
    alignItems: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  historyInfo: {
    flex: 1,
  },
  historyStoryName: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '600',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  historyType: {
    fontSize: 12,
    color: '#666',
  },
  activityStoryName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  historyCardContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  activityStory: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1A1A1A',
    marginBottom: 20,
  },
  questionsSection: {
    marginTop: 16,
  },
  questionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  boldText: {
    fontWeight: 'bold',
  },
  questionItem: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  optionsContainer: {
    marginLeft: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
  },
  correctOption: {
    backgroundColor: '#E8F8F0',
    borderWidth: 1,
    borderColor: '#50C878',
  },
  optionText: {
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
  },
  correctOptionText: {
    color: '#50C878',
    fontWeight: '600',
  },
  activityText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
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
  messageText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  reopenButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  translationBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 16,
  },
  translationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  translationText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  promptBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 16,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  promptText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  requiredWordsBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginBottom: 16,
  },
  requiredWordsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  wordsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wordTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#E8F4FD',
    marginRight: 8,
    marginBottom: 8,
  },
  wordTagText: {
    fontSize: 12,
    color: '#1A1A1A',
  },
  submissionsSection: {
    marginTop: 16,
  },
  submissionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  sentencesSection: {
    marginTop: 16,
  },
  sentenceItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  sentenceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  submissionItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  submissionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  submissionText: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
    marginBottom: 8,
  },
  gradingResult: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  gradingScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#50C878',
    marginBottom: 4,
  },
  gradingFeedback: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  paragraphContainer: {
    marginBottom: 20,
  },
  audioPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  audioPlayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
