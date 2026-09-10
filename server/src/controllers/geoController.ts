import { Request, Response } from 'express';
import { geoService } from '../services/geoService';

export async function resolveGeo(req: Request, res: Response): Promise<void> {
  const location = (req.query.location as string) || (req.params.location as string) || 'Mumbai';
  res.json({ geo: await geoService.resolveLocationLive(location) });
}

export function listGeoStates(_req: Request, res: Response): void {
  res.json({ states: geoService.listStates(), geometry: geoService.geometryStatus() });
}

export function listGeoDistricts(req: Request, res: Response): void {
  const state = req.query.state as string | undefined;
  res.json({ districts: geoService.listDistricts(state), geometry: geoService.geometryStatus() });
}

export function nearestGeo(req: Request, res: Response): void {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Valid lat (-90..90) and lng (-180..180) query params are required.' });
    return;
  }
  res.json({ geo: geoService.nearestCity(lat, lng) });
}
