import { Router } from 'express';
import { createEmergencyReport, listEmergencyReports, getEmergencyReport } from '../controllers/emergencyReportController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', createEmergencyReport);
router.get('/', authenticateToken, listEmergencyReports);
router.get('/:id', getEmergencyReport);

export default router;
