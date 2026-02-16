/**
 * Hook for completing activities and saving results to backend
 * Handles score submission, word updates, and activity data persistence
 */

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

export function useActivityCompletion(language, activityType) {
  const complete = async ({ score, wordUpdates, activityData, activityId }) => {
    try {
      console.log(`[Activity Completion] Submitting ${activityType} with score: ${Math.round(score * 100)}%`);
      
      const response = await fetch(`${API_BASE_URL}/api/activity/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          activity_type: activityType,
          score,
          word_updates: wordUpdates || [],
          activity_data: activityData,
          activity_id: activityId || null
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Activity Completion] Failed: ${response.status}`, errorText);
        throw new Error(`Failed to complete activity: ${response.status}`);
      }
      
      console.log(`✓ Activity ${activityType} completed and saved with score ${Math.round(score * 100)}%`);
      return true;
    } catch (error) {
      console.error('[Activity Completion] Error:', error);
      // Don't throw - allow UI to continue showing results even if save fails
      return false;
    }
  };
  
  return { complete };
}
