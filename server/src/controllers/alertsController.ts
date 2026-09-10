import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export async function listAlerts(req: Request, res: Response): Promise<void> {
  try {
    const { state, hazardType, severity } = req.query;

    const whereClause: any = { status: 'ACTIVE' };
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

    const activeCount = await prisma.disasterAlert.count({ where: { status: 'ACTIVE' } });
    const criticalCount = await prisma.disasterAlert.count({ where: { severity: 'CRITICAL', status: 'ACTIVE' } });
    const warningCount = await prisma.disasterAlert.count({ where: { severity: 'WARNING', status: 'ACTIVE' } });

    res.json({
      alerts,
      summary: {
        totalActive: activeCount,
        critical: criticalCount,
        warning: warningCount,
        lastSynced: new Date().toISOString(),
      },
      // Provenance: seeded bulletin records are syntheses for evaluation while
      // DEMO_MODE=true; authoritative live bulletins at sachet.ndma.gov.in.
      isDemoData: process.env.DEMO_MODE === 'true',
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

    res.json({ alert });
  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ error: 'Failed to retrieve alert.' });
  }
}
