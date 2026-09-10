import { Router } from 'express';
import { getAssessment, postScenario } from '../controllers/healthIntelligenceController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = Router();

router.get(
  '/assess',
  authenticateToken,
  requireRole('HEALTH_OFFICER', 'DISTRICT_OFFICER', 'STATE_EOC'),
  getAssessment
);
router.post(
  '/scenario',
  authenticateToken,
  requireRole('HEALTH_OFFICER', 'DISTRICT_OFFICER', 'STATE_EOC'),
  postScenario
);

export default router;
