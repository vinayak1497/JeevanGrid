import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import {
  bboxCenter,
  circlePolygon,
  formatBbox,
  geometryToOverpassPoly,
  haversineKm,
  normalizeGeometry,
  parseStoredAlertGeometry,
  pointInGeometry,
  type GeoJsonGeometry,
} from '../../utils/geo';
import { overpassService } from '../overpassService';
import { geoService } from '../geoService';

/**
 * Feature 1 — impact-based disaster exposure.
 *
 * Population comes from WorldPop (100 m gridded estimates, explicit data year
 * and source). Infrastructure comes from OpenStreetMap/Overpass, with the local
 * JeevanGrid registry as a clearly-labelled fallback. Missing providers produce
 * a data gap, never an invented number.
 */

export interface ImpactInput {
  alertId?: string;
  location?: string;
  geometry?: any;
  hazardType?: string;
  district?: string;
  state?: string;
  locationName?: string;
  isSimulation?: boolean;
  forceRefresh?: boolean;
}

export interface ImpactResult {
  id?: string;
  cached: boolean;
  hazardType: string;
  locationName: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  areaKm2: number | null;
  populationExposed: number | null;
  populationDensity: number | null;
  childrenExposed: number | null;
  elderlyExposed: number | null;
  hospitalsExposed: number | null;
  schoolsExposed: number | null;
  roadsExposed: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  precision: 'EXACT_POLYGON' | 'DISTRICT_APPROXIMATION' | 'SIMULATION';
  isSimulation: boolean;
  populationSource: string | null;
  dataYear: number | null;
  limitations: string;
  evidence: Record<string, any>;
  geometry: GeoJsonGeometry | null;
  sourceAlertId: string | null;
  createdAt: string;
}

const WORLDPOP_BASE = (process.env.WORLDPOP_BASE_URL || 'https://api.worldpop.org/v3').replace(/\/$/, '');
const POP_CACHE_MS = 24 * 60 * 60 * 1000;

