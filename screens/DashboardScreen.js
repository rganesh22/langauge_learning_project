import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  PanResponder,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SafeText from '../components/SafeText';
import { LanguageContext, LANGUAGES } from '../contexts/LanguageContext';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

const ACTIVITY_ORDER = ['flashcards', 'reading', 'listening', 'writing', 'speaking', 'translation', 'conversation'];

const ACTIVITY_COLORS = {
  reading: { primary: '#4A90E2', light: '#E8F4FD' },
  listening: { primary: '#2B654A', light: '#E8F5EF' },
  writing: { primary: '#FF6B6B', light: '#FFE8E8' },
  speaking: { primary: '#FF9500', light: '#FFF4E6' },
  translation: { primary: '#8B5CF6', light: '#F3E8FF' },
  conversation: { primary: '#9B59B6', light: '#F4E6FF' },
  flashcards: { primary: '#14B8A6', light: '#E0F7F4' },
};

const LEVEL_COLORS = {
  'All': { bg: '#6C757D', text: '#FFFFFF' },
  'A1': { bg: '#FF4444', text: '#FFFFFF' },
  'A2': { bg: '#FFA500', text: '#FFFFFF' },
  'B1': { bg: '#50C878', text: '#FFFFFF' },
  'B2': { bg: '#14B8A6', text: '#FFFFFF' },
  'C1': { bg: '#4A90E2', text: '#FFFFFF' },
  'C2': { bg: '#9B59B6', text: '#FFFFFF' },
};

