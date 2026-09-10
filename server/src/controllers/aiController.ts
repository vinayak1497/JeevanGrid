import { Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { aiOrchestrator, SUPPORTED_LANGUAGES } from '../services/aiOrchestrator';
import { nugenService } from '../services/nugenService';
import { deepseekService } from '../services/deepseekService';
import { speechService } from '../services/speechService';
import { getToolLog } from '../services/aiOrchestrator';

function sanitizeMessages(input: any): Array<{ role: string; content: string }> | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) return null;
  const out: Array<{ role: string; content: string }> = [];
  for (const m of input) {
    if (!m || typeof m !== 'object') return null;
    const role = m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : null;
    const content = typeof m.content === 'string' ? m.content.slice(0, 2000) : null;
    if (!role || content === null || content.trim().length === 0) return null;
    out.push({ role, content });
  }
  if (!out.some((m) => m.role === 'user')) return null;
  return out;
}

function sanitizeLocation(input: any): string | undefined {
  if (input === undefined || input === null) return undefined;
  const s = String(input).slice(0, 120).trim();
  return s.length ? s : undefined;
}

function sanitizeCoords(input: any): { lat: number; lng: number } | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

function sanitizeLanguage(input: any): string | undefined {
  if (input === undefined || input === null) return undefined;
  const s = String(input).slice(0, 8).toLowerCase();
  return /^[a-z]{2}(-[a-z]{2})?$/.test(s) ? s.slice(0, 2) : undefined;
}

/** Orchestrated chat: intent -> tools -> Nugen/DeepSeek/local -> structured reply. */
export async function chatWithAssistant(req: Request, res: Response): Promise<void> {
  try {
    const messages = sanitizeMessages(req.body?.messages);
    if (!messages) {
      res.status(400).json({ error: 'messages must be a non-empty array (max 20) with user/assistant roles and text content.' });
      return;
    }
    const result = await aiOrchestrator.handle({
      messages,
      location: sanitizeLocation(req.body?.location),
      coords: sanitizeCoords(req.body?.coords),
      language: sanitizeLanguage(req.body?.language) || 'en',
    });
    res.json(result);
  } catch (error) {
    console.error('AI chat controller error:', error);
    res.status(500).json({ error: 'Error generating response from disaster intelligence assistant.' });
  }
}

/** Legacy direct-assistant path (kept for compatibility). */
export async function chatLegacy(req: Request, res: Response): Promise<void> {
  try {
    const messages = sanitizeMessages(req.body?.messages);
    if (!messages) {
      res.status(400).json({ error: 'messages array is required.' });
      return;
    }
    const result = await aiService.handleCitizenQuery(messages as any, sanitizeLocation(req.body?.location));
    res.json(result);
  } catch (error) {
    console.error('AI legacy chat error:', error);
    res.status(500).json({ error: 'Error generating response from disaster intelligence assistant.' });
  }
}

/** Honest capability status: configured providers, recent failures, demo mode. */
export function getAssistantStatus(_req: Request, res: Response): void {
  const nugen = nugenService.isAvailable();
  const deep = deepseekService.getHealth();
  const degraded =
    (nugen && false) || (deep.configured && deep.consecutiveFailures > 0) || deep.consecutiveFailures >= 3;
  res.json({
    status: 'online',
    service: 'JeevanGrid AI Safety Intelligence',
    demoMode: process.env.DEMO_MODE === 'true',
    degraded: Boolean(degraded),
    providers: {
      nugen: { configured: nugen, mode: nugen ? 'aligned-model' : 'unavailable', fallback: 'local_aligned_engine' },
      deepseek: {
        configured: deep.configured,
        consecutiveFailures: deep.consecutiveFailures,
        lastOkAt: deep.lastOkAt,
        lastErrorAt: deep.lastErrorAt,
      },
      local: { configured: true, mode: 'structured-safety-engine' },
    },
    speechToText: speechService.providerStatus(),
    textToSpeech: { mode: 'browser-synthesis', serverProvider: null },
    languages: SUPPORTED_LANGUAGES,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Audio transcription (abstract provider).
 * Contract: POST JSON { audioBase64, mimeType?, language? }.
 * Without a configured STT provider this honestly reports 503 so clients
 * use on-device transcription instead of failing silently.
 */
export async function transcribeAudio(req: Request, res: Response): Promise<void> {
  try {
    const { audioBase64, mimeType, language } = req.body || {};
    if (typeof audioBase64 !== 'string' || audioBase64.length < 100 || audioBase64.length > 8_000_000) {
      res.status(400).json({ error: 'audioBase64 (100B–8MB) is required.' });
      return;
    }
    if (mimeType !== undefined && (typeof mimeType !== 'string' || mimeType.length > 80)) {
      res.status(400).json({ error: 'Invalid mimeType.' });
      return;
    }
    const result = await speechService.transcribe({
      audioBase64,
      mimeType,
      language: sanitizeLanguage(language) || 'en',
    });
    if (!result) {
      res.status(503).json({
        error: 'Server transcription is not configured.',
        code: 'STT_UNAVAILABLE',
        fallback: 'browser-speech-recognition',
        detail: 'Use on-device speech recognition; no audio was stored.',
      });
      return;
    }
    res.json(result);
  } catch (error) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: 'Transcription failed.' });
  }
}

/** Recent internal tool invocations (operational visibility, no PII). */
export function getToolActivity(_req: Request, res: Response): void {
  res.json({ activity: getToolLog().slice(-50) });
}
