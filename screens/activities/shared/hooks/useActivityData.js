/**
 * Hook for loading and managing activity data
 * Handles API calls, error states, and loading states
 */
import { useState, useEffect } from 'react';
import { fetchActivityData, getActivityTimeout, createApiDetails } from '../utils/apiHelpers';
import { sanitizeActivity } from '../utils/textProcessing';
import { API_BASE_URL } from '../constants';

export function useActivityData(activityType, language, activityId, fromHistory, providedActivityData, customTopic = null) {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(fromHistory ? true : false); // Only start loading if from history
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [ttsProgress, setTtsProgress] = useState({});  // Track TTS progress for each paragraph
  const [paragraphCount, setParagraphCount] = useState(0);  // Total paragraphs for progress bar
  const [sessionId, setSessionId] = useState(null);  // Session ID for SSE progress tracking
  const [wordsUsed, setWordsUsed] = useState([]);
  const [allApiDetails, setAllApiDetails] = useState([]);
  const [resolvedActivityId, setResolvedActivityId] = useState(activityId || null);
  const [showApiModal, setShowApiModal] = useState(false);
  const [topic, setTopic] = useState(customTopic);

  const loadActivity = async (selectedTopic = null) => {
    // Update topic if provided
    if (selectedTopic !== null) {
      setTopic(selectedTopic);
    }
    const topicToUse = selectedTopic !== null ? selectedTopic : topic;
    // If loading from history with provided data, use it directly
    if (fromHistory && providedActivityData) {
      console.log('Loading activity from history (route data) with ID:', activityId);
      setActivity(sanitizeActivity(providedActivityData));
      setResolvedActivityId(activityId || Date.now());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Set loading status based on activity type
      const loadingMessages = {
        listening: 'Generating passage and questions...',
        reading: 'Generating story and questions...',
        writing: 'Generating writing prompt...',
        speaking: 'Generating speaking topic...',
        conversation: 'Starting conversation...'
      };
      setLoadingStatus(loadingMessages[activityType] || 'Loading activity...');

      // Create abort controller with timeout
      const controller = new AbortController();
      const timeoutDuration = getActivityTimeout(activityType);
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      // For listening activities, show initial state (real progress will come from SSE)
      let statusInterval;
      if (activityType === 'listening') {
        // Don't set paragraph count yet - SSE will provide the actual count
        // The backend initially estimates 5 paragraphs, but actual can be 3-5
        setLoadingStatus('Initializing activity generation...');
      }

      let response;
      try {
        // For conversation activities, use the /create endpoint
        const endpoint = activityType === 'conversation' 
          ? `${API_BASE_URL}/api/activity/${activityType}/${language}/create`
          : `${API_BASE_URL}/api/activity/${activityType}/${language}`;
        
        // Prepare request body if topic is provided
        const fetchOptions = {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }
        };
        
        // Add topic to request body if provided
        if (topicToUse !== null) {
          fetchOptions.body = JSON.stringify({ topic: topicToUse });
        }
        
        response = await fetch(endpoint, fetchOptions);
        clearTimeout(timeoutId);
        if (statusInterval) clearInterval(statusInterval);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (statusInterval) clearInterval(statusInterval);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout: The server took too long to respond. Please try again.');
        }
        throw new Error(`Network error: ${fetchError.message}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      const data = await response.json();

      // For listening activities, we get a session_id and need to wait for generation to complete
      if (activityType === 'listening' && data.session_id) {
        console.log('[Activity Data] Received session_id:', data.session_id);
        setSessionId(data.session_id);
        setLoadingStatus('Generating passage and questions...');
        // SSE will handle progress updates, and when complete, we'll fetch the result
        // The ListeningActivity component will handle fetching the final activity
        return;  // Don't set loading=false yet, SSE will drive that
      }

      // For non-listening activities, handle normally
      if (!data || !data.activity) {
        throw new Error('Server returned empty activity. Please try again.');
      }

      setActivity(sanitizeActivity(data.activity));
      setWordsUsed(data.words_used || []);
      
      // Store API details for debugging
      if (data.api_details || data.activity?._prompt) {
        const apiCall = createApiDetails(data, activityType, language);
        setAllApiDetails([apiCall]);
      }

      setResolvedActivityId(data.activity.id || Date.now());
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading activity:', error);
      alert(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  return {
    activity,
    setActivity,
    loading,
    setLoading,
    loadingStatus,
    setLoadingStatus,
    ttsProgress,
    setTtsProgress,
    paragraphCount,
    setParagraphCount,
    sessionId,
    wordsUsed,
    setWordsUsed,
    allApiDetails,
    setAllApiDetails,
    resolvedActivityId,
    loadActivity,
    showApiModal,
    setShowApiModal,
    topic,
    setTopic,
    // Add a new method to fetch completed activity
    fetchCompletedActivity: async (sessionId) => {
      try {
        console.log('[Activity Data] Fetching completed activity for session:', sessionId);
        const response = await fetch(`${API_BASE_URL}/api/activity/listening/result/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch completed activity: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'generating') {
          console.log('[Activity Data] Activity still generating, will retry...');
          return null;
        }
        
        if (!data || !data.activity) {
          throw new Error('Server returned empty activity');
        }
        
        console.log('[Activity Data] Completed activity received');
        setActivity(sanitizeActivity(data.activity));
        setWordsUsed(data.words_used || []);
        
        // Store API details for debugging
        if (data.api_details || data.activity?._prompt) {
          const apiCall = createApiDetails(data, 'listening', language);
          setAllApiDetails([apiCall]);
        }
        
        setResolvedActivityId(data.activity.id || Date.now());
        return data;
      } catch (error) {
        console.error('[Activity Data] Error fetching completed activity:', error);
        throw error;
      }
    }
  };
}