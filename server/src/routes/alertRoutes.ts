import { Router } from 'express';
import { listAlerts, getAlertById } from '../controllers/alertsController';
import {
  listOfficialAlerts,
  getAlertSources,
  triggerAlertSync,
  getIntelligenceInfo,
  getNearbyOfficialAlerts,
  getDistrictOfficialAlerts,
  getOfficialAlertById,
  stageOfficialAlert,
} from '../controllers/officialAlertsController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Official, source-verifiable warnings (fail-closed). Use this for the Alerts page.
router.get('/official', listOfficialAlerts);
// Location-aware official warnings (reuse the same fail-closed gate).
router.get('/official/nearby', getNearbyOfficialAlerts);
router.get('/official/district/:district', getDistrictOfficialAlerts);
router.get('/official/:id', getOfficialAlertById);
// District/EOC staging: official warning → internal operational record.
// EOC roles only; creates an Incident + STAGED audit entry.
router.post(
  '/official/:id/stage',
  authenticateToken,
  requireRole('STATE_EOC', 'DISTRICT_OFFICER'),
  stageOfficialAlert
);
// Source registry health — distinguishes "no warnings" from "source unavailable".
router.get('/sources', getAlertSources);
// JeevanGrid's own risk intelligence (explicitly NOT an official warning).
router.get('/intelligence', getIntelligenceInfo);
// Manual ingestion trigger (EOC / debugging). Authenticated EOC roles only so
// anonymous clients cannot hammer government feeds or force backfills.
// The backend worker polls on a schedule regardless of browser activity.
router.post(
  '/sync',
  authenticateToken,
  requireRole('STATE_EOC', 'DISTRICT_OFFICER'),
  triggerAlertSync
);

// Legacy endpoints (hardened: backend expiry + production demo exclusion).
router.get('/', listAlerts);
router.get('/:id', getAlertById);

export default router;
