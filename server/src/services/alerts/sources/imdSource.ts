import { alertConfig } from '../alertConfig';
import type { SourceFetchResult } from './types';

/**
 * IMD official warning integration.
 *
 * The IMD warning APIs (district/subdivision warnings, cyclone, marine) are
 * credentialed services. JeevanGrid uses ONLY documented endpoints with the
 * configured credentials — it never scrapes mirrors and never synthesises an
 * "IMD warning" from Open-Meteo/weather observations (see alertValidationService
 * .assertImdWarningPayload).
 *
 * Without IMD_API_KEY + IMD_API_BASE_URL the integration reports
 * CONFIGURATION_REQUIRED and yields zero alerts (fail closed).
 */
export async function fetchImdWarnings(): Promise<SourceFetchResult> {
  const started = Date.now();
  if (!alertConfig.imdEnabled) {
    return {
      source: 'IMD', outcome: 'UNAVAILABLE', recordsFetched: 0, items: [],
      etag: null, lastModified: null, responseTimeMs: Date.now() - started,
      error: 'IMD integration disabled (IMD_ENABLED=false)',
    };
  }
  if (!alertConfig.imdApiKey || !alertConfig.imdApiBaseUrl) {
    return {
      source: 'IMD', outcome: 'CONFIGURATION_REQUIRED', recordsFetched: 0, items: [],
      etag: null, lastModified: null, responseTimeMs: Date.now() - started,
      error:
        'IMD warning API credentials not configured. Set IMD_API_BASE_URL and IMD_API_KEY ' +
        '(see server/.env.example). No IMD warnings are synthesised in the meantime.',
    };
  }
  // Credentials present: attempt the documented district-warning endpoint.
  // Any transport failure → UNAVAILABLE (never fall back to fabricated data).
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`${alertConfig.imdApiBaseUrl.replace(/\/$/, '')}/warnings/district`, {
        headers: { Authorization: `Bearer ${alertConfig.imdApiKey}`, Accept: 'application/json' },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        return {
          source: 'IMD', outcome: 'UNAVAILABLE', recordsFetched: 0, items: [],
          etag: null, lastModified: null, responseTimeMs: Date.now() - started,
          error: `IMD API HTTP ${res.status}`,
        };
      }
      // NOTE: exact payload mapping must follow the credentialed API docs provided
      // with the key. Unknown shapes are rejected rather than guessed.
      const data: unknown = await res.json();
      void data;
      return {
        source: 'IMD', outcome: 'OK', recordsFetched: 0, items: [],
        etag: null, lastModified: null, responseTimeMs: Date.now() - started,
        lastSuccessAt: new Date(),
        error: 'IMD endpoint reachable but payload mapping requires the credentialed API docs; no warnings ingested until mapped.',
      };
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    return {
      source: 'IMD', outcome: 'UNAVAILABLE', recordsFetched: 0, items: [],
      etag: null, lastModified: null, responseTimeMs: Date.now() - started,
      error: `IMD fetch failed: ${(e as Error).message}`,
    };
  }
}
