/**
 * TTS Progress Indicator Component
 * Shows real-time progress for TTS generation with sleek design
 */
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function TTSProgressIndicator({ paragraphCount = 5, currentStatus = {} }) {
  const colors = {
    primary: '#6366f1',
    success: '#50C878',
    error: '#FF6B6B',
    pending: '#E0E0E0',
    inProgress: '#FFA500',
    background: '#F5F5F5',
    text: '#333'
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return { name: 'checkmark-circle', color: colors.success };
      case 'in_progress':
        return { name: 'hourglass', color: colors.inProgress };
      case 'error':
        return { name: 'close-circle', color: colors.error };
      default:
        return { name: 'ellipse-outline', color: colors.pending };
    }
  };

  const getStatusText = (index) => {
    const status = currentStatus[index];
    if (status === 'complete') return 'Complete';
    if (status === 'in_progress') return 'Generating...';
    if (status === 'error') return 'Failed';
    return 'Pending';
  };

  // Calculate overall progress
  const completedCount = Object.values(currentStatus).filter(s => s === 'complete').length;
  const progressPercentage = paragraphCount > 0 ? (completedCount / paragraphCount) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Generating Audio</Text>
        <Text style={styles.subtitle}>
          {completedCount} of {paragraphCount} paragraphs complete
        </Text>
      </View>

      {/* Overall Progress Bar */}
      <View style={styles.overallProgressContainer}>
        <View style={styles.overallProgressBar}>
          <View 
            style={[
              styles.overallProgressFill, 
              { 
                width: `${progressPercentage}%`,
                backgroundColor: colors.primary
              }
            ]} 
          />
        </View>
        <Text style={styles.percentageText}>{Math.round(progressPercentage)}%</Text>
      </View>

      {/* Individual Paragraph Progress */}
      <View style={styles.paragraphsContainer}>
        {Array.from({ length: paragraphCount }).map((_, index) => {
          const status = currentStatus[index] || 'pending';
          const icon = getStatusIcon(status);
          
          return (
            <View key={index} style={styles.paragraphRow}>
              <View style={styles.paragraphLeft}>
                <Ionicons 
                  name={icon.name} 
                  size={24} 
                  color={icon.color}
                  style={styles.icon}
                />
                <Text style={styles.paragraphLabel}>Paragraph {index + 1}</Text>
              </View>
              <Text 
                style={[
                  styles.statusText,
                  status === 'complete' && { color: colors.success },
                  status === 'in_progress' && { color: colors.inProgress },
                  status === 'error' && { color: colors.error },
                ]}
              >
                {getStatusText(index)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Info Text */}
      <Text style={styles.infoText}>
        TTS generation may take 1-3 minutes depending on server load
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  overallProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  overallProgressBar: {
    flex: 1,
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    borderRadius: 6,
    transition: 'width 0.3s ease',
  },
  percentageText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366f1',
    minWidth: 50,
    textAlign: 'right',
  },
  paragraphsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  paragraphRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  paragraphLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 24,
  },
  paragraphLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
