import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { LeafletMap } from '../../components/LeafletMap';
import { useAuth } from '../../context/AuthContext';
import { DistrictIntelligenceWorkspace } from '../../components/intelligence/DistrictIntelligenceWorkspace';

type KpiTone = 'error' | 'secondary' | 'primary' | 'tint';

const KPI_TONES: Record<KpiTone, { icon: string; value: string }> = {
  error: { icon: 'bg-error-container text-on-error-container', value: 'text-error' },
  secondary: { icon: 'bg-secondary-container text-on-secondary-container', value: 'text-secondary' },
  primary: { icon: 'bg-primary/10 text-primary', value: 'text-primary' },
  tint: { icon: 'bg-[#eef2ff] text-[#3730a3]', value: 'text-surface-tint' },
};

const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: string;
  tone: KpiTone;
}> = ({ label, value, hint, icon, tone }) => (
  <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
        {label}
      </p>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${KPI_TONES[tone].icon}`}
      >
        <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
          {icon}
        </span>
      </span>
    </div>
    <div className="mt-3 flex items-baseline gap-1.5">
      <span
        className={`font-code-num text-3xl font-bold leading-none tracking-tight ${KPI_TONES[tone].value}`}
      >
        {value}
      </span>
      <span className="text-[11px] leading-snug text-on-surface-variant">{hint}</span>
    </div>
  </div>
);

function incidentStatusClass(status: string): string {
  switch (status) {
    case 'NEW':
      return 'bg-error-container text-on-error-container';
    case 'ASSIGNED':
      return 'bg-secondary-container text-on-secondary-container';
    case 'IN_PROGRESS':
      return 'bg-[#fef3c7] text-[#92400e]';
    case 'RESOLVED':
      return 'bg-[#e9f3ed] text-primary';
    default:
      return 'bg-surface-container-high text-on-surface-variant';
  }
}

function formatSync(value: string | null | undefined): string {
  if (!value) return 'Not synced yet';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not synced yet';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}

export const DistrictDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
        const refreshed = res.incidents?.find((i: any) => i.id === selectedIncident.id);
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
    // DDMA triage refreshes on an operational interval while mounted.
    const pollInterval = window.setInterval(() => void loadDashboard(), 15_000);
    return () => window.clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  };

  const applyIncidentAction = async (endpoint: string, method: 'PATCH' | 'POST', body: Record<string, unknown>) => {
    try {
      const res = await apiFetch<any>(endpoint, { method, body: JSON.stringify(body) });
      setActionSuccess(String(res?.message || 'Operational action completed.'));
      setAssigningResponder('');
      setSelectedIncident(res?.incident || selectedIncident);
      setTimeout(() => setActionSuccess(null), 5000);
      loadDashboard();
      return res;
    } catch (err: any) {
      console.error('Incident action failed:', err);
      setActionSuccess(err?.message ? String(err.message) : 'Operational action failed.');
      return null;
    }
  };

  const handleAssign = async () => {
    if (!selectedIncident || !assigningResponder) return;
    const res = await applyIncidentAction(`/incidents/${selectedIncident.id}/assign`, 'PATCH', {
      responderId: assigningResponder,
      notes: 'DDMA dispatched verified incident via JeevanGrid.',
    });
    if (res?.responder) {
      setActionSuccess(`Incident assigned to ${res.responder.name}. Responder acceptance is required before work starts.`);
    }
  };

  const handleVerify = async () => {
    if (!selectedIncident) return;
    const res = await applyIncidentAction(`/incidents/${selectedIncident.id}/verify`, 'PATCH', {
      note: 'Verified through the guided citizen report review.',
    });
    if (res) setActionSuccess('Incident verified. It can now be assigned to a field responder.');
  };

  const handleReject = async () => {
    if (!selectedIncident) return;
    const res = await applyIncidentAction(`/incidents/${selectedIncident.id}/reject`, 'PATCH', {
      reason: 'Officer review rejected this citizen report after human assessment.',
    });
    if (res) setActionSuccess('Incident rejected. The reason is recorded in the audit trail.');
  };

  const handleMarkDuplicate = async () => {
    if (!selectedIncident) return;
    const res = await applyIncidentAction(`/incidents/${selectedIncident.id}/duplicate`, 'PATCH', {
      note: 'Marked as suspected duplicate after human review.',
    });
    if (res) setActionSuccess('Incident marked as a suspected duplicate; human review remains required.');
  };

  const handleReviewResolution = async (decision: 'APPROVE' | 'REJECT' | 'REOPEN') => {
    if (!selectedIncident) return;
    const res = await applyIncidentAction(`/incidents/${selectedIncident.id}/review-resolution`, 'POST', {
      decision,
      note:
        decision === 'APPROVE'
          ? 'DDMA approved the field resolution and closed the incident.'
          : decision === 'REJECT'
            ? 'DDMA rejected the field resolution; responder must continue.'
            : 'DDMA reopened the resolved incident for further response.',
    });
    if (res) {
      setActionSuccess(
        decision === 'APPROVE'
          ? 'Resolution approved and incident closed.'
          : decision === 'REJECT'
            ? 'Resolution rejected; incident returned to field response.'
            : 'Incident reopened; reassignment must be performed by DDMA.'
      );
    }
  };

  if (loading) {
    return (
      <div className="jg-page flex min-h-[70dvh] items-center justify-center text-center text-xs text-on-surface-variant">
        Loading District Command Hub...
      </div>
    );
  }

  const stats = data?.stats || {};
  const incidents: any[] = data?.incidents || [];
  const officialAlerts: any[] = data?.officialAlerts || [];
  const openIncidents = incidents.filter((incident) => incident.status !== 'RESOLVED').length;
  const lastSyncLabel = formatSync(data?.lastSuccessfulSync);
  const districtName = data?.district || 'District';

  return (
    <main className="jg-page min-h-[100dvh] bg-surface pb-space-3xl">
      {/* Command header */}
      <section className="border-b border-outline-variant/30 bg-surface-container-low">
        <div className="mx-auto max-w-container-max px-margin-mobile py-space-lg lg:px-margin-desktop">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">
                  District Disaster Management Authority
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  EOC active
                </span>
                {(stats.newIncidents || 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-error/20 bg-error-container px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-error-container">
                    <span className="h-1.5 w-1.5 rounded-full bg-error" aria-hidden="true" />
                    {stats.newIncidents} awaiting triage
                  </span>
                )}
              </div>
              <h1 className="mt-2 font-headline-xl text-2xl font-bold tracking-tight text-on-surface sm:text-[28px]">
                {districtName} Command Dashboard
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-on-surface-variant">
                Incident Commander:{' '}
                <strong className="font-semibold text-on-surface">
                  {user?.name || 'District Officer'}
                </strong>
                <span className="mx-1.5 text-outline-variant">/</span>
                Field responders on roster: <strong className="font-semibold text-on-surface">{stats.availableRespondersCount ?? 0}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                  Official feed
                </p>
                <p className="text-[11px] font-medium text-on-surface">{lastSyncLabel}</p>
              </div>
              <button
                type="button"
                onClick={refreshDashboard}
                disabled={refreshing}
                aria-busy={refreshing}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3.5 py-2 text-xs font-bold text-primary shadow-sm transition-colors hover:bg-surface-container disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span
                  className={`material-symbols-outlined text-[17px] ${
                    refreshing ? 'animate-spin motion-reduce:animate-none' : ''
                  }`}
                  aria-hidden="true"
                >
                  sync
                </span>
                {refreshing ? 'Refreshing…' : 'Refresh live triage'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-space-lg flex max-w-container-max flex-col gap-space-lg px-margin-mobile lg:px-margin-desktop">
        {actionSuccess && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-[#c7e2d3] bg-[#e9f3ed] p-3 text-xs font-bold text-primary"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              check_circle
            </span>
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Key metrics */}
        <section aria-label="District operational metrics" className="grid grid-cols-2 gap-space-md lg:grid-cols-4">
          <KpiCard
            label="Pending triage"
            value={stats.newIncidents || 0}
            hint="New reports"
            icon="report"
            tone="error"
          />
          <KpiCard
            label="Active dispatches"
            value={stats.assignedIncidents || 0}
            hint="Field units active"
            icon="local_shipping"
            tone="secondary"
          />
          <KpiCard
            label="Affected civilians"
            value={stats.totalAffected || 0}
            hint="In distress queue"
            icon="groups"
            tone="primary"
          />
          <KpiCard
            label="Available beds"
            value={stats.totalAvailableBeds || 0}
            hint={`${stats.totalAvailableIcu || 0} ICU`}
            icon="local_hospital"
            tone="tint"
          />
        </section>

        {/* Official warnings */}
        <section
          aria-label="Official warnings"
          className={`overflow-hidden rounded-2xl border bg-surface-container-lowest shadow-sm ${
            officialAlerts.length > 0 ? 'border-error/25' : 'border-outline-variant/30'
          }`}
        >
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  officialAlerts.length > 0
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  {officialAlerts.length > 0 ? 'campaign' : 'verified'}
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                  Official warnings
                </p>
                <h2 className="mt-0.5 text-sm font-bold text-on-surface">
                  {officialAlerts.length > 0
                    ? `${officialAlerts.length} verified warning${
                        officialAlerts.length === 1 ? '' : 's'
                      } affecting ${districtName}`
                    : `No verified warnings for ${districtName}`}
                </h2>
                <p className="mt-0.5 text-[11px] leading-relaxed text-on-surface-variant">
                  {officialAlerts.length > 0
                    ? 'Only warnings with complete provenance and a fresh official source are shown.'
                    : 'The official feed is clear. JeevanGrid operational actions below do not issue warnings.'}
                  {data?.officialStaleCount > 0
                    ? ` ${data.officialStaleCount} stale source${
                        data.officialStaleCount === 1 ? '' : 's'
                      } excluded.`
                    : ''}
                </p>
              </div>
            </div>

            {officialAlerts.length > 0 && (
              <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-error/20 bg-error-container/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-error-container">
                <span className="h-1.5 w-1.5 rounded-full bg-error" aria-hidden="true" />
                Live feed
              </span>
            )}
          </div>

          {officialAlerts.length > 0 && (
            <div className="border-t border-error/20 bg-error-container/10 p-4 sm:p-5">
              <div className="flex flex-col gap-2.5">
                {officialAlerts.slice(0, 5).map((alert: any) => (
                  <article
                    key={alert.id}
                    className="rounded-xl border border-error/15 bg-surface-container-lowest p-3.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="shrink-0 rounded-full bg-error-container px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-on-error-container">
                          {alert.severity}
                        </span>
                        <h3 className="text-xs font-bold leading-snug text-on-surface">
                          {alert.headline || alert.title}
                        </h3>
                      </div>
                      {alert.sourceUrl && (
                        <a
                          href={alert.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          Official source
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                            open_in_new
                          </span>
                        </a>
                      )}
                    </div>
                    {alert.description && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant">
                        {alert.description}
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] text-on-surface-variant">
                      {alert.authority || alert.source} / Issued {alert.issuedIST || '—'} / Valid
                      until {alert.validUntilIST || 'see bulletin'}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Incident triage */}
        <section aria-labelledby="incident-triage-heading" className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">
                Live operations
              </p>
              <h2
                id="incident-triage-heading"
                className="mt-1 font-headline-sm text-lg font-bold tracking-tight text-on-surface"
              >
                Incident triage
              </h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Review incoming reports, dispatch a responder, and update status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
              <span className="rounded-full border border-outline-variant/30 bg-surface-container-lowest px-2.5 py-1 text-on-surface-variant">
                {openIncidents} open
              </span>
              <span className="rounded-full border border-outline-variant/30 bg-surface-container-lowest px-2.5 py-1 text-on-surface-variant">
                {stats.resolvedIncidents || 0} resolved
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
            {/* Queue — on phones it flows with the page instead of trapping
                the scroll inside a 640px window. */}
            <div className="flex flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm xl:col-span-5 xl:max-h-[640px]">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-on-surface">Incoming reports</h3>
                  <p className="text-[10px] text-on-surface-variant">
                    Newest first / select a ticket to inspect
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/5 px-2.5 py-1 text-[10px] font-bold text-primary">
                  {incidents.length} total
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 xl:overflow-y-auto xl:pr-1">
                {incidents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-4 py-10 text-center">
                    <span
                      className="material-symbols-outlined text-[26px] text-on-surface-variant"
                      aria-hidden="true"
                    >
                      inbox
                    </span>
                    <p className="mt-1 text-xs font-bold text-on-surface">No reports in the queue</p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">
                      New citizen reports will appear here for triage.
                    </p>
                  </div>
                ) : (
                  incidents.map((incident: any) => {
                    const isSelected = selectedIncident?.id === incident.id;
                    return (
                      <button
                        key={incident.id}
                        type="button"
                        onClick={() => {
                          setSelectedIncident(incident);
                          setAssigningResponder('');
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                          isSelected
                            ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/10'
                            : 'border-outline-variant/25 bg-surface-container-low hover:border-outline-variant/50 hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-code-num text-[11px] font-bold text-primary">
                            {incident.referenceCode || incident.reportId || incident.id.substring(0, 8)}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${incidentStatusClass(
                              incident.status
                            )}`}
                          >
                            {incident.status}
                          </span>
                        </div>

                        <h3 className="mt-1 truncate text-xs font-bold text-on-surface">
                          {incident.title}
                        </h3>
                        <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">
                          {incident.locationName}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-on-surface-variant">
                          <span>
                            Urgency:{' '}
                            <strong
                              className={
                                incident.urgency === 'Critical' ? 'text-error' : 'text-on-surface'
                              }
                            >
                              {incident.urgency}
                            </strong>
                          </span>
                          <span className="truncate">
                            Assigned:{' '}
                            {incident.assignedTo?.name
                              ? incident.assignedTo.name.split(' ')[0]
                              : 'None'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected incident detail */}
            <div className="flex flex-col rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm xl:col-span-7">
              {selectedIncident ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 border-b border-outline-variant/20 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-all text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">
                          Incident ticket #{selectedIncident.referenceCode || selectedIncident.reportId || selectedIncident.id}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${incidentStatusClass(
                            selectedIncident.status
                          )}`}
                        >
                          {selectedIncident.status}
                        </span>
                      </div>
                      <h2 className="mt-1 font-headline-sm text-lg font-bold leading-snug text-on-surface">
                        {selectedIncident.title}
                      </h2>
                      <p className="mt-1 text-[11px] text-on-surface-variant">
                        {selectedIncident.locationName}
                      </p>
                    </div>
                    <span
                      className={`self-start rounded-full px-3 py-1 text-xs font-bold ${
                        selectedIncident.urgency === 'Critical'
                          ? 'bg-error text-on-error'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      {selectedIncident.urgency} priority
                    </span>
                  </div>

                  <p className="rounded-xl border-l-2 border-primary/30 bg-surface-container-low px-3 py-3 text-xs leading-relaxed text-on-surface">
                    {selectedIncident.description}
                  </p>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        Source / reporter
                      </span>
                      <span className="mt-0.5 inline-flex min-h-[44px] items-center text-xs font-bold text-on-surface">
                        {selectedIncident.reportSource || 'CITIZEN_FORM'} · {selectedIncident.reporterType || 'GUEST'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        Location provenance
                      </span>
                      <span className="mt-0.5 inline-flex min-h-[44px] items-center text-xs font-bold text-on-surface">
                        {selectedIncident.locationSource || 'NONE'} · Accuracy {selectedIncident.accuracyM ?? '—'} m
                      </span>
                      <span className="block text-[10px] font-semibold text-on-surface-variant">
                        Confirmed: {Boolean(selectedIncident.locationConfirmed) ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        Verification
                      </span>
                      <span className="mt-0.5 inline-flex min-h-[44px] items-center text-xs font-bold text-on-surface">
                        {selectedIncident.verifiedAt ? `By ${selectedIncident.verifiedBy?.name || 'Officer'}` : 'Awaiting DDMA officer'}
                      </span>
                      {selectedIncident.duplicateOfReference && (
                        <span className="block text-[10px] font-semibold text-error">Duplicate of {selectedIncident.duplicateOfReference}</span>
                      )}
                    </div>
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        Resolution review
                      </span>
                      <span className="mt-0.5 inline-flex min-h-[44px] items-center text-xs font-bold text-on-surface">
                        {selectedIncident.resolutionSubmittedAt ? 'Resolution submitted for review' : 'No resolution submitted yet'}
                      </span>
                      <span className="block text-[10px] font-semibold text-on-surface-variant">
                        Decision: {selectedIncident.resolutionDecision || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        Location
                      </span>
                      <span className="mt-0.5 inline-flex min-h-[44px] items-center text-xs font-bold text-on-surface">
                        {selectedIncident.locationName}
                      </span>
                    </div>
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        Reporter
                      </span>
                      <span className="mt-0.5 inline-flex min-h-[44px] items-center text-xs font-bold text-on-surface">
                        {selectedIncident.report?.citizenName || 'Civic Call'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                        Contact
                      </span>
                      <a
                        href={`tel:${selectedIncident.report?.phone}`}
                        className="mt-0.5 inline-flex min-h-[44px] items-center text-xs font-bold text-primary hover:underline"
                      >
                        {selectedIncident.report?.phone || 'N/A'}
                      </a>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
                    <div>
                      <h3 className="text-xs font-bold text-on-surface">
                        Assign incident to field responder
                      </h3>
                      <p className="mt-0.5 text-[10px] text-on-surface-variant">
                        The responder receives the ticket and can submit field reports.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={assigningResponder}
                        onChange={(event) => setAssigningResponder(event.target.value)}
                        aria-label="Select an active field responder"
                        className="h-11 w-full min-w-0 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 text-xs text-on-surface outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 sm:flex-1"
                      >
                        <option value="">Select active field responder</option>
                        {data?.responders?.map((responder: any) => (
                          <option key={responder.id} value={responder.id}>
                            {responder.name} ({responder.phone || 'NDRF Unit'})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAssign}
                        disabled={!assigningResponder}
                        className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary shadow-sm transition-colors hover:bg-primary-container disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        Dispatch unit
                      </button>
                    </div>
                    {selectedIncident.assignedTo && (
                      <p className="text-[11px] font-medium text-secondary">
                        Currently assigned to{' '}
                        <strong className="font-bold">{selectedIncident.assignedTo.name}</strong>
                      </p>
                    )}
                  </div>

                  {selectedIncident.latitude != null && selectedIncident.longitude != null && (
                    <div className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-low">
                      <LeafletMap
                        center={[selectedIncident.latitude, selectedIncident.longitude]}
                        zoom={13}
                        className="h-[260px] w-full"
                        markers={[
                          {
                            id: selectedIncident.id,
                            lat: selectedIncident.latitude,
                            lng: selectedIncident.longitude,
                            title: selectedIncident.title,
                            subtitle: `${selectedIncident.locationName} · ${selectedIncident.status}`,
                            type: 'INCIDENT',
                          },
                        ]}
                      />
                      {selectedIncident.accuracyM != null && (
                        <p className="bg-surface-container-lowest px-3 py-2 text-[10px] font-semibold text-on-surface-variant">
                          Reported location accuracy: ±{selectedIncident.accuracyM} m
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-low p-3">
                    <span className="mr-1 text-xs font-bold text-on-surface-variant">
                      Human decision workflow:
                    </span>
                    {selectedIncident.status === 'NEW' || selectedIncident.status === 'DUPLICATE_SUSPECTED' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleVerify()}
                          className="inline-flex min-h-[44px] items-center rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary transition-colors hover:bg-secondary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
                        >
                          Verify incident
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMarkDuplicate()}
                          className="inline-flex min-h-[44px] items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          Mark duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReject()}
                          className="inline-flex min-h-[44px] items-center rounded-lg border border-error/40 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-error transition-colors hover:bg-error-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30"
                        >
                          Reject
                        </button>
                      </>
                    ) : selectedIncident.status === 'VERIFIED' ? (
                      <button
                        type="button"
                        onClick={() => void handleAssign()}
                        disabled={!assigningResponder}
                        className="inline-flex min-h-[44px] items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-50"
                      >
                        Assign verified incident
                      </button>
                    ) : null}

                    {['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'].includes(selectedIncident.status) && (
                      <button
                        type="button"
                        onClick={() => void handleReviewResolution('REJECT')}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        Request more work / reject pending resolution
                      </button>
                    )}

                    {selectedIncident.status === 'RESOLVED_PENDING_REVIEW' ? (
                      <button
                        type="button"
                        onClick={() => void handleReviewResolution('APPROVE')}
                        className="inline-flex min-h-[44px] items-center rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary transition-colors hover:bg-secondary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
                      >
                        Approve resolution and close
                      </button>
                    ) : selectedIncident.status === 'RESOLVED' ? (
                      <button
                        type="button"
                        onClick={() => void handleReviewResolution('REOPEN')}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        Reopen resolved incident
                      </button>
                    ) : null}
                  </div>

                  {selectedIncident.events && selectedIncident.events.length > 0 && (
                    <div className="border-t border-outline-variant/20 pt-4">
                      <h4 className="mb-2 text-xs font-bold text-on-surface">Incident event history</h4>
                      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                        {selectedIncident.events.map((event: any) => (
                          <div key={event.id} className="rounded-lg bg-surface-container-high/40 p-2 text-[11px]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
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
                  )}

                  {selectedIncident.fieldReports && selectedIncident.fieldReports.length > 0 && (
                    <div className="border-t border-outline-variant/20 pt-4">
                      <h4 className="mb-2 text-xs font-bold text-on-surface">
                        Field reports logged ({selectedIncident.fieldReports.length})
                      </h4>
                      <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                        {selectedIncident.fieldReports.map((fieldReport: any) => (
                          <div
                            key={fieldReport.id}
                            className="flex flex-col gap-0.5 rounded-lg bg-surface-container-high/40 p-2 text-xs"
                          >
                            <div className="flex justify-between gap-2 text-[11px] font-bold">
                              <span>{fieldReport.responderName}</span>
                              <span className="text-on-surface-variant">
                                {new Date(fieldReport.submittedAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-on-surface">{fieldReport.situationReport}</p>
                            <span className="text-[10px] font-semibold text-primary">
                              Rescued: {fieldReport.casualtiesRescued} civilians
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-6 py-16 text-center">
                  <span
                    className="material-symbols-outlined text-[30px] text-on-surface-variant"
                    aria-hidden="true"
                  >
                    touch_app
                  </span>
                  <p className="mt-2 text-sm font-bold text-on-surface">Select an incident</p>
                  <p className="mt-1 max-w-xs text-xs text-on-surface-variant">
                    Choose a report from the triage queue to inspect details, assign a responder, or
                    change its status.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Dense intelligence modules live in a full-width, single-module workspace. */}
        <DistrictIntelligenceWorkspace district={districtName} onChanged={loadDashboard} />
      </div>
    </main>
  );
};
