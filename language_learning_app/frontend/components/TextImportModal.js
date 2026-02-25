import React, { useState, useContext, useMemo, useRef } from 'react';
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
import { WORD_CLASSES, LEVELS, LEVEL_COLORS } from '../constants/filters';
import VocabImportDebugModal from './VocabImportDebugModal';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

// step: 'input' | 'review' | 'done'

export default function TextImportModal({ visible, onClose, language, onImportComplete, prefillText = '' }) {
  const { userSelectedLanguages } = useContext(LanguageContext);

  // ── Step 1: Input state ──
  const [text, setText] = useState('');
  const [deckName, setDeckName] = useState('');
  const [crossTranslateExpanded, setCrossTranslateExpanded] = useState(false);
  const [selectedTargetLangs, setSelectedTargetLangs] = useState([]);

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

  // ── Processing + real-time progress ──
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null); // { phase, batch, total_batches, words_done }
  const abortRef = useRef(null); // AbortController ref for SSE

  // ── Done state & debug ──
  const [importResult, setImportResult] = useState(null);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugData, setDebugData] = useState(null);

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

  // When a prefillText is provided (e.g., from Reading/Translation activity), populate the text field
  React.useEffect(() => {
    if (visible && prefillText && !text) {
      setText(prefillText);
    }
  }, [visible, prefillText]);

  // Load default import-translation preferences when modal opens
  React.useEffect(() => {
    if (!visible || !language) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/language-personalization/${language}`);
        if (res.ok) {
          const data = await res.json();
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
      setDebugData(finalData);
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
    setImporting(true);
    setStatus('Importing words…');
    try {
      // Build words_by_lang for target languages
      const wordsByLang = {};
      for (const [lang, ld] of Object.entries(langData)) {
        const selected = ld.new_words.filter(w => ld.selected.has(w.word));
        if (selected.length > 0) wordsByLang[lang] = selected;
      }

      const res = await fetch(`${API_BASE_URL}/api/vocab/commit-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          words: sourceToImport,
          synonyms: synonymsToMerge,
          words_by_lang: wordsByLang,
          deck_name: deckName.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${res.status}`);
      }
      const data = await res.json();
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
    if (abortRef.current) abortRef.current.abort();
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
    setProcessing(false);
    setImporting(false);
    setStatus('');
    setProgress(null);
    setImportResult(null);
    setCrossTranslateExpanded(false);
    setSelectedTargetLangs([]);
    setDebugData(null);
    setDebugVisible(false);
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

  const getTabSynonyms = (tabLang) => {
    if (tabLang === language) return synonymWords;
    return [];
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

  const setTabWcFilter = (tabLang, val) => setWordClassFilter(prev => ({ ...prev, [tabLang]: val }));
  const setTabLvFilter = (tabLang, val) => setLevelFilter(prev => ({ ...prev, [tabLang]: val }));

  const getFilteredWords = (tabLang) => {
    const words = getTabWords(tabLang);
    const wc = getTabWcFilter(tabLang);
    const lv = getTabLvFilter(tabLang);
    return words.filter(w => {
      if (wc && w.word_class !== wc) return false;
      if (lv && (w.level || '').toLowerCase() !== lv.toLowerCase()) return false;
      return true;
    });
  };

  const selectAllTab = (tabLang) => {
    const filtered = getFilteredWords(tabLang);
    if (tabLang === language) {
      setSelectedWords(new Set(filtered.map(w => w.word)));
    } else {
      setLangData(prev => {
        const ld = prev[tabLang];
        if (!ld) return prev;
        return { ...prev, [tabLang]: { ...ld, selected: new Set(filtered.map(w => w.word)) } };
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
            ]}>{item.nastaliq || item.word}</Text>
            {item.transliteration ? <Text style={styles.wordCardTranslit}>{item.transliteration}</Text> : null}
            <Text style={styles.wordCardEnglish}>{item.english}</Text>
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
          {item.level ? (
            <View style={[styles.tag, { backgroundColor: levelColor.bg }]}>
              <Text style={[styles.tagText, { color: levelColor.text }]}>{item.level.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render tab content ──
  const renderTabContent = (tabLang) => {
    const filtered = getFilteredWords(tabLang);
    const existing = getTabExisting(tabLang);
    const synonyms = getTabSynonyms(tabLang);
    const allWords = getTabWords(tabLang);
    const wc = getTabWcFilter(tabLang);
    const lv = getTabLvFilter(tabLang);

    // Present filter options from this tab's words
    const presentWcSet = new Set(allWords.map(w => w.word_class).filter(Boolean));
    const presentWc = WORD_CLASSES.filter(c => c.value !== 'All' && presentWcSet.has(c.value));
    const presentLvSet = new Set(allWords.map(w => (w.level || '').toLowerCase()).filter(Boolean));
    const presentLv = LEVELS.filter(l => l !== 'All' && presentLvSet.has(l.toLowerCase()));

    return (
      <View style={{ flex: 1 }}>
        {/* Filters */}
        {(presentWc.length > 0 || presentLv.length > 0) && (
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
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
              {presentWc.length > 0 && presentLv.length > 0 && <View style={styles.filterDivider} />}
              {presentLv.map(l => {
                const lc = LEVEL_COLORS[l.toUpperCase()] || { bg: '#999', text: '#FFF' };
                const active = lv.toUpperCase() === l.toUpperCase();
                return (
                  <TouchableOpacity
                    key={l}
                    style={[styles.filterChip, { backgroundColor: active ? lc.bg : lc.bg + '22', borderColor: lc.bg }]}
                    onPress={() => setTabLvFilter(tabLang, active ? '' : l)}
                  >
                    <Text style={[styles.filterChipText, { color: active ? lc.text : lc.bg }]}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Select All / None */}
        <View style={styles.selectAllRow}>
          <TouchableOpacity onPress={() => selectAllTab(tabLang)} style={styles.selectAllBtn}>
            <Text style={styles.selectAllText}>Select All ({filtered.length})</Text>
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
          {synonyms.length > 0 && (
            <View style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.categorySectionTitle}>🔗 Synonyms ({synonyms.length})</Text>
                <Text style={styles.categoryHint}>Will be merged into existing card</Text>
              </View>
              {synonyms.map((w, idx) => {
                const isSel = selectedSynonyms.has(w.word);
                const wcc = getWordClassColor(w.word_class);
                const levelColor = LEVEL_COLORS[(w.level || '').toUpperCase()] || { bg: '#E8F4FD', text: '#4A90E2' };
                const isUrdu = tabLang === 'urdu';
                return (
                  <TouchableOpacity
                    key={`syn_${w.word}_${idx}`}
                    style={[styles.wordCard, styles.synonymCard, isSel && styles.synonymCardSelected]}
                    onPress={() => toggleSynonym(w.word)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.wordCardHeader}>
                      <View style={[styles.wordCardMain, isUrdu && { alignItems: 'flex-start' }]}>
                        <Text style={[
                          styles.wordCardNative,
                          isUrdu && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left', writingDirection: 'rtl' },
                        ]}>{w.nastaliq || w.word}</Text>
                        {w.transliteration ? <Text style={styles.wordCardTranslit}>{w.transliteration}</Text> : null}
                        <Text style={styles.wordCardEnglish}>{w.english}</Text>
                        {/* Synonym-of label */}
                        <View style={styles.synonymOfBadge}>
                          <Ionicons name="git-merge-outline" size={12} color="#92400E" />
                          <Text style={styles.synonymOfText}>
                            Synonym of "{w.synonym_of_word}"
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.wordCardCheckbox, isSel && styles.synonymCheckboxActive]}>
                        {isSel && <Ionicons name="checkmark" size={14} color="#FFF" />}
                      </View>
                    </View>
                    <View style={styles.wordCardTags}>
                      {w.word_class ? <View style={[styles.tag, { backgroundColor: wcc.bg }]}><Text style={[styles.tagText, { color: wcc.text }]}>{w.word_class}</Text></View> : null}
                      {w.level ? <View style={[styles.tag, { backgroundColor: levelColor.bg }]}><Text style={[styles.tagText, { color: levelColor.text }]}>{w.level.toUpperCase()}</Text></View> : null}
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
                return (
                  <View key={`ex_${i}`} style={styles.existingCard}>
                    <Text style={styles.existingNative}>{w.word}</Text>
                    {w.transliteration ? <Text style={styles.wordCardTranslit}>{w.transliteration}</Text> : null}
                    <Text style={styles.wordCardEnglish}>{w.english_word}</Text>
                    <View style={[styles.wordCardTags, { marginTop: 8 }]}>
                      {w.word_class ? <View style={[styles.tag, { backgroundColor: wcc.bg }]}><Text style={[styles.tagText, { color: wcc.text }]}>{w.word_class}</Text></View> : null}
                      {w.level ? <View style={[styles.tag, { backgroundColor: levelColor.bg }]}><Text style={[styles.tagText, { color: levelColor.text }]}>{w.level.toUpperCase()}</Text></View> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {filtered.length === 0 && synonyms.length === 0 && existing.length === 0 && (
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
          <TouchableOpacity onPress={step === 'review' ? () => setStep('input') : handleClose} style={styles.closeBtn}>
            <Ionicons name={step === 'review' ? 'arrow-back' : 'close'} size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {step === 'input' ? 'Import Text' : step === 'review' ? 'Review Words' : 'Import Complete'}
          </Text>
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
                  editable={!processing}
                  textAlignVertical="top"
                />
              </View>
              <TouchableOpacity style={styles.fileBtn} onPress={handleFilePick} disabled={processing}>
                <Ionicons name="document-attach-outline" size={20} color="#4A90E2" />
                <Text style={styles.fileBtnText}>Upload a Text File</Text>
              </TouchableOpacity>

              {/* Deck Name */}
              <View style={styles.deckNameSection}>
                <Text style={styles.deckNameLabel}>Deck Name</Text>
                <TextInput
                  style={styles.deckNameInput}
                  placeholder={`Deck ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`}
                  placeholderTextColor="#999"
                  value={deckName}
                  onChangeText={setDeckName}
                  editable={!processing}
                  maxLength={60}
                />
                <Text style={styles.deckNameHint}>Name this import set. Shown as a chip on each word.</Text>
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
                            style={[styles.crossTranslateLangRow, isSel && styles.crossTranslateLangRowSelected]}
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

              {text.trim().length > 0 && (
                <Text style={styles.wordCount}>~{text.trim().split(/\s+/).length} words in text</Text>
              )}
              {processing && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color="#4A90E2" />
                  <Text style={styles.processingText}>{status || 'Extracting words…'}</Text>
                  {progress && progress.total_batches > 1 && (
                    <View style={styles.progressBarOuter}>
                      <View style={[
                        styles.progressBarInner,
                        {
                          width: `${Math.round(
                            (progress.batch / progress.total_batches) * 100
                          )}%`,
                          backgroundColor: progress.phase === 'translate' ? '#8B5CF6' : '#4A90E2',
                        },
                      ]} />
                    </View>
                  )}
                  {progress && (
                    <Text style={styles.progressDetail}>
                      {progress.phase === 'lemmatize'
                        ? `Batch ${progress.batch} / ${progress.total_batches}  •  ~${Math.min(progress.words_done || 0, progress.total_words || 0)} words done`
                        : progress.phase === 'translate'
                        ? `Translating batch ${progress.batch} / ${progress.total_batches}`
                        : status}
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.extractBtn, (!text.trim() || processing) && styles.btnDisabled]}
                onPress={handleExtract}
                disabled={!text.trim() || processing}
              >
                {processing
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5E5', backgroundColor: '#FFF' },
  closeBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
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
  filterBar: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E5E5', paddingVertical: 8 },
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
  synonymOfBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#FEF3C7', borderRadius: 6, alignSelf: 'flex-start' },
  synonymOfText: { fontSize: 11, fontWeight: '600', color: '#92400E' },

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

  // Cross-translate section
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
});
