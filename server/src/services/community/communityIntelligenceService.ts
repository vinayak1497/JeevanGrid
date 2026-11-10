import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { generateEmergencyReportId, generateIncidentReference } from '../../utils/idGenerator';
import { haversineKm } from '../../utils/geo';
import { heuristicEmergencyExtraction } from '../ai/structuredExtractionService';
import { geoService } from '../geoService';
import { INCIDENT_STATUS } from '../incidents/incidentLifecycleService';

/**
 * Feature 2 — community ground truth.
 *
 * Deterministic checks (proximity + time + same category) flag possible
 * duplicates. Human corroboration can raise confidence to CORROBORATED; only
 * an authorised officer can set OFFICER_VERIFIED. AI never verifies.
 */

export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'DUPLICATE_SUSPECTED',
  'CORROBORATED',
  'OFFICER_VERIFIED',
  'REJECTED',
  'RESOLVED',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type OfficerAction = 'VERIFY' | 'REJECT' | 'RESOLVE';

const CATEGORY_MAP: Record<string, string> = {
  FLOODING: 'FLOODING',
  FLOOD: 'FLOODING',
  FIRE: 'FIRE',
  EARTHQUAKE: 'EARTHQUAKE',
  LANDSLIDE: 'LANDSLIDE',
  MEDICAL: 'MEDICAL',
  STRANDED: 'STRANDED',
  TRAPPED: 'STRANDED',
  ROAD_BLOCKED: 'ROAD_BLOCKED',
  BRIDGE_DAMAGED: 'BRIDGE_DAMAGED',
  TREE_FALLEN: 'TREE_FALLEN',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  'INFRASTRUCTURE DAMAGE': 'INFRASTRUCTURE',
  RESOURCE_SHORTAGE: 'RESOURCE_SHORTAGE',
  OTHER: 'OTHER',
};

export function categoryFromEmergency(emergencyType: string, description = ''): string {
  const direct = CATEGORY_MAP[String(emergencyType || '').trim().toUpperCase()];
  if (direct) return direct;
  return heuristicEmergencyExtraction(`${emergencyType} ${description}`).incidentType;
}

export interface DuplicateCandidate {
  id: string;
  distanceKm: number;
  minutesApart: number;
  emergencyType: string;
  verificationStatus: string;
  createdAt: string;
}

export interface DuplicateInput {
  id?: string;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  createdAt: Date;
  verificationStatus?: string;
}

export function findPotentialDuplicates(
  target: DuplicateInput,
  candidates: DuplicateInput[],
  opts: { radiusKm?: number; windowHours?: number } = {}
): DuplicateCandidate[] {
  const radiusKm = opts.radiusKm ?? 0.5;
  const windowHours = opts.windowHours ?? 3;
  if (target.latitude === null || target.longitude === null) return [];
  const out: DuplicateCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.id && candidate.id === target.id) continue;
    if (!candidate.category || !target.category || candidate.category !== target.category) continue;
    if (candidate.verificationStatus === 'REJECTED') continue;
    if (candidate.latitude === null || candidate.longitude === null) continue;
    const minutesApart = Math.abs(target.createdAt.getTime() - candidate.createdAt.getTime()) / 60000;
    if (minutesApart > windowHours * 60) continue;
    const distanceKm = haversineKm(target.latitude, target.longitude, candidate.latitude, candidate.longitude);
    if (distanceKm > radiusKm) continue;
    out.push({
      id: candidate.id || '',
      distanceKm: Math.round(distanceKm * 1000) / 1000,
      minutesApart: Math.round(minutesApart),
      emergencyType: candidate.category,
      verificationStatus: candidate.verificationStatus || 'UNVERIFIED',
      createdAt: candidate.createdAt.toISOString(),
    });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

export function canOfficerSetStatus(actorRole: string, _action: OfficerAction): boolean {
  // Community verification and closure are human DDMA-only actions. Field
  // responders can submit operational evidence, but never officially verify or
  // close a citizen report.
  return ['DISTRICT_OFFICER', 'STATE_EOC'].includes(actorRole);
}

export function nextStatusForAction(action: OfficerAction): VerificationStatus {
  if (action === 'VERIFY') return 'OFFICER_VERIFIED';
  if (action === 'REJECT') return 'REJECTED';
  return 'RESOLVED';
}

