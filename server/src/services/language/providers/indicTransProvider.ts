/**
 * IndicTrans2 provider adapter — Configured interface / awaiting provider
 * credentials (spec §11, §41). Activates automatically when
 * INDICTRANS_BASE_URL is set; until then isConfigured() is false and the
 * LanguageService skips it without any failure.
 *
 * Expected contract (self-hosted IndicTrans2 inference server):
 *   POST {baseUrl}/translate  { text, source, target } -> { translation }
 */
import type { SupportedLang, TranslationProvider } from '../types';

export class IndicTransProvider implements TranslationProvider {
  public readonly name = 'indictrans2';

  private baseUrl(): string {
    return (process.env.INDICTRANS_BASE_URL || '').trim().replace(/\/+$/, '');
  }

  public isConfigured(): boolean {
    return this.baseUrl().length > 0;
  }

  public async translate(text: string, source: SupportedLang, target: SupportedLang): Promise<string | null> {
    const base = this.baseUrl();
    if (!base) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(`${base}/translate`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source, target }),
      });
      if (!res.ok) throw new Error(`IndicTrans2 HTTP ${res.status}`);
      const data: any = await res.json();
      const out = String(data?.translation || '').trim();
      return out || null;
    } catch (e) {
      console.warn('[language] IndicTrans2 unavailable:', (e as Error).message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
