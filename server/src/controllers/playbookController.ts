import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  activatePlaybook,
  getPlaybookSummary,
  listPlaybooks,
  suggestPlaybooks,
  templateCatalog,
  updatePlaybookTask,
} from '../services/playbooks/playbookService';

const activateSchema = z.object({
  templateId: z.string().min(1).max(60),
  district: z.string().min(2).max(80).optional(),
  state: z.string().max(80).optional(),
  triggerType: z.enum(['OFFICIAL_ALERT', 'RISK_SCORE', 'MANUAL', 'SIMULATION']).optional(),
  triggerSummary: z.string().max(1000).optional(),
  isSimulation: z.boolean().optional(),
});

const taskSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
  evidence: z.string().max(1000).optional(),
});

export async function getTemplates(req: AuthRequest, res: Response): Promise<void> {
  res.json({ templates: templateCatalog() });
}

export async function getSuggestions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district = String(req.query.district || req.user?.district || 'Mumbai Suburban');
    const state = String(req.query.state || req.user?.state || 'Maharashtra');
    const result = await suggestPlaybooks(district, state);
    res.json({ ...result, district, state });
  } catch (error) {
    console.error('Playbook suggestion error:', error);
    res.status(500).json({ error: 'Failed to generate playbook suggestions.' });
  }
}

export async function listActivations(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district =
      typeof req.query.district === 'string'
        ? req.query.district
        : req.user?.role === 'STATE_EOC' || req.user?.role === 'HEALTH_OFFICER'
          ? undefined
          : req.user?.district;
    const officerView = ['DISTRICT_OFFICER', 'STATE_EOC'].includes(req.user?.role || '');
    const role =
      typeof req.query.role === 'string'
        ? req.query.role
        : officerView
          ? undefined
          : req.user?.role;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const playbooks = await listPlaybooks({ district, role, status });
    res.json({ playbooks });
  } catch (error) {
    console.error('List playbooks error:', error);
    res.status(500).json({ error: 'Failed to list playbooks.' });
  }
}

export async function activate(req: AuthRequest, res: Response): Promise<void> {
  const parsed = activateSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'templateId is required.', details: parsed.error.issues.map((i) => i.message) });
    return;
  }
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const activation = await activatePlaybook({
      ...parsed.data,
      district: parsed.data.district || req.user.district,
      state: parsed.data.state || req.user.state,
      actor: req.user,
    });
    res.status(201).json({
      message: 'Playbook activated. Tasks were created for the assigned roles.',
      playbook: activation,
    });
  } catch (error) {
    res.status((error as any).statusCode || 500).json({ error: (error as Error).message });
  }
}

export async function loadDemoScenario(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const activation = await activatePlaybook({
      templateId: 'flood',
      district: req.user.district || 'Mumbai Suburban',
      state: req.user.state || 'Maharashtra',
      triggerType: 'SIMULATION',
      triggerSummary:
        'SIMULATION: Mumbai flooding tabletop — official-warning workflow, exposure, community reports and response tasks. Not an actual event.',
      isSimulation: true,
      actor: req.user,
    });
    res.status(201).json({
      message: 'SIMULATION loaded. Every generated item is labelled SIMULATION.',
      playbook: activation,
    });
  } catch (error) {
    res.status((error as any).statusCode || 500).json({ error: (error as Error).message });
  }
}

export async function patchTask(req: AuthRequest, res: Response): Promise<void> {
  const parsed = taskSchema.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: 'status (PENDING | IN_PROGRESS | COMPLETED) is required.' });
    return;
  }
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const task = await updatePlaybookTask(req.params.id, parsed.data, req.user);
    res.json({ message: 'Task updated and audit recorded.', task });
  } catch (error) {
    res.status((error as any).statusCode || 500).json({ error: (error as Error).message });
  }
}

export async function summary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const district =
      typeof req.query.district === 'string'
        ? req.query.district
        : req.user?.role === 'STATE_EOC'
          ? undefined
          : req.user?.district;
    res.json(await getPlaybookSummary(district));
  } catch (error) {
    console.error('Playbook summary error:', error);
    res.status(500).json({ error: 'Failed to build playbook summary.' });
  }
}