export function statusAllowsAction(current: string, action: OfficerAction): boolean {
  if (action === 'REJECT') return !['REJECTED', 'RESOLVED'].includes(current);
  if (action === 'RESOLVE') return ['OFFICER_VERIFIED', 'CORROBORATED', 'DUPLICATE_SUSPECTED'].includes(current);
  return !['OFFICER_VERIFIED', 'REJECTED', 'RESOLVED'].includes(current);
}

export interface CreateReportInput {
  citizenName: string;
  phone: string;
  locationName: string;
  latitude?: number | null;
  longitude?: number | null;
  district?: string;
  state?: string;
  emergencyType: string;
  urgency?: string;
  peopleAffected?: number;
  description: string;
  photoUrl?: string | null;
  category?: string;
  vulnerablePersons?: string[];
  requiredAssistance?: string[];
  language?: string;
  idempotencyKey?: string;
  aiProvider?: string;

  // Identity/provenance and location confirmation. The controller derives the
  // reporter identity from optional authentication, never from client claims.
  reportedByUserId?: string | null;
  reporterType?: 'GUEST' | 'AUTHENTICATED_CITIZEN';
  reportSource?: 'CITIZEN_FORM' | 'AI_ASSISTANT';
  originalDescription?: string;
  aiSummary?: string;
  accuracyM?: number | null;
  locationSource?: 'GPS' | 'MANUAL_MAP' | 'MANUAL_ADDRESS' | 'NONE' | null;
  locationCapturedAt?: Date | string | null;
  locationConfirmed?: boolean;
  locality?: string | null;
  vulnerablePersonsInfo?: string | null;
  isDemo?: boolean;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).slice(0, 20) : [];
  } catch {
    return [];
  }
}

function maskName(name: string): string {
  const parts = String(name || '').trim().split(/\s+/);
  return parts
    .map((p, idx) => (idx === 0 ? p : `${p.charAt(0)}***`))
    .join(' ');
}

