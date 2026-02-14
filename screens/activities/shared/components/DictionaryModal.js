import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../../../components/SafeText';
import { MASTERY_FILTERS, WORD_CLASSES, CEFR_LEVELS } from '../../../../constants/filters';

export default function DictionaryModal({ dictionary, language }) {
  const {
    showDictionary,
    setShowDictionary,
    dictionarySearch,
    setDictionarySearch,
    dictionaryResults,
    dictionaryLoading,
    dictionaryMasteryFilter,
    setDictionaryMasteryFilter,
    dictionaryWordClassFilter,
    setDictionaryWordClassFilter,
    dictionaryLevelFilter,
    setDictionaryLevelFilter,
    dictionaryFiltersExpanded,
    setDictionaryFiltersExpanded,
  } = dictionary;

  const handleClose = () => {
    setShowDictionary(false);
    setDictionaryMasteryFilter([]);
    setDictionaryWordClassFilter([]);
    setDictionaryLevelFilter([]);
    setDictionaryFiltersExpanded(false);
  };

  return (
    <Modal
      visible={showDictionary}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Dictionary</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dictionary..."
              value={dictionarySearch}
              onChangeText={setDictionarySearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Filters Section */}
          <View style={styles.filtersSection}>
            <TouchableOpacity
              style={styles.filtersHeader}
              onPress={() => setDictionaryFiltersExpanded(!dictionaryFiltersExpanded)}
            >
              <Text style={styles.filtersHeaderText}>Filters</Text>
              <Ionicons
                name={dictionaryFiltersExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>

            {dictionaryFiltersExpanded && (
              <>
                {/* Mastery Filter */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupLabel}>Status</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterContent}
                  >
                    {MASTERY_FILTERS.map((filter) => {
                      const isAll = filter.value === '';
                      const isSelected = isAll
                        ? dictionaryMasteryFilter.length === 0
                        : dictionaryMasteryFilter.includes(filter.value);
                      // Only show filter chips for non-'due' filters
                      if (filter.value !== 'due') {
                        return (
                          <TouchableOpacity
                            key={filter.value}
                            style={[
                              styles.filterChip,
                              {
                                backgroundColor: isSelected
                                  ? filter.color.bg
                                  : filter.color.bg + '20',
                                borderColor: filter.color.bg,
                              },
                            ]}
                            onPress={() => {
                              if (isAll) {
                                setDictionaryMasteryFilter([]);
                              } else {
                                if (isSelected) {
                                  setDictionaryMasteryFilter(
                                    dictionaryMasteryFilter.filter((f) => f !== filter.value)
                                  );
                                } else {
                                  if (dictionaryMasteryFilter.length === 0) {
                                    setDictionaryMasteryFilter([filter.value]);
                                  } else {
                                    setDictionaryMasteryFilter([
                                      ...dictionaryMasteryFilter,
                                      filter.value,
                                    ]);
                                  }
                                }
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.filterChipText,
                                {
                                  color: isSelected ? filter.color.text : filter.color.bg,
                                  fontWeight: isSelected ? '600' : '500',
                                },
                              ]}
                            >
                              {filter.emoji} {filter.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    })}
                  </ScrollView>
                </View>

                {/* Word Class Filter */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupLabel}>Part of Speech</Text>
                  <View style={styles.filterWrapContainer}>
                    {WORD_CLASSES.map((cls) => {
                      const isAll = cls.value === 'All';
                      const isSelected = isAll
                        ? dictionaryWordClassFilter.length === 0
                        : dictionaryWordClassFilter.includes(cls.value);
                      return (
                        <TouchableOpacity
                          key={cls.value}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: isSelected
                                ? cls.color.bg
                                : cls.color.bg + '20',
                              borderColor: cls.color.bg,
                            },
                          ]}
                          onPress={() => {
                            if (isAll) {
                              setDictionaryWordClassFilter([]);
                            } else {
                              if (isSelected) {
                                setDictionaryWordClassFilter(
                                  dictionaryWordClassFilter.filter((f) => f !== cls.value)
                                );
                              } else {
                                if (dictionaryWordClassFilter.length === 0) {
                                  setDictionaryWordClassFilter([cls.value]);
                                } else {
                                  setDictionaryWordClassFilter([
                                    ...dictionaryWordClassFilter,
                                    cls.value,
                                  ]);
                                }
                              }
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              {
                                color: isSelected ? cls.color.text : cls.color.bg,
                                fontWeight: isSelected ? '600' : '500',
                              },
                            ]}
                          >
                            {cls.emoji} {cls.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* CEFR Level Filter */}
                <View style={styles.filterGroup}>
                  <Text style={styles.filterGroupLabel}>Level (CEFR)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterContent}
                  >
                    {CEFR_LEVELS.map((level) => {
                      const isAll = level.value === '';
                      const isSelected = isAll
                        ? dictionaryLevelFilter.length === 0
                        : dictionaryLevelFilter.includes(level.value);
                      return (
                        <TouchableOpacity
                          key={level.value}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: isSelected
                                ? level.color.bg
                                : level.color.bg + '20',
                              borderColor: level.color.bg,
                            },
                          ]}
                          onPress={() => {
                            if (isAll) {
                              setDictionaryLevelFilter([]);
                            } else {
                              if (isSelected) {
                                setDictionaryLevelFilter(
                                  dictionaryLevelFilter.filter((f) => f !== level.value)
                                );
                              } else {
                                if (dictionaryLevelFilter.length === 0) {
                                  setDictionaryLevelFilter([level.value]);
                                } else {
                                  setDictionaryLevelFilter([
                                    ...dictionaryLevelFilter,
                                    level.value,
                                  ]);
                                }
                              }
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              {
                                color: isSelected ? level.color.text : level.color.bg,
                                fontWeight: isSelected ? '600' : '500',
                              },
                            ]}
                          >
                            {level.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </>
            )}
          </View>

          {/* Results */}
          <ScrollView style={styles.resultsContainer}>
            {dictionaryLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : dictionaryResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>
                  {dictionarySearch
                    ? 'No results found'
                    : 'Enter a word to search'}
                </Text>
              </View>
            ) : (
              dictionaryResults.map((word, index) => (
                <View key={index} style={styles.resultCard}>
                  <View style={styles.resultHeader}>
                    <SafeText style={styles.resultWord}>{word.word}</SafeText>
                    {word.word_class && (
                      <View
                        style={[
                          styles.wordClassBadge,
                          {
                            backgroundColor:
                              WORD_CLASSES.find((c) => c.value === word.word_class)
                                ?.color.bg || '#E0E0E0',
                          },
                        ]}
                      >
                        <Text style={styles.wordClassText}>{word.word_class}</Text>
                      </View>
                    )}
                  </View>
                  {word.transliteration && (
                    <SafeText style={styles.resultTranslit}>
                      {word.transliteration}
                    </SafeText>
                  )}
                  {word.definition && (
                    <SafeText style={styles.resultDefinition}>
                      {word.definition}
                    </SafeText>
                  )}
                  <View style={styles.resultMeta}>
                    {word.cefr_level && (
                      <View
                        style={[
                          styles.levelBadge,
                          {
                            backgroundColor:
                              CEFR_LEVELS.find((l) => l.value === word.cefr_level)
                                ?.color.bg || '#E0E0E0',
                          },
                        ]}
                      >
                        <Text style={styles.levelText}>{word.cefr_level}</Text>
                      </View>
                    )}
                    {word.mastery && (
                      <View
                        style={[
                          styles.masteryBadge,
                          {
                            backgroundColor:
                              MASTERY_FILTERS.find((m) => m.value === word.mastery)
                                ?.color.bg || '#E0E0E0',
                          },
                        ]}
                      >
                        <Text style={styles.masteryText}>
                          {MASTERY_FILTERS.find((m) => m.value === word.mastery)
                            ?.emoji || ''}{' '}
                          {word.mastery}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 600,
    height: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  filtersSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
  },
  filtersHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterGroup: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  filterScroll: {
    maxHeight: 50,
  },
  filterContent: {
    gap: 8,
  },
  filterWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  resultsContainer: {
    flex: 1,
    padding: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  resultCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultWord: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    flex: 1,
  },
  wordClassBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  wordClassText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultTranslit: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  resultDefinition: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  resultMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  masteryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  masteryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
