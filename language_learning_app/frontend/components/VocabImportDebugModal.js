import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from './SafeText';

/**
 * Collapsible section: header row toggles expansion of children.
 */
function CollapsibleSection({ title, count, expanded, onToggle, children, style }) {
  return (
    <View style={[styles.collapsibleWrap, style]}>
      <TouchableOpacity
        style={styles.collapsibleHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color="#6B7280"
          style={{ marginRight: 6 }}
        />
        <SafeText style={styles.collapsibleTitle} numberOfLines={1}>
          {title}
          {count != null && count !== '' ? ` (${count})` : ''}
        </SafeText>
      </TouchableOpacity>
      {expanded && <View style={styles.collapsibleBody}>{children}</View>}
    </View>
  );
}

/**
 * Debug modal for vocab import / translation-based card generation.
 * Collapsible sections by language; within each, collapsible subsections
 * (Summary, Input, Lemmas, DB matching, New/Existing words, Prompts & outputs).
 */
export default function VocabImportDebugModal({ visible, onClose, data, sourceLanguage }) {
  const [expanded, setExpanded] = useState({});
  const toggle = useCallback((key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!visible || !data) return null;

  const newWords = data.words || [];
  const synonyms = data.synonyms || [];
  const existing = data.existing || [];
  const translationsByLang = data.translations_by_lang || {};
  const inputText = data.input_text || '';
  const rawTokens = data.raw_tokens || [];
  const lemmaTokens = data.lemma_tokens || data.lemmatized_tokens || [];

  const totalExtracted =
    data.total_extracted != null
      ? data.total_extracted
      : newWords.length + synonyms.length + existing.length;

  const sourceLang = String(sourceLanguage || 'source').toLowerCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <SafeText style={styles.title}>Vocab Import Debug</SafeText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator>
            {/* ── Source language section ── */}
            <CollapsibleSection
              title={`Source (${sourceLang})`}
              count={totalExtracted}
              expanded={expanded['source'] !== false}
              onToggle={() => toggle('source')}
            >
              <CollapsibleSection
                title="Summary"
                expanded={expanded['source_summary'] === true}
                onToggle={() => toggle('source_summary')}
              >
                <SafeText style={styles.summaryText}>
                  Source language: {String(sourceLanguage || 'unknown')}
                </SafeText>
                <SafeText style={styles.summaryText}>
                  Total extracted tokens: {totalExtracted}
                </SafeText>
                <SafeText style={styles.summaryText}>
                  New: {newWords.length} • Synonyms: {synonyms.length} • Existing: {existing.length}
                </SafeText>
              </CollapsibleSection>

              {inputText ? (
                <CollapsibleSection
                  title="Input text"
                  count={inputText.trim().split(/\s+/).length}
                  expanded={expanded['source_input'] === true}
                  onToggle={() => toggle('source_input')}
                >
                  <SafeText style={styles.itemText} numberOfLines={20}>
                    {inputText}
                  </SafeText>
                  <SafeText style={styles.noteText}>
                    Length: {inputText.length} characters
                  </SafeText>
                </CollapsibleSection>
              ) : null}

              {rawTokens.length > 0 && (
                <CollapsibleSection
                  title="Raw tokens"
                  count={rawTokens.length}
                  expanded={expanded['source_raw_tokens'] === true}
                  onToggle={() => toggle('source_raw_tokens')}
                >
                  <SafeText style={styles.itemText}>
                    {rawTokens.slice(0, 100).join(', ')}
                    {rawTokens.length > 100 ? ` … (+${rawTokens.length - 100} more)` : ''}
                  </SafeText>
                </CollapsibleSection>
              )}

              {lemmaTokens.length > 0 && (
                <CollapsibleSection
                  title="Tokenized lemmas"
                  count={lemmaTokens.length}
                  expanded={expanded['source_lemmas'] === true}
                  onToggle={() => toggle('source_lemmas')}
                >
                  {lemmaTokens.slice(0, 50).map((tok, idx) => (
                    <SafeText key={`lemma-${idx}`} style={styles.itemText}>
                      • {tok.word || '(no word)'} — {tok.english || 'no gloss'} ({tok.word_class || 'unknown'})
                    </SafeText>
                  ))}
                  {lemmaTokens.length > 50 && (
                    <SafeText style={styles.noteText}>
                      Showing first 50 (total {lemmaTokens.length}).
                    </SafeText>
                  )}
                </CollapsibleSection>
              )}

              <CollapsibleSection
                title="DB matching & classification"
                expanded={expanded['source_db'] === true}
                onToggle={() => toggle('source_db')}
              >
                <SafeText style={styles.sectionSubtitle}>New words</SafeText>
                {newWords.length === 0 ? (
                  <SafeText style={styles.emptyText}>No new words.</SafeText>
                ) : (
                  newWords.slice(0, 100).map((w, idx) => (
                    <SafeText key={`new-${idx}`} style={styles.itemText}>
                      • {w.word} — {w.english || 'no gloss'} ({w.word_class || 'unknown'}, {w.level || 'no level'})
                    </SafeText>
                  ))
                )}
                <SafeText style={[styles.sectionSubtitle, { marginTop: 8 }]}>Synonyms</SafeText>
                {synonyms.length === 0 ? (
                  <SafeText style={styles.emptyText}>No synonyms.</SafeText>
                ) : (
                  synonyms.slice(0, 50).map((w, idx) => (
                    <SafeText key={`syn-${idx}`} style={styles.itemText}>
                      • {w.word} — synonym of {w.synonym_of_word || '?'} (id {w.synonym_of_id || 'n/a'})
                    </SafeText>
                  ))
                )}
                <SafeText style={[styles.sectionSubtitle, { marginTop: 8 }]}>Existing</SafeText>
                {existing.length === 0 ? (
                  <SafeText style={styles.emptyText}>No existing matched.</SafeText>
                ) : (
                  existing.slice(0, 50).map((w, idx) => (
                    <SafeText key={`ex-${idx}`} style={styles.itemText}>
                      • {w.word} — {w.english_word || w.english || 'no gloss'} (id {w.existing_id || 'n/a'})
                    </SafeText>
                  ))
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Prompts & outputs"
                expanded={expanded['source_prompts'] === true}
                onToggle={() => toggle('source_prompts')}
              >
                <SafeText style={styles.emptyText}>
                  Not captured in this version. Backend could be extended to return per-step prompts and model outputs.
                </SafeText>
              </CollapsibleSection>
            </CollapsibleSection>

            {/* ── Per target language ── */}
            {Object.entries(translationsByLang).map(([lang, info]) => {
              const newList = info.new_words || [];
              const existingList = info.existing_words || [];
              const langKey = `lang_${lang}`;
              return (
                <CollapsibleSection
                  key={lang}
                  title={lang}
                  count={newList.length + existingList.length}
                  expanded={expanded[langKey] === true}
                  onToggle={() => toggle(langKey)}
                  style={{ marginTop: 12 }}
                >
                  <CollapsibleSection
                    title="New words"
                    count={newList.length}
                    expanded={expanded[`${langKey}_new`] === true}
                    onToggle={() => toggle(`${langKey}_new`)}
                  >
                    {newList.length === 0 ? (
                      <SafeText style={styles.emptyText}>None.</SafeText>
                    ) : (
                      newList.slice(0, 60).map((w, idx) => (
                        <SafeText key={`${lang}-n-${idx}`} style={styles.itemText}>
                          • {w.word} — {w.english || 'no gloss'} ({w.word_class || 'unknown'})
                        </SafeText>
                      ))
                    )}
                    {newList.length > 60 && (
                      <SafeText style={styles.noteText}>Showing first 60 of {newList.length}.</SafeText>
                    )}
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Existing words"
                    count={existingList.length}
                    expanded={expanded[`${langKey}_existing`] === true}
                    onToggle={() => toggle(`${langKey}_existing`)}
                  >
                    {existingList.length === 0 ? (
                      <SafeText style={styles.emptyText}>None.</SafeText>
                    ) : (
                      existingList.slice(0, 60).map((w, idx) => (
                        <SafeText key={`${lang}-e-${idx}`} style={styles.itemText}>
                          • {w.word} — {w.english_word || w.english || 'no gloss'} (id {w.existing_id || 'n/a'}, {w.mastery_level || 'n/a'})
                        </SafeText>
                      ))
                    )}
                    {existingList.length > 60 && (
                      <SafeText style={styles.noteText}>Showing first 60 of {existingList.length}.</SafeText>
                    )}
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Prompts & outputs"
                    expanded={expanded[`${langKey}_prompts`] === true}
                    onToggle={() => toggle(`${langKey}_prompts`)}
                  >
                    <SafeText style={styles.emptyText}>
                      Not captured in this version. Backend could be extended to return per-step prompts and model outputs for translation.
                    </SafeText>
                  </CollapsibleSection>
                </CollapsibleSection>
              );
            })}

            {Object.keys(translationsByLang).length === 0 && (
              <View style={styles.section}>
                <SafeText style={styles.emptyText}>No target languages / translations.</SafeText>
              </View>
            )}
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
    maxHeight: '85%',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 12,
  },
  collapsibleWrap: {
    marginBottom: 4,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  collapsibleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  collapsibleBody: {
    paddingLeft: 12,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
    marginLeft: 12,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
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
});