function cacheKeyFor(geometry: GeoJsonGeometry, hazardType: string, yearWindow: number, alertId?: string): string {
  const normalized = JSON.stringify(geometry, (_key, value) =>
    typeof value === 'number' ? Math.round(value * 10000) / 10000 : value
  );
  return crypto
    .createHash('sha1')
    .update(`${alertId || ''}|${hazardType}|${yearWindow}|${normalized}`)
    .digest('hex');
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 25_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const payload: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload?.detail || payload?.error || `WorldPop HTTP ${res.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function worldPopHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = (process.env.WORLDPOP_API_KEY || '').trim();
  if (key) headers['X-API-Key'] = key;
  return headers;
}

export interface PopulationResult {
  population: number | null;
  density: number | null;
  areaKm2: number | null;
  dataYear: number | null;
  source: string | null;
  children: number | null;
  elderly: number | null;
  warnings: string[];
}

export async function fetchWorldPop(
  geometry: GeoJsonGeometry,
  preferredYear = new Date().getFullYear()
): Promise<PopulationResult> {
  const warnings: string[] = [];
  const years: number[] = [];
  for (let y = Math.min(2030, preferredYear); y >= Math.max(2015, preferredYear - 10); y -= 1) years.push(y);
  const geojson = { type: 'Feature', properties: {}, geometry };

  let population: number | null = null;
  let density: number | null = null;
  let areaKm2: number | null = null;
  let dataYear: number | null = null;
  let source: string | null = null;

  try {
    const payload = await fetchJson(`${WORLDPOP_BASE}/population`, {
      method: 'POST',
      headers: worldPopHeaders(),
      body: JSON.stringify({ geojson, years }),
    });
    const rows: any[] = Array.isArray(payload.years) ? payload.years : [payload];
    const valid = rows
      .filter((r) => Number.isFinite(Number(r.total_population)))
      .sort((a, b) => Number(a.data_year) - Number(b.data_year));
    const latest = valid[valid.length - 1];
    if (latest) {
      population = Math.round(Number(latest.total_population));
      density = Number.isFinite(Number(latest.population_density)) ? Math.round(Number(latest.population_density) * 10) / 10 : null;
      areaKm2 = Number.isFinite(Number(payload.area_km2)) ? Math.round(Number(payload.area_km2) * 100) / 100 : null;
      dataYear = Number(latest.data_year) || null;
      source = String(payload.data_source || 'WorldPop');
    } else {
      warnings.push('WorldPop returned no population value for this polygon/year window.');
    }
  } catch (e) {
    warnings.push(`WorldPop population unavailable: ${(e as Error).message.slice(0, 140)}`);
  }

  let children: number | null = null;
  let elderly: number | null = null;
  if (population !== null && dataYear) {
    try {
      const payload = await fetchJson(`${WORLDPOP_BASE}/groups`, {
        method: 'POST',
        headers: worldPopHeaders(),
        body: JSON.stringify({
          geojson,
          year: dataYear,
          groups: ['under_5', 'age_65_plus'],
        }),
      });
      for (const group of payload.groups || []) {
        if (group.name === 'under_5' && Number.isFinite(Number(group.population))) {
          children = Math.round(Number(group.population));
        }
        if (group.name === 'age_65_plus' && Number.isFinite(Number(group.population))) {
          elderly = Math.round(Number(group.population));
        }
      }
      if (children === null || elderly === null) {
        warnings.push('WorldPop age-group data is partially available.');
      }
    } catch (e) {
      warnings.push(`WorldPop age-group data unavailable: ${(e as Error).message.slice(0, 140)}`);
    }
  }

  return { population, density, areaKm2, dataYear, source, children, elderly, warnings };
}

export interface LocalFacilityCount {
  hospitals: number | null;
  schools: number | null;
  roads: number | null;
  source: 'overpass' | 'local_registry_fallback' | 'unavailable';
  warnings: string[];
  sampleHospitals: Array<{ name: string; distanceKm: number; latitude: number; longitude: number }>;
}

export async function countExposedInfrastructure(
  geometry: GeoJsonGeometry,
  center: { lat: number; lng: number }
): Promise<LocalFacilityCount> {
  const poly = geometryToOverpassPoly(geometry);
  const warnings: string[] = [];
  let hospitals: number | null = null;
  let schools: number | null = null;
  let roads: number | null = null;
  let source: LocalFacilityCount['source'] = 'unavailable';

  if (poly) {
    const counts = await overpassService.countFeaturesInPolygon(poly);
    hospitals = counts.hospitals;
    schools = counts.schools;
    roads = counts.roads;
    warnings.push(...counts.warnings);
    if (counts.source === 'overpass') source = 'overpass';
  } else {
    warnings.push('Polygon too small or malformed for an OpenStreetMap query.');
  }

  // Local registry fallback for hospitals only (schools/roads have no local registry).
  if (hospitals === null) {
    try {
      const all = await prisma.hospital.findMany({ select: { name: true, latitude: true, longitude: true } });
      const inside = all.filter((h) => pointInGeometry(h.longitude, h.latitude, geometry));
      if (all.length > 0) {
        hospitals = inside.length;
        source = source === 'overpass' ? 'overpass' : 'local_registry_fallback';
        warnings.push('Hospital count fell back to the JeevanGrid facility registry (not a live OSM count).');
        const sampleHospitals = inside
          .map((h) => ({
            name: h.name,
            distanceKm: Math.round(haversineKm(center.lat, center.lng, h.latitude, h.longitude) * 10) / 10,
            latitude: h.latitude,
            longitude: h.longitude,
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm)
          .slice(0, 8);
        return { hospitals, schools, roads, source, warnings, sampleHospitals };
      }
    } catch (e) {
      warnings.push(`Local facility registry unavailable: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  return { hospitals, schools, roads, source, warnings, sampleHospitals: [] };
}

function buildLimitations(opts: {
  precision: string;
  populationAvailable: boolean;
  demographicsAvailable: boolean;
  infrastructureSource: string;
  warnings: string[];
}): string {
  const parts = [
    'Estimated exposure, not confirmed casualties or damage.',
    'Population is a WorldPop gridded estimate for the selected geometry and data year, not a household count.',
  ];
  if (opts.precision === 'DISTRICT_APPROXIMATION') {
    parts.push('The source alert has no exact CAP polygon, so a labelled 8 km district-level approximation was used. This is not an inundation boundary.');
  }
  if (opts.precision === 'SIMULATION') {
    parts.push('SIMULATION: this exposure calculation is a training scenario and is not an actual event.');
  }
  if (!opts.populationAvailable) parts.push('Population data was unavailable; no population figure is shown.');
  if (!opts.demographicsAvailable) parts.push('Age-group exposure is unavailable for this extent.');
  if (opts.infrastructureSource !== 'overpass') {
    parts.push('Infrastructure counts use the local facility registry fallback where OpenStreetMap was unavailable; road/school counts may be missing.');
  }
  if (opts.warnings.length) parts.push(...opts.warnings.slice(0, 4));
  return parts.join(' ');
}

