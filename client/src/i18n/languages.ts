/**
 * JeevanGrid global language configuration.
 *
 * Single source of truth for supported UI languages.
 * Assistant-level strings live in components/ai/assistantI18n.ts and reuse
 * these codes; the global provider syncs both so the citizen selects a
 * language once (header) and the whole experience — including AI — follows.
 */

export type AppLang = 'en' | 'hi' | 'mr' | 'gu' | 'as';

export interface AppLanguage {
  code: AppLang;
  /** Native script name shown in the dropdown (no flags, no emojis). */
  nativeName: string;
  /** English name for screen readers / secondary label. */
  englishName: string;
  /** BCP-47 tag for SpeechRecognition / SpeechSynthesis. */
  speechTag: string;
}

export const SUPPORTED_LANGUAGES: AppLanguage[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', speechTag: 'en-IN' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', speechTag: 'hi-IN' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', speechTag: 'mr-IN' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', speechTag: 'gu-IN' },
  { code: 'as', nativeName: 'অসমীয়া', englishName: 'Assamese', speechTag: 'as-IN' },
];

export const DEFAULT_LANG: AppLang = 'en';
export const STORAGE_KEY = 'jeevangrid.language';

export function isAppLang(v: unknown): v is AppLang {
  return typeof v === 'string' && (SUPPORTED_LANGUAGES as AppLanguage[]).some((l) => l.code === v);
}

/**
 * Detection priority (spec §6):
 *  1. explicit user selection (localStorage)
 *  2. saved profile preference (applied by caller when known)
 *  3. browser language
 *  4. English fallback
 * Never auto-switches after an explicit choice.
 */
export function detectInitialLanguage(savedProfileLang?: unknown): AppLang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isAppLang(stored)) return stored;
  } catch {
    /* storage unavailable (private mode) — continue */
  }
  if (isAppLang(savedProfileLang)) return savedProfileLang;
  try {
    const nav = (navigator.language || '').slice(0, 2).toLowerCase();
    if (isAppLang(nav)) return nav;
    const langs = navigator.languages || [];
    for (const l of langs) {
      const short = String(l).slice(0, 2).toLowerCase();
      if (isAppLang(short)) return short;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function persistLanguage(lang: AppLang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* guest / private mode — selection still applies for this session */
  }
}
