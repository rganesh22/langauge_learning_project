import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LanguageContext, LANGUAGES } from '../contexts/LanguageContext';
import { AuthContext } from '../contexts/AuthContext';
import { WORD_CLASSES, LEVELS, LEVEL_COLORS, CEFR_LEVELS, VERB_TRANSITIVITY_FILTERS } from '../constants/filters';
import { ImportJobContext } from '../contexts/ImportJobContext';
import VocabImportDebugModal from './VocabImportDebugModal';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

// Display multiple terms with ' / ' instead of comma
const formatMultiTerm = (s) => (s || '').replace(/\s*,\s*/g, ' / ');

// step: 'input' | 'review' | 'done'

export default function TextImportModal({ visible, onClose, language, onImportComplete, prefillText = '', initialJobId: initialJobIdProp = null, targetDeckId = null, initialDeckName = '' }) {
  const { userSelectedLanguages } = useContext(LanguageContext);
  const { authHeaders } = useContext(AuthContext);
  const importJob = useContext(ImportJobContext);

  // When opened from tray (GlobalImportModal) we get initialJobId; when we start extract via context we set boundJobId
  const [boundJobId, setBoundJobId] = useState(null);
  const initialJobId = initialJobIdProp ?? null;
  const effectiveJobId = boundJobId || initialJobId;
  const job = (effectiveJobId && importJob) ? importJob.getJob(effectiveJobId) : null;

  // ── Step 1: Input state ──
  const [text, setText] = useState('');
  const [deckName, setDeckName] = useState('');
  const [crossTranslateExpanded, setCrossTranslateExpanded] = useState(false);
  const [selectedTargetLangs, setSelectedTargetLangs] = useState([]);
  const [personalization, setPersonalization] = useState(null);

  // ── Step 2: Review state ──
  const [step, setStep] = useState('input');
  const [activeTab, setActiveTab] = useState(language); // which language tab is showing

  // Source language
  const [extractedWords, setExtractedWords] = useState([]);
  const [synonymWords, setSynonymWords] = useState([]);  // words that are synonyms of existing entries
  const [existingWords, setExistingWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState(new Set()); // source lang new words
  const [selectedSynonyms, setSelectedSynonyms] = useState(new Set()); // source lang synonym words

  // Per target-language: { [langCode]: { new_words: [], existing_words: [], selected: Set } }
  const [langData, setLangData] = useState({});

  // Filters (per-tab, keyed by lang code)
  const [wordClassFilter, setWordClassFilter] = useState({});
  const [levelFilter, setLevelFilter] = useState({});
  const [transitivityFilter, setTransitivityFilter] = useState({});
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // ── Processing + real-time progress ──
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null); // { phase, batch, total_batches, words_done }
  const abortRef = useRef(null); // AbortController ref for SSE
  const importStartTimeRef = useRef(null);
  const lastBoundJobStatusRef = useRef(null);

  // ── Done state & debug ──
  const [importResult, setImportResult] = useState(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugData, setDebugData] = useState(null);

  // ── Lemma explorer (sentence + lemma modal) ──
  const [lemmaPanelExpanded, setLemmaPanelExpanded] = useState(false);
  const [lemmaModalVisible, setLemmaModalVisible] = useState(false);
  const [lemmaModalWord, setLemmaModalWord] = useState('');
  const [lemmaModalLemmas, setLemmaModalLemmas] = useState([]);
  const [lemmaModalTranslations, setLemmaModalTranslations] = useState({});

  const otherLanguages = LANGUAGES.filter(
    l => userSelectedLanguages.includes(l.code) && l.code !== language
  );

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

  const validateTextLanguage = (langCode, textToCheck) => {
    const trimmed = (textToCheck || '').trim();
    if (!trimmed) return true;
    const matcher = scriptMatchers[langCode];
    if (!matcher) return true;
    if (!matcher.test(trimmed)) {
      const meta = LANGUAGES.find(l => l.code === langCode);
      const langName = meta?.name || langCode;
      Alert.alert(
        'Language Mismatch',
        `The text you provided does not look like it is in ${langName}. Please check the language or change the selected language.`,
      );
      return false;
    }
    return true;
  };

  // When modal is closed (by any method), reset binding/processing so reopening gives a fresh form; job stays in context for tray
  useEffect(() => {
    if (!visible) {
      setBoundJobId(null);
      setProcessing(false);
      setProgress(null);
      setStatus('');
      lastBoundJobStatusRef.current = null;
    }
  }, [visible]);

  // When a prefillText is provided (e.g., from Reading/Translation activity), populate the text field
  React.useEffect(() => {
    if (visible && prefillText && !text) {
      setText(prefillText);
    }
  }, [visible, prefillText]);

  // When opened for "add to deck", prefill deck name
  React.useEffect(() => {
    if (visible && targetDeckId && initialDeckName) {
      setDeckName(initialDeckName);
    }
  }, [visible, targetDeckId, initialDeckName]);

  // When opened from tray with initialJobId, load job state into modal (once per open)
  const loadedJobIdRef = useRef(null);
  useEffect(() => {
    if (!visible || !initialJobId || !importJob || !job) return;
    if (job.status !== 'review' && job.status !== 'done') return;
    if (loadedJobIdRef.current === initialJobId) return;
    loadedJobIdRef.current = initialJobId;
    setStep(job.importResult ? 'done' : 'review');
    setExtractedWords(job.extractedWords || []);
    setSynonymWords(job.synonymWords || []);
    setExistingWords(job.existingWords || []);
    setSelectedWords(new Set(job.selectedWords || []));
    setSelectedSynonyms(new Set(job.selectedSynonyms || []));
    const ld = {};
    for (const [lang, data] of Object.entries(job.langData || {})) {
      ld[lang] = {
        ...data,
        selected: new Set(Array.isArray(data.selected) ? data.selected : []),
      };
    }
    setLangData(ld);
    setActiveTab(job.language || language);
    setDeckName(job.deckName || '');
    setImportResult(job.importResult || null);
    setBoundJobId(initialJobId);
    setDebugData(job.debugData || null);
  }, [visible, initialJobId, importJob, job?.id, job?.status]);
  useEffect(() => {
    if (!visible) loadedJobIdRef.current = null;
  }, [visible]);

  // When we started extract via context (boundJobId), watch job until review or error (only run setState once per transition to avoid loop)
  useEffect(() => {
    if (!visible || !boundJobId || !importJob || !job) return;
    if (job.status === 'review') {
      if (lastBoundJobStatusRef.current === 'review') return;
      lastBoundJobStatusRef.current = 'review';
      setProcessing(false);
      setProgress(null);
      setStatus('');
      setExtractedWords(job.extractedWords || []);
      setSynonymWords(job.synonymWords || []);
      setExistingWords(job.existingWords || []);
      setSelectedWords(new Set(job.selectedWords || []));
      setSelectedSynonyms(new Set(job.selectedSynonyms || []));
      const ld = {};
      for (const [lang, data] of Object.entries(job.langData || {})) {
        ld[lang] = {
          ...data,
          selected: new Set(Array.isArray(data.selected) ? data.selected : []),
        };
      }
      setLangData(ld);
      setActiveTab(job.language || language);
      setStep('review');
      setDebugData(job.debugData || null);
    } else if (job.status === 'error') {
      if (lastBoundJobStatusRef.current === 'error') return;
      lastBoundJobStatusRef.current = 'error';
      setProcessing(false);
      setProgress(null);
      setStatus('');
      Alert.alert('Extract Error', job.errorMsg || 'Failed to extract words.');
    } else {
      lastBoundJobStatusRef.current = job.status;
    }
  }, [visible, boundJobId, importJob, job?.id, job?.status]);

  // Sync selection changes back to the job (for tray/reopen). Use ref for importJob to avoid loop when context identity changes.
  const importJobRef = useRef(importJob);
  importJobRef.current = importJob;
  useEffect(() => {
    if (!effectiveJobId || !importJobRef.current || step !== 'review' || extractedWords.length === 0) return;
    const serializedLangData = {};
    for (const [lang, ld] of Object.entries(langData)) {
      serializedLangData[lang] = {
        ...ld,
        selected: ld.selected instanceof Set ? [...ld.selected] : (ld.selected || []),
      };
    }
    importJobRef.current.updateJob(effectiveJobId, {
      selectedWords: [...selectedWords],
      selectedSynonyms: [...selectedSynonyms],
      langData: serializedLangData,
    });
  }, [effectiveJobId, step, extractedWords.length, selectedWords, selectedSynonyms, langData]);

  // Load default import-translation preferences when modal opens
  React.useEffect(() => {
    if (!visible || !language) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/language-personalization/${language}`);
        if (res.ok) {
          const data = await res.json();
          setPersonalization(data);
          if (data.default_import_translate && data.default_import_target_langs?.length > 0) {
            setSelectedTargetLangs(data.default_import_target_langs);
            setCrossTranslateExpanded(true);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [visible, language]);

  const toggleTargetLang = (code) => {
    setSelectedTargetLangs(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleFilePick = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,.csv,text/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => setText(ev.target.result);
          reader.readAsText(file);
        }
      };
      input.click();
    } else {
      try {
        const DocumentPicker = require('expo-document-picker');
        const FileSystem = require('expo-file-system');
        const result = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/csv'], copyToCacheDirectory: true });
        if (!result.canceled && result.assets?.length > 0) {
          const content = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
          setText(content);
        }
      } catch (err) {
        Alert.alert('Error', 'Could not read the file. Please paste text instead.');
      }
    }
  };

  // Step 1 → Step 2: Extract via SSE streaming for real-time progress
  const handleExtract = async () => {
    const inputText = text.trim() || prefillText.trim();
    if (!inputText) {
      Alert.alert('No Text', 'Please paste some text or upload a file first.');
      return;
    }
    if (!validateTextLanguage(language, inputText)) {
      return;
    }
    // Run extract in background via context so closing the modal doesn't cancel it
    if (importJob) {
      const id = importJob.startImport(inputText, language, deckName.trim(), selectedTargetLangs);
      setBoundJobId(id);
      setProcessing(true);
      return;
    }
    setProcessing(true);
    setProgress(null);
    setStatus(selectedTargetLangs.length > 0 ? 'Extracting & translating words…' : 'Extracting words…');
    importStartTimeRef.current = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE_URL}/api/vocab/extract-text-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          language,
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
        buffer = lines.pop(); // keep incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'start') {
              setProgress({ phase: 'start', total_words: event.total_words, total_batches: event.total_batches, batch: 0 });
              setStatus(`Processing ${event.total_words} word${event.total_words !== 1 ? 's' : ''} in ${event.total_batches} batch${event.total_batches !== 1 ? 'es' : ''}…`);
            } else if (event.type === 'progress') {
              setProgress(event);
              if (event.phase === 'lemmatize') {
                setStatus(`Lemmatizing batch ${event.batch}/${event.total_batches}…`);
              } else if (event.phase === 'db_check') {
                setStatus(`Found ${event.new} new, ${event.existing} known words`);
              } else if (event.phase === 'translate') {
                const langNames = (event.languages || []).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ');
                setStatus(`Translating batch ${event.batch}/${event.total_batches} for ${langNames}…`);
              }
            } else if (event.type === 'done') {
              finalData = event;
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // ignore malformed lines
          }
        }
      }

      if (!finalData) {
        // Fallback: non-streaming
        const r2 = await fetch(`${API_BASE_URL}/api/vocab/extract-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText, language, target_languages: selectedTargetLangs.length > 0 ? selectedTargetLangs : null }),
        });
        finalData = await r2.json();
      }

      // Source language
      setExtractedWords(finalData.words || []);
      setSynonymWords(finalData.synonyms || []);
      setExistingWords(finalData.existing || []);
      setSelectedWords(new Set((finalData.words || []).map(w => w.word)));
      // Auto-select all synonyms by default (user can deselect)
      setSelectedSynonyms(new Set((finalData.synonyms || []).map(w => w.word)));

      // Target languages
      const newLangData = {};
      for (const [lang, info] of Object.entries(finalData.translations_by_lang || {})) {
        newLangData[lang] = {
          new_words: info.new_words || [],
          existing_words: info.existing_words || [],
          selected: new Set((info.new_words || []).map(w => w.word)),
        };
      }
      setLangData(newLangData);
      setActiveTab(language);
      setStep('review');
      setDebugData({
        ...finalData,
        input_text: finalData.input_text ?? inputText,
        raw_tokens: finalData.raw_tokens ?? (inputText.trim().split(/\s+/).filter(Boolean)),
        lemma_tokens: finalData.lemma_tokens ?? finalData.words ?? [],
        translations_by_lang: finalData.translations_by_lang ?? {},
      });
    } catch (err) {
      if (err.name === 'AbortError') return; // user cancelled
      Alert.alert('Extract Error', err.message || 'Failed to extract words.');
    } finally {
      setProcessing(false);
      setProgress(null);
      setStatus('');
      abortRef.current = null;
    }
  };

  // Step 2 → Step 3: Commit
  const handleImport = async () => {
    const sourceToImport = extractedWords.filter(w => selectedWords.has(w.word));
    const synonymsToMerge = synonymWords.filter(w => selectedSynonyms.has(w.word));
    const totalSelected = sourceToImport.length + synonymsToMerge.length + Object.values(langData).reduce((s, ld) => s + ld.selected.size, 0);
    if (totalSelected === 0) {
      Alert.alert('No Words', 'Select at least one word to import.');
      return;
    }

    // Build words_by_lang and existing_by_lang
    const wordsByLang = {};
    const existingByLang = {};
    for (const [lang, ld] of Object.entries(langData)) {
      const selected = ld.new_words.filter(w => ld.selected.has(w.word));
      if (selected.length > 0) {
        wordsByLang[lang] = selected;
      }
      const existingIds = (ld.existing_words || [])
        .map(w => w.existing_id || w.id)
        .filter(Boolean);
      if (existingIds.length > 0) {
        existingByLang[lang] = existingIds;
      }
    }
    const existingIds = (existingWords || [])
      .map(w => w.existing_id || w.id)
      .filter(Boolean);

    const payload = {
      language,
      words: sourceToImport,
      synonyms: synonymsToMerge,
      words_by_lang: wordsByLang,
      deck_name: deckName.trim() || null,
      deck_id: targetDeckId ?? undefined,
      existing_ids: existingIds.length > 0 ? existingIds : undefined,
      existing_by_lang: Object.keys(existingByLang).length > 0 ? existingByLang : undefined,
    };

    // When this modal was opened from the import job flow (tray), run commit in background and close so user can leave
    if (effectiveJobId && importJob?.startCommit) {
      importJob.startCommit(effectiveJobId, payload);
      importJob.closeModal();
      onClose();
      return;
    }

    // No job context (e.g. opened from Vocab Library): block in modal until done
    setImporting(true);
    setStatus('Importing words…');
    try {
      const res = await fetch(`${API_BASE_URL}/api/vocab/commit-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          language: payload.language,
          words: payload.words,
          synonyms: payload.synonyms,
          words_by_lang: payload.words_by_lang,
          deck_name: payload.deck_name,
          deck_id: payload.deck_id,
          existing_ids: payload.existing_ids,
          existing_by_lang: payload.existing_by_lang,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${res.status}`);
      }
      const data = await res.json();
      const totalDuration = importStartTimeRef.current
        ? Math.round((Date.now() - importStartTimeRef.current) / 100) / 10
        : null;
      if (totalDuration != null) data.import_duration_seconds = totalDuration;
      if (data.deck_id && totalDuration != null) {
        fetch(`${API_BASE_URL}/api/vocab/decks/${data.deck_id}/duration?duration_seconds=${totalDuration}`, { method: 'PATCH', headers: { ...authHeaders } }).catch(() => {});
      }
      setImportResult(data);
      setStep('done');
      if ((data.new_words > 0 || data.merged_synonyms > 0) && onImportComplete) onImportComplete(data);
    } catch (err) {
      Alert.alert('Import Error', err.message || 'Failed to import words.');
    } finally {
      setImporting(false);
      setStatus('');
    }
  };

  const handleClose = () => {
    if (!boundJobId && abortRef.current) abortRef.current.abort();
    setBoundJobId(null);
    setText('');
    setDeckName('');
    setStep('input');
    setActiveTab(language);
    setExtractedWords([]);
    setSynonymWords([]);
    setExistingWords([]);
    setSelectedWords(new Set());
    setSelectedSynonyms(new Set());
    setLangData({});
    setWordClassFilter({});
    setLevelFilter({});
    setTransitivityFilter({});
    setProcessing(false);
    setImporting(false);
    setStatus('');
    setProgress(null);
    setImportResult(null);
    setCrossTranslateExpanded(false);
    setSelectedTargetLangs([]);
    setDebugData(null);
    setDebugVisible(false);
    setLemmaPanelExpanded(false);
    setLemmaModalVisible(false);
    setLemmaModalWord('');
    setLemmaModalLemmas([]);
    setLemmaModalTranslations({});
    setFiltersExpanded(true);
    onClose();
  };

  // ── Helpers ──
  const getWordClassColor = (wc) => {
    const found = WORD_CLASSES.find(c => c.value.toLowerCase() === (wc || '').toLowerCase());
    return found ? found.color : { bg: '#F5F5F5', text: '#666' };
  };

  const toggleWord = (lang, word) => {
    if (lang === language) {
      setSelectedWords(prev => {
        const next = new Set(prev);
        next.has(word) ? next.delete(word) : next.add(word);
        return next;
      });
    } else {
      setLangData(prev => {
        const ld = prev[lang];
        if (!ld) return prev;
        const next = new Set(ld.selected);
        next.has(word) ? next.delete(word) : next.add(word);
        return { ...prev, [lang]: { ...ld, selected: next } };
      });
    }
  };

  const toggleSynonym = (word) => {
    setSelectedSynonyms(prev => {
      const next = new Set(prev);
      next.has(word) ? next.delete(word) : next.add(word);
      return next;
    });
  };

  const getTabWords = (tabLang) => {
    if (tabLang === language) return extractedWords;
    return langData[tabLang]?.new_words || [];
  };

  /** New words only (excludes synonym-type entries). For target langs, synonym-type new words are in getTabSynonyms. */
  const getTabNewWordsOnly = (tabLang) => {
    if (tabLang === language) return extractedWords;
    const words = langData[tabLang]?.new_words || [];
    return words.filter(w => !w.synonym_of_word);
  };

  /** Synonym entries: source = synonymWords; target = new_words that are synonym of an existing word. */
  const getTabSynonyms = (tabLang) => {
    if (tabLang === language) return synonymWords;
    const words = langData[tabLang]?.new_words || [];
    return words.filter(w => w.synonym_of_word);
  };

  const getTabExisting = (tabLang) => {
    if (tabLang === language) return existingWords;
    return langData[tabLang]?.existing_words || [];
  };

  const getTabSelected = (tabLang) => {
    if (tabLang === language) return selectedWords;
    return langData[tabLang]?.selected || new Set();
  };

  const getTabWcFilter = (tabLang) => wordClassFilter[tabLang] || '';
  const getTabLvFilter = (tabLang) => levelFilter[tabLang] || '';
  const getTabTrFilter = (tabLang) => transitivityFilter[tabLang] || '';

  // When bound to a background job, show its progress in the modal
  const effectiveProcessing = processing || (!!job && job.status === 'extracting');
  const effectiveProgress = (job?.status === 'extracting' && job.progress) ? job.progress : progress;
  const effectiveStatus = (job?.status === 'extracting' && job.statusMessage) ? job.statusMessage : status;

  // Open lemma detail modal for a clicked surface token
  const openLemmaModal = (surfaceWord) => {
    if (!debugData) return;
    const lemmaTokens = debugData.lemma_tokens || debugData.lemmatized_tokens || [];
    const translationsByLang = debugData.translations_by_lang || {};
    const trimmed = (surfaceWord || '').trim();
    if (!trimmed) return;
    const trimmedLower = trimmed.toLowerCase();

    // Source lemmas whose word matches this surface token (exact or substring)
    const lemmas = lemmaTokens.filter(tok => {
      const w = (tok.word || '').trim().toLowerCase();
      return w === trimmedLower || trimmedLower.includes(w) || w.includes(trimmedLower);
    });
    const lemmaWords = lemmas
      .map(lem => (lem.word || '').trim())
      .filter(Boolean);

    // Helper to normalize English definitions: lowercase + strip parentheses
    const normalizeEnglish = (s) =>
      (s || '')
        .toLowerCase()
        .replace(/\s*\([^)]*\)/g, '')
        .trim();

    // Merge translations for all lemmas of this surface word.
    // First try an explicit source_word linkage (preferred),
    // then fall back to fuzzy English-gloss matching.
    const mergedTranslations = {};
    if (lemmas.length > 0) {
      const lemmaNorms = lemmas
        .map(lem => normalizeEnglish(lem.english))
        .filter(Boolean);

      Object.entries(translationsByLang).forEach(([langCode, info]) => {
        const all = [...(info.new_words || []), ...(info.existing_words || [])];
        const matches = [];
        all.forEach(w => {
          const sourceWord = (w.source_word || '').trim();
          const eng = (w.english || w.english_word || '').trim();
          const norm = normalizeEnglish(eng);

          // 1) Strong match: explicit linkage from backend by source_word
          if (sourceWord && lemmaWords.includes(sourceWord)) {
            matches.push(w);
            return;
          }

          // 2) Fallback: fuzzy English gloss match (backwards compatible)
          if (!norm) return;
          const isMatch = lemmaNorms.some(l => norm === l || norm.includes(l) || l.includes(norm));
          if (isMatch) {
            matches.push(w);
          }
        });
        if (matches.length > 0) {
          mergedTranslations[langCode] = matches;
        }
      });
    }

    setLemmaModalWord(trimmed);
    setLemmaModalLemmas(lemmas);
    setLemmaModalTranslations(mergedTranslations);
    setLemmaModalVisible(true);
  };

  const setTabWcFilter = (tabLang, val) => setWordClassFilter(prev => ({ ...prev, [tabLang]: val }));
  const setTabLvFilter = (tabLang, val) => setLevelFilter(prev => ({ ...prev, [tabLang]: val }));
  const setTabTrFilter = (tabLang, val) => setTransitivityFilter(prev => ({ ...prev, [tabLang]: val }));

  const getFilteredWords = (tabLang) => {
    const words = getTabNewWordsOnly(tabLang);
    const wc = getTabWcFilter(tabLang);
    const lv = getTabLvFilter(tabLang);
    const tr = getTabTrFilter(tabLang);
    return words.filter(w => {
      if (wc && w.word_class !== wc) return false;
      if (lv && (w.level || '').toLowerCase() !== lv.toLowerCase()) return false;
      if (tr && (w.verb_transitivity || '').toLowerCase() !== tr.toLowerCase()) return false;
      return true;
    });
  };

  const getFilteredSynonyms = (tabLang) => {
    const synonyms = getTabSynonyms(tabLang);
    const wc = getTabWcFilter(tabLang);
    const lv = getTabLvFilter(tabLang);
    const tr = getTabTrFilter(tabLang);
    return synonyms.filter(w => {
      if (wc && w.word_class !== wc) return false;
      if (lv && (w.level || '').toLowerCase() !== lv.toLowerCase()) return false;
      if (tr && (w.verb_transitivity || '').toLowerCase() !== tr.toLowerCase()) return false;
      return true;
    });
  };

  const selectAllTab = (tabLang) => {
    const filtered = getFilteredWords(tabLang);
    const filteredSyn = getFilteredSynonyms(tabLang);
    if (tabLang === language) {
      setSelectedWords(new Set(filtered.map(w => w.word)));
      setSelectedSynonyms(prev => {
        const next = new Set(prev);
        filteredSyn.forEach(w => next.add(w.word));
        return next;
      });
    } else {
      setLangData(prev => {
        const ld = prev[tabLang];
        if (!ld) return prev;
        const allSelected = new Set([...filtered.map(w => w.word), ...filteredSyn.map(w => w.word)]);
        return { ...prev, [tabLang]: { ...ld, selected: allSelected } };
      });
    }
  };

  const selectNoneTab = (tabLang) => {
    if (tabLang === language) {
      setSelectedWords(new Set());
    } else {
      setLangData(prev => {
        const ld = prev[tabLang];
        if (!ld) return prev;
        return { ...prev, [tabLang]: { ...ld, selected: new Set() } };
      });
    }
  };

  const totalSelectedCount = selectedWords.size + selectedSynonyms.size + Object.values(langData).reduce((s, ld) => s + ld.selected.size, 0);

  // All review tabs: source lang + target langs that have data
  const reviewTabs = useMemo(() => {
    const tabs = [language];
    for (const lang of selectedTargetLangs) {
      if (langData[lang]) tabs.push(lang);
    }
    return tabs;
  }, [language, selectedTargetLangs, langData]);

  // ── Render word card ──
  const renderWordCard = (tabLang, item, index) => {
    const tabSelected = getTabSelected(tabLang);
    const isSelected = tabSelected.has(item.word);
    const wcc = getWordClassColor(item.word_class);
    const levelColor = LEVEL_COLORS[(item.level || '').toUpperCase()] || { bg: '#E8F4FD', text: '#4A90E2' };
    const isUrdu = tabLang === 'urdu';
    const isHindi = tabLang === 'hindi';
    const baseNative = formatMultiTerm(item.nastaliq || item.word || '');
    const alreadyHasGender = /\((m|f)\)/i.test(baseNative);
    const genderSuffix = (isHindi || isUrdu) && item.gender && !alreadyHasGender ? ` (${item.gender})` : '';
    return (
      <TouchableOpacity
        key={`${item.word}_${index}`}
        style={[styles.wordCard, isSelected && styles.wordCardSelected]}
        onPress={() => toggleWord(tabLang, item.word)}
        activeOpacity={0.7}
      >
        <View style={styles.wordCardHeader}>
          <View style={[styles.wordCardMain, isUrdu && { alignItems: 'flex-start' }]}>
            <Text style={[
              styles.wordCardNative,
              isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' },
            ]}>{baseNative}{genderSuffix}</Text>
            {item.transliteration ? <Text style={styles.wordCardTranslit}>{formatMultiTerm(item.transliteration)}</Text> : null}
            <Text style={styles.wordCardEnglish}>{item.english}</Text>
            {tabLang !== language && item.synonym_of_word ? (
              <View style={styles.synonymOfSection}>
                <View style={styles.synonymOfBadge}>
                  <Ionicons name="git-merge-outline" size={12} color="#92400E" />
                  <Text style={styles.synonymOfLabel}>Synonym of</Text>
                </View>
                <Text style={[
                  styles.synonymOfNative,
                  isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' },
                ]}>
                  {(isUrdu && item.synonym_of_word_nastaliq) ? item.synonym_of_word_nastaliq : formatMultiTerm(item.synonym_of_word)}
                </Text>
                {item.synonym_of_transliteration ? (
                  <Text style={[styles.synonymOfTranslit, (isHindi || isUrdu) && { fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }) }]}>{formatMultiTerm(item.synonym_of_transliteration)}</Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={[styles.wordCardCheckbox, isSelected && styles.wordCardCheckboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </View>
        </View>
        <View style={styles.wordCardTags}>
          {item.word_class ? (
            <View style={[styles.tag, { backgroundColor: wcc.bg }]}>
              <Text style={[styles.tagText, { color: wcc.text }]}>{item.word_class}</Text>
            </View>
          ) : null}
          <View style={[styles.tag, { backgroundColor: (item.level && LEVEL_COLORS[item.level.toUpperCase()]) ? levelColor.bg : '#E5E7EB' }]}>
            <Text style={[styles.tagText, { color: (item.level && LEVEL_COLORS[item.level.toUpperCase()]) ? levelColor.text : '#6B7280' }]}>
              {item.level ? item.level.toUpperCase() : '—'}
            </Text>
          </View>
          {item.verb_transitivity && (item.word_class || '').toLowerCase().includes('verb') && item.verb_transitivity !== 'N/A' && (
            (() => {
              const vtFilter = VERB_TRANSITIVITY_FILTERS.find(f => (f.value || '').toLowerCase() === (item.verb_transitivity || '').toLowerCase());
              const vtColor = vtFilter ? vtFilter.color : { bg: '#6B7280', text: '#FFF' };
              return (
                <View style={[styles.tag, { backgroundColor: vtColor.bg }]}>
                  <Text style={[styles.tagText, { color: vtColor.text }]}>{String(item.verb_transitivity).toLowerCase()}</Text>
                </View>
              );
            })()
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render tab content ──
  const renderTabContent = (tabLang) => {
    const filtered = getFilteredWords(tabLang);
    const filteredSynonyms = getFilteredSynonyms(tabLang);
    const existing = getTabExisting(tabLang);
    const synonyms = getTabSynonyms(tabLang);
    const allWords = tabLang === language
      ? [...getTabNewWordsOnly(tabLang), ...synonyms]
      : (langData[tabLang]?.new_words || []);
    const wc = getTabWcFilter(tabLang);
    const lv = getTabLvFilter(tabLang);
    const tr = getTabTrFilter(tabLang);

    // Present filter options from this tab's words + synonyms
    const presentWcSet = new Set(allWords.map(w => w.word_class).filter(Boolean));
    const presentWc = WORD_CLASSES.filter(c => c.value !== 'All' && presentWcSet.has(c.value));
    const presentLvSet = new Set(allWords.map(w => (w.level || '').toLowerCase()).filter(Boolean));
    const presentLv = LEVELS.filter(l => l !== 'All' && presentLvSet.has(l.toLowerCase()));
    // Show only CEFR levels that are actually present in this tab's words
    const cefrLevels = CEFR_LEVELS.filter(l => presentLvSet.has((l.value || '').toLowerCase()));
    const presentTrSet = new Set(
      allWords
        .filter(w => (w.word_class || '').toLowerCase().includes('verb'))
        .map(w => (w.verb_transitivity || '').toLowerCase())
        .filter(Boolean)
    );
    const trFilters = VERB_TRANSITIVITY_FILTERS.filter(f => presentTrSet.has(f.value.toLowerCase()));

    return (
      <View style={{ flex: 1 }}>
        {/* Collapsible filters header */}
        {(presentWc.length > 0 || cefrLevels.length > 0 || trFilters.length > 0) && (
          <View style={styles.reviewFiltersContainer}>
            <View style={[styles.filterBar, { paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="options-outline" size={16} color="#4B5563" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>Filters</Text>
              </View>
              <TouchableOpacity onPress={() => setFiltersExpanded(prev => !prev)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                <Ionicons name={filtersExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>
            <View style={styles.reviewFiltersCountRow}>
              <Text style={styles.reviewFiltersCountText}>
                {allWords.length === filtered.length + filteredSynonyms.length + existing.length
                  ? `${allWords.length} word${allWords.length !== 1 ? 's' : ''}`
                  : `Showing ${filtered.length + filteredSynonyms.length} of ${allWords.length} words`}
              </Text>
            </View>
          </View>
        )}

        {/* Filters body — single column, wrap so all visible without horizontal scroll */}
        {filtersExpanded && (
          <>
            {/* Part of Speech */}
            {presentWc.length > 0 && (
              <View style={[styles.filterBar, { borderTopWidth: 0 }]}>
                <Text style={styles.reviewFilterGroupLabel}>Part of speech</Text>
                <View style={styles.filterWrap}>
                  {presentWc.map(c => {
                    const active = wc === c.value;
                    return (
                      <TouchableOpacity
                        key={c.value}
                        style={[styles.filterChip, { backgroundColor: active ? c.color.bg : c.color.bg + '22', borderColor: c.color.bg }]}
                        onPress={() => setTabWcFilter(tabLang, active ? '' : c.value)}
                      >
                        <Text style={[styles.filterChipText, { color: active ? c.color.text : c.color.bg }]}>{c.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            {/* Level */}
            {cefrLevels.length > 0 && (
              <View style={[styles.filterBar, { marginTop: 0 }]}>
                <Text style={styles.reviewFilterGroupLabel}>Level</Text>
                <View style={styles.filterWrap}>
                  {cefrLevels.map(l => {
                    const lc = LEVEL_COLORS[l.value?.toUpperCase()] || { bg: '#999', text: '#FFF' };
                    const active = (lv || '').toLowerCase() === (l.value || '').toLowerCase();
                    return (
                      <TouchableOpacity
                        key={l.value}
                        style={[styles.filterChip, { backgroundColor: active ? lc.bg : lc.bg + '22', borderColor: lc.bg }]}
                        onPress={() => setTabLvFilter(tabLang, active ? '' : l.value)}
                      >
                        <Text style={[styles.filterChipText, { color: active ? lc.text : lc.bg }]}>{l.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            {/* Verb transitivity */}
            {trFilters.length > 0 && (
              <View style={[styles.filterBar, { marginTop: 0 }]}>
                <Text style={styles.reviewFilterGroupLabel}>Verb transitivity</Text>
                <View style={styles.filterWrap}>
                  {trFilters.map(f => {
                    const active = (tr || '').toLowerCase() === f.value.toLowerCase();
                    const bg = f.color.bg;
                    const text = f.color.text;
                    return (
                      <TouchableOpacity
                        key={f.value}
                        style={[styles.filterChip, { backgroundColor: active ? bg : bg + '22', borderColor: bg }]}
                        onPress={() => setTabTrFilter(tabLang, active ? '' : f.value)}
                      >
                        <Text style={[styles.filterChipText, { color: active ? text : bg }]}>{f.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* Select All / None */}
        <View style={styles.selectAllRow}>
          <TouchableOpacity onPress={() => selectAllTab(tabLang)} style={styles.selectAllBtn}>
            <Text style={styles.selectAllText}>Select All ({filtered.length + filteredSynonyms.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => selectNoneTab(tabLang)} style={styles.selectAllBtn}>
            <Text style={styles.selectAllText}>Select None</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.reviewListContent}>
          {/* ── New words (added from scratch) ── */}
          {filtered.length > 0 && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.categorySectionTitle}>✨ New Words ({filtered.length})</Text>
                <Text style={styles.categoryHint}>Will be added from scratch</Text>
              </View>
              {filtered.map((w, idx) => renderWordCard(tabLang, w, idx))}
            </View>
          )}

          {/* ── Synonym words (merged into existing card) ── */}
          {filteredSynonyms.length > 0 && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.categorySectionTitle}>🔗 Synonyms ({filteredSynonyms.length})</Text>
                <Text style={styles.categoryHint}>
                  {tabLang === language ? 'Will be merged into existing card' : 'New words linked to an existing entry'}
                </Text>
              </View>
              {filteredSynonyms.map((w, idx) => {
                const isSourceSynonym = tabLang === language;
                const isSel = isSourceSynonym ? selectedSynonyms.has(w.word) : getTabSelected(tabLang).has(w.word);
                const wcc = getWordClassColor(w.word_class);
                const levelColor = LEVEL_COLORS[(w.level || '').toUpperCase()] || { bg: '#E8F4FD', text: '#4A90E2' };
                const isUrdu = tabLang === 'urdu';
                const isHindi = tabLang === 'hindi';
                const baseNative = formatMultiTerm(w.nastaliq || w.word || '');
                const alreadyHasGender = /\((m|f)\)/i.test(baseNative);
                const genderSuffix = (isHindi || isUrdu) && w.gender && !alreadyHasGender ? ` (${w.gender})` : '';
                return (
                  <TouchableOpacity
                    key={`syn_${w.word}_${idx}`}
                    style={[styles.wordCard, styles.synonymCard, isSel && styles.synonymCardSelected]}
                    onPress={() => isSourceSynonym ? toggleSynonym(w.word) : toggleWord(tabLang, w.word)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.wordCardHeader}>
                      <View style={[styles.wordCardMain, isUrdu && { alignItems: 'flex-start' }]}>
                        <Text style={[
                          styles.wordCardNative,
                          isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' },
                        ]}>{baseNative}{genderSuffix}</Text>
                        {w.transliteration ? <Text style={[styles.wordCardTranslit, { marginTop: 2 }]}>{formatMultiTerm(w.transliteration)}</Text> : null}
                        <Text style={styles.wordCardEnglish}>{w.english}</Text>
                        {/* Synonym-of: own section with native script + transliteration below */}
                        <View style={styles.synonymOfSection}>
                          <View style={styles.synonymOfBadge}>
                            <Ionicons name="git-merge-outline" size={12} color="#92400E" />
                            <Text style={styles.synonymOfLabel}>Synonym of</Text>
                          </View>
                          <Text style={[
                            styles.synonymOfNative,
                            isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' },
                          ]}>
                            {isUrdu && w.synonym_of_word_nastaliq ? w.synonym_of_word_nastaliq : formatMultiTerm(w.synonym_of_word || '')}
                          </Text>
                          {w.synonym_of_transliteration ? (
                            <Text style={[styles.synonymOfTranslit, (isHindi || isUrdu) && { fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }) }]}>{formatMultiTerm(w.synonym_of_transliteration)}</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={[styles.wordCardCheckbox, isSel && styles.synonymCheckboxActive]}>
                        {isSel && <Ionicons name="checkmark" size={14} color="#FFF" />}
                      </View>
                    </View>
                    <View style={styles.wordCardTags}>
                      {w.word_class ? (
                        <View style={[styles.tag, { backgroundColor: wcc.bg }]}>
                          <Text style={[styles.tagText, { color: wcc.text }]}>{w.word_class}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.tag, { backgroundColor: (w.level && LEVEL_COLORS[w.level.toUpperCase()]) ? levelColor.bg : '#E5E7EB' }]}>
                        <Text style={[styles.tagText, { color: (w.level && LEVEL_COLORS[w.level.toUpperCase()]) ? levelColor.text : '#6B7280' }]}>
                          {w.level ? w.level.toUpperCase() : '—'}
                        </Text>
                      </View>
                      {w.verb_transitivity && (w.word_class || '').toLowerCase().includes('verb') && w.verb_transitivity !== 'N/A' && (
                        (() => {
                          const vtFilter = VERB_TRANSITIVITY_FILTERS.find(f => (f.value || '').toLowerCase() === (w.verb_transitivity || '').toLowerCase());
                          const vtColor = vtFilter ? vtFilter.color : { bg: '#6B7280', text: '#FFF' };
                          return (
                            <View style={[styles.tag, { backgroundColor: vtColor.bg }]}>
                              <Text style={[styles.tagText, { color: vtColor.text }]}>{String(w.verb_transitivity).toLowerCase()}</Text>
                            </View>
                          );
                        })()
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Already in library (can't add) ── */}
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
                const isUrdu = tabLang === 'urdu';
                const baseNative = formatMultiTerm(isUrdu && w.nastaliq ? w.nastaliq : w.word || '');
                return (
                  <View key={`ex_${i}`} style={styles.existingCard}>
                    <Text style={[
                      styles.existingNative,
                      isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' },
                    ]}>
                      {baseNative}
                    </Text>
                    {w.transliteration ? <Text style={styles.wordCardTranslit}>{formatMultiTerm(w.transliteration)}</Text> : null}
                    <Text style={styles.wordCardEnglish}>{w.english_word}</Text>
                    <View style={[styles.wordCardTags, { marginTop: 8 }]}>
                      {w.word_class ? (
                        <View style={[styles.tag, { backgroundColor: wcc.bg }]}>
                          <Text style={[styles.tagText, { color: wcc.text }]}>{w.word_class}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.tag, { backgroundColor: (w.level && LEVEL_COLORS[(w.level || '').toUpperCase()]) ? levelColor.bg : '#E5E7EB' }]}>
                        <Text style={[styles.tagText, { color: (w.level && LEVEL_COLORS[(w.level || '').toUpperCase()]) ? levelColor.text : '#6B7280' }]}>
                          {w.level ? w.level.toUpperCase() : '—'}
                        </Text>
                      </View>
                      {w.verb_transitivity && (w.word_class || '').toLowerCase().includes('verb') && w.verb_transitivity !== 'N/A' && (
                        (() => {
                          const vtFilter = VERB_TRANSITIVITY_FILTERS.find(f => (f.value || '').toLowerCase() === (w.verb_transitivity || '').toLowerCase());
                          const vtColor = vtFilter ? vtFilter.color : { bg: '#6B7280', text: '#FFF' };
                          return (
                            <View style={[styles.tag, { backgroundColor: vtColor.bg }]}>
                              <Text style={[styles.tagText, { color: vtColor.text }]}>{String(w.verb_transitivity).toLowerCase()}</Text>
                            </View>
                          );
                        })()
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {filtered.length === 0 && filteredSynonyms.length === 0 && existing.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="filter-outline" size={40} color="#CCC" />
              <Text style={styles.emptyText}>
                {allWords.length === 0 ? 'No new words for this language' : 'No words match the filter'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={step === 'review' ? (initialJobId ? handleClose : () => setStep('input')) : handleClose}
            style={styles.closeBtn}
          >
            <Ionicons name={step === 'review' ? 'arrow-back' : 'close'} size={24} color="#666" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {(() => {
              const langMeta = LANGUAGES.find(l => l.code === language);
              return langMeta ? (
                <View style={[styles.headerLangIcon, { backgroundColor: langMeta.color || '#0FA896' }]}>
                  <Text style={[styles.headerLangIconText, langMeta.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                    {langMeta.nativeChar || langMeta.langCode?.toUpperCase()?.slice(0, 2)}
                  </Text>
                </View>
              ) : null;
            })()}
            <View style={styles.headerImportIconWrap}>
              <Ionicons name="document-text" size={20} color="#4A90E2" />
            </View>
            <Text style={styles.title}>
              {step === 'input'
                ? 'Import Vocab'
                : step === 'review'
                ? 'Review Words'
                : 'Import Complete'}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── STEP 1: INPUT ── */}
        {step === 'input' && (
          <>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.description}>
                Paste text in {language ? language.charAt(0).toUpperCase() + language.slice(1) : 'your language'}. Words will be extracted, lemmatized, and categorized by AI for your review before import.
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder={`Paste ${language ? language.charAt(0).toUpperCase() + language.slice(1) : ''} text here…`}
                  placeholderTextColor="#999"
                  multiline
                  value={text}
                  onChangeText={setText}
                  editable={!effectiveProcessing}
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity style={styles.fileBtn} onPress={handleFilePick} disabled={effectiveProcessing}>
                <Ionicons name="document-attach-outline" size={20} color="#4A90E2" />
                <Text style={styles.fileBtnText}>Upload a Text File</Text>
              </TouchableOpacity>

              {/* Deck Name */}
              <View style={styles.deckNameSection}>
                <Text style={styles.deckNameLabel}>{targetDeckId ? 'Adding to deck' : 'Deck Name'}</Text>
                {targetDeckId ? (
                  <View style={[styles.deckNameInput, { backgroundColor: '#F3F4F6' }]}>
                    <Text style={styles.deckNameHint}>{deckName || initialDeckName || 'This deck'}</Text>
                  </View>
                ) : (
                  <TextInput
                    style={styles.deckNameInput}
                    placeholder={`Deck ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`}
                    placeholderTextColor="#999"
                    value={deckName}
                    onChangeText={setDeckName}
                    editable={!effectiveProcessing}
                    maxLength={60}
                  />
                )}
                <Text style={styles.deckNameHint}>{targetDeckId ? 'Imported words will be added to this deck.' : 'Name this import set. Shown as a chip on each word.'}</Text>
              </View>

              {/* Also Translate To Other Languages */}
              {otherLanguages.length > 0 && (
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
                          else { setSelectedTargetLangs(otherLanguages.map(l => l.code)); setCrossTranslateExpanded(true); }
                        }}
                      >
                        {selectedTargetLangs.length > 0 && <Ionicons name="checkmark" size={14} color="#FFF" />}
                      </TouchableOpacity>
                      <Text style={styles.crossTranslateTitle}>Also Translate To Other Languages</Text>
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
                      {otherLanguages.map((lang) => {
                        const isSel = selectedTargetLangs.includes(lang.code);
                        return (
                          <TouchableOpacity
                            key={lang.code}
                            style={[
                              styles.crossTranslateLangRow,
                              isSel && styles.crossTranslateLangRowSelected,
                            ]}
                            onPress={() => toggleTargetLang(lang.code)}
                            activeOpacity={0.7}
                          >
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

              {/* Save this combination as default for this language */}
              {language && (
                <TouchableOpacity
                  style={styles.saveDefaultRow}
                  onPress={async () => {
                    try {
                      const current = personalization || {};
                      const body = {
                        default_transliterate:
                          typeof current.default_transliterate === 'boolean'
                            ? current.default_transliterate
                            : true,
                        default_import_translate: selectedTargetLangs.length > 0,
                        default_import_target_langs: selectedTargetLangs,
                      };
                      const res = await fetch(`${API_BASE_URL}/api/language-personalization/${language}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                      });
                      if (res.ok) {
                        Alert.alert('Saved', 'Default import languages updated for this language.');
                        try {
                          const updated = await res.json();
                          setPersonalization(updated);
                        } catch {
                          // ignore parse errors; not all endpoints echo body
                        }
                      } else {
                        Alert.alert('Error', 'Could not save default import languages.');
                      }
                    } catch {
                      Alert.alert('Error', 'Could not save default import languages.');
                    }
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#4A90E2" />
                  <Text style={styles.saveDefaultText}>
                    Use this combination as default for {language.charAt(0).toUpperCase() + language.slice(1)}
                  </Text>
                </TouchableOpacity>
              )}

              {text.trim().length > 0 && (
                <Text style={styles.wordCount}>~{text.trim().split(/\s+/).length} words in text</Text>
              )}
              {effectiveProcessing && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color="#4A90E2" />
                  <Text style={styles.processingText}>{effectiveStatus || 'Extracting words…'}</Text>
                  {effectiveProgress && effectiveProgress.total_batches > 1 && (
                    <View style={styles.progressBarOuter}>
                      <View style={[
                        styles.progressBarInner,
                        {
                          width: `${Math.round(
                            (effectiveProgress.batch / effectiveProgress.total_batches) * 100
                          )}%`,
                          backgroundColor: effectiveProgress.phase === 'translate' ? '#8B5CF6' : '#4A90E2',
                        },
                      ]} />
                    </View>
                  )}
                  {effectiveProgress && (
                    <Text style={styles.progressDetail}>
                      {effectiveProgress.phase === 'lemmatize'
                        ? `Batch ${effectiveProgress.batch} / ${effectiveProgress.total_batches}  •  ~${Math.min(effectiveProgress.words_done || 0, effectiveProgress.total_words || 0)} words done`
                        : effectiveProgress.phase === 'translate'
                        ? `Translating batch ${effectiveProgress.batch} / ${effectiveProgress.total_batches}`
                        : effectiveStatus}
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.extractBtn, (!text.trim() || effectiveProcessing) && styles.btnDisabled]}
                onPress={handleExtract}
                disabled={!text.trim() || effectiveProcessing}
              >
                {effectiveProcessing
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : (<>
                      <Ionicons name="sparkles" size={20} color="#FFF" />
                      <Text style={styles.btnText}>
                        {selectedTargetLangs.length > 0 ? `Extract & Translate (${selectedTargetLangs.length + 1} languages)` : 'Extract Words'}
                      </Text>
                    </>)}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 2: REVIEW ── */}
        {step === 'review' && (
          <>
            {/* Summary bar */}
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
              {job?.extractDurationSeconds != null && (
                <View style={styles.reviewStat}>
                  <Text style={styles.reviewStatNum}>
                    {job.extractDurationSeconds >= 60
                      ? `${Math.floor(job.extractDurationSeconds / 60)} m ${Math.round(job.extractDurationSeconds % 60)} s`
                      : `${Math.round(job.extractDurationSeconds)} s`}
                  </Text>
                  <Text style={styles.reviewStatLabel}>Elapsed</Text>
                </View>
              )}
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

            {/* Input sentence + lemma explorer */}
            {debugData && (debugData.input_text || (debugData.raw_tokens || []).length > 0) && (
              <View style={styles.lemmaPanel}>
                <TouchableOpacity
                  style={styles.lemmaPanelHeader}
                  onPress={() => setLemmaPanelExpanded(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons name="document-text-outline" size={16} color="#4B5563" style={{ marginRight: 6 }} />
                    <Text style={styles.lemmaPanelTitle}>Sentence & lemmas</Text>
                  </View>
                  <Text style={styles.lemmaPanelHint}>Tap a word to see lemmas</Text>
                  <Ionicons
                    name={lemmaPanelExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#4B5563"
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
                {lemmaPanelExpanded && (
                  <View style={styles.lemmaSentence}>
                    <Text style={styles.lemmaSentenceText}>
                      {(() => {
                        const lemmaTokens = (debugData.lemma_tokens || debugData.lemmatized_tokens || []);
                        const allLemmaForms = new Set(
                          lemmaTokens.map(lem => (lem.word || '').trim().toLowerCase()).filter(Boolean)
                        );
                        const tokens = debugData.raw_tokens && debugData.raw_tokens.length > 0
                          ? debugData.raw_tokens
                          : (debugData.input_text || '').split(/\s+/);
                        return tokens.map((tok, idx) => {
                          const t = String(tok || '').trim();
                          if (!t) return null;
                          const tLower = t.toLowerCase();
                          const hasLemma = allLemmaForms.has(tLower)
                            || [...allLemmaForms].some(lem => tLower.includes(lem) || lem.includes(tLower));
                          return (
                            <Text
                              key={`${t}-${idx}`}
                              style={hasLemma ? styles.lemmaWordHighlighted : styles.lemmaWordPlain}
                              onPress={() => openLemmaModal(t)}
                            >
                              {t}
                              {idx < tokens.length - 1 ? ' ' : ''}
                            </Text>
                          );
                        });
                      })()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Language Tabs — all visible (flex-wrap), no horizontal scroll */}
            {reviewTabs.length > 1 && (
              <View style={styles.tabBar}>
                {reviewTabs.map((tabLang) => {
                  const langMeta = LANGUAGES.find(l => l.code === tabLang);
                  const isSource = tabLang === language;
                  const tabSel = isSource ? selectedWords.size : (langData[tabLang]?.selected?.size || 0);
                  const tabNew = isSource ? extractedWords.length : (langData[tabLang]?.new_words?.length || 0);
                  const isActive = activeTab === tabLang;
                  return (
                    <TouchableOpacity
                      key={tabLang}
                      style={[styles.tab, isActive && styles.tabActive]}
                      onPress={() => setActiveTab(tabLang)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.tabLangDot, { backgroundColor: langMeta?.color || '#4A90E2' }]} />
                      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                        {langMeta?.name || tabLang}
                      </Text>
                      <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                          {tabSel}/{tabNew}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Tab content */}
            <View style={{ flex: 1 }}>
              {renderTabContent(activeTab)}
            </View>

            <View style={styles.footer}>
              {importing && <Text style={styles.importingText}>{status}</Text>}
              <TouchableOpacity
                style={[styles.importBtn, (totalSelectedCount === 0 || importing) && styles.btnDisabled]}
                onPress={handleImport}
                disabled={totalSelectedCount === 0 || importing}
              >
                {importing
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : (<>
                      <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                      <Text style={styles.btnText}>Import Words ({totalSelectedCount})</Text>
                    </>)}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── STEP 3: DONE ── */}
        {step === 'done' && importResult && (
          <>
            <View style={styles.doneContainer}>
              <Ionicons name="checkmark-circle" size={72} color="#4CAF50" />
              <Text style={styles.doneTitle}>Import Complete!</Text>
              <Text style={styles.doneSubtitle}>
                {importResult.deck_name ? `Deck "${importResult.deck_name}"` : 'Your library'}
              </Text>
              <View style={styles.doneStats}>
                {(importResult.new_words || 0) > 0 && (
                  <View style={[styles.doneStat, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={[styles.doneStatNum, { color: '#16A34A' }]}>{importResult.new_words}</Text>
                    <Text style={styles.doneStatLabel}>New Words</Text>
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
                  const langMeta = LANGUAGES.find(l => l.code === lang);
                  return (
                    <View key={lang} style={[styles.doneStat, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.doneStatNum, { color: '#2E7D32' }]}>{words.length}</Text>
                      <Text style={styles.doneStatLabel}>{langMeta?.name || lang}</Text>
                    </View>
                  );
                })}
              </View>
              {importResult.import_duration_seconds != null && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 }}>
                  <Ionicons name="timer-outline" size={14} color="#9CA3AF" />
                  <Text style={{ fontSize: 13, color: '#9CA3AF' }}>
                    {importResult.import_duration_seconds >= 60
                      ? `${Math.floor(importResult.import_duration_seconds / 60)}m ${Math.round(importResult.import_duration_seconds % 60)}s`
                      : `${importResult.import_duration_seconds.toFixed(1)}s`}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.footer}>
              <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
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
      {/* Lemma detail modal */}
      <Modal
        visible={lemmaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLemmaModalVisible(false)}
      >
        <View style={styles.lemmaModalOverlay}>
          <View style={styles.lemmaModalCard}>
            <View style={styles.lemmaModalHeader}>
              <Text style={styles.lemmaModalTitle}>{lemmaModalWord || 'Word details'}</Text>
              <TouchableOpacity onPress={() => setLemmaModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.lemmaModalBody}>
              {lemmaModalLemmas && lemmaModalLemmas.length > 0 ? (() => {
                const srcMeta = LANGUAGES.find(l => l.code === language);
                const isSrcUrdu = language === 'urdu';
                return (
                  <>
                    <Text style={styles.lemmaModalSectionTitle}>Source lemmas</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <View style={[styles.lemmaLangIcon, { backgroundColor: srcMeta?.color || '#4B5563', marginRight: 6 }]}>
                        <Text style={[styles.lemmaLangIconText, isSrcUrdu && { fontFamily: 'Noto Nastaliq Urdu' }]}>
                          {srcMeta?.nativeChar || srcMeta?.langCode?.toUpperCase() || (language[0] || '').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.lemmaLangLabel}>{srcMeta?.name || language}</Text>
                      <Text style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
                        {lemmaModalLemmas.length} word{lemmaModalLemmas.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.translatedLemmaGrid}>
                      {lemmaModalLemmas.map((lem, idx) => {
                        const lvlKey = (lem.level || '').toUpperCase();
                        const lvlColor = LEVEL_COLORS[lvlKey] || { bg: '#E5E7EB', text: '#374151' };
                        const wcc = getWordClassColor(lem.word_class);
                        return (
                          <View key={`lem-${idx}`} style={styles.translatedLemmaCard}>
                            <Text style={[
                              styles.lemmaEntryNative,
                              isSrcUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' },
                            ]}>
                              {isSrcUrdu ? (lem.nastaliq || lem.word || '(no word)') : (lem.word || '(no word)')}
                            </Text>
                            {lem.transliteration ? (
                              <Text style={styles.lemmaEntryTranslit}>{lem.transliteration}</Text>
                            ) : null}
                            {lem.english ? (
                              <Text style={styles.lemmaEntryEnglish}>{lem.english}</Text>
                            ) : null}
                            {(lem.word_class || lem.level) && (
                              <View style={styles.lemmaChipRow}>
                                {lem.word_class ? (
                                  <View style={[styles.lemmaChip, { backgroundColor: wcc.bg }]}>
                                    <Text style={[styles.lemmaChipText, { color: wcc.text }]}>
                                      {lem.word_class}
                                    </Text>
                                  </View>
                                ) : null}
                                {lem.level ? (
                                  <View style={[styles.lemmaChip, { backgroundColor: lvlColor.bg }]}>
                                    <Text style={[styles.lemmaChipText, { color: lvlColor.text }]}>
                                      {lvlKey}
                                    </Text>
                                  </View>
                                ) : null}
                                {lem.verb_transitivity && lem.verb_transitivity !== 'N/A' ? (
                                  (() => {
                                    const vtF = VERB_TRANSITIVITY_FILTERS.find(f => (f.value || '').toLowerCase() === (lem.verb_transitivity || '').toLowerCase());
                                    const vtC = vtF ? vtF.color : { bg: '#6B7280', text: '#FFF' };
                                    return (
                                      <View style={[styles.lemmaChip, { backgroundColor: vtC.bg }]}>
                                        <Text style={[styles.lemmaChipText, { color: vtC.text }]}>
                                          {lem.verb_transitivity.toLowerCase()}
                                        </Text>
                                      </View>
                                    );
                                  })()
                                ) : null}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </>
                );
              })() : (
                <Text style={styles.lemmaEntryEnglish}>No lemmas found for this word.</Text>
              )}

              {lemmaModalTranslations && Object.keys(lemmaModalTranslations).length > 0 && (
                <>
                  <Text style={[styles.lemmaModalSectionTitle, { marginTop: 16 }]}>Translated lemmas</Text>
                  {Object.entries(lemmaModalTranslations).map(([langCode, items]) => {
                    const meta = LANGUAGES.find(l => l.code === langCode);
                    const badgeChar = meta?.nativeChar || (langCode[0] || '').toUpperCase();
                    const isLangUrdu = langCode === 'urdu';
                    return (
                      <View key={langCode} style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <View style={[styles.lemmaLangIcon, { backgroundColor: meta?.color || '#4B5563', marginRight: 6 }]}>
                            <Text style={[styles.lemmaLangIconText, isLangUrdu && { fontFamily: 'Noto Nastaliq Urdu' }]}>{badgeChar}</Text>
                          </View>
                          <Text style={styles.lemmaLangLabel}>{meta?.name || langCode}</Text>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
                            {items.length} word{items.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={styles.translatedLemmaGrid}>
                          {items.map((w, idx) => {
                            const wcc = getWordClassColor(w.word_class);
                            const lvlKey = String(w.level || '').toUpperCase();
                            const lvlColor = LEVEL_COLORS[lvlKey] || { bg: '#E5E7EB', text: '#374151' };
                            return (
                              <View key={`${langCode}-${idx}`} style={styles.translatedLemmaCard}>
                                <Text style={[
                                  styles.lemmaEntryNative,
                                  isLangUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'ltr' },
                                ]}>
                                  {isLangUrdu ? (w.nastaliq || w.word) : w.word}
                                </Text>
                                {w.transliteration ? (
                                  <Text style={styles.lemmaEntryTranslit}>{w.transliteration}</Text>
                                ) : null}
                                <Text style={styles.lemmaEntryEnglish} numberOfLines={2}>
                                  {w.english || w.english_word || ''}
                                </Text>
                                {(w.word_class || w.level) && (
                                  <View style={styles.lemmaChipRow}>
                                    {w.word_class ? (
                                      <View style={[styles.lemmaChip, { backgroundColor: wcc.bg }]}>
                                        <Text style={[styles.lemmaChipText, { color: wcc.text }]}>
                                          {w.word_class}
                                        </Text>
                                      </View>
                                    ) : null}
                                    {w.level ? (
                                      <View style={[styles.lemmaChip, { backgroundColor: lvlColor.bg }]}>
                                        <Text style={[styles.lemmaChipText, { color: lvlColor.text }]}>
                                          {lvlKey}
                                        </Text>
                                      </View>
                                    ) : null}
                                    {w.verb_transitivity && w.verb_transitivity !== 'N/A' ? (
                                      (() => {
                                        const vtF = VERB_TRANSITIVITY_FILTERS.find(f => (f.value || '').toLowerCase() === (w.verb_transitivity || '').toLowerCase());
                                        const vtC = vtF ? vtF.color : { bg: '#6B7280', text: '#FFF' };
                                        return (
                                          <View style={[styles.lemmaChip, { backgroundColor: vtC.bg }]}>
                                            <Text style={[styles.lemmaChipText, { color: vtC.text }]}>
                                              {w.verb_transitivity.toLowerCase()}
                                            </Text>
                                          </View>
                                        );
                                      })()
                                    ) : null}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E5', backgroundColor: '#FFF' },
  closeBtn: { padding: 8 },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  headerLangIcon: {
    width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
  },
  headerLangIconText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  headerImportIconWrap: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  resultDuration: { fontSize: 14, fontWeight: '500', color: '#888' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 100 },
  reviewListContent: { padding: 16, paddingBottom: 120 },
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  inputContainer: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 12 },
  textInput: { height: 180, padding: 14, fontSize: 15, lineHeight: 22, color: '#333' },
  fileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#4A90E2', borderStyle: 'dashed', marginBottom: 12, gap: 8 },
  fileBtnText: { fontSize: 14, fontWeight: '600', color: '#4A90E2' },
  deckNameSection: { marginBottom: 12 },
  deckNameLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  deckNameInput: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#333' },
  deckNameHint: { fontSize: 11, color: '#999', marginTop: 4 },
  wordCount: { fontSize: 12, color: '#999', textAlign: 'right', marginBottom: 8 },
  processingContainer: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  processingText: { fontSize: 14, color: '#666', fontWeight: '500' },
  progressBarOuter: { width: '90%', height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' },
  progressBarInner: { height: 8, borderRadius: 4, minWidth: 8 },
  progressDetail: { fontSize: 12, color: '#999', textAlign: 'center' },

  // Review summary
  reviewSummaryBar: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5E5', paddingVertical: 10, paddingHorizontal: 20 },
  reviewStat: { flex: 1, alignItems: 'center' },
  reviewStatNum: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  reviewStatLabel: { fontSize: 11, color: '#888', marginTop: 2 },

  // Lemma explorer
  lemmaPanel: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  lemmaPanelHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  lemmaPanelTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  lemmaPanelHint: { fontSize: 11, color: '#9CA3AF' },
  lemmaSentence: { paddingHorizontal: 16, paddingBottom: 10 },
  lemmaSentenceText: { fontSize: 14, lineHeight: 22, color: '#111827', flexWrap: 'wrap' },
  lemmaWordPlain: { fontSize: 14, color: '#111827' },
  lemmaWordHighlighted: { fontSize: 14, color: '#1D4ED8', fontWeight: '600' },

  // Lemma detail modal
  lemmaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  lemmaModalCard: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  lemmaModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lemmaModalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  lemmaModalBody: { paddingBottom: 8 },
  lemmaModalSectionTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  lemmaEntryRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  lemmaLangIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#4B5563',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lemmaLangIconText: { fontSize: 13, color: '#FFF', fontWeight: '700' },
  lemmaLangLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  lemmaEntryNative: { fontSize: 15, fontWeight: '600', color: '#111827' },
  lemmaEntryTranslit: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  lemmaEntryEnglish: { fontSize: 13, color: '#2563EB', marginTop: 1 },
  lemmaEntryMeta: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  lemmaChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  lemmaChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  lemmaChipText: { fontSize: 11, fontWeight: '600' },
  translatedLemmaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  translatedLemmaCard: {
    width: '31%', // roughly 3 per row minus gap
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
  },

  // Language tabs — flex-wrap so all are visible
  tabBar: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5E5', flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 0 },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: 'center' },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: 4, borderRadius: 6 },
  tabActive: { borderBottomColor: '#4A90E2', backgroundColor: '#F0F7FF' },
  tabLangDot: { width: 8, height: 8, borderRadius: 4 },
  tabText: { fontSize: 13, fontWeight: '500', color: '#888' },
  tabTextActive: { color: '#4A90E2', fontWeight: '700' },
  tabBadge: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: '#DBEAFE' },
  tabBadgeText: { fontSize: 10, fontWeight: '600', color: '#888' },
  tabBadgeTextActive: { color: '#1D4ED8' },

  // Filters
  reviewFiltersContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  reviewFiltersCountRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  reviewFiltersCountText: {
    fontSize: 13,
    color: '#6B7280',
  },
  reviewFilterGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  filterBar: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5E5', paddingVertical: 8, paddingHorizontal: 16 },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  filterScroll: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1.5 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  filterDivider: { width: 1, height: 20, backgroundColor: '#E0E0E0', marginHorizontal: 4 },

  // Select all row
  selectAllRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F8F9FA', borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  selectAllBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  selectAllText: { fontSize: 13, color: '#4A90E2', fontWeight: '600' },

  // Word cards
  wordCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: '#E0E0E0' },
  wordCardSelected: { borderColor: '#4A90E2', backgroundColor: '#F0F7FF' },
  wordCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  wordCardMain: { flex: 1 },
  wordCardNative: { fontSize: 18, fontWeight: '600', color: '#1A1A1A', marginBottom: 3 },
  wordCardTranslit: { fontSize: 13, color: '#888', fontStyle: 'italic', marginBottom: 3 },
  wordCardEnglish: { fontSize: 14, color: '#4A90E2', fontWeight: '500' },
  wordCardCheckbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#CCC', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  wordCardCheckboxActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  wordCardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  // Tags — shared style for POS, level, AND origin chips
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontWeight: '600' },

  // Existing words section
  existingSection: { marginTop: 16, marginBottom: 8 },
  existingSectionTitle: { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 10, paddingHorizontal: 4 },
  existingCard: { backgroundColor: '#F5F5F5', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E0E0E0', opacity: 0.8 },
  existingNative: { fontSize: 17, fontWeight: '600', color: '#444', marginBottom: 3 },

  // Category sections (new / synonym / existing)
  categorySection: { marginBottom: 12 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categorySectionTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  categoryHint: { fontSize: 12, color: '#999', marginLeft: 2 },

  // Synonym cards
  synonymCard: { borderColor: '#FDE68A', borderWidth: 1.5, backgroundColor: '#FFFDF5' },
  synonymCardSelected: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  synonymCheckboxActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  synonymOfSection: { marginTop: 10, paddingTop: 8, paddingBottom: 6, paddingHorizontal: 10, backgroundColor: '#FEF3C7', borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A', alignSelf: 'stretch' },
  synonymOfBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  synonymOfLabel: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  synonymOfText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  synonymOfNative: { fontSize: 15, fontWeight: '600', color: '#78350F', marginBottom: 2 },
  synonymOfTranslit: { fontSize: 12, color: '#B45309', fontStyle: 'italic' },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#AAA' },

  // Done screen
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  doneTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
  doneSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  doneStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, justifyContent: 'center' },
  doneStat: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' },
  doneStatNum: { fontSize: 32, fontWeight: '700' },
  doneStatLabel: { fontSize: 12, color: '#666', marginTop: 4 },

  // Footer & buttons
  footer: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  importingText: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 8 },
  extractBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A90E2', paddingVertical: 14, borderRadius: 12, gap: 8 },
  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#50C878', paddingVertical: 14, borderRadius: 12, gap: 8 },
  doneBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', paddingVertical: 14, borderRadius: 12 },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Cross-translate section (use the older simple row style here;
  // the new chip-style design is only used on the Profile screen)
  crossTranslateSection: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 12, overflow: 'hidden' },
  crossTranslateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  crossTranslateHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  crossTranslateCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CCC', alignItems: 'center', justifyContent: 'center' },
  crossTranslateCheckboxActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  crossTranslateTitle: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1 },
  crossTranslateBadge: { backgroundColor: '#4A90E2', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  crossTranslateBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  crossTranslateList: { borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingVertical: 4 },
  crossTranslateLangRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  crossTranslateLangRowSelected: { backgroundColor: '#F0F7FF' },
  crossTranslateLangIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  crossTranslateLangIconText: { fontSize: 15, color: '#FFF', fontWeight: '500' },
  crossTranslateLangIconCode: { fontSize: 10, fontWeight: 'bold', color: '#FFF', letterSpacing: 0.5 },
  crossTranslateLangName: { fontSize: 14, fontWeight: '500', color: '#333', flex: 1 },
  crossTranslateLangCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CCC', alignItems: 'center', justifyContent: 'center' },
  crossTranslateLangCheckboxActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  saveDefaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  saveDefaultText: { fontSize: 13, color: '#4A90E2', fontWeight: '600', flex: 1 },
});
