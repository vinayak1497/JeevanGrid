import { Router } from 'express';
import { getEarthquakes } from '../controllers/earthquakeController';

const router = Router();

router.get('/', getEarthquakes);
router.get('/:location', getEarthquakes);

export default router;
