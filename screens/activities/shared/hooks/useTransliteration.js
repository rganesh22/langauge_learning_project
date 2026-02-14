/**
 * Hook for managing transliteration state and logic
 * Used by all activity components
 */
import { useState, useEffect } from 'react';
import { transliterateText, coerceTranslitMapToStrings } from '../utils/textProcessing';

const API_BASE_URL = __DEV__ ? 'http://localhost:5001' : 'http://localhost:5001';

export function useTransliteration(language, activity) {
  const [transliterations, setTransliterations] = useState({});
  const [showTransliterations, setShowTransliterations] = useState(false); // Start false, load from settings
  const [nativeScriptRenderings, setNativeScriptRenderings] = useState({});

  // Load language-specific default transliteration setting
  useEffect(() => {
    const loadLanguageSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/language-personalization/${language}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`[useTransliteration] Loading settings for ${language}:`, data);
          // Use the actual setting value, defaulting to false if not set
          const shouldShowTranslit = data.default_transliterate !== undefined ? data.default_transliterate : false;
          console.log(`[useTransliteration] Setting showTransliterations to:`, shouldShowTranslit);
          setShowTransliterations(shouldShowTranslit);
        } else {
          console.log(`[useTransliteration] No settings found for ${language}, keeping default false`);
          // Don't change from initial false state
        }
      } catch (error) {
        console.error('[useTransliteration] Error loading language settings:', error);
        // Don't change from initial false state
      }
    };
    
    if (language) {
      loadLanguageSettings();
    }
  }, [language]);

  // Ensure transliteration for a specific key and show transliterations
  const ensureAndShowTransliterationForKey = async (key, sourceText) => {
    if (!sourceText || !key) return;
    try {
      setShowTransliterations(true);
      if (transliterations && transliterations[key]) return;

      const t = await transliterateText(sourceText, language);
      if (t) {
        setTransliterations(prev => ({ ...prev, [key]: t }));
      }
    } catch (err) {
      console.error('Error ensuring transliteration for key', key, err);
    }
  };

  // Ensure native-script rendering (Arabic/Nastaliq) for Urdu
  const ensureNativeScriptForKey = async (key, sourceText) => {
    if (!key || !sourceText) return;
    if (language !== 'urdu') return;
    try {
      if (nativeScriptRenderings && nativeScriptRenderings[key]) return;
      const arabic = await transliterateText(sourceText, language, 'Urdu');
      if (arabic) {
        setNativeScriptRenderings(prev => ({ ...prev, [key]: arabic }));
      }
    } catch (err) {
      console.error('Error ensuring native script rendering for key', key, err);
    }
  };

  // Ensure transliterations for all activity content
  const ensureTransliterationsForActivity = async () => {
    if (!activity || !showTransliterations) return;
    const toFetch = [];

    // Story / passage
    if (activity.story && !transliterations.story) toFetch.push({ key: 'story', text: activity.story });
    if (activity.story_name && !transliterations.storyName) toFetch.push({ key: 'storyName', text: activity.story_name });
    if (activity.passage && !transliterations.passage) toFetch.push({ key: 'passage', text: activity.passage });
    if (activity.passage_name && !transliterations.passageName) toFetch.push({ key: 'passageName', text: activity.passage_name });

    // Questions and options
    if (activity.questions && Array.isArray(activity.questions)) {
      for (let i = 0; i < activity.questions.length; i++) {
        const q = activity.questions[i];
        if (q.question && !transliterations[`question_${i}`]) toFetch.push({ key: `question_${i}`, text: q.question });
        if (q.options && Array.isArray(q.options)) {
          for (let o = 0; o < q.options.length; o++) {
            if (q.options[o] && !transliterations[`option_${i}_${o}`]) toFetch.push({ key: `option_${i}_${o}`, text: q.options[o] });
          }
        }
      }
    }

    if (toFetch.length === 0) return;

    try {
      const newTrans = {};
      for (const item of toFetch) {
        try {
          const t = await transliterateText(item.text, language, 'IAST');
          if (t) newTrans[item.key] = t;
        } catch (err) {
          console.error('Error transliterating', item.key, err);
        }
      }
      if (Object.keys(newTrans).length > 0) {
        setTransliterations(prev => ({ ...prev, ...coerceTranslitMapToStrings(newTrans) }));
      }
    } catch (err) {
      console.error('Error ensuring transliterations for activity:', err);
    }
  };

  // Auto-fetch transliterations when enabled
  useEffect(() => {
    if (showTransliterations) {
      ensureTransliterationsForActivity();
    }
  }, [showTransliterations, activity]);

  // For Urdu, prefetch native-script renderings
  useEffect(() => {
    if (activity && language === 'urdu') {
      // Fetch native script for story/passage if needed
      if (activity.story && !nativeScriptRenderings.story) {
        ensureNativeScriptForKey('story', activity.story);
      }
      if (activity.story_name && !nativeScriptRenderings.storyName) {
        ensureNativeScriptForKey('storyName', activity.story_name);
      }
      if (activity.passage && !nativeScriptRenderings.passage) {
        ensureNativeScriptForKey('passage', activity.passage);
      }
      if (activity.passage_name && !nativeScriptRenderings.passageName) {
        ensureNativeScriptForKey('passageName', activity.passage_name);
      }
      
      // Fetch native script for questions and options
      if (activity.questions && Array.isArray(activity.questions)) {
        activity.questions.forEach((q, i) => {
          if (q.question && !nativeScriptRenderings[`question_${i}`]) {
            ensureNativeScriptForKey(`question_${i}`, q.question);
          }
          if (q.options && Array.isArray(q.options)) {
            q.options.forEach((opt, o) => {
              if (opt && !nativeScriptRenderings[`option_${i}_${o}`]) {
                ensureNativeScriptForKey(`option_${i}_${o}`, opt);
              }
            });
          }
        });
      }
    }
  }, [activity, language]);

  return {
    transliterations,
    setTransliterations,
    showTransliterations,
    setShowTransliterations,
    nativeScriptRenderings,
    setNativeScriptRenderings,
    ensureAndShowTransliterationForKey,
    ensureNativeScriptForKey,
    ensureTransliterationsForActivity
  };
}
