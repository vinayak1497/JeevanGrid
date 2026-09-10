import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { alertConfig } from '../services/alerts/alertConfig';
import { getSourceStates } from '../services/alerts/alertSourceRegistry';
import { syncAllSources, syncSource } from '../services/alerts/alertIngestionService';
import { expireStaleAlerts } from '../services/alerts/alertExpirationService';
import { validateOfficialEligibility } from '../services/alerts/alertValidationService';
import { writeAuditLog } from '../services/alerts/alertDeduplicationService';
import {
  queryOfficialAlerts,
  shapeOfficialAlert,
  shapeSources,
  haversineKm,
  OFFICIAL_NOTE,
} from '../services/alerts/officialAlertQuery';

/**
 * GET /api/alerts/official — ONLY active, verified, non-expired,
 * authoritative-source alerts. Fail closed: anything unverifiable is excluded.
 */
export async function listOfficialAlerts(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    await expireStaleAlerts(now).catch(() => undefined);

    const { state, district, hazardType, severity } = req.query;
    const result = await queryOfficialAlerts(
      {
        state: state ? String(state) : undefined,
        district: district ? String(district) : undefined,
        hazardType: hazardType ? String(hazardType) : undefined,
        severity: severity ? String(severity) : undefined,
      },
      now
    );

    res.json({
      alerts: result.alerts,
      // Stale-but-otherwise-valid rows are reported separately — never as LIVE.
      staleCount: result.staleCount,
      generatedAt: result.generatedAt,
      lastSuccessfulSync: result.lastSuccessfulSync,
      demoMode: alertConfig.enableDemoAlerts,
      sources: shapeSources(result.sources),
      note: OFFICIAL_NOTE,
    });
  } catch (error) {
    console.error('List official alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch official alerts.' });
  }
}

/**
 * GET /api/alerts/official/nearby?lat=&lon=&radiusKm=
 * Location-aware warnings: official alerts whose stored centroid falls within
 * radiusKm of the point, PLUS alerts text-matched to the reverse-geocoded
 * district/state at that point (most CAP rows carry district identifiers
 * without precise polygons). District-level rows keep their
 * geometryPrecision ("District-level area") — proximity is advisory only.
 */
const reverseCache = new Map<string, { district: string; state: string; ts: number }>();

async function reverseDistrict(lat: number, lon: number): Promise<{ district: string; state: string } | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = reverseCache.get(key);
  if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
    return { district: cached.district, state: cached.state };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
        { signal: ctrl.signal, headers: { 'User-Agent': 'JeevanGrid-Disaster-Platform/1.0' } }
      );
      if (!res.ok) return null;
      const raw: any = await res.json();
      const addr = raw?.address || {};
      const district = String(addr.state_district || addr.county || addr.city || addr.town || '').trim();
      const state = String(addr.state || '').trim();
      if (!district && !state) return null;
      reverseCache.set(key, { district, state, ts: Date.now() });
      return { district, state };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

function alertMentions(alert: any, name: string): boolean {
  if (!name || name.length < 2) return false;
  const n = name.toLowerCase();
  return (
    String(alert.district || '').toLowerCase().includes(n) ||
    String(alert.state || '').toLowerCase().includes(n) ||
    String(alert.affectedArea || '').toLowerCase().includes(n)
  );
}

export async function getNearbyOfficialAlerts(req: Request, res: Response): Promise<void> {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon ?? req.query.lng);
    const radiusKm = Math.min(2000, Math.max(10, Number(req.query.radiusKm) || 100));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      res.status(400).json({ error: 'Valid lat (-90..90) and lon (-180..180) query params are required.' });
      return;
    }
    const now = new Date();
    await expireStaleAlerts(now).catch(() => undefined);
    const result = await queryOfficialAlerts({ take: 500 }, now);
    const rev = await reverseDistrict(lat, lon).catch(() => null);
    const within = result.alerts
      .map((a: any) => {
        const distKm =
          typeof a.latitude === 'number' && typeof a.longitude === 'number'
            ? Math.round(haversineKm(lat, lon, a.latitude, a.longitude) * 10) / 10
            : null;
        const textMatch = rev
          ? alertMentions(a, rev.district) || alertMentions(a, rev.state)
          : false;
        return {
          ...a,
          distanceKm: distKm,
          matchedBy: textMatch ? 'district' : 'proximity',
        };
      })
      .filter(
        (a: any) =>
          (a.distanceKm !== null && a.distanceKm <= radiusKm) || a.matchedBy === 'district'
      )
      .sort((x: any, y: any) => (x.distanceKm ?? 1e9) - (y.distanceKm ?? 1e9));
    res.json({
      alerts: within,
      center: { lat, lng: lon },
      radiusKm,
      resolvedArea: rev,
      staleCount: result.staleCount,
      generatedAt: result.generatedAt,
      lastSuccessfulSync: result.lastSuccessfulSync,
      sources: shapeSources(result.sources),
      note: OFFICIAL_NOTE,
    });
  } catch (error) {
    console.error('Nearby official alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby official alerts.' });
  }
}

/**
 * GET /api/alerts/official/district/:district
 * District-targeted warnings for subscriptions, staging and GPS resolution.
 */
export async function getDistrictOfficialAlerts(req: Request, res: Response): Promise<void> {
  try {
    const district = String(req.params.district || '').trim();
    if (!district) {
      res.status(400).json({ error: 'District path param is required.' });
      return;
    }
    const now = new Date();
    await expireStaleAlerts(now).catch(() => undefined);
    const result = await queryOfficialAlerts({ district, take: 200 }, now);
    res.json({
      alerts: result.alerts,
      district,
      staleCount: result.staleCount,
      generatedAt: result.generatedAt,
      lastSuccessfulSync: result.lastSuccessfulSync,
      sources: shapeSources(result.sources),
      note: OFFICIAL_NOTE,
    });
  } catch (error) {
    console.error('District official alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch district official alerts.' });
  }
}

