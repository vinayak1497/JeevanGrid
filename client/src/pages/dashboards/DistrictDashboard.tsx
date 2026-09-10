import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const DistrictDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [assigningResponder, setAssigningResponder] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      const res = await apiFetch('/dashboards/district');
      setData(res);
      if (res.incidents?.length > 0 && !selectedIncident) {
        setSelectedIncident(res.incidents[0]);
      } else if (selectedIncident) {
        const refreshed = res.incidents.find((i: any) => i.id === selectedIncident.id);
        if (refreshed) setSelectedIncident(refreshed);
      }
    } catch (err) {
      console.error('Failed to load district dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleAssign = async () => {
    if (!selectedIncident || !assigningResponder) return;
    try {
      await apiFetch(`/incidents/${selectedIncident.id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ responderId: assigningResponder }),
      });
      setActionSuccess('Incident assigned successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
      loadDashboard();
    } catch (err) {
      console.error('Assign failed:', err);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selectedIncident) return;
    try {
      await apiFetch(`/incidents/${selectedIncident.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setActionSuccess(`Status updated to ${status}`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadDashboard();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  if (loading) {
    return <div className="pt-28 pb-20 text-center text-xs text-on-surface-variant">Loading District Command Hub...</div>;
  }

  const stats = data?.stats || {};

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      {/* Top Banner */}
      <section className="bg-surface-container-low py-space-lg border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
              District Disaster Management Authority (DDMA)
            </span>
            <h1 className="font-headline-xl text-2xl font-bold text-on-surface">
              {data?.district || 'Mumbai Suburban'} Command Dashboard
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Incident Commander: {user?.name || 'District Officer'} • Operational Status: <strong className="text-primary">EOC ACTIVE</strong>
            </p>
          </div>
          <button
            onClick={loadDashboard}
            className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs flex items-center gap-1.5 self-start transition-colors border border-outline-variant/30"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Refresh Live Triage</span>
          </button>
        </div>
      </section>

      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-lg flex flex-col gap-space-lg">
        {actionSuccess && (
          <div className="p-space-sm rounded-lg bg-[#e9f3ed] text-primary border border-[#c7e2d3] text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* 4 Key Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Pending Triage</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-error">{stats.newIncidents || 0}</span>
              <span className="text-xs text-on-surface-variant">New reports</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Active Dispatches</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-secondary">{stats.assignedIncidents || 0}</span>
              <span className="text-xs text-on-surface-variant">Field units active</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Affected Civilians</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-primary">{stats.totalAffected || 0}</span>
              <span className="text-xs text-on-surface-variant">In distress queue</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Available Hospital Beds</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-surface-tint">{stats.totalAvailableBeds || 0}</span>
              <span className="text-xs text-on-surface-variant">({stats.totalAvailableIcu || 0} ICU)</span>
            </div>
          </div>
        </div>

        {/* Incidents Triage split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          {/* Incident Queue (Left 5 cols) */}
          <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-space-lg border border-outline-variant/30 shadow-sm flex flex-col max-h-[600px]">
            <div className="flex items-center justify-between mb-space-sm">
              <h2 className="font-headline-sm text-sm font-bold text-on-surface">Incident Triage Stream</h2>
              <span className="text-xs font-bold text-primary">{data?.incidents?.length || 0} Total</span>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-space-xs pr-1">
              {data?.incidents?.map((inc: any) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <button
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`p-space-sm rounded-xl text-left transition-all border ${
                      isSelected
                        ? 'bg-surface-container border-primary shadow-xs'
                        : 'bg-surface-container-low border-outline-variant/20 hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-code-num text-[11px] font-bold text-primary">
                        {inc.reportId || inc.id.substring(0, 8)}
                      </span>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase ${
                        inc.status === 'NEW' ? 'bg-error-container text-on-error-container' : inc.status === 'ASSIGNED' ? 'bg-secondary-container text-on-secondary-container' : inc.status === 'IN_PROGRESS' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#e9f3ed] text-primary'
                      }`}>
                        {inc.status}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-on-surface truncate">{inc.title}</h3>
                    <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{inc.locationName}</p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-on-surface-variant">
                      <span>Urgency: <strong className={inc.urgency === 'Critical' ? 'text-error' : 'text-on-surface'}>{inc.urgency}</strong></span>
                      <span>Assigned: {inc.assignedTo?.name ? inc.assignedTo.name.split(' ')[0] : 'None'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Incident Detail & Actions (Right 7 cols) */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-space-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            {selectedIncident ? (
              <div className="flex flex-col gap-space-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-space-sm border-b border-outline-variant/20">
                  <div>
                    <span className="text-[11px] font-bold text-secondary uppercase">
                      Incident Ticket #{selectedIncident.reportId || selectedIncident.id}
                    </span>
                    <h2 className="font-headline-sm text-lg font-bold text-on-surface mt-0.5">
                      {selectedIncident.title}
                    </h2>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold self-start ${
                    selectedIncident.urgency === 'Critical' ? 'bg-error text-on-error' : 'bg-surface-container-high text-on-surface'
                  }`}>
                    {selectedIncident.urgency} Priority
                  </span>
                </div>

                {/* Description and metadata */}
                <div className="flex flex-col gap-space-xs text-xs">
                  <p className="text-on-surface leading-relaxed p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                    "{selectedIncident.description}"
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                    <div className="p-2 rounded bg-surface-container-low">
                      <span className="text-[10px] text-on-surface-variant block">Location</span>
                      <span className="font-bold text-on-surface">{selectedIncident.locationName}</span>
                    </div>
                    <div className="p-2 rounded bg-surface-container-low">
                      <span className="text-[10px] text-on-surface-variant block">Reporter</span>
                      <span className="font-bold text-on-surface">{selectedIncident.report?.citizenName || 'Civic Call'}</span>
                    </div>
                    <div className="p-2 rounded bg-surface-container-low">
                      <span className="text-[10px] text-on-surface-variant block">Contact</span>
                      <a href={`tel:${selectedIncident.report?.phone}`} className="font-bold text-primary hover:underline">
                        {selectedIncident.report?.phone || 'N/A'}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Assignment Controls */}
                <div className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-space-xs">
                  <h3 className="font-bold text-xs text-on-surface">Assign Incident to Field Responder</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={assigningResponder}
                      onChange={(e) => setAssigningResponder(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-lg bg-surface-container-lowest text-xs text-on-surface border border-outline-variant/30 outline-none focus:border-primary"
                    >
                      <option value="">-- Select Active Field Responder --</option>
                      {data?.responders?.map((r: any) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.phone || 'NDRF Unit'})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssign}
                      disabled={!assigningResponder}
                      className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-all disabled:opacity-50 whitespace-nowrap shadow-xs"
                    >
                      Dispatch Unit
                    </button>
                  </div>
                  {selectedIncident.assignedTo && (
                    <span className="text-[11px] text-secondary font-medium">
                      Currently Assigned to: <strong>{selectedIncident.assignedTo.name}</strong>
                    </span>
                  )}
                </div>

                {/* Status Progression Controls */}
                <div className="flex items-center gap-2 pt-space-xs">
                  <span className="text-xs font-bold text-on-surface-variant mr-1">Update Status:</span>
                  <button
                    onClick={() => handleStatusUpdate('IN_PROGRESS')}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold"
                  >
                    Set In-Progress
                  </button>
                  <button
                    onClick={() => handleStatusUpdate('RESOLVED')}
                    className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary hover:bg-primary text-xs font-semibold"
                  >
                    Mark Resolved
                  </button>
                </div>

                {/* Field Reports Feed for this incident */}
                {selectedIncident.fieldReports && selectedIncident.fieldReports.length > 0 && (
                  <div className="mt-space-sm pt-space-sm border-t border-outline-variant/20">
                    <h4 className="text-xs font-bold text-on-surface mb-2">Field Reports Logged ({selectedIncident.fieldReports.length})</h4>
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                      {selectedIncident.fieldReports.map((fr: any) => (
                        <div key={fr.id} className="p-2 rounded-lg bg-surface-container-high/40 text-xs flex flex-col gap-0.5">
                          <div className="flex justify-between font-bold text-[11px]">
                            <span>{fr.responderName}</span>
                            <span className="text-on-surface-variant">{new Date(fr.submittedAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-on-surface">{fr.situationReport}</p>
                          <span className="text-[10px] text-primary font-semibold">Rescued: {fr.casualtiesRescued} Civilians</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-xs text-on-surface-variant">
                Select an incident from the triage queue to inspect and dispatch.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
