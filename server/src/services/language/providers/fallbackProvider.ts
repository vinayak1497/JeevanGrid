/**
 * Safe fallback provider — always available, never crashes (spec §10, §27).
 * Returns null so LanguageService retains the original text and marks the
 * response fallback:true instead of showing raw API errors to citizens.
 */
import type { DetectResult, SupportedLang, TranslationProvider } from '../types';

export class FallbackTranslationProvider implements TranslationProvider {
  public readonly name = 'fallback';

  public isConfigured(): boolean {
    return true;
  }

  public async translate(
    _text: string,
    _source: SupportedLang,
    _target: SupportedLang
  ): Promise<string | null> {
    return null;
  }

  public async detectLanguage(_text: string): Promise<DetectResult | null> {
    return null;
  }
}