export default function DashboardScreen({ navigation }) {
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState({ level: 'A1', progress: 0 });
  const [progress, setProgress] = useState({});
  const [goals, setGoals] = useState({});
  const [loading, setLoading] = useState(true);
  const { selectedLanguage: ctxLanguage, setSelectedLanguage: setCtxLanguage } = useContext(LanguageContext);
  const selectedLanguage = ctxLanguage || 'kannada';
  const setSelectedLanguage = (l) => setCtxLanguage(l);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [weeklyGoalsExpanded, setWeeklyGoalsExpanded] = useState(true);
  const [allTodayGoals, setAllTodayGoals] = useState({});
  const [allTodayProgress, setAllTodayProgress] = useState({});
  const [expandedLanguages, setExpandedLanguages] = useState({});
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [weeklyActivityExpanded, setWeeklyActivityExpanded] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, 1 = last week, etc.
  const weeklyStatsCache = useRef({}); // Cache for weekly stats by offset
  const lastSrsSyncDate = useRef(null); // Track last SRS sync date
  
  // Day activities modal
  const [selectedDayActivities, setSelectedDayActivities] = useState(null);
  const [showDayActivitiesModal, setShowDayActivitiesModal] = useState(false);
  const [loadingDayActivities, setLoadingDayActivities] = useState(false);
  
  // Pan responder for swipe gestures
  const panX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 50; // Minimum swipe distance
        
        if (gestureState.dx > threshold) {
          // Swiped right - go to next week (more recent)
          if (weekOffset > 0) {
            Animated.timing(panX, {
              toValue: 300,
              duration: 150, // Faster animation
              useNativeDriver: true,
            }).start(() => {
              setWeekOffset(weekOffset - 1);
              panX.setValue(0);
            });
          } else {
            // Already at current week, bounce back
            Animated.spring(panX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 100,
              friction: 8,
            }).start();
          }
        } else if (gestureState.dx < -threshold) {
          // Swiped left - go to previous week (older)
          Animated.timing(panX, {
            toValue: -300,
            duration: 150, // Faster animation
            useNativeDriver: true,
          }).start(() => {
            setWeekOffset(weekOffset + 1);
            panX.setValue(0);
          });
        } else {
          // Not enough swipe distance, reset
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    loadDashboard();
    loadAllTodayGoals();
    loadWeeklyStats(weekOffset);
  }, [selectedLanguage, weekOffset]);

  // Reload data when screen comes into focus (e.g., returning from ProfileScreen)
  useFocusEffect(
    React.useCallback(() => {
      loadDashboard();
      loadAllTodayGoals();
      loadWeeklyStats(weekOffset);
      
      // Check if we need to sync SRS quotas (once per day)
      const today = new Date().toISOString().split('T')[0];
      
      if (lastSrsSyncDate.current !== today) {
        syncSrsQuotas();
        lastSrsSyncDate.current = today;
      }
    }, [selectedLanguage, weekOffset])
  );

  const syncSrsQuotas = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/sync-quotas-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        console.log('✓ SRS quotas synced (daily check)');
      }
    } catch (error) {
      console.error('Failed to sync SRS quotas:', error);
    }
  };

  const loadAllTodayGoals = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/today-goals-all`);
      if (response.ok) {
        const data = await response.json();
        setAllTodayGoals(data.goals || {});
        // Load progress for each language with goals
        await loadProgressForLanguages(Object.keys(data.goals || {}));
      }
    } catch (error) {
      console.error('Error loading today goals:', error);
    }
  };

  const loadProgressForLanguages = async (languages) => {
    try {
      const progressData = {};
      for (const lang of languages) {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/${lang}`);
        if (response.ok) {
          const data = await response.json();
          progressData[lang] = data.progress || {};
        }
      }
      setAllTodayProgress(progressData);
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const toggleLanguage = (langCode) => {
    setExpandedLanguages(prev => ({
      ...prev,
      [langCode]: !prev[langCode]
    }));
  };

  const loadWeeklyStats = async (offset = 0) => {
    // Check cache first for instant display
    if (weeklyStatsCache.current[offset]) {
      setWeeklyStats(weeklyStatsCache.current[offset]);
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/weekly-stats?days=7&offset=${offset * 7}`);
      if (response.ok) {
        const data = await response.json();
        const stats = data.stats || [];
        
        // Update cache
        weeklyStatsCache.current[offset] = stats;
        setWeeklyStats(stats);
        
        // Preload adjacent weeks for seamless navigation
        if (offset === 0 || !weeklyStatsCache.current[offset + 1]) {
          // Preload previous week (older)
          fetch(`${API_BASE_URL}/api/weekly-stats?days=7&offset=${(offset + 1) * 7}`)
            .then(res => res.json())
            .then(data => {
              weeklyStatsCache.current[offset + 1] = data.stats || [];
            })
            .catch(() => {});
        }
        
        if (offset > 0 && !weeklyStatsCache.current[offset - 1]) {
          // Preload next week (newer)
          fetch(`${API_BASE_URL}/api/weekly-stats?days=7&offset=${(offset - 1) * 7}`)
            .then(res => res.json())
            .then(data => {
              weeklyStatsCache.current[offset - 1] = data.stats || [];
            })
            .catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error loading weekly stats:', error);
    }
  };

  const loadDayActivities = async (date) => {
    setLoadingDayActivities(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/daily-activities?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDayActivities(data);
      } else {
        Alert.alert('Error', 'Failed to load activities for this day');
        setSelectedDayActivities(null);
      }
    } catch (error) {
      console.error('Error loading day activities:', error);
      Alert.alert('Error', 'Failed to load activities');
      setSelectedDayActivities(null);
    } finally {
      setLoadingDayActivities(false);
    }
  };

  const openDayActivities = (date, activityCount) => {
    if (activityCount > 0) {
      setShowDayActivitiesModal(true);
      loadDayActivities(date);
    }
  };

  const closeDayActivitiesModal = () => {
    setShowDayActivitiesModal(false);
    setSelectedDayActivities(null);
  };

  const openHistoricalActivity = (activityId, activityType) => {
    closeDayActivitiesModal();
    navigation.navigate('Activity', {
      activityId,
      activityType,
      fromHistory: true,
    });
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      console.log(`Loading dashboard for ${selectedLanguage}...`);
      const response = await fetch(`${API_BASE_URL}/api/dashboard/${selectedLanguage}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Dashboard API error (${response.status}):`, errorText);
        Alert.alert('Error', `Failed to load dashboard: ${errorText || 'Unknown error'}`);
        setLoading(false);
        return;
      }
      
      const data = await response.json();
      console.log('Dashboard data loaded:', data);
      
      // Load goal-based streak from dedicated endpoint
      try {
        const streakResponse = await fetch(`${API_BASE_URL}/api/streak`);
        if (streakResponse.ok) {
          const streakData = await streakResponse.json();
          setStreak(streakData.current_streak || 0);
        } else {
          // Fallback to old streak from profile if goal-based fails
          setStreak(data.streak || 0);
        }
      } catch (streakError) {
        console.warn('Failed to load goal-based streak, using profile streak:', streakError);
        setStreak(data.streak || 0);
      }
      
      setLevel(data.level || { level: 'A1', progress: 0 });
      setProgress(data.progress || {});
      setGoals(data.goals || {});
    } catch (error) {
      console.error('Error loading dashboard:', error);
      Alert.alert('Error', `Failed to load dashboard: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getProgressPercentage = (activity) => {
    const { completed = 0, target = goals[activity] || 1 } = progress[activity] || {};
    const finalTarget = target || goals[activity] || 1;
    return Math.min((completed / finalTarget) * 100, 100);
  };

  const startActivity = (activityType, language = null) => {
    const targetLanguage = language || selectedLanguage;
    // Switch language context if different
    if (language && language !== selectedLanguage) {
      setSelectedLanguage(language);
      setCtxLanguage(language);
    }
    navigation.navigate('Activity', {
      language: targetLanguage,
      activityType,
    });
  };

  const currentLanguage = LANGUAGES.find(l => l.code === selectedLanguage);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="language" size={24} color="#4A90E2" style={styles.appIcon} />
          <Text style={styles.appTitle}>Fluo</Text>
          <View style={[
            styles.streakChip,
            streak === 0 && styles.streakChipGrey
          ]}>
            <Ionicons name="flame" size={16} color={streak === 0 ? "#999" : "#FF6B6B"} />
            <Text style={[
              styles.streakChipText,
              streak === 0 && styles.streakChipTextGrey
            ]}>
              {streak} Day{streak !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Unified ScrollView for all content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Weekly Activity Graph */}
        {weeklyStats.length > 0 && (
          <View style={styles.weeklyGraphContainer}>
            <TouchableOpacity
              style={styles.graphHeader}
              onPress={() => setWeeklyActivityExpanded(!weeklyActivityExpanded)}
              activeOpacity={0.7}
            >
            <View style={styles.graphHeaderLeft}>
              <Ionicons 
                name={weeklyActivityExpanded ? "chevron-down" : "chevron-forward"} 
                size={20} 
                color="#666" 
                style={styles.graphChevron}
              />
              <Text style={styles.graphTitle}>
                {weekOffset === 0 ? 'Past Week Activity' : `${weekOffset} Week${weekOffset > 1 ? 's' : ''} Ago`}
              </Text>
            </View>
          </TouchableOpacity>
          
          {weeklyActivityExpanded && (
            <View style={styles.graphContent}>
              {/* Week Navigation */}
              <View style={styles.weekNavigation}>
                <TouchableOpacity 
                  style={styles.navButton}
                  onPress={() => setWeekOffset(weekOffset + 1)}
                >
                  <Ionicons name="chevron-back" size={24} color="#4A90E2" />
                </TouchableOpacity>
                
                {weekOffset > 0 && (
                  <TouchableOpacity 
                    style={styles.navButton}
                    onPress={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                  >
                    <Ionicons name="chevron-forward" size={24} color="#4A90E2" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Bar Graph */}
              <Animated.View 
                style={[
                  styles.barsContainer,
                  {
                    transform: [{ translateX: panX }]
                  }
                ]}
                {...panResponder.panHandlers}
              >
                {weeklyStats.map((day, index) => {
                  // Combine activities and lessons for total count
                  const totalCount = (day.activities || 0) + (day.lessons || 0);
                  const maxTotal = Math.max(...weeklyStats.map(d => (d.activities || 0) + (d.lessons || 0)), 1);
                  // Calculate height in pixels (max height = 100px)
                  const maxBarHeight = 100;
                  const barHeight = totalCount === 0 
                    ? 4 
                    : Math.max((totalCount / maxTotal) * maxBarHeight, 10);
                  const isToday = weekOffset === 0 && index === weeklyStats.length - 1;
                  
                  // Format date as M/D/YY (e.g., 1/2/26)
                  const date = new Date(day.date);
                  const month = date.getMonth() + 1; // No padding
                  const dayNum = date.getDate(); // No padding
                  const year = String(date.getFullYear()).slice(-2); // Last 2 digits
                  const dateLabel = `${month}/${dayNum}/${year}`;
                  
                  return (
                    <TouchableOpacity
                      key={day.date}
                      style={styles.barColumn}
                      onPress={() => openDayActivities(day.date, totalCount)}
                      disabled={totalCount === 0}
                      activeOpacity={0.7}
                    >
                      {/* Count bubble above bar */}
                      {totalCount > 0 && (
                        <View style={styles.countBubble}>
                          <Text style={styles.countBubbleText}>{totalCount}</Text>
                        </View>
                      )}
                      {/* Bar */}
                      <View 
                        style={[
                          styles.bar,
                          { 
                            height: barHeight,
                            backgroundColor: totalCount === 0 
                              ? '#E8E8E8' 
                              : (isToday ? '#4A90E2' : '#A8D5FF')
                          }
                        ]}
                      />
                      {/* Day label */}
                      <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>
                        {day.day}
                      </Text>
                      {/* Date label */}
                      <Text style={styles.dateLabel}>
                        {dateLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
              
              {/* Stats Summary */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#50C878" />
                  <Text style={styles.statValue}>
                    {weeklyStats.reduce((sum, day) => sum + (day.activities || 0), 0)}
                  </Text>
                  <Text style={styles.statLabel}>Activities</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="school" size={20} color="#F97316" />
                  <Text style={styles.statValue}>
                    {weeklyStats.reduce((sum, day) => sum + (day.lessons || 0), 0)}
                  </Text>
                  <Text style={styles.statLabel}>Lessons</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="book" size={20} color="#4A90E2" />
                  <Text style={styles.statValue}>
                    {weeklyStats.reduce((sum, day) => sum + (day.words || 0), 0)}
                  </Text>
                  <Text style={styles.statLabel}>Words</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

        {/* Today's Goals Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Today's Goals</Text>
          </View>

          {Object.keys(allTodayGoals).length === 0 ? (
            <View style={styles.noGoalsContainer}>
              <Ionicons name="calendar-outline" size={48} color="#CCC" />
              <Text style={styles.noGoalsText}>No goals set for today</Text>
              <Text style={styles.noGoalsSubtext}>
                Set up your weekly goals in the Profile tab
              </Text>
            </View>
          ) : (
            Object.entries(allTodayGoals).map(([lang, activities]) => {
              const language = LANGUAGES.find(l => l.code === lang);
              if (!language) return null;
              const isExpanded = expandedLanguages[lang];

              // Calculate summary statistics
              const langProgress = allTodayProgress[lang] || {};
              let totalCompleted = 0;
              let totalGoals = 0;
              const activitySummary = {};
              
              Object.entries(activities).forEach(([activity, goalCount]) => {
                const activityProgress = langProgress[activity] || {};
                const completed = activityProgress.completed || 0;
                totalCompleted += completed;
                totalGoals += goalCount;
                activitySummary[activity] = { completed, goalCount };
              });

              const allComplete = totalCompleted >= totalGoals && totalGoals > 0;

              return (
                <View key={lang} style={styles.languageGoalsSection}>
                  {/* Language Header - Clickable */}
                  <TouchableOpacity 
                    style={styles.languageGoalsHeader}
                    onPress={() => toggleLanguage(lang)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.languageHeaderContent}>
                      <Ionicons 
                        name={isExpanded ? "chevron-down" : "chevron-forward"} 
                        size={20} 
                        color="#666" 
                        style={styles.languageChevron}
                      />
                      <View style={[styles.countryCodeBox, { backgroundColor: language.color }]}>
                        {language.nativeChar ? (
                          <Text style={[
                            styles.nativeCharText,
                            lang === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                          ]}>{language.nativeChar}</Text>
                        ) : (
                          <SafeText style={styles.countryCodeText}>
                            {language.langCode?.toUpperCase()}
                          </SafeText>
                        )}
                      </View>
                      <Text style={styles.languageGoalsName}>{language.name}</Text>
                    </View>

                    {/* Activity Summary Chips */}
                    <View style={styles.activityChipsContainer}>
                      {ACTIVITY_ORDER
                        .filter(activity => activitySummary[activity])
                        .map((activity) => {
                          const { completed, goalCount } = activitySummary[activity];
                          const colors = ACTIVITY_COLORS[activity];
                          const isActivityComplete = completed >= goalCount;
                        
                        return (
                          <View 
                            key={activity}
                            style={[
                              styles.activityChip,
                              { backgroundColor: isActivityComplete ? '#E8F8F0' : colors.light }
                            ]}
                          >
                            <Ionicons 
                              name={
                                activity === 'reading' ? 'book' : 
                                activity === 'listening' ? 'headset' :
                                activity === 'writing' ? 'create' : 
                                activity === 'speaking' ? 'mic' : 
                                activity === 'translation' ? 'language' :
                                activity === 'conversation' ? 'chatbubbles' : 
                                'card'
                              } 
                              size={14} 
                              color={isActivityComplete ? '#50C878' : colors.primary} 
                            />
                            <Text style={[
                              styles.activityChipText,
                              { color: isActivityComplete ? '#50C878' : colors.primary }
                            ]}>
                              {completed}/{goalCount}
                            </Text>
                            {isActivityComplete && (
                              <Ionicons name="checkmark-circle" size={14} color="#50C878" />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </TouchableOpacity>

                  {/* Activity Cards - Only show if expanded */}
                  {isExpanded && ACTIVITY_ORDER
                    .filter(activity => activities[activity])
                    .map((activity) => {
                    const goalCount = activities[activity];
                    const colors = ACTIVITY_COLORS[activity];
                    const langProgress = allTodayProgress[lang] || {};
                    const activityProgress = langProgress[activity] || {};
                    const completed = activityProgress.completed || 0;
                    const percentage = Math.min((completed / goalCount) * 100, 100);
                    const isComplete = completed >= goalCount;

                    return (
                      <TouchableOpacity
                        key={activity}
                        style={[styles.goalCard, { borderLeftColor: colors.primary }]}
                        onPress={() => startActivity(activity, lang)}
                      >
                        <View style={styles.goalHeader}>
                              <View style={[styles.activityIcon, { backgroundColor: colors.light }]}>
                                <Ionicons 
                                  name={
                                    activity === 'reading' ? 'book' : 
                                    activity === 'listening' ? 'headset' :
                                    activity === 'writing' ? 'create' : 
                                    activity === 'speaking' ? 'mic' : 
                                    activity === 'translation' ? 'language' :
                                    activity === 'conversation' ? 'chatbubbles' : 
                                    'card'
                                  } 
                                  size={20} 
                                  color={colors.primary} 
                                />
                              </View>
                              <View style={styles.goalInfo}>
                                <Text style={styles.goalTitle}>
                                  {activity.charAt(0).toUpperCase() + activity.slice(1)}
                                </Text>
                                <SafeText style={styles.goalCount}>
                                  {String(completed)}/{String(goalCount)}
                                </SafeText>
                              </View>
                              {isComplete && (
                                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                              )}
                            </View>
                            <View style={styles.progressBarContainer}>
                              <View style={[styles.progressBarBg, { backgroundColor: colors.light }]}>
                                <View
                                  style={[
                                    styles.progressBarFill,
                                    { width: `${percentage}%`, backgroundColor: colors.primary },
                                  ]}
                                />
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                </View>
              );
            })
          )}
        </View>

      </ScrollView>

      {/* Day Activities Modal */}
      <Modal
        visible={showDayActivitiesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeDayActivitiesModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDayActivities?.date ? 
                  `Learning on ${new Date(selectedDayActivities.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}` : 
                  'Learning'
                }
              </Text>
              <TouchableOpacity onPress={closeDayActivitiesModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loadingDayActivities ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
              </View>
            ) : selectedDayActivities?.activities?.length > 0 ? (
              <ScrollView style={styles.modalScrollView}>
                {selectedDayActivities.activities.map((activity, index) => {
                  const activityType = activity.activity_type || activity.type;
                  const activityColors = {
                    reading: { primary: '#4A90E2', light: '#E8F4FD' },
                    listening: { primary: '#2B654A', light: '#E8F5EF' },
                    writing: { primary: '#FF6B6B', light: '#FFE8E8' },
                    speaking: { primary: '#FF9500', light: '#FFF4E6' },
                    translation: { primary: '#8B5CF6', light: '#F3E8FF' },
                    conversation: { primary: '#9B59B6', light: '#F4E6FF' },
                    flashcard: { primary: '#14B8A6', light: '#E0F7F4' },
                    lesson: { primary: '#F97316', light: '#FFF7ED' },  // Orange for lessons
                  };
                  const colors = activityColors[activityType] || { primary: '#666', light: '#F5F5F5' };
                  
                  // Get language info - check both code and langCode
                  const language = LANGUAGES.find(l => l.code === activity.language || l.langCode === activity.language);


                  return (
                    <TouchableOpacity
                      key={`${activity.id}-${index}`}
                      style={styles.historicalActivityCard}
                      onPress={() => {
                        if (activityType === 'lesson' && activity.lesson_id) {
                          closeDayActivitiesModal();
                          // Pass the full language code (e.g., 'malayalam') not just langCode ('ml')
                          const languageCode = language?.code || activity.language;
                          navigation.navigate('Lessons', { 
                            openLessonId: activity.lesson_id,
                            language: languageCode
                          });
                        } else if (activityType !== 'lesson') {
                          openHistoricalActivity(activity.id, activityType);
                        }
                      }}
                      disabled={activityType === 'lesson' && !activity.lesson_id}
                    >
                      {/* Language icon on the left */}
                      <View style={[styles.historicalLanguageIcon, { backgroundColor: language?.color || '#4A90E2' }]}>
                        {language?.nativeChar ? (
                          <Text style={[
                            styles.historicalLanguageChar,
                            activity.language === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                          ]}>
                            {language.nativeChar}
                          </Text>
                        ) : (
                          <Text style={styles.historicalLanguageCode}>
                            {language?.langCode?.toUpperCase() || 'EN'}
                          </Text>
                        )}
                      </View>
                      
                      {/* Activity info in the middle */}
                      <View style={styles.historicalActivityInfo}>
                        <Text style={styles.historicalActivityType}>
                          {activity.title || (activityType.charAt(0).toUpperCase() + activityType.slice(1))}
                        </Text>
                        <Text style={styles.historicalActivityTime}>
                          {new Date(activity.timestamp).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                          {activity.score !== undefined && ` • ${activity.score}%`}
                        </Text>
                      </View>
                      
                      {/* Activity icon on the right */}
                      <View style={[styles.historicalActivityIconCircle, { backgroundColor: colors.light }]}>
                        <Ionicons 
                          name={
                            activityType === 'reading' ? 'book' : 
                            activityType === 'listening' ? 'headset' :
                            activityType === 'writing' ? 'create' : 
                            activityType === 'speaking' ? 'mic' : 
                            activityType === 'translation' ? 'language' :
                            activityType === 'conversation' ? 'chatbubbles' : 
                            activityType === 'lesson' ? 'school' :
                            'albums'
                          } 
                          size={18} 
                          color={colors.primary} 
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.modalEmptyContainer}>
                <Ionicons name="calendar-outline" size={48} color="#CCC" />
                <Text style={styles.modalEmptyText}>No learning completed this day</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  appIcon: {
    marginRight: 8,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
    gap: 4,
  },
  streakChipGrey: {
    backgroundColor: '#F5F5F5',
  },
  streakChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  streakChipTextGrey: {
    color: '#999',
  },
  streakBanner: {
    backgroundColor: '#FFF5F5',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#FFE5E5',
    borderBottomColor: '#FFE5E5',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakTextContainer: {
    marginLeft: 12,
    alignItems: 'flex-start',
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6B6B',
    lineHeight: 32,
  },
  streakLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  weeklyGraphContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  graphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  graphHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  graphChevron: {
    marginRight: 8,
  },
  graphTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  graphContent: {
    gap: 20,
    marginTop: 12,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 150,
    gap: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    height: '100%',
  },
  bar: {
    width: '100%',
    maxHeight: 100,
    borderRadius: 6,
    minHeight: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  countBubble: {
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
    height: 24,
  },
  countBubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dayLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    marginTop: 4,
  },
  dateLabel: {
    fontSize: 9,
    color: '#BBB',
    fontWeight: '400',
    marginTop: 2,
  },
  todayLabel: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  navButtonText: {
    fontSize: 13,
    color: '#4A90E2',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  languageGoalsSection: {
    marginBottom: 16,
  },
  languageGoalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 8,
  },
  languageHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityChipsContainer: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginLeft: 8,
    maxWidth: '50%',
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    minWidth: '45%',
  },
  activityChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  languageChevron: {
    marginRight: 8,
  },
  countryCodeBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  languageGoalsName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  goalCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  activityButton: {
    width: '47%',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
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
    width: '80%',
    maxWidth: 300,
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
  noGoalsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noGoalsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  noGoalsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalScrollView: {
    padding: 16,
  },
  modalLoadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  activityCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  activityCardTime: {
    fontSize: 14,
    color: '#666',
  },
  activityCardScore: {
    fontSize: 12,
    color: '#4A90E2',
    marginTop: 2,
  },
  // New historical activity card styles (matches weekly goals design)
  historicalActivityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  historicalLanguageIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historicalLanguageChar: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  historicalLanguageCode: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  historicalActivityInfo: {
    flex: 1,
  },
  historicalActivityType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  historicalActivityTime: {
    fontSize: 13,
    color: '#666',
  },
  historicalActivityIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