export function shapeReportForViewer(
  report: any,
  viewerRole: string,
  includeAudit = false,
  viewerId?: string
): any {
  const officer = ['DISTRICT_OFFICER', 'STATE_EOC'].includes(viewerRole);
  const assignedResponder = Boolean(
    viewerId && viewerRole === 'FIELD_RESPONDER' && report.incident?.assignedToId === viewerId
  );
  const owner = Boolean(viewerId && report.reportedByUserId === viewerId);
  const canViewIdentity = officer || assignedResponder || owner;
  const canViewExactLocation = canViewIdentity;

  return {
    id: report.id,
    citizenName: canViewIdentity ? report.citizenName : maskName(report.citizenName),
    phone: canViewIdentity ? report.phone : undefined,
    locationName: report.locationName,
    // Exact coordinates are operational data. Volunteers and non-assigned
    // responders receive the locality/category, not a precise home location.
    latitude: canViewExactLocation ? report.latitude : null,
    longitude: canViewExactLocation ? report.longitude : null,
    accuracyM: canViewExactLocation ? report.accuracyM ?? null : null,
    locationSource: canViewExactLocation ? report.locationSource ?? null : null,
    locationCapturedAt: canViewExactLocation ? report.locationCapturedAt ?? null : null,
    locationConfirmed: Boolean(report.locationConfirmed),
    district: report.district,
    state: report.state,
    locality: report.locality || null,
    emergencyType: report.emergencyType,
    category: report.category || categoryFromEmergency(report.emergencyType, report.description),
    urgency: report.urgency,
    peopleAffected: report.peopleAffected,
    description: report.description,
    originalDescription: report.originalDescription || null,
    aiSummary: report.aiSummary || null,
    vulnerablePersonsInfo: canViewIdentity ? report.vulnerablePersonsInfo || null : null,
    photoUrl: report.photoUrl,
    status: report.status,
    verificationStatus: report.verificationStatus,
    reporterType: report.reporterType || 'GUEST',
    reportSource: report.reportSource || 'CITIZEN_FORM',
    isDemo: Boolean(report.isDemo),
    corroborationCount: report.corroborationCount,
    vulnerablePersons: parseJsonArray(report.vulnerablePersons),
    requiredAssistance: parseJsonArray(report.requiredAssistance),
    language: report.language,
    aiClassification: report.aiClassification ? safeParse(report.aiClassification) : null,
    createdAt: report.createdAt,
    incident: report.incident
      ? {
          id: report.incident.id,
          referenceCode: report.incident.referenceCode || null,
          status: report.incident.status,
          assignedToId: report.incident.assignedToId || null,
          assignedTo: report.incident.assignedTo?.name || null,
          assignmentNotes: canViewIdentity ? report.incident.assignmentNotes || null : null,
          resolutionDecision: canViewIdentity ? report.incident.resolutionDecision || null : null,
          resolutionReviewNotes: canViewIdentity ? report.incident.resolutionReviewNotes || null : null,
          resolvedAt: report.incident.resolvedAt || null,
        }
      : null,
    audits: includeAudit
      ? (report.verificationAudits || []).map((a: any) => ({
          id: a.id,
          action: a.action,
          fromStatus: a.fromStatus,
          toStatus: a.toStatus,
          actorRole: a.actorRole,
          note: a.note,
          metadata: a.metadata ? safeParse(a.metadata) : null,
          createdAt: a.createdAt,
        }))
      : undefined,
    privacy: canViewIdentity
      ? 'Authorised operational record. Do not redistribute phone numbers or precise coordinates.'
      : 'Contact details and precise coordinates are withheld from this view.',
  };
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeAuditWith(
  tx: Prisma.TransactionClient,
  data: {
    reportId: string;
    action: string;
    fromStatus?: string | null;
    toStatus: string;
    actorId?: string | null;
    actorRole?: string | null;
    note?: string | null;
    metadata?: any;
  }
): Promise<void> {
  await tx.reportVerificationAudit.create({
    data: {
      reportId: data.reportId,
      action: data.action,
      fromStatus: data.fromStatus || null,
      toStatus: data.toStatus,
      actorId: data.actorId || null,
      actorRole: data.actorRole || null,
      note: data.note || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    },
  } as any);
}

async function writeAudit(data: {
  reportId: string;
  action: string;
  fromStatus?: string | null;
  toStatus: string;
  actorId?: string | null;
  actorRole?: string | null;
  note?: string | null;
  metadata?: any;
}): Promise<void> {
  await writeAuditWith(prisma, data);
}

function parseCapturedAt(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export async function createCommunityReport(input: CreateReportInput): Promise<{
  report: any;
  incidentId: string | null;
  incidentReference: string | null;
  incidentStatus: string | null;
  duplicate: boolean;
  duplicateCandidates: DuplicateCandidate[];
  created: boolean;
}> {
  if (input.idempotencyKey) {
    const existing = await prisma.emergencyReport.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { incident: true },
    });
    if (existing) {
      return {
        report: existing,
        incidentId: existing.incident?.id || null,
        incidentReference: existing.incident?.referenceCode || null,
        incidentStatus: existing.incident?.status || null,
        duplicate: true,
        duplicateCandidates: [],
        created: false,
      };
    }
  }

  let district = input.district || '';
  let state = input.state || '';
  if (!district || !state) {
    try {
      const resolved = await geoService.resolveLocationLive(input.locationName);
      district = district || resolved.district;
      state = state || resolved.state;
    } catch {
      // Do not fabricate a district; leave it unknown when geocoding is down.
    }
  }
  district = district || 'Unknown';
  state = state || 'Unknown';

  const extraction = heuristicEmergencyExtraction(`${input.description} ${input.emergencyType}`, input.language);
  const category =
    input.category && Object.values(CATEGORY_MAP).includes(input.category)
      ? input.category
      : categoryFromEmergency(input.emergencyType, input.description);
  const vulnerable = Array.isArray(input.vulnerablePersons)
    ? input.vulnerablePersons.slice(0, 10).map(String)
    : extraction.vulnerablePersons;
  const assistance = Array.isArray(input.requiredAssistance)
    ? input.requiredAssistance.slice(0, 10).map(String)
    : extraction.requiredAssistance;
  const originalDescription = (input.originalDescription || input.description).slice(0, 4000);
  const aiSummary = (input.aiSummary || input.description).slice(0, 500);
  const reporterType = input.reporterType === 'AUTHENTICATED_CITIZEN' ? 'AUTHENTICATED_CITIZEN' : 'GUEST';
  const reportSource = input.reportSource === 'AI_ASSISTANT' ? 'AI_ASSISTANT' : 'CITIZEN_FORM';
  const locationCapturedAt = parseCapturedAt(input.locationCapturedAt);
  const locationSource = input.locationSource || (input.latitude != null && input.longitude != null ? 'GPS' : 'NONE');
  const isDemo = Boolean(input.isDemo);

  const recent = await prisma.emergencyReport.findMany({
    where: {
      district,
      createdAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      verificationStatus: { not: 'REJECTED' },
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      category: true,
      createdAt: true,
      verificationStatus: true,
      emergencyType: true,
    },
    take: 100,
  });

  const target = {
    id: undefined,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    category,
    createdAt: new Date(),
  };
  const duplicateCandidates = findPotentialDuplicates(target, recent);
  const verificationStatus: VerificationStatus = duplicateCandidates.length
    ? 'DUPLICATE_SUSPECTED'
    : 'UNVERIFIED';
  const incidentStatus =
    verificationStatus === 'DUPLICATE_SUSPECTED'
      ? INCIDENT_STATUS.DUPLICATE_SUSPECTED
      : INCIDENT_STATUS.NEW;

  // Retry only on a generated-ID collision. The report and incident are always
  // committed together; a duplicate idempotency key returns the original.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reportId = generateEmergencyReportId();
    const referenceCode = generateIncidentReference();
    try {
      const created = await prisma.$transaction(async (tx) => {
        const report = await tx.emergencyReport.create({
          data: {
            id: reportId,
            citizenName: input.citizenName,
            phone: input.phone,
            locationName: input.locationName,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            district,
            state,
            emergencyType: input.emergencyType,
            urgency: input.urgency || 'Moderate',
            peopleAffected: input.peopleAffected || 1,
            description: input.description,
            photoUrl: input.photoUrl || null,
            status: 'PENDING',
            category,
            verificationStatus,
            vulnerablePersons: JSON.stringify(vulnerable),
            requiredAssistance: JSON.stringify(assistance),
            language: input.language || extraction.language,
            aiClassification: JSON.stringify({
              provider: 'local_heuristic',
              aiProvider: input.aiProvider || null,
              category,
              urgency: input.urgency || extraction.urgency,
              confidence: extraction.confidence,
              summary: aiSummary,
              note: 'AI classification is advisory. It does not verify the incident or dispatch help.',
            }),
            idempotencyKey: input.idempotencyKey || null,
            reportedByUserId: input.reportedByUserId || null,
            reporterType,
            reportSource,
            originalDescription,
            aiSummary,
            accuracyM: input.accuracyM ?? null,
            locationSource,
            locationCapturedAt,
            locationConfirmed: Boolean(input.locationConfirmed),
            locality: input.locality || null,
            vulnerablePersonsInfo: input.vulnerablePersonsInfo || null,
            isDemo,
          },
        });

        const incident = await tx.incident.create({
          data: {
            referenceCode,
            reportId: report.id,
            title: `${input.emergencyType}: ${input.locationName}`,
            description: input.description,
            emergencyType: input.emergencyType,
            urgency: input.urgency || 'Moderate',
            status: incidentStatus,
            district,
            state,
            locationName: input.locationName,
            latitude: input.latitude ?? null,
            longitude: input.longitude ?? null,
            accuracyM: input.accuracyM ?? null,
            locationSource,
            locationCapturedAt,
            locationConfirmed: Boolean(input.locationConfirmed),
            reportSource,
            reporterType,
            isDemo,
            duplicateSuspected: duplicateCandidates.length > 0,
          },
        });

        await writeAuditWith(tx, {
          reportId: report.id,
          action: duplicateCandidates.length ? 'DUPLICATE_SUSPECTED' : 'CLASSIFIED',
          fromStatus: null,
          toStatus: verificationStatus,
          actorRole: 'SYSTEM',
          note: duplicateCandidates.length
            ? `${duplicateCandidates.length} similar report(s) within 500 m and 3 hours. A human must review the duplication.`
            : 'Deterministic classification completed. Awaiting DDMA officer verification.',
          metadata: { category, duplicateCandidates, aiProvider: input.aiProvider || 'local_heuristic' },
        });

        await tx.incidentEvent.create({
          data: {
            incidentId: incident.id,
            actorUserId: input.reportedByUserId || null,
            actorRole: reporterType === 'AUTHENTICATED_CITIZEN' ? 'CITIZEN' : 'GUEST',
            eventType: 'REPORT_SUBMITTED',
            previousStatus: null,
            newStatus: incidentStatus,
            description:
              'Citizen emergency report received. No officer verification, assignment, or physical dispatch has occurred.',
            metadata: JSON.stringify({
              reportId: report.id,
              referenceCode,
              reportSource,
              reporterType,
              locationSource,
              accuracyM: input.accuracyM ?? null,
              duplicateCandidates: duplicateCandidates.map((d) => d.id),
              aiAdvisoryOnly: true,
            }),
          },
        });

        if (duplicateCandidates.length) {
          await tx.incidentEvent.create({
            data: {
              incidentId: incident.id,
              actorRole: 'SYSTEM',
              eventType: 'DUPLICATE_SUSPECTED',
              previousStatus: incidentStatus,
              newStatus: incidentStatus,
              description: `${duplicateCandidates.length} similar report(s) within 500 m and 3 hours. Human review is required.`,
              metadata: JSON.stringify({ duplicateCandidates }),
            },
          });
        }

        return { report, incident };
      });

      return {
        report: created.report,
        incidentId: created.incident.id,
        incidentReference: created.incident.referenceCode,
        incidentStatus: created.incident.status,
        duplicate: false,
        duplicateCandidates,
        created: true,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target)
          ? (error.meta?.target as string[])
          : [String(error.meta?.target || '')];
        if (input.idempotencyKey && target.includes('idempotencyKey')) {
          const existing = await prisma.emergencyReport.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: { incident: true },
          });
          if (existing) {
            return {
              report: existing,
              incidentId: existing.incident?.id || null,
              incidentReference: existing.incident?.referenceCode || null,
              incidentStatus: existing.incident?.status || null,
              duplicate: true,
              duplicateCandidates: [],
              created: false,
            };
          }
        }
        if (target.includes('referenceCode') || target.includes('id')) {
          continue;
        }
      }
      throw error;
    }
  }

  throw new Error('Could not allocate a unique incident reference. Please retry.');
}

