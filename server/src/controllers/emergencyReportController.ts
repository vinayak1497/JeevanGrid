import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { generateEmergencyReportId } from '../utils/idGenerator';

export async function createEmergencyReport(req: Request, res: Response): Promise<void> {
  try {
    const {
      citizenName,
      phone,
      locationName,
      latitude,
      longitude,
      emergencyType,
      urgency,
      peopleAffected,
      description,
      photoUrl,
    } = req.body;

    if (!citizenName || !phone || !locationName || !emergencyType || !description) {
      res.status(400).json({ error: 'Missing required report fields.' });
      return;
    }

    const reportId = generateEmergencyReportId();

    const report = await prisma.emergencyReport.create({
      data: {
        id: reportId,
        citizenName,
        phone,
        locationName,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        emergencyType,
        urgency: urgency || 'Moderate',
        peopleAffected: peopleAffected ? parseInt(peopleAffected, 10) : 1,
        description,
        photoUrl: photoUrl || null,
        status: 'PENDING',
      },
    });

    // Automatically create a linked incident in the District Disaster Operations system
    const incident = await prisma.incident.create({
      data: {
        reportId: report.id,
        title: `${emergencyType}: ${locationName}`,
        description,
        emergencyType,
        urgency: urgency || 'Moderate',
        status: 'NEW',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        locationName,
        latitude: latitude ? parseFloat(latitude) : 19.0760,
        longitude: longitude ? parseFloat(longitude) : 72.8777,
      },
    });

    res.status(201).json({
      message: 'Emergency report submitted successfully.',
      reportId: report.id,
      report,
      incidentId: incident.id,
    });
  } catch (error) {
    console.error('Create emergency report error:', error);
    res.status(500).json({ error: 'Internal server error submitting emergency report.' });
  }
}

export async function listEmergencyReports(req: Request, res: Response): Promise<void> {
  try {
    const reports = await prisma.emergencyReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        incident: {
          include: {
            assignedTo: {
              select: { id: true, name: true, phone: true, role: true },
            },
          },
        },
      },
    });

    res.json({ reports });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({ error: 'Failed to fetch emergency reports.' });
  }
}

export async function getEmergencyReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const report = await prisma.emergencyReport.findUnique({
      where: { id },
      include: {
        incident: {
          include: {
            assignedTo: true,
            fieldReports: true,
          },
        },
      },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    res.json({ report });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to retrieve report.' });
  }
}
