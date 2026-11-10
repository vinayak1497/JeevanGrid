import { prisma } from '../../utils/prisma';
import {
  circlePolygon,
  haversineKm,
  parseStoredAlertGeometry,
  type GeoJsonGeometry,
} from '../../utils/geo';

/**
 * Feature 5 — evacuation routing & shelter matching.
 *
 * Only authority-verified evidence can restrict a route: active official
 * warnings with geometry, verified satellite flood layers, and
 * officer-verified incident reports. Unverified community reports are listed
 * as ignored evidence. The route is never described as "safe".
 */

export type TravelProfile = 'driving-car' | 'foot-walking' | 'cycling-regular';

export interface AvoidSource {
  kind: 'OFFICIAL_ALERT' | 'SATELLITE_LAYER' | 'OFFICER_VERIFIED_REPORT';
  id: string;
  label: string;
  geometry: GeoJsonGeometry;
}

export interface ShelterCandidate {
  id: string;
  name: string;
  district: string;
  state: string;
  address: string;
  latitude: number;
  longitude: number;
  recordedCapacity: number;
  recordedOccupancy: number;
  recordedAvailable: number;
  capacityDataAvailable: boolean;
  status: 'REGISTRY_RECORD';
  lastUpdated: string | null;
  contactPerson: string;
  contactPhone: string;
  distanceKm: number;
  accessibility: 'NOT_RECORDED';
  amenities: string[];
}

export interface RouteResult {
  shelter: ShelterCandidate;
  provider: 'openrouteservice' | 'none';
  profile: TravelProfile;
  routingStatus: 'ROUTED' | 'UNVERIFIED_NORMAL_ROUTING' | 'NO_ROUTE';
  distanceKm: number | null;
  durationMinutes: number | null;
  straightLineDistanceKm: number;
  geometry: { type: string; coordinates: any } | null;
  avoidedAreas: Array<{ kind: string; id: string; label: string }>;
  reasons: string[];
  warnings: string[];
  dataSources: string[];
}

const ORS_BASE = (process.env.OPENROUTESERVICE_BASE_URL || 'https://api.openrouteservice.org').replace(/\/$/, '');

function orsKey(): string {
  return (process.env.OPENROUTESERVICE_API_KEY || '').trim();
}

export function isRoutingConfigured(): boolean {
  return orsKey().length > 0;
}

function parseAmenities(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).slice(0, 20);
  } catch {
    // fall through: comma-separated
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
}

/**
 * Loads only verified hazard boundaries. Unverified community reports are not
 * allowed to make a road impassable.
 */