export async function corroborateReport(
  reportId: string,
  actor: { id: string; role: string; name?: string },
  note?: string
): Promise<{ report: any; alreadyCorroborated: boolean }> {
  const report = await prisma.emergencyReport.findUnique({ where: { id: reportId } });
  if (!report) throw Object.assign(new Error('Report not found.'), { statusCode: 404 });
  if (['OFFICER_VERIFIED', 'REJECTED', 'RESOLVED'].includes(report.verificationStatus)) {
    throw Object.assign(new Error(`Cannot corroborate a report in ${report.verificationStatus} state.`), { statusCode: 409 });
  }

  const existing = await prisma.reportCorroboration.findUnique({
    where: { reportId_userId: { reportId, userId: actor.id } },
  });
  if (existing) return { report, alreadyCorroborated: true };

  await prisma.reportCorroboration.create({
    data: {
      reportId,
      userId: actor.id,
      userRole: actor.role,
      note: note?.slice(0, 300) || null,
    },
  });
  const count = await prisma.reportCorroboration.count({ where: { reportId } });
  const fromStatus = report.verificationStatus;
  const toStatus: VerificationStatus =
    fromStatus === 'OFFICER_VERIFIED'
      ? 'OFFICER_VERIFIED'
      : count >= 2
        ? 'CORROBORATED'
        : (fromStatus as VerificationStatus);
  const updated = await prisma.emergencyReport.update({
    where: { id: reportId },
    data: { corroborationCount: count, verificationStatus: toStatus },
  });
  await writeAudit({
    reportId,
    action: 'CORROBORATED',
    fromStatus,
    toStatus,
    actorId: actor.id,
    actorRole: actor.role,
    note: note?.slice(0, 300) || 'Community corroboration recorded.',
    metadata: { corroborationCount: count, threshold: 2 },
  });
  return { report: updated, alreadyCorroborated: false };
}

