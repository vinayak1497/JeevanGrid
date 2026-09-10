import { Router } from 'express';
import { getAdvisorySources } from '../controllers/advisoriesController';

const router = Router();

router.get('/sources', getAdvisorySources);

export default router;
