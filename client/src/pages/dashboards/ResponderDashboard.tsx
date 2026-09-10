import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const ResponderDashboard: React.FC = () => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Field Report form state
  const [situationReport, setSituationReport] = useState('');
  const [casualtiesRescued, setCasualtiesRescued] = useState(0);
  const [medicalRequired, setMedicalRequired] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      // Query all incidents assigned to responders
      const res = await apiFetch('/incidents');
      const all: any[] = res.incidents || [];
      // If user is responder, prioritize their assigned tasks
      const myTasks = user ? all.filter((i) => i.assignedToId === user.id) : [];
      const displayTasks = myTasks.length > 0 ? myTasks : all.slice(0, 5);
      setIncidents(displayTasks);
      if (displayTasks.length > 0 && !selectedTask) {
        setSelectedTask(displayTasks[0]);
      } else if (selectedTask) {
        const refreshed = displayTasks.find((i) => i.id === selectedTask.id);
        if (refreshed) setSelectedTask(refreshed);
      }
    } catch (err) {
      console.error('Failed to load responder tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  const handleAcceptTask = async () => {
    if (!selectedTask) return;
    try {
      await apiFetch(`/incidents/${selectedTask.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
      setMessage('Task accepted and marked IN_PROGRESS.');
      setTimeout(() => setMessage(null), 3000);
      loadTasks();
    } catch (err) {
      console.error('Accept task failed:', err);
    }
  };

  const handleFieldReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !situationReport.trim()) return;

    setSubmitting(true);
    try {
      await apiFetch('/field-reports', {
        method: 'POST',
        body: JSON.stringify({
          incidentId: selectedTask.id,
          situationReport,
          casualtiesRescued,
          medicalRequired,
          notes,
          markCompleted: true,
        }),
      });

      setMessage('Field report submitted! Incident marked RESOLVED.');
      setSituationReport('');
      setCasualtiesRescued(0);
      setNotes('');
      setTimeout(() => setMessage(null), 4000);
      loadTasks();
    } catch (err) {
      console.error('Submit report error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      <section className="bg-surface-container-low py-space-lg border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
              Tactical Field Operations (NDRF / SDRF Unit)
            </span>
            <h1 className="font-headline-xl text-2xl font-bold text-on-surface">
              Field Responder Deployment Console
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Responder: <strong>{user?.name || 'Inspector Vikram Salunkhe (NDRF)'}</strong> • Unit Status: Active Deployment
            </p>
          </div>
          <button
            onClick={loadTasks}
            className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs flex items-center gap-1.5 transition-colors border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Sync Task Feed</span>
          </button>
        </div>
      </section>

      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-lg">
        {message && (
          <div className="p-space-sm rounded-lg bg-[#e9f3ed] text-primary border border-[#c7e2d3] text-xs font-bold mb-space-md flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* Task Stream (Left 5 cols) */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-space-lg border border-outline-variant/30 shadow-sm flex flex-col max-h-[600px]">
            <h2 className="font-headline-sm text-sm font-bold text-on-surface mb-space-sm">
              Assigned Emergency Tasks ({incidents.length})
            </h2>

            <div className="flex-1 overflow-y-auto flex flex-col gap-space-xs pr-1">
              {incidents.map((task) => {
                const isSelected = selectedTask?.id === task.id;
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`p-space-sm rounded-xl text-left transition-all border ${
                      isSelected
                        ? 'bg-surface-container border-secondary shadow-xs'
                        : 'bg-surface-container-low border-outline-variant/20 hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-code-num text-[11px] font-bold text-secondary">
                        {task.reportId || task.id.substring(0, 8)}
                      </span>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                        task.status === 'ASSIGNED' ? 'bg-secondary-container text-on-secondary-container' : task.status === 'IN_PROGRESS' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#e9f3ed] text-primary'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-on-surface truncate">{task.title}</h3>
                    <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{task.locationName}</p>
                    <span className="text-[10px] text-error font-semibold mt-1 block">Urgency: {task.urgency}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action & Field Report Submission (Right 7 cols) */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-space-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            {selectedTask ? (
              <div className="flex flex-col gap-space-md">
                <div className="pb-space-sm border-b border-outline-variant/20 flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold text-secondary uppercase">
                      Operational Mission: {selectedTask.emergencyType}
                    </span>
                    <h2 className="font-headline-sm text-lg font-bold text-on-surface mt-0.5">
                      {selectedTask.title}
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-1">{selectedTask.locationName}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-surface-container-high text-xs font-bold">
                    {selectedTask.status}
                  </span>
                </div>

                <div className="p-space-sm rounded-lg bg-surface-container-low text-xs text-on-surface leading-relaxed border border-outline-variant/20">
                  <strong>Citizen Report:</strong> "{selectedTask.description}"
                </div>

                {/* Accept Button if not yet In Progress */}
                {selectedTask.status === 'ASSIGNED' && (
                  <button
                    onClick={handleAcceptTask}
                    className="w-full py-2.5 rounded-xl bg-secondary text-on-secondary text-xs font-bold hover:bg-[#1f504e] transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Accept Task &amp; Begin Field Operations</span>
                  </button>
                )}

                {/* Submit Field Report Form */}
                <form onSubmit={handleFieldReportSubmit} className="mt-space-sm flex flex-col gap-space-sm border-t border-outline-variant/20 pt-space-md">
                  <h3 className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">assignment_turned_in</span>
                    <span>Log Ground Field Report (SitRep)</span>
                  </h3>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-on-surface">Situation Report *</label>
                    <textarea
                      required
                      rows={3}
                      value={situationReport}
                      onChange={(e) => setSituationReport(e.target.value)}
                      placeholder="e.g. Unit arrived on site with inflatable raft. Stranded civilians evacuated. Dewatering pump deployed."
                      className="p-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-space-sm">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-on-surface">Casualties / Civilians Rescued</label>
                      <input
                        type="number"
                        min="0"
                        value={casualtiesRescued}
                        onChange={(e) => setCasualtiesRescued(parseInt(e.target.value) || 0)}
                        className="h-10 px-3 rounded-lg bg-surface-container-low text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 cursor-pointer text-xs font-semibold text-on-surface">
                        <input
                          type="checkbox"
                          checked={medicalRequired}
                          onChange={(e) => setMedicalRequired(e.target.checked)}
                          className="w-4 h-4 rounded text-primary"
                        />
                        <span>Medical Support Required</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 h-11 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">publish</span>
                    <span>{submitting ? 'Submitting SitRep...' : 'Submit Field Report & Mark Resolved'}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center py-20 text-xs text-on-surface-variant">
                Select an assigned mission task from the feed.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