export async function assessImpact(input: ImpactInput): Promise<ImpactResult> {
  let geometry: GeoJsonGeometry | null = null;
  let precision: ImpactResult['precision'] = 'EXACT_POLYGON';
  let alert: any = null;
  let locationName = input.locationName || input.location || 'Selected area';
  let district = input.district || 'Mumbai Suburban';
  let state = input.state || 'Maharashtra';
  let center = { lat: 19.076, lng: 72.8777 };
  let isSimulation = Boolean(input.isSimulation);
  let sourceAlertId: string | null = null;
  const warnings: string[] = [];

  if (input.alertId) {
    alert = await prisma.disasterAlert.findUnique({ where: { id: input.alertId } });
    if (!alert) throw new Error('Alert not found.');
    sourceAlertId = alert.id;
    locationName = `${alert.district}, ${alert.state}`;
    district = alert.district;
    state = alert.state;
    center = { lat: alert.latitude, lng: alert.longitude };
    isSimulation = Boolean(alert.isDemoData);
    const alertGeometry = parseStoredAlertGeometry(alert.geometry);
    if (alertGeometry) {
      geometry = alertGeometry;
      precision = isSimulation ? 'SIMULATION' : 'EXACT_POLYGON';
    } else {
      geometry = circlePolygon(center.lat, center.lng, 8);
      precision = isSimulation ? 'SIMULATION' : 'DISTRICT_APPROXIMATION';
      warnings.push('Alert has no CAP polygon; district-level approximation used.');
    }
  } else {
    if (input.geometry) {
      const normalized = normalizeGeometry(input.geometry);
      if (!normalized.ok) throw new Error(`Invalid polygon: ${normalized.reason}`);
      geometry = normalized.value.geometry;
      precision = isSimulation ? 'SIMULATION' : 'EXACT_POLYGON';
      const c = bboxCenter(normalized.value.bbox);
      center = c;
    } else {
      if (!input.location) throw new Error('Provide an alertId, a GeoJSON polygon, or a location.');
      const resolved = await geoService.resolveLocationLive(input.location);
      center = { lat: resolved.lat, lng: resolved.lng };
      district = input.district || resolved.district;
      state = input.state || resolved.state;
      locationName = input.locationName || resolved.query;
      geometry = circlePolygon(center.lat, center.lng, 8);
      precision = isSimulation ? 'SIMULATION' : 'DISTRICT_APPROXIMATION';
      warnings.push('No polygon supplied; an 8 km labelled approximation around the location was used.');
    }
  }

  const hazardType = (input.hazardType || alert?.hazardType || 'Flood').toString();
  const normalizedGeometry = normalizeGeometry(geometry);
  if (!normalizedGeometry.ok) throw new Error(`Resolved geometry invalid: ${normalizedGeometry.reason}`);
  const resolvedGeometry = normalizedGeometry.value.geometry;
  const bbox = normalizedGeometry.value.bbox;
  if (!input.geometry && !input.alertId) {
    const c = bboxCenter(bbox);
    center = c;
  }

  const cacheKey = cacheKeyFor(resolvedGeometry, hazardType, new Date().getFullYear(), sourceAlertId || undefined);
  if (!input.forceRefresh) {
    const cached = await prisma.impactAssessment.findUnique({ where: { cacheKey } });
    if (cached && Date.now() - cached.createdAt.getTime() < POP_CACHE_MS) {
      return shapeAssessment(cached, true);
    }
  }

  const [populationResult, infrastructure] = await Promise.all([
    fetchWorldPop(resolvedGeometry),
    countExposedInfrastructure(resolvedGeometry, center),
  ]);

  const infrastructureAvailable = infrastructure.hospitals !== null || infrastructure.schools !== null || infrastructure.roads !== null;
  const demographicsAvailable = populationResult.children !== null || populationResult.elderly !== null;
  let confidence: ImpactResult['confidence'] = 'INSUFFICIENT';
  if (populationResult.population !== null && infrastructureAvailable) {
    confidence = demographicsAvailable && precision === 'EXACT_POLYGON' ? 'HIGH' : 'MEDIUM';
  } else if (populationResult.population !== null) {
    confidence = 'MEDIUM';
  } else if (infrastructureAvailable) {
    confidence = 'LOW';
  }

  const evidence = {
    population: {
      provider: 'WorldPop',
      endpoint: `${WORLDPOP_BASE}/population`,
      dataSource: populationResult.source,
      dataYear: populationResult.dataYear,
      areaKm2: populationResult.areaKm2,
      demographicsAvailable,
      warnings: populationResult.warnings,
    },
    infrastructure: {
      provider: infrastructure.source,
      hospitals: infrastructure.hospitals,
      schools: infrastructure.schools,
      roads: infrastructure.roads,
      sampleHospitals: infrastructure.sampleHospitals,
      warnings: infrastructure.warnings,
    },
    geometry: {
      bbox,
      pointCount: normalizedGeometry.value.pointCount,
      areaKm2Geodesic: normalizedGeometry.value.areaKm2,
      precision,
    },
    alert: alert
      ? { id: alert.id, source: alert.source, sourceType: alert.sourceType, isDemoData: alert.isDemoData, issuedAt: alert.issuedAt }
      : null,
    warnings: [...warnings, ...populationResult.warnings, ...infrastructure.warnings],
  };

  const limitations = buildLimitations({
    precision,
    populationAvailable: populationResult.population !== null,
    demographicsAvailable,
    infrastructureSource: infrastructure.source,
    warnings: [...warnings, ...populationResult.warnings, ...infrastructure.warnings],
  });

  const created = await prisma.impactAssessment.create({
    data: {
      cacheKey,
      hazardType,
      locationName,
      district,
      state,
      latitude: center.lat,
      longitude: center.lng,
      areaKm2: populationResult.areaKm2 ?? normalizedGeometry.value.areaKm2,
      populationExposed: populationResult.population,
      populationDensity: populationResult.density,
      childrenExposed: populationResult.children,
      elderlyExposed: populationResult.elderly,
      hospitalsExposed: infrastructure.hospitals,
      schoolsExposed: infrastructure.schools,
      roadsExposed: infrastructure.roads,
      confidence,
      precision,
      isSimulation,
      populationSource: populationResult.source,
      dataYear: populationResult.dataYear,
      limitations,
      evidence: JSON.stringify(evidence),
      geometry: JSON.stringify(resolvedGeometry),
      sourceAlertId,
    },
  });

  return shapeAssessment(created, false);
}

