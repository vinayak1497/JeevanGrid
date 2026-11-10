import { prisma } from '../../utils/prisma';
import { riskEngineService } from '../riskEngine';
import {
  PLAYBOOK_TEMPLATES,
  PLAYBOOK_TRIGGER_POLICY,
  findTemplate,
  templateForHazard,
  type PlaybookRole,
  type PlaybookTemplate,
} from './playbookTemplates';

export interface PlaybookSuggestion {
  templateId: string;
  hazardType: string;
  name: string;
  summary: string;
  triggerType: 'OFFICIAL_ALERT' | 'RISK_SCORE' | 'SIMULATION';
  triggerSummary: string;
  evidence: Record<string, any>;
  isSimulation: boolean;
}

const suggestionCache = new Map<string, { data: PlaybookSuggestion[]; ts: number }>();
const SUGGESTION_TTL = 10 * 60 * 1000;

const severityRank: Record<string, number> = { INFO: 0, WATCH: 1, WARNING: 2, CRITICAL: 3 };

function meetsSeverity(actual: string, minimum: string): boolean {
  return (severityRank[String(actual || '').toUpperCase()] ?? 0) >= (severityRank[minimum] ?? 99);
}

export function buildAlertSuggestions(
  alerts: Array<{ id: string; title: string; hazardType: string; severity: string; district: string; state: string; issuedAt: Date; source: string; isDemoData: boolean }>
): PlaybookSuggestion[] {
  const byTemplate = new Map<string, PlaybookSuggestion>();
  for (const alert of alerts) {
    const template = templateForHazard(alert.hazardType);
    if (!template) continue;
    if (!meetsSeverity(alert.severity, template.trigger.minimumSeverity)) continue;
    if (byTemplate.has(template.id)) continue;
    byTemplate.set(template.id, {
      templateId: template.id,
      hazardType: template.hazardType,
      name: template.name,
      summary: template.summary,
      triggerType: 'OFFICIAL_ALERT',
      triggerSummary: `${alert.severity} ${alert.hazardType} warning: ${alert.title} (${alert.source}, issued ${alert.issuedAt.toISOString()})`,
      evidence: {
        alertId: alert.id,
        severity: alert.severity,
        hazardType: alert.hazardType,
        source: alert.source,
        issuedAt: alert.issuedAt.toISOString(),
        isDemoData: alert.isDemoData,
      },
      isSimulation: alert.isDemoData,
    });
  }
  return Array.from(byTemplate.values());
}

