import { Router } from 'express';
import { listFacilities } from '../controllers/facilitiesController';

const router = Router();

router.get('/', listFacilities);

export default router;
