import { useState } from 'react';
import { API_BASE_URL } from '../constants';

/**
 * Custom hook for conversation activities
 * Handles message history, AI responses, and task tracking
 */
export function useConversation(language = 'kannada') {
  const [conversationMessages, setConversationMessages] = useState([]);
  const [conversationStarted, setConversationStarted] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversationVoice, setConversationVoice] = useState(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [tasksCompleted, setTasksCompleted] = useState(new Set());
  const [loadingStage, setLoadingStage] = useState(''); // 'generating_text', 'generating_audio'

  /**
   * Load existing conversation from history
   */
  const loadConversation = (messages, id, voice) => {
    if (messages && messages.length > 0) {
      setConversationMessages(messages);
      setConversationStarted(true);
      setConversationId(id || null);
      setConversationVoice(voice || null);
    }
  };

  /**
   * Start conversation (AI sends first message)
   */
  const startConversation = async () => {
    setConversationStarted(true);
    setMessageLoading(true);
    setLoadingStage('generating_text');

    // Add loading indicator
    const tempMessage = {
      user_message: null,
      ai_response: null,
      _loading: true,
      timestamp: new Date().toISOString(),
    };
    setConversationMessages([tempMessage]);

    try {
      const requestBody = { message: '' }; // Empty to trigger AI's first message
      if (conversationId) {
        requestBody.conversation_id = String(conversationId);
      }
      if (conversationVoice) {
        requestBody.voice = String(conversationVoice);
      }

      setLoadingStage('generating_audio');
      const response = await fetch(
        `${API_BASE_URL}/api/activity/conversation/${language}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.response) {
          const initialMessage = {
            user_message: null,
            ai_response: data.response,
            audio_data: data.audio_data || null,
            timestamp: new Date().toISOString(),
          };

          // Set conversation ID if provided
          if (data.conversation_id) {
            setConversationId(data.conversation_id);
          }
          if (data.voice) {
            setConversationVoice(data.voice);
          }

          setConversationMessages([initialMessage]);
          return initialMessage;
        }
      } else {
        throw new Error('Failed to start conversation');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      setConversationMessages([]);
      alert('Failed to start conversation. Please try again.');
    } finally {
      setMessageLoading(false);
      setLoadingStage('');
    }
  };

  /**
   * Send user message and get AI response
   */
  const sendMessage = async (userMessage) => {
    if (!userMessage || !userMessage.trim()) {
      return;
    }

    setMessageLoading(true);
    setLoadingStage('generating_text');

    // Add user message with loading indicator for AI response
    const tempMessage = {
      user_message: userMessage,
      ai_response: null,
      _loading: true,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...conversationMessages, tempMessage];
    setConversationMessages(updatedMessages);

    try {
      const requestBody = { message: userMessage };
      if (conversationId) {
        requestBody.conversation_id = String(conversationId);
      }
      if (conversationVoice) {
        requestBody.voice = String(conversationVoice);
      }

      setLoadingStage('generating_audio');
      const response = await fetch(
        `${API_BASE_URL}/api/activity/conversation/${language}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update message with AI response
        const finalMessage = {
          user_message: userMessage,
          ai_response: data.response || '',
          audio_data: data.audio_data || null,
          timestamp: new Date().toISOString(),
        };

        // Update conversation ID and voice
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
        }
        if (data.voice) {
          setConversationVoice(data.voice);
        }

        const finalMessages = [
          ...conversationMessages,
          finalMessage,
        ];
        setConversationMessages(finalMessages);
        return finalMessage;
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove loading message on error
      setConversationMessages(prev => prev.filter(m => !m._loading));
      alert('Failed to send message. Please try again.');
    } finally {
      setMessageLoading(false);
      setLoadingStage('');
    }
  };

  /**
   * Reset conversation
   */
  const resetConversation = () => {
    setConversationMessages([]);
    setConversationStarted(false);
    setConversationId(null);
    setConversationVoice(null);
    setMessageLoading(false);
    setTasksCompleted(new Set());
    setLoadingStage('');
  };

  /**
   * Toggle task completion
   */
  const toggleTaskCompletion = (taskIndex) => {
    const newCompleted = new Set(tasksCompleted);
    if (newCompleted.has(taskIndex)) {
      newCompleted.delete(taskIndex);
    } else {
      newCompleted.add(taskIndex);
    }
    setTasksCompleted(newCompleted);
  };

  return {
    conversationMessages,
    conversationStarted,
    conversationId,
    conversationVoice,
    messageLoading,
    loadingStage,
    tasksCompleted,
    loadConversation,
    startConversation,
    sendMessage,
    resetConversation,
    toggleTaskCompletion,
    setConversationMessages,
    setConversationStarted,
    setConversationId,
    setConversationVoice,
  };
}
