import { Request, Response } from 'express';
import { geoOverlaysService } from '../services/geoOverlaysService';

export async function getGeoOverlays(req: Request, res: Response): Promise<void> {
  try {
    const location = (req.query.location as string) || 'Mumbai';
    const overlays = await geoOverlaysService.getOverlays(location);
    res.json({ overlays });
  } catch (error) {
    console.error('Geo overlays error:', error);
    res.status(500).json({ error: 'Failed to fetch map overlays.' });
  }
}
