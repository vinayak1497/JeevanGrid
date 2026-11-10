import { Router } from 'express';
import { planRoute, routingStatus } from '../controllers/evacuationController';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

router.get('/status', routingStatus);
router.post('/plan', rateLimit({ name: 'evacuation-plan', windowMs: 60_000, max: 20 }), planRoute);

export default router;
