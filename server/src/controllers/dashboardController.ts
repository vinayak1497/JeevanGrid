import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export async function getDistrictDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district = req.user?.district || 'Mumbai Suburban';

    const incidents = await prisma.incident.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        report: true,
        assignedTo: { select: { id: true, name: true, phone: true } },
        fieldReports: true,
      },
    });

    const totalIncidents = incidents.length;
    const newIncidents = incidents.filter((i) => i.status === 'NEW').length;
    const assignedIncidents = incidents.filter((i) => i.status === 'ASSIGNED' || i.status === 'IN_PROGRESS').length;
    const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED').length;

    const reports = await prisma.emergencyReport.findMany();
    const totalAffected = reports.reduce((acc, r) => acc + r.peopleAffected, 0);

    const responders = await prisma.user.findMany({
      where: { role: 'FIELD_RESPONDER' },
      select: { id: true, name: true, phone: true },
    });

    const hospitals = await prisma.hospital.findMany();
    const totalAvailableBeds = hospitals.reduce((acc, h) => acc + h.availableBeds, 0);
    const totalAvailableIcu = hospitals.reduce((acc, h) => acc + h.availableIcuBeds, 0);

    const shelters = await prisma.shelter.findMany();
    const totalShelterCapacity = shelters.reduce((acc, s) => acc + s.capacity, 0);
    const totalShelterOccupancy = shelters.reduce((acc, s) => acc + s.currentOccupancy, 0);

    res.json({
      district,
      stats: {
        totalIncidents,
        newIncidents,
        assignedIncidents,
        resolvedIncidents,
        totalAffected,
        availableRespondersCount: responders.length,
        totalAvailableBeds,
        totalAvailableIcu,
        totalShelterCapacity,
        totalShelterOccupancy,
      },
      incidents,
      responders,
      hospitals,
      shelters,
    });
  } catch (error) {
    console.error('District dashboard error:', error);
    res.status(500).json({ error: 'Failed to load district dashboard data.' });
  }
}

export async function getHealthDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const hospitals = await prisma.hospital.findMany();

    const totalBeds = hospitals.reduce((acc, h) => acc + h.totalBeds, 0);
    const availableBeds = hospitals.reduce((acc, h) => acc + h.availableBeds, 0);
    const totalIcu = hospitals.reduce((acc, h) => acc + h.icuBeds, 0);
    const availableIcu = hospitals.reduce((acc, h) => acc + h.availableIcuBeds, 0);
    const avgOxygenDays = (
      hospitals.reduce((acc, h) => acc + h.oxygenStockDays, 0) / (hospitals.length || 1)
    ).toFixed(1);

    const diseaseRiskIndicators = [
      { condition: 'Waterborne Leptospirosis Watch', level: 'Moderate', district: 'Mumbai Suburban', status: 'Active Prophylaxis Dispensed' },
      { condition: 'Vector-borne Dengue / Malaria', level: 'Low', district: 'Mumbai City', status: 'Larvicidal Spraying Active' },
      { condition: 'Heat Exhaustion Cases', level: 'Advisory', district: 'Vidarbha Cluster', status: 'Cooling Stations Operational' },
      { condition: 'Acute Diarrheal Disease (ADD)', level: 'Low', district: 'Thane Coastal', status: 'Chlorine Sachet Distribution' },
    ];

    res.json({
      summary: {
        totalBeds,
        availableBeds,
        bedOccupancyRate: Math.round(((totalBeds - availableBeds) / (totalBeds || 1)) * 100),
        totalIcu,
        availableIcu,
        icuOccupancyRate: Math.round(((totalIcu - availableIcu) / (totalIcu || 1)) * 100),
        avgOxygenStockDays: parseFloat(avgOxygenDays),
      },
      hospitals,
      diseaseRiskIndicators,
    });
  } catch (error) {
    console.error('Health dashboard error:', error);
    res.status(500).json({ error: 'Failed to load health officer data.' });
  }
}

export async function getStateEocDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const alerts = await prisma.disasterAlert.findMany();
    const incidents = await prisma.incident.findMany();
    const resources = await prisma.resource.findMany();

    const districtComparison = [
      { district: 'Mumbai Suburban', riskLevel: 'MODERATE', activeIncidents: 2, rainfallMm: 72, shelterOccupancy: 45, status: 'Active Monitoring' },
      { district: 'Thane', riskLevel: 'MODERATE', activeIncidents: 1, rainfallMm: 65, shelterOccupancy: 24, status: 'Normal Readiness' },
      { district: 'Pune', riskLevel: 'LOW', activeIncidents: 0, rainfallMm: 28, shelterOccupancy: 12, status: 'Normal' },
      { district: 'Raigad', riskLevel: 'WATCH', activeIncidents: 1, rainfallMm: 85, shelterOccupancy: 30, status: 'High Tide Watch' },
      { district: 'Nagpur', riskLevel: 'WARNING', activeIncidents: 0, rainfallMm: 0, shelterOccupancy: 8, status: 'Heatwave Alert' },
      { district: 'Ratnagiri', riskLevel: 'WATCH', activeIncidents: 0, rainfallMm: 95, shelterOccupancy: 18, status: 'Coastal Swell Watch' },
    ];

    res.json({
      state: 'Maharashtra',
      activeAlertsCount: alerts.length,
      totalStateIncidents: incidents.length,
      districtComparison,
      resources,
      alerts,
    });
  } catch (error) {
    console.error('State EOC dashboard error:', error);
    res.status(500).json({ error: 'Failed to load State EOC data.' });
  }
}

export async function getVolunteerDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const communityTasks = [
      {
        id: 'TASK-101',
        title: 'Verify High-Tide Flood Line at Bandra Bandstand',
        category: 'Ground Verification',
        urgency: 'Medium',
        status: 'OPEN',
        location: 'Bandra Bandstand Promenade',
        instructions: 'Check whether water has receded past boundary rocks and upload timestamp photo.',
      },
      {
        id: 'TASK-102',
        title: 'Distribute ORS & Chlorine Sachets to Kurla Shelter',
        category: 'Relief Supply',
        urgency: 'High',
        status: 'IN_PROGRESS',
        location: 'Kurla West Municipal Hall Shelter',
        instructions: 'Coordinate with Shelter Warden Smt. Rekha More to hand over 200 packets.',
      },
      {
        id: 'TASK-103',
        title: 'Check In on Senior Citizens in Ground-Floor Flats',
        category: 'Vulnerable Care',
        urgency: 'High',
        status: 'OPEN',
        location: 'Milan Subway Vicinity, Santacruz',
        instructions: 'Verify power connectivity and medical supplies for 5 elderly families.',
      },
      {
        id: 'TASK-104',
        title: 'Verify Civic Siren Audio Coverage',
        category: 'Emergency Comms',
        urgency: 'Low',
        status: 'COMPLETED',
        location: 'Dadar Sports Club Staging Ground',
        instructions: 'Confirmed 120dB audible range tested during 10:00 AM mock test.',
      },
    ];

    res.json({
      volunteerName: req.user?.name || 'Community Volunteer',
      assignedTasks: communityTasks,
      totalCompleted: 14,
      hoursContributed: 38,
    });
  } catch (error) {
    console.error('Volunteer dashboard error:', error);
    res.status(500).json({ error: 'Failed to load volunteer data.' });
  }
}
