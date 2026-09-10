import { Router } from 'express';
import {
  getDistrictDashboard,
  getHealthDashboard,
  getStateEocDashboard,
  getVolunteerDashboard,
} from '../controllers/dashboardController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';

const router = Router();

router.get('/district', authenticateToken, requireRole('DISTRICT_OFFICER', 'STATE_EOC'), getDistrictDashboard);
router.get('/health', authenticateToken, requireRole('HEALTH_OFFICER', 'DISTRICT_OFFICER', 'STATE_EOC'), getHealthDashboard);
router.get('/state', authenticateToken, requireRole('STATE_EOC'), getStateEocDashboard);
router.get('/volunteer', authenticateToken, requireRole('COMMUNITY_VOLUNTEER', 'DISTRICT_OFFICER'), getVolunteerDashboard);

export default router;
