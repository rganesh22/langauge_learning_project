import React from 'react';
import UnifiedActivityRenderer from './activities/UnifiedActivityRenderer';

/**
 * Main Activity Screen — single entry point for all lesson activities.
 * Delegates to LessonActivity (transliteration, reading, listening, writing, speaking, translation).
 */
export default function ActivityScreen({ route, navigation }) {
  return <UnifiedActivityRenderer route={route} navigation={navigation} />;
}
