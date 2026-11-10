import { Request, Response } from 'express';
import { z } from 'zod';
import { extractEmergencyFromTranscript } from '../services/ai/structuredExtractionService';

const schema = z.object({
  transcript: z.string().trim().min(5).max(2000),
  language: z.string().max(8).optional(),
});

export async function extractEmergency(req: Request, res: Response): Promise<void> {
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide a transcript between 5 and 2000 characters.' });
    return;
  }
  try {
    const result = await extractEmergencyFromTranscript(parsed.data.transcript, parsed.data.language);
    res.json({
      ...result,
      requiresConfirmation: true,
      note: 'AI extraction is advisory. Confirm or edit every field before submitting.',
    });
  } catch (error) {
    console.error('Emergency extraction error:', error);
    res.status(500).json({ error: 'Failed to extract emergency details.' });
  }
}
