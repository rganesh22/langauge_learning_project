/**
 * Hook for managing dictionary display and word click handling
 * Used by all activity components
 */
import { useState, useEffect } from 'react';

export function useDictionary(defaultLanguage) {
  const [showDictionary, setShowDictionary] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [dictionaryLanguage, setDictionaryLanguage] = useState(defaultLanguage);

  // Sync dictionaryLanguage when the activity's language is resolved / changes
  useEffect(() => {
    if (defaultLanguage && defaultLanguage !== dictionaryLanguage) {
      setDictionaryLanguage(defaultLanguage);
    }
  }, [defaultLanguage]);

  const handleWordClick = (word, wordLanguage = null) => {
    if (word && typeof word === 'string') {
      const cleanedWord = word.trim();
      if (cleanedWord) {
        setInitialSearchQuery(cleanedWord);
        // If wordLanguage is provided, switch dictionary to that language
        if (wordLanguage) {
          setDictionaryLanguage(wordLanguage);
        }
        setShowDictionary(true);
      }
    }
  };

  return {
    showDictionary,
    setShowDictionary,
    initialSearchQuery,
    setInitialSearchQuery,
    dictionaryLanguage,
    setDictionaryLanguage,
    handleWordClick
  };
}

