/**
 * Single Activity Renderer (Lesson Activity)
 * Renders one of six activity types (transliteration, reading, listening, writing, speaking, translation)
 * with a unified entry point. Topic selection and theme color are applied per activity type.
 * Activity UIs live in this directory and are composed here.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { ACTIVITY_COLORS } from './shared/constants';
import TransliterationActivity from './TransliterationActivity';
import ReadingActivity from './ReadingActivity';
import ListeningActivity from './ListeningActivity';
import WritingActivity from './WritingActivity';
import SpeakingActivity from './SpeakingActivity';
import TranslationActivity from './TranslationActivity';

const ACTIVITY_MAP = {
  transliteration: TransliterationActivity,
  reading: ReadingActivity,
  listening: ListeningActivity,
  writing: WritingActivity,
  speaking: SpeakingActivity,
  translation: TranslationActivity,
};

export default function LessonActivity({ route: routeProp, navigation }) {
  const route = useRoute();
  const params = route.params || routeProp?.params || {};
  const { activityType } = params;
  const Component = activityType ? ACTIVITY_MAP[activityType] : null;
  const colors = activityType ? ACTIVITY_COLORS[activityType] : null;

  if (!Component || !colors) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Unknown activity type: {String(activityType || 'none')}</Text>
      </View>
    );
  }

  return (
    <Component
      key={`lesson-${activityType}-${params.language || ''}`}
      route={{ ...route, params }}
      navigation={navigation}
      themeColor={colors}
    />
  );
}
