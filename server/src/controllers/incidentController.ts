import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export async function listIncidents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, responderId } = req.query;

    const whereClause: any = {};
    if (status) {
      whereClause.status = String(status);
    }
    if (responderId) {
      whereClause.assignedToId = String(responderId);
    }

    const incidents = await prisma.incident.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        report: true,
        assignedTo: {
          select: { id: true, name: true, email: true, phone: true, role: true },
        },
        fieldReports: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    res.json({ incidents });
  } catch (error) {
    console.error('List incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch incidents.' });
  }
}

export async function getIncidentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        report: true,
        assignedTo: {
          select: { id: true, name: true, email: true, phone: true, role: true },
        },
        fieldReports: {
          include: {
            responder: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!incident) {
      res.status(404).json({ error: 'Incident not found.' });
      return;
    }

    res.json({ incident });
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({ error: 'Failed to retrieve incident.' });
  }
}

export async function assignIncident(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { responderId } = req.body;

    if (!responderId) {
      res.status(400).json({ error: 'responderId is required.' });
      return;
    }

    const responder = await prisma.user.findUnique({
      where: { id: responderId },
    });

    if (!responder) {
      res.status(404).json({ error: 'Assigned responder not found.' });
      return;
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: {
        assignedToId: responder.id,
        status: 'ASSIGNED',
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, phone: true },
        },
        report: true,
      },
    });

    if (updated.reportId) {
      await prisma.emergencyReport.update({
        where: { id: updated.reportId },
        data: { status: 'DISPATCHED' },
      });
    }

    res.json({
      message: `Incident successfully assigned to ${responder.name}`,
      incident: updated,
    });
  } catch (error) {
    console.error('Assign incident error:', error);
    res.status(500).json({ error: 'Failed to assign incident.' });
  }
}

export async function updateIncidentStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Valid values: ${validStatuses.join(', ')}` });
      return;
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: { status },
      include: {
        assignedTo: true,
        report: true,
      },
    });

    if (updated.reportId && status === 'RESOLVED') {
      await prisma.emergencyReport.update({
        where: { id: updated.reportId },
        data: { status: 'RESOLVED' },
      });
    }

    res.json({
      message: `Incident status updated to ${status}`,
      incident: updated,
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update incident status.' });
  }
}

export async function listResponders(req: Request, res: Response): Promise<void> {
  try {
    const responders = await prisma.user.findMany({
      where: { role: 'FIELD_RESPONDER' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        district: true,
      },
    });

    res.json({ responders });
  } catch (error) {
    console.error('List responders error:', error);
    res.status(500).json({ error: 'Failed to fetch responders.' });
  }
}
