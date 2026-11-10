import { Router } from 'express';
import {
  corroborateCommunityReport,
  decideCommunityReport,
  getCommunitySummary,
  getSimilar,
  listCommunityReports,
} from '../controllers/communityController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

router.get(
  '/reports',
  authenticateToken,
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'FIELD_RESPONDER', 'COMMUNITY_VOLUNTEER', 'HEALTH_OFFICER'),
  listCommunityReports
);
router.get(
  '/summary',
  authenticateToken,
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  getCommunitySummary
);
router.get(
  '/reports/:id/similar',
  authenticateToken,
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'FIELD_RESPONDER', 'COMMUNITY_VOLUNTEER'),
  getSimilar
);
router.post(
  '/reports/:id/corroborate',
  authenticateToken,
  rateLimit({ name: 'community-corroborate', windowMs: 60_000, max: 20 }),
  corroborateCommunityReport
);
router.post(
  '/reports/:id/verify',
  authenticateToken,
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  rateLimit({ name: 'community-verify', windowMs: 60_000, max: 30 }),
  decideCommunityReport
);

export default router;