export async function applyOfficerDecision(
  reportId: string,
  action: OfficerAction,
  actor: { id: string; role: string; name?: string; district?: string; state?: string },
  note?: string
): Promise<any> {
  if (!canOfficerSetStatus(actor.role, action)) {
    throw Object.assign(new Error('Your role cannot perform this verification action.'), { statusCode: 403 });
  }
  const report = await prisma.emergencyReport.findUnique({ where: { id: reportId } });
  if (!report) throw Object.assign(new Error('Report not found.'), { statusCode: 404 });
  if (actor.role === 'DISTRICT_OFFICER' && report.district !== actor.district) {
    throw Object.assign(new Error('This report is outside your district.'), { statusCode: 403 });
  }
  if (actor.role === 'STATE_EOC' && report.state !== actor.state) {
    throw Object.assign(new Error('This report is outside your state.'), { statusCode: 403 });
  }
  if (!statusAllowsAction(report.verificationStatus, action)) {
    throw Object.assign(
      new Error(`Cannot ${action.toLowerCase()} a report in ${report.verificationStatus} state.`),
      { statusCode: 409 }
    );
  }
  if (!note || note.trim().length < 5) {
    throw Object.assign(new Error('A verification note is required for the audit trail.'), { statusCode: 400 });
  }

  const toStatus = nextStatusForAction(action);
  const updated = await prisma.emergencyReport.update({
    where: { id: reportId },
    data: {
      verificationStatus: toStatus,
      status: action === 'RESOLVE' ? 'RESOLVED' : report.status,
    },
  });
  await writeAudit({
    reportId,
    action: toStatus,
    fromStatus: report.verificationStatus,
    toStatus,
    actorId: actor.id,
    actorRole: actor.role,
    note: note.trim().slice(0, 500),
    metadata: { humanAuthorityDecision: true },
  });
  return updated;
}

