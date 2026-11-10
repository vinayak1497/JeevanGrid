import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../utils/prisma';
import {
  ACK_RESPONSES,
  createIncidentFromAcknowledgement,
  getAcknowledgementSummary,
  recordAcknowledgement,
} from '../services/alerts/acknowledgementService';

const ackSchema = z.object({
  alertId: z.string().min(1).max(120),
  response: z.enum(ACK_RESPONSES),
  note: z.string().max(500).optional(),
});

export async function submitAcknowledgement(req: AuthRequest, res: Response): Promise<void> {
  const parsed = ackSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'alertId and a valid response are required.' });
    return;
  }
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in to acknowledge a warning.' });
      return;
    }
    const result = await recordAcknowledgement({
      ...parsed.data,
      userId: req.user.id,
      district: req.user.district,
      state: req.user.state,
    });
    res.status(result.duplicate ? 200 : 201).json({
      message: result.duplicate
        ? 'You already recorded this response for the alert.'
        : 'Response recorded. Assistance requests are reviewed by district officers; this does not dispatch a team.',
      acknowledgement: result.acknowledgement,
      duplicate: result.duplicate,
      distinction: 'An acknowledgement is not a verified emergency incident.',
    });
  } catch (error) {
    res.status((error as any).statusCode || 500).json({ error: (error as Error).message });
  }
}

export async function myAcknowledgements(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const acknowledgements = await prisma.alertAcknowledgement.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, alertId: true, response: true, createdAt: true, incidentId: true },
    });
    res.json({ acknowledgements });
  } catch (error) {
    console.error('My acknowledgements error:', error);
    res.status(500).json({ error: 'Failed to load acknowledgements.' });
  }
}

export async function acknowledgementSummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district =
      typeof req.query.district === 'string' ? req.query.district : req.user?.district || 'Mumbai Suburban';
    const days = parseInt(String(req.query.days || '30'), 10) || 30;
    res.json(await getAcknowledgementSummary(district, days));
  } catch (error) {
    console.error('Acknowledgement summary error:', error);
    res.status(500).json({ error: 'Failed to build acknowledgement summary.' });
  }
}

export async function convertToIncident(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const result = await createIncidentFromAcknowledgement(req.params.id, req.user);
    res.status(result.alreadyConverted ? 200 : 201).json({
      message: result.alreadyConverted
        ? 'This acknowledgement is already linked to an incident.'
        : 'Operational assistance follow-up created. No team was dispatched automatically.',
      ...result,
    });
  } catch (error) {
    res.status((error as any).statusCode || 500).json({ error: (error as Error).message });
  }
}
