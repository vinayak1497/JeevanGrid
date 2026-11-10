import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  DataCaveat,
  EmptyState,
  Metric,
  SectionCard,
  StatusBadge,
  formatDateTime,
  primaryButton,
  secondaryButton,
} from './IntelligenceUI';

const ROLE_LABELS: Record<string, string> = {
  DISTRICT_OFFICER: 'District Officer',
  STATE_EOC: 'State EOC',
  HEALTH_OFFICER: 'Health Officer',
  FIELD_RESPONDER: 'Field Responder',
  COMMUNITY_VOLUNTEER: 'Community Volunteer',
};

function taskTone(status: string): 'primary' | 'warning' | 'danger' | 'neutral' {
  if (status === 'COMPLETED') return 'primary';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'OVERDUE') return 'danger';
  return 'neutral';
}

export const PlaybookPanel: React.FC<{
  district?: string;
  initialSummary?: any;
  onChanged?: () => void;
}> = ({ district, initialSummary, onChanged }) => {
  const { user } = useAuth();
  const role = user?.role || 'CITIZEN';
  const officer = role === 'DISTRICT_OFFICER' || role === 'STATE_EOC';
  const [templates, setTemplates] = useState<any[]>([]);
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionPayload, setSuggestionPayload] = useState<any>(null);
  const [summary, setSummary] = useState<any>(initialSummary || null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualTemplateId, setManualTemplateId] = useState('');
  const [manualSimulation, setManualSimulation] = useState(false);
  const [evidence, setEvidence] = useState<Record<string, string>>({});

  const districtQuery = district ? `?district=${encodeURIComponent(district)}` : '';

  const load = async () => {
    setError(null);
    try {
      const [templateResponse, playbookResponse] = await Promise.all([
        apiFetch<{ templates: any[] }>('/playbooks/templates'),
        apiFetch<{ playbooks: any[] }>(`/playbooks${districtQuery}`),
      ]);
      setTemplates(templateResponse.templates || []);
      setPlaybooks(playbookResponse.playbooks || []);
      if (!manualTemplateId && templateResponse.templates?.[0]?.id) {
        setManualTemplateId(templateResponse.templates[0].id);
      }
      if (officer) {
        const [suggestionResponse, summaryResponse] = await Promise.allSettled([
          apiFetch<any>(`/playbooks/suggestions${districtQuery}`),
          apiFetch<any>(`/playbooks/summary${districtQuery}`),
        ]);
        if (suggestionResponse.status === 'fulfilled') {
          setSuggestions(suggestionResponse.value.suggestions || []);
          setSuggestionPayload(suggestionResponse.value);
        } else {
          setSuggestions([]);
          setSuggestionPayload(null);
        }
        if (summaryResponse.status === 'fulfilled') setSummary(summaryResponse.value);
      }
    } catch (err: any) {
      setError(err.message || 'Playbooks are unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  const templateById = useMemo(() => {
    const map: Record<string, any> = {};
    for (const template of templates) map[template.id] = template;
    return map;
  }, [templates]);

  const derivedSummary = useMemo(() => {
    if (summary && officer) return summary;
    const tasks = playbooks.flatMap((p) => p.tasks || []);
    return {
      activePlaybooks: playbooks.filter((p) => p.status === 'ACTIVE').length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === 'COMPLETED').length,
      overdueTasks: tasks.filter((t) => t.status === 'OVERDUE').length,
      byRole: {},
      recent: playbooks.slice(0, 10),
    };
  }, [summary, officer, playbooks]);

  const activate = async (payload: any, key: string) => {
    setBusy(key);
    setNotice(null);
    setError(null);
    try {
      const response = await apiFetch<any>('/playbooks/activate', {
        method: 'POST',
        body: JSON.stringify({ ...payload, district, state: user?.state }),
      });
      setNotice(response.message);
      await load();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Playbook activation failed.');
    } finally {
      setBusy(null);
    }
  };

  const loadDemo = async () => {
    setBusy('demo');
    setNotice(null);
    setError(null);
    try {
      const response = await apiFetch<any>('/playbooks/demo-scenario', { method: 'POST' });
      setNotice(response.message);
      await load();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Could not load the simulation.');
    } finally {
      setBusy(null);
    }
  };

  const updateTask = async (task: any, status: 'IN_PROGRESS' | 'COMPLETED') => {
    const taskEvidence = (evidence[task.id] || '').trim();
    if (status === 'COMPLETED' && taskEvidence.length < 3) {
      setNotice('Record completion evidence (at least 3 characters) before marking this task complete.');
      return;
    }
    setBusy(task.id);
    setNotice(null);
    setError(null);
    try {
      const response = await apiFetch<any>(`/playbooks/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, evidence: taskEvidence || undefined }),
      });
      setNotice(response.message);
      setEvidence((current) => ({ ...current, [task.id]: '' }));
      await load();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Task update failed.');
    } finally {
      setBusy(null);
    }
  };

  const activeCount = Number(derivedSummary.activePlaybooks || 0);
  const totalTasks = Number(derivedSummary.totalTasks || 0);
  const completedTasks = Number(derivedSummary.completedTasks || 0);
  const overdueTasks = Number(derivedSummary.overdueTasks || 0);

  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric label="Active playbooks" value={activeCount} tone="primary" />
        <Metric label="Total tasks" value={totalTasks} tone="neutral" />
        <Metric label="Completed" value={completedTasks} tone="primary" />
        <Metric label="Overdue" value={overdueTasks} tone={overdueTasks > 0 ? 'danger' : 'neutral'} />
      </div>

      {notice && (
        <div className="rounded-lg bg-[#e9f3ed] border border-primary/20 px-3 py-2 text-[11px] font-semibold text-primary">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-[11px] font-semibold">
          {error}
        </div>
      )}

      {officer && (
        <SectionCard
          title="Trigger suggestions"
          subtitle="Deterministic signals only. A suggestion is not an order."
          icon="bolt"
          actions={
            <button type="button" onClick={loadDemo} disabled={busy === 'demo'} className={secondaryButton}>
              <span className="material-symbols-outlined text-[15px]">science</span>
              {busy === 'demo' ? 'Loading…' : 'Load labelled SIMULATION'}
            </button>
          }
        >
          {loading ? (
            <p className="text-xs text-on-surface-variant">Checking official warnings and risk score…</p>
          ) : suggestions.length === 0 ? (
            <EmptyState
              icon="rule"
              title="No active trigger"
              body="No verified official warning or high-risk score currently meets a playbook trigger. Do not invent one; an officer may start a manual internal task list below."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {suggestions.map((suggestion) => (
                <div
                  key={`${suggestion.templateId}-${suggestion.triggerType}`}
                  className={`rounded-xl border px-3 py-2.5 ${
                    suggestion.isSimulation
                      ? 'border-[#fbbf24] bg-[#fffbeb]'
                      : 'border-outline-variant/40 bg-surface-container-low'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge tone={suggestion.isSimulation ? 'simulation' : 'primary'}>
                        {suggestion.triggerType.replace(/_/g, ' ')}
                      </StatusBadge>
                      {suggestion.isSimulation && <StatusBadge tone="simulation">SIMULATION</StatusBadge>}
                      <span className="text-[12px] font-bold text-on-surface">{suggestion.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        activate(
                          {
                            templateId: suggestion.templateId,
                            triggerType: suggestion.isSimulation ? 'SIMULATION' : suggestion.triggerType,
                            triggerSummary: suggestion.triggerSummary,
                            isSimulation: suggestion.isSimulation,
                          },
                          `suggest-${suggestion.templateId}`
                        )
                      }
                      disabled={busy === `suggest-${suggestion.templateId}`}
                      className={primaryButton}
                    >
                      Review & activate
                    </button>
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1">{suggestion.triggerSummary}</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">{suggestion.summary}</p>
                </div>
              ))}
              {suggestionPayload?.riskAssessment && (
                <DataCaveat tone={suggestionPayload.riskAssessment.available ? 'info' : 'warning'}>
                  Risk score: <strong>{suggestionPayload.riskAssessment.score}/100</strong>{' '}
                  ({suggestionPayload.riskAssessment.level}) · {suggestionPayload.riskAssessment.note}
                </DataCaveat>
              )}
              <p className="text-[10px] text-on-surface-variant">
                Trigger policy: {suggestionPayload?.triggerPolicy?.note || 'Risk score ≥ 60 or a WARNING/CRITICAL official warning.'}
              </p>
            </div>
          )}
        </SectionCard>
      )}

      {officer && (
        <SectionCard
          title="Manual activation"
          subtitle="Creates an internal JeevanGrid task list. It is not a government order or dispatch."
          icon="assignment_add"
        >
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] font-bold" htmlFor="manual-template">Template</label>
              <select
                id="manual-template"
                value={manualTemplateId}
                onChange={(e) => setManualTemplateId(e.target.value)}
                className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-[10.5px] font-semibold pb-2">
              <input
                type="checkbox"
                checked={manualSimulation}
                onChange={(e) => setManualSimulation(e.target.checked)}
              />
              Training / simulation
            </label>
            <button
              type="button"
              onClick={() =>
                activate(
                  {
                    templateId: manualTemplateId,
                    triggerType: manualSimulation ? 'SIMULATION' : 'MANUAL',
                    triggerSummary: manualSimulation
                      ? 'SIMULATION: officer-started training task list. Not an actual event.'
                      : 'Manually reviewed and activated by an authorised officer.',
                    isSimulation: manualSimulation,
                  },
                  'manual'
                )
              }
              disabled={!manualTemplateId || busy === 'manual'}
              className={primaryButton}
            >
              <span className="material-symbols-outlined text-[15px]">playlist_add</span>
              Activate task list
            </button>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2">
            Task completion requires recorded evidence. Nugen or any AI cannot activate a playbook.
          </p>
        </SectionCard>
      )}

      <SectionCard
        title="Active and recent playbooks"
        subtitle={
          officer
            ? 'All roles across the district. Tasks show recorded evidence and overdue status.'
            : `Your ${ROLE_LABELS[role] || role} tasks only.`
        }
        icon="checklist"
        actions={
          <button type="button" onClick={load} disabled={loading} className={secondaryButton}>
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            Refresh
          </button>
        }
      >
        {loading ? (
          <p className="text-xs text-on-surface-variant">Loading playbooks…</p>
        ) : playbooks.length === 0 ? (
          <EmptyState
            icon="playlist_remove"
            title="No playbooks activated"
            body={
              officer
                ? 'Activate a suggested or manual template. A labelled simulation is available for demonstrations.'
                : 'No tasks are currently assigned to your role.'
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {playbooks.map((playbook) => {
              const template = templateById[playbook.templateId];
              return (
                <article
                  key={playbook.id}
                  className={`rounded-xl border overflow-hidden ${
                    playbook.isSimulation
                      ? 'border-[#fbbf24] bg-[#fffbeb]'
                      : 'border-outline-variant/40 bg-surface-container-lowest'
                  }`}
                >
                  <div className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-bold text-on-surface">
                          {template?.name || playbook.hazardType}
                        </span>
                        <StatusBadge tone={playbook.status === 'ACTIVE' ? 'primary' : 'neutral'}>
                          {playbook.status}
                        </StatusBadge>
                        {playbook.isSimulation && <StatusBadge tone="simulation">SIMULATION</StatusBadge>}
                        <StatusBadge tone="neutral">{playbook.triggerType.replace(/_/g, ' ')}</StatusBadge>
                      </div>
                      <span className="text-[10px] text-on-surface-variant">
                        Activated {formatDateTime(playbook.createdAt)}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-on-surface-variant mt-1">{playbook.triggerSummary}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className={`h-full rounded-full ${playbook.isSimulation ? 'bg-[#b45309]' : 'bg-primary'}`}
                          style={{ width: `${playbook.progress?.percent || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold font-code-num">
                        {playbook.progress?.completed || 0}/{playbook.progress?.total || 0}
                      </span>
                      {playbook.progress?.overdue > 0 && (
                        <StatusBadge tone="danger">{playbook.progress.overdue} overdue</StatusBadge>
                      )}
                    </div>
                    {playbook.note && <p className="text-[10px] text-on-surface-variant mt-1">{playbook.note}</p>}
                  </div>

                  <div className="border-t border-outline-variant/30 divide-y divide-outline-variant/20">
                    {(playbook.tasks || []).map((task: any) => {
                      const canAct = officer || task.role === role;
                      const isBusy = busy === task.id;
                      return (
                        <div key={task.id} className="px-3 py-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-1.5">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <StatusBadge tone={taskTone(task.status)}>{task.status}</StatusBadge>
                                <StatusBadge tone="neutral">{ROLE_LABELS[task.role] || task.role}</StatusBadge>
                                {task.overdue && <StatusBadge tone="danger">Overdue</StatusBadge>}
                              </div>
                              <div className="text-[11.5px] font-bold text-on-surface mt-1">{task.title}</div>
                              <p className="text-[10.5px] text-on-surface-variant">{task.description}</p>
                            </div>
                            <span className="text-[10px] text-on-surface-variant sm:whitespace-nowrap">
                              Due {formatDateTime(task.dueBy)}
                            </span>
                          </div>
                          {task.evidence && (
                            <p className="mt-1.5 rounded bg-[#e9f3ed] px-2 py-1 text-[10.5px] text-primary">
                              <strong>Evidence:</strong> {task.evidence}
                              {task.completedByName ? ` — ${task.completedByName}` : ''}
                            </p>
                          )}
                          {canAct && task.status !== 'COMPLETED' && (
                            <div className="mt-2 flex flex-col sm:flex-row gap-1.5 sm:items-center">
                              <input
                                value={evidence[task.id] || ''}
                                onChange={(e) =>
                                  setEvidence((current) => ({ ...current, [task.id]: e.target.value }))
                                }
                                placeholder="Completion evidence (required to complete)"
                                aria-label={`Evidence for ${task.title}`}
                                className="h-11 min-w-0 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs flex-1"
                              />
                              {task.storedStatus === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => updateTask(task, 'IN_PROGRESS')}
                                  disabled={isBusy}
                                  className={secondaryButton}
                                >
                                  Start
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => updateTask(task, 'COMPLETED')}
                                disabled={isBusy}
                                className={primaryButton}
                              >
                                {isBusy ? 'Saving…' : 'Mark complete'}
                              </button>
                            </div>
                          )}
                          {task.status === 'COMPLETED' && (
                            <p className="text-[10px] text-primary mt-1">
                              Completed {formatDateTime(task.completedAt)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <DataCaveat tone="warning">
        Playbooks are internal preparedness checklists. They do not issue official warnings, order an
        evacuation, or dispatch any team. Only a human officer can decide and communicate a real
        evacuation.
      </DataCaveat>
    </div>
  );
};
