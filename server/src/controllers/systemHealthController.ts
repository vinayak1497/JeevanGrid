import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { alertConfig } from '../services/alerts/alertConfig';
import { getSourceStates } from '../services/alerts/alertSourceRegistry';

/**
 * GET /api/alerts/system/health — protected operations view of the warning
 * pipeline (EOC debugging + hackathon demonstration). STATE_EOC /
 * DISTRICT_OFFICER only. Never expose secrets.
 */
export async function getAlertSystemHealth(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const sources = await getSourceStates().catch(() => []);
    const [activeOfficial, subs, pushSubs, recentAudit] = await Promise.all([
      prisma.disasterAlert.count({
        where: {
          sourceType: 'OFFICIAL',
          isVerified: true,
          isDemoData: false,
          status: { in: ['ACTIVE', 'UPDATED'] },
        },
      }).catch(() => null),
      prisma.alertSubscription.count().catch(() => null),
      prisma.pushSubscription.count().catch(() => null),
      prisma.alertAuditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 20 }).catch(() => []),
    ]);
    const successTimes = sources
      .map((s) => (s.lastSuccessAt ? new Date(s.lastSuccessAt).getTime() : NaN))
      .filter((t) => Number.isFinite(t));
    res.json({
      generatedAt: now.toISOString(),
      pollMinutes: alertConfig.sachetPollMinutes,
      demoMode: alertConfig.enableDemoAlerts,
      pushConfigured: !!(alertConfig.vapidPublicKey && alertConfig.vapidPrivateKey),
      lastSuccessfulSync: successTimes.length
        ? new Date(Math.max(...successTimes)).toISOString()
        : null,
      sources: sources.map((s) => ({
        name: s.name,
        authority: s.authority,
        enabled: s.enabled,
        status: s.status,
        feedUrl: s.feedUrl,
        etag: s.etag ? `${String(s.etag).slice(0, 24)}…` : null,
        lastAttemptAt: s.lastAttemptAt,
        lastSuccessAt: s.lastSuccessAt,
        lastDataAt: s.lastDataAt,
        lastError: s.lastError,
        responseTimeMs: s.responseTimeMs,
        recordsFetched: s.recordsFetched,
        recordsAccepted: s.recordsAccepted,
        recordsRejected: s.recordsRejected,
      })),
      counts: {
        activeOfficialWarnings: activeOfficial,
        districtSubscriptions: subs,
        pushEndpoints: pushSubs,
      },
      recentAudit: (recentAudit as any[]).map((a) => ({
        timestamp: a.timestamp,
        action: a.action,
        source: a.source,
        sourceAlertId: a.sourceAlertId,
        reason: a.reason,
      })),
    });
  } catch (error) {
    console.error('Alert system health error:', error);
    res.status(500).json({ error: 'Failed to load alert system health.' });
  }
}
