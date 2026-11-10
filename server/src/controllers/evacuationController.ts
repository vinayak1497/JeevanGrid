import { Request, Response } from 'express';
import { z } from 'zod';
import { isRoutingConfigured, planEvacuation } from '../services/routing/evacuationRoutingService';

const planSchema = z.object({
  originLat: z.coerce.number().min(-90).max(90),
  originLng: z.coerce.number().min(-180).max(180),
  district: z.string().max(80).optional(),
  profile: z.enum(['driving-car', 'foot-walking', 'cycling-regular']).optional(),
  radiusKm: z.coerce.number().min(1).max(50).optional(),
});

export async function planRoute(req: Request, res: Response): Promise<void> {
  const parsed = planSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid originLat and originLng are required.' });
    return;
  }
  try {
    const plan = await planEvacuation(parsed.data);
    res.json({
      ...plan,
      routingConfigured: isRoutingConfigured(),
      privacyNote: 'Your location is used for this request and is not stored by the evacuation planner.',
    });
  } catch (error) {
    console.error('Evacuation planning error:', error);
    res.status(502).json({ error: 'Unable to build an evacuation recommendation.' });
  }
}

export async function routingStatus(req: Request, res: Response): Promise<void> {
  res.json({
    configured: isRoutingConfigured(),
    provider: isRoutingConfigured() ? 'openrouteservice' : 'none',
    note: isRoutingConfigured()
      ? 'OpenRouteService Directions with verified-hazard avoidance where supported.'
      : 'Normal routing only. Set OPENROUTESERVICE_API_KEY on the server to enable hazard-aware routes.',
  });
}
