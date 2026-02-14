/**
 * Hook for tracking TTS generation progress via Server-Sent Events (SSE)
 */
import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../constants';

export function useTTSProgress(sessionId) {
  const [progress, setProgress] = useState({});
  const [paragraphCount, setParagraphCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const eventSourceRef = useRef(null);

  console.log('[TTS Progress Hook] Render - sessionId:', sessionId, 'type:', typeof sessionId);

  useEffect(() => {
    console.log('[TTS Progress Hook] useEffect triggered - sessionId:', sessionId, 'type:', typeof sessionId);
    
    if (!sessionId) {
      console.log('[TTS Progress] No session ID, skipping SSE connection');
      return;
    }

    console.log(`[TTS Progress] ============================================`);
    console.log(`[TTS Progress] Connecting to SSE for session: ${sessionId}`);
    console.log(`[TTS Progress] URL: ${API_BASE_URL}/api/activity/listening/progress/${sessionId}`);
    console.log(`[TTS Progress] ============================================`);

    // Create EventSource for SSE
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/activity/listening/progress/${sessionId}`
    );

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[TTS Progress] ✅ SSE connection opened successfully');
    };

    eventSource.onmessage = (event) => {
      try {
        console.log('[TTS Progress] 📩 Raw event data:', event.data);
        const data = JSON.parse(event.data);
        console.log('[TTS Progress] 📦 Parsed data:', JSON.stringify(data, null, 2));

        if (data.error) {
          console.error('[TTS Progress] ❌ Error:', data.error);
          eventSource.close();
          return;
        }

        if (data.type === 'init') {
          // Initial progress state
          console.log('[TTS Progress] 🎬 INIT - Setting initial state:', {
            progress: data.progress,
            paragraphCount: data.total_paragraphs
          });
          setProgress(data.progress || {});
          setParagraphCount(data.total_paragraphs || 0);
        } else if (data.type === 'update_count') {
          // Paragraph count updated (actual vs initial estimate)
          console.log('[TTS Progress] 🔢 UPDATE_COUNT - Updating paragraph count to:', data.total_paragraphs);
          setParagraphCount(data.total_paragraphs || 0);
          setProgress(data.progress || {});
        } else if (data.type === 'complete') {
          // All paragraphs complete
          console.log('[TTS Progress] ✅ COMPLETE - All TTS generation finished!');
          setIsComplete(true);
          eventSource.close();
        } else if (data.paragraph_index !== undefined) {
          // Progress update for a specific paragraph
          console.log('[TTS Progress] 🔄 UPDATE - Paragraph', data.paragraph_index, 'status:', data.status);
          setProgress(data.progress || {});
        }
      } catch (error) {
        console.error('[TTS Progress] ❌ Parse error:', error, 'Raw data:', event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[TTS Progress] ❌ SSE error:', error);
      console.error('[TTS Progress] EventSource readyState:', eventSource.readyState);
      console.error('[TTS Progress] EventSource url:', eventSource.url);
      eventSource.close();
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log('[TTS Progress] 🔌 Closing SSE connection');
        eventSourceRef.current.close();
      }
    };
  }, [sessionId]);

  return {
    progress,
    paragraphCount,
    isComplete,
  };
}
