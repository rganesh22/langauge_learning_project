import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import WeeklyGoalsSection from '../components/WeeklyGoalsSection';
import WeeklyOverviewSection from '../components/WeeklyOverviewSection';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

const ACTIVITIES = ['reading', 'listening', 'writing', 'speaking', 'translation', 'conversation', 'flashcards'];
const ACTIVITY_COLORS = {
  reading: { primary: '#4A90E2', light: '#E8F4FD' },
  listening: { primary: '#2B654A', light: '#E8F5EF' },
  writing: { primary: '#FF6B6B', light: '#FFE8E8' },
  speaking: { primary: '#FF9500', light: '#FFF4E6' },
  translation: { primary: '#8B5CF6', light: '#F3E8FF' },
  conversation: { primary: '#9B59B6', light: '#F4E6FF' },
  flashcards: { primary: '#EC4899', light: '#FCE7F3' },
};

import { LANGUAGES, LanguageContext } from '../contexts/LanguageContext';

const LEVEL_COLORS = {
  'All': { bg: '#6C757D', text: '#FFFFFF' },
  'A0': { bg: '#6C757D', text: '#FFFFFF' },
  'A1': { bg: '#FF4444', text: '#FFFFFF' },
  'A2': { bg: '#FFA500', text: '#FFFFFF' },
  'B1': { bg: '#50C878', text: '#FFFFFF' },
  'B2': { bg: '#14B8A6', text: '#FFFFFF' },
  'C1': { bg: '#4A90E2', text: '#FFFFFF' },
  'C2': { bg: '#9B59B6', text: '#FFFFFF' },
};

