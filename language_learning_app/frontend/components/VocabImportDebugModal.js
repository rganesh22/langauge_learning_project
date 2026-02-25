import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from './SafeText';

/**
 * Debug modal for vocab import / translation-based card generation.
 * Shows what words were extracted, how they were classified (new/existing/synonym),
 * and how many words were proposed for each target language.
 */
export default function VocabImportDebugModal({ visible, onClose, data, sourceLanguage }) {
  if (!visible || !data) return null;

  const newWords = data.words || [];
  const synonyms = data.synonyms || [];
  const existing = data.existing || [];
  const translationsByLang = data.translations_by_lang || {};

  const totalExtracted =
    data.total_extracted != null
      ? data.total_extracted
      : newWords.length + synonyms.length + existing.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <SafeText style={styles.title}>Vocab Import Debug</SafeText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator>
            {/* Summary */}
            <View style={styles.section}>
              <SafeText style={styles.sectionTitle}>Summary</SafeText>
              <SafeText style={styles.summaryText}>
                Source language: {String(sourceLanguage || 'unknown')}
              </SafeText>
              <SafeText style={styles.summaryText}>
                Total extracted tokens: {totalExtracted}
              </SafeText>
              <SafeText style={styles.summaryText}>
                New words: {newWords.length} • Synonyms: {synonyms.length} • Existing: {existing.length}
              </SafeText>
            </View>

            {/* DB search effects */}
            <View style={styles.section}>
              <SafeText style={styles.sectionTitle}>DB Matching & Classification</SafeText>
              <SafeText style={styles.sectionSubtitle}>New words (not found in DB)</SafeText>
              {newWords.length === 0 ? (
                <SafeText style={styles.emptyText}>No new words detected.</SafeText>
              ) : (
                newWords.slice(0, 100).map((w, idx) => (
                  <SafeText key={`new-${idx}`} style={styles.itemText}>
                    • {w.word} — {w.english || 'no gloss'} ({w.word_class || 'unknown'}, {w.level || 'no level'})
                  </SafeText>
                ))
              )}

              <SafeText style={[styles.sectionSubtitle, { marginTop: 12 }]}>
                Synonyms (matched existing words via English)
              </SafeText>
              {synonyms.length === 0 ? (
                <SafeText style={styles.emptyText}>No synonyms detected.</SafeText>
              ) : (
                synonyms.slice(0, 100).map((w, idx) => (
                  <SafeText key={`syn-${idx}`} style={styles.itemText}>
                    • {w.word} — {w.english || 'no gloss'} (synonym of {w.synonym_of_word || 'unknown'}; id {w.synonym_of_id || 'n/a'})
                  </SafeText>
                ))
              )}

              <SafeText style={[styles.sectionSubtitle, { marginTop: 12 }]}>
                Existing entries (found in DB for this language)
              </SafeText>
              {existing.length === 0 ? (
                <SafeText style={styles.emptyText}>No existing entries matched.</SafeText>
              ) : (
                existing.slice(0, 100).map((w, idx) => (
                  <SafeText key={`exist-${idx}`} style={styles.itemText}>
                    • {w.word} — {w.english_word || w.english || 'no gloss'} (id {w.existing_id || 'n/a'}, {w.word_class || 'unknown'}, {w.level || 'no level'})
                  </SafeText>
                ))
              )}
              {(newWords.length + synonyms.length + existing.length) > 100 && (
                <SafeText style={styles.noteText}>
                  Showing first 100 items only for brevity.
                </SafeText>
              )}
            </View>

            {/* Per-language translation counts */}
            <View style={styles.section}>
              <SafeText style={styles.sectionTitle}>Target Languages</SafeText>
              {Object.keys(translationsByLang).length === 0 ? (
                <SafeText style={styles.emptyText}>No cross-language translations were requested.</SafeText>
              ) : (
                Object.entries(translationsByLang).map(([lang, info]) => {
                  const newCount = (info.new_words || []).length;
                  const existingCount = (info.existing_words || []).length;
                  return (
                    <View key={lang} style={styles.langBlock}>
                      <SafeText style={styles.langTitle}>
                        {lang}: {newCount} new, {existingCount} existing
                      </SafeText>
                      {(info.new_words || []).slice(0, 40).map((w, idx) => (
                        <SafeText key={`${lang}-new-${idx}`} style={styles.itemText}>
                          • NEW {w.word} — {w.english || 'no gloss'} ({w.word_class || 'unknown'})
                        </SafeText>
                      ))}
                      {(info.existing_words || []).slice(0, 40).map((w, idx) => (
                        <SafeText key={`${lang}-exist-${idx}`} style={styles.itemText}>
                          • EXISTING {w.word} — {w.english_word || w.english || 'no gloss'}
                        </SafeText>
                      ))}
                      {(((info.new_words || []).length + (info.existing_words || []).length) > 80) && (
                        <SafeText style={styles.noteText}>
                          Showing first 80 entries for this language.
                        </SafeText>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 2,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 13,
    color: '#111827',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  langBlock: {
    marginTop: 8,
    marginBottom: 8,
  },
  langTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
});

