import { Router } from 'express';
import { assessExposure, getSummary, listAssessments } from '../controllers/impactController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { rateLimit } from '../utils/rateLimit';

const router = Router();
const officerRoles = requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'HEALTH_OFFICER', 'FIELD_RESPONDER');

router.post('/assess', authenticateToken, officerRoles, rateLimit({ name: 'impact-assess', windowMs: 60_000, max: 12 }), assessExposure);
router.get('/assessments', authenticateToken, officerRoles, listAssessments);
router.get('/summary', authenticateToken, officerRoles, getSummary);

export default router;
