import { prisma } from '../../utils/prisma';
import { normalizeGeometry } from '../../utils/geo';

/**
 * Feature 8 — satellite impact layers.
 *
 * This is deliberately a manual-import prototype plus a catalogue provider
 * interface. It does not claim automatic damage detection. Imported products
 * retain their source, observation date, processing date, reference and
 * verification status.
 */

export type GeometryPrecision = 'EXACT' | 'APPROXIMATE';
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED';

export interface SatelliteLayerInput {
  eventName: string;
  areaName: string;
  district: string;
  state?: string;
  sourceOrganisation: string;
  observationDate: string;
  processedDate: string;
  productReference: string;
  geometryPrecision: GeometryPrecision;
  verificationStatus: VerificationStatus;
  geojson: any;
  isSimulation?: boolean;
  uploadedBy?: { id: string; name?: string };
}

export function countFeatures(geojson: any): number {
  if (geojson?.type === 'FeatureCollection') return Array.isArray(geojson.features) ? geojson.features.length : 0;
  if (geojson?.type === 'Feature') return 1;
  return 1;
}

export async function importSatelliteLayer(input: SatelliteLayerInput): Promise<any> {
  const normalized = normalizeGeometry(input.geojson);
  if (!normalized.ok) {
    throw Object.assign(new Error(`Invalid GeoJSON: ${normalized.reason}`), { statusCode: 400 });
  }
  const observationDate = new Date(input.observationDate);
  const processedDate = new Date(input.processedDate);
  if (!Number.isFinite(observationDate.getTime()) || !Number.isFinite(processedDate.getTime())) {
    throw Object.assign(new Error('observationDate and processedDate must be valid dates.'), { statusCode: 400 });
  }
  if (observationDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw Object.assign(new Error('observationDate cannot be in the future.'), { statusCode: 400 });
  }
  if (processedDate.getTime() < observationDate.getTime()) {
    throw Object.assign(new Error('processedDate cannot precede the observation date.'), { statusCode: 400 });
  }

  const row = await prisma.satelliteLayer.create({
    data: {
      eventName: input.eventName.trim().slice(0, 160),
      areaName: input.areaName.trim().slice(0, 160),
      district: input.district.trim().slice(0, 80),
      state: (input.state || 'Maharashtra').trim().slice(0, 80),
      sourceOrganisation: input.sourceOrganisation.trim().slice(0, 160),
      observationDate,
      processedDate,
      productReference: input.productReference.trim().slice(0, 200),
      geometryPrecision: input.geometryPrecision,
      verificationStatus: input.verificationStatus,
      sourceType: 'MANUAL_IMPORT',
      geojson: JSON.stringify(normalized.value.geometry),
      featureCount: countFeatures(input.geojson),
      bbox: JSON.stringify(normalized.value.bbox),
      uploadedById: input.uploadedBy?.id || null,
      uploadedByName: input.uploadedBy?.name || null,
      isSimulation: Boolean(input.isSimulation),
    },
  });
  return shapeLayer(row);
}

export function shapeLayer(row: any): any {
  let geojson: any = null;
  let bbox: any = null;
  try {
    geojson = JSON.parse(row.geojson);
  } catch {
    geojson = null;
  }
  try {
    bbox = row.bbox ? JSON.parse(row.bbox) : null;
  } catch {
    bbox = null;
  }
  return {
    id: row.id,
    eventName: row.eventName,
    areaName: row.areaName,
    district: row.district,
    state: row.state,
    sourceOrganisation: row.sourceOrganisation,
    observationDate: row.observationDate,
    processedDate: row.processedDate,
    productReference: row.productReference,
    geometryPrecision: row.geometryPrecision,
    verificationStatus: row.verificationStatus,
    sourceType: row.sourceType,
    featureCount: row.featureCount,
    bbox,
    geojson,
    uploadedByName: row.uploadedByName,
    isSimulation: row.isSimulation,
    createdAt: row.createdAt,
    note: row.isSimulation
      ? 'SIMULATION layer. Not a real satellite observation of an actual event.'
      : row.sourceType === 'MANUAL_IMPORT'
        ? 'Manually imported product. No automatic damage detection was applied.'
        : 'Catalogue metadata only.',
  };
}

