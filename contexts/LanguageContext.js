import React, { createContext, useState, useEffect } from 'react';

// Centralized list of supported languages so all screens stay in sync.
// Grouped by language family
export const LANGUAGES = [
  // Germanic Languages
  { code: 'english', name: 'English', langCode: 'en', nativeChar: 'EN', nativeName: 'English', countryCode: 'GB', color: '#012169', family: 'Germanic', active: false },
  { code: 'german', name: 'German', langCode: 'de', nativeChar: 'DE', nativeName: 'Deutsch', countryCode: 'DE', color: '#000000', family: 'Germanic', active: false },
  { code: 'dutch', name: 'Dutch', langCode: 'nl', nativeChar: 'NL', nativeName: 'Nederlands', countryCode: 'NL', color: '#FF4F00', family: 'Germanic', active: false },
  { code: 'norwegian', name: 'Norwegian', langCode: 'no', nativeChar: 'NO', nativeName: 'Norsk', countryCode: 'NO', color: '#BA0C2F', family: 'Germanic', active: false },
  
  // Romance Languages
  { code: 'spanish', name: 'Spanish', langCode: 'es', nativeChar: 'ES', nativeName: 'Español', countryCode: 'ES', color: '#C60B1E', family: 'Romance', active: false },
  { code: 'french', name: 'French', langCode: 'fr', nativeChar: 'FR', nativeName: 'Français', countryCode: 'FR', color: '#002654', family: 'Romance', active: false },
  { code: 'portuguese', name: 'Portuguese', langCode: 'pt', nativeChar: 'PT', nativeName: 'Português', countryCode: 'PT', color: '#006600', family: 'Romance', active: false },
  { code: 'italian', name: 'Italian', langCode: 'it', nativeChar: 'IT', nativeName: 'Italiano', countryCode: 'IT', color: '#009246', family: 'Romance', active: false },
  { code: 'catalan', name: 'Catalan', langCode: 'ca', nativeChar: 'CA', nativeName: 'Català', countryCode: 'ES', color: '#FCDD09', family: 'Romance', active: false },
  { code: 'romanian', name: 'Romanian', langCode: 'ro', nativeChar: 'RO', nativeName: 'Română', countryCode: 'RO', color: '#002B7F', family: 'Romance', active: false },
  
  // Celtic Languages
  { code: 'welsh', name: 'Welsh', langCode: 'cy', nativeChar: 'CY', nativeName: 'Cymraeg', countryCode: 'CY', color: '#00843D', family: 'Celtic', active: false },
  { code: 'breton', name: 'Breton', langCode: 'br', nativeChar: 'BR', nativeName: 'Brezhoneg', countryCode: 'FR', color: '#000000', family: 'Celtic', active: false },
  { code: 'irish', name: 'Irish', langCode: 'ga', nativeChar: 'GA', nativeName: 'Gaeilge', countryCode: 'IE', color: '#169B62', family: 'Celtic', active: false },
  { code: 'scottish', name: 'Scottish Gaelic', langCode: 'gd', nativeChar: 'GD', nativeName: 'Gàidhlig', countryCode: 'GB', color: '#0065BD', family: 'Celtic', active: false },
  
  // Dravidian Languages
  { code: 'tamil', name: 'Tamil', langCode: 'ta', nativeChar: '\u0ba4', nativeName: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd', countryCode: 'IN', color: '#CC9900', family: 'Dravidian', active: true },
  { code: 'telugu', name: 'Telugu', langCode: 'te', nativeChar: '\u0c24\u0c46', nativeName: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41', countryCode: 'IN', color: '#006747', family: 'Dravidian', active: true },
  { code: 'kannada', name: 'Kannada', langCode: 'kn', nativeChar: '\u0c95', nativeName: '\u0c95\u0ca8\u0ccd\u0ca8\u0ca1', countryCode: 'IN', color: '#F97316', family: 'Dravidian', active: true },
  { code: 'malayalam', name: 'Malayalam', langCode: 'ml', nativeChar: '\u0d2e', nativeName: '\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02', countryCode: 'IN', color: '#D21034', family: 'Dravidian', active: true },
  
  // Indo-Aryan Languages
  { code: 'hindi', name: 'Hindi', langCode: 'hi', nativeChar: '\u0939\u093f', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940', countryCode: 'IN', color: '#FF9933', family: 'Indo-Aryan', active: true },
  { code: 'urdu', name: 'Urdu', langCode: 'ur', nativeChar: '\u0627', nativeName: '\u0627\u0631\u062f\u0648', countryCode: 'PK', color: '#01411C', family: 'Indo-Aryan', active: true },
  
  // Slavic Languages
  { code: 'russian', name: 'Russian', langCode: 'ru', nativeChar: 'RU', nativeName: 'Русский', countryCode: 'RU', color: '#0039A6', family: 'Slavic', active: false },
  { code: 'ukrainian', name: 'Ukrainian', langCode: 'uk', nativeChar: 'UK', nativeName: 'Українська', countryCode: 'UA', color: '#005BBB', family: 'Slavic', active: false },
  { code: 'polish', name: 'Polish', langCode: 'pl', nativeChar: 'PL', nativeName: 'Polski', countryCode: 'PL', color: '#DC143C', family: 'Slavic', active: false },
  
  // Malayo-Polynesian Languages
  { code: 'malay', name: 'Malay', langCode: 'ms', nativeChar: 'MS', nativeName: 'Bahasa Melayu', countryCode: 'MY', color: '#CC0001', family: 'Malayo-Polynesian', active: false },
  { code: 'indonesian', name: 'Indonesian', langCode: 'id', nativeChar: 'ID', nativeName: 'Bahasa Indonesia', countryCode: 'ID', color: '#FF0000', family: 'Malayo-Polynesian', active: false },
  
  // Iranian Languages
  { code: 'persian', name: 'Persian', langCode: 'fa', nativeChar: '\u0641\u0627', nativeName: '\u0641\u0627\u0631\u0633\u06cc', countryCode: 'IR', color: '#239F40', family: 'Iranian', active: false },
  
  // Semitic Languages
  { code: 'arabic', name: 'Arabic', langCode: 'ar', nativeChar: '\u0639', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', countryCode: 'SA', color: '#165B33', family: 'Semitic', active: false },
  
  // Sino-Tibetan Languages
  { code: 'mandarin', name: 'Mandarin', langCode: 'zh', nativeChar: '\u4e2d', nativeName: '\u4e2d\u6587', countryCode: 'CN', color: '#DE2910', family: 'Sino-Tibetan', active: false },
  
  // Koreanic Languages
  { code: 'korean', name: 'Korean', langCode: 'ko', nativeChar: '\ud55c', nativeName: '\ud55c\uad6d\uc5b4', countryCode: 'KR', color: '#003478', family: 'Koreanic', active: false },
  
  // Japonic Languages
  { code: 'japanese', name: 'Japanese', langCode: 'ja', nativeChar: '\u65e5', nativeName: '\u65e5\u672c\u8a9e', countryCode: 'JP', color: '#BC002D', family: 'Japonic', active: false },
  
  // Turkic Languages
  { code: 'turkish', name: 'Turkish', langCode: 'tr', nativeChar: 'TR', nativeName: 'Türkçe', countryCode: 'TR', color: '#E30A17', family: 'Turkic', active: false },
];

export const LanguageContext = createContext({
  selectedLanguage: 'kannada',
  setSelectedLanguage: () => {},
  userSelectedLanguages: [],
  availableLanguages: [],
  loadUserLanguages: () => {},
});

// Helper function to get available languages based on user selection
export const getAvailableLanguages = (userSelectedLanguages = null) => {
  // If no user selection provided, return all active languages
  if (!userSelectedLanguages || userSelectedLanguages.length === 0) {
    return LANGUAGES.filter(l => l.active);
  }
  // Return only languages the user has selected
  return LANGUAGES.filter(l => userSelectedLanguages.includes(l.code));
};

export function LanguageProvider({ children }) {
  const [selectedLanguage, setSelectedLanguage] = useState('kannada');
  const [userSelectedLanguages, setUserSelectedLanguages] = useState([]);
  const [availableLanguages, setAvailableLanguages] = useState([]);

  const API_BASE_URL = 'http://localhost:8080';

  const loadUserLanguages = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user-languages`);
      if (response.ok) {
        const data = await response.json();
        const languages = data.languages || [];
        setUserSelectedLanguages(languages);
        
        // Update available languages based on user selection
        const available = getAvailableLanguages(languages);
        setAvailableLanguages(available);
        
        // If current selected language is not in user's selection, switch to first available
        if (languages.length > 0 && !languages.includes(selectedLanguage)) {
          setSelectedLanguage(languages[0]);
        }
      }
    } catch (error) {
      console.error('Error loading user languages:', error);
      // Fallback to default languages
      const defaultLangs = ['tamil', 'telugu', 'kannada', 'malayalam', 'hindi', 'urdu'];
      setUserSelectedLanguages(defaultLangs);
      setAvailableLanguages(getAvailableLanguages(defaultLangs));
    }
  };

  useEffect(() => {
    loadUserLanguages();
  }, []);

  return (
    <LanguageContext.Provider value={{ 
      selectedLanguage, 
      setSelectedLanguage,
      userSelectedLanguages,
      availableLanguages,
      loadUserLanguages
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageProvider;
