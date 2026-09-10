import { Router } from 'express';
import { submitFieldReport, listFieldReports } from '../controllers/fieldReportController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/', authenticateToken, submitFieldReport);
router.get('/', authenticateToken, listFieldReports);

export default router;