/**
 * GET /api/alerts/official/:id — single verified warning with the same
 * fail-closed gate. Demo/expired/cancelled rows are never served as official.
 */
export async function getOfficialAlertById(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    await expireStaleAlerts(now).catch(() => undefined);
    const row = await prisma.disasterAlert.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Official warning not found.' });
      return;
    }
    if (!row.sourceUrl && !row.sourceReference) {
      res.status(404).json({ error: 'Official warning not found.' });
      return;
    }
    const check = validateOfficialEligibility(row as any, now);
    if (!check.ok) {
      const gone = /expired|cancelled/i.test(check.reasons.join(';'));
      res.status(gone ? 410 : 404).json({
        error: gone ? 'This official warning is no longer active.' : 'Official warning not found.',
        reasons: check.reasons,
      });
      return;
    }
    const sources = await getSourceStates().catch(() => []);
    res.json({ alert: shapeOfficialAlert(row, now), sources: shapeSources(sources), note: OFFICIAL_NOTE });
  } catch (error) {
    console.error('Get official alert error:', error);
    res.status(500).json({ error: 'Failed to fetch official warning.' });
  }
}

/**
 * POST /api/alerts/official/:id/stage — District/EOC response staging.
 * Creates an INTERNAL JeevanGrid operational record (Incident) linked to the
 * official warning and writes a STAGED audit entry. This is explicitly a
 * JeevanGrid operational action — it never means JeevanGrid issued a warning.
 */
export async function stageOfficialAlert(req: any, res: Response): Promise<void> {
  try {
    const now = new Date();
    const row = await prisma.disasterAlert.findUnique({ where: { id: req.params.id } });
    if (!row) {
      res.status(404).json({ error: 'Official warning not found.' });
      return;
    }
    if (!validateOfficialEligibility(row as any, now).ok) {
      res.status(410).json({ error: 'Only active verified official warnings can be staged.' });
      return;
    }
    const officer = `${req.user?.name || 'District Officer'} (${req.user?.role || 'EOC'})`;
    const incident = await prisma.incident.create({
      data: {
        title: `Response staging: ${row.eventType || row.hazardType} — ${row.district}, ${row.state}`,
        description:
          `JeevanGrid operational staging for OFFICIAL warning "${row.headline || row.title}" ` +
          `(source ${row.source}, alert ID ${row.sourceAlertId}, issued ${row.issuedAt.toISOString()}). ` +
          `Staged by ${officer}. This incident tracks the district response; ` +
          `the warning itself was issued by ${row.authority || row.source}, not JeevanGrid.`,
        emergencyType: row.hazardType,
        urgency: row.severity === 'CRITICAL' ? 'Critical' : row.severity === 'WARNING' ? 'High' : 'Moderate',
        status: 'NEW',
        district: row.district,
        state: row.state,
        locationName: `${row.district}, ${row.state}`,
        latitude: row.latitude,
        longitude: row.longitude,
      },
    });
    await writeAuditLog({
      action: 'STAGED',
      source: row.source,
      sourceAlertId: row.sourceAlertId,
      alertId: row.id,
      reason: `staged to incident ${incident.id} by ${officer}`,
    });
    res.json({
      ok: true,
      incidentId: incident.id,
      message: 'District response staged as an internal JeevanGrid operational record.',
    });
  } catch (error) {
    console.error('Stage official alert error:', error);
    res.status(500).json({ error: 'Failed to stage district response.' });
  }
}

/** GET /api/alerts/sources — registry health so UI can say "unavailable" honestly. */
export async function getAlertSources(_req: Request, res: Response): Promise<void> {
  try {
    const sources = await getSourceStates();
    const successTimes = sources
      .map((s) => (s.lastSuccessAt ? new Date(s.lastSuccessAt).getTime() : NaN))
      .filter((t) => Number.isFinite(t));
    res.json({
      generatedAt: new Date().toISOString(),
      lastSuccessfulSync: successTimes.length
        ? new Date(Math.max(...successTimes)).toISOString()
        : null,
      sources: sources.map((s) => ({
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
        feedUrl: s.name === 'SACHET' ? alertConfig.sachetFeedUrl : undefined,
      })),
    });
  } catch (error) {
    console.error('Get alert sources error:', error);
    res.status(500).json({ error: 'Failed to fetch alert source health.' });
  }
}

/** POST /api/alerts/sync — manual ingestion trigger (EOC / debugging). */
export async function triggerAlertSync(req: Request, res: Response): Promise<void> {
  try {
    const { source, force } = req.query as { source?: string; force?: string };
    const opts = { force: force === 'true' || force === '1' };
    if (source) {
      const result = await syncSource(String(source), opts);
      res.json({ syncedAt: new Date().toISOString(), results: [result] });
      return;
    }
    const summary = await syncAllSources(opts);
    res.json(summary);
  } catch (error) {
    console.error('Alert sync error:', error);
    res.status(500).json({ error: 'Alert synchronization failed.' });
  }
}

/**
 * GET /api/alerts/intelligence — explicitly NOT official warnings.
 * Points consumers at the risk engine + community channels instead of mixing types.
 */
export async function getIntelligenceInfo(_req: Request, res: Response): Promise<void> {
  res.json({
    type: 'JEEVANGRID_INTELLIGENCE',
    disclaimer:
      'This is a JeevanGrid risk assessment and is not an official government warning. ' +
      'It is calculated from rainfall, terrain, historical risk and weather forecasts.',
    riskEndpoint: '/api/risk/:location',
    communityEndpoint: '/api/emergency-reports',
    officialEndpoint: '/api/alerts/official',
  });
}
