/**
 * JeevanGrid LanguageService — centralized translation abstraction (spec §3, §9–§10).
 *
 * UI LANGUAGE (static bundles) lives in the frontend and never hits these
 * endpoints on render. These endpoints exist ONLY for dynamic content:
 * AI responses, transcribed speech, and server-generated guidance.
 *
 * Pipeline: OFFICIAL SOURCE -> STRUCTURED WARNING -> LOCALIZATION -> USER.
 * Official warnings are never freely rewritten (spec §8).
 */

export type SupportedLang = 'en' | 'hi' | 'mr' | 'gu' | 'as';

export const SUPPORTED_LANGS: SupportedLang[] = ['en', 'hi', 'mr', 'gu', 'as'];

export const LANG_META: Record<SupportedLang, { nativeName: string; englishName: string; bcp47: string }> = {
  en: { nativeName: 'English', englishName: 'English', bcp47: 'en-IN' },
  hi: { nativeName: 'हिन्दी', englishName: 'Hindi', bcp47: 'hi-IN' },
  mr: { nativeName: 'मराठी', englishName: 'Marathi', bcp47: 'mr-IN' },
  gu: { nativeName: 'ગુજરાતી', englishName: 'Gujarati', bcp47: 'gu-IN' },
  as: { nativeName: 'অসমীয়া', englishName: 'Assamese', bcp47: 'as-IN' },
};

export function normalizeLang(input: unknown): SupportedLang | null {
  if (typeof input !== 'string') return null;
  const short = input.trim().toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGS as string[]).includes(short) ? (short as SupportedLang) : null;
}

export interface TranslateRequest {
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
}

export interface TranslateResult {
  translation: string;
  sourceLanguage: SupportedLang;
  targetLanguage: SupportedLang;
  provider: string;
  fallback: boolean;
}

export interface DetectResult {
  language: SupportedLang;
  confidence: 'high' | 'medium' | 'low';
  provider: string;
  /** True when input was mixed/uncertain — caller should NOT pester the user. */
  mixed: boolean;
}

/** Provider contract — add IndicTrans2/Bhashini/etc behind this interface. */
export interface TranslationProvider {
  readonly name: string;
  /** True when credentials/endpoints are configured and usable. */
  isConfigured(): boolean;
  translate(text: string, source: SupportedLang, target: SupportedLang): Promise<string | null>;
  detectLanguage?(text: string): Promise<DetectResult | null>;
}
