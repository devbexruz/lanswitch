import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Language = 'en' | 'ru';
export type NativeLanguage = 'uz';

interface LanguageContextType {
  learningLanguage: Language;
  setLearningLanguage: (lang: Language) => void;
  nativeLanguage: NativeLanguage;
  activeLearningLanguages: Language[];
  toggleLearningLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [learningLanguage, setLearningLanguage] = useState<Language>('en'); // Default to English
  const [activeLearningLanguages, setActiveLearningLanguages] = useState<Language[]>(['en', 'ru']);
  const nativeLanguage: NativeLanguage = 'uz'; // Fixed

  const toggleLearningLanguage = (lang: Language) => {
    setActiveLearningLanguages(prev => {
      // Don't allow removing the last language
      if (prev.includes(lang) && prev.length === 1) {
        return prev;
      }
      
      let newActive: Language[];
      if (prev.includes(lang)) {
        newActive = prev.filter(l => l !== lang);
        // If we removed the currently selected language, switch to the first available
        if (learningLanguage === lang && newActive.length > 0) {
          setLearningLanguage(newActive[0]);
        }
      } else {
        newActive = [...prev, lang];
      }
      return newActive;
    });
  };

  return (
    <LanguageContext.Provider value={{ 
      learningLanguage, 
      setLearningLanguage,
      nativeLanguage,
      activeLearningLanguages,
      toggleLearningLanguage
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
