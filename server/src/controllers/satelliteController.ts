import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  importSatelliteLayer,
  isCopernicusConfigured,
  listSatelliteLayers,
  searchCopernicusCatalogue,
  validateCatalogueQuery,
} from '../services/satellite/satelliteLayerService';

const layerSchema = z.object({
  eventName: z.string().trim().min(2).max(160),
  areaName: z.string().trim().min(2).max(160),
  district: z.string().trim().min(2).max(80),
  state: z.string().trim().max(80).optional(),
  sourceOrganisation: z.string().trim().min(2).max(160),
  observationDate: z.string().min(4).max(40),
  processedDate: z.string().min(4).max(40),
  productReference: z.string().trim().min(2).max(200),
  geometryPrecision: z.enum(['EXACT', 'APPROXIMATE']),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED']),
  geojson: z.any(),
  isSimulation: z.boolean().optional(),
});

export async function uploadLayer(req: AuthRequest, res: Response): Promise<void> {
  const parsed = layerSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'All satellite product metadata fields are required.',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const layer = await importSatelliteLayer({
      ...(parsed.data as any),
      geojson: parsed.data.geojson,
      uploadedBy: req.user,
    });
    res.status(201).json({
      message: 'Satellite layer imported. It is not an automatic damage detection product.',
      layer,
    });
  } catch (error) {
    res.status((error as any).statusCode || 500).json({ error: (error as Error).message });
  }
}

export async function listLayers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district =
      typeof req.query.district === 'string'
        ? req.query.district
        : req.user?.role === 'STATE_EOC'
          ? undefined
          : req.user?.district;
    const layers = await listSatelliteLayers(district, parseInt(String(req.query.take || '30'), 10) || 30);
    res.json({
      layers,
      note: 'Manually imported layers retain source and dates. No automatic flood/damage detection was applied.',
    });
  } catch (error) {
    console.error('List satellite layers error:', error);
    res.status(500).json({ error: 'Failed to list satellite layers.' });
  }
}

export async function catalogueSearch(req: AuthRequest, res: Response): Promise<void> {
  const validation = validateCatalogueQuery(req.body || {});
  if (!validation.ok) {
    res.status(400).json({ error: validation.reason });
    return;
  }
  try {
    const result = await searchCopernicusCatalogue({
      bbox: req.body.bbox.map(Number) as [number, number, number, number],
      from: req.body.from,
      to: req.body.to,
      collection: req.body.collection ? String(req.body.collection) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Copernicus catalogue error:', error);
    res.status(502).json({ error: 'Copernicus catalogue search failed.' });
  }
}

export async function providerStatus(req: AuthRequest, res: Response): Promise<void> {
  res.json({
    configured: isCopernicusConfigured(),
    provider: 'Copernicus Data Space Ecosystem',
    capabilities: {
      catalogueSearch: isCopernicusConfigured(),
      manualGeoJsonImport: true,
      automaticFloodDetection: false,
    },
    note: isCopernicusConfigured()
      ? 'Catalogue metadata search is available. Import remains manual and labelled.'
      : 'Set COPERNICUS_CLIENT_ID and COPERNICUS_CLIENT_SECRET to enable catalogue search. Manual import works without credentials.',
  });
}
