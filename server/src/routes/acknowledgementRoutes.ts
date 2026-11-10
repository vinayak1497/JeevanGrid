import { Router } from 'express';
import {
  acknowledgementSummary,
  convertToIncident,
  myAcknowledgements,
  submitAcknowledgement,
} from '../controllers/acknowledgementController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

router.post(
  '/',
  authenticateToken,
  rateLimit({ name: 'alert-ack', windowMs: 60_000, max: 30 }),
  submitAcknowledgement
);
router.get('/mine', authenticateToken, myAcknowledgements);
router.get(
  '/summary',
  authenticateToken,
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  acknowledgementSummary
);
router.post(
  '/:id/incident',
  authenticateToken,
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  rateLimit({ name: 'alert-ack-incident', windowMs: 60_000, max: 20 }),
  convertToIncident
);

export default router;
