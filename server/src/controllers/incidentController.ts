import { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { haversineKm } from '../utils/geo';
import {
  ACTIVE_FIELD_STATUSES,
  LifecycleError,
  applyIncidentTransition,
  assertCanManage,
  assertCanRespond,
  assertResponderInJurisdiction,
  canViewIncident,
  type LifecycleAction,
} from '../services/incidents/incidentLifecycleService';

const incidentInclude = {
  report: true,
  assignedTo: {
    select: { id: true, name: true, email: true, phone: true, role: true, district: true, state: true },
  },
  assignedBy: { select: { id: true, name: true, role: true } },
  verifiedBy: { select: { id: true, name: true, role: true } },
  resolutionReviewedBy: { select: { id: true, name: true, role: true } },
  fieldReports: {
    include: { responder: { select: { id: true, name: true, role: true } } },
    orderBy: { submittedAt: 'desc' },
  },
  events: { orderBy: { createdAt: 'asc' } },
} as Prisma.IncidentInclude;

async function findIncident(id: string): Promise<any> {
  return prisma.incident.findUnique({ where: { id }, include: incidentInclude });
}

async function requireIncident(id: string): Promise<any> {
  const incident = await findIncident(id);
  if (!incident) throw new LifecycleError('Incident not found.', 404);
  return incident;
}

function sendError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof LifecycleError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

function actorFrom(req: AuthRequest): { id: string; role: string } {
  if (!req.user) throw new LifecycleError('Authentication required.', 401);
  return { id: req.user.id, role: req.user.role };
}

export async function listIncidents(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const role = req.user.role;
    const where: any = {};
    if (typeof req.query.status === 'string' && req.query.status.trim()) {
      where.status = req.query.status.trim();
    }

    if (role === 'FIELD_RESPONDER') {
      where.assignedToId = req.user.id;
    } else if (role === 'DISTRICT_OFFICER') {
      where.district = req.user.district;
      where.state = req.user.state;
    } else if (role === 'STATE_EOC') {
      where.state = req.user.state;
    } else if (role === 'CITIZEN') {
      where.report = { reportedByUserId: req.user.id };
    } else {
      res.status(403).json({ error: 'Incident access is restricted to operational roles.' });
      return;
    }

    const incidents = await prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: incidentInclude,
    });

    res.json({ incidents });
  } catch (error) {
    sendError(res, error, 'Failed to fetch incidents.');
  }
}

export async function getIncidentById(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const incident = await findIncident(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }
    if (!canViewIncident(req.user, incident)) {
      res.status(403).json({ error: 'This incident is outside your authorised scope.' });
      return;
    }
    res.json({ incident });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve incident.');
  }
}

const noteSchema = z.object({
  note: z.string().trim().min(5).max(1000),
});

export async function verifyIncident(req: AuthRequest, res: Response): Promise<void> {
  const parsed = noteSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'A verification note of at least 5 characters is required.' });
    return;
  }
  try {
    const actor = actorFrom(req);
    const incident = await requireIncident(req.params.id);
    assertCanManage(req.user, incident);

    await prisma.$transaction(async (tx) => {
      await applyIncidentTransition(tx, {
        incident,
        action: 'VERIFY',
        actor,
        description: 'DDMA officer verified the incident after human review.',
        eventType: 'VERIFIED',
        metadata: { note: parsed.data.note },
        data: {
          verifiedById: actor.id,
          verifiedAt: new Date(),
          duplicateSuspected: false,
        },
      });
      if (incident.reportId) {
        await tx.emergencyReport.update({
          where: { id: incident.reportId },
          data: { verificationStatus: 'OFFICER_VERIFIED' },
        });
      }
    });

    const updated = await findIncident(incident.id);
    res.json({ message: 'Incident verified by a DDMA officer. It is ready for assignment.', incident: updated });
  } catch (error) {
    sendError(res, error, 'Failed to verify incident.');
  }
}

const rejectSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

export async function rejectIncident(req: AuthRequest, res: Response): Promise<void> {
  const parsed = rejectSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'A rejection reason of at least 5 characters is required.' });
    return;
  }
  try {
    const actor = actorFrom(req);
    const incident = await requireIncident(req.params.id);
    assertCanManage(req.user, incident);

    await prisma.$transaction(async (tx) => {
      await applyIncidentTransition(tx, {
        incident,
        action: 'REJECT',
        actor,
        description: 'DDMA officer rejected the incident after human review.',
        eventType: 'REJECTED',
        metadata: { reason: parsed.data.reason },
        data: { duplicateSuspected: false },
      });
      if (incident.reportId) {
        await tx.emergencyReport.update({
          where: { id: incident.reportId },
          data: { verificationStatus: 'REJECTED', status: 'REJECTED' },
        });
      }
    });

    const updated = await findIncident(incident.id);
    res.json({ message: 'Incident rejected. The reason is in the audit trail.', incident: updated });
  } catch (error) {
    sendError(res, error, 'Failed to reject incident.');
  }
}

