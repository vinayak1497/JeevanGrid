import { Router } from 'express';
import { getRiskAnalysis } from '../controllers/riskController';

const router = Router();
router.get('/', getRiskAnalysis);
router.get('/:location', getRiskAnalysis);

export default router;