export async function listSatelliteLayers(district?: string, take = 30): Promise<any[]> {
  const rows = await prisma.satelliteLayer.findMany({
    where: district ? { district } : undefined,
    orderBy: { observationDate: 'desc' },
    take: Math.min(Math.max(take, 1), 100),
  });
  return rows.map(shapeLayer);
}

export function isCopernicusConfigured(): boolean {
  return Boolean(
    process.env.COPERNICUS_CLIENT_ID && process.env.COPERNICUS_CLIENT_SECRET
  );
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function copernicusToken(): Promise<string | null> {
  if (!isCopernicusConfigured()) return null;
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const tokenUrl =
    process.env.COPERNICUS_TOKEN_URL ||
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.COPERNICUS_CLIENT_ID as string,
    client_secret: process.env.COPERNICUS_CLIENT_SECRET as string,
  });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) {
        console.warn(`Copernicus token HTTP ${res.status}`);
        return null;
      }
      const data: any = await res.json();
      if (!data.access_token) return null;
      tokenCache = {
        token: String(data.access_token),
        expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 600) * 1000,
      };
      return tokenCache.token;
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.warn('Copernicus token unavailable:', (e as Error).message);
    return null;
  }
}

export function validateCatalogueQuery(input: any): { ok: boolean; reason?: string } {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'Query required.' };
  const bbox = input.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n: any) => !Number.isFinite(Number(n)))) {
    return { ok: false, reason: 'bbox must be [west, south, east, north].' };
  }
  if (Number(bbox[0]) >= Number(bbox[2]) || Number(bbox[1]) >= Number(bbox[3])) {
    return { ok: false, reason: 'bbox min values must be lower than max values.' };
  }
  if (Number(bbox[0]) < -180 || Number(bbox[2]) > 180 || Number(bbox[1]) < -90 || Number(bbox[3]) > 90) {
    return { ok: false, reason: 'bbox is outside valid longitude/latitude bounds.' };
  }
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
    return { ok: false, reason: 'from and to must be valid dates.' };
  }
  if (from.getTime() > to.getTime()) return { ok: false, reason: 'from must be before to.' };
  const collection = String(input.collection || 'sentinel-1-grd');
  if (!/^[a-z0-9_-]{2,60}$/i.test(collection)) return { ok: false, reason: 'Invalid collection identifier.' };
  return { ok: true };
}

/**
 * Catalogue search only. It returns metadata for an officer to review; it does
 * not download, process, or claim detection from Sentinel-1 imagery.
 */
export async function searchCopernicusCatalogue(input: {
  bbox: [number, number, number, number];
  from: string;
  to: string;
  collection?: string;
}): Promise<any> {
  if (!isCopernicusConfigured()) {
    return {
      configured: false,
      products: [],
      note: 'Copernicus credentials are not configured. Manual GeoJSON import remains available.',
    };
  }
  const token = await copernicusToken();
  if (!token) {
    return {
      configured: true,
      products: [],
      note: 'Copernicus authentication failed. Check COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET and tenant access.',
    };
  }
  const url =
    process.env.COPERNICUS_CATALOGUE_URL ||
    'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        bbox: input.bbox,
        datetime: `${new Date(input.from).toISOString()}/${new Date(input.to).toISOString()}`,
        collections: [input.collection || 'sentinel-1-grd'],
        limit: 10,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        configured: true,
        products: [],
        note: `Copernicus catalogue HTTP ${res.status}: ${String(data?.error?.message || data?.detail || 'request rejected').slice(0, 240)}`,
      };
    }
    const products = (data.features || []).map((f: any) => ({
      id: f.id,
      collection: f.collection,
      acquiredAt: f.properties?.datetime || null,
      cloudCover: f.properties?.['eo:cloud_cover'] ?? null,
      geometry: f.geometry || null,
      assets: f.assets ? Object.keys(f.assets) : [],
    }));
    return {
      configured: true,
      products,
      note:
        products.length === 0
          ? 'No catalogue products matched this bbox/time window.'
          : 'Catalogue metadata only. Review and import a preprocessed product; no automatic flood detection is performed.',
    };
  } catch (e) {
    return { configured: true, products: [], note: `Copernicus catalogue unavailable: ${(e as Error).message.slice(0, 180)}` };
  } finally {
    clearTimeout(timer);
  }
}