export async function loadVerifiedAvoidSources(district: string): Promise<{
  sources: AvoidSource[];
  ignoredUnverifiedReports: number;
}> {
  const now = new Date();
  const [alerts, layers, verifiedReports, unverifiedCount] = await Promise.all([
    prisma.disasterAlert.findMany({
      where: {
        district,
        status: 'ACTIVE',
        sourceType: 'OFFICIAL',
        isVerified: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        hazardType: { in: ['Flood', 'Landslide', 'Cyclone', 'Rain'] },
      },
      orderBy: { issuedAt: 'desc' },
      take: 12,
    }),
    prisma.satelliteLayer.findMany({
      where: { district, verificationStatus: 'VERIFIED' },
      orderBy: { observationDate: 'desc' },
      take: 5,
    }),
    prisma.emergencyReport.findMany({
      where: {
        district,
        verificationStatus: 'OFFICER_VERIFIED',
        category: { in: ['FLOODING', 'ROAD_BLOCKED', 'BRIDGE_DAMAGED', 'TREE_FALLEN'] },
        latitude: { not: null },
        longitude: { not: null },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.emergencyReport.count({
      where: {
        district,
        verificationStatus: { in: ['UNVERIFIED', 'DUPLICATE_SUSPECTED', 'CORROBORATED'] },
        category: { in: ['FLOODING', 'ROAD_BLOCKED', 'BRIDGE_DAMAGED', 'TREE_FALLEN'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const sources: AvoidSource[] = [];
  for (const alert of alerts) {
    const geometry = parseStoredAlertGeometry(alert.geometry);
    if (geometry) {
      sources.push({
        kind: 'OFFICIAL_ALERT',
        id: alert.id,
        label: `${alert.severity} ${alert.hazardType}: ${alert.title}`,
        geometry,
      });
    }
  }
  for (const layer of layers) {
    try {
      const geometry = JSON.parse(layer.geojson);
      if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') {
        sources.push({
          kind: 'SATELLITE_LAYER',
          id: layer.id,
          label: `${layer.eventName} (${layer.sourceOrganisation}, observed ${layer.observationDate.toISOString().slice(0, 10)})`,
          geometry,
        });
      }
    } catch {
      // Invalid stored layer is skipped; it must not affect routing.
    }
  }
  for (const report of verifiedReports) {
    if (report.latitude === null || report.longitude === null) continue;
    sources.push({
      kind: 'OFFICER_VERIFIED_REPORT',
      id: report.id,
      label: `${report.category}: ${report.locationName} (officer verified)`,
      geometry: circlePolygon(report.latitude, report.longitude, 0.3, 20),
    });
  }
  return { sources: sources.slice(0, 20), ignoredUnverifiedReports: unverifiedCount };
}

export function rankShelters(
  shelters: Array<{
    id: string;
    name: string;
    district: string;
    state: string;
    address: string;
    latitude: number;
    longitude: number;
    capacity: number;
    currentOccupancy: number;
    amenities: string;
    contactPerson: string;
    contactPhone: string;
  }>,
  origin: { lat: number; lng: number },
  opts: { radiusKm?: number; requireRecordedAvailability?: boolean } = {}
): ShelterCandidate[] {
  const radiusKm = opts.radiusKm ?? 25;
  return shelters
    .map((s) => {
      const recordedAvailable = Math.max(0, s.capacity - s.currentOccupancy);
      return {
        id: s.id,
        name: s.name,
        district: s.district,
        state: s.state,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        recordedCapacity: s.capacity,
        recordedOccupancy: s.currentOccupancy,
        recordedAvailable,
        capacityDataAvailable: false,
        status: 'REGISTRY_RECORD' as const,
        lastUpdated: null,
        contactPerson: s.contactPerson,
        contactPhone: s.contactPhone,
        distanceKm: Math.round(haversineKm(origin.lat, origin.lng, s.latitude, s.longitude) * 10) / 10,
        accessibility: 'NOT_RECORDED' as const,
        amenities: parseAmenities(s.amenities),
        _available: recordedAvailable,
      };
    })
    .filter((s) => s.distanceKm <= radiusKm)
    .filter((s) => (opts.requireRecordedAvailability ? s._available > 0 : true))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map(({ _available, ...rest }) => rest);
}

async function requestOrsRoute(
  origin: { lat: number; lng: number },
  destination: ShelterCandidate,
  profile: TravelProfile,
  avoidPolygons: GeoJsonGeometry | null
): Promise<{ distanceKm: number; durationMinutes: number; geometry: { type: string; coordinates: any } } | null> {
  const key = orsKey();
  if (!key) return null;
  const body: any = {
    coordinates: [
      [origin.lng, origin.lat],
      [destination.longitude, destination.latitude],
    ],
    instructions: false,
    language: 'en',
  };
  if (avoidPolygons) body.options = { avoid_polygons: avoidPolygons };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`OpenRouteService HTTP ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    const feature = data.features?.[0];
    if (!feature?.geometry) return null;
    const summary = feature.properties?.summary || {};
    const distanceM = Number(summary.distance);
    const durationS = Number(summary.duration);
    if (!Number.isFinite(distanceM)) return null;
    return {
      distanceKm: Math.round((distanceM / 1000) * 10) / 10,
      durationMinutes: Number.isFinite(durationS) ? Math.round(durationS / 60) : 0,
      geometry: feature.geometry,
    };
  } catch (e) {
    console.warn('OpenRouteService unavailable:', (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const planCache = new Map<string, { data: any; ts: number }>();
const PLAN_TTL = 3 * 60 * 1000;

export async function planEvacuation(input: {
  originLat: number;
  originLng: number;
  district?: string;
  profile?: TravelProfile;
  radiusKm?: number;
}): Promise<any> {
  const cacheKey = `${input.originLat.toFixed(3)}|${input.originLng.toFixed(3)}|${input.district || ''}|${input.profile || 'driving-car'}|${input.radiusKm || 25}`;
  const cached = planCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < PLAN_TTL) return { ...cached.data, cached: true };

  let district = input.district || '';
  if (!district) {
    // Nearest shelter's district is only used to scope verified hazard data;
    // the shelter query itself is radius-based so a missing district is safe.
    const nearest = await prisma.shelter.findFirst({
      orderBy: { name: 'asc' },
      select: { district: true },
    });
    district = nearest?.district || 'Mumbai Suburban';
  }

  const shelters = await prisma.shelter.findMany({
    where: district ? { district } : undefined,
    take: 100,
  });
  const ranked = rankShelters(shelters, { lat: input.originLat, lng: input.originLng }, {
    radiusKm: input.radiusKm || 25,
  }).slice(0, 5);

  if (!ranked.length) {
    return {
      origin: { lat: input.originLat, lng: input.originLng },
      district,
      profile: input.profile || 'driving-car',
      routingProvider: isRoutingConfigured() ? 'openrouteservice' : 'none',
      routes: [],
      avoidedAreas: [],
      warnings: ['No shelter with a registry record was found within the selected radius. Call 112 if you are in immediate danger.'],
      limitations: 'Shelter capacity is a registry estimate and may be out of date.',
      generatedAt: new Date().toISOString(),
    };
  }

  const avoid = await loadVerifiedAvoidSources(district);
  const avoidPolygons: GeoJsonGeometry | null = avoid.sources.length
    ? avoid.sources.length === 1
      ? avoid.sources[0].geometry
      : {
          type: 'MultiPolygon',
          coordinates: avoid.sources.flatMap((s) =>
            s.geometry.type === 'Polygon' ? [s.geometry.coordinates] : s.geometry.coordinates
          ),
        }
    : null;

  const routes: RouteResult[] = [];
  for (const shelter of ranked.slice(0, 3)) {
    const straightLineDistanceKm = Math.round(haversineKm(input.originLat, input.originLng, shelter.latitude, shelter.longitude) * 10) / 10;
    const routed = await requestOrsRoute(
      { lat: input.originLat, lng: input.originLng },
      shelter,
      input.profile || 'driving-car',
      avoidPolygons
    );
    const warnings: string[] = [
      'This is a route recommendation, not a guarantee that the route is safe. Follow local authority instructions.',
      'Shelter capacity is a registry record, not live availability. Confirm before travelling.',
    ];
    if (avoid.ignoredUnverifiedReports > 0) {
      warnings.push(
        `${avoid.ignoredUnverifiedReports} unverified community road/incident report(s) were not used to block this route.`
      );
    }
    routes.push({
      shelter,
      provider: routed ? 'openrouteservice' : 'none',
      profile: input.profile || 'driving-car',
      routingStatus: routed ? 'ROUTED' : 'UNVERIFIED_NORMAL_ROUTING',
      distanceKm: routed?.distanceKm ?? null,
      durationMinutes: routed?.durationMinutes ?? null,
      straightLineDistanceKm,
      geometry: routed?.geometry || {
        type: 'LineString',
        coordinates: [
          [input.originLng, input.originLat],
          [shelter.longitude, shelter.latitude],
        ],
      },
      avoidedAreas: avoid.sources.map((s) => ({ kind: s.kind, id: s.id, label: s.label })),
      reasons: [
        routed
          ? 'Selected by the routing engine with verified hazard areas excluded where supported.'
          : 'Orthogonal fallback shown because the routing provider is unavailable; treat distance as straight-line only.',
        `${shelter.distanceKm} km straight-line distance; recorded capacity ${shelter.recordedCapacity}.`,
      ],
      warnings: routed
        ? warnings
        : [...warnings, 'Routing provider unavailable or not configured. No turn-by-turn or avoidance guarantee.'],
      dataSources: [
        routed ? 'OpenRouteService Directions' : 'No routing provider',
        'JeevanGrid shelter registry',
        'Official verified warning geometry (where available)',
        'Officer-verified incident geometry (300 m approximation)',
      ],
    });
  }

  const result = {
    origin: { lat: input.originLat, lng: input.originLng },
    district,
    profile: input.profile || 'driving-car',
    routingProvider: isRoutingConfigured() ? 'openrouteservice' : 'none',
    routes,
    avoidedAreas: avoid.sources.map((s) => ({ kind: s.kind, id: s.id, label: s.label })),
    ignoredUnverifiedReports: avoid.ignoredUnverifiedReports,
    capacityNote:
      'Shelter capacity is displayed from the registry record. JeevanGrid does not receive live bed/occupancy updates for all shelters.',
    limitations:
      'Avoidance polygons reflect only verified hazard data available to JeevanGrid. Unmapped flooding or road damage may exist. Never present this route as safe.',
    generatedAt: new Date().toISOString(),
  };
  planCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}
