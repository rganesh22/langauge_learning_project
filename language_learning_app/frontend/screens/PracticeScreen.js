import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LANGUAGES } from '../contexts/LanguageContext';
import { LanguageContext } from '../contexts/LanguageContext';
import NoLanguageEmptyState from '../components/NoLanguageEmptyState';

const API_BASE_URL = __DEV__ ? 'http://localhost:8080' : 'http://localhost:8080';

const ACTIVITY_COLORS = {
  reading: { primary: '#4A90E2', light: '#E8F4FD' },
  listening: { primary: '#2B654A', light: '#E8F5EF' },
  writing: { primary: '#FF6B6B', light: '#FFE8E8' },
  speaking: { primary: '#FF9500', light: '#FFF4E6' },
  translation: { primary: '#8B5CF6', light: '#F3E8FF' },
  conversation: { primary: '#9B59B6', light: '#F4E6FF' },
};

export default function PracticeScreen({ navigation }) {
  const { selectedLanguage: ctxLanguage, setSelectedLanguage: setCtxLanguage, availableLanguages } = React.useContext(LanguageContext);
  const selectedLanguage = ctxLanguage;
  const setSelectedLanguage = (l) => setCtxLanguage(l);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [srsStats, setSrsStats] = useState(null);
  const [allLanguagesSrsStats, setAllLanguagesSrsStats] = useState({});

  useFocusEffect(
    React.useCallback(() => {
      if (selectedLanguage) {
        fetchSrsStats();
        loadAllLanguagesSrsStats();
      }
    }, [selectedLanguage, availableLanguages.length])
  );
  
  const fetchSrsStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/srs/stats/${selectedLanguage}`);
      if (response.ok) {
        const data = await response.json();
        setSrsStats(data);
      }
    } catch (error) {
      console.error('Error fetching SRS stats:', error);
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

  const currentLanguage = LANGUAGES.find(lang => lang.code === selectedLanguage) || null;

  // If no language selected yet, show the empty state instead of the full screen
  if (!selectedLanguage || availableLanguages.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="language" size={24} color="#4A90E2" style={styles.appIcon} />
            <Text style={styles.appTitle}>Practice</Text>
          </View>
        </View>
        <NoLanguageEmptyState message="Select a language in your Profile to start practising." />
      </View>
    );
  }

  const startActivity = (activityType) => {
    navigation.navigate('Activity', {
      language: selectedLanguage,
      activityType: activityType,
    });
  };

  const viewHistory = (activityType) => {
    navigation.navigate('ActivityHistory', {
      language: selectedLanguage,
      activityType: activityType,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="language" size={24} color="#4A90E2" style={styles.appIcon} />
          <Text style={styles.appTitle}>Practice</Text>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vocab Practice Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vocab Practice</Text>
          <View style={styles.activityCardContainer}>
            <TouchableOpacity
              style={[styles.activityCard, { borderLeftColor: '#14B8A6' }]}
              onPress={() => navigation.navigate('Flashcards', { language: selectedLanguage })}
            >
              <View style={styles.activityCardContent}>
                <View style={[styles.activityIcon, { backgroundColor: '#E0F7F4' }]}>
                  <Ionicons 
                    name="albums" 
                    size={24} 
                    color="#14B8A6" 
                  />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>Flashcards</Text>
                  {srsStats && (
                    <View style={styles.flashcardChipsContainer}>
                      {/* Always show new cards chip */}
                      <View style={styles.flashcardChip}>
                        <Ionicons name="add-circle" size={14} color="#4A90E2" />
                        <Text style={[styles.flashcardChipText, { color: '#4A90E2' }]}>
                          {`${srsStats.new_count || 0} New`}
                        </Text>
                      </View>
                      {/* Always show due reviews chip */}
                      <View style={styles.flashcardChip}>
                        <Ionicons name="time" size={14} color="#EF4444" />
                        <Text style={[styles.flashcardChipText, { color: '#EF4444' }]}>
                          {`${srsStats.due_count || 0} Due`}
                        </Text>
                      </View>
                    </View>
                  )}
                  {!srsStats && (
                    <Text style={styles.activitySubtitle}>Review vocabulary with SRS</Text>
                  )}
                </View>
                {/* Show green check if both new and reviews quotas are met, otherwise chevron */}
                {srsStats && 
                 srsStats.new_count === 0 && 
                 srsStats.due_count === 0 && 
                 srsStats.today_new_completed > 0 && 
                 srsStats.today_reviews_completed > 0 ? (
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Activity Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Practice Activities</Text>
          {['reading', 'listening', 'writing', 'speaking', 'translation', 'conversation'].map((activity) => {
            const colors = ACTIVITY_COLORS[activity];
            const isDisabled = activity === 'conversation';
            return (
              <View key={activity} style={styles.activityCardContainer}>
                <TouchableOpacity
                  style={[
                    styles.activityCard, 
                    { borderLeftColor: colors.primary },
                    isDisabled && styles.disabledCard
                  ]}
                  onPress={() => !isDisabled && startActivity(activity)}
                  disabled={isDisabled}
                  activeOpacity={isDisabled ? 1 : 0.7}
                >
                  <View style={styles.activityCardContent}>
                    <View style={[
                      styles.activityIcon, 
                      { backgroundColor: isDisabled ? '#E0E0E0' : colors.light }
                    ]}>
                      <Ionicons 
                        name={activity === 'reading' ? 'book' : 
                              activity === 'listening' ? 'headset' :
                              activity === 'writing' ? 'create' : 
                              activity === 'speaking' ? 'mic' : 
                              activity === 'translation' ? 'language' : 'chatbubbles'} 
                        size={24} 
                        color={isDisabled ? '#999' : colors.primary} 
                      />
                    </View>
                    <View style={styles.activityInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[
                          styles.activityTitle,
                          isDisabled && styles.disabledText
                        ]}>
                          {activity.charAt(0).toUpperCase() + activity.slice(1)}
                        </Text>
                        {isDisabled && (
                          <View style={styles.soonChip}>
                            <Text style={styles.soonChipText}>Soon</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[
                        styles.activitySubtitle,
                        isDisabled && styles.disabledText
                      ]}>
                        Start a new practice session
                      </Text>
                    </View>
                    <Ionicons 
                      name="chevron-forward" 
                      size={20} 
                      color={isDisabled ? '#CCC' : '#999'} 
                    />
                  </View>
                </TouchableOpacity>
                
                {/* History Button */}
                {!isDisabled && (
                  <TouchableOpacity
                    style={[styles.historyButton, { borderColor: colors.primary }]}
                    onPress={() => viewHistory(activity)}
                  >
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Text style={[styles.historyButtonText, { color: colors.primary }]}>
                      View History
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

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
}

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
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  activityCardContainer: {
    marginBottom: 16,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  activityCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  completedText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  disabledCard: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  disabledText: {
    color: '#999',
  },
  soonChip: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  soonChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  flashcardChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  flashcardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  flashcardChipText: {
    fontSize: 13,
    fontWeight: '600',
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
