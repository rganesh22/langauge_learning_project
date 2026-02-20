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
    conversation: 60000 // 1 minute
  };
  
  return timeouts[activityType] || 60000;
};

/**
 * Create API details object for debugging
 */
export const createApiDetails = (data, activityType, language) => {
  return {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    endpoint: data.api_details?.endpoint || `POST /api/activity/${activityType}/${language}`,
    prompt: data.api_details?.prompt || data.activity?._prompt || '',
    wordsUsed: data.api_details?.words || data.words_used?.map(w => w.word || w) || [],
    responseTime: data.api_details?.response_time || 0,
    rawResponse: data.api_details?.raw_response || '',
    learnedWords: data.api_details?.learned_words || [],
    learningWords: data.api_details?.learning_words || [],
    tokenInfo: data.api_details?.token_info || null,
    parseError: data.api_details?.parse_error || null,
    ttsCost: data.api_details?.tts_cost || null,
    ttsResponseTime: data.api_details?.tts_response_time || null,
    totalCost: data.api_details?.total_cost || null,
    voiceUsed: data.api_details?.voice_used || null,
    ttsErrors: data.api_details?.tts_errors || null,
    debugSteps: data.api_details?.debug_steps || null,
  };
};
