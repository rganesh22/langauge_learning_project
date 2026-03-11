/**
 * API helper utilities for activity screens
 */
import { API_BASE_URL } from '../constants';

/**
 * Fetch activity data from the API
 */
export const fetchActivityData = async (activityType, language, signal) => {
  const response = await fetch(
    `${API_BASE_URL}/api/activity/${activityType}/${language}`,
    { 
      method: 'POST',
      signal
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
  }

  const data = await response.json();
  
  if (!data || !data.activity) {
    throw new Error('Server returned empty activity. Please try again.');
  }

  return data;
};

/**
 * Submit activity results
 */
export const submitActivity = async (activityType, activityId, results) => {
  const response = await fetch(`${API_BASE_URL}/api/activity/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      activity_type: activityType,
      activity_id: activityId,
      ...results
    })
  });

  if (!response.ok) {
    throw new Error('Failed to submit activity');
  }

  return await response.json();
};

/**
 * Search dictionary
 */
export const searchDictionary = async (language, searchTerm, filters = {}) => {
  const params = new URLSearchParams();
  if (searchTerm?.trim()) {
    params.append('search', searchTerm.trim());
  }
  
  // Add filters
  if (filters.mastery && filters.mastery.length > 0) {
    filters.mastery.forEach(f => params.append('mastery_filter', f));
  }
  if (filters.wordClass && filters.wordClass.length > 0) {
    filters.wordClass.forEach(f => params.append('word_class_filter', f));
  }
  if (filters.level && filters.level.length > 0) {
    filters.level.forEach(f => params.append('level_filter', f));
  }
  
  params.append('limit', '100');

  const response = await fetch(`${API_BASE_URL}/api/vocabulary/${language}?${params.toString()}`);
  const data = await response.json();
  
  return data.words || [];
};

/**
 * Get timeout duration based on activity type
 */
export const getActivityTimeout = (activityType) => {
  const timeouts = {
    reading: 120000,   // 2 minutes
    listening: 300000, // 5 minutes (TTS generation can be slow)
    speaking: 60000,   // 1 minute
    writing: 60000,    // 1 minute
    conversation: 60000, // 1 minute
    transliteration: 60000, // 1 minute
  };
  
  return timeouts[activityType] || 60000;
};

/**
 * Create API details object for debugging.
 * For listening/unified flow, prompt and raw_response come from api_details or from activity._prompt / activity._raw_response.
 */
export const createApiDetails = (data, activityType, language) => {
  const activity = data.activity || data;
  const apiDetails = data.api_details || {};
  const prompt = (apiDetails.prompt != null && apiDetails.prompt !== '')
    ? apiDetails.prompt
    : (activity._prompt != null && activity._prompt !== '')
      ? activity._prompt
      : (data._prompt != null && data._prompt !== '')
        ? data._prompt
        : '';
  const rawResponse = (apiDetails.raw_response != null && apiDetails.raw_response !== '')
    ? apiDetails.raw_response
    : (activity._raw_response != null && activity._raw_response !== '')
      ? activity._raw_response
      : (data._raw_response != null && data._raw_response !== '')
        ? data._raw_response
        : '';
  return {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    endpoint: apiDetails.endpoint || `POST /api/activity/${activityType}/${language}`,
    prompt,
    wordsUsed: apiDetails.words || data.words_used?.map(w => w.word || w) || [],
    responseTime: apiDetails.response_time ?? activity._response_time ?? data._response_time ?? 0,
    rawResponse,
    learnedWords: apiDetails.learned_words || [],
    learningWords: apiDetails.learning_words || [],
    tokenInfo: apiDetails.token_info ?? activity._token_info ?? data._token_info ?? null,
    model: apiDetails.model ?? activity._model ?? data._model ?? 'Unknown',
    parseError: apiDetails.parse_error ?? null,
    error: apiDetails.error ?? null,
    errorType: apiDetails.error_type ?? null,
    warning: apiDetails.warning ?? null,
    errorTraceback: apiDetails.error_traceback ?? null,
    ttsCost: apiDetails.tts_cost ?? null,
    ttsResponseTime: apiDetails.tts_response_time ?? null,
    totalCost: apiDetails.total_cost ?? null,
    voiceUsed: apiDetails.voice_used ?? null,
    ttsError: apiDetails.tts_error ?? apiDetails._tts_error ?? null,
    ttsStatus: apiDetails.tts_status ?? null,
    ttsErrors: apiDetails.tts_errors ?? apiDetails._tts_errors ?? null,
    ttsResults: apiDetails.tts_results ?? apiDetails._tts_results ?? null,
    debugSteps: apiDetails.debug_steps ?? null,
  };
};
