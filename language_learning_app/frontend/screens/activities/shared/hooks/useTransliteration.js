/**
 * Hook for managing transliteration state and logic
 * Used by all activity components
 */
import { useState, useEffect } from 'react';
import { transliterateText, coerceTranslitMapToStrings } from '../utils/textProcessing';

const API_BASE_URL = __DEV__ ? 'http://localhost:9090' : 'http://localhost:9090';

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
  // Optional sourceLanguageOverride lets callers control which language/script
  // the text should be transliterated from (useful when the UI language differs
  // from the sentence's actual language, e.g. translation activity badges).
  const ensureAndShowTransliterationForKey = async (key, sourceText, sourceLanguageOverride = null) => {
    if (!sourceText || !key) return;
    try {
      setShowTransliterations(true);
      if (transliterations && transliterations[key]) return;

      const fromLang = sourceLanguageOverride || language;
      const t = await transliterateText(sourceText, fromLang);
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

  // Ensure transliterations for all activity content (supports sections→items schema)
  const ensureTransliterationsForActivity = async () => {
    if (!activity || !showTransliterations) return;
    const toFetch = [];

    // Helper: add key+text if not already transliterated
    const add = (key, text) => {
      if (text && !transliterations[key]) toFetch.push({ key, text });
    };

    // Old flat schema fallbacks (legacy)
    add('story', activity.story);
    add('storyName', activity.story_name);
    add('passage', activity.passage);
    add('passageName', activity.passage_name);

    if (activity.questions && Array.isArray(activity.questions)) {
      activity.questions.forEach((q, i) => {
        add(`question_${i}`, q.question);
        if (q.options) q.options.forEach((opt, o) => add(`option_${i}_${o}`, opt));
      });
    }

    // New sections→items schema
    if (activity.sections && Array.isArray(activity.sections)) {
      activity.sections.forEach((section, si) => {
        if (section.instruction_native) add(`s${si}_instruction`, section.instruction_native);
        if (!section.items || !Array.isArray(section.items)) return;
        section.items.forEach((item, ii) => {
          const prefix = `s${si}_i${ii}`;
          // Passages
          if (item.passage_text) add(`${prefix}_passage`, item.passage_text);
          if (item.passage_title) add(`${prefix}_passageTitle`, item.passage_title);
          // Questions
          if (item.question) add(`${prefix}_question`, item.question);
          if (item.options && Array.isArray(item.options)) {
            item.options.forEach((opt, oi) => add(`${prefix}_opt${oi}`, opt));
          }
          // Transcript / dialogue
          if (item.transcript_title) add(`${prefix}_transcriptTitle`, item.transcript_title);
          if (item.dialogue && Array.isArray(item.dialogue)) {
            item.dialogue.forEach((line, li) => {
              if (line.text) add(`${prefix}_dial${li}`, line.text);
            });
          }
          // Transliteration items
          if (item.source_phrase) add(`${prefix}_source`, item.source_phrase);
          // Speaking / writing prompts
          if (item.prompt_native) add(`${prefix}_prompt`, item.prompt_native);
          // Translation items
          if (item.source_sentence) add(`${prefix}_srcSent`, item.source_sentence);
        });
      });
    }

    if (toFetch.length === 0) return;

    try {
      const promises = toFetch.map(async (item) => {
        try {
          const t = await transliterateText(item.text, language, 'IAST');
          if (t) return { key: item.key, t };
        } catch (err) {
          console.error('Error transliterating', item.key, err);
        }
        return null;
      });
      
      const results = await Promise.all(promises);
      const newTrans = {};
      results.forEach(res => {
        if (res) newTrans[res.key] = res.t;
      });

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
      // Legacy flat schema
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
      // Sections schema: fetch Nastaliq for every native text field so we never show Devanagari
      if (activity.sections && Array.isArray(activity.sections)) {
        activity.sections.forEach((section, si) => {
          if (section.instruction_native && !nativeScriptRenderings[`s${si}_instruction`]) {
            ensureNativeScriptForKey(`s${si}_instruction`, section.instruction_native);
          }
          if (!section.items || !Array.isArray(section.items)) return;
          section.items.forEach((item, ii) => {
            const prefix = `s${si}_i${ii}`;
            if (item.passage_text && !nativeScriptRenderings[`${prefix}_passage`]) {
              ensureNativeScriptForKey(`${prefix}_passage`, item.passage_text);
            }
            if (item.passage_title && !nativeScriptRenderings[`${prefix}_passageTitle`]) {
              ensureNativeScriptForKey(`${prefix}_passageTitle`, item.passage_title);
            }
            if (item.question && !nativeScriptRenderings[`${prefix}_question`]) {
              ensureNativeScriptForKey(`${prefix}_question`, item.question);
            }
            if (item.options && Array.isArray(item.options)) {
              item.options.forEach((opt, oi) => {
                if (opt && !nativeScriptRenderings[`${prefix}_opt${oi}`]) {
                  ensureNativeScriptForKey(`${prefix}_opt${oi}`, opt);
                }
              });
            }
            if (item.transcript_title && !nativeScriptRenderings[`${prefix}_transcriptTitle`]) {
              ensureNativeScriptForKey(`${prefix}_transcriptTitle`, item.transcript_title);
            }
            if (item.dialogue && Array.isArray(item.dialogue)) {
              item.dialogue.forEach((line, li) => {
                if (line.text && !nativeScriptRenderings[`${prefix}_dial${li}`]) {
                  ensureNativeScriptForKey(`${prefix}_dial${li}`, line.text);
                }
              });
            }
            if (item.source_phrase && !nativeScriptRenderings[`${prefix}_source`]) {
              ensureNativeScriptForKey(`${prefix}_source`, item.source_phrase);
            }
            if (item.prompt_native && !nativeScriptRenderings[`${prefix}_prompt`]) {
              ensureNativeScriptForKey(`${prefix}_prompt`, item.prompt_native);
            }
            if (item.source_sentence && !nativeScriptRenderings[`${prefix}_srcSent`]) {
              ensureNativeScriptForKey(`${prefix}_srcSent`, item.source_sentence);
            }
          });
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
