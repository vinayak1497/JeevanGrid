import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface CheckInForm {
  source: 'GPS' | 'MANUAL';
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  note: string;
}

interface ResolutionForm {
  workCompleted: string;
  situationAfter: string;
  peopleAssisted: number;
  remainingProblems: string;
  medicalRequired: boolean;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
}

const EMPTY_CHECK_IN: CheckInForm = {
  source: 'GPS',
  latitude: null,
  longitude: null,
  accuracyM: null,
  note: '',
};

const EMPTY_RESOLUTION: ResolutionForm = {
  workCompleted: '',
  situationAfter: '',
  peopleAssisted: 0,
  remainingProblems: '',
  medicalRequired: false,
  notes: '',
  latitude: null,
  longitude: null,
  accuracyM: null,
};

export const ResponderDashboard: React.FC = () => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<CheckInForm>(EMPTY_CHECK_IN);
  const [resolution, setResolution] = useState<ResolutionForm>(EMPTY_RESOLUTION);
  const [actionBusy, setActionBusy] = useState(false);

  const loadTasks = async () => {
    try {
      const res = await apiFetch<{ incidents?: any[] }>('/incidents');
      const all = res.incidents || [];
      const tasks = all.filter((i) => i.assignedToId === user?.id);
      setIncidents(tasks);
      if (!loading) {
        setSelectedTask((current: any) => {
          const next =
            (current && tasks.find((i) => i.id === current.id)) ||
            tasks.find((i) => ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'].includes(i.status)) ||
            tasks[0] ||
            null;
          return next || null;
        });
      }
    } catch (error) {
      console.error('Failed to load responder tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
    const interval = window.setInterval(() => void loadTasks(), 15_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSelected = (incident: any) => {
    if (incident) setSelectedTask(incident);
  };

  const callAction = async (endpoint: string, method: 'PATCH' | 'POST', body: Record<string, unknown>) => {
    const res = await apiFetch<any>(endpoint, { method, body: JSON.stringify(body) });
    setActionMessage(String(res?.message || 'Field response recorded.'));
    setSelectedTask(res?.incident || selectedTask);
    return res;
  };

  const handleAccept = async () => {
    if (!selectedTask) return;
    setActionBusy(true);
    const res = await callAction(`/incidents/${selectedTask.id}/responder-action`, 'PATCH', { action: 'ACCEPT' });
    if (res) updateSelected(res.incident);
    setActionBusy(false);
  };

  const handleEnRoute = async () => {
    if (!selectedTask) return;
    setActionBusy(true);
    const res = await callAction(`/incidents/${selectedTask.id}/responder-action`, 'PATCH', { action: 'EN_ROUTE' });
    if (res) updateSelected(res.incident);
    setActionBusy(false);
  };

  const handleStart = async () => {
    if (!selectedTask) return;
    setActionBusy(true);
    const res = await callAction(`/incidents/${selectedTask.id}/responder-action`, 'PATCH', { action: 'START' });
    if (res) updateSelected(res.incident);
    setActionBusy(false);
  };

  const handleCheckIn = async () => {
    if (!selectedTask) return;
    if (checkIn.source === 'MANUAL' && checkIn.note.trim().length < 5) {
      setActionMessage('Manual check-in needs a short explanation.');
      return;
    }
    if (checkIn.source === 'GPS' && (!checkIn.latitude || !checkIn.longitude)) {
      setActionMessage('GPS check-in needs valid coordinates.');
      return;
    }
    setActionBusy(true);
    const res = await callAction(`/incidents/${selectedTask.id}/check-in`, 'POST', {
      source: checkIn.source,
      latitude: checkIn.latitude,
      longitude: checkIn.longitude,
      accuracyM: checkIn.accuracyM,
      note: checkIn.note.trim() || null,
    });
    setCheckIn(EMPTY_CHECK_IN);
    setActionBusy(false);
  };

  const handleSubmitResolution = async () => {
    if (!selectedTask) return;
    if (selectedTask.status !== 'IN_PROGRESS') {
      setActionMessage('The responder must start work before submitting a resolution.');
      return;
    }
    if (resolution.workCompleted.trim().length < 5) {
      setActionMessage('Work completed must be at least 5 characters.');
      return;
    }
    if (resolution.situationAfter.trim().length < 3) {
      setActionMessage('Situation after the response is required.');
      return;
    }
    setActionBusy(true);
    const res = await apiFetch<any>(`/incidents/${selectedTask.id}/resolution`, {
      method: 'POST',
      body: JSON.stringify({
        workCompleted: resolution.workCompleted,
        situationAfter: resolution.situationAfter,
        peopleAssisted: resolution.peopleAssisted,
        remainingProblems: resolution.remainingProblems || null,
        medicalRequired: resolution.medicalRequired,
        notes: resolution.notes || null,
        latitude: resolution.latitude,
        longitude: resolution.longitude,
        accuracyM: resolution.accuracyM,
      }),
    });
    setActionMessage(String(res?.message || 'Resolution submitted for DDMA review.'));
    setSelectedTask(res?.incident || selectedTask);
    setActionBusy(false);
  };

  const handleSituationUpdate = async () => {
    if (!selectedTask) return;
    if (selectedTask.status !== 'ON_SITE' && selectedTask.status !== 'IN_PROGRESS') {
      setActionMessage('Situation updates require an on-site responder.');
      return;
    }
    if (selectedTask.status !== 'IN_PROGRESS') {
      await handleStart();
    }
    setActionBusy(true);
    const res = await apiFetch<any>('/field-reports', {
      method: 'POST',
      body: JSON.stringify({
        incidentId: selectedTask.id,
        situationReport: 'Responder situation update during active response.',
        casualtiesRescued: 0,
        medicalRequired: false,
        notes: 'Situation update.',
      }),
    });
    setActionMessage(String(res?.message || 'Situation update recorded.'));
    setActionBusy(false);
  };

  if (loading) {
    return (
      <main className="jg-page flex min-h-[70dvh] items-center justify-center text-center text-xs text-on-surface-variant">
        Loading field responder tasks...
      </main>
    );
  }

  const status = selectedTask?.status || 'ASSIGNED';

  return (
    <main className="jg-page min-h-[100dvh] bg-surface pb-space-3xl">
      <div className="mx-auto max-w-container-max px-margin-mobile lg:px-margin-desktop">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">
              Field Operations
            </p>
            <h1 className="mt-1 font-headline-xl text-2xl font-bold tracking-tight text-on-surface">
              Field Responder Dashboard
            </h1>
            <p className="mt-1 text-xs text-on-surface-variant">
              Explicit field lifecycle: accept, travel, check in, work, submit, and await DDMA review.
            </p>
          </div>

          {actionMessage && (
            <div className="rounded-xl border border-secondary/40 bg-secondary-container/20 p-3 text-xs font-bold text-on-surface" role="status">
              {actionMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
            <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm xl:col-span-5">
              <h2 className="text-sm font-bold text-on-surface">Assigned tasks</h2>
              <div className="mt-3 flex flex-col gap-2 xl:max-h-[560px] xl:overflow-y-auto">
                {incidents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-4 py-10 text-center">
                    <span className="material-symbols-outlined text-[26px] text-on-surface-variant" aria-hidden="true">inbox</span>
                    <p className="mt-1 text-xs font-bold text-on-surface">No active assignments</p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">
                      Accept an assigned verified incident from the DDMA queue.
                    </p>
                  </div>
                ) : (
                  incidents.map((incident: any) => (
                    <button
                      key={incident.id}
                      type="button"
                      onClick={() => updateSelected(incident)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        selectedTask?.id === incident.id
                          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
                          : 'border-outline-variant/25 bg-surface-container-low hover:border-outline-variant/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-code-num text-[11px] font-bold text-primary">
                          {incident.referenceCode || incident.id}
                        </span>
                        <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                          {statusLabel(incident.status)}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs font-bold text-on-surface">{incident.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">{incident.locationName}</p>
                      <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">
                        Urgency: {incident.urgency} · Assigned by DDMA
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm xl:col-span-7">
              {selectedTask ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 border-b border-outline-variant/20 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Field ticket</span>
                      <h2 className="mt-0.5 text-lg font-bold leading-snug text-on-surface">{selectedTask.title}</h2>
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">{selectedTask.locationName}</p>
                    </div>
                    <span className="inline-flex self-start items-center rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-primary">
                      {statusLabel(status)}
                    </span>
                  </div>

                  <p className="rounded-xl border-l-2 border-primary/30 bg-surface-container-low px-3 py-3 text-xs leading-relaxed text-on-surface">
                    {selectedTask.description}
                  </p>

                  <div className="flex flex-wrap gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low p-3">
                    {status === 'ASSIGNED' && (
                      <button type="button" onClick={() => void handleAccept()} disabled={actionBusy} className="inline-flex min-h-[38px] items-center rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-on-secondary transition-colors hover:bg-secondary-container disabled:opacity-50">
                        Accept assignment
                      </button>
                    )}
                    {status === 'ACCEPTED' && (
                      <button type="button" onClick={() => void handleEnRoute()} disabled={actionBusy} className="inline-flex min-h-[38px] items-center rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-on-secondary transition-colors hover:bg-secondary-container disabled:opacity-50">
                        Mark en route
                      </button>
                    )}
                    {status === 'EN_ROUTE' && (
                      <button type="button" onClick={() => void handleCheckIn()} disabled={actionBusy} className="inline-flex min-h-[38px] items-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50">
                        Check in on site
                      </button>
                    )}
                    {status === 'ON_SITE' && (
                      <button type="button" onClick={() => void handleStart()} disabled={actionBusy} className="inline-flex min-h-[38px] items-center rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-on-secondary transition-colors hover:bg-secondary-container disabled:opacity-50">
                        Start work
                      </button>
                    )}
                    {status === 'IN_PROGRESS' && (
                      <>
                        <button type="button" onClick={() => void handleSituationUpdate()} disabled={actionBusy} className="inline-flex min-h-[38px] items-center rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-50">
                          Situation update
                        </button>
                        <button type="button" onClick={() => void handleSubmitResolution()} disabled={actionBusy} className="inline-flex min-h-[38px] items-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50">
                          Submit resolution
                        </button>
                      </>
                    )}
                    {status === 'RESOLVED_PENDING_REVIEW' && (
                      <span className="inline-flex items-center rounded-lg bg-secondary-container px-3 py-2 text-xs font-bold text-on-secondary-container">
                        Awaiting DDMA resolution review
                      </span>
                    )}
                    {status === 'RESOLVED' && (
                      <span className="inline-flex items-center rounded-lg bg-surface-container-high px-3 py-2 text-xs font-bold text-on-surface">
                        Incident resolved — review outcome recorded
                      </span>
                    )}
                  </div>

                  {status === 'EN_ROUTE' && (
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
                      <h3 className="text-xs font-bold text-on-surface">On-site check-in</h3>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="block text-[11px] font-bold text-on-surface-variant">
                          Source
                          <select
                            value={checkIn.source}
                            onChange={(e) => setCheckIn((p) => ({ ...p, source: e.target.value as CheckInForm['source'] }))}
                            className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface"
                          >
                            <option value="GPS">GPS</option>
                            <option value="MANUAL">Manual</option>
                          </select>
                        </label>
                        <label className="block text-[11px] font-bold text-on-surface-variant">
                          Accuracy (m)
                          <input
                            type="number"
                            min={0}
                            value={checkIn.accuracyM ?? ''}
                            onChange={(e) => setCheckIn((p) => ({ ...p, accuracyM: e.target.value === '' ? null : Number(e.target.value) }))}
                            className="mt-1 h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs text-on-surface"
                          />
                        </label>
                      </div>
                      {checkIn.source === 'GPS' && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input
                            type="number"
                            step="any"
                            value={checkIn.latitude ?? ''}
                            onChange={(e) => setCheckIn((p) => ({ ...p, latitude: e.target.value === '' ? null : Number(e.target.value) }))}
                            placeholder="Latitude"
                            className="h-10 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs text-on-surface"
                          />
                          <input
                            type="number"
                            step="any"
                            value={checkIn.longitude ?? ''}
                            onChange={(e) => setCheckIn((p) => ({ ...p, longitude: e.target.value === '' ? null : Number(e.target.value) }))}
                            placeholder="Longitude"
                            className="h-10 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs text-on-surface"
                          />
                        </div>
                      )}
                      {checkIn.source === 'MANUAL' && (
                        <label className="mt-2 block text-[11px] font-bold text-on-surface-variant">
                          Check-in note
                          <textarea
                            value={checkIn.note}
                            onChange={(e) => setCheckIn((p) => ({ ...p, note: e.target.value }))}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface"
                          />
                        </label>
                      )}
                      <button type="button" onClick={() => void handleCheckIn()} disabled={actionBusy} className="mt-3 inline-flex min-h-[38px] items-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50">
                        Record check-in
                      </button>
                    </div>
                  )}

                  {status === 'IN_PROGRESS' && (
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
                      <h3 className="text-xs font-bold text-on-surface">Submit resolution</h3>
                      <label className="mt-2 block text-[11px] font-bold text-on-surface-variant">
                        Work completed
                        <textarea
                          value={resolution.workCompleted}
                          onChange={(e) => setResolution((p) => ({ ...p, workCompleted: e.target.value }))}
                          rows={3}
                          className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface"
                        />
                      </label>
                      <label className="mt-2 block text-[11px] font-bold text-on-surface-variant">
                        Situation after response
                        <textarea
                          value={resolution.situationAfter}
                          onChange={(e) => setResolution((p) => ({ ...p, situationAfter: e.target.value }))}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-xs text-on-surface"
                        />
                      </label>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <label className="block text-[11px] font-bold text-on-surface-variant">
                          People assisted
                          <input
                            type="number"
                            min={0}
                            value={resolution.peopleAssisted}
                            onChange={(e) => setResolution((p) => ({ ...p, peopleAssisted: Number(e.target.value) || 0 }))}
                            className="mt-1 h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs text-on-surface"
                          />
                        </label>
                        <label className="block text-[11px] font-bold text-on-surface-variant">
                          Remaining problems
                          <input
                            value={resolution.remainingProblems}
                            onChange={(e) => setResolution((p) => ({ ...p, remainingProblems: e.target.value }))}
                            className="mt-1 h-10 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs text-on-surface"
                          />
                        </label>
                        <label className="block text-[11px] font-bold text-on-surface-variant">
                          Medical required
                          <input
                            type="checkbox"
                            checked={resolution.medicalRequired}
                            onChange={(e) => setResolution((p) => ({ ...p, medicalRequired: e.target.checked }))}
                            className="mt-2 h-10 w-full"
                          />
                        </label>
                      </div>
                      <button type="button" onClick={() => void handleSubmitResolution()} disabled={actionBusy} className="mt-3 inline-flex min-h-[38px] items-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50">
                        Submit for DDMA review
                      </button>
                      <p className="mt-2 text-[11px] font-semibold text-on-surface-variant">
                        Submission requests review; it does not close the incident.
                      </p>
                    </div>
                  )}

                  <div className="border-t border-outline-variant/20 pt-4">
                    <h3 className="text-xs font-bold text-on-surface">Ticket history</h3>
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      The incident event ledger is append-only and refreshes automatically from the API.
                    </p>
                    <div className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto">
                      {(selectedTask.events || []).map((event: any) => (
                        <div key={event.id} className="rounded-lg bg-surface-container-high/40 p-2 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-on-surface">{event.eventType}</span>
                            <span className="text-on-surface-variant">{new Date(event.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="mt-0.5 text-on-surface">{event.description}</p>
                          <p className="mt-0.5 text-[10px] font-semibold text-on-surface-variant">
                            {event.actorRole} · {event.previousStatus || '—'} → {event.newStatus || '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-6 py-16 text-center">
                  <span className="material-symbols-outlined text-[30px] text-on-surface-variant" aria-hidden="true">shield</span>
                  <p className="mt-2 text-sm font-bold text-on-surface">No field task selected</p>
                  <p className="mt-1 max-w-xs text-xs text-on-surface-variant">
                    Accepted assignments will appear here with live status and event history.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
};

function statusLabel(status: string): string {
  const value = String(status || 'NEW');
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
