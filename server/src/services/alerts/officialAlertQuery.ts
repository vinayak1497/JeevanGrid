import { prisma } from '../../utils/prisma';
import { alertConfig } from './alertConfig';
import { getSourceStates } from './alertSourceRegistry';
import { validateOfficialEligibility, livenessForAlert } from './alertValidationService';

export interface OfficialAlertFilters {
  state?: string;
  district?: string;
  hazardType?: string;
  severity?: string;
  take?: number;
}

export function toIST(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d) + ' IST';
}

/**
 * Geographic precision of an official alert.
 * - EXACT: source supplied usable polygon/circle geometry with real coordinates.
 * - DISTRICT: district/LGD-oriented identifier only (including rows whose
 *   centroid fell back to the India-centre placeholder or whose geometry is
 *   an unparsed document link). The UI must display "District-level area"
 *   and never claim an exact polygon.
 */
export function geometryPrecisionFor(row: {
  geometry?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): 'EXACT' | 'DISTRICT' {
  const hasGeometry = !!row.geometry && String(row.geometry).trim().length > 2;
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const isFallbackCentroid =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat - 21.0) < 0.001 && Math.abs(lng - 78.0) < 0.001;
  if (hasGeometry && !isFallbackCentroid) return 'EXACT';
  return 'DISTRICT';
}

export function shapeOfficialAlert(row: any, now: Date) {
  const live = livenessForAlert(row.lastCheckedAt, row.source, now);
  const precision = geometryPrecisionFor(row);
  return {
    id: row.id,
    severity: row.severity,
    eventType: row.eventType,
    hazardType: row.hazardType,
    affectedArea: (() => {
      try {
        const a = row.affectedAreas ? JSON.parse(row.affectedAreas) : null;
        return Array.isArray(a) ? a.join('; ') : row.affectedAreas;
      } catch {
        return row.affectedAreas;
      }
    })(),
    state: row.state,
    district: row.district,
    latitude: row.latitude,
    longitude: row.longitude,
    // Never invent precision: centroid fallbacks render as district areas.
    geometryPrecision: precision,
    areaLabel: precision === 'EXACT' ? 'Exact source polygon' : 'District-level area',
    title: row.title,
    headline: row.headline,
    description: row.description,
    instruction: row.instruction,
    urgency: row.urgency,
    certainty: row.certainty,
    authority: row.authority,
    source: row.source,
    sourceType: row.sourceType,
    sourceAlertId: row.sourceAlertId,
    sourceUrl: row.sourceUrl,
    sourceReference: row.sourceReference,
    status: row.status,
    issuedAt: row.issuedAt,
    issuedIST: toIST(row.issuedAt),
    effectiveAt: row.effectiveAt,
    onsetAt: row.onsetAt,
    expiresAt: row.expiresAt,
    validUntilIST: toIST(row.expiresAt),
    lastCheckedAt: row.lastCheckedAt,
    lastCheckedIST: toIST(row.lastCheckedAt),
    ingestedAt: row.ingestedAt,
    verification: {
      verified: true,
      live: live.live,
      stale: live.stale,
      label: live.live ? 'LIVE' : 'STALE',
    },
  };
}

function baseWhere(now: Date): any {
  return {
    sourceType: 'OFFICIAL',
    isVerified: true,
    isDemoData: false,
    status: { in: ['ACTIVE', 'UPDATED'] },
    sourceAlertId: { not: null },
    issuedAt: { not: undefined },
    AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
  };
}

export interface OfficialQueryResult {
  alerts: any[];
  eligible: any[];
  fresh: any[];
  staleCount: number;
  generatedAt: string;
  lastSuccessfulSync: string | null;
  sources: any[];
}

/**
 * Shared fail-closed official-alert query used by /official, /official/nearby,
 * /official/district/:district, dashboards and the risk engine.
 * Returns ONLY verified, non-expired, provenance-complete, freshly-confirmed rows.
 */
export async function queryOfficialAlerts(
  filters: OfficialAlertFilters = {},
  now: Date = new Date()
): Promise<OfficialQueryResult> {
  const whereClause: any = baseWhere(now);
  if (filters.state && filters.state !== 'All') whereClause.state = String(filters.state);
  if (filters.district && filters.district !== 'All') {
    const d = String(filters.district);
    whereClause.OR = [
      { district: { contains: d, mode: 'insensitive' } },
      { affectedAreas: { contains: d, mode: 'insensitive' } },
    ];
  }
  if (filters.hazardType && filters.hazardType !== 'All') {
    whereClause.hazardType = { contains: String(filters.hazardType) };
  }
  if (filters.severity && filters.severity !== 'All') {
    whereClause.severity = String(filters.severity);
  }

  const candidates = await prisma.disasterAlert.findMany({
    where: whereClause,
    orderBy: { issuedAt: 'desc' },
    take: Math.min(Math.max(filters.take ?? 200, 1), 500),
  });

  // Per-row fail-closed gate (belt and braces on top of the DB filter).
  const eligible = candidates.filter((a) => {
    if (!a.sourceUrl && !a.sourceReference) return false;
    return validateOfficialEligibility(a as any, now).ok;
  });

  // Freshness: drop rows whose source has not confirmed them within its window.
  const fresh = eligible.filter((a) => livenessForAlert(a.lastCheckedAt, a.source, now).live);

  const sources = await getSourceStates().catch(() => []);
  const successTimes = sources
    .map((s) => (s.lastSuccessAt ? new Date(s.lastSuccessAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  const lastSuccessfulSync = successTimes.length
    ? new Date(Math.max(...successTimes)).toISOString()
    : null;

  return {
    alerts: fresh.map((a) => shapeOfficialAlert(a, now)),
    eligible,
    fresh,
    staleCount: eligible.length - fresh.length,
    generatedAt: now.toISOString(),
    lastSuccessfulSync,
    sources,
  };
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export const OFFICIAL_NOTE =
  '100% source traceability: every warning carries its issuing authority, source alert ID, original source link, issue/expiry times and last synchronization time. JeevanGrid never claims 100% accuracy.';

export function shapeSources(sources: any[]) {
  return sources.map((s) => ({
    name: s.name,
    authority: s.authority,
    enabled: s.enabled,
    status: s.status,
    lastAttemptAt: s.lastAttemptAt,
    lastSuccessAt: s.lastSuccessAt,
    lastDataAt: s.lastDataAt,
    lastError: s.lastError,
    responseTimeMs: s.responseTimeMs,
    recordsFetched: s.recordsFetched,
    recordsAccepted: s.recordsAccepted,
    recordsRejected: s.recordsRejected,
  }));
}

// Re-exported so other services keep a single import surface.
export { alertConfig };
