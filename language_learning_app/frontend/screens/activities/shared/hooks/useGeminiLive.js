import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants';

/**
 * Custom hook for managing Gemini 2.5 Live WebSocket connection
 * Handles bidirectional audio streaming in real-time
 * Uses Web Audio API for web platform, will use expo-av for mobile
 */
export const useGeminiLive = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [aiStatus, setAiStatus] = useState('idle');
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const audioChunksRef = useRef([]);
  
  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(async (config) => {
    try {
      setConnectionStatus('connecting');
      setError(null);
      
      // Convert HTTP URL to WebSocket URL
      const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
      const fullWsUrl = `${wsUrl}/ws/conversation/live`;
      
      console.log('Connecting to WebSocket:', fullWsUrl);
      
      // Create WebSocket connection
      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;
      
      // Setup WebSocket event handlers
      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        setIsConnected(true);
        
        // Send session configuration
        ws.send(JSON.stringify({
          type: 'start_session',
          config: config
        }));
      };
      
      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message:', message.type);
          
          switch (message.type) {
            case 'setup_complete':
              console.log('Session setup complete');
              setAiStatus('listening');
              break;
              
            case 'status':
              console.log('AI status:', message.status);
              setAiStatus(message.status);
              break;
              
            case 'audio_chunk':
              // Queue audio chunk for playback
              if (message.data) {
                audioQueueRef.current.push(message.data);
                playNextAudioChunk();
              }
              break;
              
            case 'response_complete':
              console.log('Response complete:', message.text);
              setAiStatus('listening');
              break;
              
            case 'error':
              console.error('WebSocket error:', message.message);
              setError(message.message);
              setAiStatus('idle');
              break;
              
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        setError('Connection error occurred');
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed');
        setConnectionStatus('disconnected');
        setIsConnected(false);
        setAiStatus('idle');
        cleanup();
      };
      
    } catch (err) {
      console.error('Error connecting to WebSocket:', err);
      setConnectionStatus('error');
      setError('Failed to connect');
    }
  }, []);
  
  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }));
      wsRef.current.close();
    }
    cleanup();
  }, []);
  
  /**
   * Start recording audio and streaming to server
   */
  const startRecording = useCallback(async () => {
    try {
      console.log('Starting recording...');
      
      if (Platform.OS === 'web') {
        // Web Audio API implementation
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevices API not supported in this browser');
        }

        // Get microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 16000,
          } 
        });
        audioStreamRef.current = stream;

        // Create MediaRecorder for capturing audio
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        // Handle data available event (fires periodically)
        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            
            // Convert blob to base64 and send
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result.split(',')[1]; // Remove data URL prefix
              
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'audio_chunk',
                  data: base64Audio,
                }));
              }
            };
            reader.readAsDataURL(event.data);
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event);
          setError('Recording error occurred');
        };

        // Start recording with timeslice for real-time chunks
        mediaRecorder.start(1000); // Get data every 1 second
        
        setIsRecording(true);
        setIsStreaming(true);
        console.log('Web recording started');
        
      } else {
        // Mobile implementation (expo-av) - future enhancement
        throw new Error('Mobile recording not yet implemented. Please test on web.');
      }
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Failed to start recording');
    }
  }, []);
  
  /**
   * Stop recording audio
   */
  const stopRecording = useCallback(async () => {
    try {
      console.log('Stopping recording...');
      
      if (Platform.OS === 'web') {
        // Stop MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          
          // Wait for final data
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Send final chunk if any
          if (audioChunksRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
            const finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64Audio = reader.result.split(',')[1];
              wsRef.current.send(JSON.stringify({
                type: 'audio_chunk',
                data: base64Audio,
                is_final: true,
              }));
            };
            reader.readAsDataURL(finalBlob);
          }
        }
        
        // Stop audio stream
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
        
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        
      } else {
        // Mobile implementation - future
        throw new Error('Mobile recording not yet implemented');
      }
      
      setIsRecording(false);
      setIsStreaming(false);
      console.log('Recording stopped');
      
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError(err.message || 'Failed to stop recording');
    }
  }, []);
  
  /**
   * Send text message to server
   */
  const sendText = useCallback((text) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text_message',
        text: text,
      }));
      setAiStatus('thinking');
    }
  }, []);
  
  /**
   * Play next audio chunk from queue
   */
  const playNextAudioChunk = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }
    
    try {
      isPlayingRef.current = true;
      const base64Audio = audioQueueRef.current.shift();
      
      if (Platform.OS === 'web') {
        // Web Audio API playback
        // Convert base64 to ArrayBuffer
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create audio element for playback
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          isPlayingRef.current = false;
          URL.revokeObjectURL(audioUrl);
          // Play next chunk
          playNextAudioChunk();
        };
        
        audio.onerror = (e) => {
          console.error('Error playing audio:', e);
          isPlayingRef.current = false;
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
        
      } else {
        // Mobile playback - future implementation
        console.log('Mobile audio playback not yet implemented');
        isPlayingRef.current = false;
      }
      
    } catch (err) {
      console.error('Error playing audio chunk:', err);
      isPlayingRef.current = false;
    }
  }, []);
  
  /**
   * Cleanup resources
   */
  const cleanup = useCallback(async () => {
    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping media recorder:', err);
      }
    }
    
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Error stopping audio stream:', err);
      }
      audioStreamRef.current = null;
    }
    
    // Clear refs
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    
    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    setIsRecording(false);
    setIsStreaming(false);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return {
    // Connection state
    isConnected,
    connectionStatus,
    error,
    
    // AI state
    aiStatus,
    isRecording,
    isStreaming,
    
    // Connection methods
    connect,
    disconnect,
    
    // Audio methods
    startRecording,
    stopRecording,
    sendText,
  };
};

export default useGeminiLive;
