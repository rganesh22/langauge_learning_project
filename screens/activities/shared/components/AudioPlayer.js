import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../../../components/SafeText';

/**
 * AudioPlayer - Traditional audio player interface with full controls
 * 
 * Features:
 * - Play/Pause button
 * - Seek bar (draggable slider)
 * - Time display (current / total)
 * - Replay button (restart audio)
 * - Volume control
 * - Speed control (optional)
 */
export const AudioPlayer = ({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onReplay,
  volume = 1.0,
  onVolumeChange,
  playbackSpeed = 1.0,
  onSpeedChange,
  primaryColor = '#4A90E2',
  showSpeedControl = false,
  showVolumeControl = true,
  paragraphLabel = null,
  language = null,  // Add language prop for Urdu font handling
}) => {
  // Format time in MM:SS
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === null || seconds === undefined) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) : 0;

  // Speed options
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  return (
    <View style={styles.container}>
      {/* Paragraph Label */}
      {paragraphLabel && (
        <SafeText style={styles.paragraphLabel}>{paragraphLabel}</SafeText>
      )}

      {/* Main Controls Row */}
      <View style={styles.mainControlsRow}>
        {/* Replay Button */}
        <TouchableOpacity
          style={[styles.controlButton, styles.replayButton]}
          onPress={onReplay}
        >
          <Ionicons name="reload" size={22} color={primaryColor} />
        </TouchableOpacity>

        {/* Play/Pause Button (Larger, centered) */}
        <TouchableOpacity
          style={[styles.playPauseButton, { backgroundColor: primaryColor }]}
          onPress={onPlayPause}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={32}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {/* Speed Control */}
        {showSpeedControl && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowSpeedMenu(!showSpeedMenu)}
          >
            <Text style={[styles.speedText, { color: primaryColor }]}>
              {playbackSpeed}x
            </Text>
          </TouchableOpacity>
        )}

        {/* Volume Control */}
        {showVolumeControl && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowVolumeSlider(!showVolumeSlider)}
          >
            <Ionicons
              name={volume === 0 ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high"}
              size={24}
              color={primaryColor}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Seek Bar */}
      <View style={styles.seekBarContainer}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <Slider
          style={styles.seekBar}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          value={currentTime}
          onSlidingComplete={onSeek}
          minimumTrackTintColor={primaryColor}
          maximumTrackTintColor="#D3D3D3"
          thumbTintColor={primaryColor}
        />
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      {/* Volume Slider (Expandable) */}
      {showVolumeControl && showVolumeSlider && (
        <View style={styles.volumeSliderContainer}>
          <Ionicons name="volume-low" size={18} color="#666" />
          <Slider
            style={styles.volumeSlider}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={onVolumeChange}
            minimumTrackTintColor={primaryColor}
            maximumTrackTintColor="#D3D3D3"
            thumbTintColor={primaryColor}
          />
          <Ionicons name="volume-high" size={18} color="#666" />
        </View>
      )}

      {/* Speed Menu (Expandable) */}
      {showSpeedControl && showSpeedMenu && (
        <View style={styles.speedMenuContainer}>
          {speedOptions.map((speed) => (
            <TouchableOpacity
              key={speed}
              style={[
                styles.speedOption,
                playbackSpeed === speed && { backgroundColor: primaryColor + '20' },
              ]}
              onPress={() => {
                onSpeedChange(speed);
                setShowSpeedMenu(false);
              }}
            >
              <Text
                style={[
                  styles.speedOptionText,
                  playbackSpeed === speed && { color: primaryColor, fontWeight: '600' },
                ]}
              >
                {speed}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paragraphLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  mainControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  replayButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  speedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  seekBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  seekBar: {
    flex: 1,
    marginHorizontal: 10,
    height: 40,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  volumeSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  volumeSlider: {
    flex: 1,
    marginHorizontal: 12,
    height: 30,
  },
  speedMenuContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
  },
  speedOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    margin: 4,
  },
  speedOptionText: {
    fontSize: 14,
    color: '#666',
  },
});
