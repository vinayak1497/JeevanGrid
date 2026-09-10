/**
 * Global language provider — the single place UI language lives (spec §3).
 *
 * Components consume `useLanguage()` and call `t('nav.home')` instead of
 * hardcoding user-facing strings. Static bundles only — no translation API
 * on render (spec §25). Dynamic translation goes through the backend
 * LanguageService (`/api/language/*`), never from render paths.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANG,
  detectInitialLanguage,
  persistLanguage,
  type AppLang,
} from './languages';
import { DICTIONARIES, lookup } from './dictionaries';

interface LanguageContextValue {
  lang: AppLang;
  setLang: (l: AppLang) => void;
  /** Semantic-key lookup with English fallback. */
  t: (path: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode; initialLang?: AppLang }> = ({
  children,
  initialLang,
}) => {
  const [lang, setLangState] = useState<AppLang>(() =>
    initialLang && DICTIONARIES[initialLang] ? initialLang : detectInitialLanguage()
  );

  const setLang = useCallback((l: AppLang) => {
    if (!DICTIONARIES[l]) return;
    setLangState(l);
    persistLanguage(l);
  }, []);

  useEffect(() => {
    // Accessibility + typography: expose language to AT and CSS.
    try {
      document.documentElement.lang = lang;
    } catch {
      /* non-DOM environment */
    }
  }, [lang]);

  const t = useCallback((path: string) => lookup(lang, path), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

/** Re-export for convenience. */
export { DEFAULT_LANG };
export type { AppLang };
