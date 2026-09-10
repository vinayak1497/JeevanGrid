import { Router } from 'express';
import {
  chatWithAssistant,
  chatLegacy,
  getAssistantStatus,
  transcribeAudio,
  getToolActivity,
} from '../controllers/aiController';

const router = Router();

router.post('/chat', chatWithAssistant);
router.post('/chat-legacy', chatLegacy);
router.get('/status', getAssistantStatus);
router.post('/transcribe', transcribeAudio);
router.get('/tools-activity', getToolActivity);

export default router;
