/**
 * Deterministic geometry helpers shared by impact assessment, satellite import,
 * evacuation routing and community duplicate detection.
 *
 * Rules: never widen a precise polygon into a "safe" one, never fabricate a
 * coordinate, and always return a machine-readable reason for invalid input.
 */

export type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface NormalizedGeometry {
  geometry: GeoJsonGeometry;
  bbox: [number, number, number, number]; // west, south, east, north
  areaKm2: number;
  pointCount: number;
  ringCount: number;
}

export type GeometryResult =
  | { ok: true; value: NormalizedGeometry }
  | { ok: false; reason: string };

const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const a =
    s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function isFinitePair(lng: any, lat: any): boolean {
  return (
    typeof lng === 'number' && typeof lat === 'number' &&
    Number.isFinite(lng) && Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
  );
}

function ringAreaKm2(ring: number[][]): number {
  if (ring.length < 4) return 0;
  const meanLat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const latScale = (Math.PI / 180) * EARTH_RADIUS_KM;
  const lngScale = latScale * Math.cos((meanLat * Math.PI) / 180);
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = [ring[i][0] * lngScale, ring[i][1] * latScale];
    const [x2, y2] = [ring[i + 1][0] * lngScale, ring[i + 1][1] * latScale];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function polygonAreaKm2(rings: number[][][]): number {
  if (!rings.length) return 0;
  const outer = ringAreaKm2(rings[0]);
  const holes = rings.slice(1).reduce((s, r) => s + ringAreaKm2(r), 0);
  return Math.max(0, outer - holes);
}

function validateRing(ring: any): string | null {
  if (!Array.isArray(ring) || ring.length < 4) return 'each polygon ring needs at least 4 points';
  for (const point of ring) {
    if (!Array.isArray(point) || !isFinitePair(point[0], point[1])) {
      return 'coordinates must be [longitude, latitude] within valid bounds';
    }
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-9 || Math.abs(first[1] - last[1]) > 1e-9) {
    return 'polygon rings must be closed (first point must equal last point)';
  }
  return null;
}

/**
 * Accepts a GeoJSON Polygon, MultiPolygon, Feature or FeatureCollection and
 * returns a validated geometry + bbox + spherical area estimate.
 */
export function normalizeGeometry(input: any): GeometryResult {
  try {
    if (!input || typeof input !== 'object') return { ok: false, reason: 'GeoJSON object required' };

    let candidate = input;
    if (candidate.type === 'Feature') candidate = candidate.geometry;
    if (candidate?.type === 'FeatureCollection') {
      const geometries = (candidate.features || [])
        .map((f: any) => (f?.type === 'Feature' ? f.geometry : f))
        .filter((g: any) => g && (g.type === 'Polygon' || g.type === 'MultiPolygon'));
      if (!geometries.length) return { ok: false, reason: 'FeatureCollection has no Polygon or MultiPolygon features' };
      if (geometries.length === 1) candidate = geometries[0];
      else {
        const coords: number[][][][] = [];
        for (const g of geometries) {
          if (g.type === 'Polygon') coords.push(g.coordinates);
          else coords.push(...g.coordinates);
        }
        candidate = { type: 'MultiPolygon', coordinates: coords };
      }
    }

    const polygons: number[][][][] =
      candidate?.type === 'Polygon'
        ? [candidate.coordinates]
        : candidate?.type === 'MultiPolygon'
          ? candidate.coordinates
          : [];
    if (!polygons.length) return { ok: false, reason: 'geometry must be a Polygon or MultiPolygon' };
    if (polygons.length > 200) return { ok: false, reason: 'too many polygons (max 200)' };

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    let pointCount = 0;
    let ringCount = 0;
    let areaKm2 = 0;

    for (const rings of polygons) {
      if (!Array.isArray(rings) || !rings.length) return { ok: false, reason: 'polygon has no rings' };
      for (const ring of rings) {
        const err = validateRing(ring);
        if (err) return { ok: false, reason: err };
        ringCount += 1;
        pointCount += ring.length;
        if (pointCount > 20000) return { ok: false, reason: 'geometry too large (max 20,000 points)' };
        for (const [lng, lat] of ring) {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        }
      }
      areaKm2 += polygonAreaKm2(rings as number[][][]);
    }

    if (!Number.isFinite(areaKm2) || areaKm2 <= 0) return { ok: false, reason: 'polygon area is zero or invalid' };

    const geometry: GeoJsonGeometry =
      candidate.type === 'Polygon'
        ? { type: 'Polygon', coordinates: candidate.coordinates }
        : { type: 'MultiPolygon', coordinates: candidate.coordinates };

    return {
      ok: true,
      value: {
        geometry,
        bbox: [minLng, minLat, maxLng, maxLat],
        areaKm2: Math.round(areaKm2 * 100) / 100,
        pointCount,
        ringCount,
      },
    };
  } catch {
    return { ok: false, reason: 'invalid GeoJSON structure' };
  }
}

/** A clearly-labelled approximation used only when a source has no polygon. */
export function circlePolygon(lat: number, lng: number, radiusKm: number, steps = 32): GeoJsonGeometry {
  const ring: number[][] = [];
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      Math.round((lng + dLng * Math.cos(angle)) * 1e6) / 1e6,
      Math.round((lat + dLat * Math.sin(angle)) * 1e6) / 1e6,
    ]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function bboxCenter(bbox: [number, number, number, number]): { lat: number; lng: number } {
  return { lng: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 };
}

/**
 * Overpass poly filter uses `lat lon lat lon ...`. We only pass the outer
 * ring and cap the vertex count so a huge CAP polygon cannot build a runaway
 * query. This is documented in the impact-assessment limitations.
 */
export function geometryToOverpassPoly(geometry: GeoJsonGeometry, maxPoints = 48): string {
  const outer =
    geometry.type === 'Polygon'
      ? geometry.coordinates[0]
      : geometry.coordinates
          .map((p) => p[0])
          .sort((a, b) => ringAreaKm2(b) - ringAreaKm2(a))[0];
  if (!outer || outer.length < 4) return '';
  const step = Math.max(1, Math.ceil((outer.length - 1) / maxPoints));
  const sampled: number[][] = [];
  for (let i = 0; i < outer.length - 1; i += step) sampled.push(outer[i]);
  sampled.push(outer[0]);
  return sampled.map(([lng, lat]) => `${lat.toFixed(5)} ${lng.toFixed(5)}`).join(' ');
}

/**
 * Parses the geometry JSON stored by the alert pipeline:
 * { polygon: "lat,lon lat,lon ...", circle: "lat,lon radiusKm", polygonUrl }
 * Returns null when the source only supplied a document link — callers must
 * fall back to a labelled district approximation, never invent a shape.
 */
export function geometryFromCap(
  polygon: string | null | undefined,
  circle: string | null | undefined
): GeoJsonGeometry | null {
  if (circle && circle.trim()) {
    const parts = circle.trim().split(/\s+/);
    const center = parts[0]?.split(',').map(Number);
    const radiusKm = Number(parts[1]);
    if (center && center.length === 2 && isFinitePair(center[1], center[0]) && Number.isFinite(radiusKm) && radiusKm > 0) {
      return circlePolygon(center[0], center[1], Math.min(radiusKm, 200));
    }
  }
  if (polygon && polygon.trim()) {
    const tokens = polygon.trim().split(/[\s;]+/).filter(Boolean);
    const pairs: number[][] = [];
    for (const token of tokens) {
      const bits = token.split(',').map(Number);
      if (bits.length === 2 && Number.isFinite(bits[0]) && Number.isFinite(bits[1])) {
        let [a, b] = bits;
        // CAP order is lat,lon. Swap only when the first value cannot be a latitude.
        if (Math.abs(a) > 90 && Math.abs(b) <= 90) [a, b] = [b, a];
        pairs.push([b, a]); // -> [lng, lat]
      }
    }
    if (pairs.length >= 3) {
      if (Math.abs(pairs[0][0] - pairs[pairs.length - 1][0]) > 1e-9 || Math.abs(pairs[0][1] - pairs[pairs.length - 1][1]) > 1e-9) {
        pairs.push(pairs[0]);
      }
      const norm = normalizeGeometry({ type: 'Polygon', coordinates: [pairs] });
      return norm.ok ? norm.value.geometry : null;
    }
  }
  return null;
}

export function parseStoredAlertGeometry(raw: string | null | undefined): GeoJsonGeometry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === 'Polygon' || parsed?.type === 'MultiPolygon') return parsed;
    return geometryFromCap(parsed?.polygon, parsed?.circle);
  } catch {
    return geometryFromCap(raw, null);
  }
}

export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(lng: number, lat: number, geometry: GeoJsonGeometry): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const rings of polygons) {
    if (!rings.length) continue;
    if (pointInRing(lng, lat, rings[0])) {
      const inHole = rings.slice(1).some((hole) => pointInRing(lng, lat, hole));
      if (!inHole) return true;
    }
  }
  return false;
}

export function formatBbox(bbox: [number, number, number, number]): string {
  return bbox.map((n) => n.toFixed(4)).join(', ');
}
