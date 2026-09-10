import { Router } from 'express';
import { listAlerts, getAlertById } from '../controllers/alertsController';

const router = Router();
router.get('/', listAlerts);
router.get('/:id', getAlertById);

export default router;
