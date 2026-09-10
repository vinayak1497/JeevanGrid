import { Router } from 'express';
import { listGuides, getGuideBySlug } from '../controllers/guideController';

const router = Router();

router.get('/', listGuides);
router.get('/:slug', getGuideBySlug);

export default router;
