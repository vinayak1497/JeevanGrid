import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  createCommunityReport,
  shapeReportForViewer,
} from '../services/community/communityIntelligenceService';

const nullableCoord = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || typeof v === 'undefined' ? null : v),
    z.coerce.number().min(min).max(max).nullable().optional()
  );

const createSchema = z
  .object({
    citizenName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20),
    locationName: z.string().trim().min(2).max(240),
    latitude: nullableCoord(-90, 90),
    longitude: nullableCoord(-180, 180),
    district: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    emergencyType: z.string().trim().min(2).max(80),
    urgency: z.string().trim().max(40).optional(),
    peopleAffected: z.coerce.number().int().min(1).max(100000).optional(),
    description: z.string().trim().min(5).max(4000),
    photoUrl: z.string().max(3_000_000).nullable().optional(),
    category: z.string().max(60).optional(),
    vulnerablePersons: z.array(z.string().max(30)).max(10).optional(),
    requiredAssistance: z.array(z.string().max(30)).max(10).optional(),
    language: z.string().max(8).optional(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,100}$/).optional(),
    aiProvider: z.string().max(60).optional(),

    reportSource: z.enum(['CITIZEN_FORM', 'AI_ASSISTANT']).optional(),
    originalDescription: z.string().trim().max(4000).optional(),
    aiSummary: z.string().trim().max(800).optional(),
    accuracyM: z.preprocess(
      (v) => (v === '' || v === null || typeof v === 'undefined' ? null : v),
      z.coerce.number().min(0).max(100000).nullable().optional()
    ),
    locationSource: z.enum(['GPS', 'MANUAL_MAP', 'MANUAL_ADDRESS', 'NONE']).nullable().optional(),
    locationCapturedAt: z.preprocess(
      (v) => (v === '' || v === null || typeof v === 'undefined' ? null : v),
      z.string().datetime({ offset: true }).nullable().optional()
    ),
    locationConfirmed: z.boolean().optional(),
    locality: z.string().trim().max(160).nullable().optional(),
    vulnerablePersonsInfo: z.string().trim().max(2000).nullable().optional(),
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
    if (hasLat && (value.latitude === null || value.longitude === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Latitude and longitude must be valid numbers.',
      });
    }
    if (value.locationSource === 'GPS' && !hasLat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locationSource'],
        message: 'GPS location source requires latitude and longitude.',
      });
    }
  });

export async function createEmergencyReport(req: AuthRequest, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'Missing or invalid report fields.',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
    return;
  }

  const data = parsed.data;
  const hasCoords = data.latitude != null && data.longitude != null;
  const reporterType: 'GUEST' | 'AUTHENTICATED_CITIZEN' = req.user ? 'AUTHENTICATED_CITIZEN' : 'GUEST';
  const locationSource: 'GPS' | 'MANUAL_MAP' | 'MANUAL_ADDRESS' | 'NONE' | null =
    data.locationSource || (hasCoords ? null : 'NONE');
  const locationConfirmed =
    typeof data.locationConfirmed === 'boolean'
      ? data.locationConfirmed
      : Boolean(hasCoords || (locationSource && locationSource !== 'NONE'));

  try {
    const result = await createCommunityReport({
      ...data,
      locationSource,
      locationConfirmed,
      locationCapturedAt: data.locationCapturedAt || null,
      reportedByUserId: req.user?.id || null,
      reporterType,
      reportSource: data.reportSource || 'CITIZEN_FORM',
      originalDescription: data.originalDescription || data.description,
      aiSummary: data.aiSummary || data.description.slice(0, 500),
      // Demo/test labeling is never accepted from an untrusted client body.
      isDemo: false,
    });

    res.status(result.duplicate ? 200 : 201).json({
      message: result.duplicate
        ? 'This queued report was already received by JeevanGrid. The original record is unchanged.'
        : 'Emergency report received and stored. A human officer has not yet verified it and no physical dispatch has occurred.',
      reportId: result.report.id,
      report: result.report,
      incidentId: result.incidentId,
      incidentReference: result.incidentReference,
      incidentStatus: result.incidentStatus,
      duplicate: result.duplicate,
      duplicateCandidates: result.duplicateCandidates,
      verificationStatus: result.report.verificationStatus,
      createdAt: result.report.createdAt,
      created: result.created,
      note: 'Submission is not verification and does not mean a team has been dispatched. Keep your phone reachable; call 112 if there is immediate danger.',
    });
  } catch (error) {
    console.error('Create emergency report error:', error);
    res.status(500).json({ error: 'Internal server error submitting emergency report.' });
  }
}

function reportScopeWhere(user: AuthRequest['user']): Record<string, unknown> {
  if (!user) return { id: '__none__' };
  if (user.role === 'STATE_EOC') return { state: user.state };
  if (user.role === 'DISTRICT_OFFICER') return { district: user.district, state: user.state };
  if (user.role === 'FIELD_RESPONDER') return { incident: { assignedToId: user.id } };
  return { reportedByUserId: user.id };
}

export async function listEmergencyReports(req: AuthRequest, res: Response): Promise<void> {
  try {
    const role = req.user?.role || 'CITIZEN';
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const reports = await prisma.emergencyReport.findMany({
      where: reportScopeWhere(req.user) as any,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        incident: {
          include: {
            assignedTo: { select: { id: true, name: true, phone: true, role: true } },
          },
        },
        verificationAudits: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });
    res.json({
      reports: reports.map((r) => shapeReportForViewer(r, role, true, req.user?.id)),
    });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({ error: 'Failed to fetch emergency reports.' });
  }
}

export async function getEmergencyReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required to retrieve a report.' });
      return;
    }
    const { id } = req.params;
    const report = await prisma.emergencyReport.findUnique({
      where: { id },
      include: {
        incident: {
          include: {
            assignedTo: true,
            fieldReports: { orderBy: { submittedAt: 'desc' } },
            events: { orderBy: { createdAt: 'asc' } },
          },
        },
        verificationAudits: { orderBy: { createdAt: 'desc' } },
        corroborations: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    const user = req.user;
    const officer =
      (user.role === 'DISTRICT_OFFICER' &&
        report.district === user.district &&
        report.state === user.state) ||
      (user.role === 'STATE_EOC' && report.state === user.state);
    const assignedResponder =
      user.role === 'FIELD_RESPONDER' && report.incident?.assignedToId === user.id;
    const owner = report.reportedByUserId === user.id;
    if (!officer && !assignedResponder && !owner) {
      res.status(403).json({ error: 'This report is outside your authorised scope.' });
      return;
    }

    res.json({
      report: shapeReportForViewer(report, user.role, true, user.id),
      corroborations: report.corroborations.length,
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to retrieve report.' });
  }
}
