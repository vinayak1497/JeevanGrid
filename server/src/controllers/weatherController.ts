import { Request, Response } from 'express';
import { weatherService } from '../services/weatherService';

export async function getWeather(req: Request, res: Response): Promise<void> {
  try {
    const location = (req.query.location as string) || 'Mumbai';
    const weather = await weatherService.getWeatherForLocation(location);
    res.json({ weather });
  } catch (error) {
    console.error('Weather controller error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data.' });
  }
}
