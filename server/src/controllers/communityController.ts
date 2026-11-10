import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../utils/prisma';
import {
  applyOfficerDecision,
  corroborateReport,
  getCommunityIntelligence,
  getSimilarReports,
  shapeReportForViewer,
} from '../services/community/communityIntelligenceService';

const decisionSchema = z.object({
  action: z.enum(['VERIFY', 'REJECT', 'RESOLVE']),
  note: z.string().trim().min(5).max(500),
});

export async function listCommunityReports(req: AuthRequest, res: Response): Promise<void> {
  try {
    const role = req.user?.role || 'CITIZEN';
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const district = typeof req.query.district === 'string' ? req.query.district : req.user?.district;
    const reports = await prisma.emergencyReport.findMany({
      where: {
        ...(status ? { verificationStatus: status } : {}),
        ...(category ? { category } : {}),
        ...(district && role !== 'STATE_EOC' ? { district } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        incident: {
          include: { assignedTo: { select: { id: true, name: true } } },
        },
        verificationAudits: { orderBy: { createdAt: 'desc' }, take: 2 },
      },
    });
    res.json({
      reports: reports.map((r) => shapeReportForViewer(r, role, false, req.user?.id)),
      privacyNote:
        role === 'DISTRICT_OFFICER' || role === 'STATE_EOC'
          ? 'Officer-only view. Phone numbers must not be published.'
          : 'Contact details are withheld; location and category are shown for field corroboration.',
    });
  } catch (error) {
    console.error('List community reports error:', error);
    res.status(500).json({ error: 'Failed to list community reports.' });
  }
}

export async function getCommunitySummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district = typeof req.query.district === 'string' ? req.query.district : req.user?.district;
    const days = parseInt(String(req.query.days || '7'), 10) || 7;
    const summary = await getCommunityIntelligence(district, days);
    res.json(summary);
  } catch (error) {
    console.error('Community summary error:', error);
    res.status(500).json({ error: 'Failed to build community intelligence summary.' });
  }
}

export async function corroborateCommunityReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in to corroborate a report.' });
      return;
    }
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : undefined;
    const result = await corroborateReport(req.params.id, req.user, note);
    res.status(result.alreadyCorroborated ? 200 : 201).json({
      message: result.alreadyCorroborated
        ? 'You already corroborated this report.'
        : 'Corroboration recorded. An officer still decides official verification.',
      status: result.report.verificationStatus,
      corroborationCount: result.report.corroborationCount,
    });
  } catch (error) {
    const statusCode = (error as any).statusCode || 500;
    res.status(statusCode).json({ error: (error as Error).message });
  }
}

export async function decideCommunityReport(req: AuthRequest, res: Response): Promise<void> {
  const parsed = decisionSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Action and an audit note (5+ characters) are required.' });
    return;
  }
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const report = await applyOfficerDecision(req.params.id, parsed.data.action, req.user, parsed.data.note);
    res.json({
      message:
        parsed.data.action === 'VERIFY'
          ? 'Report verified by an authorised officer.'
          : parsed.data.action === 'REJECT'
            ? 'Report rejected. The reason was recorded in the audit trail.'
            : 'Report marked resolved.',
      report: shapeReportForViewer(report, req.user.role, true),
    });
  } catch (error) {
    const statusCode = (error as any).statusCode || 500;
    res.status(statusCode).json({ error: (error as Error).message });
  }
}

export async function getSimilar(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const report = await prisma.emergencyReport.findUnique({
      where: { id: req.params.id },
      select: { district: true, state: true },
    });
    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    if (
      (req.user.role === 'DISTRICT_OFFICER' &&
        (report.district !== req.user.district || report.state !== req.user.state)) ||
      (req.user.role === 'STATE_EOC' && report.state !== req.user.state) ||
      (['FIELD_RESPONDER', 'COMMUNITY_VOLUNTEER', 'HEALTH_OFFICER'].includes(req.user.role) &&
        report.district !== req.user.district)
    ) {
      res.status(403).json({ error: 'This report is outside your authorised scope.' });
      return;
    }
    const similar = await getSimilarReports(req.params.id);
    res.json({ similar, radiusKm: 0.5, windowHours: 3 });
  } catch (error) {
    res.status((error as any).statusCode || 500).json({ error: (error as Error).message });
  }
}
