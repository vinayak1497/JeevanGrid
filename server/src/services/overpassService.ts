import { geoService } from './geoService';

export interface LiveFacility {
  id: string;
  name: string;
  kind: 'hospital' | 'shelter' | 'emergency';
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  website?: string;
  operator?: string;
  openingHours?: string;
  source: 'overpass' | 'prisma';
  distanceKm?: number;
}

const cache = new Map<string, { data: LiveFacility[]; ts: number }>();
const TTL = 30 * 60 * 1000;

const FALLBACK_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

function resolveEndpoints(): string[] {
  const configured = (process.env.OVERPASS_API_URL || '').trim().replace(/\/$/, '');
  const list = configured ? [configured] : [];
  for (const fb of FALLBACK_ENDPOINTS) {
    if (!list.includes(fb)) list.push(fb);
  }
  return list;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/**
 * OpenStreetMap Overpass integration for live civic facilities (free, no key).
 * docs: https://wiki.openstreetmap.org/wiki/Overpass_API
 * Shelters have no dedicated OSM tag; community halls / schools / places of
 * worship used as designated-shelter candidates are returned as kind=shelter.
 */
export class OverpassService {
  public async getNearbyFacilities(
    locationQuery: string,
    radiusM = 10000,
    limit = 24,
    includeEmergency = true
  ): Promise<{ facilities: LiveFacility[]; source: 'overpass' | 'none' }> {
    const resolved = await geoService.resolveLocationLive(locationQuery);
    return this.getFacilitiesForCoords(resolved.lat, resolved.lng, radiusM, limit, includeEmergency);
  }

  public async getFacilitiesForCoords(
    lat: number,
    lng: number,
    radiusM = 10000,
    limit = 24,
    includeEmergency = true
  ): Promise<{ facilities: LiveFacility[]; source: 'overpass' | 'none' }> {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)},${radiusM}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL) {
      return { facilities: cached.data.slice(0, limit), source: 'overpass' };
    }

    const emergencyFrag = includeEmergency
      ? `node(around:${radiusM},${lat},${lng})[amenity=fire_station];` +
        `node(around:${radiusM},${lat},${lng})[amenity=police];`
      : '';
    const query =
      `[out:json][timeout:25];` +
      `(node(around:${radiusM},${lat},${lng})[amenity=hospital];` +
      `node(around:${radiusM},${lat},${lng})[amenity=clinic];` +
      `node(around:${radiusM},${lat},${lng})[amenity=community_centre];` +
      `node(around:${radiusM},${lat},${lng})[amenity=townhall];` +
      `node(around:${radiusM},${lat},${lng})[amenity=school];` +
      emergencyFrag + `);out 40;`;

    for (const endpoint of resolveEndpoints()) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
          const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
            signal: ctrl.signal,
            headers: { 'User-Agent': 'JeevanGrid-DataEngine/1.0 (civic-safety-info)' },
          });
          if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
          const raw: any = await res.json();
          const elements: any[] = raw.elements || [];
          const facilities: LiveFacility[] = elements
            .filter((el: any) => el && typeof el.lat === 'number' && typeof el.lon === 'number')
            .map((el: any, idx: number) => {
              const amenity = String(el.tags?.amenity || '');
              const tags = el.tags || {};
              const kind: LiveFacility['kind'] =
                amenity === 'hospital' || amenity === 'clinic'
                  ? 'hospital'
                  : amenity === 'fire_station' || amenity === 'police'
                    ? 'emergency'
                    : 'shelter';
              const phone = [tags['contact:phone'], tags.phone, tags['contact:mobile']]
                .find((v: any) => typeof v === 'string' && v.trim().length > 0);
              const defaultName =
                kind === 'hospital'
                  ? 'Unnamed Medical Facility'
                  : kind === 'emergency'
                    ? `Unnamed ${amenity === 'police' ? 'Police Post' : 'Fire Station'}`
                    : 'Unnamed Community Shelter';
              return {
                id: `osm-${el.type || 'node'}-${el.id || idx}`,
                name: String(tags.name || defaultName),
                kind,
                latitude: Number(el.lat),
                longitude: Number(el.lon),
                address: [tags['addr:street'], tags['addr:suburb'] || tags['addr:city']]
                  .filter(Boolean)
                  .join(', ') || undefined,
                phone: phone ? String(phone).trim() : undefined,
                website: tags.website || tags['contact:website'] || undefined,
                operator: tags.operator || undefined,
                openingHours: tags.opening_hours || undefined,
                source: 'overpass' as const,
                distanceKm:
                  Math.round(haversineKm(lat, lng, Number(el.lat), Number(el.lon)) * 10) / 10,
              };
            })
            .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
          cache.set(key, { data: facilities, ts: Date.now() });
          return { facilities: facilities.slice(0, limit), source: 'overpass' };
        } finally {
          clearTimeout(timer);
        }
      } catch (e) {
        console.warn(`Overpass (${endpoint}) unavailable:`, (e as Error).message);
      }
    }
    return { facilities: [], source: 'none' };
  }
}

export const overpassService = new OverpassService();
