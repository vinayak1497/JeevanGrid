import { Router } from 'express';
import { uploadReportPhoto } from '../controllers/uploadController';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

router.post(
  '/report-photo',
  rateLimit({ name: 'photo-upload', windowMs: 60_000, max: 8 }),
  uploadReportPhoto
);

export default router;
