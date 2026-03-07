/**
 * PlacementTestScreen
 *
 * A comprehensive CEFR placement test covering Reading, Writing, Listening,
 * Speaking, Vocabulary/Grammar and Translation.
 */
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import SafeText from '../components/SafeText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LanguageContext, LANGUAGES } from '../contexts/LanguageContext';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

const CEFR_COLORS = {
  A0: '#6B7280',
  A1: '#10B981',
  A2: '#3B82F6',
  B1: '#F59E0B',
  B2: '#EF4444',
  C1: '#8B5CF6',
  C2: '#EC4899',
};

const SECTION_META = {
  reading:            { icon: 'book-outline',      label: 'Reading',         color: '#3B82F6' },
  writing:            { icon: 'create-outline',    label: 'Writing',         color: '#EF4444' },
  listening:          { icon: 'headset-outline',   label: 'Listening',       color: '#10B981' },
  speaking:           { icon: 'mic-outline',       label: 'Speaking',        color: '#F59E0B' },
  vocabulary_grammar: { icon: 'library-outline',   label: 'Vocab & Grammar', color: '#06B6D4' },
  translation:        { icon: 'language-outline',  label: 'Translation',     color: '#8B5CF6' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable audio player for history review (listening + speaking)
// ─────────────────────────────────────────────────────────────────────────────
function HistoryAudioPlayer({ audioBase64, mimeType = 'audio/wav', color = '#3B82F6', label = 'Play' }) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);  // seconds
  const [duration, setDuration] = useState(0);   // seconds
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
        el.onended = () => { setPlaying(false); setPosition(0); if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
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
      // Native
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
            if (s?.isLoaded) { setPosition((s.positionMillis || 0) / 1000); setDuration((s.durationMillis || 0) / 1000); }
          }, 250);
          return;
        }
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:${mimeType};base64,${audioBase64}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      const st = await sound.getStatusAsync();
      setDuration((st.durationMillis || 0) / 1000);
      setPlaying(true);
      sound.setOnPlaybackStatusUpdate(s => {
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
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity
          style={[{ backgroundColor: color, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          onPress={toggle}
          activeOpacity={0.8}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#FFF" />
          <SafeText style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>{label}</SafeText>
        </TouchableOpacity>
        {duration > 0 && (
          <SafeText style={{ fontSize: 12, color: '#9CA3AF' }}>{fmt(position)} / {fmt(duration)}</SafeText>
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Flatten all items from a test, tagging each with its section. */
function flattenItems(sections) {
  const items = [];
  for (const section of sections) {
    for (const item of section.items) {
      items.push({ ...item, _section_id: section.section_id, _section_meta: SECTION_META[section.section_id] || {} });
    }
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage metadata used by the progress screen
// (icons are matched to the stage strings sent by the server)
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_META = {
  // generate
  building_prompt:   { icon: 'code-outline',          hint: 'Building personalised prompt…' },
  calling_gemini:    { icon: 'cloud-upload-outline',  hint: 'Waiting for Gemini AI…' },
  parsing:           { icon: 'construct-outline',     hint: 'Parsing test structure…' },
  // submit
  reviewing_answers: { icon: 'clipboard-outline',     hint: 'Reviewing your answers…' },
  saving_result:     { icon: 'save-outline',          hint: 'Saving your CEFR result…' },
  calibrating_srs:   { icon: 'layers-outline',        hint: 'Calibrating your flashcard queue…' },
  // generic
  done:              { icon: 'checkmark-done-outline', hint: 'Done!' },
};

/**
 * ProgressScreen — driven by real server-sent status events.
 *
 * Props:
 *   color        – accent colour
 *   title        – top headline
 *   serverStatus – { stage, message, progress } from the latest SSE event
 *   mode         – 'generate' | 'submit'
 */
function ProgressScreen({ color, title, serverStatus, mode }) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const msgFade = useRef(new Animated.Value(1)).current;
  const prevMessage = useRef('');

  // Animate the bar to the server-reported progress value
  useEffect(() => {
    const target = serverStatus?.progress ?? 0;
    Animated.timing(barAnim, {
      toValue: target,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [serverStatus?.progress]);

  // Fade the message label when it changes
  useEffect(() => {
    const msg = serverStatus?.message || '';
    if (msg !== prevMessage.current) {
      prevMessage.current = msg;
      Animated.sequence([
        Animated.timing(msgFade, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(msgFade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [serverStatus?.message]);

  const stage = serverStatus?.stage || (mode === 'generate' ? 'building_prompt' : 'reviewing_answers');
  const meta = STAGE_META[stage] || STAGE_META.calling_gemini;
  const message = serverStatus?.message || meta.hint;
  const pct = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const progressPct = Math.round((serverStatus?.progress ?? 0) * 100);

  // Stage list for dots
  const generateStages = ['building_prompt', 'calling_gemini', 'parsing'];
  const submitStages   = ['reviewing_answers', 'calling_gemini', 'saving_result', 'calibrating_srs'];
  const stageList = mode === 'generate' ? generateStages : submitStages;
  const stageIdx  = stageList.indexOf(stage);

  return (
    <View style={styles.progressScreen}>
      <View style={[styles.progressIconRing, { borderColor: color }]}>
        <Ionicons name={meta.icon} size={36} color={color} />
      </View>

      <SafeText style={styles.progressTitle}>{title}</SafeText>

      {/* Progress bar */}
      <View style={styles.progressBarTrack}>
        <Animated.View style={[styles.progressBarFill, { width: pct, backgroundColor: color }]} />
      </View>

      {/* Percentage */}
      <SafeText style={[styles.progressPct, { color }]}>{progressPct}%</SafeText>

      {/* Server message */}
      <Animated.View style={{ opacity: msgFade, alignItems: 'center', marginBottom: 20 }}>
        <View style={styles.progressStepRow}>
          <Ionicons name={meta.icon} size={16} color={color} />
          <SafeText style={[styles.progressStepText, { color }]}>{message}</SafeText>
        </View>
      </Animated.View>

      {/* Stage dots */}
      <View style={styles.progressDots}>
        {stageList.map((s, i) => {
          const sm = STAGE_META[s] || {};
          const active = i <= stageIdx;
          return (
            <View key={s} style={styles.progressDotWrap}>
              <View style={[
                styles.progressDot,
                active ? { backgroundColor: color, width: 10, height: 10 }
                        : { backgroundColor: color + '35' },
              ]} />
              <SafeText style={[styles.progressDotLabel, active && { color }]}>
                {sm.hint?.split(' ')[0]}
              </SafeText>
            </View>
          );
        })}
      </View>

      <SafeText style={styles.progressHint}>
        {mode === 'generate'
          ? 'Gemini is crafting a personalised 5-skill test — this takes ~30–40 s'
          : 'Gemini is evaluating every section of your test — ~20–30 s'}
      </SafeText>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Results screen
// ─────────────────────────────────────────────────────────────────────────────

function ResultsScreen({ result, srsCalibration, language, onRetake, onDone, isPractice }) {
  const overall = result?.overall_cefr_level || 'A1';
  const skillLevels = result?.skill_levels || {};
  const skillScores = result?.skill_scores || {};
  const strengths = result?.strengths || [];
  const improvements = result?.areas_for_improvement || [];
  const recommendation = result?.recommendation || '';
  const levelBreakdown = result?.level_breakdown || {};
  const color = CEFR_COLORS[overall] || '#4A90E2';

  const SKILLS = [
    { key: 'reading', icon: 'book-outline', label: 'Reading' },
    { key: 'listening', icon: 'headset-outline', label: 'Listening' },
    { key: 'writing', icon: 'create-outline', label: 'Writing' },
    { key: 'speaking', icon: 'mic-outline', label: 'Speaking' },
    { key: 'vocabulary_grammar', icon: 'library-outline', label: 'Vocab/Grammar' },
    { key: 'translation', icon: 'language-outline', label: 'Translation' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.resultsContent}>
      {/* Hero */}
      <View style={[styles.resultHero, { backgroundColor: color }]}>
        <SafeText style={styles.resultHeroLabel}>Your CEFR Level</SafeText>
        <SafeText style={styles.resultLevel}>{overall}</SafeText>
        <SafeText style={styles.resultLanguage}>{language.charAt(0).toUpperCase() + language.slice(1)}</SafeText>
        <View style={styles.resultSaved}>
          <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.85)" />
          <SafeText style={styles.resultSavedText}>{isPractice ? 'Practice — not saved' : 'Saved to your profile'}</SafeText>
        </View>
      </View>

      {/* Skill breakdown */}
      <View style={styles.card}>
        <SafeText style={styles.cardTitle}>Skill Breakdown</SafeText>
        {SKILLS.map(s => {
          const lvl = skillLevels[s.key] || '—';
          const score = skillScores[s.key];
          const c = CEFR_COLORS[lvl] || '#9CA3AF';
          return (
            <View key={s.key} style={styles.skillRow}>
              <Ionicons name={s.icon} size={20} color={c} style={styles.skillIcon} />
              <SafeText style={styles.skillLabel}>{s.label}</SafeText>
              <View style={[styles.skillBadge, { backgroundColor: c }]}>
                <SafeText style={styles.skillBadgeText}>{lvl}</SafeText>
              </View>
              {score !== undefined && (
                <SafeText style={styles.skillScore}>{Math.round(score)}%</SafeText>
              )}
            </View>
          );
        })}
      </View>

      {/* Level breakdown bars */}
      {Object.keys(levelBreakdown).length > 0 && (
        <View style={styles.card}>
          <SafeText style={styles.cardTitle}>Level-by-Level Score</SafeText>
          {['A0','A1','A2','B1','B2','C1'].map(lvl => {
            const info = levelBreakdown[lvl];
            if (!info) return null;
            const pct = Math.min(100, Math.max(0, info.score || 0));
            const c = CEFR_COLORS[lvl] || '#9CA3AF';
            return (
              <View key={lvl} style={styles.breakdownRow}>
                <View style={[styles.breakdownBadge, { backgroundColor: c }]}>
                  <SafeText style={styles.breakdownBadgeText}>{lvl}</SafeText>
                </View>
                <View style={styles.breakdownBarContainer}>
                  <View style={[styles.breakdownBar, { width: `${pct}%`, backgroundColor: c }]} />
                </View>
                <SafeText style={styles.breakdownPct}>{Math.round(pct)}%</SafeText>
                {info.passed && <Ionicons name="checkmark-circle" size={16} color="#10B981" style={styles.breakdownCheck} />}
              </View>
            );
          })}
        </View>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="barbell-outline" size={18} color="#10B981" />
            <SafeText style={styles.cardTitle}>Strengths</SafeText>
          </View>
          {strengths.map((s, i) => (
            <View key={i} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <SafeText style={styles.bulletText}>{s}</SafeText>
            </View>
          ))}
        </View>
      )}

      {/* Areas for improvement */}
      {improvements.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="trending-up-outline" size={18} color="#F59E0B" />
            <SafeText style={styles.cardTitle}>Areas to Improve</SafeText>
          </View>
          {improvements.map((s, i) => (
            <View key={i} style={styles.bulletRow}>
              <Ionicons name="arrow-forward-circle" size={16} color="#F59E0B" />
              <SafeText style={styles.bulletText}>{s}</SafeText>
            </View>
          ))}
        </View>
      )}

      {/* Recommendation */}
      {!!recommendation && (
        <View style={[styles.card, styles.recommendationCard]}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="clipboard-outline" size={18} color="#4A90E2" />
            <SafeText style={styles.cardTitle}>Recommendation</SafeText>
          </View>
          <SafeText style={styles.recommendationText}>{recommendation}</SafeText>
        </View>
      )}

      {/* SRS Calibration summary */}
      {srsCalibration && srsCalibration.updated > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="library-outline" size={18} color="#06B6D4" />
            <SafeText style={styles.cardTitle}>Vocabulary Calibrated</SafeText>
          </View>
          <SafeText style={styles.srsCalibrationSubtitle}>
            Your flashcard queue has been personalised for your {srsCalibration.user_cefr_level || overall} level.
          </SafeText>
          <View style={styles.srsCalibrationRow}>
            {[
              { key: 'review',   label: 'Ready to Review', icon: 'checkmark-circle-outline', color: '#10B981' },
              { key: 'learning', label: 'Learning',         icon: 'school-outline',           color: '#3B82F6' },
              { key: 'new',      label: 'Queued',           icon: 'time-outline',             color: '#9CA3AF' },
            ].map(({ key, label, icon, color: c }) => {
              const n = srsCalibration.by_level?.[key] ?? 0;
              if (!n) return null;
              return (
                <View key={key} style={styles.srsCalibrationChip}>
                  <Ionicons name={icon} size={18} color={c} />
                  <SafeText style={[styles.srsCalibrationCount, { color: c }]}>{n}</SafeText>
                  <SafeText style={styles.srsCalibrationLabel}>{label}</SafeText>
                </View>
              );
            })}
          </View>
          {srsCalibration.skipped > 0 && (
            <SafeText style={styles.srsCalibrationSkipped}>
              {srsCalibration.skipped} already-mastered words were left untouched.
            </SafeText>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.resultActions}>
        <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
          <Ionicons name="refresh" size={18} color="#4A90E2" />
          <SafeText style={styles.retakeBtnText}>Retake Test</SafeText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: color }]} onPress={onDone}>
          <SafeText style={styles.doneBtnText}>Done</SafeText>
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function PlacementTestScreen({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { selectedLanguage } = useContext(LanguageContext);
  const language = route?.params?.language || selectedLanguage || 'kannada';
  const currentLang = LANGUAGES.find(l => l.code === language);
  const langColor = currentLang?.color || '#4A90E2';

  // ── state ──
  const [phase, setPhase] = useState('intro'); // intro | loading | test | submitting | results | history | error
  const [testData, setTestData] = useState(null);
  const [flatItems, setFlatItems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [srsCalibration, setSrsCalibration] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [previousResult, setPreviousResult] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [loadingPrevious, setLoadingPrevious] = useState(true);
  const [viewingHistoryResult, setViewingHistoryResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyDetailTab, setHistoryDetailTab] = useState('summary'); // 'summary' | 'answers'
  const [resultsDetailTab, setResultsDetailTab] = useState('summary'); // 'summary' | 'answers' (for phase === 'results')
  const [textInputValue, setTextInputValue] = useState('');
  const [isPracticeMode, setIsPracticeMode] = useState(false); // practice = don't save results
  // Real-time status from SSE
  const [serverStatus, setServerStatus] = useState(null);
  // Listening audio: transcriptItemId -> { audioBase64, loading, error, sound, playing }
  const [listeningAudio, setListeningAudio] = useState({});
  const audioSoundsRef = useRef({});
  // Ref to track which transcript items have already been fetched (avoids stale-closure bug)
  const audioFetchedRef = useRef({});
  // Speaking recording state
  const [recordingState, setRecordingState] = useState('idle'); // 'idle' | 'recording' | 'saving'
  const recordingRef = useRef(null);

  // animation
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ── load previous result + full history ──
  useEffect(() => {
    (async () => {
      try {
        const [latestRes, historyRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/placement-test/latest/${language}`),
          fetch(`${API_BASE_URL}/api/placement-test/history/${language}`),
        ]);
        if (latestRes.ok) {
          const data = await latestRes.json();
          setPreviousResult(data.result || null);
        }
        if (historyRes.ok) {
          const data = await historyRes.json();
          setAllResults(data.results || []);
        }
      } catch (_) {}
      setLoadingPrevious(false);
    })();
  }, [language]);

  // ── cleanup audio sounds on unmount ──
  useEffect(() => {
    return () => {
      Object.values(audioSoundsRef.current).forEach(s => { try { s.unloadAsync(); } catch (_) {} });
    };
  }, []);

  // ── fetch or reuse TTS audio for a listening transcript item ──
  const loadListeningAudio = useCallback(async (transcriptItem) => {
    const itemId = transcriptItem.item_id;

    // If the historical result already contains audio, prefer that and avoid regenerating
    if (transcriptItem.audio_base64) {
      setListeningAudio(prev => ({
        ...prev,
        [itemId]: {
          loading: false,
          audioBase64: transcriptItem.audio_base64,
          error: null,
          playing: false,
        },
      }));
      audioFetchedRef.current[itemId] = true;
      return;
    }

    // Otherwise, fall back to requesting fresh audio (for very old results)
    if (audioFetchedRef.current[itemId]) return;
    audioFetchedRef.current[itemId] = true; // mark immediately to prevent double-fetch
    setListeningAudio(prev => ({ ...prev, [itemId]: { loading: true, audioBase64: null, error: null, playing: false } }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/placement-test/listening-audio/${language}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_text: transcriptItem.transcript_text || '',
          speakers: transcriptItem.speakers || [],
          dialogue: transcriptItem.dialogue || [],
        }),
      });
      if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);
      const data = await res.json();
      if (!data.audio_base64) throw new Error('Server returned no audio data');
      setListeningAudio(prev => ({ ...prev, [itemId]: { loading: false, audioBase64: data.audio_base64, error: null, playing: false } }));
    } catch (e) {
      console.warn('[PlacementTest] TTS fetch error:', e.message);
      audioFetchedRef.current[itemId] = false; // allow retry
      setListeningAudio(prev => ({ ...prev, [itemId]: { loading: false, audioBase64: null, error: e.message, playing: false } }));
    }
  }, [language]); // NOTE: no listeningAudio in deps — use ref guard instead

  // ── play / stop audio for a transcript ──
  // Uses HTML5 Audio on web (expo-av is unreliable on web), expo-av on native
  const webAudioRef = useRef({}); // itemId -> HTMLAudioElement (web only)

  const toggleListeningAudio = useCallback(async (itemId, audioBase64) => {
    try {
      if (Platform.OS === 'web') {
        // Web: use HTML5 Audio API
        let el = webAudioRef.current[itemId];
        if (el && !el.paused) {
          el.pause();
          el.currentTime = 0;
          setListeningAudio(prev => ({ ...prev, [itemId]: { ...prev[itemId], playing: false } }));
          return;
        }
        if (!el) {
          el = new window.Audio(`data:audio/wav;base64,${audioBase64}`);
          el.onended = () => setListeningAudio(prev => ({ ...prev, [itemId]: { ...prev[itemId], playing: false } }));
          webAudioRef.current[itemId] = el;
        }
        await el.play();
        setListeningAudio(prev => ({ ...prev, [itemId]: { ...prev[itemId], playing: true } }));
      } else {
        // Native: use expo-av
        const existingSound = audioSoundsRef.current[itemId];
        if (existingSound) {
          const status = await existingSound.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await existingSound.stopAsync();
            setListeningAudio(prev => ({ ...prev, [itemId]: { ...prev[itemId], playing: false } }));
            return;
          }
          await existingSound.unloadAsync();
          delete audioSoundsRef.current[itemId];
        }
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/wav;base64,${audioBase64}` },
          { shouldPlay: true }
        );
        audioSoundsRef.current[itemId] = sound;
        setListeningAudio(prev => ({ ...prev, [itemId]: { ...prev[itemId], playing: true } }));
        sound.setOnPlaybackStatusUpdate(status => {
          if (status.didJustFinish) {
            setListeningAudio(prev => ({ ...prev, [itemId]: { ...prev[itemId], playing: false } }));
          }
        });
      }
    } catch (e) {
      console.warn('[Audio] playback error:', e.message);
    }
  }, []);

  // ── sync text input with answers state ──
  useEffect(() => {
    const item = flatItems[currentIdx];
    if (!item) return;
    if (item.type === 'free_response' || item.type === 'speaking_prompt') {
      const a = answers[item.item_id];
      // If answer is audio object, show placeholder indicator; otherwise show text
      setTextInputValue(typeof a === 'string' ? a : '');
    }
  }, [currentIdx, flatItems]);

  // ── keyboard navigation (web only) ──
  // goNext/goPrev refs so the event listener always sees the latest version
  const goNextRef = useRef(null);
  const goPrevRef = useRef(null);
  const flatItemsRef = useRef([]);
  const currentIdxRef = useRef(0);
  useEffect(() => { flatItemsRef.current = flatItems; }, [flatItems]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  useEffect(() => {
    if (Platform.OS !== 'web' || phase !== 'test') return;
    const handler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return; // don't intercept typing
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        goNextRef.current?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrevRef.current?.();
      } else if (['1','2','3','4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const item = flatItemsRef.current[currentIdxRef.current];
        if (item && (item.type === 'multiple_choice' || item.type === 'translation_choice' || item.type === 'translation_choice_reverse')) {
          if (item.options && idx < item.options.length) {
            setAnswers(prev => ({ ...prev, [item.item_id]: idx }));
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase]);

  // ── start audio recording for speaking section ──
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setRecordingState('recording');
    } catch (e) {
      console.warn('[Recording] start error:', e.message);
    }
  }, []);

  // ── stop recording and save audio as base64 (no transcription — sent direct to model) ──
  const stopAndSaveAudio = useCallback(async (itemId) => {
    try {
      setRecordingState('saving');
      const rec = recordingRef.current;
      if (!rec) { setRecordingState('idle'); return; }
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;

      // Read as base64
      let audioBase64;
      let audioFormat = 'm4a';
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        audioFormat = blob.type.includes('webm') ? 'webm' : 'wav';
        audioBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      }

      // Store audio data in answers — backend will send to Gemini directly
      const audioAnswer = { audio_base64: audioBase64, audio_format: audioFormat, uri };
      setAnswers(prev => ({ ...prev, [itemId]: audioAnswer }));
      setTextInputValue('__audio_recorded__');
    } catch (e) {
      console.warn('[Recording] save error:', e.message);
    } finally {
      setRecordingState('idle');
    }
  }, []);

  // ── helper: read an SSE stream, calling onEvent for each parsed event ──
  const readSSEStream = useCallback(async (url, method, body, onEvent) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
    };
    if (body) opts.body = JSON.stringify(body);

    const response = await fetch(url, opts);
    if (!response.ok) {
      let errText = '';
      try { errText = await response.text(); } catch (_) {}
      throw new Error(`Server error ${response.status}: ${errText || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            onEvent(event);
            if (event.type === 'done' || event.type === 'error') return event;
          } catch (_) {}
        }
      }
    }
    return null;
  }, []);

  // ── generate test via SSE stream ──
  const generateTest = useCallback(async () => {
    setPhase('loading');
    setErrorMsg('');
    setErrorDetail('');
    setServerStatus({ stage: 'building_prompt', message: 'Connecting to server…', progress: 0.02 });
    try {
      const final = await readSSEStream(
        `${API_BASE_URL}/api/placement-test/generate-stream/${language}`,
        'GET', null,
        (event) => {
          if (event.type === 'status') {
            setServerStatus({ stage: event.stage, message: event.message, progress: event.progress });
          }
        }
      );
      if (!final) throw new Error('Stream ended without a result');
      if (final.type === 'error') throw new Error(final.message || 'Unknown server error');
      const test = final.test;
      setTestData(test);
      const allItems = flattenItems(test.sections || []);
      setFlatItems(allItems);
      setAnswers({});
      setCurrentIdx(0);
      setServerStatus(null);
      setListeningAudio({});
      audioFetchedRef.current = {}; // reset fetch guard for new test
      setPhase('test');
      // Pre-fetch TTS for all transcript items in the background
      const transcriptItems = allItems.filter(i => i.type === 'transcript');
      transcriptItems.forEach(ti => loadListeningAudio(ti));
    } catch (e) {
      setErrorMsg(`Could not generate test`);
      setErrorDetail(e.message);
      setServerStatus(null);
      setPhase('error');
    }
  }, [language, readSSEStream, loadListeningAudio]);

  // ── submit answers via SSE stream ──
  const submitTest = useCallback(async (finalAnswers) => {
    setPhase('submitting');
    setErrorMsg('');
    setErrorDetail('');
    setServerStatus({ stage: 'reviewing_answers', message: 'Sending answers to server…', progress: 0.02 });
    try {
      // Inject listening audio into test_data so it is saved and not regenerated when opening historical test
      const testDataToSend = (() => {
        if (!testData?.sections) return testData;
        const sections = testData.sections.map(sec => {
          if (sec.section_id !== 'listening') return sec;
          const items = (sec.items || []).map(it => {
            if (it.type !== 'transcript') return it;
            const audioBase64 = listeningAudio[it.item_id]?.audioBase64;
            if (!audioBase64) return it;
            return { ...it, audio_base64: audioBase64 };
          });
          return { ...sec, items };
        });
        return { ...testData, sections };
      })();

      const final = await readSSEStream(
        `${API_BASE_URL}/api/placement-test/submit-stream/${language}`,
        'POST',
        { test_data: testDataToSend, answers: finalAnswers, practice_mode: isPracticeMode },
        (event) => {
          if (event.type === 'status') {
            setServerStatus({ stage: event.stage, message: event.message, progress: event.progress });
          }
        }
      );
      if (!final) throw new Error('Stream ended without a result');
      if (final.type === 'error') throw new Error(final.message || 'Unknown server error');
      setResult(final.result);
      setSrsCalibration(final.srs_calibration || null);
      setServerStatus(null);
      setPhase('results');
    } catch (e) {
      setErrorMsg(`Could not submit test`);
      setErrorDetail(e.message);
      setServerStatus(null);
      setPhase('error');
    }
  }, [language, testData, listeningAudio, readSSEStream, isPracticeMode]);

  // ── navigate through items ──
  const animateIn = useCallback(() => {
    slideAnim.setValue(40);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  }, [slideAnim]);

  const goNext = useCallback(() => {
    // Persist text input value for free_response before advancing
    const item = flatItems[currentIdx];
    if (item && item.type === 'free_response') {
      setAnswers(prev => ({ ...prev, [item.item_id]: textInputValue }));
    }

    if (currentIdx < flatItems.length - 1) {
      setCurrentIdx(prev => prev + 1);
      animateIn();
    } else {
      // Submit
      const finalAnswers = { ...answers };
      if (item && item.type === 'free_response') {
        finalAnswers[item.item_id] = textInputValue;
      }
      submitTest(finalAnswers);
    }
  }, [currentIdx, flatItems, answers, textInputValue, animateIn, submitTest]);
  goNextRef.current = goNext;

  const goPrev = useCallback(() => {
    const item = flatItems[currentIdx];
    if (item && item.type === 'free_response') {
      setAnswers(prev => ({ ...prev, [item.item_id]: textInputValue }));
    }
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      animateIn();
    }
  }, [currentIdx, flatItems, answers, textInputValue, animateIn]);
  goPrevRef.current = goPrev;

  // ── render item ──
  const renderItem = useCallback((item) => {
    const secMeta = item._section_meta || {};
    const sectionColor = secMeta.color || langColor;

    if (item.type === 'passage') {
      return (
        <View style={styles.passageCard}>
          <View style={[styles.passageHeader, { backgroundColor: sectionColor }]}>
            <Ionicons name="book-outline" size={18} color="#FFF" />
            <SafeText style={styles.passageHeaderText}>{item.passage_title || 'Passage'}</SafeText>
          </View>
          <SafeText style={styles.passageText}>{item.passage_text}</SafeText>
        </View>
      );
    }

    // Listening transcript — show audio player + optional dialogue preview
    if (item.type === 'transcript') {
      const audioState = listeningAudio[item.item_id] || {};
      const hasSpeakers = item.speakers && item.speakers.length > 0;
      const hasDialogue = item.dialogue && item.dialogue.length > 0;

      // Assign colours to each speaker for visual differentiation
      const speakerColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];

      return (
        <View style={[styles.audioPlayerCard, { borderColor: sectionColor }]}>
          <View style={[styles.audioPlayerHeader, { backgroundColor: sectionColor }]}>
            <Ionicons name="headset-outline" size={18} color="#FFF" />
            <SafeText style={styles.passageHeaderText}>{item.transcript_title || 'Listening'}</SafeText>
          </View>

          {/* Speaker legend */}
          {hasSpeakers && (
            <View style={styles.speakerLegend}>
              {item.speakers.map((sp, i) => (
                <View key={i} style={styles.speakerLegendItem}>
                  <Ionicons
                    name={sp.gender === 'male' ? 'man-outline' : 'woman-outline'}
                    size={14}
                    color={speakerColors[i % speakerColors.length]}
                  />
                  <SafeText style={[styles.speakerLegendName, { color: speakerColors[i % speakerColors.length] }]}>
                    {sp.name}
                  </SafeText>
                </View>
              ))}
            </View>
          )}

          {/* Dialogue lines — HIDDEN during active test; only shown in history view */}
          {false && hasDialogue && (
            <View style={styles.dialoguePreview}>
              {item.dialogue.map((line, i) => {
                const color = speakerColors[line.speaker_index % speakerColors.length];
                const sp = item.speakers?.[line.speaker_index];
                const isRight = line.speaker_index % 2 === 1;
                return (
                  <View key={i} style={[styles.dialogueLine, isRight && styles.dialogueLineRight]}>
                    {!isRight && (
                      <Ionicons
                        name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'}
                        size={14} color={color} style={{ marginTop: 2 }}
                      />
                    )}
                    <View style={[styles.dialogueBubble, { backgroundColor: color + '18', borderColor: color + '40' }, isRight && styles.dialogueBubbleRight]}>
                      <SafeText style={[styles.dialogueBubbleText]}>{line.text}</SafeText>
                    </View>
                    {isRight && (
                      <Ionicons
                        name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'}
                        size={14} color={color} style={{ marginTop: 2 }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Label fallback */}
          {!hasSpeakers && item.speaker_label_en ? (
            <SafeText style={styles.speakerLabel}>{item.speaker_label_en}</SafeText>
          ) : null}

          <View style={styles.audioControls}>
            {audioState.loading ? (
              <View style={styles.audioLoadingRow}>
                <ActivityIndicator size="small" color={sectionColor} />
                <SafeText style={[styles.audioLoadingText, { color: sectionColor }]}>Preparing audio…</SafeText>
              </View>
            ) : audioState.error ? (
              <View style={styles.audioErrorRow}>
                <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                <SafeText style={styles.audioErrorText}>Could not load audio</SafeText>
                <TouchableOpacity onPress={() => loadListeningAudio(item)} style={styles.audioRetryBtn}>
                  <SafeText style={[styles.audioRetryText, { color: sectionColor }]}>Retry</SafeText>
                </TouchableOpacity>
              </View>
            ) : audioState.audioBase64 ? (
              <TouchableOpacity
                style={[styles.audioPlayBtn, { backgroundColor: sectionColor }]}
                onPress={() => toggleListeningAudio(item.item_id, audioState.audioBase64)}
                activeOpacity={0.8}
              >
                <Ionicons name={audioState.playing ? 'stop-circle' : 'play-circle'} size={28} color="#FFF" />
                <SafeText style={styles.audioPlayBtnText}>
                  {audioState.playing ? 'Stop' : 'Play Audio'}
                </SafeText>
              </TouchableOpacity>
            ) : (
              <View style={styles.audioLoadingRow}>
                <ActivityIndicator size="small" color={sectionColor} />
                <SafeText style={[styles.audioLoadingText, { color: sectionColor }]}>Loading audio…</SafeText>
              </View>
            )}
          </View>
        </View>
      );
    }

    if (item.type === 'multiple_choice') {
      const selected = answers[item.item_id];
      return (
        <View>
          <SafeText style={styles.questionText}>{item.question}</SafeText>
          <View style={styles.optionsContainer}>
            {(item.options || []).map((opt, i) => {
              const isSelected = selected === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionBtn, isSelected && { borderColor: sectionColor, backgroundColor: sectionColor + '18' }]}
                  onPress={() => setAnswers(prev => ({ ...prev, [item.item_id]: i }))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionNumber, isSelected && { backgroundColor: sectionColor }]}>
                    <SafeText style={[styles.optionNumberText, isSelected && { color: '#FFF' }]}>{i + 1}</SafeText>
                  </View>
                  <SafeText style={[styles.optionText, isSelected && { color: sectionColor, fontWeight: '600' }]}>{opt}</SafeText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    // Translation: show native phrase prominently, target-language options below
    if (item.type === 'translation_choice') {
      const selected = answers[item.item_id];
      return (
        <View>
          <View style={[styles.translationSourceBox, { borderColor: sectionColor }]}>
            <SafeText style={styles.translationSourceText}>{item.source_phrase}</SafeText>
          </View>
          {item.question_en && (
            <SafeText style={styles.questionEnText}>{item.question_en}</SafeText>
          )}
          <View style={styles.optionsContainer}>
            {(item.options || []).map((opt, i) => {
              const isSelected = selected === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionBtn, isSelected && { borderColor: sectionColor, backgroundColor: sectionColor + '18' }]}
                  onPress={() => setAnswers(prev => ({ ...prev, [item.item_id]: i }))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionNumber, isSelected && { backgroundColor: sectionColor }]}>
                    <SafeText style={[styles.optionNumberText, isSelected && { color: '#FFF' }]}>{i + 1}</SafeText>
                  </View>
                  <SafeText style={[styles.optionText, isSelected && { color: sectionColor, fontWeight: '600' }]}>{opt}</SafeText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    // Reverse translation: show English phrase, pick native-language translation
    if (item.type === 'translation_choice_reverse') {
      const selected = answers[item.item_id];
      return (
        <View>
          <View style={[styles.translationSourceBox, { borderColor: sectionColor }]}>
            <SafeText style={[styles.translationSourceText, { fontSize: 22 }]}>{item.source_phrase_en}</SafeText>
          </View>
          <SafeText style={styles.questionEnText}>What is the {language.charAt(0).toUpperCase() + language.slice(1)} translation?</SafeText>
          <View style={styles.optionsContainer}>
            {(item.options || []).map((opt, i) => {
              const isSelected = selected === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.optionBtn, isSelected && { borderColor: sectionColor, backgroundColor: sectionColor + '18' }]}
                  onPress={() => setAnswers(prev => ({ ...prev, [item.item_id]: i }))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionNumber, isSelected && { backgroundColor: sectionColor }]}>
                    <SafeText style={[styles.optionNumberText, isSelected && { color: '#FFF' }]}>{i + 1}</SafeText>
                  </View>
                  <SafeText style={[styles.optionText, isSelected && { color: sectionColor, fontWeight: '600' }]}>{opt}</SafeText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (item.type === 'free_response') {
      return (
        <View>
          {item.prompt_native && (
            <SafeText style={styles.questionText}>{item.prompt_native}</SafeText>
          )}
          <TextInput
            style={[styles.textInput, { borderColor: sectionColor }]}
            multiline
            numberOfLines={5}
            value={textInputValue}
            onChangeText={setTextInputValue}
            placeholder="Write your response here…"
            placeholderTextColor="#9CA3AF"
            textAlignVertical="top"
          />
          {item.min_words && (
            <SafeText style={styles.wordHint}>{item.min_words}–{item.max_words || '∞'} words</SafeText>
          )}
        </View>
      );
    }

    if (item.type === 'speaking_prompt') {
      const audioAnswer = typeof answers[item.item_id] === 'object' ? answers[item.item_id] : null;
      const hasAudio = !!(audioAnswer?.audio_base64);

      return (
        <View>
          {item.prompt_native && (
            <SafeText style={styles.questionText}>{item.prompt_native}</SafeText>
          )}

          {/* Recorded audio status + playback with seek */}
          {hasAudio && (
            <View style={[styles.audioRecordedCard, { borderColor: sectionColor, flexDirection: 'column', gap: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="mic-circle-outline" size={20} color={sectionColor} />
                <SafeText style={[styles.audioRecordedText, { color: sectionColor }]}>Audio recorded</SafeText>
                <TouchableOpacity
                  style={[styles.audioRecordedBtn, { backgroundColor: '#EF444418', borderColor: '#EF4444', marginLeft: 'auto' }]}
                  onPress={() => {
                    setAnswers(prev => ({ ...prev, [item.item_id]: undefined }));
                    setTextInputValue('');
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={15} color="#EF4444" />
                  <SafeText style={[styles.audioRecordedBtnText, { color: '#EF4444' }]}>Re-record</SafeText>
                </TouchableOpacity>
              </View>
              <HistoryAudioPlayer
                audioBase64={audioAnswer.audio_base64}
                mimeType={audioAnswer.audio_format === 'webm' ? 'audio/webm' : 'audio/mp4'}
                color={sectionColor}
                label="Play back"
              />
            </View>
          )}

          {/* Record / Stop buttons — only show when no audio saved yet */}
          {!hasAudio && (
            <View style={styles.recordRow}>
              {recordingState === 'idle' && (
                <TouchableOpacity
                  style={[styles.recordBtn, { backgroundColor: sectionColor }]}
                  onPress={startRecording}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mic" size={22} color="#FFF" />
                  <SafeText style={styles.recordBtnText}>Record Response</SafeText>
                </TouchableOpacity>
              )}
              {recordingState === 'recording' && (
                <TouchableOpacity
                  style={[styles.recordBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() => stopAndSaveAudio(item.item_id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="stop-circle" size={22} color="#FFF" />
                  <SafeText style={styles.recordBtnText}>Stop Recording</SafeText>
                </TouchableOpacity>
              )}
              {recordingState === 'saving' && (
                <View style={[styles.recordBtn, { backgroundColor: '#6B7280' }]}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <SafeText style={styles.recordBtnText}>Saving…</SafeText>
                </View>
              )}
            </View>
          )}
          {item.min_sentences && !hasAudio && (
            <SafeText style={styles.wordHint}>{item.min_sentences}–{item.max_sentences || '∞'} sentences</SafeText>
          )}
        </View>
      );
    }

    return <SafeText style={styles.questionText}>{JSON.stringify(item)}</SafeText>;
  }, [answers, textInputValue, langColor, language, listeningAudio, loadListeningAudio, toggleListeningAudio, recordingState, startRecording, stopAndSaveAudio]);

  // ── look ahead for any passage/transcript needed for the current MCQ ──
  // NOTE: for listening items the transcript IS shown (as audio player), not hidden
  const getContextItems = useCallback((idx) => {
    const item = flatItems[idx];
    if (!item) return [];
    const ctxId = item.refers_to_passage || item.refers_to_transcript;
    if (!ctxId) return [];
    const ctxItem = flatItems.find(i => i.item_id === ctxId);
    return ctxItem ? [ctxItem] : [];
  }, [flatItems]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: render a single Q&A item in the history review tab
  // ─────────────────────────────────────────────────────────────────────────
  const renderHistoryReviewItem = (item, storedAnswers, itemFeedback, sColor, opts = {}) => {
    const { hideCefrBadge = false } = opts;
    const userAnswer = storedAnswers[item.item_id];
    const isCorrect = item.correct_index !== undefined ? userAnswer === item.correct_index : null;
    const feedback = itemFeedback[item.item_id];
    const hasAudioAnswer = typeof userAnswer === 'object' && userAnswer?.audio_base64;
    return (
      <View key={item.item_id} style={[styles.reviewItem, { borderLeftColor: sColor, marginBottom: 10 }]}>
        <View style={styles.reviewItemHeader}>
          {!hideCefrBadge && item.cefr_target && (
            <View style={[styles.cefrBadge, { backgroundColor: CEFR_COLORS[item.cefr_target] || '#9CA3AF', alignSelf: 'auto' }]}>
              <SafeText style={styles.cefrBadgeText}>{item.cefr_target}</SafeText>
            </View>
          )}
          {isCorrect !== null && (
            <Ionicons
              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={isCorrect ? '#10B981' : '#EF4444'}
              style={{ marginLeft: 'auto' }}
            />
          )}
        </View>

        {(item.question || item.source_phrase || item.source_phrase_en || item.prompt_native || item.prompt_en) && (
          <SafeText style={styles.reviewQuestion}>
            {item.question || item.source_phrase || item.source_phrase_en || item.prompt_native || item.prompt_en}
          </SafeText>
        )}

        {/* MCQ options */}
        {item.options && item.options.length > 0 && (
          <View style={{ marginTop: 6, gap: 4 }}>
            {item.options.map((opt, i) => {
              const isUserChoice = userAnswer === i;
              const isCorrectOpt = i === item.correct_index;
              let bg = 'transparent'; let border = '#E5E7EB';
              if (isCorrectOpt) { bg = '#D1FAE5'; border = '#10B981'; }
              if (isUserChoice && !isCorrectOpt) { bg = '#FEE2E2'; border = '#EF4444'; }
              return (
                <View key={i} style={[styles.reviewOption, { backgroundColor: bg, borderColor: border }]}>
                  <SafeText style={[styles.optionText, { fontSize: 14 }]}>{i + 1}. {opt}</SafeText>
                  {isCorrectOpt && <Ionicons name="checkmark-circle" size={14} color="#10B981" />}
                  {isUserChoice && !isCorrectOpt && <Ionicons name="close-circle" size={14} color="#EF4444" />}
                </View>
              );
            })}
          </View>
        )}

        {/* Text answer */}
        {!item.options && !hasAudioAnswer && typeof userAnswer === 'string' && userAnswer && (
          <View style={[styles.reviewTextAnswer, { borderColor: sColor }]}>
            <SafeText style={styles.reviewTextAnswerText}>{userAnswer}</SafeText>
          </View>
        )}

        {/* Speaking audio answer with player */}
        {hasAudioAnswer && (
          <View style={{ marginTop: 8 }}>
            <HistoryAudioPlayer
              audioBase64={userAnswer.audio_base64}
              mimeType={userAnswer.audio_format === 'webm' ? 'audio/webm' : 'audio/mp4'}
              color={sColor}
              label="Your Speaking"
            />
          </View>
        )}

        {feedback && (
          <View style={styles.reviewFeedbackRow}>
            <Ionicons name="information-circle-outline" size={15} color="#6B7280" />
            <SafeText style={styles.reviewFeedbackText}>{feedback}</SafeText>
          </View>
        )}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render phases
  // ─────────────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: langColor, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <SafeText style={styles.headerTitle}>Placement Test</SafeText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.introContent}>
          {/* Language badge */}
          <View style={[styles.langBadge, { backgroundColor: langColor }]}>
            {currentLang?.nativeChar
              ? <SafeText style={styles.langBadgeChar}>{currentLang.nativeChar}</SafeText>
              : <SafeText style={styles.langBadgeText}>{language.toUpperCase()}</SafeText>}
          </View>

          <SafeText style={styles.introTitle}>
            {language.charAt(0).toUpperCase() + language.slice(1)} Placement Test
          </SafeText>
          <SafeText style={styles.introSubtitle}>
            Find your CEFR level across four skills
          </SafeText>

          {/* Skill list */}
          <View style={styles.skillList}>
            {Object.entries(SECTION_META).map(([key, meta]) => (
              <View key={key} style={styles.skillListRow}>
                <View style={[styles.skillListIcon, { backgroundColor: meta.color + '20' }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>
                <SafeText style={styles.skillListLabel}>{meta.label}</SafeText>
              </View>
            ))}
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={18} color="#4A90E2" />
            <SafeText style={styles.infoText}>~15–20 minutes · ~25 questions</SafeText>
          </View>
          <View style={styles.infoBox}>
            <Ionicons name="trending-up-outline" size={18} color="#10B981" />
            <SafeText style={styles.infoText}>Your CEFR level is saved to your profile</SafeText>
          </View>

          {/* History section — collapsed by default, shown on demand */}
          {!loadingPrevious && allResults.length > 0 && (
            <View style={{ marginBottom: 4 }}>
              {!showHistory ? (
                <TouchableOpacity
                  style={styles.showHistoryBtn}
                  onPress={() => setShowHistory(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="time-outline" size={18} color="#6B7280" />
                  <SafeText style={styles.showHistoryBtnText}>View Past Placement Tests</SafeText>
                  <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <View style={styles.historySection}>
                  <TouchableOpacity
                    style={styles.historySectionHeader}
                    onPress={() => setShowHistory(false)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time-outline" size={18} color="#6B7280" />
                    <SafeText style={styles.historySectionTitle}>Past Tests</SafeText>
                    <Ionicons name="chevron-up" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                  {allResults.map((r, i) => {
                    const lvl = r.overall_level || '—';
                    const color = CEFR_COLORS[lvl] || '#9CA3AF';
                    const dateStr = r.taken_at
                      ? new Date(r.taken_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : '';
                    const skills = r.skill_levels || {};
                    return (
                      <TouchableOpacity
                        key={r.id || i}
                        style={styles.historyRow}
                        activeOpacity={0.85}
                        onPress={() => {
                          setViewingHistoryResult(r);
                          setHistoryDetailTab('summary');
                          setPhase('history');
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={[styles.historyLevelBadge, { backgroundColor: color }]}>
                            <SafeText style={styles.historyLevelText}>{lvl}</SafeText>
                          </View>
                          <View style={styles.historyRowBody}>
                            <SafeText style={styles.historyDate}>{dateStr}</SafeText>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: langColor }]}
            onPress={() => { setIsPracticeMode(false); generateTest(); }}
          >
            <SafeText style={styles.startBtnText}>
              {previousResult ? 'Retake Placement Test' : 'Start Placement Test'}
            </SafeText>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── History detail: view a past result ──
  if (phase === 'history' && viewingHistoryResult) {
    const r = viewingHistoryResult;
    const normalised = {
      ...r,
      overall_cefr_level: r.overall_cefr_level || r.overall_level,
      areas_for_improvement: r.areas_for_improvement || r.improvements || [],
      strengths: r.strengths || [],
    };
    const histColor = CEFR_COLORS[normalised.overall_cefr_level] || '#4A90E2';
    const histDate = r.taken_at
      ? new Date(r.taken_at).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '';

    const storedTestData = r.test_data || {};
    const storedAnswers = r.answers || {};
    const itemFeedback = r.item_feedback || normalised.item_feedback || {};

    // All items including passages/transcripts (needed for audio players + context)
    const allSectionItems = [];
    for (const section of (storedTestData.sections || [])) {
      const meta = SECTION_META[section.section_id] || {};
      for (const item of (section.items || [])) {
        allSectionItems.push({ ...item, _section_meta: meta });
      }
    }
    const reviewItems = allSectionItems.filter(i => i.type !== 'passage' && i.type !== 'transcript');
    const transcriptItems = allSectionItems.filter(i => i.type === 'transcript');

    const HIST_SKILLS = [
      { key: 'reading', icon: 'book-outline', label: 'Reading' },
      { key: 'listening', icon: 'headset-outline', label: 'Listening' },
      { key: 'writing', icon: 'create-outline', label: 'Writing' },
      { key: 'speaking', icon: 'mic-outline', label: 'Speaking' },
      { key: 'vocabulary_grammar', icon: 'library-outline', label: 'Vocab/Grammar' },
      { key: 'translation', icon: 'language-outline', label: 'Translation' },
    ];

    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: histColor, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => setPhase('intro')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <SafeText style={styles.headerTitle}>{histDate}</SafeText>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab bar */}
        <View style={styles.historyTabBar}>
          <TouchableOpacity
            style={[styles.historyTab, historyDetailTab === 'summary' && [styles.historyTabActive, { borderBottomColor: histColor }]]}
            onPress={() => setHistoryDetailTab('summary')}
          >
            <Ionicons name="bar-chart-outline" size={16} color={historyDetailTab === 'summary' ? histColor : '#9CA3AF'} />
            <SafeText style={[styles.historyTabText, historyDetailTab === 'summary' && { color: histColor }]}>Results</SafeText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.historyTab, historyDetailTab === 'answers' && [styles.historyTabActive, { borderBottomColor: histColor }]]}
            onPress={() => setHistoryDetailTab('answers')}
          >
            <Ionicons name="list-outline" size={16} color={historyDetailTab === 'answers' ? histColor : '#9CA3AF'} />
            <SafeText style={[styles.historyTabText, historyDetailTab === 'answers' && { color: histColor }]}>Question Review</SafeText>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }}>
          {historyDetailTab === 'summary' ? (
            <>
              {/* Hero — same as ResultsScreen */}
              <View style={[styles.resultHero, { backgroundColor: histColor }]}>
                <SafeText style={styles.resultHeroLabel}>CEFR Level</SafeText>
                <SafeText style={styles.resultLevel}>{normalised.overall_cefr_level || '—'}</SafeText>
                <SafeText style={styles.resultLanguage}>{language.charAt(0).toUpperCase() + language.slice(1)}</SafeText>
              </View>

              {/* Skill breakdown */}
              <View style={styles.card}>
                <SafeText style={styles.cardTitle}>Skill Breakdown</SafeText>
                {HIST_SKILLS.map(s => {
                  const lvl = (normalised.skill_levels || {})[s.key] || '—';
                  const score = (normalised.skill_scores || {})[s.key];
                  const c = CEFR_COLORS[lvl] || '#9CA3AF';
                  return (
                    <View key={s.key} style={styles.skillRow}>
                      <Ionicons name={s.icon} size={20} color={c} style={styles.skillIcon} />
                      <SafeText style={styles.skillLabel}>{s.label}</SafeText>
                      <View style={[styles.skillBadge, { backgroundColor: c }]}>
                        <SafeText style={styles.skillBadgeText}>{lvl}</SafeText>
                      </View>
                      {score !== undefined && <SafeText style={styles.skillScore}>{Math.round(score)}%</SafeText>}
                    </View>
                  );
                })}
              </View>

              {/* Level breakdown bars */}
              {Object.keys(normalised.level_breakdown || {}).length > 0 && (
                <View style={styles.card}>
                  <SafeText style={styles.cardTitle}>Level-by-Level Score</SafeText>
                  {['A0','A1','A2','B1','B2','C1'].map(lvl => {
                    const info = (normalised.level_breakdown || {})[lvl];
                    if (!info) return null;
                    const pct = Math.min(100, Math.max(0, info.score || 0));
                    const c = CEFR_COLORS[lvl] || '#9CA3AF';
                    return (
                      <View key={lvl} style={styles.breakdownRow}>
                        <View style={[styles.breakdownBadge, { backgroundColor: c }]}>
                          <SafeText style={styles.breakdownBadgeText}>{lvl}</SafeText>
                        </View>
                        <View style={styles.breakdownBarContainer}>
                          <View style={[styles.breakdownBar, { width: `${pct}%`, backgroundColor: c }]} />
                        </View>
                        <SafeText style={styles.breakdownPct}>{Math.round(pct)}%</SafeText>
                        {info.passed && <Ionicons name="checkmark-circle" size={16} color="#10B981" style={styles.breakdownCheck} />}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Strengths */}
              {normalised.strengths.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="barbell-outline" size={18} color="#10B981" />
                    <SafeText style={styles.cardTitle}>Strengths</SafeText>
                  </View>
                  {normalised.strengths.map((s, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <SafeText style={styles.bulletText}>{s}</SafeText>
                    </View>
                  ))}
                </View>
              )}

              {/* Areas to improve */}
              {normalised.areas_for_improvement.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="trending-up-outline" size={18} color="#F59E0B" />
                    <SafeText style={styles.cardTitle}>Areas to Improve</SafeText>
                  </View>
                  {normalised.areas_for_improvement.map((s, i) => (
                    <View key={i} style={styles.bulletRow}>
                      <Ionicons name="arrow-forward-circle" size={16} color="#F59E0B" />
                      <SafeText style={styles.bulletText}>{s}</SafeText>
                    </View>
                  ))}
                </View>
              )}

              {/* Recommendation */}
              {!!normalised.recommendation && (
                <View style={[styles.card, styles.recommendationCard]}>
                  <View style={styles.cardTitleRow}>
                    <Ionicons name="clipboard-outline" size={18} color="#4A90E2" />
                    <SafeText style={styles.cardTitle}>Recommendation</SafeText>
                  </View>
                  <SafeText style={styles.recommendationText}>{normalised.recommendation}</SafeText>
                </View>
              )}

              {/* SRS Calibration — show word counts that were set */}
              {(() => {
                const srs = r.srs_calibration || {};
                const byLevel = srs.by_level || {};
                const hasData = srs.updated > 0 || Object.keys(byLevel).length > 0;
                if (!hasData) return null;
                const SRS_BUCKETS = [
                  { key: 'review',   label: 'Review',    icon: 'checkmark-circle-outline', color: '#10B981' },
                  { key: 'learning', label: 'Learning',  icon: 'school-outline',            color: '#3B82F6' },
                  { key: 'new',      label: 'Queued',    icon: 'time-outline',              color: '#9CA3AF' },
                  { key: 'mastered', label: 'Mastered',  icon: 'trophy-outline',            color: '#F59E0B' },
                ];
                return (
                  <View style={styles.card}>
                    <View style={styles.cardTitleRow}>
                      <Ionicons name="library-outline" size={18} color="#06B6D4" />
                      <SafeText style={styles.cardTitle}>Vocabulary Calibrated</SafeText>
                    </View>
                    <SafeText style={styles.srsCalibrationSubtitle}>
                      {srs.updated || 0} words updated for {srs.user_cefr_level || normalised.overall_cefr_level} level.
                      {srs.skipped ? ` ${srs.skipped} mastered words left untouched.` : ''}
                    </SafeText>
                    <View style={styles.srsCalibrationRow}>
                      {SRS_BUCKETS.map(({ key, label, icon, color: c }) => {
                        const n = byLevel[key] ?? 0;
                        if (!n) return null;
                        return (
                          <View key={key} style={styles.srsCalibrationChip}>
                            <Ionicons name={icon} size={18} color={c} />
                            <SafeText style={[styles.srsCalibrationCount, { color: c }]}>{n}</SafeText>
                            <SafeText style={styles.srsCalibrationLabel}>{label}</SafeText>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}
            </>
          ) : (
            /* ── Question-by-question review tab ── */
            /* Render section by section so transcripts appear directly above their questions */
            <>
              {(storedTestData.sections || []).map(section => {
                const meta = SECTION_META[section.section_id] || {};
                const sColor = meta.color || langColor;
                const sItems = section.items || [];
                const transcriptMap = {};
                sItems.filter(i => i.type === 'transcript').forEach(t => { transcriptMap[t.item_id] = t; });
                const questionItems = sItems.filter(i => i.type !== 'passage' && i.type !== 'transcript');
                if (questionItems.length === 0 && Object.keys(transcriptMap).length === 0) return null;

                return (
                  <View key={section.section_id} style={[styles.card]}>
                    {/* Section header */}
                    <View style={[styles.cardTitleRow, { marginBottom: 10 }]}>
                      <Ionicons name={meta.icon || 'help-outline'} size={16} color={sColor} />
                      <SafeText style={[styles.cardTitle, { color: sColor }]}>{meta.label || section.section_id}</SafeText>
                    </View>

                    {/* Passage cards */}
                    {sItems.filter(i => i.type === 'passage').map(passage => (
                      <View key={passage.item_id} style={[styles.passageCard, { borderColor: sColor + '40', borderWidth: 1, marginBottom: 12 }]}>
                        <View style={[styles.passageHeader, { backgroundColor: sColor }]}>
                          <Ionicons name="document-text-outline" size={16} color="#FFF" />
                          <SafeText style={styles.passageHeaderText}>{passage.passage_title || 'Passage'}</SafeText>
                        </View>
                        <SafeText style={styles.passageText}>{passage.passage_text}</SafeText>
                      </View>
                    ))}

                    {/* For listening: transcript + dialogue + audio player, then its questions */}
                    {Object.values(transcriptMap).map(transcript => {
                      const tAudio = listeningAudio[transcript.item_id];
                      const speakerColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];
                      const hasSpeakers = transcript.speakers && transcript.speakers.length > 0;
                      const hasDialogue = transcript.dialogue && transcript.dialogue.length > 0;
                      const transcriptQuestions = questionItems.filter(q => q.refers_to_transcript === transcript.item_id);

                      return (
                        <View key={transcript.item_id}>
                          {/* Transcript card */}
                          <View style={[{ borderRadius: 12, borderWidth: 1.5, borderColor: sColor + '50', backgroundColor: sColor + '08', padding: 12, marginBottom: 10 }]}>
                            <View style={styles.cardTitleRow}>
                              <Ionicons name="headset-outline" size={14} color={sColor} />
                              <SafeText style={[{ fontSize: 13, fontWeight: '700', color: sColor }]}>
                                {transcript.transcript_title || 'Listening Transcript'}
                              </SafeText>
                            </View>

                            {/* Speaker legend */}
                            {hasSpeakers && (
                              <View style={styles.speakerLegend}>
                                {transcript.speakers.map((sp, i) => (
                                  <View key={i} style={styles.speakerLegendItem}>
                                    <Ionicons name={sp.gender === 'male' ? 'man-outline' : 'woman-outline'} size={13} color={speakerColors[i % speakerColors.length]} />
                                    <SafeText style={[styles.speakerLegendName, { color: speakerColors[i % speakerColors.length] }]}>{sp.name}</SafeText>
                                  </View>
                                ))}
                              </View>
                            )}

                            {/* Dialogue bubbles */}
                            {hasDialogue && (
                              <View style={[styles.dialoguePreview, { marginTop: 8 }]}>
                                {transcript.dialogue.map((line, i) => {
                                  const color = speakerColors[line.speaker_index % speakerColors.length];
                                  const sp = transcript.speakers?.[line.speaker_index];
                                  const isRight = line.speaker_index % 2 === 1;
                                  return (
                                    <View key={i} style={[styles.dialogueLine, isRight && styles.dialogueLineRight]}>
                                      {!isRight && <Ionicons name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'} size={13} color={color} style={{ marginTop: 3 }} />}
                                      <View style={[styles.dialogueBubble, { backgroundColor: color + '18', borderColor: color + '40' }, isRight && styles.dialogueBubbleRight]}>
                                        <SafeText style={styles.dialogueBubbleText}>{line.text}</SafeText>
                                      </View>
                                      {isRight && <Ionicons name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'} size={13} color={color} style={{ marginTop: 3 }} />}
                                    </View>
                                  );
                                })}
                              </View>
                            )}

                            {/* Audio player — only use cached audio, offer load if not present */}
                            <View style={[styles.audioControls, { paddingHorizontal: 0, paddingTop: 10 }]}>
                              {!tAudio ? (
                                <TouchableOpacity
                                  style={[styles.audioPlayBtn, { backgroundColor: sColor }]}
                                  onPress={() => loadListeningAudio(transcript)}
                                >
                                  <Ionicons name="play-circle" size={20} color="#FFF" />
                                  <SafeText style={styles.audioPlayBtnText}>Load Audio</SafeText>
                                </TouchableOpacity>
                              ) : tAudio.loading ? (
                                <View style={styles.audioLoadingRow}>
                                  <ActivityIndicator size="small" color={sColor} />
                                  <SafeText style={[styles.audioLoadingText, { color: sColor }]}>Preparing…</SafeText>
                                </View>
                              ) : tAudio.error ? (
                                <TouchableOpacity onPress={() => { audioFetchedRef.current[transcript.item_id] = false; loadListeningAudio(transcript); }}>
                                  <SafeText style={{ color: '#EF4444', fontSize: 13 }}>Retry audio</SafeText>
                                </TouchableOpacity>
                              ) : tAudio.audioBase64 ? (
                                <HistoryAudioPlayer audioBase64={tAudio.audioBase64} mimeType="audio/wav" color={sColor} label="Play Conversation" />
                              ) : null}
                            </View>
                          </View>

                          {/* Questions for this transcript */}
                          {transcriptQuestions.map(item => renderHistoryReviewItem(item, storedAnswers, itemFeedback, sColor, { hideCefrBadge: true }))}
                        </View>
                      );
                    })}

                    {/* Non-transcript questions (reading MCQ, vocab, translation, speaking, writing) */}
                    {questionItems
                      .filter(q => !q.refers_to_transcript)
                      .map(item => renderHistoryReviewItem(item, storedAnswers, itemFeedback, sColor, { hideCefrBadge: true }))}
                  </View>
                );
              })}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  if (phase === 'loading') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: langColor, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <SafeText style={styles.headerTitle}>{isPracticeMode ? 'Practice Test' : 'Generating Test'}</SafeText>
          <View style={{ width: 40 }} />
        </View>
        <ProgressScreen
          color={langColor}
          mode="generate"
          title="Building your placement test"
          serverStatus={serverStatus}
        />
      </View>
    );
  }

  if (phase === 'submitting') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: langColor, paddingTop: insets.top + 8 }]}>
          <View style={{ width: 40 }} />
          <SafeText style={styles.headerTitle}>Analysing Answers</SafeText>
          <View style={{ width: 40 }} />
        </View>
        <ProgressScreen
          color={langColor}
          mode="submit"
          title={isPracticeMode ? 'Analysing Practice Run' : 'Determining your CEFR level'}
          serverStatus={serverStatus}
        />
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: '#EF4444', paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => setPhase('intro')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <SafeText style={styles.headerTitle}>Error</SafeText>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.errorContent}>
          <Ionicons name="alert-circle-outline" size={56} color="#EF4444" style={{ alignSelf: 'center', marginBottom: 12 }} />
          <SafeText style={styles.errorTitle}>{errorMsg || 'Something went wrong'}</SafeText>
          {!!errorDetail && (
            <View style={styles.errorDetailBox}>
              <SafeText style={styles.errorDetailLabel}>Details</SafeText>
              <SafeText style={styles.errorDetailText} selectable>{errorDetail}</SafeText>
            </View>
          )}
          <SafeText style={styles.errorHint}>
            This is usually caused by the AI model returning unexpected formatting.
            The error details above can help diagnose the issue.
          </SafeText>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: langColor, alignSelf: 'center' }]} onPress={generateTest}>
            <SafeText style={styles.retryBtnText}>Try Again</SafeText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#6B7280', alignSelf: 'center', marginTop: 8 }]} onPress={() => setPhase('intro')}>
            <SafeText style={styles.retryBtnText}>Go Back</SafeText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (phase === 'results' && result) {
    const goBackToIntro = async () => {
      // Refresh history so the new result shows up immediately
      try {
        const [latestRes, historyRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/placement-test/latest/${language}`),
          fetch(`${API_BASE_URL}/api/placement-test/history/${language}`),
        ]);
        if (latestRes.ok) setPreviousResult((await latestRes.json()).result || null);
        if (historyRes.ok) setAllResults((await historyRes.json()).results || []);
      } catch (_) {}
      setResult(null);
      setSrsCalibration(null);
      setPhase('intro');
    };
    const resColor = CEFR_COLORS[result.overall_cefr_level] || langColor;
    const storedTestData = testData || {};
    const storedAnswers = answers || {};
    const itemFeedback = result.item_feedback || {};

    return (
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: resColor, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <SafeText style={styles.headerTitle}>Your Results</SafeText>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab bar — same as history detail */}
        <View style={styles.historyTabBar}>
          <TouchableOpacity
            style={[styles.historyTab, resultsDetailTab === 'summary' && [styles.historyTabActive, { borderBottomColor: resColor }]]}
            onPress={() => setResultsDetailTab('summary')}
          >
            <Ionicons name="bar-chart-outline" size={16} color={resultsDetailTab === 'summary' ? resColor : '#9CA3AF'} />
            <SafeText style={[styles.historyTabText, resultsDetailTab === 'summary' && { color: resColor }]}>Results</SafeText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.historyTab, resultsDetailTab === 'answers' && [styles.historyTabActive, { borderBottomColor: resColor }]]}
            onPress={() => setResultsDetailTab('answers')}
          >
            <Ionicons name="list-outline" size={16} color={resultsDetailTab === 'answers' ? resColor : '#9CA3AF'} />
            <SafeText style={[styles.historyTabText, resultsDetailTab === 'answers' && { color: resColor }]}>Question Review</SafeText>
          </TouchableOpacity>
        </View>

        {resultsDetailTab === 'summary' ? (
          <ResultsScreen
            result={result}
            srsCalibration={srsCalibration}
            language={language}
            isPractice={isPracticeMode}
            onRetake={() => { goBackToIntro(); }}
            onDone={() => navigation.goBack()}
          />
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {(storedTestData.sections || []).map(section => {
              const meta = SECTION_META[section.section_id] || {};
              const sColor = meta.color || langColor;
              const sItems = section.items || [];
              const transcriptMap = {};
              sItems.filter(i => i.type === 'transcript').forEach(t => { transcriptMap[t.item_id] = t; });
              const questionItems = sItems.filter(i => i.type !== 'passage' && i.type !== 'transcript');
              if (questionItems.length === 0 && Object.keys(transcriptMap).length === 0) return null;

              return (
                <View key={section.section_id} style={[styles.card]}>
                  <View style={[styles.cardTitleRow, { marginBottom: 10 }]}>
                    <Ionicons name={meta.icon || 'help-outline'} size={16} color={sColor} />
                    <SafeText style={[styles.cardTitle, { color: sColor }]}>{meta.label || section.section_id}</SafeText>
                  </View>

                  {sItems.filter(i => i.type === 'passage').map(passage => (
                    <View key={passage.item_id} style={[styles.passageCard, { borderColor: sColor + '40', borderWidth: 1, marginBottom: 12 }]}>
                      <View style={[styles.passageHeader, { backgroundColor: sColor }]}>
                        <Ionicons name="document-text-outline" size={16} color="#FFF" />
                        <SafeText style={styles.passageHeaderText}>{passage.passage_title || 'Passage'}</SafeText>
                      </View>
                      <SafeText style={styles.passageText}>{passage.passage_text}</SafeText>
                    </View>
                  ))}

                  {Object.values(transcriptMap).map(transcript => {
                    const tAudio = listeningAudio[transcript.item_id];
                    const speakerColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];
                    const hasSpeakers = transcript.speakers && transcript.speakers.length > 0;
                    const hasDialogue = transcript.dialogue && transcript.dialogue.length > 0;
                    const transcriptQuestions = questionItems.filter(q => q.refers_to_transcript === transcript.item_id);

                    return (
                      <View key={transcript.item_id}>
                        <View style={[{ borderRadius: 12, borderWidth: 1.5, borderColor: sColor + '50', backgroundColor: sColor + '08', padding: 12, marginBottom: 10 }]}>
                          <View style={styles.cardTitleRow}>
                            <Ionicons name="headset-outline" size={14} color={sColor} />
                            <SafeText style={[{ fontSize: 13, fontWeight: '700', color: sColor }]}>{transcript.transcript_title || 'Listening Transcript'}</SafeText>
                          </View>
                          {hasSpeakers && (
                            <View style={styles.speakerLegend}>
                              {transcript.speakers.map((sp, i) => (
                                <View key={i} style={styles.speakerLegendItem}>
                                  <Ionicons name={sp.gender === 'male' ? 'man-outline' : 'woman-outline'} size={13} color={speakerColors[i % speakerColors.length]} />
                                  <SafeText style={[styles.speakerLegendName, { color: speakerColors[i % speakerColors.length] }]}>{sp.name}</SafeText>
                                </View>
                              ))}
                            </View>
                          )}
                          {hasDialogue && (
                            <View style={[styles.dialoguePreview, { marginTop: 8 }]}>
                              {transcript.dialogue.map((line, i) => {
                                const color = speakerColors[line.speaker_index % speakerColors.length];
                                const sp = transcript.speakers?.[line.speaker_index];
                                const isRight = line.speaker_index % 2 === 1;
                                return (
                                  <View key={i} style={[styles.dialogueLine, isRight && styles.dialogueLineRight]}>
                                    {!isRight && <Ionicons name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'} size={13} color={color} style={{ marginTop: 3 }} />}
                                    <View style={[styles.dialogueBubble, { backgroundColor: color + '18', borderColor: color + '40' }, isRight && styles.dialogueBubbleRight]}>
                                      <SafeText style={styles.dialogueBubbleText}>{line.text}</SafeText>
                                    </View>
                                    {isRight && <Ionicons name={sp?.gender === 'male' ? 'man-outline' : 'woman-outline'} size={13} color={color} style={{ marginTop: 3 }} />}
                                  </View>
                                );
                              })}
                            </View>
                          )}
                          <View style={[styles.audioControls, { paddingHorizontal: 0, paddingTop: 10 }]}>
                            {!tAudio ? (
                              <TouchableOpacity style={[styles.audioPlayBtn, { backgroundColor: sColor }]} onPress={() => loadListeningAudio(transcript)}>
                                <Ionicons name="play-circle" size={20} color="#FFF" />
                                <SafeText style={styles.audioPlayBtnText}>Load Audio</SafeText>
                              </TouchableOpacity>
                            ) : tAudio.loading ? (
                              <View style={styles.audioLoadingRow}>
                                <ActivityIndicator size="small" color={sColor} />
                                <SafeText style={[styles.audioLoadingText, { color: sColor }]}>Preparing…</SafeText>
                              </View>
                            ) : tAudio.error ? (
                              <TouchableOpacity onPress={() => { audioFetchedRef.current[transcript.item_id] = false; loadListeningAudio(transcript); }}>
                                <SafeText style={{ color: '#EF4444', fontSize: 13 }}>Retry audio</SafeText>
                              </TouchableOpacity>
                            ) : tAudio.audioBase64 ? (
                              <HistoryAudioPlayer audioBase64={tAudio.audioBase64} mimeType="audio/wav" color={sColor} label="Play Conversation" />
                            ) : null}
                          </View>
                        </View>
                        {transcriptQuestions.map(item => renderHistoryReviewItem(item, storedAnswers, itemFeedback, sColor))}
                      </View>
                    );
                  })}

                  {questionItems.filter(q => !q.refers_to_transcript).map(item => renderHistoryReviewItem(item, storedAnswers, itemFeedback, sColor))}
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

      </View>
    );
  }

  // ── Test phase ──
  const item = flatItems[currentIdx];
  if (!item) return null;

  const total = flatItems.length;
  const progress = (currentIdx / total) * 100;
  const secMeta = item._section_meta || {};
  const sectionColor = secMeta.color || langColor;
  const contextItems = getContextItems(currentIdx);
  const canProceed = (() => {
    if (item.type === 'multiple_choice' || item.type === 'translation_choice' || item.type === 'translation_choice_reverse') return answers[item.item_id] !== undefined;
    if (item.type === 'free_response' || item.type === 'speaking_prompt') return true; // optional
    return true; // passage / transcript
  })();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: sectionColor, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => setPhase('intro')} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name={secMeta.icon || 'help-outline'} size={18} color="#FFF" style={{ marginRight: 6 }} />
          <SafeText style={styles.headerTitle}>{secMeta.label || 'Question'}</SafeText>
        </View>
        <SafeText style={styles.headerCounter}>{currentIdx + 1}/{total}</SafeText>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: sectionColor }]} />
      </View>

      <ScrollView
        style={styles.testScroll}
        contentContainerStyle={styles.testContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* CEFR target badge */}
        {item.cefr_target && (
          <View style={[styles.cefrBadge, { backgroundColor: CEFR_COLORS[item.cefr_target] || '#9CA3AF' }]}>
            <SafeText style={styles.cefrBadgeText}>{item.cefr_target}</SafeText>
          </View>
        )}

        {/* Context passage / transcript if needed */}
        {contextItems.map(ctx => (
          <Animated.View key={ctx.item_id} style={{ transform: [{ translateY: slideAnim }] }}>
            {renderItem(ctx)}
          </Animated.View>
        ))}

        {/* Main item */}
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {(item.type !== 'passage' && item.type !== 'transcript') && renderItem(item)}
          {(item.type === 'passage' || item.type === 'transcript') && contextItems.length === 0 && renderItem(item)}
        </Animated.View>
      </ScrollView>

      {/* Nav buttons */}
      <View style={styles.navRow}>
        {currentIdx > 0 ? (
          <TouchableOpacity style={styles.prevBtn} onPress={goPrev}>
            <Ionicons name="arrow-back" size={20} color="#4A90E2" />
            <SafeText style={styles.prevBtnText}>Back</SafeText>
          </TouchableOpacity>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: sectionColor, opacity: canProceed ? 1 : 0.5 }]}
          onPress={goNext}
          disabled={!canProceed}
        >
          <SafeText style={styles.nextBtnText}>
            {currentIdx === total - 1 ? 'Submit' : 'Next'}
          </SafeText>
          <Ionicons name={currentIdx === total - 1 ? 'checkmark' : 'arrow-forward'} size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#FFF' },
  headerCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  headerCounter: { width: 40, textAlign: 'right', fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  // Progress bar
  progressBarTrack: { height: 4, backgroundColor: '#E5E7EB' },
  progressBarFill: { height: 4 },

  // Intro
  introContent: { padding: 24, alignItems: 'center' },
  langBadge: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: 12 },
  langBadgeChar: { fontSize: 32, color: '#FFF', fontWeight: '500' },
  langBadgeText: { fontSize: 18, fontWeight: 'bold', color: '#FFF', letterSpacing: 1 },
  introTitle: { fontSize: 26, fontWeight: '800', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  introSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 28 },

  skillList: { width: '100%', marginBottom: 24 },
  skillListRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  skillListIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  skillListLabel: { fontSize: 16, color: '#374151', fontWeight: '500' },

  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, marginBottom: 10, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  infoText: { fontSize: 14, color: '#374151', flexShrink: 1 },

  // History list on intro screen
  historySection: { width: '100%', marginTop: 6, marginBottom: 10 },
  showHistoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4, marginBottom: 10 },
  showHistoryBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280', flex: 1 },
  historySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  historySectionTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  historyLevelBadge: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyLevelText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  historyRowBody: { flex: 1, marginLeft: 12 },
  historyDate: { fontSize: 13, fontWeight: '600', color: '#1F2937', marginBottom: 5 },
  historySkillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  historySkillChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  historySkillChipText: { fontSize: 11, fontWeight: '700' },
  practiceRetakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  practiceRetakeBtnText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  headerActionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  srsCalibrationSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  srsCalibrationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  srsCalibrationChip: { alignItems: 'center', gap: 4, minWidth: 64 },
  srsCalibrationCount: { fontSize: 22, fontWeight: '900' },
  srsCalibrationLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase' },
  historyTabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  historyTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  historyTabActive: { borderBottomWidth: 2 },
  historyTabText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  audioControls: { paddingHorizontal: 14, paddingVertical: 10 },
  audioPlayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start' },
  audioPlayBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  audioLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  audioLoadingText: { fontSize: 13, fontWeight: '500' },

  // Legacy prev result styles (kept for safety)
  prevResultBox: { width: '100%', borderWidth: 2, borderRadius: 14, padding: 16, marginVertical: 16, alignItems: 'center', backgroundColor: '#FFF' },
  prevResultLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  prevResultLevel: { fontSize: 36, fontWeight: '900', marginBottom: 2 },
  prevResultDate: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  viewPrevBtn: { fontSize: 13, color: '#4A90E2', fontWeight: '600' },

  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, marginTop: 8, width: '100%' },
  startBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },

  // Test
  testScroll: { flex: 1 },
  testContent: { padding: 20, paddingBottom: 40 },
  cefrBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  cefrBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  // Passage / transcript
  passageCard: { backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  passageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  passageHeaderText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  speakerLabel: { fontSize: 12, color: '#6B7280', paddingHorizontal: 14, paddingTop: 8, fontStyle: 'italic' },
  speakerLegend: { flexDirection: 'row', gap: 14, paddingHorizontal: 14, paddingTop: 10, flexWrap: 'wrap' },
  speakerLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  speakerLegendName: { fontSize: 13, fontWeight: '600' },
  dialoguePreview: { paddingHorizontal: 10, paddingTop: 8, gap: 8 },
  dialogueLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, maxWidth: '85%' },
  dialogueLineRight: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  dialogueBubble: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  dialogueBubbleRight: { borderBottomRightRadius: 4 },
  dialogueBubbleText: { fontSize: 15, color: '#1F2937', lineHeight: 22 },
  passageText: { fontSize: 16, lineHeight: 26, color: '#1F2937', padding: 14 },

  // Audio player (listening)
  audioPlayerCard: { backgroundColor: '#FFF', borderRadius: 14, overflow: 'hidden', marginBottom: 20, borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  audioPlayerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  audioControls: { padding: 16, alignItems: 'center' },
  audioPlayBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 30 },
  audioPlayBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  audioLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  audioLoadingText: { fontSize: 14, fontWeight: '500' },
  audioErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioErrorText: { fontSize: 14, color: '#EF4444', flex: 1 },
  audioRetryBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  audioRetryText: { fontSize: 14, fontWeight: '600' },

  // Translation
  translationSourceBox: { borderWidth: 2, borderRadius: 14, padding: 18, marginBottom: 14, backgroundColor: '#FFF', alignItems: 'center' },
  translationSourceText: { fontSize: 26, fontWeight: '700', color: '#111827', textAlign: 'center', lineHeight: 36 },

  // MCQ
  questionText: { fontSize: 18, fontWeight: '600', color: '#111827', lineHeight: 28, marginBottom: 20 },
  questionEnText: { fontSize: 14, color: '#6B7280', marginBottom: 8, fontStyle: 'italic', lineHeight: 20 },
  optionsContainer: { gap: 10 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, backgroundColor: '#FFF' },
  optionNumber: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  optionNumberText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  optionCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
  optionText: { flex: 1, fontSize: 16, color: '#374151', lineHeight: 22 },

  // Free response / speaking
  textInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16, color: '#1F2937', backgroundColor: '#FFF', minHeight: 120, marginTop: 8 },
  wordHint: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  speakingNote: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 12, marginBottom: 4 },
  speakingNoteText: { fontSize: 13, flexShrink: 1 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 4 },
  recordBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 24 },
  recordBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  recordHint: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  audioRecordedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, marginBottom: 4, flexWrap: 'wrap' },
  audioRecordedText: { fontSize: 14, fontWeight: '600', flex: 1 },
  audioRecordedBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  audioRecordedBtnText: { fontSize: 13, fontWeight: '600' },

  // Nav
  navRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  prevBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#4A90E2' },
  prevBtnText: { fontSize: 16, color: '#4A90E2', fontWeight: '600' },
  nextBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Loading / error
  loadingTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginTop: 20, textAlign: 'center' },
  loadingSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  errorTitle: { fontSize: 22, fontWeight: '800', color: '#EF4444', marginTop: 16, textAlign: 'center' },
  errorMsg: { fontSize: 14, color: '#6B7280', marginTop: 10, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 24, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
  retryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Progress screen
  progressScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  progressIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  progressTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  progressSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  progressBarTrack: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  progressStepText: {
    fontSize: 15,
    fontWeight: '600',
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 28,
  },
  progressDotWrap: {
    alignItems: 'center',
    gap: 4,
    minWidth: 48,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 5,
  },
  progressDotLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  progressPct: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
    marginTop: -8,
  },
  progressHint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Error screen
  errorContent: {
    padding: 24,
    paddingBottom: 48,
    alignItems: 'stretch',
  },
  errorDetailBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 14,
    marginTop: 16,
    marginBottom: 12,
  },
  errorDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  errorDetailText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },

  // Results
  resultsContent: { padding: 20, paddingBottom: 40 },
  resultHero: { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16 },
  resultHeroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  resultLevel: { fontSize: 72, fontWeight: '900', color: '#FFF', lineHeight: 80 },
  resultLanguage: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  resultSaved: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  resultSavedText: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

  // History review items
  reviewItem: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 10, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  reviewItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  reviewItemSection: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  reviewQuestion: { fontSize: 15, fontWeight: '600', color: '#111827', lineHeight: 22, marginBottom: 4 },
  reviewOption: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  reviewTextAnswer: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewTextAnswerText: { fontSize: 14, color: '#374151', lineHeight: 20, flex: 1 },
  reviewFeedbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8 },
  reviewFeedbackText: { fontSize: 13, color: '#6B7280', lineHeight: 19, flex: 1 },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },

  skillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  skillIcon: { marginRight: 10 },
  skillLabel: { flex: 1, fontSize: 15, color: '#374151' },
  skillBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 4 },
  skillBadgeText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  skillScore: { fontSize: 13, color: '#6B7280', width: 40, textAlign: 'right' },

  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  breakdownBadge: { width: 34, paddingVertical: 4, borderRadius: 6, alignItems: 'center', marginRight: 10 },
  breakdownBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  breakdownBarContainer: { flex: 1, height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden' },
  breakdownBar: { height: 10, borderRadius: 5 },
  breakdownPct: { width: 36, textAlign: 'right', fontSize: 12, color: '#6B7280' },
  breakdownCheck: { marginLeft: 6 },

  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  bulletText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },

  recommendationCard: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', borderWidth: 1 },
  recommendationText: { fontSize: 15, color: '#374151', lineHeight: 23 },

  // SRS calibration card
  srsCalibrationSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 14, lineHeight: 19 },
  srsCalibrationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  srsCalibrationChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  srsCalibrationCount: { fontSize: 15, fontWeight: '800' },
  srsCalibrationLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  srsCalibrationSkipped: { fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },

  resultActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  retakeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#4A90E2' },
  retakeBtnText: { fontSize: 15, color: '#4A90E2', fontWeight: '600' },
  doneBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
