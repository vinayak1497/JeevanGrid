/**
 * IndicTrans2 provider adapter — Cloudflare Workers AI–backed,
 * with fallback to the legacy self‑hosted base URL path (currently disabled).
 *
 * Activates automatically when CLOUDFLARE_ACCOUNT_ID and
 * CLOUDFLARE_API_TOKEN are both set in the environment.
 * Until then isConfigured() is false and the LanguageService skips it
 * without any failure — exactly like the existing BHASHINI path.
 *
 * Model: @cf/ai4bharat/indictrans2-en-indic-1B (English → Indic only)
 *
 * Expected contract (Cloudflare Workers AI):
 *   POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/ai4bharat/indictrans2-en-indic-1B
 *   Authorization: Bearer {API_TOKEN}
 *   Content-Type: application/json
 *   Body: { text, target_language: "mar_Deva" | "hin_Deva" | "guj_Gujr" | "asm_Beng" }
 *   Response: { result: { translation: "..." } } or { translation: "..." }
 *
 * Language mappings (target_language parameter):
 *   Hindi:   hin_Deva
 *   Marathi: mar_Deva
 *   Gujarati: guj_Gujr
 *   Assamese: asm_Beng
 *
 * This provider supports English → Indic translation only.
 * Return null for any other source→target combination so the next provider
 * in the pipeline (Bhashini → Fallback → English) can handle them.
 */
import type { SupportedLang, TranslationProvider } from '../types';

// Mapping from JeevanGrid SupportedLang to Cloudflare target_language codes.
// English is included for type completeness but this provider returns null
// when source !== 'en', so it will never be used for English→English translation.
const CLOUDFLARE_TARGET: Record<SupportedLang, string> = {
  en: 'en_Deva',   // English (Devanagari form) — type-required, never used
  hi: 'hin_Deva',  // Hindi
  mr: 'mar_Deva',  // Marathi
  gu: 'guj_Gujr',  // Gujarati
  as: 'asm_Beng',  // Assamese
};

/**
 * Cloudflare Workers AI endpoint for IndicTrans2.
 * The NUGEN_API_KEY and NUGEN_ENDPOINT are NOT used — this provider
 * uses its own CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
 */
export class IndicTransProvider implements TranslationProvider {
  public readonly name = 'indictrans2';

  // ------------------------------------------------------------------
  // Cloudflare-backed path
  // ------------------------------------------------------------------
  private cloudflareAccountId(): string {
    return (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  }
  private cloudflareApiToken(): string {
    return (process.env.CLOUDFLARE_API_TOKEN || '').trim();
  }

  /** Returns true only when BOTH credentials are present and non‑empty. */
  public isConfigured(): boolean {
    return (
      this.cloudflareAccountId().length > 0 &&
      this.cloudflareApiToken().length > 0
    );
    // The legacy INDICTRANS_BASE_URL path is deliberately omitted from
    // isConfigured() so that setting only one of the two does not cause
    // unexpected activation.  The LanguageService decides which provider
    // to use based on isConfigured() alone.
  }

  /** Map a JeevanGrid SupportedLang to the Cloudflare target_language string. */
  private targetLanguage(lang: SupportedLang): string {
    const mapped = CLOUDFLARE_TARGET[lang];
    if (!mapped) {
      console.warn(
        `[language] Unsupported lang ${lang} for IndicTrans2 Cloudflare`
      );
      return 'hin_Deva'; // safe default, will still be filtered by source check
    }
    return mapped;
  }

  /**
   * Translate text using Cloudflare Workers AI IndicTrans2 model.
   *
   * - Only English → Indic is supported. If source is not English, return null
   *   so the next provider in the pipeline (Bhashini → Fallback → English original)
   *   can handle it.
   * - Returns null when credentials are missing, the API errors, or the
   *   response contains no translation, so the LanguageService falls through
   *   to the next provider.
   *
   * @param text The source text (expected to be in English)
   * @param source The detected/source language (must be 'en' for this provider)
   * @param target The target language (one of supported Indic scripts)
   * @returns Translated text string, or null if unsupported/invalid
   */
  public async translate(
    text: string,
    source: SupportedLang,
    target: SupportedLang
  ): Promise<string | null> {
    // 1️⃣ Language guard: only English source is supported by this model.
    if (source !== 'en') {
      // Let the next provider handle it (Bhashini, fallback, English original).
      return null;
    }

    // 2️⃣ Credentials guard: must have both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.
    if (!this.isConfigured()) {
      return null; // falls through to Bhashini → Fallback → English
    }

    const accountId = this.cloudflareAccountId();
    const apiToken = this.cloudflareApiToken();
    const cgTarget = this.targetLanguage(target);
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/ai4bharat/indictrans2-en-indic-1B`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          text,
          target_language: cgTarget,
        }),
      });

      // 3️⃣ HTTP error handling – fall through to next provider.
      if (!res.ok) {
        const txt = await res.text().catch(() => 'no body');
        console.warn(
          `[language] IndicTrans2 Cloudflare HTTP ${res.status}: ${txt.slice(
            0,
            200
          )}`
        );
        return null;
      }

      // 4️⃣ Parse response – Cloudflare Workers AI may return
      //    { result: { translation: "..." } } or { translation: "..." }.
      const data = (await res.json()) as any;
      const translation =
        data?.translation ?? data?.result?.translation ?? data?.text;

      const out = String(translation || '').trim();
      if (!out) {
        // Empty translation – fall through to next provider.
        return null;
      }

      return out;
    } catch (e) {
      // 5️⃣ Network / abort / unexpected error – fall through gracefully.
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'AbortError') {
        console.warn(
          '[language] IndicTrans2 Cloudflare translate failed:',
          msg
        );
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}