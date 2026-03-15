import React, { useEffect, useMemo, useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../components/SafeText';
import { WORD_CLASSES, LEVELS, LEVEL_COLORS, MASTERY_FILTERS, VERB_TRANSITIVITY_FILTERS } from '../constants/filters';
import { LanguageContext } from '../contexts/LanguageContext';
import { AuthContext } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useImportJob } from '../contexts/ImportJobContext';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

const ORIGIN_STYLES = {
  default: { label: 'Original Set', bg: '#16A34A', text: '#FFFFFF' },
  activity: { label: 'Activity', bg: '#2563EB', text: '#FFFFFF' },
  deck: { label: 'Imported Deck', bg: '#7C3AED', text: '#FFFFFF' },
  user: { label: 'User Added', bg: '#6B7280', text: '#FFFFFF' },
};

const ORIGIN_FILTERS = [
  { value: 'default', label: 'Original Set', color: { bg: '#16A34A', text: '#FFFFFF' } },
  { value: 'activity', label: 'Activity', color: { bg: '#2563EB', text: '#FFFFFF' } },
  { value: 'deck', label: 'Imported Deck', color: { bg: '#7C3AED', text: '#FFFFFF' } },
  { value: 'user', label: 'User Added', color: { bg: '#6B7280', text: '#FFFFFF' } },
];

