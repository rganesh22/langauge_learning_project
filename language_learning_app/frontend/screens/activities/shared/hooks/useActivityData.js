/**
 * Hook for loading and managing activity data
 * Handles API calls, error states, and loading states
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { fetchActivityData, getActivityTimeout, createApiDetails } from '../utils/apiHelpers';
import { sanitizeActivity } from '../utils/textProcessing';
import { API_BASE_URL } from '../constants';

export function useActivityData(
  activityType,
  language,
  activityId,
  fromHistory,
  providedActivityData,
  customTopic = null,
  /** Optional callbacks for background generation tracking */
  generationCallbacks = null,
  // generationCallbacks shape: { createJob, completeJob, failJob, updateJobStatus }
) {
  const isFocused = useIsFocused();
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

  // Track the current background job id so we can complete/fail it later
  const bgJobIdRef = useRef(null);

  const loadActivity = async (selectedTopic = null) => {
    // Update topic if provided
    if (selectedTopic !== null) {
      setTopic(selectedTopic);
    }
    const topicToUse = selectedTopic !== null ? selectedTopic : topic;

    // ── History path: load saved activity from backend by ID ──────────────
    if (fromHistory && activityId) {
      if (providedActivityData) {
        // Caller already has the data (e.g. passed through route params)
        console.log('Loading activity from history (route data) with ID:', activityId);
        setActivity(sanitizeActivity(providedActivityData));
        setResolvedActivityId(activityId);
        setLoading(false);
        return;
      }
      // Fetch the stored activity from the backend
      try {
        setLoading(true);
        setLoadingStatus('Loading saved activity...');
        const response = await fetch(`${API_BASE_URL}/api/activity/${activityId}`);
        if (!response.ok) {
          throw new Error(`Activity not found (${response.status})`);
        }
        const row = await response.json();
        // activity_data holds the full activity object
        const savedActivity = row.activity_data || row;
        setActivity(sanitizeActivity(savedActivity));
        setWordsUsed(savedActivity._words_used_data || savedActivity.words_used || []);
        
        // Populate API details from history
        if (savedActivity._prompt || savedActivity.api_details) {
          const apiData = savedActivity.api_details 
            ? { api_details: savedActivity.api_details, words_used: savedActivity.words_used || [] } 
            : { activity: savedActivity, words_used: savedActivity._words_used_data || savedActivity.words_used || [] };
          const apiCall = createApiDetails(apiData, activityType, language);
          apiCall.endpoint = `Loaded from History (ID: ${activityId})`;
          setAllApiDetails([apiCall]);
        }
        
        setResolvedActivityId(activityId);
        setLoading(false);
      } catch (error) {
        console.error('Error loading historical activity:', error);
        alert(`Could not load activity: ${error.message}`);
        setLoading(false);
      }
      return;
    }

    // ── Background generation job tracking ────────────────────────────────
    let jobId = null;
    const baseActivityType = activityType.startsWith('unified/') ? activityType.replace('unified/', '') : activityType;
    
    if (generationCallbacks?.createJob) {
      jobId = generationCallbacks.createJob(baseActivityType, language);
      bgJobIdRef.current = jobId;
    }

    try {
      setLoading(true);
      
      // Set loading status based on activity type
      const loadingMessages = {
        transliteration: 'Generating Transliteration Activity...',
        listening: 'Generating Listening Activity...',
        reading: 'Generating Reading Activity...',
        writing: 'Generating Writing Activity...',
        speaking: 'Generating Speaking Activity...',
        translation: 'Generating Translation Activity...',
      };
      setLoadingStatus(loadingMessages[baseActivityType] || 'Loading Activity...');
      if (jobId && generationCallbacks?.updateJobStatus) {
        generationCallbacks.updateJobStatus(jobId, loadingMessages[baseActivityType] || 'Loading Activity...');
      }

      // Create abort controller with timeout
      const controller = new AbortController();
      const timeoutDuration = getActivityTimeout(activityType);
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

      // For listening activities, show initial state (real progress will come from SSE)
      let statusInterval;
      if (baseActivityType === 'listening') {
        // Don't set paragraph count yet - SSE will provide the actual count
        setLoadingStatus('Initializing Activity generation...');
        if (jobId && generationCallbacks?.updateJobStatus) {
          generationCallbacks.updateJobStatus(jobId, 'Initializing Activity generation...');
        }
      }

      let response;
      try {
        const endpoint = `${API_BASE_URL}/api/activity/${activityType}/${language}`;
        
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
      if (baseActivityType === 'listening' && data.session_id) {
        console.log('[Activity Data] Received session_id:', data.session_id);
        setSessionId(data.session_id);
        setLoadingStatus('Generating passage and questions...');
        if (jobId && generationCallbacks?.updateJobStatus) {
          generationCallbacks.updateJobStatus(jobId, 'Generating passage and questions...');
        }
        // SSE will handle progress updates
        // The ListeningActivity component will handle fetching the final activity
        // NOTE: for listening, completeJob is called from notifyGenerationComplete()
        return;  // Don't set loading=false yet, SSE will drive that
      }

      // For non-listening activities, handle normally
      if (!data || !data.activity) {
        throw new Error('Server returned empty activity. Please try again.');
      }

      const sanitized = sanitizeActivity(data.activity);
      setActivity(sanitized);
      setWordsUsed(data.words_used || []);
      
      // Store API details for debugging
      if (data.api_details || data.activity?._prompt) {
        const apiCall = createApiDetails(data, activityType, language);
        setAllApiDetails([apiCall]);
      }

      const resolvedId = data.activity.id || Date.now();
      setResolvedActivityId(resolvedId);
      setLoading(false);

      // Derive a human-friendly title for the generation tray
      const derivedTitle =
        sanitized?.activity_name ||
        sanitized?.passage_name ||
        sanitized?.story_name ||
        sanitized?.title ||
        sanitized?.topic ||
        sanitized?.writing_prompt ||
        null;

      // ── Notify tray: done ──
      if (jobId && generationCallbacks?.completeJob) {
        generationCallbacks.completeJob(jobId, {
          title: derivedTitle,
          activityId: String(resolvedId),
          activityData: sanitized,
        });

        // Hide notification tray if the user is still actively watching it load
        if (isFocused && generationCallbacks?.dismissJob) {
           generationCallbacks.dismissJob(jobId);
        }
      }
      
    } catch (error) {
      console.error('Error loading activity:', error);
      setLoading(false);
      // ── Notify tray: error ──
      if (jobId && generationCallbacks?.failJob) {
        generationCallbacks.failJob(jobId, error.message);
      }
      alert(`Error: ${error.message}`);
    }
  };

  /**
   * Call this from the ListeningActivity SSE handler once the activity
   * is fully generated so the background tray card gets updated.
   */
  const notifyGenerationComplete = ({ title, activityId: aId, activityData: aData } = {}) => {
    const jobId = bgJobIdRef.current;
    if (jobId && generationCallbacks?.completeJob) {
      generationCallbacks.completeJob(jobId, {
        title: title || null,
        activityId: aId ? String(aId) : null,
        activityData: aData || null,
      });

      // Hide notification tray if the user is still actively watching it load
      if (isFocused && generationCallbacks?.dismissJob) {
         generationCallbacks.dismissJob(jobId);
      }
      bgJobIdRef.current = null;
    }
  };

  const notifyGenerationFailed = (errorMsg) => {
    const jobId = bgJobIdRef.current;
    if (jobId && generationCallbacks?.failJob) {
      generationCallbacks.failJob(jobId, errorMsg || 'Generation failed');
      bgJobIdRef.current = null;
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
    notifyGenerationComplete,
    notifyGenerationFailed,
    /** Call to update the tray status message (e.g. listening "Generating audio: 2 of 5...") */
    updateTrayStatus: (message) => {
      if (bgJobIdRef.current && generationCallbacks?.updateJobStatus) {
        generationCallbacks.updateJobStatus(bgJobIdRef.current, message);
      }
    },
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
        const sanitized = sanitizeActivity(data.activity);
        setActivity(sanitized);
        setWordsUsed(data.words_used || []);
        
        // Store API details for debugging
        if (data.api_details || data.activity?._prompt) {
          const apiCall = createApiDetails(data, 'listening', language);
          setAllApiDetails([apiCall]);
        }
        
        const resolvedId = data.activity.id || Date.now();
        setResolvedActivityId(resolvedId);
        return data;
      } catch (error) {
        console.error('[Activity Data] Error fetching completed activity:', error);
        throw error;
      }
    }
  };
}
