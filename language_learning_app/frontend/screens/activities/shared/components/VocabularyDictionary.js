/**
 * Reusable Vocabulary Dictionary Component
 * 
 * A modal dictionary that displays vocabulary with search and filters.
 * Used by activity screens for quick word lookups.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../../../../components/SafeText';
import { MASTERY_FILTERS, WORD_CLASSES, LEVELS, LEVEL_COLORS } from '../../../../constants/filters';
import { getSearchVocabularyLabel } from '../../../../constants/ui_labels';
import { LANGUAGES } from '../../../../contexts/LanguageContext';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

export default function VocabularyDictionary({ 
  visible, 
  onClose, 
  language: initialLanguage,
  initialSearchQuery = '',
  dictionaryLanguage,
  setDictionaryLanguage
}) {
  // Prefer dictionaryLanguage (from useDictionary hook) > initialLanguage (activity's language)
  const effectiveInitial = dictionaryLanguage || initialLanguage || 'kannada';
  const [language, setLanguage] = useState(effectiveInitial);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [masteryFilter, setMasteryFilter] = useState([]);
  const [wordClassFilter, setWordClassFilter] = useState([]);
  const [levelFilter, setLevelFilter] = useState([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [transliterations, setTransliterations] = useState({});
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedWord, setSelectedWord] = useState(null);
  const [reviewHistory, setReviewHistory] = useState(null);
  const [showReviewHistory, setShowReviewHistory] = useState(false);

  // Sync language whenever the dictionary opens — prefer dictionaryLanguage, fallback to initialLanguage
  useEffect(() => {
    if (visible) {
      const target = dictionaryLanguage || initialLanguage;
      if (target && target !== language) {
        console.log(`Dictionary: Syncing language to ${target} on open`);
        setLanguage(target);
      }
    }
  }, [visible, dictionaryLanguage, initialLanguage]);

  // Load vocabulary when modal opens or filters change
  useEffect(() => {
    if (visible) {
      setOffset(0);
      setWords([]);
      loadVocabulary(0, true);
    }
  }, [visible, searchQuery, masteryFilter, wordClassFilter, levelFilter, language]);

  // Set initial search query when provided
  useEffect(() => {
    if (visible && initialSearchQuery && initialSearchQuery !== searchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [visible, initialSearchQuery]);

  const loadVocabulary = async (currentOffset = 0, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      
      if (masteryFilter.length > 0) {
        masteryFilter.forEach(filter => params.append('mastery_filter', filter));
      }
      if (wordClassFilter.length > 0) {
        wordClassFilter.forEach(filter => params.append('word_class_filter', filter));
      }
      if (levelFilter.length > 0) {
        levelFilter.forEach(filter => params.append('level_filter', filter));
      }
      
      params.append('limit', '50');
      params.append('offset', currentOffset.toString());

      const response = await fetch(
        `${API_BASE_URL}/api/vocabulary/${language}?${params}`
      );
      const data = await response.json();

      if (reset) {
        setWords(data.words || []);
      } else {
        setWords(prev => [...prev, ...(data.words || [])]);
      }

      setTotalCount(data.total || 0);
      setOffset(currentOffset + (data.words?.length || 0));
      setHasMore(data.has_more || false);

      // Load transliterations
      loadTransliterations(data.words || []);
    } catch (error) {
      console.error('Error loading vocabulary:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadVocabulary(offset, false);
    }
  };

  const loadTransliterations = (wordList) => {
    const newTransliterations = {};
    for (const word of wordList.slice(0, 50)) {
      newTransliterations[word.id] = word.transliteration || '';
    }
    const coerced = {};
    Object.keys(newTransliterations).forEach(k => {
      const v = newTransliterations[k];
      coerced[k] = v === null || v === undefined ? '' : (typeof v === 'string' ? v : Array.isArray(v) ? v.join('\n') : JSON.stringify(v));
    });
    setTransliterations({ ...transliterations, ...coerced });
  };

  const getMasteryColor = (masteryLevel) => {
    const filter = MASTERY_FILTERS.find(f => f.value === masteryLevel || (!masteryLevel && f.value === 'new'));
    return filter ? filter.color.bg : '#999999';
  };

  const getMasteryEmoji = (masteryLevel) => {
    const filter = MASTERY_FILTERS.find(f => f.value === masteryLevel || (!masteryLevel && f.value === 'new'));
    return filter ? filter.emoji : '●';
  };

  const handleClose = () => {
    // Reset filters when closing
    setSearchQuery('');
    setMasteryFilter([]);
    setWordClassFilter([]);
    setLevelFilter([]);
    setFiltersExpanded(false);
    setWords([]);
    onClose();
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

  const renderWordItem = ({ item }) => {
    const transliteration = transliterations[item.id] || item.transliteration || '';
    const english = String(item.english_word ?? '');
    const translationText = String(item.translation ?? '');
    
    // Check if word is due for review
    const isDue = item.next_review_date && new Date(item.next_review_date) <= new Date();

    return (
      <TouchableOpacity onPress={() => handleWordPress(item)} activeOpacity={0.7}>
        <View style={styles.wordCard}>
        <View style={styles.wordHeader}>
          <View style={styles.wordMain}>
            <SafeText style={styles.englishWord}>{english}</SafeText>
            <SafeText style={styles.translation}>{translationText}</SafeText>
            {transliteration && (
              <SafeText style={styles.transliteration}>{transliteration}</SafeText>
            )}
          </View>
          <View style={styles.masteryBadgeContainer}>
            <View
              style={[
                styles.masteryBadge,
                { backgroundColor: getMasteryColor(item.mastery_level) },
              ]}
            >
              <SafeText style={styles.masteryText}>
                {getMasteryEmoji(item.mastery_level)}{' '}{String(item.mastery_level?.toUpperCase() || 'NEW')}
              </SafeText>
            </View>
            {isDue && (
              <View style={styles.dueBadge}>
                <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                <SafeText style={styles.dueText}>DUE</SafeText>
              </View>
            )}
          </View>
        </View>
        <View style={styles.wordMeta}>
          {item.word_class ? (() => {
            const wordClassColor = WORD_CLASSES.find(wc => wc.value.toLowerCase() === item.word_class.toLowerCase());
            return (
              <View style={[
                styles.tag,
                {
                  backgroundColor: wordClassColor ? wordClassColor.color.bg : '#F5F5F5',
                }
              ]}>
                <SafeText style={[
                  styles.tagText,
                  {
                    color: wordClassColor ? wordClassColor.color.text : '#666',
                  }
                ]}>
                  {String(item.word_class)}
                </SafeText>
              </View>
            );
          })() : null}
          {item.level ? (
            <View style={[
              styles.tag,
              {
                backgroundColor: LEVEL_COLORS[item.level?.toUpperCase()]?.bg || '#E8F4FD',
              }
            ]}>
              <SafeText style={[
                styles.tagText,
                {
                  color: LEVEL_COLORS[item.level?.toUpperCase()]?.text || '#666',
                }
              ]}>
                {String(item.level?.toUpperCase() || '')}
              </SafeText>
            </View>
          ) : null}
          {item.verb_transitivity && item.verb_transitivity !== 'N/A' ? (
            <View style={[
              styles.tag,
              {
                backgroundColor: '#6B7280',
              }
            ]}>
              <SafeText style={[
                styles.tagText,
                {
                  color: '#FFFFFF',
                }
              ]}>
                {String(item.verb_transitivity)}
              </SafeText>
            </View>
          ) : null}
        </View>
      </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <SafeText style={styles.modalTitle}>Dictionary</SafeText>
            <View style={styles.headerActions}>
              {/* Language Picker */}
              <TouchableOpacity 
                style={styles.languagePickerButton} 
                onPress={() => setShowLanguageMenu(true)}
              >
                <View style={[styles.langBadge, { backgroundColor: LANGUAGES.find(l => l.code === language)?.color || '#999' }]}>
                  {LANGUAGES.find(l => l.code === language)?.nativeChar ? (
                    <SafeText style={[
                      styles.langChar,
                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}>
                      {LANGUAGES.find(l => l.code === language)?.nativeChar}
                    </SafeText>
                  ) : (
                    <SafeText style={styles.langCode}>
                      {LANGUAGES.find(l => l.code === language)?.countryCode?.toUpperCase()}
                    </SafeText>
                  )}
                </View>
                <View style={styles.languagePickerButtonTextContainer}>
                  <SafeText style={styles.languagePickerButtonText}>
                    {LANGUAGES.find(l => l.code === language)?.name || language}
                  </SafeText>
                  {LANGUAGES.find(l => l.code === language)?.nativeName && (
                    <SafeText style={[
                      styles.languagePickerButtonNative,
                      language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' }
                    ]}>
                      {LANGUAGES.find(l => l.code === language)?.nativeName}
                    </SafeText>
                  )}
                </View>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
              
              {/* Close Button */}
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
              ]}
              placeholder={getSearchVocabularyLabel(language)}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filters Section */}
          <View style={styles.filtersSection}>
            <TouchableOpacity
              style={styles.filtersHeader}
              onPress={() => setFiltersExpanded(!filtersExpanded)}
            >
              <SafeText style={styles.filtersHeaderText}>Filters</SafeText>
              <Ionicons
                name={filtersExpanded ? "chevron-up" : "chevron-down"}
                size={20}
                color="#666"
              />
            </TouchableOpacity>

            {filtersExpanded && (
              <>
                {/* Mastery Filter */}
                <View style={styles.filterGroup}>
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
                            } else {
                              if (isSelected) {
                                setMasteryFilter(masteryFilter.filter(f => f !== filter.value));
                              } else {
                                setMasteryFilter([...masteryFilter, filter.value]);
                              }
                            }
                          }}
                        >
                          {filter.icon ? (
                            <View style={styles.filterChipContent}>
                              <Ionicons name={filter.icon} size={14} color={isSelected ? filter.color.text : filter.color.bg} />
                              <SafeText
                                style={[
                                  styles.filterChipText,
                                  {
                                    color: isSelected ? filter.color.text : filter.color.bg,
                                    fontWeight: isSelected ? '600' : '500',
                                    marginLeft: 4,
                                  },
                                ]}
                              >{String(filter.label)}</SafeText>
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
                            >{`${filter.emoji} ${String(filter.label)}`}</SafeText>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Word Class Filter */}
                <View style={styles.filterGroup}>
                  <SafeText style={styles.filterGroupLabel}>Part of Speech</SafeText>
                  <View style={styles.filterWrapContainer}>
                    {WORD_CLASSES.map((cls) => {
                      const isAll = cls.value === 'All';
                      const isSelected = isAll ? wordClassFilter.length === 0 : wordClassFilter.includes(cls.value);
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
                            if (isAll) {
                              setWordClassFilter([]);
                            } else {
                              if (isSelected) {
                                setWordClassFilter(wordClassFilter.filter(f => f !== cls.value));
                              } else {
                                setWordClassFilter([...wordClassFilter, cls.value]);
                              }
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
                          >{String(cls.label)}</SafeText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Level Filter */}
                <View style={styles.filterGroup}>
                  <SafeText style={styles.filterGroupLabel}>Level</SafeText>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.filterContent}
                  >
                    {LEVELS.map((level) => {
                      const isAll = level === 'All';
                      const levelColor = LEVEL_COLORS[level];
                      const isSelected = isAll ? levelFilter.length === 0 : levelFilter.includes(level);
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
                            if (isAll) {
                              setLevelFilter([]);
                            } else {
                              if (isSelected) {
                                setLevelFilter(levelFilter.filter(f => f !== level));
                              } else {
                                setLevelFilter([...levelFilter, level]);
                              }
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
                          >{String(level)}</SafeText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </>
            )}
          </View>

          {/* Word Count */}
          {!loading && words.length > 0 && (
            <View style={styles.countContainer}>
              <SafeText style={styles.countText}>
                {`Showing ${String(words.length)} of ${String(totalCount)} ${totalCount === 1 ? 'entry' : 'entries'}`}
              </SafeText>
            </View>
          )}

          {/* Word List */}
          {loading && words.length === 0 ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
            </View>
          ) : words.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="book-outline" size={64} color="#CCC" />
              <SafeText style={styles.emptyText}>
                {searchQuery ? 'No words found' : 'Enter a word to search'}
              </SafeText>
            </View>
          ) : (
            <FlatList
              data={words}
              renderItem={renderWordItem}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={true}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingFooter}>
                    <ActivityIndicator size="small" color="#4A90E2" />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>

    {/* Language Selection Modal */}
    <Modal
      visible={showLanguageMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLanguageMenu(false)}
    >
      <TouchableOpacity 
        style={styles.languageMenuOverlay} 
        activeOpacity={1} 
        onPress={() => setShowLanguageMenu(false)}
      >
        <View style={styles.languageMenuContainer}>
          <SafeText style={styles.languageMenuTitle}>Select Language</SafeText>
          {LANGUAGES.filter(l => l.active).map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageMenuItem,
                language === lang.code && styles.languageMenuItemSelected
              ]}
              onPress={() => {
                setLanguage(lang.code);
                if (setDictionaryLanguage) {
                  setDictionaryLanguage(lang.code);
                }
                setShowLanguageMenu(false);
              }}
            >
              {(lang.nativeChar || lang.langCode) && (
                <View style={[styles.langBadgeLarge, { backgroundColor: lang.color }]}>
                  {lang.nativeChar ? (
                    <SafeText style={[
                      styles.nativeCharTextLarge,
                      lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}>
                      {lang.nativeChar}
                    </SafeText>
                  ) : (
                    <SafeText style={styles.langCodeLarge}>
                      {lang.countryCode}
                    </SafeText>
                  )}
                </View>
              )}
              <View style={styles.languageMenuItemContent}>
                <SafeText style={[
                  styles.languageMenuItemName,
                  language === lang.code && styles.languageMenuItemNameSelected
                ]}>
                  {lang.name}
                </SafeText>
                {lang.nativeName && (
                  <SafeText style={[
                    styles.languageMenuItemNative,
                    language === lang.code && styles.languageMenuItemNativeSelected,
                    lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' }
                  ]}>
                    {lang.nativeName}
                  </SafeText>
                )}
              </View>
              {language === lang.code && (
                <Ionicons name="checkmark" size={20} color="#4A90E2" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>

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
              {selectedWord?.english_word} Review History
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
                    <View style={[
                      styles.masteryBadge,
                      { backgroundColor: getMasteryColor(reviewHistory.current_state?.mastery_level) }
                    ]}>
                      <SafeText style={styles.masteryText}>
                        {getMasteryEmoji(reviewHistory.current_state?.mastery_level)}{' '}{reviewHistory.current_state?.mastery_level?.toUpperCase() || 'NEW'}
                      </SafeText>
                    </View>
                  </View>
                  <View style={styles.srsInfoRow}>
                    <SafeText style={styles.srsInfoLabel}>Review Count:</SafeText>
                    <SafeText style={styles.srsInfoValue}>{reviewHistory.current_state?.review_count || 0}</SafeText>
                  </View>
                  <View style={styles.srsInfoRow}>
                    <SafeText style={styles.srsInfoLabel}>Ease Factor:</SafeText>
                    <SafeText style={styles.srsInfoValue}>{reviewHistory.current_state?.ease_factor?.toFixed(2) || 'N/A'}</SafeText>
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
                        ? (() => {
                            const date = new Date(reviewHistory.current_state.next_review_date);
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            const year = String(date.getFullYear()).slice(-2);
                            return `${month}/${day}/${year}`;
                          })()
                        : 'Not scheduled'}
                    </SafeText>
                  </View>
                  {reviewHistory.current_state?.next_review_date && (
                    <View style={styles.srsInfoRow}>
                      <SafeText style={styles.srsInfoLabel}>ETA:</SafeText>
                      <SafeText style={styles.srsInfoValue}>
                        {(() => {
                          const now = new Date();
                          const nextReview = new Date(reviewHistory.current_state.next_review_date);
                          const diffMs = nextReview - now;
                          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                          if (diffDays < 0) return 'Overdue';
                          if (diffDays === 0) return 'Due today';
                          if (diffDays === 1) return '1 day';
                          return `${diffDays} days`;
                        })()}
                      </SafeText>
                    </View>
                  )}
                </View>

                {/* Review History */}
                <View style={styles.historySection}>
                  <SafeText style={styles.sectionTitle}>
                    Review History ({reviewHistory.history?.length || 0} reviews)
                  </SafeText>
                  {reviewHistory.history && reviewHistory.history.length > 0 ? (
                    reviewHistory.history.map((review, index) => {
                      const date = new Date(review.reviewed_at);
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const year = String(date.getFullYear()).slice(-2);
                      const dateStr = `${month}/${day}/${year}`;
                      const timeStr = date.toLocaleTimeString(undefined, { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      });
                      
                      return (
                        <View key={index} style={styles.historyItem}>
                          <View style={styles.historyItemHeader}>
                            <SafeText style={styles.historyDate}>
                              {dateStr}{' '}{timeStr}
                            </SafeText>
                            <View style={[
                              styles.ratingBadge,
                              {
                                backgroundColor:
                                  review.rating === 'easy' ? '#10B981' :
                                  review.rating === 'good' ? '#3B82F6' :
                                  review.rating === 'hard' ? '#F59E0B' :
                                  '#EF4444'
                              }
                            ]}>
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
                      );
                    })
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
    </>
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
    maxWidth: 700,
    height: '85%',
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
  filterChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChipText: {
    fontSize: 12,
  },
  countContainer: {
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  countText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  listContent: {
    padding: 12,
  },
  wordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  wordMain: {
    flex: 1,
    marginRight: 12,
  },
  englishWord: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  translation: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  transliteration: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  masteryBadgeContainer: {
    alignItems: 'flex-end',
  },
  masteryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  masteryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    marginTop: 4,
  },
  dueText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  wordMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingFooter: {
    padding: 16,
    alignItems: 'center',
  },
  // Language Picker Styles
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  languagePickerButtonTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  languagePickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  languagePickerButtonNative: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },
  langBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langChar: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  langCode: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  // Language Selection Modal Styles
  languageMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageMenuContainer: {
    width: '85%',
    maxWidth: 400,
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
  },
  languageMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    padding: 16,
    paddingBottom: 8,
  },
  languageMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  languageMenuItemSelected: {
    backgroundColor: '#E8F4FD',
  },
  langBadgeLarge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nativeCharTextLarge: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  langCodeLarge: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  languageMenuItemContent: {
    flex: 1,
    flexDirection: 'column',
  },
  languageMenuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  languageMenuItemNameSelected: {
    color: '#4A90E2',
  },
  languageMenuItemNative: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  languageMenuItemNativeSelected: {
    color: '#4A90E2',
  },
  // Review History Modal Styles
  reviewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewModalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
  },
  reviewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  reviewHistoryContent: {
    flex: 1,
  },
  srsInfoSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  srsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  srsInfoLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  srsInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'right',
  },
  historySection: {
    padding: 16,
  },
  historyItem: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  ratingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historyDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  historyDetail: {
    fontSize: 12,
    color: '#666',
  },
  noHistoryText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 24,
    fontStyle: 'italic',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
