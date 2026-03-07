/**
 * TranslationToolModal
 *
 * A two-phase popup:
 *   Phase 1 – "Translate"  : user pastes any text, picks target language,
 *                             presses Translate → shows the translated result.
 *   Phase 2 – "Make Cards" : mirrors TextImportModal's review/import flow:
 *                             lemmatize the source text, cross-translate
 *                             checkbox, new / synonym / existing card display,
 *                             deck-name input, import → creates a new deck.
 *
 * Props
 *   visible      : bool
 *   onClose      : () => void
 *   language     : source language code (e.g. 'kannada')
 *   prefillText  : optional string to pre-populate the input
 *   onImportComplete : optional callback after import
 */
import React, { useState, useContext, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LanguageContext, LANGUAGES } from '../contexts/LanguageContext';
import { WORD_CLASSES, LEVELS, LEVEL_COLORS, CEFR_LEVELS } from '../constants/filters';
import VocabImportDebugModal from './VocabImportDebugModal';
import TextImportModal from './TextImportModal';
import VocabularyDictionary from '../screens/activities/shared/components/VocabularyDictionary';
import { useDictionary } from '../screens/activities/shared/hooks/useDictionary';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

const formatMultiTerm = (s) => (s || '').replace(/\s*,\s*/g, ' / ');

// ─── phase: 'translate' | 'history' | 'cards_input' | 'cards_review' | 'cards_done' ───

