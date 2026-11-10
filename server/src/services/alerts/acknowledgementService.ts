import { prisma } from '../../utils/prisma';
import { generateIncidentReference } from '../../utils/idGenerator';

/**
 * Feature 7 — alert acknowledgement.
 *
 * A push being delivered is NOT proof it was read. We record explicit citizen
 * responses, keep them distinct from verified incidents, and aggregate at
 * district level. Turning an assistance request into an incident is an
 * explicit officer action.
 */

export const ACK_RESPONSES = ['RECEIVED', 'SAFE', 'NEED_ASSISTANCE', 'CANNOT_EVACUATE', 'NEED_INFO'] as const;
export type AckResponse = (typeof ACK_RESPONSES)[number];

export async function recordAcknowledgement(input: {
  alertId: string;
  sourceAlertId?: string;
  userId: string;
  district?: string;
  state?: string;
  response: AckResponse;
  note?: string;
}): Promise<{ acknowledgement: any; duplicate: boolean }> {
  const alert = await prisma.disasterAlert.findUnique({ where: { id: input.alertId } });
  if (!alert) throw Object.assign(new Error('Alert not found.'), { statusCode: 404 });

  const existing = await prisma.alertAcknowledgement.findUnique({
    where: {
      userId_alertId_response: {
        userId: input.userId,
        alertId: input.alertId,
        response: input.response,
      },
    },
  });
  if (existing) return { acknowledgement: existing, duplicate: true };

  const acknowledgement = await prisma.alertAcknowledgement.create({
    data: {
      alertId: input.alertId,
      sourceAlertId: alert.sourceAlertId || input.sourceAlertId || null,
      userId: input.userId,
      district: input.district || alert.district,
      state: input.state || alert.state,
      response: input.response,
      note: input.note?.slice(0, 500) || null,
    },
  });
  return { acknowledgement, duplicate: false };
}

export function buildAcknowledgementSummary(input: {
  acknowledgements: Array<{ response: string; userId: string }>;
  subscriptions: number;
  pushDeliveries: number;
  assistanceRequests: any[];
}): any {
  const counts: Record<string, number> = {};
  for (const response of ACK_RESPONSES) counts[response] = 0;
  const users = new Set<string>();
  for (const ack of input.acknowledgements) {
    counts[ack.response] = (counts[ack.response] || 0) + 1;
    users.add(ack.userId);
  }
  return {
    totalAcknowledgements: input.acknowledgements.length,
    distinctResponders: users.size,
    byResponse: counts,
    safeReports: counts.SAFE || 0,
    receivedReports: counts.RECEIVED || 0,
    assistanceRequests: (counts.NEED_ASSISTANCE || 0) + (counts.CANNOT_EVACUATE || 0),
    informationRequests: counts.NEED_INFO || 0,
    pushDeliveriesMeasured: input.pushDeliveries,
    districtSubscriptions: input.subscriptions,
    estimatedUnacknowledgedSubscriptions: Math.max(0, input.subscriptions - users.size),
    deliveryNote:
      'Push delivery is counted only where the provider log exists. Delivery is not proof that a citizen read or understood the warning.',
    privacyNote: 'Aggregated at district level. Individual responses are never exposed publicly.',
    assistanceQueue: input.assistanceRequests,
  };
}

async function assistanceQueueFor(alertIds: string[], since: Date, district: string): Promise<any[]> {
  const acks = await prisma.alertAcknowledgement.findMany({
    where: {
      alertId: { in: alertIds },
      district,
      response: { in: ['NEED_ASSISTANCE', 'CANNOT_EVACUATE'] },
      createdAt: { gte: since },
      incidentId: null,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(acks.map((a) => a.userId))) } },
    select: { id: true, name: true, phone: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return acks.map((a) => ({
    id: a.id,
    alertId: a.alertId,
    response: a.response,
    note: a.note,
    createdAt: a.createdAt,
    citizenName: byId.get(a.userId)?.name || 'Citizen',
    contactPhone: byId.get(a.userId)?.phone || null,
    district: a.district,
    caution: 'District-level acknowledgement, not a verified incident location.',
  }));
}

export async function getAcknowledgementSummary(district: string, days = 30): Promise<any> {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 24 * 60 * 60 * 1000);
  const alerts = await prisma.disasterAlert.findMany({
    where: {
      district,
      sourceType: 'OFFICIAL',
      isVerified: true,
      issuedAt: { gte: since },
    },
    select: { id: true, sourceAlertId: true },
    take: 500,
  });
  const alertIds = alerts.map((a) => a.id);
  const sourceAlertIds = alerts.map((a) => a.sourceAlertId).filter((v): v is string => Boolean(v));

  const [acknowledgements, subscriptions, pushDeliveries] = await Promise.all([
    alertIds.length
      ? prisma.alertAcknowledgement.findMany({
          where: { alertId: { in: alertIds }, createdAt: { gte: since } },
          select: { response: true, userId: true },
        })
      : Promise.resolve([]),
    prisma.alertSubscription.count({ where: { district } }),
    sourceAlertIds.length
      ? prisma.alertNotificationLog.count({
          where: { sourceAlertId: { in: sourceAlertIds }, sentAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  const assistanceQueue = alertIds.length ? await assistanceQueueFor(alertIds, since, district) : [];
  return {
    district,
    windowDays: days,
    ...buildAcknowledgementSummary({ acknowledgements, subscriptions, pushDeliveries, assistanceRequests: assistanceQueue }),
    generatedAt: new Date().toISOString(),
  };
}

export async function createIncidentFromAcknowledgement(
  acknowledgementId: string,
  actor: { id: string; role: string; name?: string }
): Promise<any> {
  if (!['DISTRICT_OFFICER', 'STATE_EOC'].includes(actor.role)) {
    throw Object.assign(new Error('Only District Officer or State EOC can convert an acknowledgement.'), { statusCode: 403 });
  }
  const ack = await prisma.alertAcknowledgement.findUnique({ where: { id: acknowledgementId } });
  if (!ack) throw Object.assign(new Error('Acknowledgement not found.'), { statusCode: 404 });
  if (ack.incidentId) {
    const existing = await prisma.incident.findUnique({ where: { id: ack.incidentId } });
    return { incident: existing, alreadyConverted: true };
  }
  if (!['NEED_ASSISTANCE', 'CANNOT_EVACUATE'].includes(ack.response)) {
    throw Object.assign(new Error('Only assistance or evacuation-difficulty responses can become incidents.'), { statusCode: 409 });
  }

  const incident = await prisma.incident.create({
    data: {
      referenceCode: generateIncidentReference(),
      title: `Alert ${ack.response === 'CANNOT_EVACUATE' ? 'evacuation difficulty' : 'assistance request'} — ${ack.district}`,
      description:
        ack.note ||
        `Citizen responded "${ack.response}" to an official warning. District-level location only; contact details require officer follow-up.`,
      emergencyType: ack.response === 'CANNOT_EVACUATE' ? 'Evacuation Assistance' : 'Assistance Request',
      urgency: ack.response === 'CANNOT_EVACUATE' ? 'High' : 'Moderate',
      status: 'NEW',
      district: ack.district,
      state: ack.state || 'Maharashtra',
      locationName: `${ack.district} (district-level acknowledgement)`,
      latitude: null,
      longitude: null,
    },
  });
  await prisma.alertAcknowledgement.update({ where: { id: acknowledgementId }, data: { incidentId: incident.id } });
  return {
    incident,
    alreadyConverted: false,
    note: 'Created as an operational follow-up. This does not verify an emergency location and does not dispatch a team automatically.',
  };
}
