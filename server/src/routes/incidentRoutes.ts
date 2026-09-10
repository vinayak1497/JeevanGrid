import { Router } from 'express';
import { listIncidents, getIncidentById, assignIncident, updateIncidentStatus, listResponders } from '../controllers/incidentController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.get('/', authenticateToken, listIncidents);
router.get('/responders', authenticateToken, listResponders);
router.get('/:id', authenticateToken, getIncidentById);
router.patch('/:id/assign', authenticateToken, assignIncident);
router.patch('/:id/status', authenticateToken, updateIncidentStatus);

export default router;
