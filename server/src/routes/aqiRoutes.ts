import { Router } from 'express';
import { getAqi } from '../controllers/aqiController';

const router = Router();
router.get('/', getAqi);

export default router;
