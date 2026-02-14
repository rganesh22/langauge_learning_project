/**
 * Hook for managing audio playback in listening and speaking activities
 * Handles audio loading, playback controls, position tracking
 */
import { useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export function useAudio() {
  const [audioSounds, setAudioSounds] = useState({});
  const [audioStatus, setAudioStatus] = useState({});
  const [playingParagraph, setPlayingParagraph] = useState(null);
  const [audioPosition, setAudioPosition] = useState({});
  const [audioDuration, setAudioDuration] = useState({});
  
  const audioSoundsRef = useRef({});
  const positionUpdateIntervalRef = useRef({});
  const isCleaningUpRef = useRef(false);

  // Load audio for a paragraph
  const loadAudio = async (paragraphIndex, audioData) => {
    // Validate audioData
    if (!audioData || typeof audioData !== 'string' || audioData.length === 0) {
      console.warn(`[Audio] Invalid audio data for paragraph ${paragraphIndex}`, {
        hasData: !!audioData,
        type: typeof audioData,
        length: audioData?.length || 0
      });
      return;
    }

    // Validate it's actual base64 data (should be at least a few KB for audio)
    if (audioData.length < 1000) {
      console.warn(`[Audio] Audio data too short for paragraph ${paragraphIndex}: ${audioData.length} chars`);
      return;
    }

    // Skip if already loaded
    if (audioSoundsRef.current[paragraphIndex]) {
      console.log(`[Audio] Paragraph ${paragraphIndex} already loaded, skipping`);
      return;
    }

    try {
      // For web, use HTML5 Audio instead of expo-av
      if (Platform.OS === 'web') {
        const audio = new window.Audio();
        
        // Add event listeners before setting src
        audio.addEventListener('loadedmetadata', () => {
          setAudioDuration(prev => ({ ...prev, [paragraphIndex]: audio.duration * 1000 }));
        });
        audio.addEventListener('timeupdate', () => {
          setAudioPosition(prev => ({ ...prev, [paragraphIndex]: audio.currentTime * 1000 }));
        });
        audio.addEventListener('ended', () => {
          setPlayingParagraph(null);
        });
        audio.addEventListener('error', (e) => {
          // Skip error logging if we're in cleanup phase
          if (isCleaningUpRef.current) {
            return;
          }
          
          // Get detailed error information
          const mediaError = audio.error;
          let errorMsg = 'Unknown audio error';
          if (mediaError) {
            switch(mediaError.code) {
              case 1: errorMsg = 'MEDIA_ERR_ABORTED: Audio loading aborted'; break;
              case 2: errorMsg = 'MEDIA_ERR_NETWORK: Network error while loading audio'; break;
              case 3: errorMsg = 'MEDIA_ERR_DECODE: Audio decoding failed - invalid format'; break;
              case 4: errorMsg = 'MEDIA_ERR_SRC_NOT_SUPPORTED: Audio format not supported'; break;
            }
          }
          console.error(`Audio error for paragraph ${paragraphIndex}:`, errorMsg, mediaError);
          console.log('Audio src:', audio.src?.substring(0, 100) || 'empty');
          console.log('Audio data length:', audioData?.length || 0);
        });
        
        // Double-check audioData before setting src
        if (!audioData || audioData.length < 1000) {
          console.error(`[Audio] Cannot set audio src - invalid data at assignment time`);
          return;
        }
        
        // Set the source - ensure proper base64 data URI
        audio.src = `data:audio/wav;base64,${audioData}`;
        
        // Verify src was set correctly
        if (!audio.src || audio.src === 'http://localhost:8082/' || audio.src.length < 100) {
          console.error(`[Audio] Audio src was not set correctly for paragraph ${paragraphIndex}:`, audio.src);
          return;
        }
        
        // Preload the audio
        audio.load();
        
        audioSoundsRef.current[paragraphIndex] = audio;
        setAudioSounds(prev => ({ ...prev, [paragraphIndex]: audio }));
      } else {
        // Native mobile - use expo-av
        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/wav;base64,${audioData}` },
          { shouldPlay: false },
          (status) => onPlaybackStatusUpdate(paragraphIndex, status)
        );
        
        audioSoundsRef.current[paragraphIndex] = sound;
        setAudioSounds(prev => ({ ...prev, [paragraphIndex]: sound }));
        
        // Get duration
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
          setAudioDuration(prev => ({ ...prev, [paragraphIndex]: status.durationMillis }));
        }
      }
    } catch (error) {
      console.error(`Error loading audio for paragraph ${paragraphIndex}:`, error);
    }
  };

  // Playback status update callback
  const onPlaybackStatusUpdate = (paragraphIndex, status) => {
    setAudioStatus(prev => ({ ...prev, [paragraphIndex]: status }));
    
    if (status.isLoaded) {
      setAudioPosition(prev => ({ ...prev, [paragraphIndex]: status.positionMillis || 0 }));
      setAudioDuration(prev => ({ ...prev, [paragraphIndex]: status.durationMillis || 0 }));
      
      if (status.didJustFinish) {
        setPlayingParagraph(null);
      }
    }
  };

  // Play audio for a paragraph
  const playAudio = async (paragraphIndex) => {
    try {
      const sound = audioSoundsRef.current[paragraphIndex];
      if (!sound) return;

      // Stop other paragraphs
      Object.keys(audioSoundsRef.current).forEach(async (key) => {
        if (parseInt(key) !== paragraphIndex) {
          try {
            if (Platform.OS === 'web') {
              audioSoundsRef.current[key].pause();
            } else {
              await audioSoundsRef.current[key].stopAsync();
            }
          } catch (e) {
            console.warn('Error stopping audio:', e);
          }
        }
      });

      if (Platform.OS === 'web') {
        // Web HTML5 Audio
        if (sound.paused) {
          await sound.play();
          setPlayingParagraph(paragraphIndex);
        } else {
          sound.pause();
          setPlayingParagraph(null);
        }
      } else {
        // Native expo-av
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.pauseAsync();
            setPlayingParagraph(null);
          } else {
            await sound.playAsync();
            setPlayingParagraph(paragraphIndex);
          }
        }
      }
    } catch (error) {
      console.error(`Error playing audio for paragraph ${paragraphIndex}:`, error);
    }
  };

  // Pause audio
  const pauseAudio = async (paragraphIndex) => {
    try {
      const sound = audioSoundsRef.current[paragraphIndex];
      if (sound) {
        if (Platform.OS === 'web') {
          sound.pause();
        } else {
          await sound.pauseAsync();
        }
        setPlayingParagraph(null);
      }
    } catch (error) {
      console.error('Error pausing audio:', error);
    }
  };

  // Stop all audio
  const stopAllAudio = async () => {
    try {
      for (const key of Object.keys(audioSoundsRef.current)) {
        const sound = audioSoundsRef.current[key];
        if (sound) {
          if (Platform.OS === 'web') {
            sound.pause();
            sound.currentTime = 0;
          } else {
            await sound.stopAsync();
          }
        }
      }
      setPlayingParagraph(null);
    } catch (error) {
      console.error('Error stopping all audio:', error);
    }
  };

  // Seek to position (accepts time in seconds)
  const seekAudio = async (paragraphIndex, positionSeconds) => {
    try {
      const sound = audioSoundsRef.current[paragraphIndex];
      if (sound) {
        const positionMillis = positionSeconds * 1000;
        if (Platform.OS === 'web') {
          sound.currentTime = positionSeconds;
        } else {
          await sound.setPositionAsync(positionMillis);
        }
        setAudioPosition(prev => ({ ...prev, [paragraphIndex]: positionMillis }));
      }
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[Audio] Cleaning up audio on unmount');
      isCleaningUpRef.current = true;
      
      Object.values(audioSoundsRef.current).forEach(async (sound) => {
        try {
          if (Platform.OS === 'web') {
            // Remove all event listeners before cleaning up to prevent error events
            const newAudio = sound.cloneNode();
            sound.replaceWith(newAudio);
            sound.pause();
            sound.src = '';
            sound.load(); // Reset to empty state
          } else {
            await sound.unloadAsync();
          }
        } catch (e) {
          console.warn('Error unloading audio:', e);
        }
      });
      // Clear the ref
      audioSoundsRef.current = {};
    };
  }, []);

  return {
    audioSounds,
    audioStatus,
    playingParagraph,
    audioPosition,
    audioDuration,
    loadAudio,
    playAudio,
    pauseAudio,
    stopAllAudio,
    seekAudio,
  };
}