export default function TranslationToolModal({
  visible,
  onClose,
  language,
  prefillText = '',
  onImportComplete,
  onMakeVocabCards,
}) {
  const { userSelectedLanguages } = useContext(LanguageContext);

  // ── Translation phase ──
  const [sourceText, setSourceText] = useState('');
  const [targetLang, setTargetLang] = useState('english');
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState(null); // { [langCode]: { translated_text, ... } }
  const [translationError, setTranslationError] = useState('');
  // Default English selected for "Translate to"; can load from user prefs
  const [selectedTargetLangs, setSelectedTargetLangs] = useState(['english']);
  // Legacy cards-flow state (kept for compatibility, but no longer user-facing from Translate UI)
  const [importFromTranslation, setImportFromTranslation] = useState(null); // { text, language } when importing from one output

  // ── Cards phase (mirrors TextImportModal) ──
  const [phase, setPhase] = useState('translate');
  const [deckName, setDeckName] = useState('');
  const [crossTranslateExpanded, setCrossTranslateExpanded] = useState(false);

  const [extractedWords, setExtractedWords] = useState([]);
  const [synonymWords, setSynonymWords] = useState([]);
  const [existingWords, setExistingWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState(new Set());
  const [selectedSynonyms, setSelectedSynonyms] = useState(new Set());
  const [langData, setLangData] = useState({});
  const [wordClassFilter, setWordClassFilter] = useState({});
  const [levelFilter, setLevelFilter] = useState({});
  const [activeTab, setActiveTab] = useState(language);

  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null);
  const abortRef = useRef(null);

  const [importResult, setImportResult] = useState(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [translateProgress, setTranslateProgress] = useState(null); // { current, total, currentLangName, stage }
  const [importModal, setImportModal] = useState({ visible: false, language: null, text: '' });
  const [collapsedLangs, setCollapsedLangs] = useState({}); // { [langCode]: true }
  const [showTransliterations, setShowTransliterations] = useState(true);
  const [transliterations, setTransliterations] = useState({}); // { [langCode]: string }

  // ── Translation history ──
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLangFilters, setHistoryLangFilters] = useState(null); // null = all selected
  const [historyFiltersExpanded, setHistoryFiltersExpanded] = useState(false);

  const dictionary = useDictionary(language);

  // Languages available for translation target (include current system language)
  const allDisplayLanguages = LANGUAGES.filter(l => l.active !== false || userSelectedLanguages?.includes(l.code));
  const targetLanguages = allDisplayLanguages;
  const otherUserLanguages = LANGUAGES.filter(
    l => userSelectedLanguages?.includes(l.code) && l.code !== language,
  );

  // Prefill
  React.useEffect(() => {
    if (visible && prefillText && !sourceText) {
      setSourceText(prefillText);
    }
  }, [visible, prefillText]);

  // ── Reset on close ──
  const handleClose = () => {
    if (abortRef.current) abortRef.current.abort();
    setSourceText('');
    setTranslation(null);
    setTranslationError('');
    setPhase('translate');
    setDeckName('');
    setCrossTranslateExpanded(false);
    setSelectedTargetLangs(['english']);
    setExtractedWords([]);
    setSynonymWords([]);
    setExistingWords([]);
    setSelectedWords(new Set());
    setSelectedSynonyms(new Set());
    setLangData({});
    setWordClassFilter({});
    setLevelFilter({});
    setActiveTab(language);
    setProcessing(false);
    setImporting(false);
    setStatus('');
    setProgress(null);
    setImportResult(null);
    setDebugData(null);
    setDebugVisible(false);
    setImportFromTranslation(null);
    setTranslateProgress(null);
    setCollapsedLangs({});
    setTransliterations({});
    setAllHistory([]);
    setHistory([]);
    setHistoryLangFilters(null);
    setHistoryFiltersExpanded(false);
    onClose();
  };

  // Load default translate-to languages from user preferences when opening
  React.useEffect(() => {
    if (!visible) return;
    fetch(`${API_BASE_URL}/api/user-preferences?keys=default_translate_target_languages`)
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        try {
          const raw = typeof data?.default_translate_target_languages === 'string'
            ? JSON.parse(data.default_translate_target_languages)
            : data?.default_translate_target_languages;
          if (Array.isArray(raw) && raw.length > 0) setSelectedTargetLangs(raw);
        } catch (_) {}
      })
      .catch(() => {});
  }, [visible]);

  // ── Load translation history ──
  const [allHistory, setAllHistory] = useState([]);
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/translation-history?limit=100`);
      if (r.ok) {
        const data = await r.json();
        setAllHistory(data.history || []);
      }
    } catch (_) {}
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (phase === 'history') loadHistory();
  }, [phase, loadHistory]);

  const filteredHistory = useMemo(() => {
    if (!historyLangFilters) return allHistory;
    if (historyLangFilters.size === 0) return [];
    return allHistory.filter(item => {
      const langs = new Set([item.source_language, ...(item.target_languages || [])]);
      for (const f of historyLangFilters) { if (langs.has(f)) return true; }
      return false;
    });
  }, [allHistory, historyLangFilters]);

  const saveToHistory = useCallback(async (text, srcLang, targets, results, durationSeconds) => {
    try {
      await fetch(`${API_BASE_URL}/api/translation-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_text: text,
          source_language: srcLang,
          target_languages: targets,
          results,
          duration_seconds: durationSeconds != null ? Math.round(durationSeconds * 10) / 10 : null,
        }),
      });
    } catch (_) {}
  }, []);

  // ── Simple script-based language validation ──
  const scriptMatchers = {
    kannada: /[\u0C80-\u0CFF]/,
    telugu: /[\u0C00-\u0C7F]/,
    malayalam: /[\u0D00-\u0D7F]/,
    tamil: /[\u0B80-\u0BFF]/,
    hindi: /[\u0900-\u097F]/,
    urdu: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/,
    english: /[A-Za-z]/,
  };

  const validateTextLanguage = (langCode, text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return true;
    const matcher = scriptMatchers[langCode];
    if (!matcher) return true;
    if (!matcher.test(trimmed)) {
      const meta = LANGUAGES.find(l => l.code === langCode);
      const langName = meta?.name || langCode;
      Alert.alert(
        'Language Mismatch',
        `The text you entered does not look like it is in ${langName}. Please check the language or change the selected language.`,
      );
      return false;
    }
    return true;
  };

  const detectSourceLanguage = (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return language;
    // Prefer explicit matches for non-English scripts
    const candidates = Object.keys(scriptMatchers).filter(code => scriptMatchers[code].test(trimmed));
    if (candidates.length === 0) return language;
    if (candidates.includes(language)) return language;
    // If multiple matches, pick the first non-English; otherwise fall back to current language
    const nonEnglish = candidates.find(c => c !== 'english');
    return nonEnglish || candidates[0] || language;
  };

  // Helper: fetch with timeout so translate phase can't hang forever
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  };

  const renderTappableText = useCallback((text, langCode, textStyle) => {
    if (!text) return null;
    const isUrdu = langCode === 'urdu';
    // Split by whitespace but preserve the whitespace tokens for reconstruction
    const tokens = text.split(/(\s+)/);
    return (
      <Text style={textStyle}>
        {tokens.map((token, i) => {
          if (/^\s+$/.test(token)) return token;
          const cleaned = token.replace(/[.,!?;:"""''()[\]{}\-—–…।॥]/g, '').trim();
          if (!cleaned) return token;
          return (
            <Text
              key={i}
              style={styles.tappableWord}
              onPress={() => {
                dictionary.setDictionaryLanguage(langCode);
                dictionary.setInitialSearchQuery(cleaned);
                dictionary.setShowDictionary(true);
              }}
            >
              {token}
            </Text>
          );
        })}
      </Text>
    );
  }, [dictionary]);

  const fetchTransliteration = useCallback(async (langCode, text) => {
    if (!text || langCode === 'english') return;
    try {
      const body = { text, language: langCode };
      if (langCode === 'urdu') body.from_script = 'Devanagari';
      const res = await fetch(`${API_BASE_URL}/api/transliterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.transliteration) {
          setTransliterations(prev => ({ ...prev, [langCode]: data.transliteration }));
        }
      }
    } catch (_) {}
  }, []);

  const toggleLangCollapsed = useCallback((code) => {
    setCollapsedLangs(prev => ({ ...prev, [code]: !prev[code] }));
  }, []);

  const loadHistoryEntry = useCallback((entry) => {
    setSourceText(entry.source_text || '');
    setSelectedTargetLangs(entry.target_languages || []);
    setTranslation(entry.results_json || {});
    setTranslationError('');
    setPhase('translate');
    setStatus('Loaded from history.');
    setTransliterations({});
    for (const [code, data] of Object.entries(entry.results_json || {})) {
      if (code === 'english' || !data?.translated_text) continue;
      const textForTranslit = (code === 'urdu' && data.translated_text_devanagari)
        ? data.translated_text_devanagari : data.translated_text;
      fetchTransliteration(code, textForTranslit);
    }
  }, [fetchTransliteration]);

  // ── Phase 1: Translate ──
  const handleTranslate = async () => {
    const text = sourceText.trim();
    if (!text) {
      Alert.alert('No Text', 'Please enter some text to translate.');
      return;
    }
    const detectedSource = detectSourceLanguage(text);
    if (!validateTextLanguage(detectedSource, text)) {
      return;
    }
    setTranslating(true);
    setTranslationError('');
    setTranslation(null);
    setStatus('Starting translation…');
    const translateStartTime = Date.now();
    try {
      const targets =
        selectedTargetLangs.length > 0 ? selectedTargetLangs : ['english'];

      const results = {};
      for (let i = 0; i < targets.length; i++) {
        const code = targets[i];
        const meta = LANGUAGES.find(l => l.code === code);
        const langName = meta?.name || code;
        setTranslateProgress({
          current: i,
          total: targets.length,
          currentLangName: langName,
          stage: 'translating',
        });
        if (detectedSource !== language) {
          const detectedMeta = LANGUAGES.find(l => l.code === detectedSource);
          const detectedName = detectedMeta?.name || detectedSource;
          setStatus(`Detected ${detectedName} as source. Translating to ${langName} (${i + 1}/${targets.length})…`);
        } else {
          setStatus(`Translating to ${langName} (${i + 1}/${targets.length})…`);
        }

        let res;
        try {
          res = await fetchWithTimeout(`${API_BASE_URL}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            source_language: detectedSource,
            target_language: code,
          }),
          }, 60000);
        } catch (e) {
          if (e.name === 'AbortError') {
            throw new Error(`Translation to ${langName} timed out after 60 seconds.`);
          }
          throw e;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `Server error (${res.status}) while translating to ${langName}.`);
        }
        const data = await res.json();
        results[code] = data;
        setTranslateProgress({
          current: i + 1,
          total: targets.length,
          currentLangName: langName,
          stage: 'done',
        });
      }
      const durationSeconds = (Date.now() - translateStartTime) / 1000;
      setTranslation(results);
      setStatus(`Translation complete in ${durationSeconds >= 60 ? `${Math.floor(durationSeconds / 60)}m ${Math.round(durationSeconds % 60)}s` : `${durationSeconds.toFixed(1)}s`}.`);
      saveToHistory(text, detectedSource, targets, results, durationSeconds);
      for (const [code, data] of Object.entries(results)) {
        if (code === 'english' || !data?.translated_text) continue;
        const textForTranslit = (code === 'urdu' && data.translated_text_devanagari)
          ? data.translated_text_devanagari : data.translated_text;
        fetchTransliteration(code, textForTranslit);
      }
    } catch (e) {
      setTranslationError(e.message || 'Translation failed.');
      setStatus('Translation failed.');
    } finally {
      setTranslating(false);
      setTranslateProgress(null);
      // Leave final status visible; it will be cleared on close or next action
    }
  };

  // ── Phase transition: Translate → Make Cards (only for selected languages) ──
  const handleMakeCards = () => {
    const baseText = (importFromTranslation ? importFromTranslation.text : sourceText).trim();
    if (!baseText) {
      Alert.alert('No Text', 'Please translate or enter some text first.');
      return;
    }
    if (onMakeVocabCards) {
      onMakeVocabCards(baseText);
      handleClose();
      return;
    }
    setDeckName('');
    setSelectedTargetLangs(importFromTranslation ? [importFromTranslation.language] : selectedTargetLangs);
    setPhase('cards_input');
  };

  // Start import flow from one translation output (text in that language → extract into that language's vocab)
  const handleImportFromTranslationOutput = (code) => {
    const text = translation?.[code]?.translated_text?.trim();
    if (!text) return;
    setImportFromTranslation({ text, language: code });
    setSourceText(text);
    setSelectedTargetLangs([code]);
    setDeckName('');
    setPhase('cards_input');
  };

  // ── Cards phase: Extract words via SSE (same as TextImportModal) ──
  const handleExtract = async () => {
    const textToUse = (importFromTranslation ? importFromTranslation.text : sourceText).trim();
    const langToUse = importFromTranslation ? importFromTranslation.language : language;
    if (!textToUse) {
      Alert.alert('No Text', 'No source text to extract from.');
      return;
    }
    setProcessing(true);
    setProgress(null);
    setStatus(selectedTargetLangs.length > 0 ? 'Extracting & translating words…' : 'Extracting words…');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE_URL}/api/vocab/extract-text-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToUse,
          language: langToUse,
          target_languages: selectedTargetLangs.length > 0 ? selectedTargetLangs : null,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'start') {
              setProgress({ phase: 'start', total_words: event.total_words, total_batches: event.total_batches, batch: 0 });
              setStatus(`Processing ${event.total_words} words…`);
            } else if (event.type === 'progress') {
              setProgress(event);
              if (event.phase === 'lemmatize') setStatus(`Lemmatizing batch ${event.batch}/${event.total_batches}…`);
              else if (event.phase === 'db_check') setStatus(`Found ${event.new} new, ${event.existing} known words`);
              else if (event.phase === 'translate') setStatus(`Translating batch ${event.batch}/${event.total_batches}…`);
            } else if (event.type === 'done') {
              finalData = event;
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (_) { /* ignore parse errors */ }
        }
      }

      if (!finalData) {
        const r2 = await fetch(`${API_BASE_URL}/api/vocab/extract-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToUse, language: langToUse, target_languages: selectedTargetLangs.length > 0 ? selectedTargetLangs : null }),
        });
        finalData = await r2.json();
      }

      setExtractedWords(finalData.words || []);
      setSynonymWords(finalData.synonyms || []);
      setExistingWords(finalData.existing || []);
      setSelectedWords(new Set((finalData.words || []).map(w => w.word)));
      setSelectedSynonyms(new Set((finalData.synonyms || []).map(w => w.word)));

      const newLangData = {};
      for (const [lang, info] of Object.entries(finalData.translations_by_lang || {})) {
        newLangData[lang] = {
          new_words: info.new_words || [],
          existing_words: info.existing_words || [],
          selected: new Set((info.new_words || []).map(w => w.word)),
        };
      }
      setLangData(newLangData);
      setActiveTab(importFromTranslation ? importFromTranslation.language : language);
      setPhase('cards_review');
      setDebugData(finalData);
    } catch (err) {
      if (err.name === 'AbortError') return;
      Alert.alert('Extract Error', err.message || 'Failed to extract words.');
    } finally {
      setProcessing(false);
      setProgress(null);
      setStatus('');
      abortRef.current = null;
    }
  };

  // ── Cards phase: Commit import ──
  const handleImport = async () => {
    const sourceToImport = extractedWords.filter(w => selectedWords.has(w.word));
    const synonymsToMerge = synonymWords.filter(w => selectedSynonyms.has(w.word));
    const total = sourceToImport.length + synonymsToMerge.length +
      Object.values(langData).reduce((s, ld) => s + ld.selected.size, 0);
    if (total === 0) {
      Alert.alert('No Words', 'Select at least one word to import.');
      return;
    }
    setImporting(true);
    setStatus('Importing words…');
    try {
      const wordsByLang = {};
      const existingByLang = {};
      for (const [lang, ld] of Object.entries(langData)) {
        const sel = ld.new_words.filter(w => ld.selected.has(w.word));
        if (sel.length > 0) wordsByLang[lang] = sel;
        const existIds = (ld.existing_words || [])
          .map(w => w.existing_id || w.id)
          .filter(Boolean);
        if (existIds.length > 0) existingByLang[lang] = existIds;
      }
      const srcLang = importFromTranslation ? importFromTranslation.language : language;
      const existingIds = (existingWords || [])
        .map(w => w.existing_id || w.id)
        .filter(Boolean);
      const res = await fetch(`${API_BASE_URL}/api/vocab/commit-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: srcLang,
          words: sourceToImport,
          synonyms: synonymsToMerge,
          words_by_lang: wordsByLang,
          deck_name: deckName.trim() || `Translation ${new Date().toLocaleDateString()}`,
          existing_ids: existingIds.length > 0 ? existingIds : undefined,
          existing_by_lang: Object.keys(existingByLang).length > 0 ? existingByLang : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${res.status}`);
      }
      const data = await res.json();
      setImportResult(data);
      setPhase('cards_done');
      if ((data.new_words > 0 || data.merged_synonyms > 0) && onImportComplete) onImportComplete(data);
    } catch (err) {
      Alert.alert('Import Error', err.message || 'Failed to import words.');
    } finally {
      setImporting(false);
      setStatus('');
    }
  };

  // ── Helpers (identical to TextImportModal) ──
  const getWordClassColor = (wc) => {
    const found = WORD_CLASSES.find(c => c.value.toLowerCase() === (wc || '').toLowerCase());
    return found ? found.color : { bg: '#F5F5F5', text: '#666' };
  };

  const toggleWord = (lang, word) => {
    if (lang === language) {
      setSelectedWords(prev => { const n = new Set(prev); n.has(word) ? n.delete(word) : n.add(word); return n; });
    } else {
      setLangData(prev => {
        const ld = prev[lang]; if (!ld) return prev;
        const n = new Set(ld.selected); n.has(word) ? n.delete(word) : n.add(word);
        return { ...prev, [lang]: { ...ld, selected: n } };
      });
    }
  };
  const toggleSynonym = (word) => {
    setSelectedSynonyms(prev => { const n = new Set(prev); n.has(word) ? n.delete(word) : n.add(word); return n; });
  };
  const toggleTargetLang = (code) => {
    setSelectedTargetLangs(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const getTabWords = (t) => t === language ? extractedWords : (langData[t]?.new_words || []);
  const getTabSynonyms = (t) => t === language ? synonymWords : [];
  const getTabExisting = (t) => t === language ? existingWords : (langData[t]?.existing_words || []);
  const getTabSelected = (t) => t === language ? selectedWords : (langData[t]?.selected || new Set());
  const getTabWcFilter = (t) => wordClassFilter[t] || '';
  const getTabLvFilter = (t) => levelFilter[t] || '';
  const setTabWcFilter = (t, v) => setWordClassFilter(prev => ({ ...prev, [t]: v }));
  const setTabLvFilter = (t, v) => setLevelFilter(prev => ({ ...prev, [t]: v }));

  const getFilteredWords = (t) => {
    const words = getTabWords(t);
    const wc = getTabWcFilter(t); const lv = getTabLvFilter(t);
    return words.filter(w => (!wc || w.word_class === wc) && (!lv || (w.level || '').toLowerCase() === lv.toLowerCase()));
  };
  const getFilteredSynonyms = (t) => {
    const syns = getTabSynonyms(t);
    const wc = getTabWcFilter(t); const lv = getTabLvFilter(t);
    return syns.filter(w => (!wc || w.word_class === wc) && (!lv || (w.level || '').toLowerCase() === lv.toLowerCase()));
  };
  const selectAllTab = (t) => {
    const f = getFilteredWords(t);
    const fSyn = getFilteredSynonyms(t);
    if (t === language) {
      setSelectedWords(new Set(f.map(w => w.word)));
      setSelectedSynonyms(prev => { const next = new Set(prev); fSyn.forEach(w => next.add(w.word)); return next; });
    } else {
      setLangData(prev => { const ld = prev[t]; if (!ld) return prev; return { ...prev, [t]: { ...ld, selected: new Set([...f.map(w => w.word), ...fSyn.map(w => w.word)]) } }; });
    }
  };
  const selectNoneTab = (t) => {
    if (t === language) setSelectedWords(new Set());
    else setLangData(prev => { const ld = prev[t]; if (!ld) return prev; return { ...prev, [t]: { ...ld, selected: new Set() } }; });
  };

  const totalSelectedCount = selectedWords.size + selectedSynonyms.size +
    Object.values(langData).reduce((s, ld) => s + ld.selected.size, 0);

  const reviewTabs = useMemo(() => {
    const tabs = [language];
    for (const lang of selectedTargetLangs) { if (langData[lang]) tabs.push(lang); }
    return tabs;
  }, [language, selectedTargetLangs, langData]);

  // ── Render word card (mirrors TextImportModal) ──
  const renderWordCard = (tabLang, item, index) => {
    const tabSelected = getTabSelected(tabLang);
    const isSelected = tabSelected.has(item.word);
    const wcc = getWordClassColor(item.word_class);
    const levelColor = LEVEL_COLORS[(item.level || '').toUpperCase()] || { bg: '#E8F4FD', text: '#4A90E2' };
    const isUrdu = tabLang === 'urdu';
    const isHindi = tabLang === 'hindi';
    const genderSuffix = (isHindi || isUrdu) && item.gender ? ` (${item.gender})` : '';
    return (
      <TouchableOpacity
        key={`${item.word}_${index}`}
        style={[styles.wordCard, isSelected && styles.wordCardSelected]}
        onPress={() => toggleWord(tabLang, item.word)}
        activeOpacity={0.7}
      >
        <View style={styles.wordCardHeader}>
          <View style={[styles.wordCardMain, isUrdu && { alignItems: 'flex-start' }]}>
            <Text style={[styles.wordCardNative, isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' }]}>
              {formatMultiTerm(item.nastaliq || item.word)}{genderSuffix}
            </Text>
            {item.transliteration ? <Text style={styles.wordCardTranslit}>{formatMultiTerm(item.transliteration)}</Text> : null}
            <Text style={styles.wordCardEnglish}>{item.english}</Text>
            {tabLang !== language && item.synonym_of_word ? (
              <View style={styles.synonymOfSection}>
                <View style={styles.synonymOfBadge}>
                  <Ionicons name="git-merge-outline" size={12} color="#92400E" />
                  <Text style={styles.synonymOfLabel}>Synonym of</Text>
                </View>
                <Text style={[styles.synonymOfNative, isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' }]}>
                  {(isUrdu && item.synonym_of_word_nastaliq) ? item.synonym_of_word_nastaliq : item.synonym_of_word}
                </Text>
                {item.synonym_of_transliteration ? <Text style={[styles.synonymOfTranslit, (isHindi || isUrdu) && { fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }) }]}>{formatMultiTerm(item.synonym_of_transliteration)}</Text> : null}
              </View>
            ) : null}
          </View>
          <View style={[styles.wordCardCheckbox, isSelected && styles.wordCardCheckboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </View>
        </View>
        <View style={styles.wordCardTags}>
          {item.word_class ? <View style={[styles.tag, { backgroundColor: wcc.bg }]}><Text style={[styles.tagText, { color: wcc.text }]}>{item.word_class}</Text></View> : null}
          <View style={[styles.tag, { backgroundColor: (item.level && LEVEL_COLORS[item.level.toUpperCase()]) ? levelColor.bg : '#E5E7EB' }]}>
            <Text style={[styles.tagText, { color: (item.level && LEVEL_COLORS[item.level.toUpperCase()]) ? levelColor.text : '#6B7280' }]}>
              {item.level ? item.level.toUpperCase() : '—'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTabContent = (tabLang) => {
    const filtered = getFilteredWords(tabLang);
    const filteredSynonyms = getFilteredSynonyms(tabLang);
    const existing = getTabExisting(tabLang);
    const synonyms = getTabSynonyms(tabLang);
    const allWords = getTabWords(tabLang);
    const wc = getTabWcFilter(tabLang);
    const lv = getTabLvFilter(tabLang);

    const presentWcSet = new Set(allWords.map(w => w.word_class).filter(Boolean));
    const presentWc = WORD_CLASSES.filter(c => c.value !== 'All' && presentWcSet.has(c.value));
    const presentLvSet = new Set(allWords.map(w => (w.level || '').toLowerCase()).filter(Boolean));
    const presentLv = LEVELS.filter(l => l !== 'All' && presentLvSet.has(l.toLowerCase()));
    const cefrLevels = CEFR_LEVELS.filter(l => presentLvSet.has((l.value || '').toLowerCase()));

    return (
      <View style={{ flex: 1 }}>
        {presentWc.length > 0 && (
          <View style={styles.filterBar}>
            <View style={styles.filterWrap}>
              {presentWc.map(c => {
                const active = wc === c.value;
                return (
                  <TouchableOpacity key={c.value}
                    style={[styles.filterChip, { backgroundColor: active ? c.color.bg : c.color.bg + '22', borderColor: c.color.bg }]}
                    onPress={() => setTabWcFilter(tabLang, active ? '' : c.value)}>
                    <Text style={[styles.filterChipText, { color: active ? c.color.text : c.color.bg }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
        {cefrLevels.length > 0 && (
          <View style={[styles.filterBar, { marginTop: 0 }]}>
            <View style={styles.filterWrap}>
              {cefrLevels.map(l => {
                const lc = LEVEL_COLORS[l.value?.toUpperCase()] || { bg: '#999', text: '#FFF' };
                const active = (lv || '').toLowerCase() === (l.value || '').toLowerCase();
                return (
                  <TouchableOpacity key={l.value}
                    style={[styles.filterChip, { backgroundColor: active ? lc.bg : lc.bg + '22', borderColor: lc.bg }]}
                    onPress={() => setTabLvFilter(tabLang, active ? '' : l.value)}>
                    <Text style={[styles.filterChipText, { color: active ? lc.text : lc.bg }]}>{l.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
        <View style={styles.selectAllRow}>
          <TouchableOpacity onPress={() => selectAllTab(tabLang)} style={styles.selectAllBtn}>
            <Text style={styles.selectAllText}>Select All ({filtered.length + filteredSynonyms.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => selectNoneTab(tabLang)} style={styles.selectAllBtn}>
            <Text style={styles.selectAllText}>Select None</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.reviewListContent}>
          {filtered.length > 0 && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.categorySectionTitle}>✨ New Words ({filtered.length})</Text>
                <Text style={styles.categoryHint}>Will be added from scratch</Text>
              </View>
              {filtered.map((w, i) => renderWordCard(tabLang, w, i))}
            </View>
          )}
          {filteredSynonyms.length > 0 && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.categorySectionTitle}>🔗 Synonyms ({filteredSynonyms.length})</Text>
                <Text style={styles.categoryHint}>Will be merged into existing card</Text>
              </View>
              {filteredSynonyms.map((w, i) => {
                const isSel = selectedSynonyms.has(w.word);
                const wcc = getWordClassColor(w.word_class);
                const levelColor = LEVEL_COLORS[(w.level || '').toUpperCase()] || { bg: '#E8F4FD', text: '#4A90E2' };
                const isUrdu = tabLang === 'urdu';
                const isHindi = tabLang === 'hindi';
                const genderSuffix = (isHindi || isUrdu) && w.gender ? ` (${w.gender})` : '';
                return (
                  <TouchableOpacity key={`syn_${w.word}_${i}`}
                    style={[styles.wordCard, styles.synonymCard, isSel && styles.synonymCardSelected]}
                    onPress={() => toggleSynonym(w.word)} activeOpacity={0.7}>
                    <View style={styles.wordCardHeader}>
                      <View style={[styles.wordCardMain, isUrdu && { alignItems: 'flex-start' }]}>
                        <Text style={[styles.wordCardNative, isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' }]}>
                          {formatMultiTerm(w.nastaliq || w.word)}{genderSuffix}
                        </Text>
                        {w.transliteration ? <Text style={styles.wordCardTranslit}>{formatMultiTerm(w.transliteration)}</Text> : null}
                        <Text style={styles.wordCardEnglish}>{w.english}</Text>
                        <View style={styles.synonymOfSection}>
                          <View style={styles.synonymOfBadge}>
                            <Ionicons name="git-merge-outline" size={12} color="#92400E" />
                            <Text style={styles.synonymOfLabel}>Synonym of</Text>
                          </View>
                          <Text style={[styles.synonymOfNative, isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' }]}>
                            {isUrdu && w.synonym_of_word_nastaliq ? w.synonym_of_word_nastaliq : formatMultiTerm(w.synonym_of_word || '')}
                          </Text>
                          {w.synonym_of_transliteration ? <Text style={[styles.synonymOfTranslit, (isHindi || isUrdu) && { fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }) }]}>{formatMultiTerm(w.synonym_of_transliteration)}</Text> : null}
                        </View>
                      </View>
                      <View style={[styles.wordCardCheckbox, isSel && styles.synonymCheckboxActive]}>
                        {isSel && <Ionicons name="checkmark" size={14} color="#FFF" />}
                      </View>
                    </View>
                    <View style={styles.wordCardTags}>
                      {w.word_class ? <View style={[styles.tag, { backgroundColor: wcc.bg }]}><Text style={[styles.tagText, { color: wcc.text }]}>{w.word_class}</Text></View> : null}
                      <View style={[styles.tag, { backgroundColor: (w.level && LEVEL_COLORS[w.level.toUpperCase()]) ? levelColor.bg : '#E5E7EB' }]}>
                        <Text style={[styles.tagText, { color: (w.level && LEVEL_COLORS[w.level.toUpperCase()]) ? levelColor.text : '#6B7280' }]}>
                          {w.level ? w.level.toUpperCase() : '—'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {existing.length > 0 && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: '#9CA3AF' }]} />
                <Text style={styles.categorySectionTitle}>📚 Already In Library ({existing.length})</Text>
                <Text style={styles.categoryHint}>Won't be added again</Text>
              </View>
              {existing.map((w, i) => {
                const wcc = getWordClassColor(w.word_class);
                const levelColor = LEVEL_COLORS[(w.level || '').toUpperCase()] || { bg: '#E8F4FD', text: '#4A90E2' };
                return (
                  <View key={`ex_${i}`} style={styles.existingCard}>
                    <Text style={styles.existingNative}>{formatMultiTerm(w.word)}</Text>
                    {w.transliteration ? <Text style={styles.wordCardTranslit}>{formatMultiTerm(w.transliteration)}</Text> : null}
                    <Text style={styles.wordCardEnglish}>{w.english_word}</Text>
                    <View style={[styles.wordCardTags, { marginTop: 8 }]}>
                      {w.word_class ? <View style={[styles.tag, { backgroundColor: wcc.bg }]}><Text style={[styles.tagText, { color: wcc.text }]}>{w.word_class}</Text></View> : null}
                      <View style={[styles.tag, { backgroundColor: (w.level && LEVEL_COLORS[(w.level || '').toUpperCase()]) ? levelColor.bg : '#E5E7EB' }]}>
                        <Text style={[styles.tagText, { color: (w.level && LEVEL_COLORS[(w.level || '').toUpperCase()]) ? levelColor.text : '#6B7280' }]}>
                          {w.level ? w.level.toUpperCase() : '—'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {filtered.length === 0 && filteredSynonyms.length === 0 && existing.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="filter-outline" size={40} color="#CCC" />
              <Text style={styles.emptyText}>{allWords.length === 0 ? 'No new words found' : 'No words match the filter'}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // ── Header back logic ──
  const headerLeft = () => {
    if (phase === 'cards_review') return () => setPhase('cards_input');
    if (phase === 'cards_input') return () => setPhase('translate');
    if (phase === 'history') return () => setPhase('translate');
    return null; // 'translate' and 'done' just close
  };
  const goBack = headerLeft();

  // ── Resolve target language name ──
  const targetLangMeta = LANGUAGES.find(l => l.code === targetLang);
  const sourceLangMeta = LANGUAGES.find(l => l.code === language);

  const openImportForTranslation = (code) => {
    const text = translation?.[code]?.translated_text?.trim();
    if (!text) return;
    setImportModal({ visible: true, language: code, text });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack || handleClose} style={styles.closeBtn}>
            <Ionicons name={goBack ? 'arrow-back' : 'close'} size={24} color="#666" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {(() => {
              const activeLang = (phase !== 'translate' && phase !== 'history' && importFromTranslation)
                ? LANGUAGES.find(l => l.code === importFromTranslation.language)
                : sourceLangMeta;
              return activeLang ? (
                <View style={[styles.headerLangIcon, { backgroundColor: activeLang.color || '#0FA896' }]}>
                  <Text style={[styles.headerLangIconText, activeLang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                    {activeLang.nativeChar || activeLang.langCode?.toUpperCase()?.slice(0, 2)}
                  </Text>
                </View>
              ) : null;
            })()}
            <Text style={styles.title}>
              {phase === 'translate' ? 'Translate'
                : phase === 'history' ? 'Translation History'
                : phase === 'cards_input' ? 'Make Vocab Cards'
                : phase === 'cards_review' ? 'Review Words'
                : 'Cards Created'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {phase === 'translate' && (
              <TouchableOpacity
                onPress={() => setPhase('history')}
                style={styles.headerDictBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={22} color="#666" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => dictionary.setShowDictionary(true)}
              style={styles.headerDictBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="book-outline" size={22} color="#4A90E2" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════
            PHASE 1: TRANSLATE
        ══════════════════════════════════════════════════════ */}
        {phase === 'translate' && (
          <>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              {/* Source text — language is identified from the text, not tied to a single language */}
              <Text style={styles.sectionLabel}>Source text</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter text (language is auto-detected)…"
                  placeholderTextColor="#999"
                  multiline
                  value={sourceText}
                  onChangeText={setSourceText}
                  editable={!translating}
                  textAlignVertical="top"
                  underlineColorAndroid="transparent"
                />
              </View>

              {/* Target language picker - gray boxy cards like Vocab/Flashcards language selector */}
              <Text style={styles.sectionLabel}>Translate to</Text>
              <View style={styles.langPickerGrid}>
                {[{ code: 'english', name: 'English', langCode: 'en', nativeChar: 'EN', color: '#012169' }, ...targetLanguages.filter(l => l.code !== 'english')].map(l => {
                  const isSelected = selectedTargetLangs.includes(l.code);
                  return (
                    <TouchableOpacity
                      key={l.code}
                      style={[
                        styles.langCard,
                        isSelected && styles.langCardSelected,
                        isSelected && { borderColor: l.color || '#4A90E2' },
                        !isSelected && { borderColor: '#D0D0D0' },
                      ]}
                      onPress={() => {
                        setSelectedTargetLangs(prev =>
                          prev.includes(l.code)
                            ? prev.filter(c => c !== l.code)
                            : [...prev, l.code]
                        );
                      }}
                    >
                      <View style={[styles.langCardIcon, { backgroundColor: l.color || '#4A90E2' }]}>
                        <Text style={[styles.langCardIconText, l.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                          {l.nativeChar || l.langCode?.toUpperCase() || '??'}
                        </Text>
                      </View>
                      <Text style={[styles.langCardLabel, isSelected && { color: l.color || '#4A90E2', fontWeight: '700' }]}>{l.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.saveDefaultBtn]}
                onPress={() => {
                  fetch(`${API_BASE_URL}/api/user-preferences`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ default_translate_target_languages: JSON.stringify(selectedTargetLangs) }),
                  }).then(r => { if (r.ok) Alert.alert('Saved', 'Default translate-to languages updated.'); })
                    .catch(() => Alert.alert('Error', 'Could not save.'));
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#4A90E2" />
                <Text style={styles.saveDefaultBtnText}>Save as default</Text>
              </TouchableOpacity>

              {/* Translation result */}
              {translating && (
                <View style={styles.translatingBox}>
                  <ActivityIndicator size="small" color="#4A90E2" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.translatingText}>
                      {translateProgress && translateProgress.total > 0
                        ? `Translating ${translateProgress.current}/${translateProgress.total}${
                            translateProgress.currentLangName ? ` – ${translateProgress.currentLangName}` : ''
                          }…`
                        : 'Translating…'}
                    </Text>
                    {translateProgress && translateProgress.total > 0 && (
                      <View style={styles.translateProgressBarOuter}>
                        <View
                          style={[
                            styles.translateProgressBarInner,
                            {
                              width: `${Math.max(
                                5,
                                Math.round((translateProgress.current / translateProgress.total) * 100),
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                    )}
                    {!!status && <Text style={styles.translateStatusText}>{status}</Text>}
                  </View>
                </View>
              )}
              {translationError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="warning-outline" size={18} color="#EF4444" />
                  <Text style={styles.errorText}>{translationError}</Text>
                </View>
              ) : null}
              {translation && !translating && (
                <View style={styles.resultBox}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultLabel}>Translations</Text>
                    <TouchableOpacity
                      style={styles.translitToggleBtn}
                      onPress={() => setShowTransliterations(!showTransliterations)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.translitToggleText, showTransliterations && styles.translitToggleTextActive]}>Aa</Text>
                    </TouchableOpacity>
                  </View>
                  {Object.entries(translation).map(([code, data]) => {
                    const meta = LANGUAGES.find(l => l.code === code) || { name: code };
                    const isUrdu = code === 'urdu';
                    const isCollapsed = collapsedLangs[code];
                    const translit = transliterations[code];
                    return (
                      <View key={code} style={styles.resultLangBlock}>
                        <TouchableOpacity
                          style={styles.resultLangHeader}
                          onPress={() => toggleLangCollapsed(code)}
                          activeOpacity={0.7}
                        >
                          {meta.nativeChar ? (
                            <View style={[styles.resultLangIcon, { backgroundColor: meta.color || '#4A90E2' }]}>
                              <Text style={[styles.resultLangIconText, code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                                {meta.nativeChar}
                              </Text>
                            </View>
                          ) : null}
                          <Text style={styles.resultLangLabel}>{meta.name}</Text>
                          <Ionicons
                            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                            size={16}
                            color="#9CA3AF"
                          />
                        </TouchableOpacity>
                        {!isCollapsed && (
                          <>
                            {renderTappableText(
                              data?.translated_text,
                              code,
                              [
                                styles.resultText,
                                isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right', writingDirection: 'rtl' },
                              ],
                            )}
                            {showTransliterations && translit && code !== 'english'
                              ? renderTappableText(translit, code, styles.resultTranslit)
                              : null}
                            {data?.notes ? (
                              <Text style={styles.resultNotes}>{data.notes}</Text>
                            ) : null}
                            <TouchableOpacity
                              style={styles.importFromTranslationBtn}
                              onPress={() => openImportForTranslation(code)}
                            >
                              <Ionicons name="albums-outline" size={16} color="#8B5CF6" />
                              <Text style={styles.importFromTranslationBtnText}>Import vocab for {meta.name}</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primaryBtn, (!sourceText.trim() || translating) && styles.btnDisabled]}
                onPress={handleTranslate}
                disabled={!sourceText.trim() || translating}
              >
                {translating
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <>
                      <Ionicons name="language" size={20} color="#FFF" />
                      <Text style={styles.btnText}>Translate</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            HISTORY VIEW
        ══════════════════════════════════════════════════════ */}
        {phase === 'history' && (
          <View style={{ flex: 1 }}>
            {/* Collapsible multi-select language filters (all selected by default) */}
            <TouchableOpacity
              style={styles.histFilterHeader}
              onPress={() => setHistoryFiltersExpanded(!historyFiltersExpanded)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="filter" size={16} color="#555" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#555' }}>
                  Filters{!historyLangFilters ? '' : historyLangFilters.size === 0 ? ' (none)' : ` (${historyLangFilters.size})`}
                </Text>
              </View>
              <Ionicons name={historyFiltersExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#999" />
            </TouchableOpacity>
            {historyFiltersExpanded && (
              <View style={styles.histFilterBody}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <TouchableOpacity
                    style={[styles.histFilterChip, !historyLangFilters && styles.histFilterChipActive]}
                    onPress={() => setHistoryLangFilters(null)}
                  >
                    <Text style={[styles.histFilterChipText, !historyLangFilters && styles.histFilterChipTextActive]}>All</Text>
                  </TouchableOpacity>
                  {[...new Set(['english', language, ...(userSelectedLanguages || [])])].filter(Boolean).map(code => {
                    const meta = LANGUAGES.find(l => l.code === code);
                    if (!meta) return null;
                    const active = historyLangFilters ? historyLangFilters.has(code) : true;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[styles.histFilterChip, active && styles.histFilterChipActive]}
                        onPress={() => {
                          setHistoryLangFilters(prev => {
                            const allCodes = [...new Set(['english', language, ...(userSelectedLanguages || [])])].filter(Boolean);
                            if (!prev) {
                              const next = new Set(allCodes);
                              next.delete(code);
                              return next;
                            }
                            const next = new Set(prev);
                            if (next.has(code)) next.delete(code); else next.add(code);
                            if (next.size === allCodes.length) return null;
                            return next;
                          });
                        }}
                      >
                        <View style={[styles.histFilterChipIcon, { backgroundColor: meta.color || '#888' }]}>
                          <Text style={[styles.histFilterChipIconText, meta.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                            {meta.nativeChar || meta.langCode?.toUpperCase()?.slice(0, 2)}
                          </Text>
                        </View>
                        <Text style={[styles.histFilterChipText, active && styles.histFilterChipTextActive]}>{meta.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {historyLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4A90E2" />
              </View>
            ) : filteredHistory.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                <Ionicons name="time-outline" size={48} color="#D1D5DB" />
                <Text style={{ fontSize: 16, color: '#9CA3AF', marginTop: 12, textAlign: 'center' }}>
                  {allHistory.length === 0
                    ? 'No translations yet.\nYour translations will appear here.'
                    : 'No translations match the selected filters.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredHistory}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                renderItem={({ item }) => {
                  const srcMeta = LANGUAGES.find(l => l.code === item.source_language);
                  const targetCodes = item.target_languages || [];
                  const previewText = (item.source_text || '').slice(0, 120);
                  const date = item.created_at ? new Date(item.created_at + 'Z') : null;
                  const dateStr = date
                    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '';
                  const durationSec = item.duration_seconds;
                  const durationStr = durationSec != null
                    ? durationSec >= 60 ? `${Math.floor(durationSec / 60)}m ${Math.round(durationSec % 60)}s` : `${Math.round(durationSec)}s`
                    : null;
                  return (
                    <TouchableOpacity
                      style={styles.histCard}
                      onPress={() => loadHistoryEntry(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.histCardTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          {srcMeta && (
                            <View style={[styles.histCardLangIcon, { backgroundColor: srcMeta.color || '#888' }]}>
                              <Text style={[styles.histCardLangIconText, srcMeta.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                                {srcMeta.nativeChar || srcMeta.langCode?.toUpperCase()?.slice(0, 2)}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.histCardSourceLang}>{srcMeta?.name || item.source_language}</Text>
                          {targetCodes.length > 0 && (
                            <>
                              <Ionicons name="arrow-forward" size={14} color="#9CA3AF" style={{ marginHorizontal: 6 }} />
                              {targetCodes.map(tc => {
                                const tm = LANGUAGES.find(l => l.code === tc);
                                if (!tm) return null;
                                return (
                                  <View key={tc} style={[styles.histCardTargetIcon, { backgroundColor: tm.color || '#888', marginRight: 4 }]}>
                                    <Text style={[styles.histCardTargetIconText, tm.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                                      {tm.nativeChar || tm.langCode?.toUpperCase()?.slice(0, 2)}
                                    </Text>
                                  </View>
                                );
                              })}
                            </>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.histCardDate}>{dateStr}</Text>
                          {durationStr && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                              <Ionicons name="timer-outline" size={11} color="#9CA3AF" />
                              <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{durationStr}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={[
                        styles.histCardPreview,
                        srcMeta?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'right', writingDirection: 'rtl' },
                      ]} numberOfLines={2}>
                        {previewText}{item.source_text?.length > 120 ? '…' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════
            PHASE 2: CARDS INPUT
        ══════════════════════════════════════════════════════ */}
        {phase === 'cards_input' && (
          <>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.description}>
                {importFromTranslation
                  ? `Words will be extracted from the ${(LANGUAGES.find(l => l.code === importFromTranslation.language) || { name: importFromTranslation.language }).name} translation, lemmatized, and categorized before import.`
                  : `Words will be extracted from your ${sourceLangMeta?.name || language} source text, lemmatized, and categorized before import.`}
              </Text>

              {/* Preview the source text (read-only) */}
              <Text style={styles.sectionLabel}>Source Text</Text>
              <View style={styles.sourcePreviewBox}>
                <Text style={styles.sourcePreviewText} numberOfLines={4}>{sourceText}</Text>
              </View>

              {/* Deck Name */}
              <View style={styles.deckNameSection}>
                <Text style={styles.deckNameLabel}>Deck Name</Text>
                <TextInput
                  style={styles.deckNameInput}
                  placeholder={`Translation ${new Date().toLocaleDateString()}`}
                  placeholderTextColor="#999"
                  value={deckName}
                  onChangeText={setDeckName}
                  editable={!processing}
                  maxLength={60}
                />
                <Text style={styles.deckNameHint}>A new deck will be created for these cards.</Text>
              </View>

              {/* Also Translate To Other Languages */}
              {otherUserLanguages.length > 0 && (
                <View style={styles.crossTranslateSection}>
                  <TouchableOpacity
                    style={styles.crossTranslateHeader}
                    onPress={() => setCrossTranslateExpanded(!crossTranslateExpanded)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.crossTranslateHeaderLeft}>
                      <TouchableOpacity
                        style={[styles.crossTranslateCheckbox, selectedTargetLangs.length > 0 && styles.crossTranslateCheckboxActive]}
                        onPress={() => {
                          if (selectedTargetLangs.length > 0) setSelectedTargetLangs([]);
                          else { setSelectedTargetLangs(otherUserLanguages.map(l => l.code)); setCrossTranslateExpanded(true); }
                        }}
                      >
                        {selectedTargetLangs.length > 0 && <Ionicons name="checkmark" size={14} color="#FFF" />}
                      </TouchableOpacity>
                      <Text style={styles.crossTranslateTitle}>Also Add Cards for Other Languages</Text>
                      {selectedTargetLangs.length > 0 && (
                        <View style={styles.crossTranslateBadge}>
                          <Text style={styles.crossTranslateBadgeText}>{selectedTargetLangs.length}</Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name={crossTranslateExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
                  </TouchableOpacity>
                  {crossTranslateExpanded && (
                    <View style={styles.crossTranslateList}>
                      {otherUserLanguages.map((lang) => {
                        const isSel = selectedTargetLangs.includes(lang.code);
                        return (
                          <TouchableOpacity key={lang.code}
                            style={[
                              styles.crossTranslateLangRow,
                              isSel && styles.crossTranslateLangRowSelected,
                            ]}
                            onPress={() => toggleTargetLang(lang.code)} activeOpacity={0.7}>
                            <View style={[styles.crossTranslateLangIcon, { backgroundColor: lang.color || '#4A90E2' }]}>
                              {lang.nativeChar
                                ? <Text style={[styles.crossTranslateLangIconText, lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>{lang.nativeChar}</Text>
                                : <Text style={styles.crossTranslateLangIconCode}>{lang.langCode?.toUpperCase()}</Text>}
                            </View>
                            <Text style={styles.crossTranslateLangName}>{lang.name}</Text>
                            <View style={[styles.crossTranslateLangCheckbox, isSel && styles.crossTranslateLangCheckboxActive]}>
                              {isSel && <Ionicons name="checkmark" size={14} color="#FFF" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {processing && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color="#4A90E2" />
                  <Text style={styles.processingText}>{status || 'Extracting words…'}</Text>
                  {progress && progress.total_batches > 1 && (
                    <View style={styles.progressBarOuter}>
                      <View style={[styles.progressBarInner, {
                        width: `${Math.round((progress.batch / progress.total_batches) * 100)}%`,
                        backgroundColor: progress.phase === 'translate' ? '#8B5CF6' : '#4A90E2',
                      }]} />
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primaryBtn, processing && styles.btnDisabled]}
                onPress={handleExtract}
                disabled={processing}
              >
                {processing
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <>
                      <Ionicons name="sparkles" size={20} color="#FFF" />
                      <Text style={styles.btnText}>
                        {selectedTargetLangs.length > 0 ? `Extract & Translate (${selectedTargetLangs.length + 1})` : 'Extract Words'}
                      </Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            PHASE 3: CARDS REVIEW
        ══════════════════════════════════════════════════════ */}
        {phase === 'cards_review' && (
          <>
            <View style={styles.reviewSummaryBar}>
              <View style={styles.reviewStat}>
                <Text style={styles.reviewStatNum}>{extractedWords.length}</Text>
                <Text style={styles.reviewStatLabel}>New</Text>
              </View>
              <View style={styles.reviewStat}>
                <Text style={styles.reviewStatNum}>{existingWords.length}</Text>
                <Text style={styles.reviewStatLabel}>Known</Text>
              </View>
              <View style={styles.reviewStat}>
                <Text style={[styles.reviewStatNum, { color: '#4A90E2' }]}>{totalSelectedCount}</Text>
                <Text style={styles.reviewStatLabel}>Selected</Text>
              </View>
              {debugData && (
                <TouchableOpacity
                  style={styles.debugButton}
                  onPress={() => setDebugVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="bug-outline" size={16} color="#4B5563" />
                  <Text style={styles.debugButtonText}>Debug</Text>
                </TouchableOpacity>
              )}
            </View>

            {reviewTabs.length > 1 && (
              <View style={styles.tabBar}>
                {reviewTabs.map(tabLang => {
                  const lm = LANGUAGES.find(l => l.code === tabLang);
                  const isSource = tabLang === language;
                  const tabSel = isSource ? selectedWords.size : (langData[tabLang]?.selected?.size || 0);
                  const tabNew = isSource ? extractedWords.length : (langData[tabLang]?.new_words?.length || 0);
                  const isActive = activeTab === tabLang;
                  return (
                    <TouchableOpacity key={tabLang}
                      style={[styles.tab, isActive && styles.tabActive]}
                      onPress={() => setActiveTab(tabLang)} activeOpacity={0.7}>
                      <View style={[styles.tabLangDot, { backgroundColor: lm?.color || '#4A90E2' }]} />
                      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{lm?.name || tabLang}</Text>
                      <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>{tabSel}/{tabNew}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={{ flex: 1 }}>
              {renderTabContent(activeTab)}
            </View>

            <View style={styles.footer}>
              {importing && <Text style={styles.importingText}>{status}</Text>}
              <TouchableOpacity
                style={[styles.primaryBtn, (totalSelectedCount === 0 || importing) && styles.btnDisabled]}
                onPress={handleImport}
                disabled={totalSelectedCount === 0 || importing}
              >
                {importing
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <>
                      <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                      <Text style={styles.btnText}>Create Deck & Import ({totalSelectedCount})</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            PHASE 4: CARDS DONE
        ══════════════════════════════════════════════════════ */}
        {phase === 'cards_done' && importResult && (
          <>
            <View style={styles.doneContainer}>
              <Ionicons name="checkmark-circle" size={72} color="#4CAF50" />
              <Text style={styles.doneTitle}>Deck Created!</Text>
              <Text style={styles.doneSubtitle}>
                {importResult.deck_name ? `"${importResult.deck_name}"` : 'Your new deck'}
              </Text>
              <View style={styles.doneStats}>
                {(importResult.new_words || 0) > 0 && (
                  <View style={[styles.doneStat, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={[styles.doneStatNum, { color: '#16A34A' }]}>{importResult.new_words}</Text>
                    <Text style={styles.doneStatLabel}>New Cards</Text>
                  </View>
                )}
                {(importResult.merged_synonyms || 0) > 0 && (
                  <View style={[styles.doneStat, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={[styles.doneStatNum, { color: '#D97706' }]}>{importResult.merged_synonyms}</Text>
                    <Text style={styles.doneStatLabel}>Synonyms Merged</Text>
                  </View>
                )}
                {Object.entries(importResult.added_by_lang || {}).map(([lang, words]) => {
                  if (!words.length) return null;
                  const lm = LANGUAGES.find(l => l.code === lang);
                  return (
                    <View key={lang} style={[styles.doneStat, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.doneStatNum, { color: '#2E7D32' }]}>{words.length}</Text>
                      <Text style={styles.doneStatLabel}>{lm?.name || lang}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={styles.footer}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleClose}>
                <Text style={styles.btnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      <VocabImportDebugModal
        visible={debugVisible && !!debugData}
        onClose={() => setDebugVisible(false)}
        data={debugData}
        sourceLanguage={language}
      />
      <TextImportModal
        visible={importModal.visible}
        onClose={() => setImportModal({ visible: false, language: null, text: '' })}
        language={importModal.language || language}
        prefillText={importModal.text}
        onImportComplete={onImportComplete}
      />
      <VocabularyDictionary
        visible={dictionary.showDictionary}
        onClose={() => dictionary.setShowDictionary(false)}
        language={language}
        initialSearchQuery={dictionary.initialSearchQuery}
        dictionaryLanguage={dictionary.dictionaryLanguage}
        setDictionaryLanguage={dictionary.setDictionaryLanguage}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 16,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFF',
  },
  closeBtn: { padding: 8 },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  headerLangIcon: {
    width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
  },
  headerLangIconText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  headerDictBtn: { padding: 8 },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 100 },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 16 },
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 4 },

  inputContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 4,
    overflow: 'hidden',
  },
  textInput: {
    fontSize: 15,
    color: '#1A1A1A',
    padding: 14,
    minHeight: 100,
    maxHeight: 200,
    borderWidth: 0,
    outlineStyle: 'none',
  },

  // Language picker - gray boxy cards (same style as Vocab/Flashcards language selector)
  langPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
    paddingTop: 2,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECECEC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: '30%',
    maxWidth: '48%',
  },
  langCardSelected: {
    backgroundColor: '#FFF',
    borderColor: undefined, // set per-item to l.color
  },
  langCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langCardIconText: { fontSize: 11, color: '#FFF', fontWeight: '700' },
  langCardLabel: { fontSize: 14, color: '#333', fontWeight: '500' },

  // Translation result
  translatingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  translatingText: { fontSize: 14, color: '#666' },
  translateProgressBarOuter: {
    marginTop: 4,
    width: '100%',
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  translateProgressBarInner: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4A90E2',
  },
  translateStatusText: { fontSize: 12, color: '#888', marginTop: 4 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF1F1', borderRadius: 10, padding: 12, marginTop: 8,
  },
  errorText: { flex: 1, fontSize: 14, color: '#EF4444' },
  resultBox: {
    backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E0E0E0',
    padding: 14, marginTop: 16,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  resultLabel: { fontSize: 13, fontWeight: '600', color: '#555', flex: 1 },
  translitToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  translitToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  translitToggleTextActive: {
    color: '#4A90E2',
  },
  makeCardsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F4FD', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  makeCardsBtnText: { fontSize: 12, fontWeight: '600', color: '#4A90E2' },
  resultText: { fontSize: 16, color: '#1A1A1A', lineHeight: 24 },
  tappableWord: { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: '#D1D5DB' },
  resultNotes: { fontSize: 13, color: '#888', marginTop: 8, fontStyle: 'italic' },
  resultLangBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  resultLangHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  resultLangIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultLangIconText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultLangLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  resultTranslit: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 22,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  importCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 6,
  },
  importCheckRowSelected: {},
  importCheckLabel: { fontSize: 14, color: '#444' },
  importFromTranslationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
  },
  importFromTranslationBtnText: { fontSize: 13, color: '#8B5CF6', fontWeight: '600' },
  saveDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  saveDefaultBtnText: { fontSize: 14, color: '#4A90E2', fontWeight: '600' },
  makeCardsBtnBlock: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  makeCardsBtnDisabled: { opacity: 0.6 },

  // Source preview (cards input)
  sourcePreviewBox: {
    backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 4,
  },
  sourcePreviewText: { fontSize: 13, color: '#555', lineHeight: 18 },

  // Deck name
  deckNameSection: { marginTop: 8, marginBottom: 4 },
  deckNameLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  deckNameInput: {
    backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0',
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1A1A1A',
  },
  deckNameHint: { fontSize: 12, color: '#999', marginTop: 4 },

  // Cross-translate (same as TextImportModal)
  crossTranslateSection: { marginTop: 16, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E8E8E8', overflow: 'hidden' },
  crossTranslateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  crossTranslateHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  crossTranslateCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center' },
  crossTranslateCheckboxActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  crossTranslateTitle: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1 },
  crossTranslateBadge: { backgroundColor: '#4A90E2', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  crossTranslateBadgeText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  crossTranslateList: { borderTopWidth: 1, borderTopColor: '#F0F0F0', padding: 8 },
  crossTranslateLangRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginBottom: 4, gap: 10 },
  crossTranslateLangRowSelected: { backgroundColor: '#F0F7FF' },
  crossTranslateLangIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  crossTranslateLangIconText: { fontSize: 14, color: '#FFF', fontWeight: '600' },
  crossTranslateLangIconCode: { fontSize: 10, color: '#FFF', fontWeight: 'bold' },
  crossTranslateLangName: { flex: 1, fontSize: 15, color: '#333' },
  crossTranslateLangCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center' },
  crossTranslateLangCheckboxActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },

  processingContainer: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  processingText: { fontSize: 14, color: '#666', textAlign: 'center' },
  progressBarOuter: { width: '100%', height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, overflow: 'hidden' },
  progressBarInner: { height: 6, borderRadius: 3 },

  // Review phase
  reviewSummaryBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 10 },
  reviewStat: { alignItems: 'center' },
  reviewStatNum: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  reviewStatLabel: { fontSize: 12, color: '#888', marginTop: 2 },

  tabBar: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F5F5F5' },
  tabActive: { backgroundColor: '#E8F4FD' },
  tabLangDot: { width: 8, height: 8, borderRadius: 4 },
  tabText: { fontSize: 13, color: '#666' },
  tabTextActive: { color: '#4A90E2', fontWeight: '600' },
  tabBadge: { backgroundColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: '#BFDBFE' },
  tabBadgeText: { fontSize: 11, color: '#666' },
  tabBadgeTextActive: { color: '#1D4ED8', fontWeight: '700' },

  filterBar: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingVertical: 8 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 6 },
  filterScroll: { paddingHorizontal: 12, gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  filterDivider: { width: 1, height: '100%', backgroundColor: '#E0E0E0', marginHorizontal: 4 },

  selectAllRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 12, backgroundColor: '#F9F9F9' },
  selectAllBtn: { backgroundColor: '#EEE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  selectAllText: { fontSize: 12, color: '#555', fontWeight: '600' },
  reviewListContent: { padding: 12, paddingBottom: 60 },

  categorySection: { marginBottom: 16 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categorySectionTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  categoryHint: { fontSize: 12, color: '#999', marginLeft: 4 },

  wordCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1.5, borderColor: '#E5E5E5' },
  wordCardSelected: { borderColor: '#4A90E2', backgroundColor: '#F0F7FF' },
  wordCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  wordCardMain: { flex: 1 },
  wordCardNative: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  wordCardTranslit: { fontSize: 13, color: '#888', fontStyle: 'italic', marginTop: 2 },
  wordCardEnglish: { fontSize: 14, color: '#555', marginTop: 2 },
  wordCardCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  wordCardCheckboxActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  wordCardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '600' },

  synonymCard: { borderColor: '#F59E0B' },
  synonymCardSelected: { borderColor: '#D97706', backgroundColor: '#FFFBEB' },
  synonymCheckboxActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  synonymOfSection: { marginTop: 10, paddingTop: 8, paddingBottom: 6, paddingHorizontal: 10, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', alignSelf: 'stretch' },
  synonymOfBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  synonymOfLabel: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  synonymOfText: { fontSize: 12, color: '#92400E' },
  synonymOfNative: { fontSize: 15, fontWeight: '600', color: '#78350F', marginBottom: 2 },
  synonymOfTranslit: { fontSize: 12, color: '#B45309', fontStyle: 'italic' },

  existingCard: { backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E5E5', opacity: 0.8 },
  existingNative: { fontSize: 18, fontWeight: '700', color: '#999' },

  emptyContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },

  importingText: { fontSize: 13, color: '#666', marginBottom: 6, textAlign: 'center' },

  // Done phase
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginTop: 16 },
  doneSubtitle: { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
  doneStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24, justifyContent: 'center' },
  doneStat: { borderRadius: 12, padding: 16, alignItems: 'center', minWidth: 80 },
  doneStatNum: { fontSize: 28, fontWeight: '800' },
  doneStatLabel: { fontSize: 12, color: '#666', marginTop: 4 },

  footer: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4A90E2', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // History
  histFilterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  histFilterBody: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  histFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
  },
  histFilterChipActive: { backgroundColor: '#EBF5FF', borderColor: '#4A90E2' },
  histFilterChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  histFilterChipTextActive: { color: '#4A90E2', fontWeight: '600' },
  histFilterChipIcon: {
    width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center',
  },
  histFilterChipIconText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  histCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  histCardTop: { flexDirection: 'row', alignItems: 'center' },
  histCardLangIcon: {
    width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  histCardLangIconText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  histCardSourceLang: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginLeft: 8 },
  histCardDate: { fontSize: 12, color: '#9CA3AF' },
  histCardPreview: { fontSize: 14, color: '#4B5563', lineHeight: 20, marginTop: 10 },
  histCardTargetIcon: {
    width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center',
  },
  histCardTargetIconText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
