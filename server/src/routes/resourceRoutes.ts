import { Router } from 'express';
import { listShelters, listHospitals, listResources, getHelplines } from '../controllers/resourceController';

const router = Router();

router.get('/shelters', listShelters);
router.get('/hospitals', listHospitals);
router.get('/inventory', listResources);
router.get('/helplines', getHelplines);

export default router;
