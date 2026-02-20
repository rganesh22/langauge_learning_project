import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import SafeText from '../components/SafeText';
import TextImportModal from '../components/TextImportModal';
import { LanguageContext, LANGUAGES } from '../contexts/LanguageContext';
import NoLanguageEmptyState from '../components/NoLanguageEmptyState';
import { MASTERY_FILTERS, WORD_CLASSES as SHARED_WORD_CLASSES, LEVELS as SHARED_LEVELS, LEVEL_COLORS as SHARED_LEVEL_COLORS } from '../constants/filters';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

// Use shared LANGUAGES list imported from context for consistent language options across screens

const WORD_CLASSES = SHARED_WORD_CLASSES;

const LEVELS = SHARED_LEVELS;
const LEVEL_COLORS = SHARED_LEVEL_COLORS;

export default function VocabLibraryScreen({ route, navigation }) {
  const { selectedLanguage: ctxLanguage, setSelectedLanguage: setCtxLanguage, availableLanguages } = useContext(LanguageContext);
  // Use global selected language and keep context in sync
  const selectedLanguage = route?.params?.language || ctxLanguage || null;
  const setSelectedLanguage = (lang) => {
    setCtxLanguage(lang);
  };
  const language = selectedLanguage;
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [masteryFilter, setMasteryFilter] = useState([]); // Array for multiple selections
  const [wordClassFilter, setWordClassFilter] = useState([]); // Array for multiple selections
  const [levelFilter, setLevelFilter] = useState([]); // Array for multiple selections
  const [transliterations, setTransliterations] = useState({});
  // Default filters collapsed
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [allLanguagesSrsStats, setAllLanguagesSrsStats] = useState({});
  
  // Text import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Review history modal state
  const [selectedWord, setSelectedWord] = useState(null);
  const [reviewHistory, setReviewHistory] = useState(null);
  const [showReviewHistory, setShowReviewHistory] = useState(false);

  const loadAllLanguagesSrsStats = async () => {
    try {
      const statsPromises = availableLanguages.map(async (lang) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/srs/stats/${lang.code}`);
          if (response.ok) {
            const data = await response.json();
            return {
              code: lang.code,
              new_count: data.new_count || 0,
              due_count: data.due_count || 0,
            };
          }
        } catch (error) {
          console.error(`Error loading SRS stats for ${lang.code}:`, error);
        }
        return { code: lang.code, new_count: 0, due_count: 0 };
      });

      const stats = await Promise.all(statsPromises);
      const statsMap = {};
      stats.forEach(stat => {
        statsMap[stat.code] = stat;
      });
      setAllLanguagesSrsStats(statsMap);
    } catch (error) {
      console.error('Error loading all languages SRS stats:', error);
    }
  };

  // Sync language from route params when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Keep filters expanded state as-is on focus; only reset when explicitly requested
      if (route?.params?.language && route.params.language !== selectedLanguage) {
        setSelectedLanguage(route.params.language);
        setCtxLanguage(route.params.language);
      }
      
      if (!selectedLanguage) return; // nothing to load yet
      
      // Refresh vocabulary data when screen is focused
      console.log('[VocabLibrary] Screen focused, refreshing vocabulary...');
      setOffset(0);
      setWords([]);
      loadVocabulary(0, true);
      loadAllLanguagesSrsStats();
    }, [route?.params?.language, selectedLanguage, availableLanguages.length, searchQuery, masteryFilter, wordClassFilter, levelFilter, language])
  );

  // Note: removed separate useEffect for filters - now handled by useFocusEffect

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

  const loadVocabulary = async (currentOffset = 0, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      // Handle multiple mastery filters
      if (masteryFilter.length > 0) {
        masteryFilter.forEach(filter => {
          params.append('mastery_filter', filter);
        });
      }
      // Handle multiple word class filters
      if (wordClassFilter.length > 0) {
        wordClassFilter.forEach(filter => {
          params.append('word_class_filter', filter);
        });
      }
      // Handle multiple level filters
      if (levelFilter.length > 0) {
        levelFilter.forEach(filter => {
          params.append('level_filter', filter);
        });
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
      
      // Load transliterations for new words
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

  const loadTransliterations = async (wordList) => {
    // Use transliteration values provided by the backend (which come directly from the CSV)
    const newTransliterations = {};
    for (const word of wordList.slice(0, 50)) {
      newTransliterations[word.id] = word.transliteration || '';
    }
    // Coerce to strings to avoid storing objects/arrays
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

  const renderWordItem = ({ item }) => {
    const transliteration = transliterations[item.id] || item.transliteration || '';
  // Defensive: ensure displayed fields are strings (avoid React Native Web unexpected text node)
  const english = String(item.english_word ?? '');
  const translationText = String(item.translation ?? '');
  
  // Check if word is due for review
  const isDue = item.next_review_date && new Date(item.next_review_date) <= new Date();

    return (
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
            <TouchableOpacity onPress={() => handleWordPress(item)} activeOpacity={0.7}>
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
            </TouchableOpacity>
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
    );
  };

  const currentLanguage = LANGUAGES.find(l => l.code === selectedLanguage);

  // If no language selected yet, show the empty state
  if (!selectedLanguage || availableLanguages.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="book" size={24} color="#4A90E2" style={styles.appIcon} />
            <SafeText style={styles.appTitle}>Vocab Library</SafeText>
          </View>
        </View>
        <NoLanguageEmptyState message="Select a language in your Profile to browse vocabulary." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Language Selector */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="book" size={24} color="#4A90E2" style={styles.appIcon} />
          <SafeText style={styles.appTitle}>Vocab Library</SafeText>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => setShowImportModal(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color="#4A90E2" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setLanguageMenuVisible(true)}
          >
          {(currentLanguage?.nativeChar || currentLanguage?.langCode) && (
            <View style={[styles.countryCodeBox, { backgroundColor: currentLanguage?.color || '#F5F5F5' }]}>
              {currentLanguage?.nativeChar ? (
                <SafeText style={[
                  styles.nativeCharText,
                  currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                ]}>{currentLanguage.nativeChar}</SafeText>
              ) : (
                <SafeText style={styles.countryCodeText}>{currentLanguage?.langCode?.toUpperCase()}</SafeText>
              )}
            </View>
          )}
          <View style={styles.languageButtonContent}>
            <SafeText style={styles.languageName}>{currentLanguage?.name}</SafeText>
            {currentLanguage?.nativeName && (
              <SafeText style={[
                styles.languageNativeName,
                currentLanguage?.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' }
              ]}>{currentLanguage.nativeName}</SafeText>
            )}
          </View>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
        </View>
      </View>
{/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vocabulary..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
{/* Filters */}
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
                        // "All" selected - clear all filters
                        setMasteryFilter([]);
                      } else {
                        if (isSelected) {
                          // Remove this filter
                          setMasteryFilter(masteryFilter.filter(f => f !== filter.value));
                        } else {
                          // Add this filter
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
                      // "All" selected - clear all filters
                      setWordClassFilter([]);
                    } else {
                      if (isSelected) {
                        // Remove this filter
                        setWordClassFilter(wordClassFilter.filter(f => f !== cls.value));
                      } else {
                        // Add this filter
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
                      // "All" selected - clear all filters
                      setLevelFilter([]);
                    } else {
                      if (isSelected) {
                        // Remove this filter
                        setLevelFilter(levelFilter.filter(f => f !== level));
                      } else {
                        // Add this filter
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
          <SafeText style={styles.countText}>{`Showing ${String(words.length)} of ${String(totalCount)} ${totalCount === 1 ? 'entry' : 'entries'}`}</SafeText>
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
      <SafeText style={styles.emptyText}>No words found</SafeText>
        </View>
      ) : (
        <FlatList
          data={words}
          renderItem={renderWordItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
{/* Language Selector Modal */}
      <Modal
        visible={languageMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLanguageMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLanguageMenuVisible(false)}
        >
          <View style={styles.languageMenu}>
            <SafeText style={styles.menuTitle}>Select Language</SafeText>
            {availableLanguages.map((lang) => {
              const isSelected = selectedLanguage === lang.code;
              const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
              return (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  isSelected && styles.languageOptionSelected,
                ]}
                onPress={() => {
                  setSelectedLanguage(lang.code);
                  setCtxLanguage(lang.code); // persist globally
                  setLanguageMenuVisible(false);
                  // Reset filters and reload
                  setOffset(0);
                  setWords([]);
                }}
              >
                {(lang.nativeChar || lang.langCode) && (
                  <View style={[styles.countryCodeBox, { backgroundColor: lang.color }]}>
                    {lang.nativeChar ? (
                      <SafeText style={[
                        styles.nativeCharText,
                        lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                      ]}>{String(lang.nativeChar)}</SafeText>
                    ) : (
                      <SafeText style={styles.countryCodeText}>{String(lang.langCode?.toUpperCase())}</SafeText>
                    )}
                  </View>
                )}
                <View style={styles.languageOptionContent}>
                  <View style={styles.languageNameRow}>
                    <View>
                      <SafeText
                        style={[
                          styles.languageOptionText,
                          isSelected && styles.languageOptionTextSelected,
                          !lang.active && styles.languageOptionTextDisabled,
                        ]}
                      >{String(lang.name)}</SafeText>
                      {lang.nativeName && (
                        <SafeText
                          style={[
                            styles.languageOptionNativeName,
                            isSelected && styles.languageOptionNativeNameSelected,
                            !lang.active && styles.languageOptionNativeNameDisabled,
                            lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' }
                          ]}
                        >{String(lang.nativeName)}</SafeText>
                      )}
                    </View>
                  </View>
                </View>
                {/* SRS Stats Chips - Right aligned, icon only */}
                <View style={styles.languageSrsChips}>
                  <View style={styles.languageSrsChipNew}>
                    <Ionicons name="add-circle" size={16} color="#5D8EDC" />
                    <SafeText style={styles.languageSrsChipTextNew}>
                      {langStats.new_count || 0}
                    </SafeText>
                  </View>
                  <View style={styles.languageSrsChipDue}>
                    <Ionicons name="alarm" size={16} color="#FF6B6B" />
                    <SafeText style={styles.languageSrsChipTextDue}>
                      {langStats.due_count || 0}
                    </SafeText>
                  </View>
                </View>
                {!lang.active && (
                  <Ionicons name="lock-closed" size={16} color="#CCC" />
                )}
              </TouchableOpacity>
              );
            })}
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
                          ? new Date(reviewHistory.current_state.next_review_date).toLocaleDateString()
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
                      reviewHistory.history.map((review, index) => (
                        <View key={index} style={styles.historyItem}>
                          <View style={styles.historyItemHeader}>
                            <SafeText style={styles.historyDate}>
                              {new Date(review.reviewed_at).toLocaleDateString()}{' '}{new Date(review.reviewed_at).toLocaleTimeString()}
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

      {/* Text Import Modal */}
      <TextImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        language={language}
        onImportComplete={(data) => {
          setOffset(0);
          setWords([]);
          loadVocabulary(0, true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
  },
  appIcon: {
    marginRight: 8,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    flexShrink: 0,
  },
  languageButtonContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginRight: 4,
  },
  languageCodeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  languageNativeName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  countryCodeBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  nativeCharText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  languageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  languageOptionSelected: {
    backgroundColor: '#F0F7FF',
  },
  languageOptionDisabled: {
    opacity: 0.5,
  },
  languageOptionContent: {
    flex: 1,
    flexDirection: 'column',
  },
  languageOptionCodeName: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  languageOptionCodeNameSelected: {
    fontWeight: '600',
    color: '#4A90E2',
  },
  languageOptionCodeNameDisabled: {
    color: '#999',
  },
  languageOptionNativeName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  languageOptionNativeNameSelected: {
    color: '#4A90E2',
  },
  languageOptionNativeNameDisabled: {
    color: '#999',
  },
  languageOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  languageOptionTextSelected: {
    fontWeight: '600',
    color: '#4A90E2',
  },
  languageOptionTextDisabled: {
    color: '#999',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    height: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  filtersSection: {
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filtersHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  filterScroll: {
    marginBottom: 0,
  },
  filterContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  filterWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
  },
  wordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  wordMain: {
    flex: 1,
  },
  englishWord: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  translation: {
    fontSize: 20,
    color: '#1A1A1A',
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
    marginLeft: 12,
  },
  masteryText: {
    fontSize: 10,
    fontWeight: 'bold',
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
    marginLeft: 12,
  },
  dueText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  wordMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  countText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
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
  languageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  languageSrsChips: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  languageSrsChipNew: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  languageSrsChipTextNew: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5D8EDC',
  },
  languageSrsChipDue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE8E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  languageSrsChipTextDue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B6B',
  },
});
