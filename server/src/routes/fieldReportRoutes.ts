import { Router } from 'express';
import { submitFieldReport, listFieldReports } from '../controllers/fieldReportController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

router.post(
  '/',
  authenticateToken,
  requireRole('FIELD_RESPONDER'),
  rateLimit({ name: 'field-report', windowMs: 60_000, max: 20 }),
  submitFieldReport
);
router.get(
  '/',
  authenticateToken,
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'FIELD_RESPONDER'),
  listFieldReports
);

export default router;
