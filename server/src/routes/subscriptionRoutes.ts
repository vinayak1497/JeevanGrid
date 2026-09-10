import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import {
  listSubscriptions,
  upsertSubscription,
  deleteSubscription,
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from '../controllers/subscriptionController';

const router = Router();

router.get('/alert-subscriptions', authenticateToken, listSubscriptions);
router.post('/alert-subscriptions', authenticateToken, upsertSubscription);
router.delete('/alert-subscriptions/:id', authenticateToken, deleteSubscription);

router.get('/push/vapid-public-key', getVapidPublicKey);
router.post('/push-subscriptions', authenticateToken, savePushSubscription);
router.delete('/push-subscriptions', authenticateToken, deletePushSubscription);

export default router;
