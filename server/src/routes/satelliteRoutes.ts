import { Router } from 'express';
import {
  catalogueSearch,
  listLayers,
  providerStatus,
  uploadLayer,
} from '../controllers/satelliteController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

router.use(authenticateToken);

router.get(
  '/layers',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'HEALTH_OFFICER', 'FIELD_RESPONDER'),
  listLayers
);
router.post(
  '/layers',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  rateLimit({ name: 'satellite-import', windowMs: 60_000, max: 6 }),
  uploadLayer
);
router.post(
  '/catalogue/search',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  rateLimit({ name: 'satellite-search', windowMs: 60_000, max: 10 }),
  catalogueSearch
);
router.get(
  '/status',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'HEALTH_OFFICER', 'FIELD_RESPONDER'),
  providerStatus
);

export default router;
