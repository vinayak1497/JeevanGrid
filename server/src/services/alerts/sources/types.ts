export interface SourceFetchResult {
  source: string;
  /** NOT_MODIFIED = HTTP 304, nothing reprocessed. OK = fresh data parsed. */
  outcome: 'OK' | 'NOT_MODIFIED' | 'UNAVAILABLE' | 'CONFIGURATION_REQUIRED';
  recordsFetched: number;
  /** Raw parsed CAP-ish items ready for normalization. */
  items: import('../alertNormalizationService').CapInfo[];
  etag: string | null;
  lastModified: string | null;
  responseTimeMs: number;
  error?: string;
  lastSuccessAt?: Date;
}
