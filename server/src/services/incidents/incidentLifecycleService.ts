import { Prisma } from '@prisma/client';

/**
 * Incident lifecycle rules.
 *
 * This module deliberately contains no AI calls and no automatic dispatch. A
 * human DDMA officer verifies and assigns. A human responder accepts, moves and
 * submits a resolution. A human DDMA officer reviews the resolution. Every
 * transition is written to IncidentEvent; the event ledger is append-only.
 */

export const INCIDENT_STATUS = {
  NEW: 'NEW',
  VERIFIED: 'VERIFIED',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  EN_ROUTE: 'EN_ROUTE',
  ON_SITE: 'ON_SITE',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED_PENDING_REVIEW: 'RESOLVED_PENDING_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
  DUPLICATE_SUSPECTED: 'DUPLICATE_SUSPECTED',
  REOPENED: 'REOPENED',
} as const;

export type IncidentStatus = (typeof INCIDENT_STATUS)[keyof typeof INCIDENT_STATUS];

export const ACTIVE_FIELD_STATUSES: string[] = [
  INCIDENT_STATUS.ASSIGNED,
  INCIDENT_STATUS.ACCEPTED,
  INCIDENT_STATUS.EN_ROUTE,
  INCIDENT_STATUS.ON_SITE,
  INCIDENT_STATUS.IN_PROGRESS,
];

export const OPEN_INCIDENT_STATUSES: string[] = [
  INCIDENT_STATUS.NEW,
  INCIDENT_STATUS.VERIFIED,
  ...ACTIVE_FIELD_STATUSES,
  INCIDENT_STATUS.RESOLVED_PENDING_REVIEW,
  INCIDENT_STATUS.REOPENED,
  INCIDENT_STATUS.DUPLICATE_SUSPECTED,
];

export const TERMINAL_INCIDENT_STATUSES: string[] = [
  INCIDENT_STATUS.RESOLVED,
  INCIDENT_STATUS.REJECTED,
];

export const DDMA_ROLES = ['DISTRICT_OFFICER', 'STATE_EOC'];
export const RESPONDER_ROLES = ['FIELD_RESPONDER'];

export type LifecycleAction =
  | 'VERIFY'
  | 'REJECT'
  | 'MARK_DUPLICATE'
  | 'ASSIGN'
  | 'ACCEPT'
  | 'EN_ROUTE'
  | 'ARRIVE'
  | 'START'
  | 'SITUATION_UPDATE'
  | 'SUBMIT_RESOLUTION'
  | 'APPROVE_RESOLUTION'
  | 'REJECT_RESOLUTION'
  | 'REOPEN';

export interface ScopeUser {
  id: string;
  role: string;
  district?: string | null;
  state?: string | null;
}

export interface ScopeIncident {
  id: string;
  district: string;
  state: string;
  assignedToId: string | null;
  report?: { reportedByUserId?: string | null } | null;
}

export class LifecycleError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'LifecycleError';
    this.statusCode = statusCode;
  }
}

export function isDdmaRole(role: string | undefined | null): boolean {
  return Boolean(role && DDMA_ROLES.includes(role));
}

export function isResponderRole(role: string | undefined | null): boolean {
  return Boolean(role && RESPONDER_ROLES.includes(role));
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_INCIDENT_STATUSES.includes(status);
}

export function isActiveFieldStatus(status: string): boolean {
  return ACTIVE_FIELD_STATUSES.includes(status);
}

