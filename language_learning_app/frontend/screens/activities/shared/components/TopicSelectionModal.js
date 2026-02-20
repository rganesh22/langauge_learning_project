import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * TopicSelectionModal Component
 * Allows users to either enter a custom topic or let the AI pick randomly
 */
export default function TopicSelectionModal({ visible, onClose, onSelectTopic, activityType, color }) {
  const [customTopic, setCustomTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleRandomTopic = () => {
    setIsGenerating(true);
    onSelectTopic(null); // null means random
  };

  const handleCustomTopic = () => {
    if (customTopic.trim()) {
      setIsGenerating(true);
      onSelectTopic(customTopic.trim());
    }
  };

  const handleClose = () => {
    setCustomTopic('');
    setIsGenerating(false);
    onClose();
  };

  const getActivityLabel = () => {
    const labels = {
      reading: 'Reading',
      listening: 'Listening',
      writing: 'Writing',
      speaking: 'Speaking',
      conversation: 'Conversation'
    };
    return labels[activityType] || 'Activity';
  };

  return (
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
            <Text style={styles.modalTitle}>Choose a Topic</Text>
            <TouchableOpacity onPress={handleClose} disabled={isGenerating}>
              <Ionicons name="close" size={28} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Description */}
            <Text style={styles.descriptionText}>
              Select a topic for your {getActivityLabel().toLowerCase()} activity. You can enter a custom topic or let the AI pick one based on your interests.
            </Text>

            {/* Custom Topic Input */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="create-outline" size={22} color={color || '#4A90E2'} />
                <Text style={styles.sectionTitle}>Custom Topic</Text>
              </View>
              <TextInput
                style={styles.topicInput}
                placeholder="Enter a topic (e.g., cooking, traveling, technology...)"
                value={customTopic}
                onChangeText={setCustomTopic}
                multiline
                maxLength={200}
                editable={!isGenerating}
              />
              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: color || '#4A90E2' },
                  (!customTopic.trim() || isGenerating) && styles.buttonDisabled
                ]}
                onPress={handleCustomTopic}
                disabled={!customTopic.trim() || isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.buttonText}>Use This Topic</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Random Topic */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="shuffle-outline" size={22} color={color || '#4A90E2'} />
                <Text style={styles.sectionTitle}>Random Topic</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Let the AI choose a topic based on your interests, learning level, and vocabulary. Each topic is unique!
              </Text>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.buttonOutline,
                  { borderColor: color || '#4A90E2' },
                  isGenerating && styles.buttonDisabled
                ]}
                onPress={handleRandomTopic}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color={color || '#4A90E2'} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color={color || '#4A90E2'} />
                    <Text style={[styles.buttonTextOutline, { color: color || '#4A90E2' }]}>
                      Pick Random Topic
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  descriptionText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  topicInput: {
    borderWidth: 1,
    borderColor: '#D0D0D0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#F8F8F8',
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextOutline: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
});