export async function suggestPlaybooks(district: string, state = 'Maharashtra'): Promise<{
  suggestions: PlaybookSuggestion[];
  triggerPolicy: typeof PLAYBOOK_TRIGGER_POLICY;
  riskAssessment: { score: number; level: string; available: boolean; note: string } | null;
  generatedAt: string;
}> {
  const cacheKey = `${district}|${state}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < SUGGESTION_TTL) {
    const risk = await getRiskSuggestion(district, state);
    return {
      suggestions: [...cached.data, ...risk.suggestions],
      triggerPolicy: PLAYBOOK_TRIGGER_POLICY,
      riskAssessment: risk.riskAssessment,
      generatedAt: new Date().toISOString(),
    };
  }

  const now = new Date();
  const alerts = await prisma.disasterAlert.findMany({
    where: {
      district,
      status: 'ACTIVE',
      sourceType: 'OFFICIAL',
      isVerified: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { issuedAt: 'desc' },
    take: 25,
  });
  const alertSuggestions = buildAlertSuggestions(alerts);
  const risk = await getRiskSuggestion(district, state);
  const suggestions = [...alertSuggestions, ...risk.suggestions];
  suggestionCache.set(cacheKey, { data: alertSuggestions, ts: Date.now() });
  return {
    suggestions,
    triggerPolicy: PLAYBOOK_TRIGGER_POLICY,
    riskAssessment: risk.riskAssessment,
    generatedAt: new Date().toISOString(),
  };
}

async function getRiskSuggestion(district: string, state: string): Promise<{
  suggestions: PlaybookSuggestion[];
  riskAssessment: { score: number; level: string; available: boolean; note: string } | null;
}> {
  try {
    const analysis = await riskEngineService.analyzeLocationRisk(`${district}, ${state}`);
    if (analysis.riskScore < PLAYBOOK_TRIGGER_POLICY.riskScoreAtLeast) {
      return {
        suggestions: [],
        riskAssessment: {
          score: analysis.riskScore,
          level: analysis.overallRiskLevel,
          available: true,
          note: `Below the documented ${PLAYBOOK_TRIGGER_POLICY.riskScoreAtLeast}/100 high-risk trigger.`,
        },
      };
    }
    const hazard = analysis.activeHazards.find((h) => ['High', 'Severe'].includes(h.level)) || analysis.activeHazards[0];
    if (!hazard) {
      return {
        suggestions: [],
        riskAssessment: {
          score: analysis.riskScore,
          level: analysis.overallRiskLevel,
          available: true,
          note: 'High risk score but no hazard-specific trigger was available. Use an official warning or manual activation.',
        },
      };
    }
    const template = templateForHazard(hazard.type);
    if (!template) {
      return {
        suggestions: [],
        riskAssessment: {
          score: analysis.riskScore,
          level: analysis.overallRiskLevel,
          available: true,
          note: `No playbook template is mapped to hazard "${hazard.type}".`,
        },
      };
    }
    return {
      suggestions: [
        {
          templateId: template.id,
          hazardType: template.hazardType,
          name: template.name,
          summary: template.summary,
          triggerType: 'RISK_SCORE',
          triggerSummary: `Deterministic risk score ${analysis.riskScore}/100 (${analysis.overallRiskLevel}) with ${hazard.type} at ${hazard.level}.`,
          evidence: {
            riskScore: analysis.riskScore,
            overallRiskLevel: analysis.overallRiskLevel,
            hazard: hazard.type,
            hazardLevel: hazard.level,
            forecastWindow: analysis.forecastWindow,
            thresholds: PLAYBOOK_TRIGGER_POLICY,
          },
          isSimulation: analysis.isDemoData,
        },
      ],
      riskAssessment: {
        score: analysis.riskScore,
        level: analysis.overallRiskLevel,
        available: true,
        note: 'Deterministic JeevanGrid risk score; not a forecast of certainty.',
      },
    };
  } catch (e) {
    return {
      suggestions: [],
      riskAssessment: {
        score: 0,
        level: 'UNKNOWN',
        available: false,
        note: `Risk engine unavailable: ${(e as Error).message.slice(0, 120)}. Use an official warning or manual activation.`,
      },
    };
  }
}

export async function activatePlaybook(input: {
  templateId: string;
  district: string;
  state?: string;
  triggerType?: 'OFFICIAL_ALERT' | 'RISK_SCORE' | 'MANUAL' | 'SIMULATION';
  triggerSummary?: string;
  isSimulation?: boolean;
  actor?: { id: string; role: string; name?: string };
}): Promise<any> {
  const template = findTemplate(input.templateId);
  if (!template) throw Object.assign(new Error('Playbook template not found.'), { statusCode: 404 });
  if (!input.district || input.district.trim().length < 2) {
    throw Object.assign(new Error('District is required to activate a playbook.'), { statusCode: 400 });
  }
  const isSimulation = Boolean(input.isSimulation || input.triggerType === 'SIMULATION');
  const triggerType = isSimulation ? 'SIMULATION' : input.triggerType || 'MANUAL';
  const now = new Date();

  const activation = await prisma.playbookActivation.create({
    data: {
      templateId: template.id,
      hazardType: template.hazardType,
      triggerType,
      triggerSummary: (input.triggerSummary || 'Manually reviewed and activated by an officer.').slice(0, 1000),
      district: input.district,
      state: input.state || 'Maharashtra',
      status: 'ACTIVE',
      activatedById: input.actor?.id || null,
      activatedByName: input.actor?.name || null,
      isSimulation,
      tasks: {
        create: template.tasks.map((task) => ({
          role: task.role,
          title: task.title,
          description: task.description,
          dueBy: new Date(now.getTime() + task.dueHours * 60 * 60 * 1000),
        })),
      },
      audit: {
        create: {
          action: 'ACTIVATED',
          actorId: input.actor?.id || null,
          actorRole: input.actor?.role || null,
          note: `${template.name} activated${isSimulation ? ' as a labelled SIMULATION' : ''}. Trigger: ${triggerType}.`,
        },
      },
    },
    include: { tasks: true, audit: true },
  });
  return shapeActivation(activation);
}

export function shapeTask(task: any): any {
  const overdue = !['COMPLETED'].includes(task.status) && task.dueBy && new Date(task.dueBy).getTime() < Date.now();
  return {
    id: task.id,
    role: task.role,
    title: task.title,
    description: task.description,
    dueBy: task.dueBy,
    status: overdue ? 'OVERDUE' : task.status,
    storedStatus: task.status,
    overdue: Boolean(overdue),
    evidence: task.evidence,
    completedByName: task.completedByName,
    completedAt: task.completedAt,
  };
}

export function shapeActivation(activation: any, role?: string): any {
  const tasks = (activation.tasks || []).map(shapeTask);
  const visibleTasks = role ? tasks.filter((t: any) => t.role === role) : tasks;
  const completed = tasks.filter((t: any) => t.status === 'COMPLETED').length;
  return {
    id: activation.id,
    templateId: activation.templateId,
    hazardType: activation.hazardType,
    triggerType: activation.triggerType,
    triggerSummary: activation.triggerSummary,
    district: activation.district,
    state: activation.state,
    status: activation.status,
    isSimulation: activation.isSimulation,
    activatedByName: activation.activatedByName,
    createdAt: activation.createdAt,
    updatedAt: activation.updatedAt,
    progress: {
      total: tasks.length,
      completed,
      overdue: tasks.filter((t: any) => t.status === 'OVERDUE').length,
      percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    },
    tasks: visibleTasks,
    audit: activation.audit,
    note: activation.isSimulation
      ? 'SIMULATION — training scenario, not an actual government activation.'
      : 'Internal preparedness task list. This is not a government order.',
  };
}

export async function listPlaybooks(input: {
  district?: string;
  role?: string;
  status?: string;
  includeSimulations?: boolean;
}): Promise<any> {
  const activations = await prisma.playbookActivation.findMany({
    where: {
      ...(input.district ? { district: input.district } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.includeSimulations === false ? { isSimulation: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      tasks: { orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] },
      audit: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  const shaped = activations.map((a) => shapeActivation(a, input.role));
  return input.role ? shaped.filter((a) => a.tasks.length > 0) : shaped;
}

export async function updatePlaybookTask(
  taskId: string,
  update: { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'; evidence?: string },
  actor: { id: string; role: string; name?: string }
): Promise<any> {
  const task = await prisma.playbookTask.findUnique({ where: { id: taskId }, include: { activation: true } });
  if (!task) throw Object.assign(new Error('Playbook task not found.'), { statusCode: 404 });
  const privileged = ['DISTRICT_OFFICER', 'STATE_EOC'].includes(actor.role);
  if (!privileged && task.role !== actor.role) {
    throw Object.assign(new Error(`This task is assigned to ${task.role}; your role cannot update it.`), { statusCode: 403 });
  }
  if (task.status === 'COMPLETED' && update.status !== 'COMPLETED') {
    throw Object.assign(new Error('Completed tasks cannot be reopened from the field view.'), { statusCode: 409 });
  }
  if (update.status === 'COMPLETED' && (!update.evidence || update.evidence.trim().length < 3)) {
    throw Object.assign(new Error('Completion evidence (at least 3 characters) is required.'), { statusCode: 400 });
  }

  const updated = await prisma.playbookTask.update({
    where: { id: taskId },
    data: {
      status: update.status,
      evidence: update.evidence ? update.evidence.slice(0, 1000) : task.evidence,
      completedById: update.status === 'COMPLETED' ? actor.id : null,
      completedByName: update.status === 'COMPLETED' ? actor.name || actor.role : null,
      completedAt: update.status === 'COMPLETED' ? new Date() : null,
    },
  });

  await prisma.playbookAudit.create({
    data: {
      activationId: task.activationId,
      action: update.status === 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_IN_PROGRESS',
      actorId: actor.id,
      actorRole: actor.role,
      note: `${task.title}: ${update.status}${update.evidence ? ` — ${update.evidence.slice(0, 300)}` : ''}`,
    },
  });

  const remaining = await prisma.playbookTask.count({
    where: { activationId: task.activationId, status: { not: 'COMPLETED' } },
  });
  if (remaining === 0 && task.activation.status === 'ACTIVE') {
    await prisma.playbookActivation.update({ where: { id: task.activationId }, data: { status: 'COMPLETED' } });
    await prisma.playbookAudit.create({
      data: {
        activationId: task.activationId,
        action: 'COMPLETED',
        actorId: actor.id,
        actorRole: actor.role,
        note: 'All playbook tasks completed.',
      },
    });
  }
  return shapeTask(updated);
}

export async function getPlaybookSummary(district?: string): Promise<any> {
  const activations = await prisma.playbookActivation.findMany({
    where: { ...(district ? { district } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { tasks: true },
  });
  const active = activations.filter((a) => a.status === 'ACTIVE');
  const tasks = activations.flatMap((a) => a.tasks.map(shapeTask));
  const byRole: Record<string, { total: number; completed: number; overdue: number }> = {};
  for (const t of tasks) {
    byRole[t.role] = byRole[t.role] || { total: 0, completed: 0, overdue: 0 };
    byRole[t.role].total += 1;
    if (t.status === 'COMPLETED') byRole[t.role].completed += 1;
    if (t.status === 'OVERDUE') byRole[t.role].overdue += 1;
  }
  return {
    activePlaybooks: active.length,
    completedPlaybooks: activations.filter((a) => a.status === 'COMPLETED').length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === 'COMPLETED').length,
    overdueTasks: tasks.filter((t) => t.status === 'OVERDUE').length,
    byRole,
    recent: activations.slice(0, 10).map((a) => shapeActivation(a)),
    triggerPolicy: PLAYBOOK_TRIGGER_POLICY,
  };
}

export function roleTaskCount(template: PlaybookTemplate, role: PlaybookRole): number {
  return template.tasks.filter((t) => t.role === role).length;
}

export function templateCatalog(): any[] {
  return PLAYBOOK_TEMPLATES.map((t) => ({
    ...t,
    taskCount: t.tasks.length,
    roles: Array.from(new Set(t.tasks.map((task) => task.role))),
  }));
}
