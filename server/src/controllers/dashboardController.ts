import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { queryOfficialAlerts } from '../services/alerts/officialAlertQuery';
import { getHealthAssessment } from '../services/health/healthAssessmentService';
import { getImpactSummary, listImpactAssessments } from '../services/impact/impactAssessmentService';
import { getCommunityIntelligence, shapeReportForViewer } from '../services/community/communityIntelligenceService';
import { getPlaybookSummary, listPlaybooks } from '../services/playbooks/playbookService';
import { getAcknowledgementSummary } from '../services/alerts/acknowledgementService';
import { listSatelliteLayers } from '../services/satellite/satelliteLayerService';

async function safe<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    console.warn(`[dashboard] ${label} unavailable:`, (e as Error).message.slice(0, 160));
    return fallback;
  }
}

export async function getDistrictDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const district = req.user.district || 'Mumbai Suburban';
    const state = req.user.state || 'Maharashtra';
    const scope = { district, state };

    const incidents = await prisma.incident.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        report: true,
        assignedTo: { select: { id: true, name: true, phone: true, role: true, district: true } },
        assignedBy: { select: { id: true, name: true, role: true } },
        verifiedBy: { select: { id: true, name: true, role: true } },
        resolutionReviewedBy: { select: { id: true, name: true, role: true } },
        fieldReports: {
          include: { responder: { select: { id: true, name: true, role: true } } },
          orderBy: { submittedAt: 'desc' as const },
        },
        events: { orderBy: { createdAt: 'asc' as const } },
      },
    });

    const totalIncidents = incidents.length;
    const newIncidents = incidents.filter((i) => i.status === 'NEW').length;
    const duplicateSuspected = incidents.filter((i) => i.status === 'DUPLICATE_SUSPECTED').length;
    const verifiedIncidents = incidents.filter((i) => i.status === 'VERIFIED').length;
    const assignedIncidents = incidents.filter((i) =>
      ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'].includes(i.status)
    ).length;
    const pendingResolution = incidents.filter((i) => i.status === 'RESOLVED_PENDING_REVIEW').length;
    const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED').length;
    const rejectedIncidents = incidents.filter((i) => i.status === 'REJECTED').length;

    const reports = await prisma.emergencyReport.findMany({ where: scope });
    const totalAffected = reports.reduce((acc, r) => acc + r.peopleAffected, 0);

    const responders = await prisma.user.findMany({
      where: { role: 'FIELD_RESPONDER', ...scope },
      select: {
        id: true,
        name: true,
        phone: true,
        district: true,
        state: true,
        assignedIncidents: {
          where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'] } },
          select: { id: true, referenceCode: true, title: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const hospitals = await prisma.hospital.findMany({ where: scope });
    const totalAvailableBeds = hospitals.reduce((acc, h) => acc + h.availableBeds, 0);
    const totalAvailableIcu = hospitals.reduce((acc, h) => acc + h.availableIcuBeds, 0);

    const shelters = await prisma.shelter.findMany({ where: scope });
    const totalShelterCapacity = shelters.reduce((acc, s) => acc + s.capacity, 0);
    const totalShelterOccupancy = shelters.reduce((acc, s) => acc + s.currentOccupancy, 0);

    // Official warnings affecting this officer's district (fail-closed:
    // verified, non-expired, provenance-complete, freshly confirmed only).
    // District staging starts here — this is JeevanGrid operational context,
    // not a JeevanGrid-issued warning.
    const official = await queryOfficialAlerts({ district, take: 50 }).catch(() => null);

    const [impactSummary, communityIntelligence, playbookSummary, acknowledgementSummary, satelliteLayers] =
      await Promise.all([
        safe(getImpactSummary(district), null, 'impact summary'),
        safe(getCommunityIntelligence(district), null, 'community intelligence'),
        safe(getPlaybookSummary(district), null, 'playbook summary'),
        safe(getAcknowledgementSummary(district), null, 'acknowledgement summary'),
        safe(listSatelliteLayers(district, 12), [], 'satellite layers'),
      ]);

    res.json({
      district,
      impactSummary,
      communityIntelligence,
      playbookSummary,
      acknowledgementSummary,
      satelliteLayers,
      stats: {
        totalIncidents,
        newIncidents,
        duplicateSuspected,
        verifiedIncidents,
        assignedIncidents,
        pendingResolution,
        resolvedIncidents,
        rejectedIncidents,
        totalAffected,
        availableRespondersCount: responders.length,
        respondersWithActiveAssignments: responders.filter((r) => r.assignedIncidents.length > 0).length,
        totalAvailableBeds,
        totalAvailableIcu,
        totalShelterCapacity,
        totalShelterOccupancy,
        activeOfficialWarnings: official ? official.alerts.length : null,
      },
      incidents,
      responders: responders.map((r) => ({
        ...r,
        activeAssignments: r.assignedIncidents.length,
      })),
      scope: { district, state },
      hospitals,
      shelters,
      officialAlerts: official ? official.alerts : [],
      officialStaleCount: official ? official.staleCount : 0,
      lastSuccessfulSync: official ? official.lastSuccessfulSync : null,
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

    // Real evidence-driven climate-health assessment for the officer's
    // district (best-effort: never hardcoded, never blocking the dashboard).
    const districtLabel = req.user?.district
      ? `${req.user.district}, ${req.user?.state || ''}`.trim()
      : 'Mumbai, Maharashtra';
    const healthIntelligence = await getHealthAssessment(districtLabel, { withNugen: true }).catch(
      (e) => {
        console.warn('[health] dashboard assessment failed (non-fatal):', (e as Error).message.slice(0, 160));
        return null;
      }
    );

    const playbooks = await safe(
      listPlaybooks({ district: req.user?.district, role: 'HEALTH_OFFICER' }),
      [],
      'health playbooks'
    );

    res.json({
      playbooks,
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
      healthIntelligence,
    });
  } catch (error) {
    console.error('Health dashboard error:', error);
    res.status(500).json({ error: 'Failed to load health officer data.' });
  }
}

export async function getStateEocDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    // Official warnings ONLY (fail-closed). Demo, expired, cancelled and
    // unverified rows must never inflate the SEOC operational picture.
    const official = await queryOfficialAlerts({ take: 200 }).catch(() => null);
    const alerts = official ? official.alerts : [];
    const stateScope = req.user?.state || 'Maharashtra';
    const incidents = await prisma.incident.findMany({ where: { state: stateScope } });
    const resources = await prisma.resource.findMany();
    const shelters = await prisma.shelter.findMany().catch(() => []);

    const shelterOccByDistrict = new Map<string, { occ: number; cap: number }>();
    for (const s of shelters as any[]) {
      const e = shelterOccByDistrict.get(s.district) || { occ: 0, cap: 0 };
      e.occ += s.currentOccupancy || 0;
      e.cap += s.capacity || 0;
      shelterOccByDistrict.set(s.district, e);
    }
    const incidentsByDistrict = new Map<string, number>();
    for (const i of incidents as any[]) {
      incidentsByDistrict.set(i.district, (incidentsByDistrict.get(i.district) || 0) + 1);
    }
    const sevRank: Record<string, number> = { CRITICAL: 4, WARNING: 3, WATCH: 2, INFO: 1 };

    const baseDistricts = [
      'Mumbai Suburban',
      'Thane',
      'Pune',
      'Raigad',
      'Nagpur',
      'Ratnagiri',
    ];
    // Any district with live official warnings joins the table even if not listed.
    for (const a of alerts as any[]) {
      if (a.district && !baseDistricts.includes(a.district)) baseDistricts.push(a.district);
    }

    const districtComparison = baseDistricts.map((district) => {
      const affecting = (alerts as any[]).filter(
        (a) => a.district === district || (a.affectedArea || '').includes(district)
      );
      const top = affecting.sort((x, y) => (sevRank[y.severity] || 0) - (sevRank[x.severity] || 0))[0];
      const occ = shelterOccByDistrict.get(district);
      return {
        district,
        riskLevel: top ? top.severity : 'LOW',
        activeIncidents: incidentsByDistrict.get(district) || 0,
        // Live 24h rainfall per district would require 6+ weather calls per
        // dashboard load; the risk engine already fuses it per location.
        rainfallMm: null as number | null,
        shelterOccupancy: occ && occ.cap ? Math.round((occ.occ / occ.cap) * 100) : 0,
        status: top
          ? `${top.hazardType} ${top.severity} — ${top.authority || top.source} (official)`
          : 'Normal readiness',
        activeOfficialWarnings: affecting.length,
      };
    });

    const [communityIntelligence, playbookSummary, impactAssessments, satelliteLayers] = await Promise.all([
      safe(getCommunityIntelligence(undefined), null, 'state community intelligence'),
      safe(getPlaybookSummary(undefined), null, 'state playbook summary'),
      safe(listImpactAssessments(undefined, 8), [], 'state impact assessments'),
      safe(listSatelliteLayers(undefined, 12), [], 'state satellite layers'),
    ]);

    res.json({
      state: 'Maharashtra',
      activeAlertsCount: alerts.length,
      totalStateIncidents: incidents.length,
      districtComparison,
      communityIntelligence,
      playbookSummary,
      impactAssessments,
      satelliteLayers,
      resources,
      alerts,
      staleCount: official ? official.staleCount : 0,
      lastSuccessfulSync: official ? official.lastSuccessfulSync : null,
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

    const district = req.user?.district || 'Mumbai Suburban';
    const [playbooks, communityReports] = await Promise.all([
      safe(listPlaybooks({ district, role: 'COMMUNITY_VOLUNTEER' }), [], 'volunteer playbooks'),
      safe(
        prisma.emergencyReport.findMany({
          where: {
            district,
            verificationStatus: { in: ['UNVERIFIED', 'CORROBORATED', 'DUPLICATE_SUSPECTED'] },
            createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { incident: { include: { assignedTo: { select: { name: true } } } } },
        }),
        [],
        'volunteer community reports'
      ),
    ]);

    res.json({
      volunteerName: req.user?.name || 'Community Volunteer',
      assignedTasks: communityTasks,
      totalCompleted: 14,
      hoursContributed: 38,
      playbooks,
      communityReports: communityReports.map((r) => shapeReportForViewer(r, 'COMMUNITY_VOLUNTEER', false)),
    });
  } catch (error) {
    console.error('Volunteer dashboard error:', error);
    res.status(500).json({ error: 'Failed to load volunteer data.' });
  }
}
