import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGES } from '../contexts/LanguageContext';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

const ACTIVITIES = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'translation', 'conversation'];
const ACTIVITY_COLORS = {
  reading: { primary: '#4A90E2', light: '#E8F4FD' },
  listening: { primary: '#2B654A', light: '#E8F5EF' },
  writing: { primary: '#FF6B6B', light: '#FFE8E8' },
  speaking: { primary: '#FF9500', light: '#FFF4E6' },
  translation: { primary: '#8B5CF6', light: '#F3E8FF' },
  conversation: { primary: '#9B59B6', light: '#F4E6FF' },
  flashcards: { primary: '#14B8A6', light: '#E0F7F4' },
};

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEKDAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export default function WeeklyGoalsSection({ expanded, onToggle, onGoalsSaved }) {
  const [weeklyGoals, setWeeklyGoals] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedLanguages, setExpandedLanguages] = useState({}); // Track which languages are expanded in modal
  const [expandedDays, setExpandedDays] = useState({}); // Track which days are expanded

  useEffect(() => {
    if (expanded) {
      loadWeeklyGoals();
      // Initialize all days as expanded by default when opening the section
      const initialExpandedState = {};
      WEEKDAYS.forEach(day => {
        initialExpandedState[day] = true;
      });
      setExpandedDays(initialExpandedState);
    }
  }, [expanded]);

  const loadWeeklyGoals = async () => {
    try {
      const allGoals = {};
      
      for (const lang of LANGUAGES.filter(l => l.active)) {
        const response = await fetch(`${API_BASE_URL}/api/weekly-goals/${lang.code}`);
        if (response.ok) {
          const data = await response.json();
          Object.entries(data.weekly_goals || {}).forEach(([day, activities]) => {
            if (!allGoals[day]) allGoals[day] = {};
            allGoals[day][lang.code] = activities;
          });
        }
      }
      
      WEEKDAYS.forEach(day => {
        if (!allGoals[day]) allGoals[day] = {};
      });
      
      setWeeklyGoals(allGoals);
    } catch (error) {
      console.error('Error loading weekly goals:', error);
    }
  };

  const handleDayClick = (day, specificLanguage = null) => {
    setSelectedDay(day);
    setShowAddModal(true);
    // If a specific language is provided, only expand that language.
    // Otherwise, leave all languages collapsed by default in the add modal.
    const autoExpandLanguages = {};
    if (specificLanguage) {
      autoExpandLanguages[specificLanguage] = true;
    }
    setExpandedLanguages(autoExpandLanguages);
  };

  const toggleDay = (day) => {
    setExpandedDays(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
  };

  const addActivity = (language, activity) => {
    const updated = { ...weeklyGoals };
    if (!updated[selectedDay]) updated[selectedDay] = {};
    if (!updated[selectedDay][language]) updated[selectedDay][language] = {};
    updated[selectedDay][language][activity] = (updated[selectedDay][language][activity] || 0) + 1;
    setWeeklyGoals(updated);
  };

  const decreaseActivity = (language, activity) => {
    if (!selectedDay) return;
    const updated = { ...weeklyGoals };
    if (updated[selectedDay]?.[language]?.[activity]) {
      if (updated[selectedDay][language][activity] > 1) {
        updated[selectedDay][language][activity] -= 1;
      } else {
        delete updated[selectedDay][language][activity];
        if (Object.keys(updated[selectedDay][language]).length === 0) {
          delete updated[selectedDay][language];
        }
      }
      setWeeklyGoals(updated);
    }
  };

  const setFlashcardCount = (language, countText) => {
    if (!selectedDay) return;
    const count = parseInt(countText) || 0;
    const updated = { ...weeklyGoals };
    
    if (count > 0) {
      if (!updated[selectedDay]) updated[selectedDay] = {};
      if (!updated[selectedDay][language]) updated[selectedDay][language] = {};
      updated[selectedDay][language]['flashcards'] = count;
    } else {
      // Remove if count is 0
      if (updated[selectedDay]?.[language]?.['flashcards']) {
        delete updated[selectedDay][language]['flashcards'];
        if (Object.keys(updated[selectedDay][language]).length === 0) {
          delete updated[selectedDay][language];
        }
      }
    }
    
    setWeeklyGoals(updated);
  };

  const removeActivity = (day, language, activity) => {
    const updated = { ...weeklyGoals };
    if (updated[day]?.[language]?.[activity]) {
      if (updated[day][language][activity] > 1) {
        updated[day][language][activity] -= 1;
      } else {
        delete updated[day][language][activity];
        if (Object.keys(updated[day][language]).length === 0) {
          delete updated[day][language];
        }
      }
      setWeeklyGoals(updated);
    }
  };

  const saveGoals = async () => {
    setSaving(true);
    try {
      // Reorganize data by language
      const byLanguage = {};
      Object.entries(weeklyGoals).forEach(([day, languages]) => {
        Object.entries(languages).forEach(([lang, activities]) => {
          if (!byLanguage[lang]) byLanguage[lang] = {};
          byLanguage[lang][day] = activities;
        });
      });

      console.log('Saving perpetual weekly goals:', JSON.stringify(byLanguage, null, 2));

      // Save for each language (no week_start_date = saves to default template)
      // This makes goals apply perpetually to all future weeks
      const promises = Object.entries(byLanguage).map(([lang, goals]) => {
        const url = `${API_BASE_URL}/api/weekly-goals/${lang}`;
        console.log(`Saving ${lang} goals to: ${url} (perpetual)`);
        return fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weekly_goals: goals }),
        }).then(response => {
          console.log(`Response for ${lang}:`, response.status);
          if (!response.ok) {
            return response.text().then(text => {
              console.error(`Failed to save ${lang} goals:`, text);
              throw new Error(`Failed to save ${lang}: ${response.status}`);
            });
          }
          return response.json();
        });
      });

      await Promise.all(promises);
      
      // Sync SRS quotas after saving goals (backend already does this, but this ensures it's current)
      try {
        await fetch(`${API_BASE_URL}/api/srs/sync-quotas-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        console.log('✓ SRS quotas synced after saving goals');
      } catch (syncError) {
        console.error('Failed to sync SRS quotas:', syncError);
        // Don't fail the whole operation if sync fails
      }
      
      Alert.alert('Success', 'Weekly goals saved! These goals will apply to all future weeks.');
      
      // Notify parent components that goals have been saved
      if (onGoalsSaved) {
        onGoalsSaved();
      }
    } catch (error) {
      console.error('Error saving weekly goals:', error);
      Alert.alert('Error', `Failed to save weekly goals: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getDayActivityCount = (day) => {
    let count = 0;
    Object.values(weeklyGoals[day] || {}).forEach(activities => {
      Object.values(activities).forEach(c => count += c);
    });
    return count;
  };

  const toggleLanguage = (langCode) => {
    setExpandedLanguages(prev => ({
      ...prev,
      [langCode]: !prev[langCode]
    }));
  };

  const getActivityCountForDay = (langCode, activity) => {
    if (!selectedDay) return 0;
    return weeklyGoals[selectedDay]?.[langCode]?.[activity] || 0;
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.header}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons 
            name={expanded ? "chevron-down" : "chevron-forward"} 
            size={20} 
            color="#666" 
            style={styles.chevron}
          />
          <Text style={styles.sectionTitle}>Weekly Goals</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Plan your language learning activities for the week
          </Text>

          {/* Week Grid */}
          <View style={styles.weekGrid}>
            {WEEKDAYS.map((day) => {
              const activityCount = getDayActivityCount(day);
              const hasGoals = activityCount > 0;
              const isDayExpanded = expandedDays[day];
              
              return (
                <View key={day} style={[styles.dayCard, !hasGoals && styles.dayCardEmpty]}>
                  {/* Day Header - Clickable to toggle expand/collapse */}
                  <TouchableOpacity
                    style={styles.dayHeader}
                    onPress={() => toggleDay(day)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayHeaderLeft}>
                      <Ionicons 
                        name={isDayExpanded ? "chevron-down" : "chevron-forward"} 
                        size={20} 
                        color="#666" 
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.dayName}>{WEEKDAY_LABELS[day]}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDayClick(day);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle" size={24} color="#4A90E2" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  
                  {/* Day Content - Only show if expanded */}
                  {isDayExpanded && (
                    hasGoals ? (
                      <View style={styles.dayGoals}>
                        {/* Group activities by language */}
                        {(() => {
                          const languageActivities = new Map();
                          
                          Object.entries(weeklyGoals[day] || {}).forEach(([lang, activities]) => {
                            if (!languageActivities.has(lang)) {
                              languageActivities.set(lang, new Map());
                            }
                            Object.entries(activities).forEach(([activity, count]) => {
                              languageActivities.get(lang).set(activity, count);
                            });
                          });
                          
                          // Define activity order (matches ACTIVITIES constant)
                          const activityOrder = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'translation', 'conversation'];
                          
                          return Array.from(languageActivities.entries()).map(([lang, activities]) => {
                            const language = LANGUAGES.find(l => l.code === lang);
                            
                            return (
                              <View key={lang} style={styles.languageCard}>
                                {/* Language icon on the left - Make it clickable */}
                                <TouchableOpacity 
                                  style={[styles.languageIconContainer, { backgroundColor: language?.color || '#4A90E2' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDayClick(day, lang);
                                  }}
                                  activeOpacity={0.7}
                                >
                                  {language?.nativeChar ? (
                                    <Text style={[
                                      styles.languageIcon,
                                      lang === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                                    ]}>
                                      {language.nativeChar}
                                    </Text>
                                  ) : (
                                    <Text style={styles.languageIconCode}>
                                      {language?.langCode?.toUpperCase()}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                                
                                {/* Activity icons in a row */}
                                <View style={styles.activityIconsRow}>
                                  {activityOrder.map((activity) => {
                                    const count = activities.get(activity);
                                    if (!count) return null;
                                    
                                    const colors = ACTIVITY_COLORS[activity];
                                    
                                    return (
                                      <View key={activity} style={styles.activityIconWrapper}>
                                        <View style={[styles.activityIconCircle, { backgroundColor: colors.light }]}>
                                          <Ionicons 
                                            name={activity === 'flashcards' ? 'albums' :
                                                  activity === 'reading' ? 'book' : 
                                                  activity === 'listening' ? 'headset' :
                                                  activity === 'writing' ? 'create' : 
                                                  activity === 'speaking' ? 'mic' : 
                                                  activity === 'translation' ? 'language' :
                                                  'chatbubbles'} 
                                            size={14} 
                                            color={colors.primary} 
                                          />
                                          {/* Count badge on top right */}
                                          <View style={styles.activityCountBadge}>
                                            <Text style={styles.countBadgeText}>{count}</Text>
                                          </View>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            );
                          });
                        })()}
                      </View>
                    ) : (
                      <View style={styles.emptyDay}>
                        <Ionicons name="add-circle-outline" size={32} color="#CCC" />
                        <Text style={styles.emptyText}>Tap + to add activities</Text>
                      </View>
                    )
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={saveGoals}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Weekly Goals'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Activity Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddModal(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Add Activity - {selectedDay ? WEEKDAY_LABELS[selectedDay] : ''}
                </Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={28} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {LANGUAGES.filter(l => l.active).map((lang) => {
                const isExpanded = expandedLanguages[lang.code];
                
                return (
                  <View key={lang.code} style={styles.languageSection}>
                    {/* Language Header - Clickable to expand/collapse */}
                    <TouchableOpacity 
                      style={styles.languageSectionHeader}
                      onPress={() => toggleLanguage(lang.code)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.languageHeaderLeft}>
                        <Ionicons 
                          name={isExpanded ? "chevron-down" : "chevron-forward"} 
                          size={20} 
                          color="#666" 
                        />
                        {/* Language Badge - Also clickable to toggle */}
                        <TouchableOpacity 
                          style={[styles.langBadge, { backgroundColor: lang.color }]}
                          onPress={() => toggleLanguage(lang.code)}
                          activeOpacity={0.7}
                        >
                          {lang.nativeChar ? (
                            <Text style={[
                              styles.langChar,
                              lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                            ]}>
                              {lang.nativeChar}
                            </Text>
                          ) : (
                            <Text style={styles.langCode}>{lang.langCode?.toUpperCase()}</Text>
                          )}
                        </TouchableOpacity>
                        <Text style={styles.langName}>{lang.name}</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Activities Grid - Only show if expanded */}
                    {isExpanded && (
                      <View style={styles.activitiesGrid}>
                        {ACTIVITIES.map((activity) => {
                          const colors = ACTIVITY_COLORS[activity];
                          const currentCount = getActivityCountForDay(lang.code, activity);
                          const isDisabled = activity === 'conversation';
                          
                          return (
                            <View
                              key={activity}
                              style={[
                                styles.activityButton, 
                                { borderColor: colors.primary },
                                isDisabled && styles.disabledActivityButton
                              ]}
                            >
                              <View style={styles.activityButtonContent}>
                                <View style={[
                                  styles.activityButtonIcon, 
                                  { backgroundColor: isDisabled ? '#E0E0E0' : colors.light }
                                ]}>
                                  <Ionicons 
                                    name={activity === 'flashcards' ? 'albums' :
                                          activity === 'reading' ? 'book' : 
                                          activity === 'listening' ? 'headset' :
                                          activity === 'writing' ? 'create' : 
                                          activity === 'speaking' ? 'mic' : 
                                          activity === 'translation' ? 'language' :
                                          'chatbubbles'} 
                                    size={20} 
                                    color={isDisabled ? '#999' : colors.primary} 
                                  />
                                  {currentCount > 0 && (
                                    <View style={[styles.activityCountBadge, { backgroundColor: colors.primary }]}>
                                      <Text style={styles.activityCountBadgeText}>{currentCount}</Text>
                                    </View>
                                  )}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Text style={[
                                    styles.activityButtonText,
                                    isDisabled && styles.disabledText
                                  ]}>
                                    {activity === 'flashcards' ? 'Flashcards (cards)' : activity.charAt(0).toUpperCase() + activity.slice(1)}
                                  </Text>
                                  {isDisabled && (
                                    <View style={styles.soonChip}>
                                      <Text style={styles.soonChipText}>Soon</Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              {!isDisabled && (
                                <View style={styles.activityButtonActions}>
                                  {activity === 'flashcards' ? (
                                    // Special input for flashcards - number of cards
                                    <TextInput
                                      style={[styles.flashcardInput, { borderColor: colors.primary, color: colors.primary }]}
                                      value={currentCount > 0 ? String(currentCount) : ''}
                                      placeholder="0"
                                      placeholderTextColor="#999"
                                      keyboardType="number-pad"
                                      onChangeText={(text) => setFlashcardCount(lang.code, text)}
                                      maxLength={3}
                                      onStartShouldSetResponder={() => true}
                                      onResponderTerminationRequest={() => false}
                                    />
                                  ) : (
                                    // Regular +/- buttons for other activities
                                    <>
                                      {currentCount > 0 && (
                                        <TouchableOpacity
                                          style={[styles.activityActionButton, { backgroundColor: colors.light }]}
                                          onPress={() => decreaseActivity(lang.code, activity)}
                                        >
                                          <Ionicons name="remove" size={20} color={colors.primary} />
                                        </TouchableOpacity>
                                      )}
                                      <TouchableOpacity
                                        style={[styles.activityActionButton, { backgroundColor: colors.light }]}
                                        onPress={() => addActivity(lang.code, activity)}
                                      >
                                        <Ionicons name="add" size={20} color={colors.primary} />
                                      </TouchableOpacity>
                                    </>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chevron: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  content: {
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  weekGrid: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  dayCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayCardEmpty: {
    borderStyle: 'dashed',
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addButton: {
    padding: 4,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  dayGoals: {
    gap: 6,
    marginTop: 12,
  },
  // New unified card design
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 8,
    gap: 10,
  },
  languageIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  languageIconCode: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  activityIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  activityIconWrapper: {
    position: 'relative',
  },
  activityIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 20,
    height: 14,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  emptyDay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  // Legacy badge styles (keep for backward compatibility)
  activityBadge: {
    borderRadius: 8,
    padding: 6,
    marginBottom: 4,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeChar: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  badgeCode: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  activityIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  countText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  modalScroll: {
    padding: 20,
  },
  languageSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 16,
  },
  languageSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  languageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  langBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginRight: 10,
  },
  langChar: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  langCode: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  langName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  activitiesGrid: {
    gap: 10,
    paddingLeft: 40,
  },
  activityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  activityButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityButtonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  activityCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  activityCountBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingHorizontal: 4,
  },
  activityButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  activityButtonActions: {
    flexDirection: 'row',
    gap: 8,
  },
  activityActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashcardInput: {
    width: 70,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  disabledActivityButton: {
    opacity: 0.5,
    backgroundColor: '#F5F5F5',
  },
  disabledText: {
    color: '#999',
  },
  soonChip: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  soonChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
