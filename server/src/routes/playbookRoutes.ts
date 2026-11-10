import { Router } from 'express';
import {
  activate,
  getSuggestions,
  getTemplates,
  listActivations,
  loadDemoScenario,
  patchTask,
  summary,
} from '../controllers/playbookController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

router.use(authenticateToken);

router.get(
  '/templates',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'HEALTH_OFFICER', 'FIELD_RESPONDER', 'COMMUNITY_VOLUNTEER'),
  getTemplates
);
router.get(
  '/suggestions',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'HEALTH_OFFICER'),
  getSuggestions
);
router.get(
  '/summary',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  summary
);
router.get(
  '/',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'HEALTH_OFFICER', 'FIELD_RESPONDER', 'COMMUNITY_VOLUNTEER'),
  listActivations
);
router.post(
  '/activate',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  rateLimit({ name: 'playbook-activate', windowMs: 60_000, max: 10 }),
  activate
);
router.post(
  '/demo-scenario',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC'),
  rateLimit({ name: 'playbook-demo', windowMs: 60_000, max: 5 }),
  loadDemoScenario
);
router.patch(
  '/tasks/:id',
  requireRole('DISTRICT_OFFICER', 'STATE_EOC', 'HEALTH_OFFICER', 'FIELD_RESPONDER', 'COMMUNITY_VOLUNTEER'),
  rateLimit({ name: 'playbook-task', windowMs: 60_000, max: 60 }),
  patchTask
);

export default router;
