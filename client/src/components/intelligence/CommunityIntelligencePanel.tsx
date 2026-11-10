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
  verificationTone,
} from './IntelligenceUI';

const STATUS_FILTERS = [
  ['ALL', 'All'],
  ['UNVERIFIED', 'Unverified'],
  ['DUPLICATE_SUSPECTED', 'Possible duplicate'],
  ['CORROBORATED', 'Corroborated'],
  ['OFFICER_VERIFIED', 'Officer verified'],
  ['REJECTED', 'Rejected'],
  ['RESOLVED', 'Resolved'],
];

const CATEGORY_TONE: Record<string, string> = {
  FLOODING: '#023d67',
  FIRE: '#ba1a1a',
  MEDICAL: '#9a3412',
  STRANDED: '#7c2d12',
  LANDSLIDE: '#6d28d9',
  ROAD_BLOCKED: '#475569',
  BRIDGE_DAMAGED: '#475569',
  TREE_FALLEN: '#166534',
  INFRASTRUCTURE: '#475569',
  RESOURCE_SHORTAGE: '#a16207',
  OTHER: '#6b7280',
};

export const CommunityIntelligencePanel: React.FC<{
  district?: string;
  initialSummary?: any;
  onChanged?: () => void;
}> = ({ district, initialSummary, onChanged }) => {
  const { user } = useAuth();
  const role = user?.role || 'CITIZEN';
  const officer = role === 'DISTRICT_OFFICER' || role === 'STATE_EOC';
  const [summary, setSummary] = useState<any>(initialSummary || null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [similar, setSimilar] = useState<Record<string, any[]>>({});

  const load = async () => {
    setError(null);
    try {
      const queryDistrict = district ? `district=${encodeURIComponent(district)}&` : '';
      const [summaryResponse, reportsResponse] = await Promise.all([
        apiFetch<any>(`/community/summary?${queryDistrict}days=7`),
        apiFetch<{ reports: any[] }>(`/community/reports?${queryDistrict.replace(/&$/, '')}`),
      ]);
      setSummary(summaryResponse);
      setReports(reportsResponse.reports || []);
    } catch (err: any) {
      setError(err.message || 'Community intelligence is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (filter !== 'ALL' && report.verificationStatus !== filter) return false;
      if (!needle) return true;
      return [
        report.locationName,
        report.category,
        report.emergencyType,
        report.description,
        report.citizenName,
      ]
        .filter(Boolean)
        .some((value: string) => String(value).toLowerCase().includes(needle));
    });
  }, [reports, filter, search]);

  const counts = summary?.counts || {};
  const total = summary?.totalReports ?? reports.length;

  const loadSimilar = async (reportId: string) => {
    if (similar[reportId]) return;
    try {
      const response = await apiFetch<{ similar: any[] }>(`/community/reports/${reportId}/similar`);
      setSimilar((current) => ({ ...current, [reportId]: response.similar || [] }));
    } catch (err: any) {
      setNotice(err.message || 'Could not load similar reports.');
    }
  };

  const act = async (report: any, action: 'CORROBORATE' | 'VERIFY' | 'REJECT' | 'RESOLVE') => {
    const note = (notes[report.id] || '').trim();
    if (action !== 'CORROBORATE' && note.length < 5) {
      setNotice('Add a short audit note before changing the verification status.');
      return;
    }
    setActingId(report.id);
    setNotice(null);
    try {
      if (action === 'CORROBORATE') {
        const response = await apiFetch<any>(`/community/reports/${report.id}/corroborate`, {
          method: 'POST',
          body: JSON.stringify({ note: note || undefined }),
        });
        setNotice(response.message);
      } else {
        const response = await apiFetch<any>(`/community/reports/${report.id}/verify`, {
          method: 'POST',
          body: JSON.stringify({ action, note }),
        });
        setNotice(response.message);
      }
      setNotes((current) => ({ ...current, [report.id]: '' }));
      await load();
      onChanged?.();
    } catch (err: any) {
      setNotice(err.message || 'Action failed.');
    } finally {
      setActingId(null);
    }
  };

  const pipeline = [
    { key: 'UNVERIFIED', label: 'Unverified', color: '#6b7280' },
    { key: 'DUPLICATE_SUSPECTED', label: 'Duplicate', color: '#b45309' },
    { key: 'CORROBORATED', label: 'Corroborated', color: '#1d4ed8' },
    { key: 'OFFICER_VERIFIED', label: 'Officer verified', color: '#15432c' },
    { key: 'REJECTED', label: 'Rejected', color: '#ba1a1a' },
    { key: 'RESOLVED', label: 'Resolved', color: '#2a6866' },
  ];

  const categoryEntries = Object.entries(summary?.byCategory || {}).sort(
    (a, b) => Number(b[1]) - Number(a[1])
  ) as Array<[string, number]>;
  const maxCategory = Math.max(1, ...categoryEntries.map(([, count]) => Number(count)));

  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric label="Reports · 7 days" value={summary?.totalReports ?? reports.length} tone="primary" />
        <Metric
          label="Awaiting human review"
          value={summary?.awaitingHumanVerification ?? 0}
          hint="Unverified + corroborated + duplicate-suspected"
          tone="warning"
        />
        <Metric
          label="Officer verified"
          value={summary?.verifiedByOfficer ?? 0}
          hint="Only a human can verify"
          tone="primary"
        />
        <Metric
          label="Possible duplicate groups"
          value={summary?.possibleDuplicateGroups?.length ?? 0}
          hint="Within 500 m and 3 hours"
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-space-md">
        <SectionCard
          title="Community report pipeline"
          subtitle="Deterministic checks and human verification are kept separate."
          icon="fact_check"
          className="xl:col-span-2"
        >
          {loading && !summary ? (
            <p className="text-xs text-on-surface-variant">Loading community intelligence…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="h-4 w-full rounded-full overflow-hidden flex bg-surface-container-high">
                {pipeline.map((step) => {
                  const value = Number(counts[step.key] || 0);
                  const width = total > 0 ? (value / total) * 100 : 0;
                  return width > 0 ? (
                    <div
                      key={step.key}
                      style={{ width: `${width}%`, backgroundColor: step.color }}
                      title={`${step.label}: ${value}`}
                    />
                  ) : null;
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {pipeline.map((step) => (
                  <span key={step.key} className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: step.color }} />
                    {step.label} <strong className="font-code-num text-on-surface">{counts[step.key] || 0}</strong>
                  </span>
                ))}
              </div>
              <DataCaveat>
                <strong>AI is advisory.</strong> The classification and duplicate check use deterministic
                rules or AI output. They never set OFFICER_VERIFIED. Two independent human corroborations
                raise a report to CORROBORATED; only an authorised officer can verify it.
              </DataCaveat>
              {summary?.privacyNote && <p className="text-[10px] text-on-surface-variant">{summary.privacyNote}</p>}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Reports by category" subtitle="Community signal, not damage totals." icon="bar_chart">
          {categoryEntries.length === 0 ? (
            <EmptyState title="No categorised reports" body="Reports appear here after submission." />
          ) : (
            <div className="flex flex-col gap-2">
              {categoryEntries.slice(0, 8).map(([category, count]) => (
                <div key={category}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="font-semibold">{category.replace(/_/g, ' ')}</span>
                    <span className="font-code-num">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(Number(count) / maxCategory) * 100}%`,
                        backgroundColor: CATEGORY_TONE[category] || '#6b7280',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {notice && (
        <div className="rounded-lg bg-surface-container-high border border-outline-variant/40 px-3 py-2 text-[11px] font-semibold text-on-surface">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-[11px] font-semibold">
          {error}
        </div>
      )}

      <SectionCard
        title="Ground reports"
        subtitle="A report is not an incident until a human verifies it."
        icon="hearing"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search location or category"
              aria-label="Search community reports"
              className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs w-full max-w-[12rem]"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter by verification status"
              className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs"
            >
              {STATUS_FILTERS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button type="button" onClick={load} className={secondaryButton} disabled={loading}>
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              Refresh
            </button>
          </div>
        }
      >
        {loading ? (
          <p className="text-xs text-on-surface-variant">Loading reports…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="report"
            title="No reports match this view"
            body="Community reports are visible only to authorised operational roles."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((report) => {
              const open = expandedId === report.id;
              const busy = actingId === report.id;
              const final = ['OFFICER_VERIFIED', 'REJECTED', 'RESOLVED'].includes(report.verificationStatus);
              return (
                <article
                  key={report.id}
                  className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(open ? null : report.id);
                      loadSimilar(report.id);
                    }}
                    aria-expanded={open}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-container-low"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge tone={verificationTone(report.verificationStatus)}>
                          {report.verificationStatus.replace(/_/g, ' ')}
                        </StatusBadge>
                        <StatusBadge tone="neutral">{String(report.category || '').replace(/_/g, ' ')}</StatusBadge>
                        {report.urgency === 'Critical' && <StatusBadge tone="danger">Critical urgency</StatusBadge>}
                      </div>
                      <span className="text-[10px] text-on-surface-variant">{formatDateTime(report.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-[12px] font-bold text-on-surface">
                      {report.locationName}
                    </div>
                    <div className="text-[10.5px] text-on-surface-variant mt-0.5">
                      {report.peopleAffected} affected · {report.corroborationCount || 0} corroboration
                      {report.corroborationCount === 1 ? '' : 's'} · reported by {report.citizenName}
                    </div>
                    <p className="text-[11px] text-on-surface mt-1 line-clamp-2">{report.description}</p>
                  </button>

                  {open && (
                    <div className="border-t border-outline-variant/30 px-3 py-3 flex flex-col gap-2.5 bg-surface-container-low/50">
                      <p className="text-[11px] text-on-surface">{report.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(report.vulnerablePersons || []).map((v: string) => (
                          <StatusBadge key={v} tone="danger">{v}</StatusBadge>
                        ))}
                        {(report.requiredAssistance || []).map((v: string) => (
                          <StatusBadge key={v} tone="info">{v.replace(/_/g, ' ')}</StatusBadge>
                        ))}
                        {report.language && <StatusBadge tone="neutral">Language {report.language}</StatusBadge>}
                      </div>
                      {report.aiClassification && (
                        <DataCaveat tone="info">
                          <strong>Advisory AI/rule classification:</strong>{' '}
                          {report.aiClassification.provider || 'deterministic'} · confidence{' '}
                          {report.aiClassification.confidence || 'unknown'}.{' '}
                          {report.aiClassification.note || 'This did not verify the incident.'}
                        </DataCaveat>
                      )}
                      {officer && report.phone && (
                        <p className="text-[10px] text-on-surface-variant">
                          Officer-only contact: <strong>{report.phone}</strong> — do not publish or redistribute.
                        </p>
                      )}
                      {report.verificationStatus === 'DUPLICATE_SUSPECTED' && (
                        <DataCaveat tone="warning">
                          Possible duplicate of a nearby report in the last 3 hours. This is a warning,
                          not a rejection. Corroborate only if you can independently confirm the situation.
                        </DataCaveat>
                      )}
                      {report.audits?.length > 0 && (
                        <details className="text-[10.5px]">
                          <summary className="font-bold cursor-pointer">Audit trail ({report.audits.length})</summary>
                          <ul className="mt-1 space-y-0.5 text-on-surface-variant">
                            {report.audits.map((audit: any) => (
                              <li key={audit.id}>
                                {formatDateTime(audit.createdAt)} · {audit.action} · {audit.actorRole || 'SYSTEM'}
                                {audit.note ? ` — ${audit.note}` : ''}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {similar[report.id]?.length > 0 && (
                        <div className="rounded-lg border border-outline-variant/40 px-2.5 py-2 text-[10.5px]">
                          <strong>Similar nearby reports:</strong>
                          <ul className="mt-1 space-y-0.5 text-on-surface-variant">
                            {similar[report.id].slice(0, 4).map((candidate) => (
                              <li key={candidate.id}>
                                {candidate.distanceKm} km · {candidate.minutesApart} min apart ·{' '}
                                {candidate.verificationStatus.replace(/_/g, ' ')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold" htmlFor={`note-${report.id}`}>
                          Corroboration / decision note
                        </label>
                        <textarea
                          id={`note-${report.id}`}
                          rows={2}
                          value={notes[report.id] || ''}
                          onChange={(e) =>
                            setNotes((current) => ({ ...current, [report.id]: e.target.value }))
                          }
                          placeholder="What did you observe or verify? A note is required for officer decisions."
                          className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-[11px] resize-y"
                        />
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {!final && (
                          <button
                            type="button"
                            onClick={() => act(report, 'CORROBORATE')}
                            disabled={busy}
                            className={secondaryButton}
                          >
                            <span className="material-symbols-outlined text-[15px]">done_all</span>
                            I can corroborate
                          </button>
                        )}
                        {officer && !['OFFICER_VERIFIED', 'REJECTED', 'RESOLVED'].includes(report.verificationStatus) && (
                          <button
                            type="button"
                            onClick={() => act(report, 'VERIFY')}
                            disabled={busy}
                            className={primaryButton}
                          >
                            <span className="material-symbols-outlined text-[15px]">verified</span>
                            Officer verify
                          </button>
                        )}
                        {officer && !['REJECTED', 'RESOLVED'].includes(report.verificationStatus) && (
                          <button
                            type="button"
                            onClick={() => act(report, 'REJECT')}
                            disabled={busy}
                            className="inline-flex min-h-[44px] items-center gap-1.5 px-3.5 py-2 rounded-xl border border-error/30 text-error text-xs font-bold hover:bg-error-container disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[15px]">block</span>
                            Reject with reason
                          </button>
                        )}
                        {officer && ['OFFICER_VERIFIED', 'CORROBORATED', 'DUPLICATE_SUSPECTED'].includes(report.verificationStatus) && (
                          <button
                            type="button"
                            onClick={() => act(report, 'RESOLVE')}
                            disabled={busy}
                            className={secondaryButton}
                          >
                            <span className="material-symbols-outlined text-[15px]">task_alt</span>
                            Mark resolved
                          </button>
                        )}
                        {busy && <span className="text-[10px] text-on-surface-variant self-center">Recording…</span>}
                      </div>
                      <p className="text-[10px] text-on-surface-variant">
                        {report.privacy}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      {summary?.possibleDuplicateGroups?.length > 0 && (
        <SectionCard
          title="Possible duplicate groups"
          subtitle="Proximity is a signal for review, not proof of duplication."
          icon="content_copy"
        >
          <div className="flex flex-col gap-1.5">
            {summary.possibleDuplicateGroups.map((group: any) => (
              <div key={group.reportId} className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-3 py-2 text-[10.5px] text-[#7c2d12]">
                <strong className="break-all">{group.reportId}</strong> has {group.candidates.length} similar report
                {group.candidates.length === 1 ? '' : 's'} within 500 m / 3 hours.
                <span className="block mt-0.5">
                  {group.candidates.slice(0, 3).map((c: any) => `${c.distanceKm} km, ${c.minutesApart} min`).join(' · ')}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Community timeline" subtitle="Submission volume by hour (UTC)." icon="timeline">
        {summary?.timeline?.length ? (
          <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
            {summary.timeline.slice(-48).map((point: any) => {
              const max = Math.max(1, ...summary.timeline.map((p: any) => p.count));
              return (
                <div
                  key={point.hour}
                  title={`${point.hour}: ${point.count} report(s)`}
                  className="flex-1 rounded-t bg-primary/70 min-w-[3px]"
                  style={{ height: `${Math.max(4, (point.count / max) * 100)}%` }}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant">No reports in this window.</p>
        )}
      </SectionCard>
    </div>
  );
};
