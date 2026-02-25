import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../components/SafeText';
import { LanguageContext } from '../../contexts/LanguageContext';
import { useActivityData } from './shared/hooks/useActivityData';
import { useTransliteration } from './shared/hooks/useTransliteration';
import { useDictionary } from './shared/hooks/useDictionary';
import { ACTIVITY_COLORS, API_BASE_URL } from './shared/constants';
import { APIDebugModal, VocabularyDictionary } from './shared/components';
import TranslationToolModal from '../../components/TranslationToolModal';

export default function TransliterationActivity({ route, navigation }) {
  const { activityId, fromHistory, activityData: routeActivityData } = route.params || {};
  const { selectedLanguage: ctxLanguage } = useContext(LanguageContext);
  const routeLang = (route && route.params && route.params.language) || null;
  const language = routeLang || ctxLanguage || null;

  const activityData = useActivityData('transliteration', language, activityId, fromHistory, routeActivityData, null, null);
  const transliteration = useTransliteration(language, activityData.activity);
  const dictionary = useDictionary(language);

  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [showAPIDebug, setShowAPIDebug] = useState(false);
  const [userInputs, setUserInputs] = useState({});
  const [grading, setGrading] = useState(false);
  const [gradingResult, setGradingResult] = useState(null);

  const colors = ACTIVITY_COLORS.transliteration;

  useEffect(() => {
    if (!activityData.activity) return;
    // Ensure transliteration for supporting text only (do not transliterate sentences themselves)
    if (activityData.activity.activity_name) {
      transliteration.ensureNativeScriptForKey('activity_name', activityData.activity.activity_name);
      transliteration.ensureAndShowTransliterationForKey('activity_name', activityData.activity.activity_name);
    }
    if (activityData.activity.instructions) {
      transliteration.ensureNativeScriptForKey('instructions', activityData.activity.instructions);
      transliteration.ensureAndShowTransliterationForKey('instructions', activityData.activity.instructions);
    }
  }, [activityData.activity, language]);

  if (!language) {
    return (
      <View style={styles.centered}>
        <SafeText>No language selected.</SafeText>
      </View>
    );
  }

  if (activityData.loading || !activityData.activity) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <SafeText style={styles.loadingText}>{activityData.loadingStatus || 'Loading transliteration activity...'}</SafeText>
      </View>
    );
  }

  const { activity } = activityData;
  const items = activity.items || [];

  const handleInputChange = (id, text) => {
    setUserInputs(prev => ({ ...prev, [id]: text }));
  };

  const handleGradeAll = async () => {
    if (!items.length) return;
    setGrading(true);
    setGradingResult(null);
    try {
      const payload = {
        items: items.map(item => ({
          id: item.id,
          text: item.text,
          user_transliteration: userInputs[item.id] || '',
        })),
      };
      const res = await fetch(`${API_BASE_URL}/api/activity/transliteration/${language}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server error: ${res.status}`);
      }
      const data = await res.json();
      setGradingResult(data);
      // Store API details for debug modal
      if (data.api_details) {
        const apiCall = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          endpoint: data.api_details.endpoint || `POST /api/activity/transliteration/${language}/grade`,
          prompt: '',
          wordsUsed: [],
          responseTime: data.api_details.response_time || 0,
          rawResponse: data.api_details.raw_response || '',
          tokenInfo: data.api_details.token_info || {},
        };
        activityData.setAllApiDetails([apiCall]);
      }
    } catch (e) {
      alert(e.message || 'Failed to grade transliteration activity.');
    } finally {
      setGrading(false);
    }
  };

  const getItemResult = (id) => {
    if (!gradingResult || !gradingResult.items) return null;
    return gradingResult.items.find(it => it.id === id) || null;
  };

  const overallScore = gradingResult ? gradingResult.overall_score || 0 : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <SafeText style={styles.headerTitle}>
              {transliteration.nativeScriptRenderings.activity_name || activity.activity_name || 'Transliteration'}
            </SafeText>
            {transliteration.showTransliterations && transliteration.transliterations.activity_name && (
              <SafeText style={styles.headerSubtitle}>
                {transliteration.transliterations.activity_name}
              </SafeText>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.toggleButton, transliteration.showTransliterations && styles.toggleButtonActive]}
            onPress={() => transliteration.setShowTransliterations(!transliteration.showTransliterations)}
          >
            <Ionicons name={transliteration.showTransliterations ? 'text' : 'text-outline'} size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowTranslationModal(true)}
          >
            <Ionicons name="language" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => dictionary.setShowDictionary(true)}
          >
            <Ionicons name="book" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowAPIDebug(true)}
          >
            <Ionicons name="bug" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Instructions */}
        {activity.instructions && (
          <View style={styles.instructionsCard}>
            <SafeText style={styles.instructionsTitle}>
              {transliteration.nativeScriptRenderings.instructions || activity.instructions}
            </SafeText>
            {transliteration.showTransliterations && transliteration.transliterations.instructions && (
              <SafeText style={styles.instructionsTranslit}>
                {transliteration.transliterations.instructions}
              </SafeText>
            )}
          </View>
        )}

        {/* Overall score */}
        {overallScore !== null && (
          <View style={styles.scoreCard}>
            <SafeText style={styles.scoreLabel}>Overall Score</SafeText>
            <SafeText style={styles.scoreValue}>{overallScore}%</SafeText>
          </View>
        )}

        {/* Items */}
        {items.map(item => {
          const result = getItemResult(item.id);
          const isCorrect = result?.is_correct;
          return (
            <View key={item.id} style={styles.itemCard}>
              <SafeText style={styles.itemLabel}>Sentence {item.id}</SafeText>
              <SafeText style={styles.itemText}>{item.text}</SafeText>
              <TextInput
                style={styles.input}
                value={userInputs[item.id] || ''}
                onChangeText={text => handleInputChange(item.id, text)}
                placeholder="Type your transliteration here..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {result && (
                <View style={styles.feedbackSection}>
                  <SafeText style={[styles.feedbackLabel, isCorrect ? styles.correctText : styles.incorrectText]}>
                    {isCorrect ? 'Correct' : 'Try again'}
                  </SafeText>
                  <SafeText style={styles.feedbackExpected}>
                    Expected: {result.expected_transliteration || '—'}
                  </SafeText>
                  {result.user_transliteration && (
                    <SafeText style={styles.feedbackUser}>
                      Your answer: {result.user_transliteration}
                    </SafeText>
                  )}
                  {result.feedback && (
                    <SafeText style={styles.feedbackNote}>{result.feedback}</SafeText>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <SafeText>No sentences available for transliteration.</SafeText>
          </View>
        )}
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.gradeButton, (grading || !items.length) && styles.gradeButtonDisabled]}
          onPress={handleGradeAll}
          disabled={grading || !items.length}
        >
          {grading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-done-outline" size={20} color="#FFFFFF" />
              <Text style={styles.gradeButtonText}>Grade All</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <TranslationToolModal
        visible={showTranslationModal}
        onClose={() => setShowTranslationModal(false)}
        language={language}
        prefillText={null}
        onImportComplete={null}
      />
      <VocabularyDictionary
        visible={dictionary.showDictionary}
        onClose={() => dictionary.setShowDictionary(false)}
        language={language}
        initialSearchQuery=""
        dictionaryLanguage={language}
        setDictionaryLanguage={() => {}}
      />
      <APIDebugModal
        visible={showAPIDebug}
        onClose={() => setShowAPIDebug(false)}
        allApiDetails={activityData.allApiDetails}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#4B5563', textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 12, color: '#F9FAFB', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 88 },
  instructionsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  instructionsTitle: { fontSize: 14, color: '#111827' },
  instructionsTranslit: { fontSize: 12, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  scoreCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scoreLabel: { fontSize: 14, color: '#4B5563', fontWeight: '600' },
  scoreValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  itemText: { fontSize: 16, color: '#111827', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: '#111827',
    marginBottom: 8,
  },
  feedbackSection: { marginTop: 4 },
  feedbackLabel: { fontSize: 13, fontWeight: '600' },
  correctText: { color: '#059669' },
  incorrectText: { color: '#DC2626' },
  feedbackExpected: { fontSize: 12, color: '#4B5563', marginTop: 2 },
  feedbackUser: { fontSize: 12, color: '#4B5563', marginTop: 2 },
  feedbackNote: { fontSize: 12, color: '#6B7280', marginTop: 2, fontStyle: 'italic' },
  emptyState: { padding: 24, alignItems: 'center' },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  gradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EC4899',
    borderRadius: 999,
    paddingVertical: 10,
  },
  gradeButtonDisabled: {
    opacity: 0.6,
  },
  gradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