const duplicateSchema = z.object({
  note: z.string().trim().min(5).max(1000),
  duplicateOfReference: z.string().trim().max(80).optional(),
});

export async function markDuplicateIncident(req: AuthRequest, res: Response): Promise<void> {
  const parsed = duplicateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'A duplicate-review note of at least 5 characters is required.' });
    return;
  }
  try {
    const actor = actorFrom(req);
    const incident = await requireIncident(req.params.id);
    assertCanManage(req.user, incident);

    await prisma.$transaction(async (tx) => {
      await applyIncidentTransition(tx, {
        incident,
        action: 'MARK_DUPLICATE',
        actor,
        description: 'DDMA officer marked the incident as a suspected duplicate. Human review remains required.',
        eventType: 'DUPLICATE_SUSPECTED',
        metadata: {
          note: parsed.data.note,
          duplicateOfReference: parsed.data.duplicateOfReference || null,
        },
        data: {
          duplicateSuspected: true,
          duplicateOfReference: parsed.data.duplicateOfReference || null,
        },
      });
      if (incident.reportId) {
        await tx.emergencyReport.update({
          where: { id: incident.reportId },
          data: { verificationStatus: 'DUPLICATE_SUSPECTED' },
        });
      }
    });

    const updated = await findIncident(incident.id);
    res.json({ message: 'Incident marked as a suspected duplicate.', incident: updated });
  } catch (error) {
    sendError(res, error, 'Failed to mark incident duplicate.');
  }
}

const assignSchema = z.object({
  responderId: z.string().min(1).max(120),
  notes: z.string().trim().max(1000).optional(),
});

export async function assignIncident(req: AuthRequest, res: Response): Promise<void> {
  const parsed = assignSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'responderId is required and notes must be under 1000 characters.' });
    return;
  }
  try {
    const actor = actorFrom(req);
    const incident = await requireIncident(req.params.id);
    assertCanManage(req.user, incident);

    const responder = await prisma.user.findUnique({ where: { id: parsed.data.responderId } });
    if (!responder) throw new LifecycleError('Selected responder was not found.', 404);
    assertResponderInJurisdiction(req.user, responder, incident);

    await prisma.$transaction(async (tx) => {
      await applyIncidentTransition(tx, {
        incident,
        action: 'ASSIGN',
        actor,
        description: `DDMA officer assigned the incident to ${responder.name}.`,
        eventType: 'RESPONDER_ASSIGNED',
        metadata: {
          responderId: responder.id,
          responderName: responder.name,
          notes: parsed.data.notes || null,
        },
        data: {
          assignedToId: responder.id,
          assignedById: actor.id,
          assignedAt: new Date(),
          assignmentNotes: parsed.data.notes || null,
        },
      });
      if (incident.reportId) {
        await tx.emergencyReport.update({
          where: { id: incident.reportId },
          data: { status: 'DISPATCHED' },
        });
      }
    });

    const updated = await findIncident(incident.id);
    res.json({
      message: `Incident assigned to ${responder.name}. The responder must still accept it.`,
      incident: updated,
      responder: { id: responder.id, name: responder.name, district: responder.district },
    });
  } catch (error) {
    sendError(res, error, 'Failed to assign incident.');
  }
}

const responderActionSchema = z.object({
  action: z.enum(['ACCEPT', 'EN_ROUTE', 'START']),
  note: z.string().trim().max(1000).optional(),
});

export async function responderAction(req: AuthRequest, res: Response): Promise<void> {
  const parsed = responderActionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Action must be ACCEPT, EN_ROUTE, or START.' });
    return;
  }
  try {
    const actor = actorFrom(req);
    const incident = await requireIncident(req.params.id);
    assertCanRespond(req.user, incident);
    const action = parsed.data.action as LifecycleAction;
    const labels: Record<string, string> = {
      ACCEPT: 'Responder accepted the assignment.',
      EN_ROUTE: 'Responder marked en route.',
      START: 'Responder started work on site.',
    };

    await prisma.$transaction(async (tx) => {
      await applyIncidentTransition(tx, {
        incident,
        action,
        actor,
        description: labels[action],
        eventType:
          action === 'ACCEPT'
            ? 'RESPONDER_ACCEPTED'
            : action === 'EN_ROUTE'
              ? 'RESPONDER_EN_ROUTE'
              : 'WORK_STARTED',
        metadata: { note: parsed.data.note || null },
      });
    });

    const updated = await findIncident(incident.id);
    res.json({ message: labels[action], incident: updated });
  } catch (error) {
    sendError(res, error, 'Failed to update responder state.');
  }
}

