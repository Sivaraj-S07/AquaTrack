import React, { createContext, useContext, useState, useEffect } from 'react';
import en from './en';
import ta from './ta';

const TRANSLATIONS = { en, ta };
const LANG_KEY = 'at_lang';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'ta');

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

  const toggleLang = () => setLang(l => (l === 'en' ? 'ta' : 'en'));
  const switchLang = (l) => setLang(l);

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang, switchLang, languages: ['en', 'ta'] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
