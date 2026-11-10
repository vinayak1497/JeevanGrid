import { Router } from 'express';
import {
  createEmergencyReport,
  getEmergencyReport,
  listEmergencyReports,
} from '../controllers/emergencyReportController';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/authMiddleware';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

// Guests may submit without an account. If a valid token is present the report
// is linked to that citizen; invalid/expired tokens do not block a life-safety
// report and are treated as guest. Rate limiting is by client IP.
router.post(
  '/',
  rateLimit({ name: 'emergency-report', windowMs: 60_000, max: 6 }),
  optionalAuth,
  createEmergencyReport
);

router.get(
  '/',
  authenticateToken,
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'FIELD_RESPONDER', 'CITIZEN'),
  listEmergencyReports
);

// Never public: a sequential/guessable lookup would expose reporter details and
// exact coordinates. Officers, the assigned responder, or the report owner only.
router.get('/:id', authenticateToken, getEmergencyReport);

export default router;
