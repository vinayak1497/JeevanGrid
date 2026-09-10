/**
 * Bhashini provider adapter — Configured interface / awaiting provider
 * credentials (spec §11, §41). Activates when BHASHINI_API_KEY and
 * BHASHINI_BASE_URL are both set. Secrets stay server-side (spec §34).
 */
import type { SupportedLang, TranslationProvider } from '../types';

export class BhashiniProvider implements TranslationProvider {
  public readonly name = 'bhashini';

  private get key(): string {
    return (process.env.BHASHINI_API_KEY || '').trim();
  }

  private get baseUrl(): string {
    return (process.env.BHASHINI_BASE_URL || '').trim().replace(/\/+$/, '');
  }

  public isConfigured(): boolean {
    return this.key.length > 0 && this.baseUrl.length > 0;
  }

  public async translate(text: string, source: SupportedLang, target: SupportedLang): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
        body: JSON.stringify({ text, sourceLanguage: source, targetLanguage: target }),
      });
      if (!res.ok) throw new Error(`Bhashini HTTP ${res.status}`);
      const data: any = await res.json();
      const out = String(data?.translation || data?.translatedText || '').trim();
      return out || null;
    } catch (e) {
      console.warn('[language] Bhashini unavailable:', (e as Error).message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
