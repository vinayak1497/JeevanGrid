import { Router } from 'express';
import {
  detectLanguage,
  getLanguages,
  synthesizeSpeech,
  translateText,
} from '../controllers/languageController';

const router = Router();

router.get('/languages', getLanguages);
router.post('/language/detect', detectLanguage);
router.post('/language/translate', translateText);
router.post('/speech/synthesize', synthesizeSpeech);

export default router;
