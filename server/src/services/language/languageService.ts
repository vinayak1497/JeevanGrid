/**
 * LanguageService — centralized translation/detection entry point (spec §9).
 *
 * Priority: IndicTrans2 -> Bhashini -> safe fallback -> English original.
 * - In-memory cache keyed by (source, target, textHash) (spec §26).
 * - Never throws provider internals; failures retain original text.
 * - No sensitive data cached beyond the translated string itself.
 */
import { createHash } from 'crypto';
import {
  LANG_META,
  SUPPORTED_LANGS,
  normalizeLang,
  type DetectResult,
  type SupportedLang,
  type TranslateResult,
  type TranslationProvider,
} from './types';
import { IndicTransProvider } from './providers/indicTransProvider';
import { BhashiniProvider } from './providers/bhashiniProvider';
import { FallbackTranslationProvider } from './providers/fallbackProvider';

const MAX_CACHED_ENTRIES = 2000;
const MAX_TEXT_LENGTH = 4000;

const cache = new Map<string, { translation: string; provider: string }>();

function cacheKey(source: SupportedLang, target: SupportedLang, text: string): string {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 32);
  return `${source}:${target}:${hash}`;
}

function setCached(key: string, value: { translation: string; provider: string }): void {
  if (cache.size >= MAX_CACHED_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

/** Script-range heuristic tolerant to Hinglish / mixed input (spec §36). */
function heuristicDetect(text: string): DetectResult {
  const t = text.trim();
  if (!t) return { language: 'en', confidence: 'low', provider: 'heuristic', mixed: false };
  const devanagari = (t.match(/[\u0900-\u097F]/g) || []).length;
  const gujarati = (t.match(/[\u0A80-\u0AFF]/g) || []).length;
  const bengaliAssamese = (t.match(/[\u0980-\u09FF]/g) || []).length;
  const latin = (t.match(/[A-Za-z]/g) || []).length;
  const total = Math.max(1, devanagari + gujarati + bengaliAssamese + latin);
  const mixed = [devanagari, gujarati, bengaliAssamese, latin].filter((n) => n / total > 0.15).length > 1;

  if (gujarati / total > 0.3) return { language: 'gu', confidence: mixed ? 'medium' : 'high', provider: 'heuristic', mixed };
  if (bengaliAssamese / total > 0.3) return { language: 'as', confidence: mixed ? 'medium' : 'high', provider: 'heuristic', mixed };
  if (devanagari / total > 0.3) {
    // Devanagari shared by Hindi/Marathi — disambiguate with common markers,
    // default to Hindi only when uncertain (caller keeps explicit choice).
    const marathiMarkers = /आहे|नाही|काय|तुम्ही|माझा|माझी|होय|कुठे/.test(t);
    const hindiMarkers = /है|नहीं|क्या|आप|मेरा|मेरी|कहाँ|हूँ/.test(t);
    if (marathiMarkers && !hindiMarkers) return { language: 'mr', confidence: 'medium', provider: 'heuristic', mixed };
    if (hindiMarkers && !marathiMarkers) return { language: 'hi', confidence: 'medium', provider: 'heuristic', mixed };
    return { language: 'hi', confidence: 'low', provider: 'heuristic', mixed: true };
  }
  return { language: 'en', confidence: latin ? 'high' : 'low', provider: 'heuristic', mixed };
}

class LanguageService {
  private providers: TranslationProvider[];

  constructor() {
    // Priority order per spec §10.
    this.providers = [new IndicTransProvider(), new BhashiniProvider(), new FallbackTranslationProvider()];
  }

  public supportedLanguages(): Array<{ code: SupportedLang; nativeName: string; englishName: string; bcp47: string }> {
    return SUPPORTED_LANGS.map((code) => ({ code, ...LANG_META[code] }));
  }

  public activeProvider(): string {
    return this.providers.find((p) => p.isConfigured())?.name || 'fallback';
  }

  public async detectLanguage(text: string): Promise<DetectResult> {
    const clean = String(text || '').slice(0, MAX_TEXT_LENGTH);
    for (const p of this.providers) {
      if (!p.isConfigured() || !p.detectLanguage) continue;
      try {
        const r = await p.detectLanguage(clean);
        if (r && normalizeLang(r.language)) return r;
      } catch (e) {
        console.warn(`[language] detect via ${p.name} failed:`, (e as Error).message);
      }
    }
    return heuristicDetect(clean);
  }

  public async translate(args: { text: string; sourceLanguage?: string; targetLanguage: string }): Promise<TranslateResult> {
    const target = normalizeLang(args.targetLanguage) || 'en';
    const text = String(args.text || '').slice(0, MAX_TEXT_LENGTH);
    if (!text.trim()) {
      return { translation: '', sourceLanguage: 'en', targetLanguage: target, provider: 'none', fallback: true };
    }
    const detected = normalizeLang(args.sourceLanguage) || (await this.detectLanguage(text)).language;
    if (detected === target) {
      return { translation: text, sourceLanguage: detected, targetLanguage: target, provider: 'none', fallback: false };
    }
    const key = cacheKey(detected, target, text);
    const hit = cache.get(key);
    if (hit) {
      return { translation: hit.translation, sourceLanguage: detected, targetLanguage: target, provider: hit.provider, fallback: hit.provider === 'fallback' };
    }
    for (const p of this.providers) {
      if (!p.isConfigured()) continue;
      try {
        const out = await p.translate(text, detected, target);
        if (out) {
          setCached(key, { translation: out, provider: p.name });
          return { translation: out, sourceLanguage: detected, targetLanguage: target, provider: p.name, fallback: false };
        }
      } catch (e) {
        console.warn(`[language] translate via ${p.name} failed:`, (e as Error).message);
      }
    }
    // Graceful fallback: retain original, never crash the disaster app (§27).
    return { translation: text, sourceLanguage: detected, targetLanguage: target, provider: 'fallback', fallback: true };
  }
}

export const languageService = new LanguageService();
