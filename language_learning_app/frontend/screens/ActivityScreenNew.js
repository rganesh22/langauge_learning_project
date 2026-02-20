import React from 'react';
import { View, Text } from 'react-native';
import ReadingActivity from './activities/ReadingActivity';
import ListeningActivity from './activities/ListeningActivity';
import WritingActivity from './activities/WritingActivity';
import SpeakingActivity from './activities/SpeakingActivity';
import TranslationActivity from './activities/TranslationActivity';
import ConversationActivity from './activities/ConversationActivity';

/**
 * Main ActivityScreen Router
 * Routes to appropriate activity component based on activity type
 */
export default function ActivityScreen({ route, navigation }) {
  const { activityType } = route.params || {};

  // Route to appropriate activity component
  switch (activityType) {
    case 'reading':
      return <ReadingActivity route={route} navigation={navigation} />;
    case 'listening':
      return <ListeningActivity route={route} navigation={navigation} />;
    case 'writing':
      return <WritingActivity route={route} navigation={navigation} />;
    case 'speaking':
      return <SpeakingActivity route={route} navigation={navigation} />;
    case 'translation':
      return <TranslationActivity route={route} navigation={navigation} />;
    case 'conversation':
      return <ConversationActivity route={route} navigation={navigation} />;
    default:
      // Fallback - show error
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Unknown activity type: {activityType}</Text>
        </View>
      );
  }
}
