import { alertConfig } from '../alertConfig';
import type { SourceFetchResult } from './types';

/**
 * CWC flood warnings: credited ONLY when the actual CWC source provides the
 * information. Rainfall + nearby river NEVER becomes a "CWC warning" —
 * that inference belongs to JeevanGrid's own flood-risk model (INTELLIGENCE).
 */
export async function fetchCwcWarnings(): Promise<SourceFetchResult> {
  const started = Date.now();
  if (!alertConfig.cwcEnabled) {
    return {
      source: 'CWC', outcome: 'UNAVAILABLE', recordsFetched: 0, items: [],
      etag: null, lastModified: null, responseTimeMs: Date.now() - started,
      error: 'CWC integration disabled (CWC_ENABLED=false)',
    };
  }
  if (!alertConfig.cwcApiKey) {
    return {
      source: 'CWC', outcome: 'CONFIGURATION_REQUIRED', recordsFetched: 0, items: [],
      etag: null, lastModified: null, responseTimeMs: Date.now() - started,
      error:
        'CWC flood-forecast access not configured. Set CWC_ENABLED=true and CWC_API_KEY ' +
        '(see server/.env.example). No CWC warnings are inferred in the meantime.',
    };
  }
  return {
    source: 'CWC', outcome: 'CONFIGURATION_REQUIRED', recordsFetched: 0, items: [],
    etag: null, lastModified: null, responseTimeMs: Date.now() - started,
    error: 'CWC machine-readable mapping pending credentialed access docs; no warnings ingested.',
  };
}
