import { useState } from 'react';
import { API_BASE_URL } from '../constants';

/**
 * Save a submission to the database
 */
async function saveSubmissionToDatabase(activity, allSubmissions, language, activityType = 'writing') {
  try {
    // Prepare activity data with ALL submissions (including the new one)
    const activityData = {
      ...activity,
      submissions: allSubmissions, // Send complete submissions array
      last_submission_at: allSubmissions[0]?.submitted_at || new Date().toISOString(),
    };

    // Call complete activity endpoint to save
    const response = await fetch(`${API_BASE_URL}/api/activity/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: language,
        activity_type: activityType,
        activity_id: activity.activity_id,
        score: allSubmissions[0]?.grading_result?.score || 0,
        activity_data: activityData,
        word_updates: [], // No word updates for writing/speaking grading
      }),
    });

    if (!response.ok) {
      console.error('Failed to save submission to database:', response.status);
    }
  } catch (error) {
    console.error('Error saving submission:', error);
  }
}

/**
 * Custom hook for grading writing and speaking activities
 * Handles submission, grading, and history
 */
export function useGrading(activityType, language, initialSubmissions = []) {
  const [userAnswer, setUserAnswer] = useState('');
  const [gradingResult, setGradingResult] = useState(null);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState(initialSubmissions);
  const [expandedSubmissions, setExpandedSubmissions] = useState(new Set());
  const [gradingApiDetails, setGradingApiDetails] = useState([]);

  /**
   * Submit writing for grading
   */
  const submitWriting = async (activity, userText) => {
    if (!userText || !userText.trim()) {
      alert('Please write something before submitting.');
      return;
    }

    setGradingLoading(true);
    setGradingResult(null);

    try {
      const requestBody = {
        user_text: userText,
        writing_prompt: activity.writing_prompt || activity.prompt,
        required_words: activity.required_words || [],
        evaluation_criteria: activity.evaluation_criteria || '',
        learned_words: [],
        learning_words: [],
      };

      const response = await fetch(`${API_BASE_URL}/api/activity/writing/${language}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Grading failed: ${response.status}`);
      }

      const result = await response.json();
      setGradingResult(result);

      // Store API call details for debug modal
      const apiCall = {
        endpoint: '/grade_writing',
        method: 'POST',
        request: requestBody,
        response: result,
        timestamp: new Date().toISOString(),
      };
      setGradingApiDetails(prev => [...prev, apiCall]);

      // Add to submissions history
      const newSubmission = {
        user_writing: userText,
        grading_result: result,
        timestamp: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      };
      const updatedSubmissions = [newSubmission, ...allSubmissions];
      setAllSubmissions(updatedSubmissions);

      // Save ALL submissions to database (including the new one)
      await saveSubmissionToDatabase(activity, updatedSubmissions, language);

      return result;
    } catch (error) {
      console.error('Error grading writing:', error);
      alert('Failed to grade your writing. Please try again.');
      return null;
    } finally {
      setGradingLoading(false);
    }
  };

  /**
   * Submit speaking for grading (with audio directly, no transcript needed)
   */
  const submitSpeaking = async (activity, audioUri, audioBase64) => {
    if (!audioUri || !audioBase64) {
      alert('No audio recording found. Please record your speech first.');
      return;
    }

    setGradingLoading(true);
    setGradingResult(null);

    try {
      // Prepare the request body to match backend's SpeakingGradingRequest model
      const requestBody = {
        audio_base64: audioBase64,
        audio_format: 'webm',  // or detect from audioUri
        speaking_topic: activity.topic || activity.instructions || '',
        tasks: activity.tasks || [],
        required_words: activity.required_words || [],
        learned_words: activity.learned_words || [],
        learning_words: activity.learning_words || [],
      };

      const response = await fetch(`${API_BASE_URL}/api/activity/speaking/${language}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Grading error response:', errorText);
        throw new Error(`Grading failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Debug logging to see what scores are returned
      console.log('[DEBUG] Speaking grading result received:');
      console.log('  - score:', result.score);
      console.log('  - vocabulary_score:', result.vocabulary_score);
      console.log('  - grammar_score:', result.grammar_score);
      console.log('  - fluency_score:', result.fluency_score);
      console.log('  - task_completion_score:', result.task_completion_score);
      console.log('  - feedback length:', result.feedback?.length || 0);
      console.log('  - api_details:', result.api_details);
      
      setGradingResult(result);

      // Store API call details for debug modal
      const apiCall = {
        endpoint: `/api/activity/speaking/${language}/grade`,
        method: 'POST',
        request: { ...requestBody, audio_base64: '[AUDIO DATA]' },  // Don't log full audio
        response: result,
        timestamp: new Date().toISOString(),
      };
      setGradingApiDetails(prev => [...prev, apiCall]);

      // Add to submissions history (include audio_base64 for playback)
      const newSubmission = {
        transcript: result.user_transcript || '',  // Transcript from Gemini
        audio_uri: audioUri,
        audio_base64: audioBase64,  // Store for playback
        grading_result: result,
        timestamp: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      };
      const updatedSubmissions = [newSubmission, ...allSubmissions];
      setAllSubmissions(updatedSubmissions);

      // Save ALL submissions to database (including the new one)
      await saveSubmissionToDatabase(activity, updatedSubmissions, language, 'speaking');

      return result;
    } catch (error) {
      console.error('Error grading speaking:', error);
      alert('Failed to grade your speech. Please try again.');
      return null;
    } finally {
      setGradingLoading(false);
    }
  };

  /**
   * Submit translation for grading
   */
  const submitTranslation = async (activity, translations) => {
    if (!translations || translations.length === 0) {
      alert('Please complete at least one translation before submitting.');
      return;
    }

    setGradingLoading(true);
    setGradingResult(null);

    try {
      const requestBody = {
        translations: translations,
      };

      const response = await fetch(`${API_BASE_URL}/api/activity/translation/${language}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Grading failed: ${response.status}`);
      }

      const result = await response.json();
      setGradingResult(result);

      // Store API call details for debug modal
      const apiCall = {
        endpoint: '/grade_translation',
        method: 'POST',
        request: requestBody,
        response: result,
        timestamp: new Date().toISOString(),
      };
      setGradingApiDetails(prev => [...prev, apiCall]);

      // Add to submissions history (most recent first)
      const newSubmission = {
        translations: translations,
        grading_result: result,
        timestamp: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        overall_score: result.overall_score,
        scores: result.scores,
        feedback: result.feedback,
        sentence_feedback: result.sentence_feedback,
      };

      const updatedSubmissions = [newSubmission, ...allSubmissions];
      setAllSubmissions(updatedSubmissions);

      // Save to database
      await saveSubmissionToDatabase(activity, updatedSubmissions, language, activityType);

      setGradingLoading(false);
      return result;
    } catch (error) {
      console.error('Error grading translation:', error);
      setGradingLoading(false);
      alert(`Error grading translation: ${error.message}`);
      return null;
    }
  };

  /**
   * Toggle expansion of a submission in the history
   */
  const toggleSubmissionExpansion = (index) => {
    const newExpanded = new Set(expandedSubmissions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSubmissions(newExpanded);
  };

  /**
   * Reset grading state (for new activity)
   */
  const resetGrading = () => {
    setUserAnswer('');
    setGradingResult(null);
    setGradingLoading(false);
    setAllSubmissions([]);
    setExpandedSubmissions(new Set());
    setGradingApiDetails([]);
  };

  return {
    // Writing/Speaking input
    userAnswer,
    setUserAnswer,
    
    // Grading state
    gradingResult,
    gradingLoading,
    
    // Submission history
    allSubmissions,
    setAllSubmissions,
    expandedSubmissions,
    toggleSubmissionExpansion,
    
    // API debug
    gradingApiDetails,
    
    // Actions
    submitWriting,
    submitSpeaking,
    submitTranslation,
    resetGrading,
  };
}
