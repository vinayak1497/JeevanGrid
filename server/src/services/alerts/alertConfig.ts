/**
 * Alert pipeline configuration.
 * Single place that decides which sources are enabled, how fresh data must be,
 * and whether demo records may ever be shown as official warnings.
 *
 * FAIL-CLOSED rule: when in doubt, do not display as an official warning.
 */

export const APPROVED_OFFICIAL_SOURCES = ['SACHET', 'IMD', 'CWC', 'INCOIS'] as const;
export type ApprovedOfficialSource = (typeof APPROVED_OFFICIAL_SOURCES)[number];

export type SourceHealth = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'CONFIGURATION_REQUIRED';

export const SACHET_FEED_URL =
  process.env.SACHET_FEED_URL ||
  'https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

export const alertConfig = {
  /** Explicit kill-switch for demo records. Production MUST be false. */
  get enableDemoAlerts(): boolean {
    // Explicit flag wins; otherwise fall back to legacy DEMO_MODE for local dev.
    if (process.env.ENABLE_DEMO_ALERTS !== undefined && process.env.ENABLE_DEMO_ALERTS !== '') {
      return parseBool(process.env.ENABLE_DEMO_ALERTS, false);
    }
    return parseBool(process.env.DEMO_MODE, false);
  },

  get sachetEnabled(): boolean {
    return parseBool(process.env.SACHET_ENABLED, true);
  },
  get imdEnabled(): boolean {
    return parseBool(process.env.IMD_ENABLED, true);
  },
  get cwcEnabled(): boolean {
    return parseBool(process.env.CWC_ENABLED, false);
  },
  get incoisEnabled(): boolean {
    return parseBool(process.env.INCOIS_ENABLED, false);
  },

  get sachetFeedUrl(): string {
    return SACHET_FEED_URL;
  },
  get imdApiBaseUrl(): string {
    return process.env.IMD_API_BASE_URL || '';
  },
  get imdApiKey(): string {
    return process.env.IMD_API_KEY || '';
  },
  get cwcApiKey(): string {
    return process.env.CWC_API_KEY || '';
  },
  get incoisApiKey(): string {
    return process.env.INCOIS_API_KEY || '';
  },

  /** Web Push (VAPID) — optional. Without keys, notifications stay disabled
   * and the application functions normally (subscriptions still stored). */
  get vapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || '';
  },
  get vapidPrivateKey(): string {
    return process.env.VAPID_PRIVATE_KEY || '';
  },
  get vapidSubject(): string {
    return process.env.VAPID_SUBJECT || 'mailto:ops@jeevangrid.in';
  },

  /** Minutes between SACHET polls. Do not hammer the government endpoint. */
  get sachetPollMinutes(): number {
    const raw = Number(process.env.SACHET_POLL_MINUTES || '10');
    if (!Number.isFinite(raw) || raw < 5) return 10;
    if (raw > 120) return 120;
    return Math.floor(raw);
  },

  /**
   * Freshness window per source in minutes. An alert older than the last
   * successful sync + window is STALE and must not be labelled LIVE.
   */
  freshnessWindowMinutes: {
    SACHET: 90,
    IMD: 180,
    CWC: 180,
    INCOIS: 180,
  } as Record<string, number>,
};

export function isApprovedOfficialSource(source: string | null | undefined): boolean {
  if (!source) return false;
  return (APPROVED_OFFICIAL_SOURCES as readonly string[]).includes(source.toUpperCase());
}