export function statusLabel(status: string): string {
  return String(status || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Where the action may start, and where it lands. Unknown actions or invalid
 * source states are rejected rather than silently coerced.
 */
const TRANSITIONS: Record<LifecycleAction, { from: string[]; to: string }> = {
  VERIFY: {
    from: [INCIDENT_STATUS.NEW, INCIDENT_STATUS.DUPLICATE_SUSPECTED, INCIDENT_STATUS.REOPENED],
    to: INCIDENT_STATUS.VERIFIED,
  },
  REJECT: {
    from: [
      INCIDENT_STATUS.NEW,
      INCIDENT_STATUS.VERIFIED,
      INCIDENT_STATUS.DUPLICATE_SUSPECTED,
      INCIDENT_STATUS.REOPENED,
    ],
    to: INCIDENT_STATUS.REJECTED,
  },
  MARK_DUPLICATE: {
    from: [INCIDENT_STATUS.NEW, INCIDENT_STATUS.VERIFIED, INCIDENT_STATUS.REOPENED],
    to: INCIDENT_STATUS.DUPLICATE_SUSPECTED,
  },
  ASSIGN: {
    from: [INCIDENT_STATUS.VERIFIED, INCIDENT_STATUS.REOPENED],
    to: INCIDENT_STATUS.ASSIGNED,
  },
  ACCEPT: {
    from: [INCIDENT_STATUS.ASSIGNED],
    to: INCIDENT_STATUS.ACCEPTED,
  },
  EN_ROUTE: {
    from: [INCIDENT_STATUS.ACCEPTED],
    to: INCIDENT_STATUS.EN_ROUTE,
  },
  ARRIVE: {
    from: [INCIDENT_STATUS.EN_ROUTE],
    to: INCIDENT_STATUS.ON_SITE,
  },
  START: {
    from: [INCIDENT_STATUS.ON_SITE],
    to: INCIDENT_STATUS.IN_PROGRESS,
  },
  SITUATION_UPDATE: {
    from: [INCIDENT_STATUS.ON_SITE, INCIDENT_STATUS.IN_PROGRESS],
    to: '', // status does not change; see nextStatusForAction
  },
  SUBMIT_RESOLUTION: {
    from: [INCIDENT_STATUS.ON_SITE, INCIDENT_STATUS.IN_PROGRESS],
    to: INCIDENT_STATUS.RESOLVED_PENDING_REVIEW,
  },
  APPROVE_RESOLUTION: {
    from: [INCIDENT_STATUS.RESOLVED_PENDING_REVIEW],
    to: INCIDENT_STATUS.RESOLVED,
  },
  REJECT_RESOLUTION: {
    from: [INCIDENT_STATUS.RESOLVED_PENDING_REVIEW],
    to: INCIDENT_STATUS.IN_PROGRESS,
  },
  REOPEN: {
    from: [INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.REJECTED],
    to: INCIDENT_STATUS.REOPENED,
  },
};

export function nextStatusForAction(currentStatus: string, action: LifecycleAction): string {
  const rule = TRANSITIONS[action];
  if (!rule) throw new LifecycleError(`Unknown incident action: ${action}.`, 400);
  if (!rule.from.includes(currentStatus)) {
    throw new LifecycleError(
      `Cannot ${action.replace(/_/g, ' ').toLowerCase()} an incident in ${currentStatus} state.`,
      409
    );
  }
  return rule.to || currentStatus;
}

export function assertActionRole(action: LifecycleAction, role: string | undefined | null): void {
  const ddmaActions: LifecycleAction[] = [
    'VERIFY',
    'REJECT',
    'MARK_DUPLICATE',
    'ASSIGN',
    'APPROVE_RESOLUTION',
    'REJECT_RESOLUTION',
    'REOPEN',
  ];
  const responderActions: LifecycleAction[] = [
    'ACCEPT',
    'EN_ROUTE',
    'ARRIVE',
    'START',
    'SITUATION_UPDATE',
    'SUBMIT_RESOLUTION',
  ];
  if (ddmaActions.includes(action) && !isDdmaRole(role)) {
    throw new LifecycleError('Only a DDMA officer can perform this action.', 403);
  }
  if (responderActions.includes(action) && !isResponderRole(role)) {
    throw new LifecycleError('Only the assigned field responder can perform this action.', 403);
  }
}

function sameState(user: ScopeUser, incident: ScopeIncident): boolean {
  return Boolean(user.state && incident.state && user.state === incident.state);
}

export function canManageIncident(user: ScopeUser | null | undefined, incident: ScopeIncident): boolean {
  if (!user) return false;
  if (!sameState(user, incident)) return false;
  if (user.role === 'STATE_EOC') return true;
  return user.role === 'DISTRICT_OFFICER' && user.district === incident.district;
}

export function canViewIncident(user: ScopeUser | null | undefined, incident: ScopeIncident): boolean {
  if (!user) return false;
  if (canManageIncident(user, incident)) return true;
  if (user.role === 'FIELD_RESPONDER') return incident.assignedToId === user.id;
  if (user.role === 'CITIZEN') return incident.report?.reportedByUserId === user.id;
  return false;
}

export function canRespondToIncident(user: ScopeUser | null | undefined, incident: ScopeIncident): boolean {
  return Boolean(
    user &&
      user.role === 'FIELD_RESPONDER' &&
      incident.assignedToId === user.id &&
      sameState(user, incident)
  );
}

export function canViewExactIncidentLocation(
  user: ScopeUser | null | undefined,
  incident: ScopeIncident
): boolean {
  if (!user) return false;
  if (canManageIncident(user, incident)) return true;
  if (user.role === 'FIELD_RESPONDER' && incident.assignedToId === user.id) return true;
  if (user.role === 'CITIZEN' && incident.report?.reportedByUserId === user.id) return true;
  return false;
}

export function assertCanManage(user: ScopeUser | null | undefined, incident: ScopeIncident): void {
  if (!canManageIncident(user, incident)) {
    throw new LifecycleError('This incident is outside your DDMA jurisdiction.', 403);
  }
}

export function assertCanRespond(user: ScopeUser | null | undefined, incident: ScopeIncident): void {
  if (!canRespondToIncident(user, incident)) {
    throw new LifecycleError('Only the responder assigned to this incident may act on it.', 403);
  }
}

export function assertResponderInJurisdiction(
  user: ScopeUser | null | undefined,
  responder: { role: string; district: string; state: string },
  incident: { district: string; state: string }
): void {
  if (!user || !isDdmaRole(user.role)) {
    throw new LifecycleError('Only a DDMA officer can assign a responder.', 403);
  }
  if (user.role === 'DISTRICT_OFFICER' && responder.district !== incident.district) {
    throw new LifecycleError('Responders must be assigned within the incident district.', 403);
  }
  if (user.role === 'STATE_EOC' && responder.state !== incident.state) {
    throw new LifecycleError('Responders must be assigned within the incident state.', 403);
  }
  if (responder.role !== 'FIELD_RESPONDER') {
    throw new LifecycleError('The selected user is not a field responder.', 400);
  }
}

export type IncidentDb = Prisma.TransactionClient;

export async function appendIncidentEvent(
  tx: IncidentDb,
  input: {
    incidentId: string;
    actorUserId?: string | null;
    actorRole: string;
    eventType: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    description: string;
    metadata?: Record<string, unknown> | null;
  }
): Promise<void> {
  await tx.incidentEvent.create({
    data: {
      incidentId: input.incidentId,
      actorUserId: input.actorUserId || null,
      actorRole: input.actorRole,
      eventType: input.eventType,
      previousStatus: input.previousStatus || null,
      newStatus: input.newStatus || null,
      description: input.description.slice(0, 2000),
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function applyIncidentTransition(
  tx: IncidentDb,
  input: {
    incident: { id: string; status: string };
    action: LifecycleAction;
    actor: { id: string; role: string };
    description: string;
    data?: Prisma.IncidentUncheckedUpdateInput;
    metadata?: Record<string, unknown> | null;
    eventType?: string;
  }
): Promise<string> {
  assertActionRole(input.action, input.actor.role);
  const nextStatus = nextStatusForAction(input.incident.status, input.action);
  await tx.incident.update({
    where: { id: input.incident.id },
    data: {
      ...(input.data || {}),
      status: nextStatus,
    },
  });
  await appendIncidentEvent(tx, {
    incidentId: input.incident.id,
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    eventType: input.eventType || input.action,
    previousStatus: input.incident.status,
    newStatus: nextStatus,
    description: input.description,
    metadata: input.metadata,
  });
  return nextStatus;
}

export function parseEventMetadata(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
