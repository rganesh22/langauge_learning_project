/**
 * ActivityGenerationTray
 *
 * Floating overlay anchored to the top-right of the screen.
 * Renders one status card per generation job.
 *
 * Card anatomy (mirrors DashboardScreen historicalActivityCard):
 *   [ language icon ] [ "Generating Activity" / activity title ]  [ activity icon ]  [ × ]
 *   Gray (#F2F2F2) background, 10px border-radius.
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivityGeneration } from '../contexts/ActivityGenerationContext';
import { LANGUAGES } from '../contexts/LanguageContext';

/* ── colour / icon tables (kept in sync with Dashboard & activity screens) ── */
const ACTIVITY_COLORS = {
  transliteration: { primary: '#EC4899', light: '#FCE7F3' },
  reading:      { primary: '#4A90E2', light: '#E8F4FD' },
  listening:    { primary: '#2B654A', light: '#E8F5EF' },
  writing:      { primary: '#FF6B6B', light: '#FFE8E8' },
  speaking:     { primary: '#FF9500', light: '#FFF4E6' },
  translation:  { primary: '#8B5CF6', light: '#F3E8FF' },
};

const ACTIVITY_ICONS = {
  transliteration: 'text',
  reading:      'book',
  listening:    'headset',
  writing:      'create',
  speaking:     'mic',
  translation:  'language',
};

const ACTIVITY_LABELS = {
  transliteration: 'Transliteration',
  reading:      'Reading',
  listening:    'Listening',
  writing:      'Writing',
  speaking:     'Speaking',
  translation:  'Translation',
};

/* ── Individual animated card ── */
function GenerationCard({ job, onDismiss, onPressJob }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 18, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const { activityType, language, status, title, errorMsg, statusMessage } = job;
  const lang = LANGUAGES.find((l) => l.code === language);
  const colors = ACTIVITY_COLORS[activityType] || { primary: '#666', light: '#F5F5F5' };
  const iconName = ACTIVITY_ICONS[activityType] || 'apps';
  const typeLabel = ACTIVITY_LABELS[activityType] || activityType;

  const isGenerating = status === 'generating';
  const isDone = status === 'done';
  const isError = status === 'error';
  const canOpen = isDone && job.activityId && onPressJob;

  const statusLine = isGenerating
    ? (statusMessage || 'Generating…')
    : isError
    ? (errorMsg ? errorMsg.slice(0, 40) : 'Generation failed')
    : (title || typeLabel);

  const cardContent = (
    <Animated.View
      style={[
        styles.card,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        isError && styles.cardError,
        isDone && styles.cardDone,
      ]}
    >
      {/* Language icon */}
      <View style={[styles.langIcon, { backgroundColor: lang?.color || '#888' }]}>
        {lang?.nativeChar ? (
          <Text
            style={[
              styles.langIconChar,
              language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' },
            ]}
          >
            {lang.nativeChar}
          </Text>
        ) : (
          <Text style={styles.langIconCode}>
            {lang?.langCode?.toUpperCase() || language?.slice(0, 2).toUpperCase() || '??'}
          </Text>
        )}
      </View>

      {/* Text column: first line = activity type with icon, second line = status or activity name */}
      <View style={styles.infoCol}>
        <View style={styles.typeRow}>
          <Ionicons name={iconName} size={16} color={colors.primary} style={styles.typeIcon} />
          <Text style={styles.typeLabel} numberOfLines={1}>
            {isDone && title ? title : typeLabel}
          </Text>
        </View>
        <Text
          style={[
            styles.statusLine,
            isError && styles.statusLineError,
            isDone && styles.statusLineDone,
          ]}
          numberOfLines={2}
        >
          {isDone && title ? typeLabel : statusLine}
        </Text>
      </View>

      {/* Activity icon / spinner: always show icon; when generating show spinner next to it */}
      <View style={[styles.activityIconCircle, { backgroundColor: colors.light }]}>
        {isGenerating ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name={isError ? 'warning-outline' : iconName}
            size={20}
            color={isError ? '#EF4444' : colors.primary}
          />
        )}
      </View>

      {/* Dismiss button — always show so user can close even while generating */}
      <TouchableOpacity style={styles.dismissBtn} onPress={() => onDismiss(job.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={14} color="#888" />
      </TouchableOpacity>
    </Animated.View>
  );

  if (canOpen) {
    return (
      <TouchableOpacity onPress={() => onPressJob(job)} activeOpacity={0.85}>
        {cardContent}
      </TouchableOpacity>
    );
  }
  return cardContent;
}

/* ── Tray (collection of cards) ── */
export default function ActivityGenerationTray({ onPressJob }) {
  const { jobs, dismissJob } = useActivityGeneration();
  const insets = useSafeAreaInsets();

  if (jobs.length === 0) return null;

  return (
    <View
      style={[
        styles.tray,
        { top: insets.top + 8 },
      ]}
      pointerEvents="box-none"
    >
      {jobs.map((job) => (
        <GenerationCard key={job.id} job={job} onDismiss={dismissJob} onPressJob={onPressJob} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    right: 12,
    zIndex: 9999,
    elevation: 20,
    alignItems: 'flex-end',
    gap: 8,
    // Keep pointer events alive so cards can be tapped
    pointerEvents: 'box-none',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    maxWidth: 260,
    minWidth: 200,
    // Subtle shadow
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  cardError: {
    backgroundColor: '#FFF1F1',
  },
  cardDone: {
    backgroundColor: '#F0FDF4',
  },
  langIcon: {
    width: 32,
    height: 32,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langIconChar: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
  langIconCode: {
    fontSize: 9,
    color: '#FFF',
    fontWeight: 'bold',
  },
  infoCol: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  typeIcon: {
    marginRight: 4,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 1,
  },
  statusLine: {
    fontSize: 11,
    color: '#666',
  },
  statusLineError: {
    color: '#EF4444',
  },
  statusLineDone: {
    color: '#16A34A',
    fontWeight: '500',
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtn: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
