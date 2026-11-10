import { Router } from 'express';
import {
  assignIncident,
  checkInIncident,
  getIncidentById,
  listIncidents,
  listResponders,
  markDuplicateIncident,
  rejectIncident,
  responderAction,
  reviewResolution,
  submitResolution,
  verifyIncident,
} from '../controllers/incidentController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

const DDMA = ['DISTRICT_OFFICER', 'STATE_EOC'];
const OPERATIONAL_READ = [...DDMA, 'FIELD_RESPONDER', 'CITIZEN'];

router.get('/', authenticateToken, requireRole(...OPERATIONAL_READ), listIncidents);
router.get('/responders', authenticateToken, requireRole(...DDMA), listResponders);
router.get('/:id', authenticateToken, requireRole(...OPERATIONAL_READ), getIncidentById);

router.patch('/:id/verify', authenticateToken, requireRole(...DDMA), verifyIncident);
router.patch('/:id/reject', authenticateToken, requireRole(...DDMA), rejectIncident);
router.patch('/:id/duplicate', authenticateToken, requireRole(...DDMA), markDuplicateIncident);
router.patch('/:id/assign', authenticateToken, requireRole(...DDMA), assignIncident);

router.patch(
  '/:id/responder-action',
  authenticateToken,
  requireRole('FIELD_RESPONDER'),
  responderAction
);
router.post(
  '/:id/check-in',
  authenticateToken,
  requireRole('FIELD_RESPONDER'),
  rateLimit({ name: 'incident-check-in', windowMs: 60_000, max: 20 }),
  checkInIncident
);
router.post(
  '/:id/resolution',
  authenticateToken,
  requireRole('FIELD_RESPONDER'),
  rateLimit({ name: 'incident-resolution', windowMs: 60_000, max: 10 }),
  submitResolution
);
router.post(
  '/:id/review-resolution',
  authenticateToken,
  requireRole(...DDMA),
  rateLimit({ name: 'resolution-review', windowMs: 60_000, max: 30 }),
  reviewResolution
);

export default router;
