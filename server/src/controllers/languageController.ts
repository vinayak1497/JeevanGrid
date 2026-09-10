/**
 * Language + speech HTTP layer (spec §30).
 *
 *   GET  /api/languages            — supported languages + active provider
 *   POST /api/language/detect      — { text } -> { language, confidence, mixed }
 *   POST /api/language/translate   — { text, sourceLanguage?, targetLanguage } -> translation
 *   POST /api/speech/synthesize    — honest 501 (browser synthesis is the
 *                                    current path; server TTS awaiting creds)
 *
 * Validation: language codes whitelisted, text length capped, audio size
 * capped, no secrets ever in responses (spec §34).
 */
import { Request, Response } from 'express';
import { languageService } from '../services/language/languageService';
import { normalizeLang } from '../services/language/types';

export function getLanguages(_req: Request, res: Response): void {
  res.json({
    languages: languageService.supportedLanguages(),
    activeProvider: languageService.activeProvider(),
    fallback: 'english-original-retained',
  });
}

export async function detectLanguage(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 4000) : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'text (non-empty, max 4000 chars) is required.' });
    return;
  }
  try {
    res.json(await languageService.detectLanguage(text));
  } catch (e) {
    console.error('Language detect error:', e);
    res.status(500).json({ error: 'Language detection failed.' });
  }
}

export async function translateText(req: Request, res: Response): Promise<void> {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 4000) : '';
  const targetLanguage = normalizeLang(req.body?.targetLanguage);
  const sourceLanguage = normalizeLang(req.body?.sourceLanguage) || undefined;
  if (!text.trim()) {
    res.status(400).json({ error: 'text (non-empty, max 4000 chars) is required.' });
    return;
  }
  if (!targetLanguage) {
    res.status(400).json({ error: 'targetLanguage must be one of: en, hi, mr, gu, as.' });
    return;
  }
  try {
    res.json(await languageService.translate({ text, sourceLanguage, targetLanguage }));
  } catch (e) {
    console.error('Language translate error:', e);
    res.status(500).json({ error: 'Translation failed.' });
  }
}

/**
 * Server TTS is intentionally unimplemented until a provider (Bhashini /
 * Indic TTS) is credentialed — the client uses browser synthesis meanwhile.
 * 501 (not 500) so clients treat it as "capability absent", not "broken".
 */
export function synthesizeSpeech(req: Request, res: Response): void {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 1200) : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'text (non-empty, max 1200 chars) is required.' });
    return;
  }
  const language = normalizeLang(req.body?.language) || 'en';
  res.status(501).json({
    error: 'Server text-to-speech is not configured.',
    code: 'TTS_UNAVAILABLE',
    fallback: 'browser-speech-synthesis',
    language,
    detail: 'Use client speech synthesis; no text was stored.',
  });
}
