import { geoService } from './geoService';

export interface QuakeEvent {
  id: string;
  magnitude: number;
  place: string;
  time: string;
  depthKm: number;
  latitude: number;
  longitude: number;
  url: string;
  tsunamiFlag: number;
}

export interface QuakeSummary {
  location: string;
  searchCenter: { lat: number; lng: number };
  radiusKm: number;
  minMagnitude: number;
  count: number;
  strongest: QuakeEvent | null;
  events: QuakeEvent[];
  source: 'usgs' | 'none';
  fetchedAt: string;
}

const cache = new Map<string, { data: QuakeSummary; ts: number }>();
const TTL = 15 * 60 * 1000;

/**
 * USGS Earthquake Hazards Program feed (free, no key).
 * docs: https://earthquake.usgs.gov/fdsnws/event/1/
 */
export class UsgsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.USGS_EARTHQUAKE_API_URL || 'https://earthquake.usgs.gov/fdsnws/event/1/query').replace(/\/$/, '');
  }

  public async getNearbyQuakes(
    locationQuery: string,
    radiusKm = 500,
    minMagnitude = 4,
    limit = 10
  ): Promise<QuakeSummary> {
    const resolved = await geoService.resolveLocationLive(locationQuery);
    return this.getQuakesForCoords(resolved.city, resolved.lat, resolved.lng, radiusKm, minMagnitude, limit);
  }

  public async getQuakesForCoords(
    locationLabel: string,
    lat: number,
    lng: number,
    radiusKm = 500,
    minMagnitude = 4,
    limit = 10
  ): Promise<QuakeSummary> {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)},${radiusKm},${minMagnitude}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL) return cached.data;

    const empty: QuakeSummary = {
      location: locationLabel,
      searchCenter: { lat, lng },
      radiusKm,
      minMagnitude,
      count: 0,
      strongest: null,
      events: [],
      source: 'none',
      fetchedAt: new Date().toISOString(),
    };

    try {
      const url =
        `${this.baseUrl}?format=geojson` +
        `&latitude=${lat}&longitude=${lng}` +
        `&maxradiuskm=${radiusKm}&minmagnitude=${minMagnitude}&limit=${limit}&orderby=time`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { 'User-Agent': 'JeevanGrid-DataEngine/1.0' },
        });
        if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
        const raw: any = await res.json();
        const features: any[] = raw.features || [];
        const events: QuakeEvent[] = features.map((f: any) => ({
          id: String(f.id || f.properties?.code || Math.random()),
          magnitude: Number(f.properties?.mag ?? 0),
          place: String(f.properties?.place || 'Unknown region'),
          time: new Date(Number(f.properties?.time || Date.now())).toISOString(),
          depthKm: Array.isArray(f.geometry?.coordinates) ? Math.round(Number(f.geometry.coordinates[2] || 0)) : 0,
          latitude: Array.isArray(f.geometry?.coordinates) ? Number(f.geometry.coordinates[1]) : 0,
          longitude: Array.isArray(f.geometry?.coordinates) ? Number(f.geometry.coordinates[0]) : 0,
          url: String(f.properties?.url || 'https://earthquake.usgs.gov/'),
          tsunamiFlag: Number(f.properties?.tsunami || 0),
        }));
        const strongest = events.reduce<QuakeEvent | null>(
          (best, e) => (!best || e.magnitude > best.magnitude ? e : best),
          null
        );
        const summary: QuakeSummary = {
          ...empty,
          count: events.length,
          strongest,
          events,
          source: 'usgs',
          fetchedAt: new Date().toISOString(),
        };
        cache.set(key, { data: summary, ts: Date.now() });
        return summary;
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      console.warn('USGS feed unavailable:', (e as Error).message);
      return empty;
    }
  }
}

export const usgsService = new UsgsService();
