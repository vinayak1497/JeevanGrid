import { Request, Response } from 'express';
import { aqiService } from '../services/aqiService';

export async function getAqi(req: Request, res: Response): Promise<void> {
  try {
    const location = (req.query.location as string) || 'Mumbai';
    const aqi = await aqiService.getAqiForLocation(location);
    res.json({ aqi });
  } catch (error) {
    console.error('AQI controller error:', error);
    res.status(500).json({ error: 'Failed to fetch AQI data.' });
  }
}
