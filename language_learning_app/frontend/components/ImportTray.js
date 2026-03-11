/**
 * ImportTray
 *
 * Floating overlay (same style as TranslationTray). One card per background
 * import (extract) job. Tapping a card opens the import modal at the review step.
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
import { useImportJob } from '../contexts/ImportJobContext';

const CARD_COLOR = '#F2F2F2';
const CARD_DONE = '#F0FDF4';
const CARD_ERROR = '#FFF1F1';
const TYPE_COLOR = '#0EA5E9';
const TYPE_LIGHT = '#E0F2FE';

function ImportJobCard({ job, onDismiss, onPress }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, speed: 18, bounciness: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const { status, errorMsg, statusMessage, extractDurationSeconds, importResult } = job;
  const isExtracting = status === 'extracting';
  const isCommitting = status === 'committing';
  const isReview = status === 'review';
  const isDone = status === 'done';
  const isError = status === 'error';

  let statusLine = statusMessage || 'Import';
  if (isReview) statusLine = 'Review words';
  else if (isCommitting) statusLine = statusMessage || 'Importing words…';
  else if (isDone) statusLine = importResult ? 'Import complete' : 'Review words';
  else if (isError) statusLine = (errorMsg || 'Import failed').slice(0, 50);
  else if (isExtracting && extractDurationSeconds == null) statusLine = statusMessage || 'Extracting…';

  const durationStr =
    extractDurationSeconds != null
      ? extractDurationSeconds >= 60
        ? `${Math.floor(extractDurationSeconds / 60)}m ${Math.round(extractDurationSeconds % 60)}s`
        : `${Math.round(extractDurationSeconds)}s`
      : null;
  const commitDurationStr =
    isDone && importResult?.import_duration_seconds != null
      ? importResult.import_duration_seconds >= 60
        ? `${Math.floor(importResult.import_duration_seconds / 60)}m ${Math.round(importResult.import_duration_seconds % 60)}s`
        : `${Math.round(importResult.import_duration_seconds * 10) / 10}s`
      : null;
  if (durationStr && (isReview || isDone)) statusLine = `${statusLine} · ${durationStr}`;
  if (commitDurationStr && isDone) statusLine = `${statusLine} (import: ${commitDurationStr})`;

  const cardContent = (
    <Animated.View
      style={[
        styles.card,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        isError && styles.cardError,
        (isDone || isReview) && styles.cardDone,
      ]}
    >
      <View style={[styles.langIcon, styles.langIconImport]}>
        <Ionicons name="document-text" size={18} color={TYPE_COLOR} />
      </View>
      <View style={styles.infoCol}>
        <View style={styles.typeRow}>
          <Text style={styles.typeLabel} numberOfLines={1}>
            Import Vocab
          </Text>
        </View>
        <Text
          style={[styles.statusLine, isError && styles.statusLineError, (isDone || isReview) && styles.statusLineDone]}
          numberOfLines={2}
        >
          {statusLine}
        </Text>
      </View>
      {(isExtracting || isCommitting) && (
        <View style={[styles.activityIconCircle, { backgroundColor: TYPE_LIGHT }]}>
          <ActivityIndicator size="small" color={TYPE_COLOR} />
        </View>
      )}
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => onDismiss(job.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={14} color="#888" />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <TouchableOpacity onPress={() => onPress(job)} activeOpacity={0.85}>
      {cardContent}
    </TouchableOpacity>
  );
}

export default function ImportTray({ onPressJob, navigationRef }) {
  const { jobs, dismissJob, openModalForJob } = useImportJob();
  const insets = useSafeAreaInsets();

  const handlePress = (job) => {
    if (job.status === 'done' && job.importResult?.deck_id && navigationRef?.current?.isReady()) {
      navigationRef.current.navigate('Flashcards', {
        language: job.importResult.language || job.language,
        studyMode: 'deck',
        deckId: job.importResult.deck_id,
        deckName: job.importResult.deck_name ?? '',
        deckStartMode: 'mixed',
      });
    } else {
      openModalForJob(job.id, job);
    }
    dismissJob(job.id);
  };

  if (jobs.length === 0) return null;

  return (
    <View style={[styles.tray, { top: insets.top + 8 }]} pointerEvents="box-none">
      {jobs.map((job) => (
        <ImportJobCard
          key={job.id}
          job={job}
          onDismiss={dismissJob}
          onPress={(job) => handlePress(job)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    right: 12,
    zIndex: 9998,
    elevation: 19,
    alignItems: 'flex-end',
    gap: 8,
    pointerEvents: 'box-none',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    maxWidth: 260,
    minWidth: 200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  cardError: { backgroundColor: CARD_ERROR },
  cardDone: { backgroundColor: CARD_DONE },
  langIcon: {
    width: 32,
    height: 32,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langIconImport: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: TYPE_LIGHT,
  },
  infoCol: { flex: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
  typeLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 1 },
  statusLine: { fontSize: 11, color: '#666' },
  statusLineError: { color: '#EF4444' },
  statusLineDone: { color: '#16A34A', fontWeight: '500' },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtn: { width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
});
