import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export async function submitFieldReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { incidentId, situationReport, casualtiesRescued, medicalRequired, notes, photoUrl, latitude, longitude, markCompleted } = req.body;

    if (!incidentId || !situationReport) {
      res.status(400).json({ error: 'incidentId and situationReport are required.' });
      return;
    }

    const responderId = req.user?.id;
    const responderName = req.user?.name || 'Field Responder';

    if (!responderId) {
      res.status(401).json({ error: 'Authentication required to submit field reports.' });
      return;
    }

    const fieldReport = await prisma.fieldReport.create({
      data: {
        incidentId,
        responderId,
        responderName,
        situationReport,
        casualtiesRescued: casualtiesRescued ? parseInt(casualtiesRescued, 10) : 0,
        medicalRequired: Boolean(medicalRequired),
        notes: notes || null,
        photoUrl: photoUrl || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    // Update incident status
    const newStatus = markCompleted ? 'RESOLVED' : 'IN_PROGRESS';
    await prisma.incident.update({
      where: { id: incidentId },
      data: { status: newStatus },
    });

    res.status(201).json({
      message: 'Field report logged successfully.',
      fieldReport,
      incidentStatus: newStatus,
    });
  } catch (error) {
    console.error('Submit field report error:', error);
    res.status(500).json({ error: 'Failed to submit field report.' });
  }
}

export async function listFieldReports(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { incidentId } = req.query;
    const whereClause = incidentId ? { incidentId: String(incidentId) } : {};

    const reports = await prisma.fieldReport.findMany({
      where: whereClause,
      orderBy: { submittedAt: 'desc' },
      include: {
        incident: {
          select: { title: true, emergencyType: true, locationName: true, status: true },
        },
      },
    });

    res.json({ fieldReports: reports });
  } catch (error) {
    console.error('List field reports error:', error);
    res.status(500).json({ error: 'Failed to fetch field reports.' });
  }
}
