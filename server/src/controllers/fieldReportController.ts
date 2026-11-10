import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  LifecycleError,
  applyIncidentTransition,
  assertCanRespond,
} from '../services/incidents/incidentLifecycleService';

const fieldReportSchema = z
  .object({
    incidentId: z.string().min(1).max(120),
    situationReport: z.string().trim().min(3).max(4000),
    casualtiesRescued: z.coerce.number().int().min(0).max(100000).optional(),
    medicalRequired: z.boolean().optional(),
    notes: z.string().max(2000).nullable().optional(),
    photoUrl: z.string().max(3_000_000).nullable().optional(),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    markCompleted: z.boolean().optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,100}$/).optional(),
  })
  .superRefine((value, ctx) => {
    const hasLat = value.latitude !== null && typeof value.latitude !== 'undefined';
    const hasLng = value.longitude !== null && typeof value.longitude !== 'undefined';
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Latitude and longitude must be supplied together.',
      });
    }
  });

export async function submitFieldReport(req: AuthRequest, res: Response): Promise<void> {
  const parsed = fieldReportSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'incidentId and situationReport are required.',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }
  const data = parsed.data;
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required to submit field reports.' });
    return;
  }

  try {
    if (data.idempotencyKey) {
      const existing = await prisma.fieldReport.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) {
        res.status(200).json({
          message: 'This queued field report was already received by JeevanGrid.',
          fieldReport: existing,
          duplicate: true,
        });
        return;
      }
    }

    const incident = await prisma.incident.findUnique({ where: { id: data.incidentId } });
    if (!incident) throw new LifecycleError('Incident not found.', 404);
    assertCanRespond(req.user, incident);

    const isCompletion = Boolean(data.markCompleted);
    const action = isCompletion ? 'SUBMIT_RESOLUTION' : 'SITUATION_UPDATE';
    let fieldReport: any = null;
    let nextStatus = incident.status;

    await prisma.$transaction(async (tx) => {
      nextStatus = await applyIncidentTransition(tx, {
        incident,
        action,
        actor: { id: req.user!.id, role: req.user!.role },
        description: isCompletion
          ? 'Responder marked work complete through a situation report. DDMA review is required before closure.'
          : 'Responder submitted an on-site situation update.',
        eventType: isCompletion ? 'RESOLUTION_SUBMITTED' : 'SITUATION_UPDATE',
        metadata: {
          casualtiesRescued: data.casualtiesRescued || 0,
          medicalRequired: Boolean(data.medicalRequired),
        },
        data: isCompletion ? { resolutionSubmittedAt: new Date() } : {},
      });
      fieldReport = await tx.fieldReport.create({
        data: {
          incidentId: incident.id,
          responderId: req.user!.id,
          responderName: req.user!.name || 'Field Responder',
          reportType: isCompletion ? 'RESOLUTION' : 'SITUATION',
          situationReport: data.situationReport,
          situationAfter: isCompletion ? data.notes || 'Responder reported work complete; pending DDMA review.' : null,
          peopleAssisted: data.casualtiesRescued ?? 0,
          casualtiesRescued: data.casualtiesRescued || 0,
          medicalRequired: Boolean(data.medicalRequired),
          notes: data.notes || null,
          photoUrl: data.photoUrl || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          idempotencyKey: data.idempotencyKey || null,
        },
      });
    });

    res.status(201).json({
      message: isCompletion
        ? 'Completion submitted. The incident is pending DDMA review, not resolved.'
        : 'Situation update recorded.',
      fieldReport,
      incidentStatus: nextStatus,
    });
  } catch (error) {
    const statusCode = error instanceof LifecycleError ? error.statusCode : 500;
    if (statusCode >= 500) console.error('Submit field report error:', error);
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Failed to submit field report.',
    });
  }
}

export async function listFieldReports(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const incidentId = typeof req.query.incidentId === 'string' ? req.query.incidentId : undefined;
    const where: any = {};
    if (incidentId) where.incidentId = incidentId;

    if (req.user.role === 'FIELD_RESPONDER') {
      where.responderId = req.user.id;
    } else if (req.user.role === 'DISTRICT_OFFICER') {
      where.incident = { is: { district: req.user.district, state: req.user.state } };
    } else if (req.user.role === 'STATE_EOC') {
      where.incident = { is: { state: req.user.state } };
    } else {
      res.status(403).json({ error: 'Field reports are restricted to operational roles.' });
      return;
    }

    const reports = await prisma.fieldReport.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: 200,
      include: {
        incident: {
          select: { id: true, referenceCode: true, title: true, emergencyType: true, locationName: true, status: true },
        },
      },
    });
    res.json({ fieldReports: reports });
  } catch (error) {
    console.error('List field reports error:', error);
    res.status(500).json({ error: 'Failed to fetch field reports.' });
  }
}