// Contribution Graph Component (Swipeable Monthly Calendar)
const ContributionGraph = ({ data, viewType, language, navigation }) => {
  const SQUARE_SIZE = 10;
  const SQUARE_GAP = 3;
  const DAYS_PER_WEEK = 7;
  const MONTHS_TO_SHOW = 12; // Show 12 months
  
  const { width: SCREEN_WIDTH } = Dimensions.get('window');
  const scrollViewRef = useRef(null);
  
  // Start at current month (index 6 since we have 6 past months)
  const [currentMonthIndex, setCurrentMonthIndex] = useState(6);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayActivities, setDayActivities] = useState(null);
  const [loadingDayActivities, setLoadingDayActivities] = useState(false);
  
  // Sync scroll position when month index changes via buttons
  useEffect(() => {
    if (scrollViewRef.current) {
      const pageWidth = SCREEN_WIDTH - 40;
      scrollViewRef.current.scrollTo({ x: currentMonthIndex * pageWidth, animated: true });
    }
  }, [currentMonthIndex, SCREEN_WIDTH]);
  
  // Get intensity level for a day
  const getIntensity = (count) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
  };

  // Get color based on intensity
  const getColor = (intensity) => {
    const colors = [
      '#EBEDF0', // No activity
      '#9BE9A8', // Light green (1)
      '#40C463', // Medium green (2-3)
      '#30A14E', // Dark green (4-5)
      '#216E39', // Darkest green (6+)
    ];
    return colors[intensity] || colors[0];
  };

  // Organize data by months
  const organizeByMonths = () => {
    const months = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Show 6 months past, current month, and 6 months future (13 total, expandable)
    const PAST_MONTHS = 6;
    const FUTURE_MONTHS = 6;
    
    for (let monthOffset = -PAST_MONTHS; monthOffset <= FUTURE_MONTHS; monthOffset++) {
      const monthDate = new Date(today);
      monthDate.setMonth(monthDate.getMonth() + monthOffset);
      monthDate.setDate(1); // Start of month
      
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      // Get first day of week (0 = Sunday, 1 = Monday, etc.)
      const firstDayOfWeek = monthDate.getDay();
      // Adjust so Monday = 0, Tuesday = 1, ..., Sunday = 6
      const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
      
      // Get days in month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const weeks = [];
      let currentWeek = [];
      
      // Add empty cells for days before month starts (so first day aligns correctly)
      for (let i = 0; i < adjustedFirstDay; i++) {
        currentWeek.push(null);
      }
      
      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        // Create date string directly to avoid timezone issues
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const dayData = data[dateStr] || {};
        const count = viewType === 'activities' ? dayData.activities || 0 : dayData.words || 0;
        const intensity = getIntensity(count);
        
        currentWeek.push({
          date: dateStr,
          day,
          count,
          intensity,
        });
        
        // Start new week if we've filled 7 days
        if (currentWeek.length === DAYS_PER_WEEK) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
      
      // Add remaining days to last week
      if (currentWeek.length > 0) {
        // Fill remaining days with null
        while (currentWeek.length < DAYS_PER_WEEK) {
          currentWeek.push(null);
        }
        weeks.push(currentWeek);
      }
      
      months.push({
        year,
        month,
        monthName,
        weeks,
        isCurrentMonth: monthOffset === 0,
      });
    }
    
    return months;
  };

  const months = organizeByMonths();
  
  // Get today's date string for highlighting
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handleDayPress = async (day) => {
    if (day && day.count > 0) {
      setSelectedDay(day);
      setShowDayModal(true);
      setLoadingDayActivities(true);
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/daily-activities?date=${day.date}`);
        if (response.ok) {
          const data = await response.json();
          setDayActivities(data);
        } else {
          console.error('Failed to load day activities:', response.status);
          setDayActivities({ date: day.date, activities: [] });
        }
      } catch (error) {
        console.error('Error loading day activities:', error);
        setDayActivities({ date: day.date, activities: [] });
      } finally {
        setLoadingDayActivities(false);
      }
    }
  };

  const formatDate = (dateStr) => {
    // Parse date string as local date to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDateShort = (dateStr) => {
    // Parse date string as local date to avoid timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const openHistoricalActivity = (activityId, activityType) => {
    setShowDayModal(false);
    setTimeout(() => {
      navigation.navigate('Activity', {
        activityId,
        activityType,
        fromHistory: true,
      });
    }, 300);
  };

  return (
    <View style={styles.contributionGraph}>
      <Text style={styles.graphTitle}>
        {viewType === 'activities' ? 'Daily Activities' : 'Words Learned'} - {language}
      </Text>
      
      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity
          onPress={() => {
            const newIndex = Math.max(currentMonthIndex - 1, 0);
            setCurrentMonthIndex(newIndex);
          }}
          disabled={currentMonthIndex <= 0}
        >
          <Ionicons 
            name="chevron-back" 
            size={20} 
            color={currentMonthIndex <= 0 ? '#CCC' : '#666'} 
          />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{months[currentMonthIndex]?.monthName || ''}</Text>
        <TouchableOpacity
          onPress={() => {
            const newIndex = Math.min(currentMonthIndex + 1, months.length - 1);
            setCurrentMonthIndex(newIndex);
          }}
          disabled={currentMonthIndex >= months.length - 1}
        >
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={currentMonthIndex >= months.length - 1 ? '#CCC' : '#666'} 
          />
        </TouchableOpacity>
      </View>

      {/* Swipeable Calendar */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const pageWidth = SCREEN_WIDTH - 40;
          const pageIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
          setCurrentMonthIndex(pageIndex);
        }}
      >
        {months.map((monthData, monthIdx) => (
          <View key={monthIdx} style={[styles.monthView, { width: SCREEN_WIDTH - 40 }]}>
            <View style={styles.calendarHeader}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                <Text key={idx} style={styles.calendarDayLabel}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {monthData.weeks.map((week, weekIdx) => (
                <View key={weekIdx} style={styles.calendarWeek}>
                  {week.map((day, dayIdx) => {
                    const isToday = day && day.date === todayStr;
                    return (
                      <TouchableOpacity
                        key={dayIdx}
                        onPress={() => handleDayPress(day)}
                        disabled={!day}
                        style={styles.calendarDayContainer}
                      >
                        {day ? (
                          <View
                            style={[
                              styles.daySquare,
                              {
                                backgroundColor: getColor(day.intensity),
                                width: SQUARE_SIZE,
                                height: SQUARE_SIZE,
                              },
                              isToday && {
                                borderWidth: 2,
                                borderColor: '#4A90E2',
                                borderRadius: 2,
                              }
                            ]}
                          />
                        ) : (
                          <View style={{ width: SQUARE_SIZE, height: SQUARE_SIZE }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Legend */}
      <View style={styles.graphLegend}>
        <Text style={styles.legendText}>Less</Text>
        <View style={styles.legendSquares}>
          {[0, 1, 2, 3, 4].map((intensity) => (
            <View
              key={intensity}
              style={[
                styles.legendSquare,
                {
                  backgroundColor: getColor(intensity),
                  width: SQUARE_SIZE,
                  height: SQUARE_SIZE,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.legendText}>More</Text>
      </View>

      {/* Day Detail Modal */}
      <Modal
        visible={showDayModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dayModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDay ? formatDate(selectedDay.date) : 'Activities'}
              </Text>
              <TouchableOpacity onPress={() => setShowDayModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loadingDayActivities ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color="#4A90E2" />
              </View>
            ) : dayActivities?.activities?.length > 0 ? (
              <ScrollView style={styles.modalScrollView}>
                {dayActivities.activities.map((activity, index) => {
                  const activityType = activity.activity_type || activity.type;
                  const activityColors = {
                    reading: { primary: '#4A90E2', light: '#E8F4FD' },
                    listening: { primary: '#2B654A', light: '#E8F5EF' },
                    writing: { primary: '#FF6B6B', light: '#FFE8E8' },
                    speaking: { primary: '#FF9500', light: '#FFF4E6' },
                    translation: { primary: '#8B5CF6', light: '#F3E8FF' },
                    conversation: { primary: '#9B59B6', light: '#F4E6FF' },
                    flashcard: { primary: '#14B8A6', light: '#E0F7F4' },
                  };
                  const colors = activityColors[activityType] || { primary: '#666', light: '#F5F5F5' };
                  
                  // Get language info
                  const language = LANGUAGES.find(l => l.code === activity.language);

                  return (
                    <TouchableOpacity
                      key={`${activity.id}-${index}`}
                      style={styles.historicalActivityCard}
                      onPress={() => openHistoricalActivity(activity.id, activityType)}
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
                <Text style={styles.modalEmptyText}>No activities completed this day</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState({});
  const [level, setLevel] = useState({ level: 'A1', progress: 0, total_mastered: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Global language for goals, stats, and SRS settings
  const { selectedLanguage: ctxLanguage, setSelectedLanguage: setCtxLanguage, loadUserLanguages, availableLanguages } = React.useContext(LanguageContext);
  const [profileLanguage, setProfileLanguage] = useState(ctxLanguage || null);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [dailyStats, setDailyStats] = useState({});
  const [languageStats, setLanguageStats] = useState({});
  const [statsView, setStatsView] = useState('activities'); // 'activities' or 'words'
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [languagesExpanded, setLanguagesExpanded] = useState(true);
  
  // Goal-based streak state
  const [streakInfo, setStreakInfo] = useState({
    current_streak: 0,
    longest_streak: 0,
    today_complete: false
  });
  
  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  
  // SRS settings state - simplified with presets (user-wide, not per-language)
  const [srsSettings, setSrsSettings] = useState({});
  const [srsExpanded, setSrsExpanded] = useState(false);
  const [savingSrs, setSavingSrs] = useState(false);
  const [learningLoad, setLearningLoad] = useState('steady'); // 'chill', 'steady', 'sprint', 'custom'
  const [lapsePenalty, setLapsePenalty] = useState('gentle'); // 'gentle', 'strict', 'variable', 'custom'
  const [customDifficulty, setCustomDifficulty] = useState(5); // 1-10 scale for custom mode
  const [showAllValues, setShowAllValues] = useState(false); // Toggle to see all calculated values
  
  // New SRS configuration state (per-language)
  const [srsLanguage, setSrsLanguage] = useState(profileLanguage);
  const [newCardsPerWeek, setNewCardsPerWeek] = useState(10);
  const [reviewsPerWeek, setReviewsPerWeek] = useState(100);
  const [srsStats, setSrsStats] = useState({
    words_learning: 0,
    words_mastered: 0,
    reviews_due_today: 0
  });
  
  // SRS Simulator state
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorInterval, setSimulatorInterval] = useState(0);
  const [simulatorEase, setSimulatorEase] = useState(2.5);
  const [simulatorMultiplier, setSimulatorMultiplier] = useState(1.0);
  const [simulatorResults, setSimulatorResults] = useState(null);
  const [simulatingResponse, setSimulatingResponse] = useState(null);
  const [applyToAllLanguages, setApplyToAllLanguages] = useState(false);
  
  // Advanced SRS settings
  const [easeIncrement, setEaseIncrement] = useState(0.15);
  const [easeDecrement, setEaseDecrement] = useState(0.20);
  const [minEase, setMinEase] = useState(1.3);
  const [maxEase, setMaxEase] = useState(2.5);
  const [intervalMultiplier, setIntervalMultiplier] = useState(1.0); // New: controls review speed
  
  // Language-specific settings
  const [langSettingsExpanded, setLangSettingsExpanded] = useState(false);
  const [langSettingsLanguage, setLangSettingsLanguage] = useState(profileLanguage);
  const [defaultTransliterate, setDefaultTransliterate] = useState(true);
  const [savingLangSettings, setSavingLangSettings] = useState(false);
  const [applyLangSettingsToAll, setApplyLangSettingsToAll] = useState(false);
  
  // All languages SRS stats for language selector
  const [allLanguagesSrsStats, setAllLanguagesSrsStats] = useState({});

  // Load toggle preferences from database
  useEffect(() => {
    loadTogglePreferences();
  }, []);

  const loadTogglePreferences = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-preferences?keys=apply_to_all_srs,apply_to_all_lang`);
      if (response.ok) {
        const data = await response.json();
        if (data.apply_to_all_srs !== undefined) {
          setApplyToAllLanguages(data.apply_to_all_srs);
        }
        if (data.apply_to_all_lang !== undefined) {
          setApplyLangSettingsToAll(data.apply_to_all_lang);
        }
      }
    } catch (error) {
      console.error('Error loading toggle preferences:', error);
    }
  };

  const saveTogglePreference = async (key, value) => {
    try {
      await fetch(`${API_BASE_URL}/api/user-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (error) {
      console.error(`Error saving toggle preference ${key}:`, error);
    }
  };
  
  // Learning Load Presets
  const LEARNING_LOADS = {
    chill: {
      name: 'Chill',
      description: 'Perfect for casual learning',
      icon: 'cafe-outline',
      default_ease_factor: 2.8,
      ease_factor_increment: 0.2,
      newCardsPerDay: '5-10',
      reviewsPerDay: '15-25',
      color: '#50C878',
    },
    steady: {
      name: 'Steady',
      description: 'Balanced daily practice',
      icon: 'walk-outline',
      default_ease_factor: 2.5,
      ease_factor_increment: 0.15,
      newCardsPerDay: '10-20',
      reviewsPerDay: '30-50',
      color: '#4A90E2',
    },
    sprint: {
      name: 'Sprint',
      description: 'Intensive learning mode',
      icon: 'rocket-outline',
      default_ease_factor: 2.2,
      ease_factor_increment: 0.1,
      newCardsPerDay: '20-30',
      reviewsPerDay: '50-80',
      color: '#FF9500',
    },
    custom: {
      name: 'Custom',
      description: 'Set your own pace',
      icon: 'settings-outline',
      default_ease_factor: 2.5,
      ease_factor_increment: 0.15,
      newCardsPerDay: 'Variable',
      reviewsPerDay: 'Variable',
      color: '#9B59B6',
    },
  };
  
  // Lapse Penalty Presets
  const LAPSE_PENALTIES = {
    gentle: {
      name: 'Gentle',
      description: 'Forgiving when you forget',
      icon: 'heart-outline',
      ease_factor_decrement: 0.15,
      min_ease_factor: 1.5,
      resetInterval: 'Minimal',
    },
    strict: {
      name: 'Strict',
      description: 'Strong reinforcement',
      icon: 'shield-outline',
      ease_factor_decrement: 0.25,
      min_ease_factor: 1.2,
      resetInterval: 'Aggressive',
    },
    variable: {
      name: 'Variable',
      description: 'Adapts to difficulty',
      icon: 'pulse-outline',
      ease_factor_decrement: 0.2,
      min_ease_factor: 1.3,
      resetInterval: 'Moderate',
    },
    custom: {
      name: 'Custom',
      description: 'Fine-tune penalties',
      icon: 'options-outline',
      ease_factor_decrement: 0.2,
      min_ease_factor: 1.3,
      resetInterval: 'Variable',
    },
  };
  
  // Calculate expected metrics based on settings
  const getExpectedMetrics = () => {
    const load = LEARNING_LOADS[learningLoad];
    const penalty = LAPSE_PENALTIES[lapsePenalty];
    
    // For custom mode, calculate values based on difficulty slider (1-10)
    // Lower difficulty = easier (higher ease factors, more forgiving)
    // Higher difficulty = harder (lower ease factors, stricter)
    let easeFactor, minEase, easeIncrement, easeDecrement, newCards, reviews, retention;
    
    if (learningLoad === 'custom') {
      // Map difficulty 1-10 to ease factor 3.0-2.0 (inverse relationship)
      easeFactor = 3.0 - (customDifficulty - 1) * 0.111;
      easeIncrement = 0.25 - (customDifficulty - 1) * 0.0167;
      // Calculate new cards and reviews based on difficulty
      newCards = Math.round(5 + (customDifficulty - 1) * 2.78); // 5-30 range
      reviews = Math.round(15 + (customDifficulty - 1) * 7.22); // 15-80 range
      retention = customDifficulty <= 3 ? '85-90%' : customDifficulty <= 7 ? '80-85%' : '75-80%';
    } else {
      easeFactor = load.default_ease_factor;
      easeIncrement = load.ease_factor_increment;
      newCards = load.newCardsPerDay;
      reviews = load.reviewsPerDay;
      retention = learningLoad === 'chill' ? '85-90%' : learningLoad === 'steady' ? '80-85%' : '75-80%';
    }
    
    if (lapsePenalty === 'custom') {
      // Map difficulty to penalty (higher difficulty = stricter penalty)
      easeDecrement = 0.1 + (customDifficulty - 1) * 0.0167;
      minEase = 1.6 - (customDifficulty - 1) * 0.0444;
    } else {
      easeDecrement = penalty.ease_factor_decrement;
      minEase = penalty.min_ease_factor;
    }
    
    return {
      newCardsPerDay: typeof newCards === 'number' ? `${newCards}` : newCards,
      reviewsPerDay: typeof reviews === 'number' ? `${reviews}` : reviews,
      easeFactor: easeFactor.toFixed(2),
      minEase: minEase.toFixed(2),
      maxEase: '2.50',
      easeIncrement: easeIncrement.toFixed(2),
      easeDecrement: easeDecrement.toFixed(2),
      retentionRate: retention,
    };
  };
  
  // New Weekly Goals and Overview state
  const [weeklyGoalsExpanded, setWeeklyGoalsExpanded] = useState(false);
  const [weeklyOverviewExpanded, setWeeklyOverviewExpanded] = useState(false);
  const [weeklyOverviewKey, setWeeklyOverviewKey] = useState(0); // Key to force reload
  
  // Languages being learned
  const [learningLanguages, setLearningLanguages] = useState([]);
  
  // Language Personalization
  const [personalizationExpanded, setPersonalizationExpanded] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [savingLanguages, setSavingLanguages] = useState(false);
  const [languageSelectionModalVisible, setLanguageSelectionModalVisible] = useState(false);
  // Default language preference
  const [defaultLanguage, setDefaultLanguage] = useState(null);
  const [savingDefaultLanguage, setSavingDefaultLanguage] = useState(false);

  // Interests/Tags
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [interestsModalVisible, setInterestsModalVisible] = useState(false);
  const [savingInterests, setSavingInterests] = useState(false);

  // Predefined interests with icons
  const PREDEFINED_INTERESTS = [
    { name: 'Travel', icon: 'airplane' },
    { name: 'Food & Cooking', icon: 'restaurant' },
    { name: 'Music', icon: 'musical-notes' },
    { name: 'Movies & TV', icon: 'film' },
    { name: 'Sports', icon: 'football' },
    { name: 'Technology', icon: 'laptop' },
    { name: 'Art & Design', icon: 'brush' },
    { name: 'Literature', icon: 'book' },
    { name: 'History', icon: 'time' },
    { name: 'Science', icon: 'flask' },
    { name: 'Business', icon: 'briefcase' },
    { name: 'Politics', icon: 'megaphone' },
    { name: 'Fashion', icon: 'shirt' },
    { name: 'Photography', icon: 'camera' },
    { name: 'Gaming', icon: 'game-controller' },
    { name: 'Fitness & Health', icon: 'fitness' },
    { name: 'Nature & Environment', icon: 'leaf' },
    { name: 'Philosophy', icon: 'bulb' },
    { name: 'Religion & Spirituality', icon: 'star' },
    { name: 'Education', icon: 'school' },
    { name: 'Social Media', icon: 'share-social' },
    { name: 'Pets & Animals', icon: 'paw' },
    { name: 'Cars & Vehicles', icon: 'car' },
    { name: 'Architecture', icon: 'business' },
    { name: 'Dance', icon: 'body' },
    { name: 'Theater & Drama', icon: 'people' },
    { name: 'Comedy', icon: 'happy' },
    { name: 'News & Current Events', icon: 'newspaper' },
    { name: 'Economics', icon: 'trending-up' },
    { name: 'Psychology', icon: 'people-circle' }
  ];

  useEffect(() => {
    loadProfile();
    loadSelectedLanguages();
    loadDefaultLanguage();
    loadSelectedInterests();
    loadAllLanguagesSrsStats(); // Load SRS stats for all languages
    // Load SRS settings for current language on mount
    if (profileLanguage) {
      loadSrsSettings(profileLanguage);
      loadLangSettings(profileLanguage);
    }
  }, []);

  useEffect(() => {
    // Reload all data when global language changes
    if (profileLanguage) {
      // Reload level for the selected language
      fetch(`${API_BASE_URL}/api/dashboard/${profileLanguage}`)
        .then(res => res.json())
        .then(data => {
          setLevel(data.level || { level: 'A1', progress: 0, total_mastered: 0 });
        })
        .catch(err => console.error('Error loading level:', err));
      
      loadDailyStats(profileLanguage);
      loadLanguageStats(profileLanguage);
      loadSrsSettings(profileLanguage);
      loadLangSettings(profileLanguage);
      loadAllLanguagesSrsStats(); // Reload stats when language changes
    }
  }, [profileLanguage]);

  const loadLearningLanguages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/languages/learning`);
      if (!response.ok) {
        console.warn(`Learning languages endpoint returned ${response.status}`);
        setLearningLanguages([]);
        return;
      }
      const data = await response.json();
      setLearningLanguages(data.languages || []);
    } catch (error) {
      console.error('Error loading learning languages:', error);
      setLearningLanguages([]);
    }
  };

  const loadSelectedLanguages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-languages`);
      if (response.ok) {
        const data = await response.json();
        setSelectedLanguages(data.languages || []);
      } else {
        setSelectedLanguages([]);
      }
    } catch (error) {
      console.error('Error loading selected languages:', error);
      setSelectedLanguages([]);
    }
  };

  const loadDefaultLanguage = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-preferences?keys=default_language`);
      if (response.ok) {
        const data = await response.json();
        setDefaultLanguage(data.default_language || null);
      }
    } catch (error) {
      console.error('Error loading default language:', error);
    }
  };

  const saveDefaultLanguage = async (langCode) => {
    setSavingDefaultLanguage(true);
    try {
      await fetch(`${API_BASE_URL}/api/user-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_language: langCode }),
      });
      setDefaultLanguage(langCode);
      // Also switch the active language in context so the change is immediate
      setCtxLanguage(langCode);
    } catch (error) {
      console.error('Error saving default language:', error);
      Alert.alert('Error', 'Failed to save default language');
    } finally {
      setSavingDefaultLanguage(false);
    }
  };

  const toggleLanguageSelection = async (langCode) => {
    // List of available languages
    const availableLanguageCodes = ['tamil', 'telugu', 'kannada', 'malayalam', 'hindi', 'urdu'];
    
    // Check if trying to select an unavailable language
    if (!availableLanguageCodes.includes(langCode) && !selectedLanguages.includes(langCode)) {
      Alert.alert(
        'Coming Soon',
        'This language is not available yet, but will be in the future!',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const newSelection = selectedLanguages.includes(langCode)
      ? selectedLanguages.filter(code => code !== langCode)
      : [...selectedLanguages, langCode];
    
    // Capture the old selection now (before any async work) so we can revert on failure
    const previousSelection = [...selectedLanguages];

    // Update local state immediately for instant UI feedback
    setSelectedLanguages(newSelection);
    
    // Save to backend and then reload context + learningLanguages
    try {
      setSavingLanguages(true);
      const res = await fetch(`${API_BASE_URL}/api/user-languages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languages: newSelection })
      });
      if (!res.ok) throw new Error('Save failed');

      // Reload context (propagates to all screens via React context)
      await loadUserLanguages();
      // Reload the Languages section icons/levels on this screen
      await loadLearningLanguages();
    } catch (error) {
      console.error('Error saving language selection:', error);
      // Revert to old selection on failure
      setSelectedLanguages(previousSelection);
      Alert.alert('Error', 'Failed to save language selection');
    } finally {
      setSavingLanguages(false);
    }
  };

  const loadSelectedInterests = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-interests`);
      if (response.ok) {
        const data = await response.json();
        setSelectedInterests(data.interests || []);
      }
    } catch (error) {
      console.error('Error loading interests:', error);
      setSelectedInterests([]);
    }
  };

  const toggleInterestSelection = async (interest) => {
    const newSelection = selectedInterests.includes(interest)
      ? selectedInterests.filter(i => i !== interest)
      : [...selectedInterests, interest];
    
    setSelectedInterests(newSelection);
    await saveInterests(newSelection);
  };

  const addCustomInterest = async () => {
    const trimmedInterest = customInterestInput.trim();
    if (!trimmedInterest) return;
    
    if (selectedInterests.includes(trimmedInterest)) {
      Alert.alert('Already Added', 'This interest is already in your list.');
      return;
    }
    
    const newSelection = [...selectedInterests, trimmedInterest];
    setSelectedInterests(newSelection);
    setCustomInterestInput('');
    await saveInterests(newSelection);
  };

  const removeInterest = async (interest) => {
    const newSelection = selectedInterests.filter(i => i !== interest);
    setSelectedInterests(newSelection);
    await saveInterests(newSelection);
  };

  const saveInterests = async (interests) => {
    try {
      setSavingInterests(true);
      await fetch(`${API_BASE_URL}/api/user-interests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests })
      });
    } catch (error) {
      console.error('Error saving interests:', error);
      Alert.alert('Error', 'Failed to save interests');
    } finally {
      setSavingInterests(false);
    }
  };

  // Helper function to check if interest is custom (not in predefined list)
  const isCustomInterest = (interestName) => {
    return !PREDEFINED_INTERESTS.some(item => item.name === interestName);
  };

  // Helper function to get interest icon
  const getInterestIcon = (interestName) => {
    const predefined = PREDEFINED_INTERESTS.find(item => item.name === interestName);
    return predefined ? predefined.icon : 'add-circle';
  };

  const openHistoricalActivity = (activityId, activityType) => {
    setShowDayModal(false);
    setTimeout(() => {
      navigation.navigate('Activity', {
        activityId,
        activityType,
        fromHistory: true,
      });
    }, 300);
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [profileRes, dashboardRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/profile`),
        fetch(`${API_BASE_URL}/api/dashboard/${profileLanguage}`),
      ]);
      
      const profileData = await profileRes.json();
      const dashboardData = await dashboardRes.json();
      
      setProfile(profileData);
      setProfileName(profileData.name || 'Language Learner');
      setProfileUsername(profileData.username || '');
      setProfilePictureUrl(profileData.profile_picture_url || '');
      
      // Load languages being learned
      await loadLearningLanguages();
      
      // Load level for selected language
      const levelData = dashboardData.level || { level: 'A1', progress: 0, total_mastered: 0 };
      setLevel(levelData);
      
      // Load all data for the selected language
      await loadDailyStats(profileLanguage);
      await loadLanguageStats(profileLanguage);
      await loadSrsSettings(profileLanguage);
      
      // Load goal-based streak
      await loadStreak();
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStreak = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/streak`);
      if (!response.ok) {
        console.warn(`Streak endpoint returned ${response.status}`);
        return;
      }
      const data = await response.json();
      setStreakInfo({
        current_streak: data.current_streak || 0,
        longest_streak: data.longest_streak || 0,
        today_complete: data.today_complete || false
      });
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  };

  const loadSrsSettings = async (language) => {
    try {
      // Load SRS settings from new endpoint
      const settingsResponse = await fetch(`${API_BASE_URL}/api/srs/settings/${language}`);
      if (!settingsResponse.ok) {
        console.warn(`SRS settings endpoint returned ${settingsResponse.status}`);
        // Set defaults
        setNewCardsPerWeek(10);
        setReviewsPerWeek(100);
        setIntervalMultiplier(1.0);
      } else {
        const settingsData = await settingsResponse.json();
        setNewCardsPerWeek(settingsData.new_cards_per_day || 10);
        setReviewsPerWeek(settingsData.reviews_per_day || 100);
        setEaseIncrement(settingsData.ease_factor_increment || 0.15);
        setEaseDecrement(settingsData.ease_factor_decrement || 0.20);
        setMinEase(settingsData.min_ease_factor || 1.3);
        setMaxEase(settingsData.max_ease_factor || 2.5);
        setIntervalMultiplier(settingsData.interval_multiplier || 1.0);
      }
      
      // Load SRS stats for this language
      const statsResponse = await fetch(`${API_BASE_URL}/api/stats/language/${language}`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setSrsStats({
          words_learning: statsData.words_learning || 0,
          words_mastered: statsData.words_mastered || 0,
          reviews_due_today: statsData.reviews_due_today || 0
        });
      }
      
      setSrsLanguage(language);
    } catch (error) {
      console.error('Error loading SRS settings:', error);
      setNewCardsPerWeek(10);
      setReviewsPerWeek(100);
      setSrsStats({
        words_learning: 0,
        words_mastered: 0,
        reviews_due_today: 0
      });
    }
  };

  const loadLangSettings = async (language) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/language-personalization/${language}`);
      if (response.ok) {
        const data = await response.json();
        setDefaultTransliterate(data.default_transliterate !== false); // Default to true
      } else {
        setDefaultTransliterate(true);
      }
      setLangSettingsLanguage(language);
    } catch (error) {
      console.error('Error loading language settings:', error);
      setDefaultTransliterate(true);
    }
  };

  const saveLangSettings = async () => {
    setSavingLangSettings(true);
    try {
      if (applyLangSettingsToAll) {
        // Apply to all languages
        const promises = availableLanguages.map(lang =>
          fetch(`${API_BASE_URL}/api/language-personalization/${lang.code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ default_transliterate: defaultTransliterate }),
          })
        );
        await Promise.all(promises);
        Alert.alert('Success', 'Settings applied to all languages!');
      } else {
        // Apply to current language only
        const response = await fetch(`${API_BASE_URL}/api/language-personalization/${langSettingsLanguage}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ default_transliterate: defaultTransliterate }),
        });

        if (response.ok) {
          Alert.alert('Success', 'Language settings saved successfully!');
        } else {
          Alert.alert('Error', 'Failed to save language settings');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save language settings');
    } finally {
      setSavingLangSettings(false);
    }
  };

  const loadAllLanguagesSrsStats = async () => {
    try {
      console.log('[ProfileScreen] Loading SRS stats for all languages...');
      const statsPromises = availableLanguages.map(async (lang) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/srs/stats/${lang.code}`);
          if (response.ok) {
            const data = await response.json();
            console.log(`[ProfileScreen] Stats for ${lang.code}:`, data.new_count, 'new,', data.due_count, 'due');
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
      console.log('[ProfileScreen] All SRS stats loaded:', statsMap);
      setAllLanguagesSrsStats(statsMap);
    } catch (error) {
      console.error('Error loading all languages SRS stats:', error);
    }
  };

  const loadDailyStats = async (language) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats/daily?language=${language}&days=365`);
      if (!response.ok) {
        console.warn(`Daily stats endpoint returned ${response.status}`);
        setDailyStats({});
        return;
      }
      const data = await response.json();
      setDailyStats(data.stats || {});
    } catch (error) {
      console.error('Error loading daily stats:', error);
      setDailyStats({});
    }
  };

  const loadLanguageStats = async (language) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats/language/${language}`);
      if (!response.ok) {
        console.warn(`Language stats endpoint returned ${response.status}`);
        setLanguageStats({});
        return;
      }
      const data = await response.json();
      setLanguageStats(data);
    } catch (error) {
      console.error('Error loading language stats:', error);
      setLanguageStats({});
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const trimmedUrl = profilePictureUrl.trim();
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: profileName.trim() || 'Language Learner',
          username: profileUsername.trim() || null,
          profile_picture_url: trimmedUrl || null,
        }),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        setEditingProfile(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSrsSettings = async () => {
    // Validate: reviews_per_day must be >= 10 * new_cards_per_day
    const minReviews = newCardsPerWeek * 10;
    if (reviewsPerWeek < minReviews) {
      Alert.alert(
        'Invalid Settings',
        `Reviews per day must be at least ${minReviews} (10x new cards per day).\n\nThis ensures you have enough reviews to properly learn new words.`,
        [{ text: 'OK' }]
      );
      return;
    }
    
    setSavingSrs(true);
    try {
      // Determine which languages to update
      const languagesToUpdate = applyToAllLanguages 
        ? availableLanguages.map(lang => typeof lang === 'string' ? lang : lang.code)
        : [srsLanguage];
      
      console.log('Updating SRS settings for languages:', languagesToUpdate);
      
      // Update each language
      for (const lang of languagesToUpdate) {
        const response = await fetch(`${API_BASE_URL}/api/srs/settings/${lang}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            new_cards_per_day: newCardsPerWeek,
            reviews_per_day: reviewsPerWeek,
            ease_factor_increment: easeIncrement,
            ease_factor_decrement: easeDecrement,
            min_ease_factor: minEase,
            max_ease_factor: maxEase,
            interval_multiplier: intervalMultiplier
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `Failed to save settings for ${lang}`);
        }
      }
      
      const message = applyToAllLanguages 
        ? 'SRS settings updated for all languages!'
        : 'SRS settings updated successfully!';
      
      Alert.alert('Success', message);
      
      // Reload settings to confirm
      await loadSrsSettings(srsLanguage);
      
      // Reload SRS stats to update language selector chips
      await loadAllLanguagesSrsStats();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save SRS settings');
      console.error('Error saving SRS settings:', error);
    } finally {
      setSavingSrs(false);
    }
  };

  const handleGoalsSaved = () => {
    // Force WeeklyOverviewSection to reload by changing its key
    setWeeklyOverviewKey(prev => prev + 1);
  };

  const simulateSRSInterval = async (responseType) => {
    setSimulatingResponse(responseType);
    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_interval: simulatorInterval,
          ease_factor: simulatorEase,
          ease_increment: easeIncrement,
          ease_decrement: easeDecrement,
          min_ease: minEase,
          max_ease: maxEase,
          interval_multiplier: simulatorMultiplier
        }),
      });

      if (response.ok) {
        const results = await response.json();
        setSimulatorResults(results);
        
        // Update simulator state based on the response clicked
        const selectedResult = results[responseType];
        setSimulatorInterval(selectedResult.interval_days);
        setSimulatorEase(selectedResult.ease_factor);
      }
    } catch (error) {
      console.error('Error simulating SRS:', error);
      Alert.alert('Error', 'Failed to simulate SRS interval');
    } finally {
      setSimulatingResponse(null);
    }
  };

  const resetSimulator = () => {
    setSimulatorInterval(0);
    setSimulatorEase(2.5);
    setSimulatorMultiplier(1.0);
    setSimulatorResults(null);
    setSimulatingResponse(null);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            onPress={() => setEditingProfile(true)}
            style={styles.avatarTouchable}
          >
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color="#4A90E2" />
              </View>
            )}
            <View style={styles.editAvatarBadge}>
              <Ionicons name="camera" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
        {editingProfile ? (
          <View style={styles.profileEditContainer}>
            <TextInput
              style={styles.profileNameInput}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Display Name"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.profileNameInput}
              value={profileUsername}
              onChangeText={setProfileUsername}
              placeholder="Username (e.g., @learner123)"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.profileUrlInput}
              value={profilePictureUrl}
              onChangeText={setProfilePictureUrl}
              placeholder="Profile picture URL"
              placeholderTextColor="#999"
              keyboardType="url"
            />
            <View style={styles.profileEditButtons}>
              <TouchableOpacity
                style={[styles.profileEditButton, styles.cancelButton]}
                onPress={() => {
                  setEditingProfile(false);
                  setProfileName(profile.name || 'Language Learner');
                  setProfileUsername(profile.username || '');
                  setProfilePictureUrl(profile.profile_picture_url || '');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileEditButton, styles.saveProfileButton]}
                onPress={saveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveProfileButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.profileName}>{profileName}</Text>
            {profileUsername && (
              <Text style={styles.profileUsername}>@{profileUsername.replace(/^@/, '')}</Text>
            )}
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => setEditingProfile(true)}
            >
              <Ionicons name="create-outline" size={16} color="#4A90E2" />
              <Text style={styles.editProfileButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Languages Section */}
      <View style={styles.section}>
        {/* Collapsible Languages Header with Streak Chip */}
        <TouchableOpacity
          style={styles.statsCardHeader}
          onPress={() => setLanguagesExpanded(!languagesExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.statsCardHeaderLeft}>
            <Ionicons 
              name={languagesExpanded ? "chevron-down" : "chevron-forward"} 
              size={20} 
              color="#666" 
              style={styles.statsCardChevron}
            />
            <Text style={styles.sectionTitle}>Languages</Text>
          </View>
          <View style={styles.streakContainer}>
            <View style={[
              styles.streakChipSmall, 
              streakInfo.current_streak === 0 && styles.streakChipGrey
            ]}>
              <Ionicons name="flame" size={16} color={streakInfo.current_streak === 0 ? "#999" : "#FF6B6B"} />
              <Text style={[
                styles.streakChipSmallText,
                streakInfo.current_streak === 0 && styles.streakChipTextGrey
              ]}>
                {streakInfo.current_streak} Day{streakInfo.current_streak !== 1 ? 's' : ''}
              </Text>
            </View>
            {streakInfo.longest_streak > streakInfo.current_streak && (
              <Text style={styles.longestStreakText}>Best: {streakInfo.longest_streak}</Text>
            )}
          </View>
        </TouchableOpacity>
        
        {/* Language Chips with Levels - Collapsible */}
        {languagesExpanded && (
          <View style={styles.languagesCard}>
            {learningLanguages.length === 0 ? (
              <View style={styles.noLanguagesEmptyState}>
                <Ionicons name="language-outline" size={36} color="#C7D2FE" />
                <Text style={styles.noLanguagesEmptyTitle}>No languages added yet</Text>
                <Text style={styles.noLanguagesEmptySubtitle}>
                  Go to Learning Personalization below to pick the languages you want to learn.
                </Text>
              </View>
            ) : (
              <View style={styles.languageIconsGrid}>
                {learningLanguages
                  .sort((a, b) => {
                    // Sort by level: highest to lowest
                    const levelOrder = { 'C2': 7, 'C1': 6, 'B2': 5, 'B1': 4, 'A2': 3, 'A1': 2, 'A0': 1 };
                    return (levelOrder[b.level] || 0) - (levelOrder[a.level] || 0);
                  })
                  .map((item) => {
                    const lang = LANGUAGES.find(l => l.code === item.language);
                    if (!lang) return null;
                    
                    return (
                      <View key={lang.code} style={styles.languageIconWithLevel}>
                        <View style={[styles.languageIconLarge, { backgroundColor: lang.color }]}>
                          {lang.nativeChar ? (
                            <Text style={[
                              styles.languageIconChar,
                              lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                            ]}>{lang.nativeChar}</Text>
                          ) : (
                            <Text style={styles.languageIconCode}>{lang.langCode?.toUpperCase() || lang.countryCode}</Text>
                          )}
                        </View>
                        <View style={[styles.levelBadgeSmall, { backgroundColor: LEVEL_COLORS[item.level]?.bg || '#6C757D' }]}>
                          <Text style={styles.levelBadgeSmallText}>{item.level}</Text>
                        </View>
                      </View>
                    );
                  })}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Learning Personalization Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.statsCardHeader}
          onPress={() => setPersonalizationExpanded(!personalizationExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.statsCardHeaderLeft}>
            <Ionicons 
              name={personalizationExpanded ? "chevron-down" : "chevron-forward"} 
              size={20} 
              color="#666" 
              style={styles.statsCardChevron}
            />
            <Text style={styles.sectionTitle}>Learning Personalization</Text>
          </View>
        </TouchableOpacity>

        {personalizationExpanded && (
          <View style={styles.personalizationContent}>
            <Text style={styles.personalizationSubtitle}>Languages You're Learning</Text>

            {/* Selected Languages Display */}
            <View style={styles.selectedLanguagesPreview}>
              {selectedLanguages.length === 0 ? (
                <Text style={styles.noLanguagesText}>No languages selected yet</Text>
              ) : (
                selectedLanguages.map(code => {
                  const lang = LANGUAGES.find(l => l.code === code);
                  if (!lang) return null;
                  return (
                    <View key={code} style={styles.languagePreviewChip}>
                      <View style={[styles.languagePreviewIcon, { backgroundColor: lang.color }]}>
                        <Text style={styles.languagePreviewIconText}>
                          {lang.nativeChar || lang.langCode.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.languagePreviewName}>{lang.name}</Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Button to open language selection modal */}
            <TouchableOpacity
              style={styles.selectLanguagesButton}
              onPress={() => setLanguageSelectionModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={20} color="#4A90E2" />
              <Text style={styles.selectLanguagesButtonText}>
                {selectedLanguages.length === 0 ? 'Select Languages' : 'Manage Languages'}
              </Text>
            </TouchableOpacity>

            <View style={styles.selectionSummary}>
              <Ionicons name="globe-outline" size={20} color="#4A90E2" />
              <Text style={styles.selectionSummaryText}>
                {selectedLanguages.length} language{selectedLanguages.length !== 1 ? 's' : ''} selected
              </Text>
            </View>

            {/* Default Language Picker */}
            {selectedLanguages.length > 0 && (
              <>
                <View style={styles.personalizationDivider} />
                <Text style={styles.personalizationSubtitle}>Default Language</Text>
                <Text style={styles.personalizationDescription}>
                  This language opens automatically when you launch the app.
                </Text>
                <View style={styles.defaultLanguageRow}>
                  {selectedLanguages.map(code => {
                    const lang = LANGUAGES.find(l => l.code === code);
                    if (!lang) return null;
                    const isDefault = defaultLanguage === code || (!defaultLanguage && code === selectedLanguages[0]);
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[
                          styles.defaultLanguageChip,
                          isDefault && styles.defaultLanguageChipSelected,
                        ]}
                        onPress={() => saveDefaultLanguage(code)}
                        activeOpacity={0.7}
                        disabled={savingDefaultLanguage}
                      >
                        <View style={[styles.defaultLanguageIcon, { backgroundColor: lang.color }]}>
                          <Text style={[
                            styles.defaultLanguageIconText,
                            lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                          ]}>
                            {lang.nativeChar || lang.langCode.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[
                          styles.defaultLanguageChipText,
                          isDefault && styles.defaultLanguageChipTextSelected,
                        ]}>
                          {lang.name}
                        </Text>
                        {isDefault && (
                          <Ionicons name="checkmark-circle" size={18} color="#4A90E2" style={{ marginLeft: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Divider */}
            <View style={styles.personalizationDivider} />

            {/* Interests Section */}
            <Text style={styles.personalizationSubtitle}>My Interests</Text>
            <Text style={styles.personalizationDescription}>
              Select topics you're interested in to personalize your learning content.
            </Text>

            {/* Selected Interests Display */}
            <View style={styles.selectedInterestsPreview}>
              {selectedInterests.length === 0 ? (
                <Text style={styles.noLanguagesText}>No interests selected yet</Text>
              ) : (
                selectedInterests.map((interest, index) => {
                  const isCustom = isCustomInterest(interest);
                  return (
                    <View 
                      key={index} 
                      style={[
                        styles.interestChip,
                        isCustom && styles.interestChipCustom
                      ]}
                    >
                      <Ionicons 
                        name={getInterestIcon(interest)} 
                        size={16} 
                        color={isCustom ? "#8B5CF6" : "#4A90E2"} 
                      />
                      <Text style={[
                        styles.interestChipText,
                        isCustom && styles.interestChipTextCustom
                      ]}>{interest}</Text>
                      <TouchableOpacity
                        onPress={() => removeInterest(interest)}
                        style={styles.removeInterestButton}
                      >
                        <Ionicons name="close-circle" size={18} color="#999" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>

            {/* Button to open interests modal */}
            <TouchableOpacity
              style={styles.selectLanguagesButton}
              onPress={() => setInterestsModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="pricetag-outline" size={20} color="#4A90E2" />
              <Text style={styles.selectLanguagesButtonText}>
                {selectedInterests.length === 0 ? 'Add Interests' : 'Manage Interests'}
              </Text>
            </TouchableOpacity>

            <View style={styles.selectionSummary}>
              <Ionicons name="heart-outline" size={20} color="#4A90E2" />
              <Text style={styles.selectionSummaryText}>
                {selectedInterests.length} interest{selectedInterests.length !== 1 ? 's' : ''} selected
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Interests Selection Modal */}
      <Modal
        visible={interestsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setInterestsModalVisible(false)}
      >
        <View style={styles.languageModalOverlay}>
          <View style={styles.languageModalContainer}>
            {/* Modal Header */}
            <View style={styles.languageModalHeader}>
              <Text style={styles.languageModalTitle}>Manage Interests</Text>
              <TouchableOpacity
                onPress={() => setInterestsModalVisible(false)}
                style={styles.languageModalClose}
              >
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.languageModalList}>
              {/* Custom Interest Input */}
              <View style={styles.customInterestSection}>
                <Text style={styles.customInterestLabel}>Add Custom Interest</Text>
                <View style={styles.customInterestInputContainer}>
                  <TextInput
                    style={styles.customInterestInput}
                    placeholder="Type your interest..."
                    value={customInterestInput}
                    onChangeText={setCustomInterestInput}
                    onSubmitEditing={addCustomInterest}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.addCustomInterestButton}
                    onPress={addCustomInterest}
                    disabled={!customInterestInput.trim()}
                  >
                    <Ionicons 
                      name="add-circle" 
                      size={28} 
                      color={customInterestInput.trim() ? "#4A90E2" : "#CCC"} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Predefined Interests */}
              <Text style={styles.predefinedInterestsLabel}>Popular Interests</Text>
              <View style={styles.interestsGrid}>
                {PREDEFINED_INTERESTS.map((interestItem) => {
                  const isSelected = selectedInterests.includes(interestItem.name);
                  return (
                    <TouchableOpacity
                      key={interestItem.name}
                      style={[
                        styles.interestGridItem,
                        isSelected && styles.interestGridItemSelected
                      ]}
                      onPress={() => toggleInterestSelection(interestItem.name)}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={interestItem.icon} 
                        size={18} 
                        color={isSelected ? "#4A90E2" : "#666"} 
                        style={styles.interestGridIcon}
                      />
                      <Text style={[
                        styles.interestGridText,
                        isSelected && styles.interestGridTextSelected
                      ]}>
                        {interestItem.name}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={16} color="#4A90E2" style={styles.interestCheckmark} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Interests Section */}
              {selectedInterests.filter(interest => isCustomInterest(interest)).length > 0 && (
                <>
                  <Text style={styles.predefinedInterestsLabel}>Your Custom Interests</Text>
                  <View style={styles.interestsGrid}>
                    {selectedInterests.filter(interest => isCustomInterest(interest)).map((customInterest) => (
                      <TouchableOpacity
                        key={customInterest}
                        style={[styles.interestGridItem, styles.interestGridItemSelected, styles.interestGridItemCustom]}
                        onPress={() => toggleInterestSelection(customInterest)}
                        activeOpacity={0.7}
                      >
                        <Ionicons 
                          name="add-circle" 
                          size={18} 
                          color="#8B5CF6" 
                          style={styles.interestGridIcon}
                        />
                        <Text style={[styles.interestGridText, styles.interestGridTextCustom]}>
                          {customInterest}
                        </Text>
                        <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" style={styles.interestCheckmark} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            {savingInterests && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color="#4A90E2" />
                <Text style={styles.savingText}>Saving...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={languageSelectionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLanguageSelectionModalVisible(false)}
      >
        <View style={styles.languageModalOverlay}>
          <View style={styles.languageModalContainer}>
            {/* Modal Header */}
            <View style={styles.languageModalHeader}>
              <Text style={styles.languageModalTitle}>Manage Languages</Text>
              <TouchableOpacity
                onPress={() => setLanguageSelectionModalVisible(false)}
                style={styles.languageModalClose}
              >
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Language Grid by Family */}
            <ScrollView style={styles.languageModalList}>
              {/* Group languages by family */}
              {Object.entries(
                LANGUAGES.reduce((acc, lang) => {
                  if (!acc[lang.family]) acc[lang.family] = [];
                  acc[lang.family].push(lang);
                  return acc;
                }, {})
              ).map(([family, languages]) => {
                const availableLanguageCodes = ['tamil', 'telugu', 'kannada', 'malayalam', 'hindi', 'urdu'];
                
                return (
                  <View key={family} style={styles.familyGroup}>
                    <Text style={styles.familyHeader}>{family}</Text>
                    <View style={styles.languageGrid}>
                      {languages.map((lang) => {
                        const isSelected = selectedLanguages.includes(lang.code);
                        const isRTL = ['persian', 'arabic', 'urdu'].includes(lang.code);
                        const isAvailable = availableLanguageCodes.includes(lang.code);
                        
                        return (
                          <TouchableOpacity
                            key={lang.code}
                            style={[
                              styles.languageGridItem,
                              isSelected && styles.languageGridItemSelected,
                              !isAvailable && styles.languageGridItemDisabled
                            ]}
                            onPress={() => toggleLanguageSelection(lang.code)}
                            activeOpacity={0.7}
                          >
                            {!isAvailable && (
                              <View style={styles.comingSoonBadge}>
                                <Text style={styles.comingSoonText}>Soon</Text>
                              </View>
                            )}
                            {isSelected && (
                              <View style={styles.checkmarkBadge}>
                                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                              </View>
                            )}
                            <View style={[styles.languageGridIcon, { backgroundColor: lang.color }]}>
                              <Text style={[
                                styles.languageGridIconText,
                                lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' },
                                isRTL && { textAlign: 'left' }
                              ]}>
                                {lang.nativeChar || lang.langCode.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.languageGridName}>{lang.name}</Text>
                          <Text style={[
                            styles.languageGridNative,
                            lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' },
                            isRTL && { textAlign: 'left', writingDirection: 'rtl' }
                          ]}>
                            {lang.nativeName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
              })}
            </ScrollView>

            {savingLanguages && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color="#4A90E2" />
                <Text style={styles.savingText}>Saving...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Weekly Goals Section - NEW Enhanced UI */}
      <WeeklyGoalsSection 
        expanded={weeklyGoalsExpanded}
        onToggle={() => setWeeklyGoalsExpanded(!weeklyGoalsExpanded)}
        onGoalsSaved={handleGoalsSaved}
      />

      {/* Weekly Overview Section - NEW Tracker UI */}
      <WeeklyOverviewSection 
        key={weeklyOverviewKey}
        expanded={weeklyOverviewExpanded}
        onToggle={() => setWeeklyOverviewExpanded(!weeklyOverviewExpanded)}
      />

      {/* Language Specific Settings Divider */}
      <View style={styles.languageSettingsDivider}>
        <Text style={styles.dividerTitle}>Language Specific Settings</Text>
        <TouchableOpacity
          style={styles.languageSelectorCompact}
          onPress={() => setLanguageMenuVisible(true)}
        >
          {(() => {
            const currentLang = LANGUAGES.find(l => l.code === profileLanguage) || LANGUAGES[0];
            return (
              <>
                {(currentLang?.nativeChar || currentLang?.langCode) && (
                  <View style={[styles.countryCodeBoxCompact, { backgroundColor: currentLang?.color || '#F5F5F5' }]}>
                    {currentLang?.nativeChar ? (
                      <Text style={[
                        styles.nativeCharTextCompact,
                        currentLang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                      ]}>{currentLang.nativeChar}</Text>
                    ) : (
                      <Text style={styles.countryCodeTextCompact}>
                        {currentLang?.langCode?.toUpperCase()}
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.languageButtonContentCompact}>
                  <Text style={styles.languageNameCompact}>{currentLang?.name}</Text>
                  {currentLang?.nativeName && (
                    <Text style={[
                      styles.languageNativeNameCompact,
                      currentLang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}>{currentLang.nativeName}</Text>
                  )}
                </View>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </>
            );
          })()}
        </TouchableOpacity>
      </View>

      {/* Learning Progress - GitHub-style Contribution Graph */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.statsCardHeader}
          onPress={() => setStatsExpanded(!statsExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.statsCardHeaderLeft}>
            <Ionicons 
              name={statsExpanded ? "chevron-down" : "chevron-forward"} 
              size={20} 
              color="#666" 
              style={styles.statsCardChevron}
            />
            <Text style={styles.sectionTitle}>Learning Progress</Text>
            {/* Show current language icon */}
            {(() => {
              const currentLang = LANGUAGES.find(l => l.code === profileLanguage);
              if (!currentLang) return null;
              return (
                <View style={[styles.srsLanguageIconBox, { backgroundColor: currentLang.color }]}>
                  {currentLang.nativeChar ? (
                    <Text style={[
                      styles.srsLanguageIconText,
                      currentLang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}>
                      {currentLang.nativeChar}
                    </Text>
                  ) : (
                    <Text style={styles.srsLanguageIconText}>
                      {currentLang.langCode?.toUpperCase()}
                    </Text>
                  )}
                </View>
              );
            })()}
          </View>
        </TouchableOpacity>

        {statsExpanded && (
          <View style={styles.statsCardContent}>
            {/* Language Stats Summary */}
            {languageStats && Object.keys(languageStats).length > 0 && (
              <View style={styles.languageStatsSummary}>
                <View style={styles.languageStatItem}>
                  <Ionicons 
                    name="trophy" 
                    size={20} 
                    color={LEVEL_COLORS[level.level]?.bg || '#6C757D'} 
                  />
                  <Text style={styles.languageStatValue}>{level.level}</Text>
                  <Text style={styles.languageStatLabel}>Level</Text>
                </View>
                <View style={styles.languageStatItem}>
                  <Ionicons name="trending-up" size={20} color="#FF6B6B" />
                  <Text style={styles.languageStatValue}>
                    {level.progress !== undefined ? `${Math.round(level.progress)}%` : '0%'}
                  </Text>
                  <Text style={styles.languageStatLabel}>Progress</Text>
                </View>
                <View style={styles.languageStatItem}>
                  <Ionicons name="book" size={20} color="#4A90E2" />
                  <Text style={styles.languageStatValue}>{languageStats.total_activities || 0}</Text>
                  <Text style={styles.languageStatLabel}>Activities</Text>
                </View>
                <View style={styles.languageStatItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#50C878" />
                  <Text style={styles.languageStatValue}>{languageStats.words_mastered || 0}</Text>
                  <Text style={styles.languageStatLabel}>Words Mastered</Text>
                </View>
                <View style={styles.languageStatItem}>
                  <Ionicons name="school" size={20} color="#FF9500" />
                  <Text style={styles.languageStatValue}>{languageStats.words_learning || 0}</Text>
                  <Text style={styles.languageStatLabel}>Learning</Text>
                </View>
                <View style={styles.languageStatItem}>
                  <Ionicons name="star" size={20} color="#9B59B6" />
                  <Text style={styles.languageStatValue}>{languageStats.average_score || 0}%</Text>
                  <Text style={styles.languageStatLabel}>Avg Score</Text>
                </View>
              </View>
            )}

            {/* View Toggle */}
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleButton, statsView === 'activities' && styles.viewToggleButtonActive]}
                onPress={() => setStatsView('activities')}
              >
                <Text style={[styles.viewToggleText, statsView === 'activities' && styles.viewToggleTextActive]}>
                  Activities
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleButton, statsView === 'words' && styles.viewToggleButtonActive]}
                onPress={() => setStatsView('words')}
              >
                <Text style={[styles.viewToggleText, statsView === 'words' && styles.viewToggleTextActive]}>
                  Words Learned
                </Text>
              </TouchableOpacity>
            </View>

            {/* Contribution Graph */}
            <ContributionGraph 
              data={dailyStats} 
              viewType={statsView}
              language={LANGUAGES.find(l => l.code === profileLanguage)?.name || 'Kannada'}
              navigation={navigation}
            />
          </View>
        )}
      </View>

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
            <Text style={styles.menuTitle}>Select Language</Text>
            {availableLanguages.map((lang) => {
              const isSelected = profileLanguage === lang.code;
              const langStats = allLanguagesSrsStats[lang.code] || { new_count: 0, due_count: 0 };
              return (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  isSelected && styles.languageOptionSelected,
                ]}
                onPress={() => {
                  setProfileLanguage(lang.code);
                  setSrsLanguage(lang.code); // Update SRS language too
                  setCtxLanguage(lang.code); // Update global context
                  loadSrsSettings(lang.code); // Load SRS settings for new language
                  setLanguageMenuVisible(false);
                }}
              >
                {(lang.nativeChar || lang.langCode) && (
                  <View style={[styles.countryCodeBox, { backgroundColor: lang.color }]}>
                    {lang.nativeChar ? (
                      <Text style={[
                        styles.nativeCharText,
                        lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                      ]}>{lang.nativeChar}</Text>
                    ) : (
                      <Text style={styles.countryCodeText}>{lang.countryCode}</Text>
                    )}
                  </View>
                )}
                <View style={styles.languageOptionContent}>
                  <View style={styles.languageNameRow}>
                    <View>
                      <Text
                        style={[
                          styles.languageOptionText,
                          isSelected && styles.languageOptionTextSelected,
                        ]}
                      >
                        {lang.name}
                      </Text>
                      {lang.nativeName && (
                        <Text
                          style={[
                            styles.languageOptionNativeName,
                            isSelected && styles.languageOptionNativeNameSelected,
                            lang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' }
                          ]}
                        >
                          {lang.nativeName}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                {/* SRS Stats Chips - Right aligned, icon only */}
                <View style={styles.languageSrsChips}>
                  <View style={styles.languageSrsChipNew}>
                    <Ionicons name="add-circle" size={16} color="#5D8EDC" />
                    <Text style={styles.languageSrsChipTextNew}>
                      {langStats.new_count || 0}
                    </Text>
                  </View>
                  <View style={styles.languageSrsChipDue}>
                    <Ionicons name="alarm" size={16} color="#FF6B6B" />
                    <Text style={styles.languageSrsChipTextDue}>
                      {langStats.due_count || 0}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SRS Settings Section - Enhanced with Metrics */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.statsCardHeader}
          onPress={() => setSrsExpanded(!srsExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.statsCardHeaderLeft}>
            <Ionicons 
              name={srsExpanded ? "chevron-down" : "chevron-forward"} 
              size={20} 
              color="#666" 
              style={styles.statsCardChevron}
            />
            <Text style={styles.sectionTitle}>Review Scheduling</Text>
            {/* Show current language icon */}
            {(() => {
              const currentLang = LANGUAGES.find(l => l.code === srsLanguage);
              if (!currentLang) return null;
              return (
                <View style={[styles.srsLanguageIconBox, { backgroundColor: currentLang.color }]}>
                  {currentLang.nativeChar ? (
                    <Text style={[
                      styles.srsLanguageIconText,
                      currentLang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}>
                      {currentLang.nativeChar}
                    </Text>
                  ) : (
                    <Text style={styles.srsLanguageIconText}>
                      {currentLang.langCode?.toUpperCase()}
                    </Text>
                  )}
                </View>
              );
            })()}
          </View>
        </TouchableOpacity>

        {srsExpanded && (
          <View style={styles.srsSettingsContainer}>
            <Text style={styles.srsDescription}>
              Configure how many new words and reviews you want per day. Change language in Learning Progress above.
            </Text>

            {/* New Cards Per Day */}
            <View style={styles.srsSection}>
              <Text style={styles.srsSectionTitle}>New Cards Per Day</Text>
              <Text style={styles.srsSectionSubtitle}>
                How many new words to introduce each day
              </Text>
              <View style={styles.srsInputRow}>
                <TouchableOpacity
                  style={styles.srsAdjustButton}
                  onPress={() => {
                    const newValue = Math.max(1, newCardsPerWeek - 1);
                    setNewCardsPerWeek(newValue);
                    // Auto-adjust reviews if needed
                    const minReviews = newValue * 10;
                    if (reviewsPerWeek < minReviews) {
                      setReviewsPerWeek(minReviews);
                    }
                  }}
                >
                  <Ionicons name="remove" size={20} color="#4A90E2" />
                </TouchableOpacity>
                <TextInput
                  style={styles.srsInput}
                  value={newCardsPerWeek.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    const newValue = Math.max(0, num);
                    setNewCardsPerWeek(newValue);
                    // Auto-adjust reviews if needed
                    const minReviews = newValue * 10;
                    if (reviewsPerWeek < minReviews) {
                      setReviewsPerWeek(minReviews);
                    }
                  }}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={styles.srsAdjustButton}
                  onPress={() => {
                    const newValue = newCardsPerWeek + 1;
                    setNewCardsPerWeek(newValue);
                    // Auto-adjust reviews if needed
                    const minReviews = newValue * 10;
                    if (reviewsPerWeek < minReviews) {
                      setReviewsPerWeek(minReviews);
                    }
                  }}
                >
                  <Ionicons name="add" size={20} color="#4A90E2" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Reviews Per Day */}
            <View style={styles.srsSection}>
              <Text style={styles.srsSectionTitle}>Reviews Per Day</Text>
              <Text style={styles.srsSectionSubtitle}>
                How many review sessions each day
              </Text>
              <View style={styles.srsInputRow}>
                <TouchableOpacity
                  style={styles.srsAdjustButton}
                  onPress={() => {
                    const minReviews = newCardsPerWeek * 10;
                    setReviewsPerWeek(Math.max(minReviews, reviewsPerWeek - 5));
                  }}
                >
                  <Ionicons name="remove" size={20} color="#4A90E2" />
                </TouchableOpacity>
                <TextInput
                  style={styles.srsInput}
                  value={reviewsPerWeek.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    const minReviews = newCardsPerWeek * 10;
                    setReviewsPerWeek(Math.max(minReviews, num));
                  }}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={styles.srsAdjustButton}
                  onPress={() => setReviewsPerWeek(reviewsPerWeek + 5)}
                >
                  <Ionicons name="add" size={20} color="#4A90E2" />
                </TouchableOpacity>
              </View>
              <Text style={styles.srsValidationNote}>
                Minimum: {newCardsPerWeek * 10} (10x new cards per day)
              </Text>
            </View>

            {/* Review Speed Control */}
            <View style={styles.srsSection}>
              <Text style={styles.srsSectionTitle}>Review Speed</Text>
              <Text style={styles.srsSectionSubtitle}>
                Controls how quickly cards are re-scheduled (0.5x = slower, 2x = faster)
              </Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>0.5x</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0.5}
                  maximumValue={2.0}
                  step={0.1}
                  value={intervalMultiplier}
                  onValueChange={setIntervalMultiplier}
                  minimumTrackTintColor="#4A90E2"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#4A90E2"
                />
                <Text style={styles.sliderLabel}>2.0x</Text>
              </View>
              <Text style={styles.sliderValue}>
                Current: {intervalMultiplier.toFixed(1)}x
              </Text>
              <Text style={styles.srsValidationNote}>
                {intervalMultiplier < 0.8 
                  ? 'Slower: More frequent reviews (better retention)' 
                  : intervalMultiplier > 1.2 
                  ? 'Faster: Less frequent reviews (more new cards)' 
                  : 'Balanced: Standard spacing'}
              </Text>
            </View>

            {/* Current SRS Stats */}
            <View style={styles.srsStatsSection}>
              <Text style={styles.srsSectionTitle}>Current Progress</Text>
              <View style={styles.srsStatsGrid}>
                <View style={styles.srsStatCard}>
                  <Ionicons name="book-outline" size={24} color="#4A90E2" />
                  <Text style={styles.srsStatValue}>{srsStats.words_learning}</Text>
                  <Text style={styles.srsStatLabel}>Learning</Text>
                </View>
                <View style={styles.srsStatCard}>
                  <Ionicons name="checkmark-circle-outline" size={24} color="#50C878" />
                  <Text style={styles.srsStatValue}>{srsStats.words_mastered}</Text>
                  <Text style={styles.srsStatLabel}>Mastered</Text>
                </View>
                <View style={styles.srsStatCard}>
                  <Ionicons name="time-outline" size={24} color="#FF9500" />
                  <Text style={styles.srsStatValue}>{srsStats.reviews_due_today}</Text>
                  <Text style={styles.srsStatLabel}>Due Today</Text>
                </View>
              </View>
            </View>

            {/* SRS Simulator Button */}
            <TouchableOpacity
              style={styles.simulatorButton}
              onPress={() => {
                resetSimulator();
                setShowSimulator(true);
              }}
            >
              <Ionicons name="flask-outline" size={20} color="#9B59B6" />
              <Text style={styles.simulatorButtonText}>
                Test SRS Settings
              </Text>
              <Text style={styles.simulatorButtonSubtext}>
                Preview card scheduling
              </Text>
            </TouchableOpacity>

            {/* Apply to All Languages Toggle */}
            <TouchableOpacity
              style={styles.applyToAllContainer}
              onPress={() => {
                const newValue = !applyToAllLanguages;
                setApplyToAllLanguages(newValue);
                saveTogglePreference('apply_to_all_srs', newValue);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.applyToAllLeft}>
                <Ionicons 
                  name={applyToAllLanguages ? "checkmark-circle" : "ellipse-outline"} 
                  size={24} 
                  color={applyToAllLanguages ? "#4A90E2" : "#999"} 
                />
                <View style={styles.applyToAllTextContainer}>
                  <Text style={styles.applyToAllText}>
                    Apply to all languages
                  </Text>
                  <Text style={styles.applyToAllSubtext}>
                    Use the same settings for all languages you're learning
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, savingSrs && styles.saveButtonDisabled]}
              onPress={saveSrsSettings}
              disabled={savingSrs}
            >
              <Text style={styles.saveButtonText}>
                {savingSrs ? 'Saving...' : 'Save Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* SRS Simulator Modal */}
      <Modal
        visible={showSimulator}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSimulator(false)}
      >
        <View style={styles.simulatorModal}>
          <View style={styles.simulatorHeader}>
            <Text style={styles.simulatorTitle}>SRS Simulator</Text>
            <TouchableOpacity
              onPress={() => setShowSimulator(false)}
              style={styles.simulatorCloseButton}
            >
              <Ionicons name="close" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.simulatorContent}>
            <Text style={styles.simulatorDescription}>
              Test how your SRS settings affect card scheduling. Press buttons to see when you'll see the card next.
            </Text>

            {/* Current Card State */}
            <View style={styles.simulatorCardState}>
              <Text style={styles.simulatorCardStateTitle}>Current Card State</Text>
              <View style={styles.simulatorCardStateRow}>
                <View style={styles.simulatorCardStateBadge}>
                  <Text style={styles.simulatorCardStateLabel}>Interval</Text>
                  <Text style={styles.simulatorCardStateValue}>
                    {simulatorInterval === 0 ? 'New' : `${simulatorInterval} days`}
                  </Text>
                </View>
                <View style={styles.simulatorCardStateBadge}>
                  <Text style={styles.simulatorCardStateLabel}>Ease Factor</Text>
                  <Text style={styles.simulatorCardStateValue}>{simulatorEase.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {/* Interval Multiplier Control */}
            <View style={styles.simulatorSection}>
              <Text style={styles.simulatorSectionTitle}>Review Speed Multiplier</Text>
              <Text style={styles.simulatorSectionSubtitle}>
                Adjust to see how speed affects scheduling
              </Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>0.5x</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0.5}
                  maximumValue={2.0}
                  step={0.1}
                  value={simulatorMultiplier}
                  onValueChange={setSimulatorMultiplier}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#DDD"
                  thumbTintColor="#007AFF"
                />
                <Text style={styles.sliderLabel}>2.0x</Text>
              </View>
              <Text style={styles.sliderValue}>
                Current: {simulatorMultiplier.toFixed(1)}x
              </Text>
            </View>

            {/* Response Buttons */}
            <View style={styles.simulatorButtonsSection}>
              <Text style={styles.simulatorButtonsSectionTitle}>
                How well did you know this card?
              </Text>
              
              <TouchableOpacity
                style={[styles.simulatorResponseButton, styles.simulatorResponseAgain]}
                onPress={() => simulateSRSInterval('again')}
                disabled={simulatingResponse !== null}
              >
                <View style={styles.simulatorResponseButtonContent}>
                  <Text style={styles.simulatorResponseButtonTitle}>Again</Text>
                  <Text style={styles.simulatorResponseButtonSubtitle}>Didn't remember</Text>
                  {simulatorResults && (
                    <View style={styles.simulatorResponseResult}>
                      <Ionicons name="time-outline" size={16} color="#FF6B6B" />
                      <Text style={styles.simulatorResponseResultText}>
                        {simulatorResults.again.next_review_relative}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simulatorResponseButton, styles.simulatorResponseHard]}
                onPress={() => simulateSRSInterval('hard')}
                disabled={simulatingResponse !== null}
              >
                <View style={styles.simulatorResponseButtonContent}>
                  <Text style={styles.simulatorResponseButtonTitle}>Hard</Text>
                  <Text style={styles.simulatorResponseButtonSubtitle}>Difficult to recall</Text>
                  {simulatorResults && (
                    <View style={styles.simulatorResponseResult}>
                      <Ionicons name="time-outline" size={16} color="#FF9500" />
                      <Text style={styles.simulatorResponseResultText}>
                        {simulatorResults.hard.next_review_relative}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simulatorResponseButton, styles.simulatorResponseGood]}
                onPress={() => simulateSRSInterval('good')}
                disabled={simulatingResponse !== null}
              >
                <View style={styles.simulatorResponseButtonContent}>
                  <Text style={styles.simulatorResponseButtonTitle}>Good</Text>
                  <Text style={styles.simulatorResponseButtonSubtitle}>Correct with effort</Text>
                  {simulatorResults && (
                    <View style={styles.simulatorResponseResult}>
                      <Ionicons name="time-outline" size={16} color="#4A90E2" />
                      <Text style={styles.simulatorResponseResultText}>
                        {simulatorResults.good.next_review_relative}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simulatorResponseButton, styles.simulatorResponseEasy]}
                onPress={() => simulateSRSInterval('easy')}
                disabled={simulatingResponse !== null}
              >
                <View style={styles.simulatorResponseButtonContent}>
                  <Text style={styles.simulatorResponseButtonTitle}>Easy</Text>
                  <Text style={styles.simulatorResponseButtonSubtitle}>Very easy to recall</Text>
                  {simulatorResults && (
                    <View style={styles.simulatorResponseResult}>
                      <Ionicons name="time-outline" size={16} color="#50C878" />
                      <Text style={styles.simulatorResponseResultText}>
                        {simulatorResults.easy.next_review_relative}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {simulatorResults && (
              <View style={styles.simulatorTip}>
                <Ionicons name="information-circle-outline" size={20} color="#4A90E2" />
                <Text style={styles.simulatorTipText}>
                  Keep pressing buttons to see how cards progress through the system
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.simulatorResetButton}
              onPress={resetSimulator}
            >
              <Ionicons name="refresh-outline" size={20} color="#666" />
              <Text style={styles.simulatorResetButtonText}>Reset to New Card</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Language Settings Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.statsCardHeader}
          onPress={() => setLangSettingsExpanded(!langSettingsExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.statsCardHeaderLeft}>
            <Ionicons 
              name={langSettingsExpanded ? "chevron-down" : "chevron-forward"} 
              size={20} 
              color="#666" 
              style={styles.statsCardChevron}
            />
            <Text style={styles.sectionTitle}>Language Settings</Text>
            {/* Show current language icon */}
            {(() => {
              const currentLang = LANGUAGES.find(l => l.code === langSettingsLanguage);
              if (!currentLang) return null;
              return (
                <View style={[styles.srsLanguageIconBox, { backgroundColor: currentLang.color }]}>
                  {currentLang.nativeChar ? (
                    <Text style={[
                      styles.srsLanguageIconText,
                      currentLang.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                    ]}>
                      {currentLang.nativeChar}
                    </Text>
                  ) : (
                    <Text style={styles.srsLanguageIconText}>
                      {currentLang.langCode?.toUpperCase()}
                    </Text>
                  )}
                </View>
              );
            })()}
          </View>
        </TouchableOpacity>

        {langSettingsExpanded && (
          <View style={styles.srsSettingsContainer}>
            <Text style={styles.srsDescription}>
              Configure per-language settings. These preferences will apply to all activities for {LANGUAGES.find(l => l.code === langSettingsLanguage)?.name}.
            </Text>

            {/* Default Transliteration Setting */}
            <View style={styles.srsSection}>
              <Text style={styles.srsSectionTitle}>Default Transliteration</Text>
              <Text style={styles.srsSectionSubtitle}>
                Show transliterations by default in activities
              </Text>
              
              <TouchableOpacity
                style={styles.applyToAllContainer}
                onPress={() => setDefaultTransliterate(!defaultTransliterate)}
                activeOpacity={0.7}
              >
                <View style={styles.applyToAllLeft}>
                  <Ionicons 
                    name={defaultTransliterate ? "checkmark-circle" : "ellipse-outline"} 
                    size={24} 
                    color={defaultTransliterate ? "#4A90E2" : "#999"} 
                  />
                  <View style={styles.applyToAllTextContainer}>
                    <Text style={styles.applyToAllText}>
                      Show transliterations
                    </Text>
                    <Text style={styles.applyToAllSubtext}>
                      {defaultTransliterate ? 
                        'Transliterations will be visible when activities open' : 
                        'Transliterations will be hidden when activities open'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Apply to All Languages Toggle */}
            <TouchableOpacity
              style={styles.applyToAllContainer}
              onPress={() => {
                const newValue = !applyLangSettingsToAll;
                setApplyLangSettingsToAll(newValue);
                saveTogglePreference('apply_to_all_lang', newValue);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.applyToAllLeft}>
                <Ionicons 
                  name={applyLangSettingsToAll ? "checkmark-circle" : "ellipse-outline"} 
                  size={24} 
                  color={applyLangSettingsToAll ? "#4A90E2" : "#999"} 
                />
                <View style={styles.applyToAllTextContainer}>
                  <Text style={styles.applyToAllText}>
                    Apply to all languages
                  </Text>
                  <Text style={styles.applyToAllSubtext}>
                    Use the same settings for all languages you're learning
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, savingLangSettings && styles.saveButtonDisabled]}
              onPress={saveLangSettings}
              disabled={savingLangSettings}
            >
              <Text style={styles.saveButtonText}>
                {savingLangSettings ? 'Saving...' : 'Save Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4A90E2',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  profileSubtext: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  goalsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  goalsCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  goalsCardChevron: {
    marginRight: 8,
  },
  goalsCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  languageSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
    marginRight: 4,
  },
  countryCodeBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  nativeCharText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  countryCodeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  goalsCardContent: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  statsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  levelDisplay: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  levelDisplayContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelDisplayText: {
    marginLeft: 16,
  },
  levelDisplayLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  levelDisplayValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  goalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  goalLabel: {
    flex: 1,
  },
  goalLabelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  goalLabelSubtext: {
    fontSize: 12,
    color: '#666',
  },
  goalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalInput: {
    width: 50,
    height: 36,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  saveButton: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#999',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F8F8',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    marginLeft: 12,
    lineHeight: 20,
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
    marginLeft: 12,
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
  languageOptionText: {
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
  statsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statsCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statsCardChevron: {
    marginRight: 8,
  },
  statsCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsCardContent: {
    marginTop: 12,
  },
  statsLanguageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  statsLanguageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 6,
    marginRight: 4,
  },
  countryCodeBoxSmall: {
    width: 24,
    height: 24,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeCharTextSmall: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  languageStatsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 16,
  },
  languageStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  languageStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 4,
  },
  languageStatLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewToggleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  viewToggleTextActive: {
    color: '#4A90E2',
  },
  contributionGraph: {
    marginTop: 8,
  },
  graphTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  graphContainer: {
    flexDirection: 'row',
  },
  weekLabels: {
    width: 30,
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  weekLabel: {
    fontSize: 10,
    color: '#666',
    height: 13,
  },
  graphGrid: {
    flexDirection: 'row',
    paddingLeft: 8,
  },
  weekColumn: {
    marginRight: 3,
  },
  daySquare: {
    borderRadius: 2,
  },
  graphLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingRight: 8,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
    marginHorizontal: 4,
  },
  legendSquares: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginHorizontal: 4,
  },
  legendSquare: {
    borderRadius: 2,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  monthView: {
    paddingHorizontal: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarDayLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    width: 35,
    textAlign: 'center',
  },
  calendarGrid: {
    marginTop: 4,
  },
  calendarWeek: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 3,
  },
  calendarDayContainer: {
    width: 35,
    height: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayModalContent: {
    backgroundColor: '#FFFFFF',
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
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
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
  dayModalDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  dayModalTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  dayModalCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 20,
  },
  dayModalCloseButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dayModalCloseText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  srsTooltipContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  srsTooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  srsTooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  srsTooltipCloseButton: {
    padding: 4,
    marginLeft: 12,
  },
  srsTooltipDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
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
  languageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  languageNativeName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  avatarTouchable: {
    position: 'relative',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#4A90E2',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileEditContainer: {
    width: '100%',
    alignItems: 'center',
  },
  profileNameInput: {
    width: '100%',
    maxWidth: 300,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#4A90E2',
    paddingVertical: 8,
    marginBottom: 12,
  },
  profileUrlInput: {
    width: '100%',
    maxWidth: 300,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  profileEditButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  profileEditButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveProfileButton: {
    backgroundColor: '#4A90E2',
  },
  saveProfileButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
    marginLeft: 6,
  },
  srsSettingsContainer: {
    marginTop: 12,
  },
  srsDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  srsSection: {
    marginBottom: 28,
  },
  srsSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  srsSectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  srsOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  srsOptionCard: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '48%',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  srsOptionCardActive: {
    backgroundColor: '#F0F7FF',
    borderWidth: 2,
  },
  srsOptionHeader: {
    position: 'relative',
    marginBottom: 10,
  },
  srsOptionCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  srsOptionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  srsOptionDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 14,
  },
  customControlsContainer: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  customControl: {
    marginBottom: 12,
  },
  customControlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  customControlSubLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 14,
  },
  customControlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  customControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  difficultyDisplayContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  customControlValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4A90E2',
    textAlign: 'center',
  },
  difficultyLabelText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  difficultyScale: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  difficultyScaleBar: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  difficultyScaleBarActive: {
    backgroundColor: '#4A90E2',
  },
  showAllValuesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  showAllValuesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
  },
  allValuesContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  valueLabel: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 12,
  },
  allValuesNote: {
    fontSize: 11,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  metricsContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  metricsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 6,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  srsApplyNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  srsLanguageSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  srsLanguageChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8F8F8',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  srsLanguageChipActive: {
    backgroundColor: '#E8F4FD',
    borderColor: '#4A90E2',
  },
  srsLanguageChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  srsLanguageChipTextActive: {
    color: '#4A90E2',
    fontWeight: '700',
  },
  srsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  srsAdjustButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  srsInput: {
    width: 100,
    height: 50,
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  srsValidationNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  sliderValue: {
    fontSize: 16,
    color: '#4A90E2',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  srsStatsSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  srsStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  srsStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  srsStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 8,
    marginBottom: 4,
  },
  srsStatLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
  },
  simulatorButton: {
    backgroundColor: '#F5F0FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#9B59B6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  simulatorButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9B59B6',
  },
  simulatorButtonSubtext: {
    fontSize: 12,
    color: '#9B59B6',
    opacity: 0.8,
    marginLeft: 'auto',
  },
  applyToAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  applyToAllLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  applyToAllTextContainer: {
    flex: 1,
  },
  applyToAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  applyToAllSubtext: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  simulatorModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  simulatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  simulatorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  simulatorCloseButton: {
    padding: 8,
  },
  simulatorContent: {
    flex: 1,
    padding: 20,
  },
  simulatorDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 24,
  },
  simulatorCardState: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  simulatorCardStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  simulatorCardStateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  simulatorCardStateBadge: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  simulatorCardStateLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  simulatorCardStateValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  simulatorSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  simulatorSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  simulatorSectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  simulatorButtonsSection: {
    marginBottom: 24,
  },
  simulatorButtonsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  simulatorResponseButton: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  simulatorResponseAgain: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FF6B6B',
  },
  simulatorResponseHard: {
    backgroundColor: '#FFF8F0',
    borderColor: '#FF9500',
  },
  simulatorResponseGood: {
    backgroundColor: '#F0F7FF',
    borderColor: '#4A90E2',
  },
  simulatorResponseEasy: {
    backgroundColor: '#F0FFF5',
    borderColor: '#50C878',
  },
  simulatorResponseButtonContent: {
    gap: 4,
  },
  simulatorResponseButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  simulatorResponseButtonSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  simulatorResponseResult: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  simulatorResponseResultText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  simulatorTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  simulatorTipText: {
    flex: 1,
    fontSize: 13,
    color: '#4A90E2',
    lineHeight: 18,
  },
  simulatorResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  simulatorResetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  languageButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 10,
  },
  countryCodeBoxLarge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeCharTextLarge: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  countryCodeTextLarge: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  languageInfoLarge: {
    flex: 1,
  },
  languageNameLarge: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  languageNativeNameLarge: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  // Language Specific Settings Divider
  languageSettingsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  dividerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6C757D',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  languageSelectorCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  languageButtonContentCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginRight: 4,
  },
  countryCodeBoxCompact: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  nativeCharTextCompact: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  countryCodeTextCompact: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  languageNameCompact: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  languageNativeNameCompact: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  streakChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  streakChipGrey: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  streakChipSmallText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  streakChipTextGrey: {
    color: '#999',
  },
  streakContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  todayCompleteBadge: {
    marginLeft: 4,
  },
  longestStreakText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  languageChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 12,
    paddingHorizontal: 4,
  },
  // Single card for all languages
  languagesCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginHorizontal: 4,
  },
  languageIconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  languageIconWithLevel: {
    alignItems: 'center',
    gap: 6,
  },
  languageIconLarge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageIconChar: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  languageIconCode: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  levelBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 32,
    alignItems: 'center',
  },
  levelBadgeSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  languageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  languageChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageChipChar: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  languageChipCode: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  languageChipTextContainer: {
    flexDirection: 'column',
    flex: 1,
    marginLeft: 8,
  },
  languageChipName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  languageChipNativeName: {
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
    marginTop: 2,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  languageChipLevel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 36,
    alignItems: 'center',
    marginLeft: 8,
  },
  languageChipLevelText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
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
  // Weekly Goals Styles
  weekCanvas: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 24,
    gap: 8,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayGoalsContainer: {
    width: '100%',
    minHeight: 120,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 6,
  },
  dayGoalsContainerEmpty: {
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  emptyDayText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  activityBadgeWrapper: {
    width: '100%',
  },
  weeklyActivityBadge: {
    width: '100%',
    borderRadius: 10,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 4,
  },
  weeklyBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weeklyBadgeChar: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  weeklyBadgeCode: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  activityTypeIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  addActivitySection: {
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  addActivityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  activityButtonsGrid: {
    gap: 12,
  },
  activityButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityButtonLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activityIconSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  activityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dayButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  addDayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  // Learning Personalization Styles
  personalizationContent: {
    padding: 16,
  },
  personalizationSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  selectedLanguagesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  noLanguagesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  noLanguagesEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  noLanguagesEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  noLanguagesEmptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  languagePreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  languagePreviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languagePreviewIconText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  languagePreviewName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  defaultLanguageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  defaultLanguageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  defaultLanguageChipSelected: {
    backgroundColor: '#EEF4FF',
    borderColor: '#4A90E2',
  },
  defaultLanguageIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultLanguageIconText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  defaultLanguageChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  defaultLanguageChipTextSelected: {
    color: '#4A90E2',
    fontWeight: '600',
  },
  selectLanguagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FD',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  selectLanguagesButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
  },
  languageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  languageModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  languageModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  languageModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  languageModalClose: {
    padding: 4,
  },
  languageModalList: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  familyGroup: {
    marginBottom: 24,
  },
  familyHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A90E2',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  languageGridItem: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  languageGridItemSelected: {
    backgroundColor: '#E8F4FD',
    borderColor: '#4A90E2',
  },
  languageGridItemDisabled: {
    opacity: 0.5,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FFA500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 1,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  checkmarkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  languageGridIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  languageGridIconText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  languageGridName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 2,
  },
  languageGridNative: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 8,
    gap: 8,
  },
  savingText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '500',
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    gap: 8,
  },
  selectionSummaryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  // Interests Styles
  personalizationDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 24,
  },
  personalizationDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 18,
  },
  selectedInterestsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FD',
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#D0E7F9',
  },
  interestChipCustom: {
    backgroundColor: '#F3E8FF',
    borderColor: '#DCC5FF',
  },
  interestChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  interestChipTextCustom: {
    color: '#6B21A8',
  },
  removeInterestButton: {
    padding: 2,
  },
  customInterestSection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  customInterestLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  customInterestInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customInterestInput: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  addCustomInterestButton: {
    padding: 4,
  },
  predefinedInterestsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 20,
  },
  interestGridItem: {
    backgroundColor: '#F8F9FA',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  interestGridItemSelected: {
    backgroundColor: '#E8F4FD',
    borderColor: '#4A90E2',
  },
  interestGridItemCustom: {
    backgroundColor: '#F3E8FF',
    borderColor: '#8B5CF6',
  },
  interestGridIcon: {
    marginRight: 4,
  },
  interestGridText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  interestGridTextSelected: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  interestGridTextCustom: {
    color: '#6B21A8',
    fontWeight: '600',
  },
  interestCheckmark: {
    marginLeft: 4,
  },
  // Language icon box in Review Scheduling header
  srsLanguageIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  srsLanguageIconText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

