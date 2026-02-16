import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGES } from '../contexts/LanguageContext';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

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
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyOverviewSection({ expanded, onToggle }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);
  const dayCardRefs = useRef([]);
  const [shouldScrollToToday, setShouldScrollToToday] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [expandedDays, setExpandedDays] = useState({}); // Track which days are expanded

  useEffect(() => {
    if (expanded) {
      loadWeekData(weekOffset);
      // Reset scroll flag when opening
      if (weekOffset === 0) {
        setShouldScrollToToday(true);
      }
      // Initialize all days as expanded
      const initialExpandedState = {};
      for (let i = 0; i < 7; i++) {
        initialExpandedState[i] = true;
      }
      setExpandedDays(initialExpandedState);
    }
  }, [expanded, weekOffset]);

  // Scroll to today's card when it's laid out
  const handleTodayCardLayout = (event, dayIndex) => {
    if (shouldScrollToToday && weekOffset === 0 && scrollViewRef.current) {
      const today = new Date();
      const weekStart = new Date(weekData.week_start + 'T00:00:00');
      
      let currentDayIndex = -1;
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(weekStart);
        targetDate.setDate(targetDate.getDate() + i);
        if (today.toDateString() === targetDate.toDateString()) {
          currentDayIndex = i;
          break;
        }
      }
      
      if (dayIndex === currentDayIndex) {
        const { y } = event.nativeEvent.layout;
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: y - 20, // Scroll with a bit of padding from top
            animated: true,
          });
          setShouldScrollToToday(false);
        }, 100);
      }
    }
  };

  const loadWeekData = async (offset) => {
    setLoading(true);
    
    // Animate out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: offset > weekOffset ? 50 : -50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/week-overview?week_offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setWeekData(data);
        
        // Animate in
        slideAnim.setValue(offset > weekOffset ? -50 : 50);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00'); // Add time to ensure correct parsing
    const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
    return `${date.getMonth() + 1}/${date.getDate()}/${year}`;
  };

  const getWeekTitle = () => {
    if (!weekData) return '';
    if (weekOffset === 0) return 'This Week';
    return `Week of ${formatDate(weekData.week_start)}`;
  };

  const getDayProgress = (dayIndex) => {
    if (!weekData) return { goals: 0, completed: 0, allGoalsMet: false };
    
    const day = WEEKDAYS[dayIndex];
    const dateStr = getDateForDay(dayIndex);
    const dayGoals = weekData.goals[day] || {};
    const dayProgress = weekData.progress[dateStr] || {};
    
    let totalGoals = 0;
    let totalCompleted = 0;
    let allGoalsMet = true;
    
    // Check each language and activity
    Object.entries(dayGoals).forEach(([lang, activities]) => {
      Object.entries(activities).forEach(([activity, goalCount]) => {
        totalGoals += goalCount;
        const completedCount = dayProgress[lang]?.[activity] || 0;
        totalCompleted += completedCount;
        
        // If this activity has a goal but hasn't met it, mark as incomplete
        if (goalCount > 0 && completedCount < goalCount) {
          allGoalsMet = false;
        }
      });
    });
    
    // If there are no goals, it's not considered "all met"
    if (totalGoals === 0) {
      allGoalsMet = false;
    }
    
    return { goals: totalGoals, completed: totalCompleted, allGoalsMet };
  };

  const getDateForDay = (dayIndex) => {
    if (!weekData) return '';
    const weekStart = new Date(weekData.week_start + 'T00:00:00'); // Add time to ensure correct parsing
    const targetDate = new Date(weekStart);
    targetDate.setDate(targetDate.getDate() + dayIndex);
    return targetDate.toISOString().split('T')[0];
  };

  const isToday = (dayIndex) => {
    const today = new Date();
    const dateStr = getDateForDay(dayIndex);
    const targetDate = new Date(dateStr + 'T00:00:00');
    return today.toDateString() === targetDate.toDateString();
  };

  const toggleDayExpanded = (dayIndex) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayIndex]: !prev[dayIndex]
    }));
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
          <Text style={styles.sectionTitle}>Weekly Overview</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {/* Week Navigation */}
          <View style={styles.weekNavigation}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setWeekOffset(weekOffset - 1)}
            >
              <Ionicons name="chevron-back" size={24} color="#4A90E2" />
            </TouchableOpacity>
            
            <View style={styles.weekInfo}>
              <Text style={styles.weekTitle}>{getWeekTitle()}</Text>
              {weekData && (
                <Text style={styles.weekDates}>
                  {formatDate(weekData.week_start)} - {formatDate(weekData.week_end)}
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setWeekOffset(weekOffset + 1)}
              disabled={weekOffset >= 4}
            >
              <Ionicons 
                name="chevron-forward" 
                size={24} 
                color={weekOffset >= 4 ? '#CCC' : '#4A90E2'} 
              />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : weekData ? (
            <Animated.View 
              style={{
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              }}
            >
              <ScrollView 
                ref={scrollViewRef}
                style={styles.weekScroll} 
                showsVerticalScrollIndicator={false}
              >
                {WEEKDAYS.map((day, index) => {
                const { goals, completed, allGoalsMet } = getDayProgress(index);
                const isTodayDay = isToday(index);
                const isDayExpanded = expandedDays[index];
                const dateStr = getDateForDay(index);
                const dayProgress = weekData.progress[dateStr] || {};
                const hasActivities = Object.keys(dayProgress).length > 0;
                
                return (
                  <View 
                    key={day} 
                    style={[styles.dayRow, isTodayDay && styles.dayRowToday]}
                    onLayout={(event) => handleTodayCardLayout(event, index)}
                  >
                    <TouchableOpacity 
                      style={styles.dayHeader}
                      onPress={() => hasActivities && toggleDayExpanded(index)}
                      activeOpacity={hasActivities ? 0.7 : 1}
                    >
                      <View style={styles.dayHeaderLeft}>
                        {hasActivities && (
                          <Ionicons 
                            name={isDayExpanded ? "chevron-down" : "chevron-forward"} 
                            size={18} 
                            color="#666" 
                            style={{ marginRight: 8 }}
                          />
                        )}
                        <Text style={[styles.dayName, isTodayDay && styles.dayNameToday]}>
                          {WEEKDAY_SHORT[index]}
                        </Text>
                        <Text style={styles.dayDate}>{formatDate(getDateForDay(index))}</Text>
                        {isTodayDay && (
                          <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>Today</Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.dayProgress}>
                        {allGoalsMet && (
                          <Ionicons name="checkmark-circle" size={20} color="#50C878" />
                        )}
                      </View>
                    </TouchableOpacity>

                    {/* Expandable Activities Section */}
                    {isDayExpanded && hasActivities && (() => {
                      const dayGoals = weekData.goals[day] || {};
                      
                      // Group activities by language
                      const languageActivities = new Map();
                      
                      // Add activities from goals
                      Object.entries(dayGoals).forEach(([lang, activities]) => {
                        if (!languageActivities.has(lang)) {
                          languageActivities.set(lang, new Map());
                        }
                        Object.entries(activities).forEach(([activity, goalCount]) => {
                          languageActivities.get(lang).set(activity, { goalCount, completedCount: 0 });
                        });
                      });
                      
                      // Add activities from progress (even if no goal)
                      Object.entries(dayProgress).forEach(([lang, activities]) => {
                        if (!languageActivities.has(lang)) {
                          languageActivities.set(lang, new Map());
                        }
                        Object.entries(activities).forEach(([activity, completedCount]) => {
                          if (languageActivities.get(lang).has(activity)) {
                            languageActivities.get(lang).get(activity).completedCount = completedCount;
                          } else {
                            languageActivities.get(lang).set(activity, { goalCount: 0, completedCount });
                          }
                        });
                      });
                      
                      if (languageActivities.size === 0) return null;
                      
                      // Define activity order
                      const activityOrder = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'conversation'];
                      
                      return (
                        <View style={styles.dayActivities}>
                          {Array.from(languageActivities.entries()).map(([lang, activities]) => {
                            const language = LANGUAGES.find(l => l.code === lang);
                            
                            return (
                              <View key={lang} style={styles.languageCard}>
                                {/* Language icon on the left */}
                                <View style={[styles.languageIconContainer, { backgroundColor: language?.color || '#4A90E2' }]}>
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
                                </View>
                                
                                {/* Activity icons in a row */}
                                <View style={styles.activityIconsRow}>
                                  {activityOrder.map((activity) => {
                                    const activityData = activities.get(activity);
                                    if (!activityData) return null;
                                    
                                    const { goalCount, completedCount } = activityData;
                                    const colors = ACTIVITY_COLORS[activity];
                                    const isDone = goalCount > 0 && completedCount >= goalCount;
                                    
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
                                            size={16} 
                                            color={colors.primary} 
                                          />
                                          {/* Count badge on top right */}
                                          <View style={styles.activityCountBadge}>
                                            {goalCount > 0 ? (
                                              <>
                                                <Text style={[styles.countBadgeText, isDone && styles.countBadgeTextDone]}>
                                                  {completedCount}/{goalCount}
                                                </Text>
                                                {isDone && (
                                                  <View style={styles.checkmarkOverlay}>
                                                    <Ionicons name="checkmark" size={8} color="#50C878" />
                                                  </View>
                                                )}
                                              </>
                                            ) : (
                                              <Text style={styles.countBadgeTextNoGoal}>
                                                {completedCount}
                                              </Text>
                                            )}
                                          </View>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}
                  </View>
                );
              })}
              </ScrollView>
            </Animated.View>
          ) : null}
        </View>
      )}
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
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  navButton: {
    padding: 8,
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  weekDates: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
  },
  weekScroll: {
    maxHeight: 500,
  },
  dayRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dayRowToday: {
    borderColor: '#4A90E2',
    borderWidth: 2,
    backgroundColor: '#F0F7FF',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  dayNameToday: {
    color: '#4A90E2',
  },
  dayDate: {
    fontSize: 13,
    color: '#666',
  },
  todayBadge: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  noGoalsText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  dayActivities: {
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  // New unified card design
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 10,
    gap: 12,
  },
  languageIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  languageIconCode: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  activityIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activityIconWrapper: {
    position: 'relative',
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 24,
    height: 16,
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
  countBadgeTextDone: {
    color: '#50C878',
  },
  countBadgeTextNoGoal: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4A90E2', // Blue color for activities with no goal
  },
  checkmarkOverlay: {
    position: 'absolute',
    right: -2,
    top: -2,
  },
  // Legacy styles (keep for backward compatibility if needed)
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  langBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langChar: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  langCode: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  activityIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  activityRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activityCountDone: {
    color: '#50C878',
  },
  activityCountNoGoal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
  },
});