function shapeAssessment(row: any, cached: boolean): ImpactResult {
  return {
    id: row.id,
    cached,
    hazardType: row.hazardType,
    locationName: row.locationName,
    district: row.district,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
    areaKm2: row.areaKm2,
    populationExposed: row.populationExposed,
    populationDensity: row.populationDensity,
    childrenExposed: row.childrenExposed,
    elderlyExposed: row.elderlyExposed,
    hospitalsExposed: row.hospitalsExposed,
    schoolsExposed: row.schoolsExposed,
    roadsExposed: row.roadsExposed,
    confidence: row.confidence,
    precision: row.precision,
    isSimulation: row.isSimulation,
    populationSource: row.populationSource,
    dataYear: row.dataYear,
    limitations: row.limitations || '',
    evidence: safelyParse(row.evidence) || {},
    geometry: safelyParse(row.geometry),
    sourceAlertId: row.sourceAlertId,
    createdAt: row.createdAt.toISOString(),
  };
}

function safelyParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function listImpactAssessments(district?: string, take = 10): Promise<ImpactResult[]> {
  const rows = await prisma.impactAssessment.findMany({
    where: district ? { district } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(take, 1), 50),
  });
  return rows.map((row) => shapeAssessment(row, true));
}

export async function getImpactSummary(district?: string): Promise<any> {
  const rows = await prisma.impactAssessment.findMany({
    where: district ? { district } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  const latest = rows[0] ? shapeAssessment(rows[0], true) : null;
  const totalEstimatedPopulation = rows.reduce((sum, r) => sum + (r.populationExposed || 0), 0);
  return {
    latest,
    assessmentCount: rows.length,
    totalEstimatedPopulationAcrossAssessments: totalEstimatedPopulation,
    highConfidenceAssessments: rows.filter((r) => r.confidence === 'HIGH').length,
    lastCalculatedAt: latest?.createdAt || null,
    note: 'Estimated exposure across separate assessments; do not sum as unique people.',
  };
}
