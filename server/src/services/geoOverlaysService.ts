import { geoService } from './geoService';

export interface OverlayLine {
  id: string;
  name: string;
  points: Array<[number, number]>; // [lat, lng]
}

export interface BoundaryOverlay {
  name: string;
  adminLevel: string;
  lines: OverlayLine[];
  relationId: number;
}

export interface GeoOverlays {
  location: string;
  center: { lat: number; lng: number };
  rivers: OverlayLine[];
  boundary: BoundaryOverlay | null;
  source: 'overpass' | 'none';
  fetchedAt: string;
}

const cache = new Map<string, { data: GeoOverlays; ts: number }>();
const TTL = 6 * 60 * 60 * 1000;

const ENDPOINTS = [
  (process.env.OVERPASS_API_URL || '').trim().replace(/\/$/, ''),
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
].filter(Boolean);

function norm(v: string): string {
  return (v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeRegex(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function overpassQuery(query: string, timeoutMs = 25000): Promise<any | null> {
  for (const endpoint of ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
          headers: { 'User-Agent': 'JeevanGrid-DataEngine/1.0 (civic-safety-info)' },
        });
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      console.warn(`GeoOverlays (${endpoint}) unavailable:`, (e as Error).message);
    }
  }
  return null;
}

function wayToLine(el: any, prefix: string, fallbackName: string, maxPts = 200): OverlayLine | null {
  const geom: any[] = el.geometry || [];
  if (geom.length < 2) return null;
  const step = Math.max(1, Math.floor(geom.length / maxPts));
  const points: Array<[number, number]> = [];
  for (let i = 0; i < geom.length; i += step) {
    points.push([Number(geom[i].lat), Number(geom[i].lon)]);
  }
  const last = geom[geom.length - 1];
  points.push([Number(last.lat), Number(last.lon)]);
  return {
    id: `${prefix}-${el.type || 'way'}-${el.id}`,
    name: String(el.tags?.name || fallbackName),
    points,
  };
}

/**
 * Real river geometries (OSM waterways) near a location.
 * Rendered as blue polylines — never synthesized.
 */
async function fetchRivers(lat: number, lng: number): Promise<OverlayLine[]> {
  const q =
    `[out:json][timeout:25];` +
    `(way(around:40000,${lat},${lng})[waterway=river];);out geom 12;`;
  const raw = await overpassQuery(q);
  const elements: any[] = raw?.elements || [];
  return elements
    .map((el: any) => wayToLine(el, 'river', 'River'))
    .filter((l: OverlayLine | null): l is OverlayLine => l !== null)
    .slice(0, 12);
}

/**
 * Real district boundary linework (OSM administrative relations).
 * Returned as line segments (no fabricated polygons): member ways are
 * rendered verbatim, so geometry is always genuine OSM data.
 */
async function fetchBoundary(
  lat: number,
  lng: number,
  district: string,
  city: string
): Promise<BoundaryOverlay | null> {
  const south = (lat - 0.4).toFixed(3);
  const west = (lng - 0.4).toFixed(3);
  const north = (lat + 0.4).toFixed(3);
  const east = (lng + 0.4).toFixed(3);
  const bbox = `${south},${west},${north},${east}`;

  const names = [...new Set([district, city].filter(Boolean))];
  const alternation = names.map(escapeRegex).join('|');
  // Pass 1: exact-name match (fast tag-index lookup). Pass 2: contains-match.
  const attempts = [
    `["name"~"^(${alternation})$",i]`,
    `["name"~"(${alternation})",i]`,
  ];
  for (const nameFilter of attempts) {
    const q =
      `[out:json][timeout:25];` +
      `relation(${bbox})["boundary"="administrative"]${nameFilter};` +
      `out geom;`;
    const raw = await overpassQuery(q);
    const relations: any[] = (raw?.elements || []).filter((el: any) => el.type === 'relation');
    const withGeom = relations.filter((r: any) =>
      (r.members || []).some((m: any) => m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length >= 2)
    );
    if (!withGeom.length) continue;
    // Prefer larger (district-scale) relations over tiny wards
    withGeom.sort((a: any, b: any) => Number(b.members?.length || 0) - Number(a.members?.length || 0));
    const best = withGeom[0];

    const members: any[] = best.members || [];
    const lines: OverlayLine[] = [];
    for (const m of members) {
      if (m.type !== 'way' || !Array.isArray(m.geometry) || m.geometry.length < 2) continue;
      const line = wayToLine(
        { ...m, id: m.ref, tags: { name: best.tags?.name } },
        'boundary',
        'District boundary',
        300
      );
      if (line) lines.push(line);
      if (lines.length >= 60) break;
    }
    if (!lines.length) continue;

    return {
      name: String(best.tags?.name || district),
      adminLevel: String(best.tags?.admin_level || ''),
      lines,
      relationId: Number(best.id),
    };
  }
  return null;
}

export class GeoOverlaysService {
  public async getOverlays(locationQuery: string): Promise<GeoOverlays> {
    const resolved = await geoService.resolveLocationLive(locationQuery);
    const key = `${resolved.lat.toFixed(3)},${resolved.lng.toFixed(3)}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < TTL) return cached.data;

    const empty: GeoOverlays = {
      location: resolved.city,
      center: { lat: resolved.lat, lng: resolved.lng },
      rivers: [],
      boundary: null,
      source: 'none',
      fetchedAt: new Date().toISOString(),
    };

    const [rivers, boundary] = await Promise.all([
      fetchRivers(resolved.lat, resolved.lng).catch(() => [] as OverlayLine[]),
      fetchBoundary(resolved.lat, resolved.lng, resolved.district, resolved.city).catch(() => null),
    ]);

    const result: GeoOverlays = {
      ...empty,
      rivers,
      boundary,
      source: rivers.length || boundary ? 'overpass' : 'none',
      fetchedAt: new Date().toISOString(),
    };
    cache.set(key, { data: result, ts: Date.now() });
    return result;
  }
}

export const geoOverlaysService = new GeoOverlaysService();
