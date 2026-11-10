import { Router } from 'express';
import {
  chatWithAssistant,
  chatLegacy,
  getAssistantStatus,
  transcribeAudio,
  getToolActivity,
} from '../controllers/aiController';
import { extractEmergency } from '../controllers/voiceReportController';
import { rateLimit } from '../utils/rateLimit';

const router = Router();

router.post('/chat', chatWithAssistant);
router.post('/chat-legacy', chatLegacy);
router.get('/status', getAssistantStatus);
router.post('/transcribe', transcribeAudio);
router.get('/tools-activity', getToolActivity);
router.post(
  '/extract-emergency',
  rateLimit({ name: 'voice-extract', windowMs: 60_000, max: 15 }),
  extractEmergency
);

export default router;
