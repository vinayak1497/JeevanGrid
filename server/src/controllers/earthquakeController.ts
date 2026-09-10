import { Request, Response } from 'express';
import { usgsService } from '../services/usgsService';

export async function getEarthquakes(req: Request, res: Response): Promise<void> {
  try {
    const location = (req.params.location || req.query.location || 'Mumbai') as string;
    const radiusKm = Math.min(2000, Math.max(50, Number(req.query.radiusKm) || 500));
    const minMagnitude = Math.min(8, Math.max(1, Number(req.query.minMagnitude) || 4));
    const summary = await usgsService.getNearbyQuakes(location, radiusKm, minMagnitude);
    res.json({ earthquakes: summary });
  } catch (error) {
    console.error('Earthquake feed error:', error);
    res.status(500).json({ error: 'Failed to fetch earthquake feed.' });
  }
}
