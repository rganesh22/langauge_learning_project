import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LessonRenderer from '../components/LessonRenderer';
import SafeText from '../components/SafeText';
import { LanguageContext, LANGUAGES } from '../contexts/LanguageContext';
import NoLanguageEmptyState from '../components/NoLanguageEmptyState';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

const LessonsScreen = ({ route }) => {
  const { selectedLanguage: ctxLanguage, setSelectedLanguage: setCtxLanguage, availableLanguages } = useContext(LanguageContext);
  const selectedLanguage = ctxLanguage;
  const setSelectedLanguage = (l) => setCtxLanguage(l);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [allLanguagesSrsStats, setAllLanguagesSrsStats] = useState({});
  
  // State management
  const [units, setUnits] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [viewMode, setViewMode] = useState('units'); // 'units', 'lessons', or 'lesson'
  const [inProgressLessons, setInProgressLessons] = useState({});
  const [lessonProgress, setLessonProgress] = useState({}); // Store progress percentage for each lesson
  const [reviewMode, setReviewMode] = useState(false);

  const userCefrLevel = route?.params?.userCefrLevel || 'B1';

  useEffect(() => {
    if (selectedLanguage) {
      loadUnits();
      loadAllLanguagesSrsStats();
    }
  }, [selectedLanguage, availableLanguages.length]);

  // Handle openLessonId parameter from navigation
  useEffect(() => {
    const { openLessonId, language } = route?.params || {};
    if (openLessonId) {
      console.log('Opening lesson from navigation:', openLessonId, 'language:', language);
      // Switch language if provided
      if (language && language !== selectedLanguage) {
        console.log('Switching language to:', language);
        setSelectedLanguage(language);
        return; // Let the language change trigger reload
      }
      // Open the lesson once units are loaded
      if (!loading && units.length > 0) {
        console.log('Units loaded, opening lesson:', openLessonId);
        openLessonById(openLessonId);
        // Clear the params after handling to prevent re-triggering
        if (route?.params) {
          route.params.openLessonId = undefined;
        }
      } else {
        console.log('Waiting for units to load. Loading:', loading, 'Units:', units.length);
      }
    }
  }, [route?.params, loading, units, selectedLanguage]);

  const openLessonById = async (lessonId) => {
    try {
      console.log('Fetching lesson by ID:', lessonId);
      // First, fetch the lesson data
      const response = await fetch(`${API_BASE_URL}/api/lessons/by-id/${lessonId}`);
      if (response.ok) {
        const data = await response.json();
        const lesson = data.lesson;
        console.log('Lesson fetched:', lesson.title, 'Unit ID:', lesson.unit_id);
        
        if (lesson.unit_id) {
          // Find the unit
          const unit = units.find(u => u.unit_id === lesson.unit_id);
          console.log('Looking for unit:', lesson.unit_id, 'Found:', !!unit);
          if (unit) {
            setSelectedUnit(unit);
            setViewMode('lessons');
            // Load all lessons in the unit
            console.log('Loading lessons for unit:', unit.unit_id);
            await loadLessonsForUnit(unit.unit_id);
            // Wait a bit for state to update, then select the lesson
            setTimeout(() => {
              console.log('Opening lesson:', lesson.title);
              setSelectedLesson(lesson);
              setViewMode('lesson');
            }, 100);
          } else {
            console.warn('Unit not found:', lesson.unit_id, 'Available units:', units.map(u => u.unit_id));
          }
        } else {
          // No unit, set lesson directly
          console.log('No unit, opening lesson directly');
          setSelectedLesson(lesson);
          setViewMode('lesson');
        }
      } else {
        console.error('Failed to fetch lesson:', response.status);
      }
    } catch (error) {
      console.error('Error opening lesson by ID:', error);
    }
  };

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

  const loadUnits = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/units/${selectedLanguage}`);
      if (response.ok) {
        const data = await response.json();
        if (data.units && data.units.length > 0) {
          setUnits(data.units);
        } else {
          // Fallback to loading lessons directly if no units
          setUnits([]);
          loadLessonsDirectly();
          return;
        }
      } else {
        console.error('Failed to fetch units');
        setUnits([]);
        loadLessonsDirectly();
      }
    } catch (error) {
      console.error('Error loading units:', error);
      setUnits([]);
      loadLessonsDirectly();
    } finally {
      setLoading(false);
    }
  };

  const loadLessonsDirectly = async () => {
    // Fallback for languages without units
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/lessons/${selectedLanguage}`);
      if (response.ok) {
        const data = await response.json();
        if (data.lessons && data.lessons.length > 0) {
          const lessonsWithProgress = await loadLessonProgress(data.lessons);
          setLessons(lessonsWithProgress);
          setViewMode('lessons');
        } else {
          setLessons([]);
        }
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLessonsForUnit = async (unitId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/units/${unitId}/lessons`);
      if (response.ok) {
        const data = await response.json();
        if (data.lessons && data.lessons.length > 0) {
          const lessonsWithProgress = await loadLessonProgress(data.lessons);
          setLessons(lessonsWithProgress);
        } else {
          setLessons([]);
        }
      } else {
        console.error('Failed to fetch lessons for unit');
        setLessons([]);
      }
    } catch (error) {
      console.error('Error loading lessons for unit:', error);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLessonProgress = async (lessonsList) => {
    const progressMap = {};
    const inProgressMap = {};
    
    const lessonsWithProgress = await Promise.all(
      lessonsList.map(async (lesson) => {
        try {
          const progressResponse = await fetch(`${API_BASE_URL}/api/lessons/progress/${lesson.lesson_id}`);
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            const totalSteps = lesson.steps?.length || 1;
            const completedSteps = progressData.completed_steps?.length || 0;
            const progressPercentage = (completedSteps / totalSteps) * 100;
            
            progressMap[lesson.lesson_id] = progressPercentage;
            
            const hasProgress = progressData.current_step > 0 || completedSteps > 0;
            if (hasProgress && !lesson.completed) {
              inProgressMap[lesson.lesson_id] = true;
            }
            
            return {
              ...lesson,
              inProgress: hasProgress && !lesson.completed,
              progressPercentage: lesson.completed ? 100 : progressPercentage
            };
          }
        } catch (error) {
          console.error(`Error loading progress for ${lesson.lesson_id}:`, error);
        }
        return {
          ...lesson,
          progressPercentage: lesson.completed ? 100 : 0
        };
      })
    );
    
    setLessonProgress(progressMap);
    setInProgressLessons(inProgressMap);
    return lessonsWithProgress;
  };

  const loadLessons = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/lessons/${selectedLanguage}`);
      if (response.ok) {
        const data = await response.json();
        if (data.lessons && data.lessons.length > 0) {
          // Load progress for all lessons to determine in-progress state
          const lessonsWithProgress = await Promise.all(
            data.lessons.map(async (lesson) => {
              // Check if lesson has progress (in-progress)
              try {
                const progressResponse = await fetch(`${API_BASE_URL}/api/lessons/progress/${lesson.lesson_id}`);
                if (progressResponse.ok) {
                  const progressData = await progressResponse.json();
                  // If there's progress and it's not at the start, mark as in-progress
                  const hasProgress = progressData.current_step > 0 || (progressData.completed_steps && progressData.completed_steps.length > 0);
                  return {
                    ...lesson,
                    inProgress: hasProgress && !lesson.completed
                  };
                }
              } catch (error) {
                console.error(`Error loading progress for ${lesson.lesson_id}:`, error);
              }
              return lesson;
            })
          );
          
          setLessons(lessonsWithProgress);
          
          // Build inProgressLessons map
          const inProgressMap = {};
          lessonsWithProgress.forEach(lesson => {
            if (lesson.inProgress) {
              inProgressMap[lesson.lesson_id] = true;
            }
          });
          setInProgressLessons(inProgressMap);
        } else {
          setLessons([]);
        }
      } else {
        console.error('Failed to fetch lessons');
        setLessons([]);
      }
    } catch (error) {
      console.error('Error loading lessons:', error);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnitSelect = (unit) => {
    setSelectedUnit(unit);
    setViewMode('lessons');
    loadLessonsForUnit(unit.unit_id);
  };

  const handleLessonSelect = (lessonId, openInReviewMode = false) => {
    const lesson = lessons.find(l => l.lesson_id === lessonId);
    if (lesson) {
      // Set review mode if lesson is completed and being reviewed
      setReviewMode(openInReviewMode || lesson.completed);
      
      // Mark as in progress if not completed and not in review mode
      if (!lesson.completed && !openInReviewMode) {
        setInProgressLessons(prev => ({
          ...prev,
          [lessonId]: true
        }));
      }
      setSelectedLesson(lesson);
      setViewMode('lesson');
    }
  };

  const handleLessonComplete = async (completionData) => {
    console.log('Lesson completed:', completionData);
    
    // Save completion data to backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/lessons/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson_id: completionData.lessonId,
          answers: completionData.answers,
          feedback: completionData.feedback,
          total_score: completionData.totalScore || null,
        }),
      });

      if (response.ok) {
        console.log('Lesson completion saved successfully');
        
        // Update unit progress if in a unit
        if (selectedUnit) {
          try {
            await fetch(`${API_BASE_URL}/api/units/${selectedUnit.unit_id}/update-progress`, {
              method: 'POST'
            });
            // Reload units to get updated progress
            await loadUnits();
            
            // Update the selectedUnit with fresh data from the reloaded units
            // This ensures the progress bar shows the updated count
            const unitsResponse = await fetch(`${API_BASE_URL}/api/units/${selectedLanguage}`);
            if (unitsResponse.ok) {
              const unitsData = await unitsResponse.json();
              const updatedUnit = unitsData.units.find(u => u.unit_id === selectedUnit.unit_id);
              if (updatedUnit) {
                setSelectedUnit(updatedUnit);
              }
            }
          } catch (error) {
            console.error('Error updating unit progress:', error);
          }
        }
        
        // Remove from in-progress
        setInProgressLessons(prev => {
          const updated = { ...prev };
          delete updated[completionData.lessonId];
          return updated;
        });
        
        // Reload lessons to get updated completion status
        if (selectedUnit) {
          await loadLessonsForUnit(selectedUnit.unit_id);
        } else {
          await loadLessons();
        }
      } else {
        console.error('Failed to save lesson completion');
      }
    } catch (error) {
      console.error('Error saving lesson completion:', error);
    }
    
    // Return to lesson list
    setViewMode('lessons');
    setSelectedLesson(null);
    setReviewMode(false);
  };

  const handleBackToList = () => {
    if (viewMode === 'lesson') {
      setViewMode('lessons');
      setSelectedLesson(null);
      setReviewMode(false);
    } else if (viewMode === 'lessons') {
      setViewMode('units');
      setSelectedUnit(null);
      setLessons([]);
    }
  };

  const handleRedoLesson = async (lessonId) => {
    try {
      // Clear progress from backend
      const response = await fetch(`${API_BASE_URL}/api/lessons/progress/${lessonId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('Lesson progress cleared successfully');
        
        // Remove from in-progress
        setInProgressLessons(prev => {
          const updated = { ...prev };
          delete updated[lessonId];
          return updated;
        });
        
        // Reload lessons to get updated status (will still show as completed in completions table)
        await loadLessons();
        
        // Optionally, start the lesson again
        handleLessonSelect(lessonId);
      } else {
        console.error('Failed to clear lesson progress');
      }
    } catch (error) {
      console.error('Error clearing lesson progress:', error);
    }
  };

  const currentLanguage = LANGUAGES.find(lang => lang.code === selectedLanguage) || LANGUAGES.find(l => l.code === 'kannada');
  const languageColor = currentLanguage?.color || '#F97316';

  // If no language is selected yet, show the empty state
  if (!selectedLanguage || availableLanguages.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="school" size={24} color="#4A90E2" style={styles.appIcon} />
            <Text style={styles.appTitle}>Units</Text>
          </View>
        </View>
        <NoLanguageEmptyState message="Select a language in your Profile to access lessons." />
      </View>
    );
  }

  const getLevelColor = (level) => {
    const levelColors = {
      A1: '#10B981',
      A2: '#3B82F6',
      B1: '#F59E0B',
      B2: '#EF4444',
      C1: '#8B5CF6',
      C2: '#EC4899',
    };
    return levelColors[level] || '#6B7280';
  };

  const renderUnitCard = ({ item }) => {
    const progress = item.lesson_count > 0 ? (item.lessons_completed || 0) / item.lesson_count : 0;
    const isCompleted = item.is_completed || false;

    return (
      <TouchableOpacity
        style={[styles.unitCard, { borderLeftColor: languageColor, borderLeftWidth: 4 }]}
        onPress={() => handleUnitSelect(item)}
      >
        <View style={styles.unitHeader}>
          <View style={styles.unitTitleContainer}>
            <SafeText style={styles.unitNumber}>Unit {item.unit_number}</SafeText>
            <SafeText style={styles.unitTitle}>{item.title}</SafeText>
            {item.subtitle && (
              <SafeText style={styles.unitSubtitle}>{item.subtitle}</SafeText>
            )}
          </View>
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={28} color="#10B981" />
            </View>
          )}
        </View>

        <View style={styles.unitProgressContainer}>
          <View style={styles.unitProgressBar}>
            <View style={[styles.unitProgressFill, { width: `${progress * 100}%`, backgroundColor: languageColor }]} />
          </View>
          <SafeText style={styles.unitProgressText}>
            {item.lessons_completed || 0} / {item.lesson_count} lessons completed
          </SafeText>
        </View>

        <View style={styles.unitFooter}>
          <View style={styles.unitLessonCount}>
            <Ionicons name="book-outline" size={16} color="#6B7280" />
            <SafeText style={styles.unitLessonCountText}>
              {item.lesson_count} {item.lesson_count === 1 ? 'lesson' : 'lessons'}
            </SafeText>
          </View>
          <View style={styles.startButton}>
            <SafeText style={[styles.startButtonText, { color: languageColor }]}>
              {isCompleted ? 'Review' : progress > 0 ? 'Continue' : 'Start'}
            </SafeText>
            <Ionicons name="arrow-forward" size={16} color={languageColor} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderLessonCard = ({ item }) => {
    const levelColor = getLevelColor(item.level);
    const stepCount = item.steps?.length || 0;
    const isCompleted = item.completed || false;
    const isInProgress = item.inProgress || (!isCompleted && inProgressLessons[item.lesson_id]);
    const progressPercentage = item.progressPercentage || 0;

    return (
      <TouchableOpacity
        style={[styles.lessonCard, { borderLeftColor: languageColor, borderLeftWidth: 4 }]}
        onPress={() => handleLessonSelect(item.lesson_id)}
      >
        <View style={styles.lessonHeader}>
          <View style={styles.lessonTitleContainer}>
            {item.lesson_number && (
              <SafeText style={styles.lessonNumber}>Lesson {item.lesson_number}</SafeText>
            )}
            <SafeText style={styles.lessonTitle}>{item.title}</SafeText>
            <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
              <SafeText style={styles.levelText}>{item.level}</SafeText>
            </View>
          </View>
          <View style={styles.lessonBadges}>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
            )}
            {isInProgress && !isCompleted && (
              <View style={styles.inProgressBadge}>
                <Ionicons name="ellipsis-horizontal-circle" size={24} color="#F59E0B" />
              </View>
            )}
          </View>
        </View>

        {/* Progress bar for in-progress lessons */}
        {isInProgress && !isCompleted && progressPercentage > 0 && (
          <View style={styles.lessonProgressContainer}>
            <View style={styles.lessonProgressBar}>
              <View style={[styles.lessonProgressFill, { width: `${progressPercentage}%`, backgroundColor: languageColor }]} />
            </View>
            <SafeText style={styles.lessonProgressText}>{Math.round(progressPercentage)}% complete</SafeText>
          </View>
        )}

        <View style={styles.lessonFooter}>
          <View style={styles.stepInfo}>
            <Ionicons name="list-outline" size={16} color="#6B7280" />
            <SafeText style={styles.stepCount}>{stepCount}{' '}steps</SafeText>
          </View>
          <View style={styles.lessonActions}>
            {isCompleted && (
              <TouchableOpacity 
                style={styles.redoButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleRedoLesson(item.lesson_id);
                }}
              >
                <Ionicons name="refresh" size={16} color="#6B7280" />
                <SafeText style={styles.redoButtonText}>Redo</SafeText>
              </TouchableOpacity>
            )}
            <View style={styles.startButton}>
              <SafeText style={[styles.startButtonText, { color: languageColor }]}>
                {isCompleted ? 'Review' : isInProgress ? 'Continue' : 'Start'}
              </SafeText>
              <Ionicons name="arrow-forward" size={16} color={languageColor} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (viewMode === 'lesson' && selectedLesson) {
    return (
      <View style={styles.container}>
        <View style={[styles.lessonNavHeader, { backgroundColor: languageColor }]}>
          <TouchableOpacity onPress={handleBackToList} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            <SafeText style={styles.backButtonText}>
              {selectedUnit ? 'Lessons' : 'Back'}
            </SafeText>
          </TouchableOpacity>
        </View>
        <LessonRenderer
          lessonData={selectedLesson}
          language={selectedLanguage}
          onComplete={handleLessonComplete}
          userCefrLevel={userCefrLevel}
          languageColor={languageColor}
          reviewMode={reviewMode}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="school" size={24} color="#4A90E2" style={styles.appIcon} />
          <Text style={styles.appTitle}>
            {viewMode === 'units' ? 'Units' : selectedUnit ? selectedUnit.title : 'Lessons'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.languageButton}
          onPress={() => setLanguageMenuVisible(true)}
        >
          {(currentLanguage?.nativeChar || currentLanguage?.langCode) && (
            <View style={[styles.countryCodeBox, { backgroundColor: currentLanguage?.color || '#F5F5F5' }]}>
              {currentLanguage?.nativeChar ? (
                <Text style={[
                  styles.nativeCharText,
                  currentLanguage.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu' }
                ]}>{currentLanguage.nativeChar}</Text>
              ) : (
                <Text style={styles.countryCodeText}>{currentLanguage?.countryCode}</Text>
              )}
            </View>
          )}
          <View style={styles.languageButtonContent}>
            <Text style={styles.languageName}>{currentLanguage?.name}</Text>
            {currentLanguage?.nativeName && (
              <Text style={[
                styles.languageNativeName,
                currentLanguage.code === 'urdu' && { fontFamily: 'Noto Nastaliq Urdu', textAlign: 'left' }
              ]}>{currentLanguage.nativeName}</Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <SafeText style={styles.loadingText}>Loading...</SafeText>
        </View>
      ) : viewMode === 'units' ? (
        units.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={64} color="#D1D5DB" />
            <SafeText style={styles.emptyText}>No units available</SafeText>
            <SafeText style={styles.emptySubtext}>
              Check back later for new content
            </SafeText>
          </View>
        ) : (
          <FlatList
            data={units}
            renderItem={renderUnitCard}
            keyExtractor={(item) => item.unit_id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : viewMode === 'lessons' ? (
        lessons.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="book-outline" size={64} color="#D1D5DB" />
            <SafeText style={styles.emptyText}>No lessons available</SafeText>
            <SafeText style={styles.emptySubtext}>
              Check back later for new content
            </SafeText>
          </View>
        ) : (
          <>
            {selectedUnit && (
              <TouchableOpacity 
                style={styles.backToUnitsButton}
                onPress={handleBackToList}
              >
                <Ionicons name="arrow-back" size={20} color={languageColor} />
                <SafeText style={[styles.backToUnitsText, { color: languageColor }]}>
                  Back to Units
                </SafeText>
              </TouchableOpacity>
            )}
            <FlatList
              data={lessons}
              renderItem={renderLessonCard}
              keyExtractor={(item) => item.lesson_id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </>
        )
      ) : null}

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
                          !lang.active && styles.languageOptionTextDisabled,
                        ]}
                      >
                        {lang.name}
                      </Text>
                      {lang.nativeName && (
                        <Text
                          style={[
                            styles.languageOptionNativeName,
                            isSelected && styles.languageOptionNativeNameSelected,
                            !lang.active && styles.languageOptionNativeNameDisabled,
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
                {!lang.active && (
                  <Ionicons name="lock-closed" size={16} color="#CCC" />
                )}
              </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerLeft: {
    flex: 1,
    flexShrink: 1,
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
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    flexShrink: 0,
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
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#F9FAFB',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  lessonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lessonTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  lessonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  lessonLanguage: {
    fontSize: 14,
    color: '#6B7280',
  },
  lessonBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  completedBadge: {
    marginLeft: 4,
  },
  inProgressBadge: {
    marginLeft: 4,
  },
  lessonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  stepInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCount: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  lessonActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  redoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  redoButtonText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  lessonNavHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
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
  // Unit card styles
  unitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  unitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  unitTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  unitNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  unitTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  unitSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  unitProgressContainer: {
    marginBottom: 16,
  },
  unitProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  unitProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  unitProgressText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  unitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  unitLessonCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitLessonCountText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  unitTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unitTimeText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  // Updated lesson card styles
  lessonNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  lessonProgressContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  lessonProgressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  lessonProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  lessonProgressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  backToUnitsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  backToUnitsText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default LessonsScreen;