const checkInSchema = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    accuracyM: z.coerce.number().min(0).max(100000).nullable().optional(),
    source: z.enum(['GPS', 'MANUAL']).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    const hasLat = value.latitude !== null && typeof value.latitude !== 'undefined';
    const hasLng = value.longitude !== null && typeof value.longitude !== 'undefined';
    if (hasLat !== hasLng) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'Latitude and longitude must be supplied together.' });
    }
    const source = value.source || (hasLat ? 'GPS' : 'MANUAL');
    if (source === 'GPS' && !hasLat) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['source'], message: 'GPS check-in requires coordinates.' });
    }
    if (source === 'MANUAL' && (!value.note || value.note.trim().length < 5)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'A manual check-in needs a short explanation.' });
    }
  });

export async function checkInIncident(req: AuthRequest, res: Response): Promise<void> {
  const parsed = checkInSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid check-in. GPS needs valid coordinates; manual check-in needs a note.',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }
  try {
    const actor = actorFrom(req);
    const incident = await requireIncident(req.params.id);
    assertCanRespond(req.user, incident);
    const data = parsed.data;
    const source = data.source || (data.latitude != null ? 'GPS' : 'MANUAL');
    const distanceM =
      data.latitude != null &&
      data.longitude != null &&
      incident.latitude != null &&
      incident.longitude != null
        ? Math.round(
            haversineKm(incident.latitude, incident.longitude, data.latitude, data.longitude) * 1000
          )
        : null;

    let fieldReport: any = null;
    await prisma.$transaction(async (tx) => {
      await applyIncidentTransition(tx, {
        incident,
        action: 'ARRIVE',
        actor,
        description:
          source === 'GPS'
            ? 'Responder checked in on site using device GPS.'
            : 'Responder checked in on site manually with an explanation.',
        eventType: 'RESPONDER_ARRIVED',
        metadata: {
          source,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          accuracyM: data.accuracyM ?? null,
          distanceFromIncidentM: distanceM,
          note: data.note || null,
        },
      });
      fieldReport = await tx.fieldReport.create({
        data: {
          incidentId: incident.id,
          responderId: actor.id,
          responderName: req.user?.name || 'Field Responder',
          reportType: 'ARRIVAL',
          situationReport:
            data.note?.trim() ||
            (source === 'GPS'
              ? 'Responder arrived at the incident location (GPS check-in).'
              : 'Responder arrived at the incident location (manual check-in).'),
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          arrivalAccuracyM: data.accuracyM ?? null,
          distanceFromIncidentM: distanceM,
          checkInSource: source,
          notes: data.note || null,
        },
      });
    });

    const updated = await findIncident(incident.id);
    res.status(201).json({
      message: 'On-site check-in recorded. The incident is now ON_SITE.',
      incident: updated,
      fieldReport,
      distanceFromIncidentM: distanceM,
    });
  } catch (error) {
    sendError(res, error, 'Failed to record check-in.');
  }
}

const resolutionSchema = z.object({
  workCompleted: z.string().trim().min(5).max(3000),
  situationAfter: z.string().trim().min(3).max(2000),
  peopleAssisted: z.coerce.number().int().min(0).max(100000).optional(),
  remainingProblems: z.string().trim().max(2000).nullable().optional(),
  medicalRequired: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  photoUrl: z.string().max(3_000_000).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  accuracyM: z.coerce.number().min(0).max(100000).nullable().optional(),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,100}$/).optional(),
});

export async function submitResolution(req: AuthRequest, res: Response): Promise<void> {
  const parsed = resolutionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'Work completed and situation after the response are required.',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }
  try {
    if (!req.user) throw new LifecycleError('Authentication required.', 401);
    if (parsed.data.idempotencyKey) {
      const existing = await prisma.fieldReport.findUnique({
        where: { idempotencyKey: parsed.data.idempotencyKey },
      });
      if (existing) {
        res.status(200).json({
          message: 'This resolution was already received. It is still awaiting DDMA review.',
          fieldReport: existing,
          duplicate: true,
        });
        return;
      }
    }

    const actor = actorFrom(req);
    const incident = await requireIncident(req.params.id);
    assertCanRespond(req.user, incident);
    const data = parsed.data;

    let fieldReport: any = null;
    await prisma.$transaction(async (tx) => {
      await applyIncidentTransition(tx, {
        incident,
        action: 'SUBMIT_RESOLUTION',
        actor,
        description: 'Responder submitted a resolution for DDMA review. The incident is not closed yet.',
        eventType: 'RESOLUTION_SUBMITTED',
        metadata: {
          peopleAssisted: data.peopleAssisted || 0,
          remainingProblems: data.remainingProblems || null,
        },
        data: { resolutionSubmittedAt: new Date() },
      });
      fieldReport = await tx.fieldReport.create({
        data: {
          incidentId: incident.id,
          responderId: actor.id,
          responderName: req.user?.name || 'Field Responder',
          reportType: 'RESOLUTION',
          situationReport: data.workCompleted,
          situationAfter: data.situationAfter,
          remainingProblems: data.remainingProblems || null,
          peopleAssisted: data.peopleAssisted ?? 0,
          actionTaken: data.workCompleted,
          casualtiesRescued: data.peopleAssisted ?? 0,
          medicalRequired: Boolean(data.medicalRequired),
          notes: data.notes || null,
          photoUrl: data.photoUrl || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          idempotencyKey: data.idempotencyKey || null,
        },
      });
    });

    const updated = await findIncident(incident.id);
    res.status(201).json({
      message: 'Resolution submitted. It is pending DDMA review and is not yet closed.',
      incident: updated,
      fieldReport,
      incidentStatus: 'RESOLVED_PENDING_REVIEW',
    });
  } catch (error) {
    sendError(res, error, 'Failed to submit resolution.');
  }
}

const reviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REOPEN']),
  note: z.string().trim().min(5).max(1500),
});

export async function reviewResolution(req: AuthRequest, res: Response): Promise<void> {
  const parsed = reviewSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'A decision and review note of at least 5 characters are required.' });
    return;
  }
  try {
    const actor = actorFrom(req);
    const incident = await requireIncident(req.params.id);
    assertCanManage(req.user, incident);
    const { decision, note } = parsed.data;
    const action: LifecycleAction =
      decision === 'APPROVE' ? 'APPROVE_RESOLUTION' : decision === 'REJECT' ? 'REJECT_RESOLUTION' : 'REOPEN';
    const labels: Record<string, string> = {
      APPROVE: 'DDMA approved the resolution and closed the incident.',
      REJECT: 'DDMA rejected the resolution. The responder must continue work.',
      REOPEN: 'DDMA reopened the resolved incident for further action.',
    };

    await prisma.$transaction(async (tx) => {
      await applyIncidentTransition(tx, {
        incident,
        action,
        actor,
        description: labels[decision],
        eventType:
          decision === 'APPROVE'
            ? 'RESOLUTION_APPROVED'
            : decision === 'REJECT'
              ? 'RESOLUTION_REJECTED'
              : 'INCIDENT_REOPENED',
        metadata: { note },
        data:
          decision === 'APPROVE'
            ? {
                resolutionReviewedById: actor.id,
                resolutionReviewedAt: new Date(),
                resolutionDecision: 'APPROVED',
                resolutionReviewNotes: note,
                resolvedAt: new Date(),
                closedAt: new Date(),
              }
            : decision === 'REJECT'
              ? {
                  resolutionReviewedById: actor.id,
                  resolutionReviewedAt: new Date(),
                  resolutionDecision: 'REJECTED',
                  resolutionReviewNotes: note,
                  resolvedAt: null,
                  closedAt: null,
                }
              : {
                  resolutionReviewedById: actor.id,
                  resolutionReviewedAt: new Date(),
                  resolutionDecision: 'REOPENED',
                  resolutionReviewNotes: note,
                  resolvedAt: null,
                  closedAt: null,
                  assignedToId: null,
                  assignedAt: null,
                  assignmentNotes: null,
                },
      });

      if (incident.reportId) {
        await tx.emergencyReport.update({
          where: { id: incident.reportId },
          data:
            decision === 'APPROVE'
              ? { status: 'RESOLVED', verificationStatus: 'RESOLVED' }
              : decision === 'REJECT'
                ? { status: incident.assignedToId ? 'DISPATCHED' : 'PENDING' }
                : { status: 'PENDING', verificationStatus: 'OFFICER_VERIFIED' },
        });
      }
    });

    const updated = await findIncident(incident.id);
    res.json({ message: labels[decision], incident: updated });
  } catch (error) {
    sendError(res, error, 'Failed to review resolution.');
  }
}

export async function listResponders(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || !['DISTRICT_OFFICER', 'STATE_EOC'].includes(req.user.role)) {
      res.status(403).json({ error: 'Only a DDMA officer can view the responder roster.' });
      return;
    }
    const where: any = { role: 'FIELD_RESPONDER', state: req.user.state };
    if (req.user.role === 'DISTRICT_OFFICER') where.district = req.user.district;

    const responders = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        district: true,
        state: true,
        assignedIncidents: {
          where: { status: { in: ACTIVE_FIELD_STATUSES } },
          select: { id: true, referenceCode: true, title: true, status: true },
          orderBy: { assignedAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      responders: responders.map((r) => ({
        ...r,
        activeAssignments: r.assignedIncidents.length,
      })),
    });
  } catch (error) {
    sendError(res, error, 'Failed to fetch responders.');
  }
}
