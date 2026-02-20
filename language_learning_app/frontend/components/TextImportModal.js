import React, { useState, useContext } from 'react';
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

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

export default function TextImportModal({ visible, onClose, language, onImportComplete }) {
  const { userSelectedLanguages } = useContext(LanguageContext);
  const [text, setText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState(null);
  const [crossTranslateExpanded, setCrossTranslateExpanded] = useState(false);
  const [selectedTargetLangs, setSelectedTargetLangs] = useState([]);

  // Languages available for cross-translation: user's languages minus the import language
  const otherLanguages = LANGUAGES.filter(
    l => userSelectedLanguages.includes(l.code) && l.code !== language
  );

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
          reader.onload = (event) => {
            setText(event.target.result);
          };
          reader.readAsText(file);
        }
      };
      input.click();
    } else {
      try {
        const DocumentPicker = require('expo-document-picker');
        const FileSystem = require('expo-file-system');
        const result = await DocumentPicker.getDocumentAsync({
          type: ['text/plain', 'text/csv'],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const content = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          setText(content);
        }
      } catch (err) {
        console.error('File pick error:', err);
        Alert.alert('Error', 'Could not read the file. Please paste text instead.');
      }
    }
  };

  const handleImport = async () => {
    if (!text.trim()) {
      Alert.alert('No Text', 'Please paste some text or upload a file first.');
      return;
    }
    setProcessing(true);
    setResults(null);
    setStatus('Extracting and lemmatizing words...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/vocab/import-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          language: language,
          target_languages: selectedTargetLangs.length > 0 ? selectedTargetLangs : null,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${response.status}`);
      }
      const data = await response.json();
      setResults(data);
      setStatus('');
      if (data.new_words > 0 && onImportComplete) {
        onImportComplete(data);
      }
    } catch (err) {
      console.error('Import error:', err);
      setStatus('');
      Alert.alert('Import Error', err.message || 'Failed to import text. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setText('');
    setResults(null);
    setStatus('');
    setProcessing(false);
    setCrossTranslateExpanded(false);
    setSelectedTargetLangs([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Import Text</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={styles.description}>
            Paste text or upload a file in {language ? language.charAt(0).toUpperCase() + language.slice(1) : 'your language'}. New words will be extracted, lemmatized, and added to your vocabulary.
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={`Paste ${language ? language.charAt(0).toUpperCase() + language.slice(1) : ''} text here...`}
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

          {/* Cross-language translation section */}
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
                      if (selectedTargetLangs.length > 0) {
                        setSelectedTargetLangs([]);
                      } else {
                        setSelectedTargetLangs(otherLanguages.map(l => l.code));
                        setCrossTranslateExpanded(true);
                      }
                    }}
                  >
                    {selectedTargetLangs.length > 0 && (
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.crossTranslateTitle}>
                    Also translate to other languages
                  </Text>
                  {selectedTargetLangs.length > 0 && (
                    <View style={styles.crossTranslateBadge}>
                      <Text style={styles.crossTranslateBadgeText}>{selectedTargetLangs.length}</Text>
                    </View>
                  )}
                </View>
                <Ionicons
                  name={crossTranslateExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#888"
                />
              </TouchableOpacity>

              {crossTranslateExpanded && (
                <View style={styles.crossTranslateList}>
                  {otherLanguages.map((lang) => {
                    const isSelected = selectedTargetLangs.includes(lang.code);
                    return (
                      <TouchableOpacity
                        key={lang.code}
                        style={[styles.crossTranslateLangRow, isSelected && styles.crossTranslateLangRowSelected]}
                        onPress={() => toggleTargetLang(lang.code)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.crossTranslateLangIcon, { backgroundColor: lang.color || '#4A90E2' }]}>
                          {lang.nativeChar ? (
                            <Text style={[
                              styles.crossTranslateLangIconText,
                              lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                            ]}>
                              {lang.nativeChar}
                            </Text>
                          ) : (
                            <Text style={styles.crossTranslateLangIconCode}>
                              {lang.langCode?.toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.crossTranslateLangName}>{lang.name}</Text>
                        <View style={[styles.crossTranslateLangCheckbox, isSelected && styles.crossTranslateLangCheckboxActive]}>
                          {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {text.trim().length > 0 && <Text style={styles.wordCount}>~{text.trim().split(/\s+/).length} words in text</Text>}
          {processing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.processingText}>{status || 'Processing...'}</Text>
            </View>
          )}
          {results && (
            <View style={styles.resultsContainer}>
              <View style={styles.resultsSummary}>
                <Ionicons name={results.new_words > 0 ? 'checkmark-circle' : 'information-circle'} size={24} color={results.new_words > 0 ? '#4CAF50' : '#FF9800'} />
                <Text style={styles.resultsMessage}>{results.message}</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.statNumber, { color: '#2E7D32' }]}>{results.new_words}</Text>
                  <Text style={styles.statLabel}>New Words</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={[styles.statNumber, { color: '#E65100' }]}>{results.existing_words}</Text>
                  <Text style={styles.statLabel}>Already Known</Text>
                </View>
              </View>
              {results.added && results.added.length > 0 && (
                <View style={styles.wordListSection}>
                  <Text style={styles.wordListTitle}>✨ New Words Added</Text>
                  {results.added.slice(0, 10).map((w, i) => (
                    <View key={i} style={styles.wordListItem}>
                      <Text style={styles.wordOriginal}>{w.word}</Text>
                      <Text style={styles.wordTranslit}>{w.transliteration}</Text>
                      <Text style={styles.wordEnglish}>{w.english_word}</Text>
                      <Text style={styles.wordClass}>{w.word_class}</Text>
                    </View>
                  ))}
                  {results.added.length > 10 && <Text style={styles.moreText}>...and {results.added.length - 10} more</Text>}
                </View>
              )}
              {results.existing && results.existing.length > 0 && (
                <View style={styles.wordListSection}>
                  <Text style={styles.wordListTitle}>📚 Already in Your Vocab</Text>
                  {results.existing.slice(0, 5).map((w, i) => (
                    <View key={i} style={styles.wordListItem}>
                      <Text style={styles.wordOriginal}>{w.word}</Text>
                      <Text style={styles.wordTranslit}>{w.transliteration}</Text>
                      <Text style={styles.wordEnglish}>{w.english_word}</Text>
                    </View>
                  ))}
                  {results.existing.length > 5 && <Text style={styles.moreText}>...and {results.existing.length - 5} more</Text>}
                </View>
              )}
            </View>
          )}
        </ScrollView>
        {!results && (
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.importBtn, (!text.trim() || processing) && styles.importBtnDisabled]} onPress={handleImport} disabled={!text.trim() || processing}>
              {processing ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="sparkles" size={20} color="#FFF" />
                  <Text style={styles.importBtnText}>Extract & Import Words</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
        {results && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={handleClose}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 },
  inputContainer: { backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 12 },
  textInput: { height: 200, padding: 14, fontSize: 15, lineHeight: 22, color: '#333' },
  fileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#4A90E2', borderStyle: 'dashed', marginBottom: 12, gap: 8 },
  fileBtnText: { fontSize: 14, fontWeight: '600', color: '#4A90E2' },
  wordCount: { fontSize: 12, color: '#999', textAlign: 'right', marginBottom: 16 },
  processingContainer: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  processingText: { fontSize: 14, color: '#666', fontWeight: '500' },
  resultsContainer: { marginTop: 8 },
  resultsSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, gap: 10 },
  resultsMessage: { fontSize: 14, fontWeight: '600', color: '#333', flex: 1 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 12 },
  statNumber: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  wordListSection: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12 },
  wordListTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 12 },
  wordListItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 8, flexWrap: 'wrap' },
  wordOriginal: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  wordTranslit: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  wordEnglish: { fontSize: 13, color: '#4A90E2', fontWeight: '500' },
  wordClass: { fontSize: 11, color: '#999', backgroundColor: '#F5F5F5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  moreText: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 8, textAlign: 'center' },
  footer: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E5E5' },
  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A90E2', paddingVertical: 14, borderRadius: 12, gap: 8 },
  importBtnDisabled: { backgroundColor: '#B0C4DE' },
  importBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  doneBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', paddingVertical: 14, borderRadius: 12 },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // Cross-translate section
  crossTranslateSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  crossTranslateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  crossTranslateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  crossTranslateCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossTranslateCheckboxActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  crossTranslateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  crossTranslateBadge: {
    backgroundColor: '#4A90E2',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  crossTranslateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  crossTranslateList: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingVertical: 4,
  },
  crossTranslateLangRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  crossTranslateLangRowSelected: {
    backgroundColor: '#F0F7FF',
  },
  crossTranslateLangIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossTranslateLangIconText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  crossTranslateLangIconCode: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  crossTranslateLangName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  crossTranslateLangCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossTranslateLangCheckboxActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
});
