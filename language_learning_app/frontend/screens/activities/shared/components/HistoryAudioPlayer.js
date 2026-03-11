/**
 * HistoryAudioPlayer
 *
 * Shared audio player component used by both PlacementTestScreen and
 * UnifiedActivityRenderer. Handles web (HTMLAudioElement) and native
 * (expo-av) playback with a seek slider.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import SafeText from '../../../../components/SafeText';

export default function HistoryAudioPlayer({
  audioBase64,
  mimeType = 'audio/wav',
  color = '#3B82F6',
  label = 'Play',
}) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef(null);
  const webAudioRef = useRef(null);
  const pollRef = useRef(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (soundRef.current) { soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
    if (webAudioRef.current) { webAudioRef.current.pause(); webAudioRef.current = null; }
    setPlaying(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const fmt = (secs) => {
    const s = Math.floor(secs);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const toggle = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (webAudioRef.current && !webAudioRef.current.paused) {
        webAudioRef.current.pause();
        setPlaying(false);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }
      if (!webAudioRef.current) {
        const el = new window.Audio(`data:${mimeType};base64,${audioBase64}`);
        webAudioRef.current = el;
        el.onloadedmetadata = () => setDuration(el.duration || 0);
        el.onended = () => {
          setPlaying(false);
          setPosition(0);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        };
      }
      await webAudioRef.current.play();
      setPlaying(true);
      pollRef.current = setInterval(() => {
        const el = webAudioRef.current;
        if (!el) return;
        setPosition(el.currentTime || 0);
        setDuration(el.duration || 0);
      }, 250);
    } else {
      // Native (expo-av)
      if (soundRef.current) {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded && st.isPlaying) {
          await soundRef.current.pauseAsync();
          setPlaying(false);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }
        if (st.isLoaded && !st.isPlaying) {
          await soundRef.current.playAsync();
          setPlaying(true);
          pollRef.current = setInterval(async () => {
            const s = await soundRef.current?.getStatusAsync();
            if (s?.isLoaded) {
              setPosition((s.positionMillis || 0) / 1000);
              setDuration((s.durationMillis || 0) / 1000);
            }
          }, 250);
          return;
        }
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:${mimeType};base64,${audioBase64}` },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      const st = await sound.getStatusAsync();
      setDuration((st.durationMillis || 0) / 1000);
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded) {
          setPosition((s.positionMillis || 0) / 1000);
          setDuration((s.durationMillis || 0) / 1000);
          if (s.didJustFinish) { setPlaying(false); setPosition(0); }
        }
      });
    }
  }, [audioBase64, mimeType]);

  const seek = useCallback(async (secs) => {
    setPosition(secs);
    if (Platform.OS === 'web') {
      if (webAudioRef.current) webAudioRef.current.currentTime = secs;
    } else {
      if (soundRef.current) await soundRef.current.setPositionAsync(secs * 1000);
    }
  }, []);

  return (
    <View style={{ gap: 6, marginVertical: 8, width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity
          style={{
            backgroundColor: color,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
          onPress={toggle}
          activeOpacity={0.8}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#FFF" />
          <SafeText style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>{label}</SafeText>
        </TouchableOpacity>
        {duration > 0 && (
          <SafeText style={{ fontSize: 12, color: '#9CA3AF' }}>
            {fmt(position)} / {fmt(duration)}
          </SafeText>
        )}
      </View>
      {duration > 0 && (
        <Slider
          style={{ width: '100%', height: 32 }}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          onSlidingComplete={seek}
          minimumTrackTintColor={color}
          maximumTrackTintColor="#E5E7EB"
          thumbTintColor={color}
        />
      )}
    </View>
  );
}
