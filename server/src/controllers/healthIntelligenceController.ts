import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { getHealthAssessment, getHealthScenario } from '../services/health/healthAssessmentService';

/**
 * GET /api/health-intelligence/assess?location=&nugen=true
 * Live Climate → Health Intelligence assessment. Deterministic environmental
 * risk always computed; Nugen interpretation is additive and clearly labeled.
 */
export async function getAssessment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const location =
      (req.query.location as string) ||
      (req.user?.district ? `${req.user.district}, ${req.user.state || ''}` : 'Mumbai, Maharashtra');
    const withNugen = String(req.query.nugen ?? 'true').toLowerCase() !== 'false';
    const payload = await getHealthAssessment(location, { withNugen });
    res.json(payload);
  } catch (error) {
    console.error('Health assessment error:', error);
    res.status(500).json({ error: 'Failed to compute climate-health assessment.' });
  }
}

/**
 * POST /api/health-intelligence/scenario { location, preset }
 * Preparedness simulator. Recalculates deterministic indicators on adjusted
 * inputs. ALWAYS labeled scenario — never a forecast, never persisted.
 * preset: rain25 | rain50 | heat2 | aqi50
 */
export async function postScenario(req: AuthRequest, res: Response): Promise<void> {
  try {
    const location =
      (req.body?.location as string) ||
      (req.user?.district ? `${req.user.district}, ${req.user.state || ''}` : 'Mumbai, Maharashtra');
    const preset = String(req.body?.preset || '');
    const withNugen = req.body?.nugen !== false;
    const payload = await getHealthScenario(location, preset, { withNugen });
    res.json(payload);
  } catch (error) {
    const msg = (error as Error).message || 'Failed to compute scenario.';
    if (/unknown scenario preset/i.test(msg)) {
      res.status(400).json({ error: msg });
      return;
    }
    console.error('Health scenario error:', error);
    res.status(500).json({ error: 'Failed to compute scenario.' });
  }
}
