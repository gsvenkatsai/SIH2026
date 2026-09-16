/**
 * Centralized language configuration + lightweight translation layer.
 *
 * Canonical codes (en-IN / hi-IN / kn-IN) are shared with the backend
 * (backend/app/languages.py is the authoritative source — mirrored here so
 * the frontend never needs a network round-trip to render the selector).
 *
 * Design notes:
 *  - No external i18n dependency: a tiny context provider + t() keeps the
 *    existing zero-dependency React/Vite stack intact.
 *  - Missing keys fall back to English, then to the key itself — the patient
 *    must NEVER see "undefined" / "null".
 *  - Structured clinical data, patient names, and doctor notes are NOT routed
 *    through t(); only static patient-facing UI strings are translated.
 */

import React, { createContext, useContext, useMemo, useState } from 'react';
import enIN from './locales/en-IN.json';
import hiIN from './locales/hi-IN.json';
import knIN from './locales/kn-IN.json';

export const SUPPORTED_LANGUAGES = {
  'en-IN': {
    code: 'en-IN',
    name: 'English',
    native: 'English',
    shortCode: 'en',
    flag: '🇬🇧',
  },
  'hi-IN': {
    code: 'hi-IN',
    name: 'Hindi',
    native: 'हिन्दी',
    shortCode: 'hi',
    flag: '🇮🇳',
  },
  'kn-IN': {
    code: 'kn-IN',
    name: 'Kannada',
    native: 'ಕನ್ನಡ',
    shortCode: 'kn',
    flag: '🇮🇳',
  },
};

export const DEFAULT_LANGUAGE = 'en-IN';

/** Ordered for the patient selector: Kannada, Hindi, English (patient-first). */
export const LANGUAGE_LIST = ['kn-IN', 'hi-IN', 'en-IN'].map((c) => SUPPORTED_LANGUAGES[c]);

const BUNDLES = {
  'en-IN': enIN,
  'hi-IN': hiIN,
  'kn-IN': knIN,
};

/** Accepts legacy names ("Kannada"), short codes ("kn"), and canonical codes. */
export function normalizeLanguage(lang) {
  if (!lang) return DEFAULT_LANGUAGE;
  const key = String(lang).trim().toLowerCase();
  if (key.startsWith('kn') || key === 'kannada') return 'kn-IN';
  if (key.startsWith('hi') || key === 'hindi') return 'hi-IN';
  if (key.startsWith('en') || key === 'english') return 'en-IN';
  return DEFAULT_LANGUAGE;
}

export function getLanguageConfig(lang) {
  return SUPPORTED_LANGUAGES[normalizeLanguage(lang)];
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return normalizeLanguage(window.localStorage.getItem('medikiosk.language'));
    } catch {
      return DEFAULT_LANGUAGE;
    }
  });

  const setLanguage = (lang) => {
    const canonical = normalizeLanguage(lang);
    setLanguageState(canonical);
    try {
      window.localStorage.setItem('medikiosk.language', canonical);
    } catch {
      /* storage unavailable (private mode) — session-only persistence is fine */
    }
  };

  const value = useMemo(() => {
    const bundle = BUNDLES[language] || BUNDLES[DEFAULT_LANGUAGE];
    const fallback = BUNDLES[DEFAULT_LANGUAGE];

    /**
     * t('mic.tapToSpeak') -> translated string.
     * Falls back: current bundle -> English bundle -> key itself.
     * Non-string (undefined/null/object) results are never returned.
     */
    const t = (key, vars) => {
      let str = bundle[key];
      if (typeof str !== 'string') str = fallback[key];
      if (typeof str !== 'string') str = key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replaceAll(`{${k}}`, String(v));
        }
      }
      return str;
    };

    return {
      language,
      setLanguage,
      t,
      config: SUPPORTED_LANGUAGES[language],
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** useLanguage() -> { language, setLanguage, t, config } */
export function useLanguage() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Defensive default so a mis-mounted component never crashes the kiosk.
    const bundle = BUNDLES[DEFAULT_LANGUAGE];
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (key) => (typeof bundle[key] === 'string' ? bundle[key] : key),
      config: SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE],
    };
  }
  return ctx;
}
