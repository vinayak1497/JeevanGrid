import { alertConfig } from '../alertConfig';
import type { SourceFetchResult } from './types';

/**
 * INCOIS (tsunami / storm surge / coastal hazards). Only publicly accessible
 * machine-readable data is integrated; login-only services are never pretended
 * to be available.
 */
export async function fetchIncoisWarnings(): Promise<SourceFetchResult> {
  const started = Date.now();
  if (!alertConfig.incoisEnabled) {
    return {
      source: 'INCOIS', outcome: 'UNAVAILABLE', recordsFetched: 0, items: [],
      etag: null, lastModified: null, responseTimeMs: Date.now() - started,
      error: 'INCOIS integration disabled (INCOIS_ENABLED=false)',
    };
  }
  if (!alertConfig.incoisApiKey) {
    return {
      source: 'INCOIS', outcome: 'CONFIGURATION_REQUIRED', recordsFetched: 0, items: [],
      etag: null, lastModified: null, responseTimeMs: Date.now() - started,
      error:
        'INCOIS access not configured. Set INCOIS_ENABLED=true and INCOIS_API_KEY ' +
        '(see server/.env.example). No INCOIS advisories are synthesised in the meantime.',
    };
  }
  return {
    source: 'INCOIS', outcome: 'CONFIGURATION_REQUIRED', recordsFetched: 0, items: [],
    etag: null, lastModified: null, responseTimeMs: Date.now() - started,
    error: 'INCOIS machine-readable mapping pending credentialed access docs; no warnings ingested.',
  };
}
