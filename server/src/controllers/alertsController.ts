import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { alertConfig } from '../services/alerts/alertConfig';
import { expireStaleAlerts } from '../services/alerts/alertExpirationService';

/**
 * Legacy list endpoint (kept for backward compatibility).
 * Hardened: backend-enforced expiry + production demo exclusion.
 * New consumers should use GET /api/alerts/official.
 */
export async function listAlerts(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    await expireStaleAlerts(now).catch(() => undefined);

    const { state, hazardType, severity } = req.query;

    const whereClause: any = {
      status: { in: ['ACTIVE', 'UPDATED'] },
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    };
    // Production must never serve demo/seeds as live bulletins. The backend
    // enforces this — it is NOT merely hidden in React.
    if (!alertConfig.enableDemoAlerts) {
      whereClause.isDemoData = false;
    }
    if (state && state !== 'All') {
      whereClause.state = String(state);
    }
    if (hazardType && hazardType !== 'All') {
      whereClause.hazardType = { contains: String(hazardType) };
    }
    if (severity && severity !== 'All') {
      whereClause.severity = String(severity);
    }

    const alerts = await prisma.disasterAlert.findMany({
      where: whereClause,
      orderBy: { issuedAt: 'desc' },
    });

    const baseFilter: any = {
      status: { in: ['ACTIVE', 'UPDATED'] },
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      ...(!alertConfig.enableDemoAlerts ? { isDemoData: false } : {}),
    };
    const activeCount = await prisma.disasterAlert.count({ where: baseFilter });
    const criticalCount = await prisma.disasterAlert.count({ where: { ...baseFilter, severity: 'CRITICAL' } });
    const warningCount = await prisma.disasterAlert.count({ where: { ...baseFilter, severity: 'WARNING' } });

    res.json({
      alerts,
      summary: {
        totalActive: activeCount,
        critical: criticalCount,
        warning: warningCount,
        lastSynced: new Date().toISOString(),
      },
      // Seeded bulletin records are syntheses for evaluation while demo alerts
      // are enabled; authoritative live warnings come from /api/alerts/official.
      demoMode: alertConfig.enableDemoAlerts,
      isDemoData: alertConfig.enableDemoAlerts,
    });
  } catch (error) {
    console.error('List alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch disaster alerts.' });
  }
}

export async function getAlertById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const alert = await prisma.disasterAlert.findUnique({
      where: { id },
    });

    if (!alert) {
      res.status(404).json({ error: 'Alert not found.' });
      return;
    }

    // Same backend gates as the list endpoints — a direct ID must not leak
    // demo records in production, nor serve expired/cancelled bulletins as live.
    if (alert.isDemoData && !alertConfig.enableDemoAlerts) {
      res.status(404).json({ error: 'Alert not found.' });
      return;
    }
    const now = new Date();
    if (alert.expiresAt && new Date(alert.expiresAt).getTime() <= now.getTime()) {
      res.status(410).json({ error: 'This warning has expired.', expiredAt: alert.expiresAt });
      return;
    }
    if (String(alert.status).toUpperCase() === 'CANCELLED') {
      res.status(410).json({ error: 'This warning was cancelled by the issuing authority.' });
      return;
    }

    res.json({ alert });
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ error: 'Failed to retrieve alert.' });
  }
}
