import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';
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

const RESPONSE_LABELS: Record<string, string> = {
  RECEIVED: 'Received / seen',
  SAFE: 'I am safe',
  NEED_ASSISTANCE: 'Need assistance',
  CANNOT_EVACUATE: 'Cannot evacuate',
  NEED_INFO: 'Need more information',
};

const RESPONSE_TONE: Record<string, 'primary' | 'info' | 'warning' | 'danger' | 'neutral'> = {
  RECEIVED: 'info',
  SAFE: 'primary',
  NEED_ASSISTANCE: 'warning',
  CANNOT_EVACUATE: 'danger',
  NEED_INFO: 'neutral',
};

export const AcknowledgementPanel: React.FC<{
  district: string;
  initialSummary?: any;
  onChanged?: () => void;
}> = ({ district, initialSummary, onChanged }) => {
  const [summary, setSummary] = useState<any>(initialSummary || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const response = await apiFetch<any>(
        `/alert-acknowledgements/summary?district=${encodeURIComponent(district)}&days=30`
      );
      setSummary(response);
    } catch (err: any) {
      setError(err.message || 'Acknowledgement data is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  const convert = async (acknowledgementId: string) => {
    setBusyId(acknowledgementId);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch<any>(`/alert-acknowledgements/${acknowledgementId}/incident`, {
        method: 'POST',
      });
      setNotice(response.message);
      await load();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || 'Could not create an assistance follow-up.');
    } finally {
      setBusyId(null);
    }
  };

  const subscriptions = Number(summary?.districtSubscriptions || 0);
  const responders = Number(summary?.distinctResponders || 0);
  const participation = subscriptions > 0 ? Math.round((responders / subscriptions) * 100) : null;
  const byResponse = summary?.byResponse || {};

  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Metric
          label="Citizen acknowledgements"
          value={summary?.totalAcknowledgements ?? 0}
          hint="Explicit responses, 30 days"
          tone="primary"
        />
        <Metric
          label="Distinct responders"
          value={summary?.distinctResponders ?? 0}
          hint={
            participation === null
              ? 'No district subscriptions recorded'
              : `${participation}% of ${subscriptions} district subscriptions`
          }
          tone="info"
        />
        <Metric
          label="Assistance requests"
          value={summary?.assistanceRequests ?? 0}
          hint="Need assistance or cannot evacuate"
          tone={(summary?.assistanceRequests || 0) > 0 ? 'warning' : 'neutral'}
        />
        <Metric
          label="Safe responses"
          value={summary?.safeReports ?? 0}
          hint="Citizen-reported, not verified"
          tone="primary"
        />
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
        <SectionCard
          title="Response breakdown"
          subtitle="Acknowledgement is not a verified incident or proof a warning was read."
          icon="how_to_reg"
          actions={
            <button type="button" onClick={load} disabled={loading} className={secondaryButton}>
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              Refresh
            </button>
          }
        >
          {loading && !summary ? (
            <p className="text-xs text-on-surface-variant">Loading acknowledgement responses…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.keys(RESPONSE_LABELS).map((key) => {
                const value = Number(byResponse[key] || 0);
                const total = Math.max(1, Number(summary?.totalAcknowledgements || 0));
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="font-semibold">{RESPONSE_LABELS[key]}</span>
                      <StatusBadge tone={RESPONSE_TONE[key]}>{value}</StatusBadge>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          key === 'CANNOT_EVACUATE'
                            ? 'bg-error'
                            : key === 'NEED_ASSISTANCE'
                              ? 'bg-[#b45309]'
                              : key === 'SAFE'
                                ? 'bg-primary'
                                : 'bg-[#1d4ed8]'
                        }`}
                        style={{ width: `${(value / total) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <DataCaveat tone="info">
                <strong>Delivery is measured separately.</strong>{' '}
                Push provider log: {summary?.pushDeliveriesMeasured ?? 0} delivery events. Delivery is
                not proof that a citizen read, understood, or acted on a warning.
              </DataCaveat>
              {summary?.deliveryNote && (
                <p className="text-[10px] text-on-surface-variant">{summary.deliveryNote}</p>
              )}
              {summary?.privacyNote && (
                <p className="text-[10px] text-on-surface-variant">{summary.privacyNote}</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Assistance follow-up queue"
          subtitle="District-level responses requiring human contact. No automatic dispatch."
          icon="support_agent"
        >
          {loading ? (
            <p className="text-xs text-on-surface-variant">Loading queue…</p>
          ) : !summary?.assistanceQueue?.length ? (
            <EmptyState
              icon="support_agent"
              title="No open assistance responses"
              body="Citizens who select “need assistance” or “cannot evacuate” appear here for officer follow-up."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {summary.assistanceQueue.map((item: any) => (
                <div
                  key={item.id}
                  className={`rounded-xl border px-3 py-2.5 ${
                    item.response === 'CANNOT_EVACUATE'
                      ? 'border-error/30 bg-error-container/40'
                      : 'border-[#fed7aa] bg-[#fff7ed]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge tone={RESPONSE_TONE[item.response] || 'warning'}>
                        {(RESPONSE_LABELS[item.response] || item.response).replace(/_/g, ' ')}
                      </StatusBadge>
                      <span className="text-[11px] font-bold">{item.citizenName}</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant">{formatDateTime(item.createdAt)}</span>
                  </div>
                  {item.note && <p className="text-[11px] mt-1">{item.note}</p>}
                  <p className="text-[10px] text-on-surface-variant mt-1">{item.caution}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {item.contactPhone && (
                      <a
                        href={`tel:${item.contactPhone}`}
                        className="inline-flex min-h-[44px] items-center text-xs font-bold text-primary underline"
                      >
                        Call {item.contactPhone}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => convert(item.id)}
                      disabled={busyId === item.id}
                      className={primaryButton}
                    >
                      <span className="material-symbols-outlined text-[15px]">assignment_add</span>
                      {busyId === item.id ? 'Creating…' : 'Create follow-up incident'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <DataCaveat tone="warning">
        Never treat acknowledgement counts as proof that everyone received or understood a warning.
        Contact details are officer-only. Converting an acknowledgement creates an operational
        follow-up at district level; it does not verify a precise location and does not dispatch a team.
      </DataCaveat>
    </div>
  );
};
