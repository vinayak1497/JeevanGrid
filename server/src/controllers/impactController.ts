import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  assessImpact,
  getImpactSummary,
  listImpactAssessments,
} from '../services/impact/impactAssessmentService';

const assessSchema = z.object({
  alertId: z.string().min(1).max(120).optional(),
  location: z.string().min(2).max(160).optional(),
  geometry: z.any().optional(),
  hazardType: z.string().min(2).max(40).optional(),
  district: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  locationName: z.string().max(160).optional(),
  isSimulation: z.boolean().optional(),
  forceRefresh: z.boolean().optional(),
});

export async function assessExposure(req: AuthRequest, res: Response): Promise<void> {
  const parsed = assessSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid impact assessment request.', details: parsed.error.issues.map((i) => i.message) });
    return;
  }
  if (!parsed.data.alertId && !parsed.data.geometry && !parsed.data.location) {
    res.status(400).json({ error: 'Provide an alertId, a GeoJSON polygon, or a location.' });
    return;
  }
  try {
    const result = await assessImpact(parsed.data);
    res.json(result);
  } catch (error) {
    const message = (error as Error).message;
    const status = /not found/i.test(message) ? 404 : /invalid|provide/i.test(message) ? 400 : 502;
    res.status(status).json({ error: message });
  }
}

export async function listAssessments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district = typeof req.query.district === 'string' ? req.query.district : req.user?.district;
    const take = parseInt(String(req.query.take || '10'), 10) || 10;
    const assessments = await listImpactAssessments(district, take);
    res.json({ assessments });
  } catch (error) {
    console.error('List impact assessments error:', error);
    res.status(500).json({ error: 'Failed to list impact assessments.' });
  }
}

export async function getSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district = typeof req.query.district === 'string' ? req.query.district : req.user?.district;
    const summary = await getImpactSummary(district);
    res.json(summary);
  } catch (error) {
    console.error('Impact summary error:', error);
    res.status(500).json({ error: 'Failed to load impact summary.' });
  }
}
