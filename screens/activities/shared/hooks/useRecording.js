import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../constants';

/**
 * Custom hook for audio recording and speech-to-text
 * Used by SpeakingActivity and ConversationActivity
 */
export function useRecording(language = 'kannada') {
  const [recording, setRecording] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState('idle'); // 'idle', 'recording', 'processing'
  const [recordingUri, setRecordingUri] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Audio playback state
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  
  const recordingRef = useRef(null);
  const durationTimerRef = useRef(null);
  const audioElementRef = useRef(null);  // For web HTML5 audio
  const playbackIntervalRef = useRef(null);  // For position updates

  const MAX_RECORDING_DURATION = 300000; // 5 minutes (300 seconds) in milliseconds

  /**
   * Start audio recording
   */
  const startRecording = async () => {
    try {
      // Request permissions
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (permissionResponse.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
        return false;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setRecordingStatus('recording');
      setRecordingDuration(0);
      recordingRef.current = newRecording;

      // Start duration timer
      const startTime = Date.now();
      durationTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setRecordingDuration(elapsed);

        // Auto-stop if max duration reached
        if (elapsed >= MAX_RECORDING_DURATION) {
          clearInterval(durationTimerRef.current);
          stopRecording();
          Alert.alert(
            'Recording Stopped',
            'Maximum recording duration (5 minutes) reached. Recording has been stopped automatically.'
          );
        }
      }, 100);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      return false;
    }
  };

  /**
   * Stop audio recording
   */
  const stopRecording = async () => {
    if (!recording && !recordingRef.current) {
      return null;
    }

    try {
      // Clear duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      setRecordingStatus('processing');
      const currentRecording = recording || recordingRef.current;
      
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      
      setRecording(null);
      recordingRef.current = null;
      setRecordingUri(uri);
      
      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
      setRecordingStatus('idle');
      setRecordingDuration(0);
      return null;
    }
  };

  /**
   * Convert audio to text using speech-to-text API
   */
  const convertAudioToText = async (audioUri, audioFormat = null) => {
    try {
      console.log('Converting audio to text...', { audioUri, audioFormat });
      
      // Read audio as base64
      let audioBase64;
      if (Platform.OS === 'web') {
        // For web, fetch the blob URL and convert to base64
        const response = await fetch(audioUri);
        const blob = await response.blob();
        audioBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            // Remove data URL prefix (e.g., "data:audio/wav;base64,")
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        // Detect format from blob type or URI
        if (!audioFormat) {
          if (blob.type.includes('webm')) {
            audioFormat = 'webm';
          } else if (blob.type.includes('wav')) {
            audioFormat = 'wav';
          } else if (blob.type.includes('flac')) {
            audioFormat = 'flac';
          }
        }
      } else {
        // For native platforms, use FileSystem
        audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Try to detect format from file extension
        if (!audioFormat && audioUri) {
          const ext = audioUri.split('.').pop().toLowerCase();
          if (['webm', 'wav', 'flac', 'm4a'].includes(ext)) {
            audioFormat = ext;
          }
        }
      }
      
      // Call speech-to-text API
      const response = await fetch(`${API_BASE_URL}/api/speech-to-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_base64: audioBase64,
          language: language || 'kannada',
          audio_format: audioFormat,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
      }
      
      const data = await response.json();
      const transcriptText = data.transcript || '';
      setTranscript(transcriptText);
      setRecordingStatus('idle');
      return transcriptText;
    } catch (error) {
      console.error('Error converting audio to text:', error);
      Alert.alert('Error', 'Failed to transcribe audio. Please try again.');
      setRecordingStatus('idle');
      return '';
    }
  };

  /**
   * Record and transcribe in one go
   */
  const recordAndTranscribe = async () => {
    const uri = await stopRecording();
    if (uri) {
      return await convertAudioToText(uri);
    }
    return '';
  };

  /**
   * Reset recording state
   */
  const resetRecording = async () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    
    // Clean up audio playback
    await unloadAudio();
    
    setRecording(null);
    setRecordingStatus('idle');
    setRecordingUri(null);
    setTranscript('');
    setRecordingDuration(0);
    recordingRef.current = null;
  };

  /**
   * Cancel recording
   */
  const cancelRecording = async () => {
    if (recording || recordingRef.current) {
      try {
        const currentRecording = recording || recordingRef.current;
        await currentRecording.stopAndUnloadAsync();
      } catch (error) {
        console.error('Error canceling recording:', error);
      }
    }
    resetRecording();
  };

  /**
   * Load audio for playback
   */
  const loadAudio = async (audioUri) => {
    try {
      // Clean up previous audio
      if (Platform.OS === 'web') {
        if (audioElementRef.current) {
          audioElementRef.current.pause();
          audioElementRef.current = null;
        }
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
          playbackIntervalRef.current = null;
        }

        // Create HTML5 audio element for web using document API
        const audio = document.createElement('audio');
        audio.src = audioUri;
        audioElementRef.current = audio;

        // Set up event listeners
        audio.onloadedmetadata = () => {
          setPlaybackDuration(audio.duration * 1000);  // Convert to ms
        };

        audio.ontimeupdate = () => {
          setPlaybackPosition(audio.currentTime * 1000);  // Convert to ms
        };

        audio.onended = () => {
          setIsPlaying(false);
          setPlaybackPosition(0);
          if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
          }
        };

        audio.onplay = () => setIsPlaying(true);
        audio.onpause = () => setIsPlaying(false);

        return audio;
      } else {
        // Native: Use expo-av
        if (sound) {
          await sound.unloadAsync();
        }

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );

        setSound(newSound);
        return newSound;
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      return null;
    }
  };

  /**
   * Playback status update callback (for native)
   */
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis);
      setPlaybackDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      // Auto-stop at end
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }
  };

  /**
   * Play/pause audio
   */
  const togglePlayback = async () => {
    if (Platform.OS === 'web') {
      const audio = audioElementRef.current;
      if (!audio) {
        if (recordingUri) {
          await loadAudio(recordingUri);
          setTimeout(() => {
            if (audioElementRef.current) {
              audioElementRef.current.play();
            }
          }, 100);
        }
        return;
      }

      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
    } else {
      // Native
      if (!sound) {
        if (recordingUri) {
          const newSound = await loadAudio(recordingUri);
          if (newSound) {
            await newSound.playAsync();
          }
        }
        return;
      }

      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    }
  };

  /**
   * Seek to position (in milliseconds)
   */
  const seekAudio = async (positionMs) => {
    if (Platform.OS === 'web') {
      const audio = audioElementRef.current;
      if (audio) {
        audio.currentTime = positionMs / 1000;  // Convert to seconds
      }
    } else {
      if (sound) {
        await sound.setPositionAsync(positionMs);
      }
    }
  };

  /**
   * Replay from beginning
   */
  const replayAudio = async () => {
    if (Platform.OS === 'web') {
      const audio = audioElementRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play();
      }
    } else {
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      }
    }
  };

  /**
   * Stop and unload audio
   */
  const unloadAudio = async () => {
    if (Platform.OS === 'web') {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      setIsPlaying(false);
      setPlaybackPosition(0);
      setPlaybackDuration(0);
    } else {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        setPlaybackPosition(0);
        setPlaybackDuration(0);
      }
    }
  };

  return {
    recording,
    recordingStatus,
    recordingUri,
    transcript,
    recordingDuration,
    // Audio playback
    isPlaying,
    playbackPosition,
    playbackDuration,
    startRecording,
    stopRecording,
    convertAudioToText,
    recordAndTranscribe,
    resetRecording,
    cancelRecording,
    // Audio playback controls
    loadAudio,
    togglePlayback,
    seekAudio,
    replayAudio,
    unloadAudio,
    isRecording: recordingStatus === 'recording',
    isProcessing: recordingStatus === 'processing',
  };
}
