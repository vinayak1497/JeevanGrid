import { Router } from 'express';
import { resolveGeo, listGeoStates, listGeoDistricts, nearestGeo } from '../controllers/geoController';
import { getGeoOverlays } from '../controllers/geoOverlaysController';

const router = Router();

router.get('/resolve', resolveGeo);
router.get('/resolve/:location', resolveGeo);
router.get('/nearest', nearestGeo);
router.get('/states', listGeoStates);
router.get('/districts', listGeoDistricts);
router.get('/overlays', getGeoOverlays);

export default router;