export default function DeckDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { deckId, deckName: initialDeckName, language } = route.params || {};
  const { availableLanguages } = useContext(LanguageContext);
  const { authHeaders } = useContext(AuthContext);

  const currentLanguage = availableLanguages?.find(l => l.code === language) || { name: language };

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState([]);
  const [deckMeta, setDeckMeta] = useState(null);
  const [search, setSearch] = useState('');
  const [wordClassFilter, setWordClassFilter] = useState([]); // multi-select
  const [levelFilter, setLevelFilter] = useState([]); // multi-select
  const [masteryFilter, setMasteryFilter] = useState([]); // multi-select
  const [transitivityFilter, setTransitivityFilter] = useState([]); // multi-select
  const [originFilter, setOriginFilter] = useState([]); // multi-select
  const [filtersAndStudyExpanded, setFiltersAndStudyExpanded] = useState(true); // collapsible block: Filters + study mode cards (default uncollapsed)
  const [deckName, setDeckName] = useState(initialDeckName || '');
  const [renaming, setRenaming] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameInput, setRenameInput] = useState('');

  // Multi-select cards for deletion (user-generated only)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedWordIds, setSelectedWordIds] = useState(new Set());
  const [deletingWords, setDeletingWords] = useState(false);
  const [showDeleteWordsConfirm, setShowDeleteWordsConfirm] = useState(false);

  // Review history modal state
  const [selectedWord, setSelectedWord] = useState(null);
  const [reviewHistory, setReviewHistory] = useState(null);
  const [showReviewHistory, setShowReviewHistory] = useState(false);
  const [siblingDecks, setSiblingDecks] = useState([]);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
  const [deleteSelectedDeckIds, setDeleteSelectedDeckIds] = useState(new Set());
  const [showDeleteChoiceModal, setShowDeleteChoiceModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmMode, setDeleteConfirmMode] = useState('single');

  const [addCardsModalVisible, setAddCardsModalVisible] = useState(false);
  const [addCardsTab, setAddCardsTab] = useState('manual');
  const [manualRows, setManualRows] = useState([{ english_word: '', translation: '', transliteration: '' }]);
  const [addingCards, setAddingCards] = useState(false);
  const importJob = useImportJob();

  const executeDeleteSingle = async () => {
    setShowDeleteConfirmModal(false);
    if (!deckId) return;
    try {
      await fetch(`${API_BASE_URL}/api/vocab/decks/${deckId}`, { method: 'DELETE', headers: { ...authHeaders } });
      navigation.goBack();
    } catch (e) {
      console.error('Error deleting deck:', e);
    }
  };

  const executeDeleteMulti = async () => {
    const selected = Array.from(deleteSelectedDeckIds);
    setShowDeleteConfirmModal(false);
    for (const id of selected) {
      try {
        await fetch(`${API_BASE_URL}/api/vocab/decks/${id}`, { method: 'DELETE', headers: { ...authHeaders } });
      } catch (e) {
        console.error('Error deleting deck:', e);
      }
    }
    navigation.goBack();
  };

  const openDeleteConfirmSingle = () => {
    setShowDeleteChoiceModal(false);
    setDeleteConfirmMode('single');
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteSelectedDecks = () => {
    const selected = Array.from(deleteSelectedDeckIds);
    if (selected.length === 0) return;
    setShowDeleteScopeModal(false);
    setDeleteConfirmMode('multi');
    setShowDeleteConfirmModal(true);
  };

  const openDeleteFlow = () => {
    if (!deckId) return;
    if (siblingDecks.length <= 1) {
      setDeleteConfirmMode('single');
      setShowDeleteConfirmModal(true);
      return;
    }
    setShowDeleteChoiceModal(true);
  };

  const toggleWordSelection = useCallback((wordId) => {
    setSelectedWordIds(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId); else next.add(wordId);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedWordIds(new Set());
  }, []);

  const handleDeleteSelectedWords = useCallback(async () => {
    setShowDeleteWordsConfirm(false);
    if (!deckId || selectedWordIds.size === 0) return;
    setDeletingWords(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vocab/decks/${deckId}/words`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ word_ids: Array.from(selectedWordIds) }),
      });
      if (!res.ok) throw new Error('Delete failed');
      await reloadDeckWords();
      exitSelectionMode();
    } catch (e) {
      console.error('Error deleting words:', e);
    } finally {
      setDeletingWords(false);
    }
  }, [deckId, selectedWordIds, reloadDeckWords, exitSelectionMode]);

  useEffect(() => {
    const loadDeck = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/vocab/decks/${deckId}/words?language=${language}`, { headers: { ...authHeaders } });
        const data = await res.json();
        setWords(data.words || []);
        setDeckMeta({
          import_duration_seconds: data.import_duration_seconds,
          created_at: data.created_at,
        });
        if (!deckName && data.deck_name) {
          setDeckName(data.deck_name);
        }
      } catch (e) {
        console.error('Error loading deck words for detail:', e);
      } finally {
        setLoading(false);
      }
    };
    if (deckId && language) {
      loadDeck();
    }
  }, [deckId, language]);

  const reloadDeckWords = useCallback(async () => {
    if (!deckId || !language) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/vocab/decks/${deckId}/words?language=${language}`, { headers: { ...authHeaders } });
      const data = await res.json();
      setWords(data.words || []);
      setDeckMeta(prev => ({
        ...prev,
        import_duration_seconds: data.import_duration_seconds,
        created_at: data.created_at,
      }));
    } catch (e) {
      console.error('Error reloading deck words:', e);
    }
  }, [deckId, language]);

  // Load sibling decks (same deck name, different languages)
  useEffect(() => {
    const loadSiblings = async () => {
      if (!deckId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/vocab/decks/${deckId}/siblings`, { headers: { ...authHeaders } });
        if (res.ok) {
          const data = await res.json();
          setSiblingDecks(data.decks || []);
        }
      } catch (e) {
        console.error('Error loading sibling decks:', e);
      }
    };
    loadSiblings();
  }, [deckId]);

  const presentPosSet = useMemo(
    () => new Set(words.map(w => (w.word_class || '').toLowerCase()).filter(Boolean)),
    [words],
  );
  const presentLvSet = useMemo(
    () => new Set(words.map(w => (w.level || '').toUpperCase()).filter(Boolean)),
    [words],
  );
  const presentVtSet = useMemo(
    () => new Set(
      words
        .map(w => (w.verb_transitivity || '').toLowerCase())
        .filter(v => v && v !== 'n/a'),
    ),
    [words],
  );
  const presentOriginSet = useMemo(
    () => new Set(words.map(w => (w.origin || '')).filter(Boolean)),
    [words],
  );

  const getMasteryColor = (masteryLevel) => {
    const filter = MASTERY_FILTERS.find(f => f.value === masteryLevel || (!masteryLevel && f.value === 'new'));
    return filter ? filter.color.bg : '#999999';
  };

  const getMasteryEmoji = (masteryLevel) => {
    const filter = MASTERY_FILTERS.find(f => f.value === masteryLevel || (!masteryLevel && f.value === 'new'));
    return filter ? filter.emoji : '●';
  };

  const fetchReviewHistory = async (wordId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/review-history/${wordId}`);
      if (!response.ok) throw new Error('Failed to fetch review history');
      const data = await response.json();
      setReviewHistory(data);
    } catch (error) {
      console.error('Error fetching review history:', error);
      Alert.alert('Error', 'Failed to load review history');
    }
  };

  const handleWordPress = async (word) => {
    setSelectedWord(word);
    setShowReviewHistory(true);
    await fetchReviewHistory(word.id);
  };

  const closeReviewHistory = () => {
    setShowReviewHistory(false);
    setSelectedWord(null);
    setReviewHistory(null);
  };

  const filteredWords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return words.filter(w => {
      const mastery = (w.mastery_level || 'new').toLowerCase();
      const isDue = w.next_review_date && new Date(w.next_review_date) <= now && mastery !== 'new';

      // Mastery/SRS filters (multi-select, "All" represented by empty array)
      if (masteryFilter.length > 0) {
        let matches = false;
        if (masteryFilter.includes('due') && isDue) {
          matches = true;
        }
        masteryFilter.forEach((val) => {
          if (!val || val === 'due') return;
          if (mastery === val) {
            matches = true;
          }
        });
        if (!matches) return false;
      }

      // Part of speech filters
      if (wordClassFilter.length > 0) {
        const wc = (w.word_class || '').toLowerCase();
        const matchesPos = wordClassFilter.some(f => f.toLowerCase() === wc);
        if (!matchesPos) return false;
      }

      // Level filters (uses LEVELS like A1, B2, etc.)
      if (levelFilter.length > 0) {
        const lvl = (w.level || '').toUpperCase();
        const matchesLevel = levelFilter.includes(lvl);
        if (!matchesLevel) return false;
      }

      // Verb transitivity filters
      if (transitivityFilter.length > 0) {
        const vt = (w.verb_transitivity || '').toLowerCase();
        const matchesTransitivity = transitivityFilter.some(f => f.toLowerCase() === vt);
        if (!matchesTransitivity) return false;
      }

      // Origin filters
      if (originFilter.length > 0) {
        const origin = w.origin || '';
        if (!originFilter.includes(origin)) return false;
      }

      if (!q) return true;
      const english = (w.english_word || '').toLowerCase();
      const native = (w.translation || '').toLowerCase();
      const translit = (w.transliteration || '').toLowerCase();
      return english.includes(q) || native.includes(q) || translit.includes(q);
    });
  }, [words, search, wordClassFilter, levelFilter, masteryFilter, transitivityFilter, originFilter]);

  const renderWordItem = ({ item }) => {
    const english = String(item.english_word ?? '');
    const native = language === 'urdu' && item.nastaliq
      ? String(item.nastaliq)
      : String(item.translation ?? '');
    const genderSuffix = (language === 'hindi' || language === 'urdu') && item.gender && /^[mf]$/i.test(String(item.gender))
      ? ` (${String(item.gender).toLowerCase()})`
      : '';
    const transliteration = String(item.transliteration ?? '');
    const isDue = item.next_review_date && new Date(item.next_review_date) <= new Date();
    const isUrdu = language === 'urdu';
    const isSelected = selectedWordIds.has(item.id);

    const cardContent = (
      <>
        {selectionMode && (
          <View style={[styles.wordCardCheckbox, isSelected && styles.wordCardCheckboxSelected]}>
            {isSelected ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}
          </View>
        )}
        <View style={[styles.wordCardContent, selectionMode && { marginLeft: 12 }]}>
        <View style={styles.wordHeader}>
          <View style={styles.wordMain}>
            <SafeText style={styles.englishWord}>{english}</SafeText>
            <SafeText style={[
              styles.translation,
              isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' },
            ]}>{native}{genderSuffix}</SafeText>
            {!!transliteration && (
              <SafeText style={styles.transliteration}>{transliteration}</SafeText>
            )}
          </View>
          <View style={styles.masteryBadgeContainer}>
            {!selectionMode && (
              <TouchableOpacity onPress={() => handleWordPress(item)} activeOpacity={0.7}>
                <View
                  style={[
                    styles.masteryBadge,
                    { backgroundColor: getMasteryColor(item.mastery_level) },
                  ]}
                >
                  <SafeText style={styles.masteryText}>
                    {getMasteryEmoji(item.mastery_level)}{' '}
                    {String(item.mastery_level?.toUpperCase() || 'NEW')}
                  </SafeText>
                </View>
              </TouchableOpacity>
            )}
            {selectionMode && (
              <View
                style={[
                  styles.masteryBadge,
                  { backgroundColor: getMasteryColor(item.mastery_level) },
                ]}
              >
                <SafeText style={styles.masteryText}>
                  {getMasteryEmoji(item.mastery_level)}{' '}
                  {String(item.mastery_level?.toUpperCase() || 'NEW')}
                </SafeText>
              </View>
            )}
            {isDue && (
              <View style={styles.dueBadge}>
                <Ionicons name="time-outline" size={10} color="#FFFFFF" />
                <SafeText style={styles.dueText}>DUE</SafeText>
              </View>
            )}
          </View>
        </View>
        <View style={styles.wordMeta}>
          {item.word_class ? (() => {
            const wc = WORD_CLASSES.find(
              x => x.value.toLowerCase() === item.word_class.toLowerCase(),
            );
            const color = wc ? wc.color : { bg: '#F5F5F5', text: '#666' };
            return (
              <View style={[styles.tag, { backgroundColor: color.bg }]}>
                <SafeText style={[styles.tagText, { color: color.text }]}>
                  {String(item.word_class)}
                </SafeText>
              </View>
            );
          })() : null}
          <View style={[
            styles.tag,
            {
              backgroundColor:
                LEVEL_COLORS[item.level?.toUpperCase()]?.bg || '#E5E7EB',
            },
          ]}>
            <SafeText
              style={[
                styles.tagText,
                {
                  color: LEVEL_COLORS[item.level?.toUpperCase()]?.text || '#6B7280',
                },
              ]}
            >
              {item.level ? String(item.level?.toUpperCase()) : '—'}
            </SafeText>
          </View>
          {item.verb_transitivity && item.verb_transitivity !== 'N/A' ? (() => {
            const vtFilter = VERB_TRANSITIVITY_FILTERS.find(
              f => f.value.toLowerCase() === item.verb_transitivity.toLowerCase(),
            );
            const vtColor = vtFilter ? vtFilter.color : { bg: '#6B7280', text: '#FFFFFF' };
            return (
              <View style={[styles.tag, { backgroundColor: vtColor.bg }]}>
                <SafeText style={[styles.tagText, { color: vtColor.text }]}>
                  {String(item.verb_transitivity).toLowerCase()}
                </SafeText>
              </View>
            );
          })() : null}
          <View style={{ flex: 1 }} />
          {item.is_translated === 1 && (
            <View style={[styles.tag, { backgroundColor: '#FDE68A' }]}>
              <SafeText style={[styles.tagText, { color: '#92400E' }]}>
                Translated
              </SafeText>
            </View>
          )}
          {item.origin ? (() => {
            const originMeta = ORIGIN_STYLES[item.origin] || ORIGIN_STYLES['default'];
            return (
              <View style={[styles.tag, { backgroundColor: originMeta.bg }]}>
                <SafeText style={[styles.tagText, { color: originMeta.text }]}>
                  {originMeta.label}
                </SafeText>
              </View>
            );
          })() : null}
        </View>
        </View>
      </>
    );

    if (selectionMode) {
      return (
        <TouchableOpacity
          style={[styles.wordCard, isSelected && styles.wordCardSelected]}
          onPress={() => toggleWordSelection(item.id)}
          activeOpacity={0.8}
        >
          {cardContent}
        </TouchableOpacity>
      );
    }
    return <View style={styles.wordCard}>{cardContent}</View>;
  };

  const handleStartDeckStudy = (mode) => {
    navigation.navigate('Flashcards', {
      language,
      studyMode: 'deck',
      deckId,
      deckName,
      deckStartMode: mode, // 'new' | 'due' | 'mixed'
    });
  };

  const newCount = words.filter(w => (w.mastery_level || 'new') === 'new').length;
  const dueCount = words.filter(w => {
    const ml = w.mastery_level || 'new';
    if (ml === 'new') return false;
    if (!w.next_review_date) return false;
    return new Date(w.next_review_date) <= new Date();
  }).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerTitleRow}>
            <SafeText style={styles.headerTitle} numberOfLines={1}>{deckName || 'Deck'}</SafeText>
            <TouchableOpacity
              onPress={() => { setRenameInput(deckName); setRenameModalVisible(true); }}
              style={{ padding: 6, marginLeft: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SafeText style={styles.headerSubtitle} numberOfLines={1}>
              {currentLanguage?.name || language}
            </SafeText>
            {deckMeta?.import_duration_seconds != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="timer-outline" size={12} color="rgba(255,255,255,0.7)" />
                <SafeText style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  {deckMeta.import_duration_seconds >= 60
                    ? `${Math.floor(deckMeta.import_duration_seconds / 60)}m ${Math.round(deckMeta.import_duration_seconds % 60)}s`
                    : `${Math.round(deckMeta.import_duration_seconds)}s`}
                </SafeText>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.headerRightRow}>
            <TouchableOpacity
              style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, marginRight: 6 }}
              onPress={() => { setAddCardsModalVisible(true); setAddCardsTab('manual'); setManualRows([{ english_word: '', translation: '', transliteration: '' }]); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            {siblingDecks.length > 1 && (
              <TouchableOpacity
                style={styles.headerLangButton}
                onPress={() => setLanguageMenuVisible(true)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.headerLangCodeBox,
                    { backgroundColor: currentLanguage?.color || '#0FA896' },
                  ]}
                >
                  {currentLanguage?.nativeChar ? (
                    <SafeText style={[styles.headerNativeCharText, currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                      {currentLanguage.nativeChar}
                    </SafeText>
                  ) : (
                    <SafeText style={styles.headerLangCodeText}>
                      {String(currentLanguage?.langCode || currentLanguage?.code || language).toUpperCase()}
                    </SafeText>
                  )}
                </View>
                <View style={styles.headerLangTextContainer}>
                  <SafeText style={styles.headerLangName} numberOfLines={1}>
                    {currentLanguage?.name || language}
                  </SafeText>
                  {currentLanguage?.nativeName ? (
                    <SafeText
                      style={[
                        styles.headerLangNativeName,
                        currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' },
                      ]}
                      numberOfLines={1}
                    >
                      {currentLanguage.nativeName}
                    </SafeText>
                  ) : null}
                </View>
                <Ionicons name="chevron-down" size={14} color="#999" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.headerDeleteButton, { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => openDeleteFlow()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Collapsible section: Filters + search + study mode cards (default uncollapsed) */}
      <View style={styles.body}>
        <View style={styles.filtersSection}>
          <TouchableOpacity
            style={styles.filtersHeader}
            onPress={() => setFiltersAndStudyExpanded(!filtersAndStudyExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.filtersHeaderLeft}>
              <SafeText style={styles.filtersHeaderText}>Filters</SafeText>
              {words.length > 0 && (
                <SafeText style={styles.filtersCountLine}>
                  Showing {filteredWords.length} of {words.length} entries
                </SafeText>
              )}
            </View>
            <Ionicons
              name={filtersAndStudyExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>

          {filtersAndStudyExpanded && (
            <>
              {/* Search + Select bar (inside collapsible) */}
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search in this deck..."
                  placeholderTextColor="#9CA3AF"
                  value={search}
                  onChangeText={setSearch}
                />
                {!selectionMode ? (
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setSelectionMode(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="checkbox-outline" size={20} color="#4A90E2" />
                    <SafeText style={styles.selectButtonText}>Select</SafeText>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.selectionBar}>
                    <TouchableOpacity onPress={exitSelectionMode} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                      <SafeText style={{ fontSize: 15, color: '#6B7280' }}>Cancel</SafeText>
                    </TouchableOpacity>
                    <SafeText style={{ fontSize: 14, color: '#6B7280', marginHorizontal: 8 }}>
                      {selectedWordIds.size} selected
                    </SafeText>
                    <TouchableOpacity
                      onPress={() => setShowDeleteWordsConfirm(true)}
                      disabled={selectedWordIds.size === 0 || deletingWords}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      {deletingWords ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={selectedWordIds.size > 0 ? '#DC2626' : '#9CA3AF'} />
                      )}
                      <SafeText style={{ fontSize: 15, fontWeight: '600', color: selectedWordIds.size > 0 ? '#DC2626' : '#9CA3AF' }}>Delete</SafeText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {/* Filter chips */}
              <View style={styles.filterWrapContainer}>
                {MASTERY_FILTERS.map((filter) => {
                  const isAll = filter.value === '';
                  const isSelected = isAll ? masteryFilter.length === 0 : masteryFilter.includes(filter.value);
                  return (
                    <TouchableOpacity
                      key={filter.value}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isSelected ? filter.color.bg : filter.color.bg + '20',
                          borderColor: filter.color.bg,
                        },
                      ]}
                      onPress={() => {
                        if (isAll) {
                          setMasteryFilter([]);
                        } else if (isSelected) {
                          setMasteryFilter(masteryFilter.filter(f => f !== filter.value));
                        } else {
                          setMasteryFilter([...masteryFilter, filter.value]);
                        }
                      }}
                    >
                      {filter.icon ? (
                        <View style={styles.filterChipContent}>
                          <Ionicons
                            name={filter.icon}
                            size={14}
                            color={isSelected ? filter.color.text : filter.color.bg}
                          />
                          <SafeText
                            style={[
                              styles.filterChipText,
                              {
                                color: isSelected ? filter.color.text : filter.color.bg,
                                fontWeight: isSelected ? '600' : '500',
                                marginLeft: 4,
                              },
                            ]}
                          >
                            {String(filter.label)}
                          </SafeText>
                        </View>
                      ) : (
                        <SafeText
                          style={[
                            styles.filterChipText,
                            {
                              color: isSelected ? filter.color.text : filter.color.bg,
                              fontWeight: isSelected ? '600' : '500',
                            },
                          ]}
                        >
                          {`${filter.emoji} ${String(filter.label)}`}
                        </SafeText>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Part of Speech filters - only POS values present in deck */}
              {presentPosSet.size > 0 && (
                <View style={styles.filterGroup}>
                  <SafeText style={styles.filterGroupLabel}>Part of Speech</SafeText>
                  <View style={styles.filterWrapContainer}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: wordClassFilter.length === 0 ? '#9CA3AF' : '#9CA3AF20',
                          borderColor: '#9CA3AF',
                        },
                      ]}
                      onPress={() => setWordClassFilter([])}
                    >
                      <SafeText
                        style={[
                          styles.filterChipText,
                          {
                            color: wordClassFilter.length === 0 ? '#FFFFFF' : '#9CA3AF',
                            fontWeight: wordClassFilter.length === 0 ? '600' : '500',
                          },
                        ]}
                      >
                        All
                      </SafeText>
                    </TouchableOpacity>
                    {WORD_CLASSES.filter(cls => cls.value !== 'All' && presentPosSet.has(cls.value.toLowerCase())).map((cls) => {
                      const isSelected = wordClassFilter.includes(cls.value);
                      return (
                        <TouchableOpacity
                          key={cls.value}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: isSelected ? cls.color.bg : cls.color.bg + '20',
                              borderColor: cls.color.bg,
                            },
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setWordClassFilter(wordClassFilter.filter(f => f !== cls.value));
                            } else {
                              setWordClassFilter([...wordClassFilter, cls.value]);
                            }
                          }}
                        >
                          <SafeText
                            style={[
                              styles.filterChipText,
                              {
                                color: isSelected ? cls.color.text : cls.color.bg,
                                fontWeight: isSelected ? '600' : '500',
                              },
                            ]}
                          >
                            {String(cls.label)}
                          </SafeText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Verb transitivity filters - only if verbs with transitivity exist */}
              {presentVtSet.size > 0 && (
                <View style={styles.filterGroup}>
                  <SafeText style={styles.filterGroupLabel}>Verb transitivity</SafeText>
                  <View style={styles.filterWrapContainer}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: transitivityFilter.length === 0 ? '#9CA3AF' : '#9CA3AF20',
                          borderColor: '#9CA3AF',
                        },
                      ]}
                      onPress={() => setTransitivityFilter([])}
                    >
                      <SafeText
                        style={[
                          styles.filterChipText,
                          {
                            color: transitivityFilter.length === 0 ? '#FFFFFF' : '#9CA3AF',
                            fontWeight: transitivityFilter.length === 0 ? '600' : '500',
                          },
                        ]}
                      >
                        All
                      </SafeText>
                    </TouchableOpacity>
                    {VERB_TRANSITIVITY_FILTERS.filter(vt => presentVtSet.has(vt.value.toLowerCase())).map((vt) => {
                      const isSelected = transitivityFilter.includes(vt.value);
                      return (
                        <TouchableOpacity
                          key={vt.value}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: isSelected ? vt.color.bg : vt.color.bg + '20',
                              borderColor: vt.color.bg,
                            },
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setTransitivityFilter(transitivityFilter.filter(f => f !== vt.value));
                            } else {
                              setTransitivityFilter([...transitivityFilter, vt.value]);
                            }
                          }}
                        >
                          <SafeText
                            style={[
                              styles.filterChipText,
                              {
                                color: isSelected ? vt.color.text : vt.color.bg,
                                fontWeight: isSelected ? '600' : '500',
                              },
                            ]}
                          >
                            {String(vt.label)}
                          </SafeText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Level filters - only levels present in deck */}
              {presentLvSet.size > 0 && (
                <View style={styles.filterGroup}>
                  <SafeText style={styles.filterGroupLabel}>Level</SafeText>
                  <View style={styles.filterWrapContainer}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: levelFilter.length === 0 ? '#9CA3AF' : '#9CA3AF20',
                          borderColor: '#9CA3AF',
                        },
                      ]}
                      onPress={() => setLevelFilter([])}
                    >
                      <SafeText
                        style={[
                          styles.filterChipText,
                          {
                            color: levelFilter.length === 0 ? '#FFFFFF' : '#9CA3AF',
                            fontWeight: levelFilter.length === 0 ? '600' : '500',
                          },
                        ]}
                      >
                        All
                      </SafeText>
                    </TouchableOpacity>
                    {LEVELS.filter(level => level !== 'All' && presentLvSet.has(level)).map((level) => {
                      const levelColor = LEVEL_COLORS[level];
                      const isSelected = levelFilter.includes(level);
                      return (
                        <TouchableOpacity
                          key={level}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: isSelected ? levelColor.bg : levelColor.bg + '20',
                              borderColor: levelColor.bg,
                            },
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setLevelFilter(levelFilter.filter(f => f !== level));
                            } else {
                              setLevelFilter([...levelFilter, level]);
                            }
                          }}
                        >
                          <SafeText
                            style={[
                              styles.filterChipText,
                              {
                                color: isSelected ? levelColor.text : levelColor.bg,
                                fontWeight: isSelected ? '600' : '500',
                              },
                            ]}
                          >
                            {String(level)}
                          </SafeText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Word Source / Origin filters - only sources present in deck */}
              {presentOriginSet.size > 0 && (
                <View style={styles.filterGroup}>
                  <SafeText style={styles.filterGroupLabel}>Word Source</SafeText>
                  <View style={styles.filterWrapContainer}>
                    <TouchableOpacity
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: originFilter.length === 0 ? '#9CA3AF' : '#9CA3AF20',
                          borderColor: '#9CA3AF',
                        },
                      ]}
                      onPress={() => setOriginFilter([])}
                    >
                      <SafeText
                        style={[
                          styles.filterChipText,
                          {
                            color: originFilter.length === 0 ? '#FFFFFF' : '#9CA3AF',
                            fontWeight: originFilter.length === 0 ? '600' : '500',
                          },
                        ]}
                      >
                        All
                      </SafeText>
                    </TouchableOpacity>
                    {ORIGIN_FILTERS.filter(o => presentOriginSet.has(o.value)).map((origin) => {
                      const isSelected = originFilter.includes(origin.value);
                      return (
                        <TouchableOpacity
                          key={origin.value}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: isSelected ? origin.color.bg : origin.color.bg + '20',
                              borderColor: origin.color.bg,
                            },
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setOriginFilter(originFilter.filter(f => f !== origin.value));
                            } else {
                              setOriginFilter([...originFilter, origin.value]);
                            }
                          }}
                        >
                          <SafeText
                            style={[
                              styles.filterChipText,
                              {
                                color: isSelected ? origin.color.text : origin.color.bg,
                                fontWeight: isSelected ? '600' : '500',
                              },
                            ]}
                          >
                            {String(origin.label)}
                          </SafeText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Deck study buttons (New / Due / Mixed) */}
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeCard, { backgroundColor: '#E0F2FE', borderColor: '#3B82F6' }]}
                  onPress={() => handleStartDeckStudy('new')}
                  activeOpacity={0.8}
                >
                  <View style={styles.modeTitleRow}>
                    <Ionicons name="add-circle" size={18} color="#1D4ED8" style={{ marginRight: 4 }} />
                    <SafeText style={[styles.modeTitle, { color: '#1D4ED8' }]}>New cards</SafeText>
                  </View>
                  <SafeText style={styles.modeSubtitle}>{newCount} available</SafeText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeCard, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}
                  onPress={() => handleStartDeckStudy('due')}
                  activeOpacity={0.8}
                >
                  <View style={styles.modeTitleRow}>
                    <Ionicons name="alarm" size={18} color="#B91C1C" style={{ marginRight: 4 }} />
                    <SafeText style={[styles.modeTitle, { color: '#B91C1C' }]}>Due cards</SafeText>
                  </View>
                  <SafeText style={styles.modeSubtitle}>{dueCount} due</SafeText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeCard, { backgroundColor: '#F3E8FF', borderColor: '#8B5CF6' }]}
                  onPress={() => handleStartDeckStudy('mixed')}
                  activeOpacity={0.8}
                >
                  <View style={styles.modeTitleRow}>
                    <Ionicons name="layers" size={18} color="#6D28D9" style={{ marginRight: 4 }} />
                    <SafeText style={[styles.modeTitle, { color: '#6D28D9' }]}>Mixed</SafeText>
                  </View>
                  <SafeText style={styles.modeSubtitle}>{filteredWords.length} cards</SafeText>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : filteredWords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="albums-outline" size={40} color="#D1D5DB" />
            <SafeText style={styles.emptyText}>No cards match this filter.</SafeText>
          </View>
        ) : (
          <FlatList
            data={filteredWords}
            renderItem={renderWordItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Review History Modal */}
      <Modal
        visible={showReviewHistory}
        transparent={true}
        animationType="fade"
        onRequestClose={closeReviewHistory}
      >
        <TouchableOpacity
          style={styles.reviewModalOverlay}
          activeOpacity={1}
          onPress={closeReviewHistory}
        >
          <TouchableOpacity
            style={styles.reviewModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.reviewModalHeader}>
              <SafeText style={styles.reviewModalTitle}>
                {selectedWord?.english_word}
              </SafeText>
              <TouchableOpacity onPress={closeReviewHistory} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reviewHistoryContent}>
              {reviewHistory ? (
                <>
                  {/* Current SRS Info */}
                  <View style={styles.srsInfoSection}>
                    <SafeText style={styles.sectionTitle}>Current Status</SafeText>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Mastery Level:</SafeText>
                      <View
                        style={[
                          styles.masteryBadge,
                          { backgroundColor: getMasteryColor(reviewHistory.current_state?.mastery_level) },
                        ]}
                      >
                        <SafeText style={styles.masteryText}>
                          {getMasteryEmoji(reviewHistory.current_state?.mastery_level)}{' '}
                          {reviewHistory.current_state?.mastery_level?.toUpperCase() || 'NEW'}
                        </SafeText>
                      </View>
                    </View>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Review Count:</SafeText>
                      <SafeText style={styles.srsInfoValue}>
                        {reviewHistory.current_state?.review_count || 0}
                      </SafeText>
                    </View>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Ease Factor:</SafeText>
                      <SafeText style={styles.srsInfoValue}>
                        {reviewHistory.current_state?.ease_factor?.toFixed(2) || 'N/A'}
                      </SafeText>
                    </View>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Current Interval:</SafeText>
                      <SafeText style={styles.srsInfoValue}>
                        {reviewHistory.current_state?.interval_days
                          ? `${reviewHistory.current_state.interval_days.toFixed(1)} days`
                          : 'N/A'}
                      </SafeText>
                    </View>
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>Next Review:</SafeText>
                      <SafeText style={styles.srsInfoValue}>
                        {reviewHistory.current_state?.next_review_date
                          ? new Date(reviewHistory.current_state.next_review_date).toLocaleDateString()
                          : 'Not scheduled'}
                      </SafeText>
                    </View>
                  </View>

                  {/* Review History */}
                  <View style={styles.historySection}>
                    <SafeText style={styles.sectionTitle}>
                      Review History ({reviewHistory.history?.length || 0} reviews)
                    </SafeText>
                    {reviewHistory.history && reviewHistory.history.length > 0 ? (
                      reviewHistory.history.map((review, index) => (
                        <View key={index} style={styles.historyItem}>
                          <View style={styles.historyItemHeader}>
                            <SafeText style={styles.historyDate}>
                              {new Date(review.reviewed_at).toLocaleDateString()}{' '}
                              {new Date(review.reviewed_at).toLocaleTimeString()}
                            </SafeText>
                            <View
                              style={[
                                styles.ratingBadge,
                                {
                                  backgroundColor:
                                    review.rating === 'easy'
                                      ? '#10B981'
                                      : review.rating === 'good'
                                      ? '#3B82F6'
                                      : review.rating === 'hard'
                                      ? '#F59E0B'
                                      : '#EF4444',
                                },
                              ]}
                            >
                              <SafeText style={styles.ratingText}>
                                {review.rating?.toUpperCase()}
                              </SafeText>
                            </View>
                          </View>
                          <View style={styles.historyDetails}>
                            <SafeText style={styles.historyDetail}>
                              Activity: {review.activity_type || 'flashcard'}
                            </SafeText>
                            <SafeText style={styles.historyDetail}>
                              Interval: {review.interval_days?.toFixed(1) || '0'} days
                            </SafeText>
                            <SafeText style={styles.historyDetail}>
                              Ease: {review.ease_factor?.toFixed(2) || 'N/A'}
                            </SafeText>
                          </View>
                        </View>
                      ))
                    ) : (
                      <SafeText style={styles.noHistoryText}>No review history yet</SafeText>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#14B8A6" />
                  <SafeText style={styles.loadingText}>Loading review history...</SafeText>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete choice modal: this deck only vs also other languages */}
      <Modal
        visible={showDeleteChoiceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteChoiceModal(false)}
      >
        <TouchableOpacity
          style={styles.reviewModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteChoiceModal(false)}
        >
          <View style={[styles.langModalMenu, { padding: 20 }]} onStartShouldSetResponder={() => true}>
            <SafeText style={styles.langModalTitle}>Delete deck</SafeText>
            <SafeText style={{ fontSize: 14, color: '#4B5563', marginBottom: 16 }}>
              Delete only this deck, or also delete this deck in other languages?
            </SafeText>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity
                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                onPress={() => setShowDeleteChoiceModal(false)}
              >
                <SafeText style={{ fontSize: 15, color: '#6B7280' }}>Cancel</SafeText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#E5E7EB', borderRadius: 8 }}
                onPress={openDeleteConfirmSingle}
              >
                <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>This deck only</SafeText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#B91C1C', borderRadius: 8 }}
                onPress={() => {
                  setShowDeleteChoiceModal(false);
                  setDeleteSelectedDeckIds(new Set(siblingDecks.map((d) => d.id)));
                  setShowDeleteScopeModal(true);
                }}
              >
                <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Also delete in other languages</SafeText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmModal(false)}
      >
        <TouchableOpacity
          style={styles.reviewModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteConfirmModal(false)}
        >
          <View style={[styles.langModalMenu, { padding: 20 }]} onStartShouldSetResponder={() => true}>
            <SafeText style={styles.langModalTitle}>Are you sure?</SafeText>
            <SafeText style={{ fontSize: 14, color: '#4B5563', marginBottom: 16 }}>
              {deleteConfirmMode === 'single'
                ? 'This will permanently delete this deck and all its cards. This cannot be undone.'
                : `This will permanently delete ${deleteSelectedDeckIds.size} deck(s) and all their cards. This cannot be undone.`}
            </SafeText>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity
                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                onPress={() => setShowDeleteConfirmModal(false)}
              >
                <SafeText style={{ fontSize: 15, color: '#6B7280' }}>Cancel</SafeText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#B91C1C', borderRadius: 8 }}
                onPress={deleteConfirmMode === 'single' ? executeDeleteSingle : executeDeleteMulti}
              >
                <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Delete</SafeText>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Select decks to delete (when "Also delete in other languages") */}
      <Modal
        visible={showDeleteScopeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteScopeModal(false)}
      >
        <TouchableOpacity
          style={styles.reviewModalOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteScopeModal(false)}
        >
          <TouchableOpacity
            style={[styles.langModalMenu, { maxHeight: '70%' }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <SafeText style={styles.langModalTitle}>Select decks to delete</SafeText>
            <ScrollView style={{ maxHeight: 320 }}>
              {siblingDecks.map((d) => {
                const langMeta = availableLanguages?.find((l) => l.code === d.language) || { name: d.language };
                const selected = deleteSelectedDeckIds.has(d.id);
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.langModalOption, selected && styles.langModalOptionSelected]}
                    onPress={() => {
                      setDeleteSelectedDeckIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(d.id)) next.delete(d.id);
                        else next.add(d.id);
                        return next;
                      });
                    }}
                  >
                    <View style={{ marginRight: 10 }}>
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={selected ? '#16A34A' : '#9CA3AF'}
                      />
                    </View>
                    <View
                      style={[
                        styles.langModalCodeBox,
                        { backgroundColor: langMeta.color || '#0FA896' },
                      ]}
                    >
                      {langMeta.nativeChar ? (
                        <SafeText style={[styles.langModalNativeChar, langMeta.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                          {String(langMeta.nativeChar)}
                        </SafeText>
                      ) : (
                        <SafeText style={styles.langModalCodeText}>
                          {String(langMeta.langCode || langMeta.code || d.language).toUpperCase().slice(0, 3)}
                        </SafeText>
                      )}
                    </View>
                    <View style={styles.langModalOptionContent}>
                      <SafeText style={styles.langModalOptionText}>{String(langMeta.name)}</SafeText>
                      <SafeText style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{d.name}</SafeText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
              <TouchableOpacity
                style={{ paddingVertical: 8, paddingHorizontal: 16 }}
                onPress={() => setShowDeleteScopeModal(false)}
              >
                <SafeText style={{ fontSize: 15, color: '#6B7280' }}>Cancel</SafeText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#B91C1C', borderRadius: 8 }}
                onPress={confirmDeleteSelectedDecks}
              >
                <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>Delete</SafeText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Deck language switcher modal (only languages that have this deck) */}
      <Modal
        visible={languageMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.langModalOverlay}
          activeOpacity={1}
          onPress={() => setLanguageMenuVisible(false)}
        >
          <View style={styles.langModalMenu}>
            <SafeText style={styles.langModalTitle}>Deck languages</SafeText>
            {siblingDecks.map((deck) => {
              const langMeta =
                availableLanguages?.find((l) => l.code === deck.language) ||
                { code: deck.language, name: deck.language.toUpperCase(), color: '#0FA896' };
              const isSelected = deck.language === language;
              return (
                <TouchableOpacity
                  key={deck.id}
                  style={styles.langModalOption}
                  onPress={() => {
                    setLanguageMenuVisible(false);
                    if (deck.id === deckId && deck.language === language) return;
                    navigation.replace('DeckDetail', {
                      deckId: deck.id,
                      deckName: deck.name,
                      language: deck.language,
                    });
                  }}
                >
                  <View
                    style={[
                      styles.langModalCodeBox,
                      { backgroundColor: langMeta.color || '#0FA896' },
                    ]}
                  >
                    {langMeta.nativeChar ? (
                      <SafeText style={[styles.langModalNativeChar, langMeta.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                        {String(langMeta.nativeChar)}
                      </SafeText>
                    ) : (
                      <SafeText style={styles.langModalCodeText}>
                        {String(langMeta.langCode || langMeta.code || deck.language)
                          .toUpperCase()
                          .slice(0, 3)}
                      </SafeText>
                    )}
                  </View>
                  <View style={styles.langModalOptionContent}>
                    <SafeText
                      style={[
                        styles.langModalOptionText,
                        isSelected && styles.langModalOptionTextSelected,
                      ]}
                    >
                      {String(langMeta.name)}
                    </SafeText>
                    {langMeta.nativeName ? (
                      <SafeText
                        style={[
                          styles.langModalNativeName,
                          langMeta.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' },
                        ]}
                      >
                        {String(langMeta.nativeName)}
                      </SafeText>
                    ) : null}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color="#0FA896" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Rename deck modal (same UI as FlashcardScreen) */}
      <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} onPress={() => setRenameModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 }}>Rename deck</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#333', marginBottom: 16 }}
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Deck name"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setRenameModalVisible(false)} style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 15, color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const name = (renameInput || '').trim();
                  if (!name || !deckId) return;
                  setRenaming(true);
                  try {
                    await fetch(`${API_BASE_URL}/api/vocab/decks/${deckId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', ...authHeaders },
                      body: JSON.stringify({ name }),
                    });
                    setDeckName(name);
                    setRenameModalVisible(false);
                  } catch (e) {
                    console.error('Error renaming deck:', e);
                  } finally {
                    setRenaming(false);
                  }
                }}
                disabled={renaming || !(renameInput || '').trim()}
                style={{ paddingVertical: 8, paddingHorizontal: 16 }}
              >
                {renaming ? <ActivityIndicator size="small" color="#14B8A6" /> : <Text style={{ fontSize: 15, fontWeight: '600', color: '#14B8A6' }}>Save</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Delete selected words confirm */}
      <Modal visible={showDeleteWordsConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteWordsConfirm(false)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} onPress={() => setShowDeleteWordsConfirm(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: '#FFF', borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 }}>Delete cards</Text>
            <Text style={{ fontSize: 14, color: '#4B5563', marginBottom: 16 }}>
              Remove {selectedWordIds.size} card{selectedWordIds.size !== 1 ? 's' : ''} from this deck? User-generated cards will be permanently deleted; original-set cards will only be removed from this deck.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowDeleteWordsConfirm(false)} style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 15, color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteSelectedWords}
                style={{ paddingVertical: 8, paddingHorizontal: 16 }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Add cards modal */}
      <Modal visible={addCardsModalVisible} transparent animationType="fade" onRequestClose={() => setAddCardsModalVisible(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.reviewModalOverlay} onPress={() => setAddCardsModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={[styles.reviewModalContent, { maxHeight: '85%' }]}>
            <View style={styles.reviewModalHeader}>
              <SafeText style={styles.reviewModalTitle}>Add cards</SafeText>
              <TouchableOpacity onPress={() => setAddCardsModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: addCardsTab === 'manual' ? '#0FA896' : '#E5E7EB' }} onPress={() => setAddCardsTab('manual')}>
                <SafeText style={{ textAlign: 'center', fontWeight: '600', color: addCardsTab === 'manual' ? '#FFF' : '#374151' }}>Add manually</SafeText>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, marginLeft: 8, paddingVertical: 10, borderRadius: 8, backgroundColor: addCardsTab === 'import' ? '#0FA896' : '#E5E7EB' }} onPress={() => setAddCardsTab('import')}>
                <SafeText style={{ textAlign: 'center', fontWeight: '600', color: addCardsTab === 'import' ? '#FFF' : '#374151' }}>Import vocab</SafeText>
              </TouchableOpacity>
            </View>
            {addCardsTab === 'import' ? (
              <View style={{ paddingVertical: 16 }}>
                <SafeText style={{ fontSize: 14, color: '#4B5563', marginBottom: 12 }}>Paste or upload text to extract vocabulary. Words will be added to this deck.</SafeText>
                <TouchableOpacity style={{ backgroundColor: '#0FA896', borderRadius: 10, paddingVertical: 14, alignItems: 'center' }} onPress={() => { setAddCardsModalVisible(false); importJob.openModalForDeck(deckId, deckName, language); }}>
                  <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#FFF' }}>Open Import Vocab</SafeText>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView style={{ maxHeight: 360 }}>
                  {manualRows.map((row, idx) => (
                    <View key={idx} style={{ marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                      <TextInput style={styles.searchInput} placeholder="English / front" placeholderTextColor="#9CA3AF" value={row.english_word} onChangeText={(t) => setManualRows(prev => prev.map((r, i) => i === idx ? { ...r, english_word: t } : r))} />
                      <TextInput style={[styles.searchInput, { marginTop: 6 }]} placeholder="Translation / back" placeholderTextColor="#9CA3AF" value={row.translation} onChangeText={(t) => setManualRows(prev => prev.map((r, i) => i === idx ? { ...r, translation: t } : r))} />
                      <TextInput style={[styles.searchInput, { marginTop: 6 }]} placeholder="Transliteration (optional)" placeholderTextColor="#9CA3AF" value={row.transliteration} onChangeText={(t) => setManualRows(prev => prev.map((r, i) => i === idx ? { ...r, transliteration: t } : r))} />
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => setManualRows(prev => [...prev, { english_word: '', translation: '', transliteration: '' }])}>
                    <SafeText style={{ fontSize: 14, color: '#0FA896', fontWeight: '600' }}>+ Add another card</SafeText>
                  </TouchableOpacity>
                </ScrollView>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                  <TouchableOpacity onPress={() => setAddCardsModalVisible(false)} style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                    <SafeText style={{ fontSize: 15, color: '#666' }}>Cancel</SafeText>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={addingCards || !manualRows.some(r => (r.english_word || '').trim() && (r.translation || '').trim())} onPress={async () => { const toAdd = manualRows.map(r => ({ english_word: (r.english_word || '').trim(), translation: (r.translation || '').trim(), transliteration: (r.transliteration || '').trim() })).filter(w => w.english_word && w.translation); if (!toAdd.length || !deckId) return; setAddingCards(true); try { const res = await fetch(`${API_BASE_URL}/api/vocab/decks/${deckId}/words`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ words: toAdd }) }); if (!res.ok) throw new Error('Failed to add cards'); await reloadDeckWords(); setAddCardsModalVisible(false); setManualRows([{ english_word: '', translation: '', transliteration: '' }]); } catch (e) { console.error('Error adding cards:', e); Alert.alert('Error', e.message || 'Could not add cards.'); } finally { setAddingCards(false); } }} style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                    {addingCards ? <ActivityIndicator size="small" color="#0FA896" /> : <SafeText style={{ fontSize: 15, fontWeight: '600', color: '#0FA896' }}>Save</SafeText>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0FA896',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitleContainer: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTitleInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  headerSubtitle: { fontSize: 13, color: '#E0F2F1', marginTop: 2 },
  headerRight: { minWidth: 88, alignItems: 'flex-end', justifyContent: 'center' },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  headerLangButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  headerLangCodeBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerNativeCharText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerLangCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerLangTextContainer: {
    marginRight: 6,
  },
  headerLangName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  headerLangNativeName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  headerDeleteButton: {
    padding: 4,
  },

  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 4 },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  selectButtonText: { fontSize: 14, fontWeight: '600', color: '#4A90E2' },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  filtersSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filtersHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  filtersHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  filtersCountRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersCountLine: {
    fontSize: 13,
    color: '#6B7280',
  },
  filterGroup: {
    marginBottom: 8,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  filterWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChipText: { fontSize: 13, fontWeight: '500' },

  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
  },
  modeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: 2,
  },
  modeTitle: { fontSize: 13, fontWeight: '700' },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeSubtitle: { fontSize: 11, color: '#4B5563', marginTop: 2 },

  wordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  wordCardSelected: {
    borderWidth: 2,
    borderColor: '#4A90E2',
    backgroundColor: '#EFF6FF',
  },
  wordCardCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordCardCheckboxSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  wordCardContent: { flex: 1 },
  wordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  wordMain: { flex: 1, paddingRight: 8 },
  englishWord: { fontSize: 15, fontWeight: '600', color: '#111827' },
  translation: { fontSize: 16, fontWeight: '700', color: '#111827', marginTop: 2 },
  transliteration: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', marginTop: 2 },

  masteryBadgeContainer: { alignItems: 'flex-end' },
  masteryBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  masteryText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  dueBadge: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dueText: { fontSize: 10, color: '#FFFFFF', marginLeft: 2 },

  wordMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagText: { fontSize: 11, fontWeight: '600' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 8 },

  // Review history modal styles
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '90%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  reviewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
  reviewHistoryContent: {
    marginTop: 4,
  },
  srsInfoSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  srsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  srsInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 110,
  },
  srsInfoValue: {
    fontSize: 12,
    color: '#111827',
  },
  historySection: {
    marginTop: 4,
  },
  historyItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#4B5563',
  },
  ratingBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ratingText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  historyDetails: {
    marginTop: 2,
  },
  historyDetail: {
    fontSize: 12,
    color: '#4B5563',
  },
  noHistoryText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },

  // Deck language modal styles
  langModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langModalMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '80%',
    maxWidth: 360,
  },
  langModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  langModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  langModalOptionSelected: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  langModalCodeBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  langModalNativeChar: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  langModalCodeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  langModalOptionContent: {
    flex: 1,
  },
  langModalOptionText: {
    fontSize: 15,
    color: '#111827',
  },
  langModalOptionTextSelected: {
    fontWeight: '700',
  },
  langModalNativeName: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },

  listContent: { paddingBottom: 40, paddingTop: 4 },
});