export async function getSimilarReports(reportId: string): Promise<DuplicateCandidate[]> {
  const target = await prisma.emergencyReport.findUnique({ where: { id: reportId } });
  if (!target) throw Object.assign(new Error('Report not found.'), { statusCode: 404 });
  const candidates = await prisma.emergencyReport.findMany({
    where: {
      district: target.district,
      createdAt: {
        gte: new Date(target.createdAt.getTime() - 3 * 60 * 60 * 1000),
        lte: new Date(target.createdAt.getTime() + 3 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      category: true,
      createdAt: true,
      verificationStatus: true,
      emergencyType: true,
    },
    take: 200,
  });
  return findPotentialDuplicates(
    {
      id: target.id,
      latitude: target.latitude,
      longitude: target.longitude,
      category: target.category,
      createdAt: target.createdAt,
    },
    candidates
  );
}

export async function getCommunityIntelligence(district?: string, days = 7): Promise<any> {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since }, ...(district ? { district } : {}) };
  const reports = await prisma.emergencyReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      incident: {
        include: { assignedTo: { select: { id: true, name: true } } },
      },
      verificationAudits: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  const counts: Record<string, number> = {
    UNVERIFIED: 0,
    DUPLICATE_SUSPECTED: 0,
    CORROBORATED: 0,
    OFFICER_VERIFIED: 0,
    REJECTED: 0,
    RESOLVED: 0,
  };
  const byCategory: Record<string, number> = {};
  const byHour = new Map<string, number>();
  for (const r of reports) {
    counts[r.verificationStatus] = (counts[r.verificationStatus] || 0) + 1;
    const cat = r.category || categoryFromEmergency(r.emergencyType, r.description);
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    const hour = r.createdAt.toISOString().slice(0, 13) + ':00Z';
    byHour.set(hour, (byHour.get(hour) || 0) + 1);
  }

  const duplicateGroups: Array<{ reportId: string; candidates: DuplicateCandidate[] }> = [];
  const unverified = reports.filter((r) => r.verificationStatus === 'UNVERIFIED').slice(0, 20);
  for (const r of unverified) {
    const candidates = findPotentialDuplicates(
      { id: r.id, latitude: r.latitude, longitude: r.longitude, category: r.category, createdAt: r.createdAt },
      reports
    );
    if (candidates.length) duplicateGroups.push({ reportId: r.id, candidates });
  }

  return {
    district: district || 'All districts',
    windowDays: days,
    counts,
    totalReports: reports.length,
    awaitingHumanVerification: counts.UNVERIFIED + counts.CORROBORATED + counts.DUPLICATE_SUSPECTED,
    verifiedByOfficer: counts.OFFICER_VERIFIED,
    byCategory,
    timeline: Array.from(byHour.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, count })),
    possibleDuplicateGroups: duplicateGroups.slice(0, 10),
    recentReports: reports.slice(0, 40).map((r) => shapeReportForViewer(r, 'DISTRICT_OFFICER', true)),
    privacyNote:
      'Aggregates only. Individual phone numbers are officer-only and must not be published or redistributed.',
    generatedAt: new Date().toISOString(),
  };
}
