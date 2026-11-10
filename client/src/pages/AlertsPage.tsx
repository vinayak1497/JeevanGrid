import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { LeafletMap } from '../components/LeafletMap';
import { subscribeForDistrict } from '../utils/push';
import { useAuth } from '../context/AuthContext';

interface OfficialAlert {
  id: string;
  severity: string;
  eventType: string | null;
  hazardType: string;
  affectedArea: string | null;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  geometryPrecision?: 'EXACT' | 'DISTRICT';
  areaLabel?: string;
  title: string;
  headline: string | null;
  description: string;
  instruction: string | null;
  urgency: string | null;
  certainty: string | null;
  authority: string | null;
  source: string;
  sourceType: string;
  sourceAlertId: string;
  sourceUrl: string | null;
  sourceReference: string | null;
  status: string;
  issuedAt: string;
  issuedIST: string | null;
  effectiveAt: string | null;
  onsetAt: string | null;
  expiresAt: string | null;
  validUntilIST: string | null;
  lastCheckedAt: string;
  lastCheckedIST: string | null;
  ingestedAt: string;
  verification: { verified: boolean; live: boolean; stale: boolean; label: string };
}

interface SourceHealth {
  name: string;
  authority: string;
  enabled: boolean;
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'CONFIGURATION_REQUIRED';
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastDataAt: string | null;
  lastError: string | null;
  responseTimeMs: number | null;
  recordsFetched: number;
  recordsAccepted: number;
  recordsRejected: number;
}

interface OfficialResponse {
  alerts: OfficialAlert[];
  staleCount?: number;
  generatedAt: string;
  lastSuccessfulSync: string | null;
  demoMode?: boolean;
  sources: SourceHealth[];
}

function formatIST(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' IST'
  );
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return 'never';
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SOURCE_LABEL: Record<string, string> = {
  SACHET: 'NDMA SACHET',
  IMD: 'India Meteorological Department',
  CWC: 'Central Water Commission',
  INCOIS: 'INCOIS',
};

const ACK_OPTIONS = [
  ['RECEIVED', 'I have seen this warning', 'bg-surface-container-high text-on-surface'],
  ['SAFE', 'I am safe', 'bg-[#e9f3ed] text-primary'],
  ['NEED_ASSISTANCE', 'I need assistance', 'bg-[#fff7ed] text-[#9a3412]'],
  ['CANNOT_EVACUATE', 'I cannot evacuate', 'bg-error-container text-on-error-container'],
  ['NEED_INFO', 'I need more information', 'bg-[#eef2ff] text-[#3730a3]'],
] as const;

const ACK_LABELS: Record<string, string> = {
  RECEIVED: 'seen',
  SAFE: 'safe',
  NEED_ASSISTANCE: 'needs assistance',
  CANNOT_EVACUATE: 'cannot evacuate',
  NEED_INFO: 'needs information',
};

export const AlertsPage: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<OfficialAlert[]>([]);
  const [demoAlerts, setDemoAlerts] = useState<any[]>([]);
  const [myAcks, setMyAcks] = useState<Record<string, string>>({});
  const [ackNotes, setAckNotes] = useState<Record<string, string>>({});
  const [ackMsg, setAckMsg] = useState<Record<string, string>>({});
  const [acking, setAcking] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceHealth[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [staleCount, setStaleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState('All');
  const [hazardFilter, setHazardFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [districtFilter, setDistrictFilter] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subscribeMsg, setSubscribeMsg] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [stageMsg, setStageMsg] = useState<Record<string, string>>({});
  const [staging, setStaging] = useState<Record<string, boolean>>({});
  const [searchParams] = useSearchParams();

  // Deep link from push notifications: ?sourceAlertId=… highlights the card.
  const highlightId = searchParams.get('sourceAlertId');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      if (stateFilter !== 'All') qp.append('state', stateFilter);
      if (districtFilter.trim()) qp.append('district', districtFilter.trim());
      if (hazardFilter !== 'All') qp.append('hazardType', hazardFilter);
      if (severityFilter !== 'All') qp.append('severity', severityFilter);
      const res = await apiFetch<OfficialResponse>(`/alerts/official?${qp.toString()}`);
      setAlerts(res.alerts || []);
      setSources(res.sources || []);
      setGeneratedAt(res.generatedAt || null);
      setLastSync(res.lastSuccessfulSync || null);
      setStaleCount(res.staleCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load official warnings.');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, districtFilter, hazardFilter, severityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ alerts: any[] }>('/alerts/demo-scenarios')
      .then((response) => {
        if (!cancelled) setDemoAlerts(response.alerts || []);
      })
      .catch(() => {
        if (!cancelled) setDemoAlerts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setMyAcks({});
      return;
    }
    let cancelled = false;
    apiFetch<{ acknowledgements: any[] }>('/alert-acknowledgements/mine')
      .then((response) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const ack of response.acknowledgements || []) {
          if (!map[ack.alertId]) map[ack.alertId] = ack.response;
        }
        setMyAcks(map);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleAcknowledgement(alertId: string, response: string) {
    if (!user) {
      setAckMsg((prev) => ({
        ...prev,
        [alertId]: 'Sign in to record an acknowledgement. Your response helps officers follow up.',
      }));
      return;
    }
    const key = `${alertId}-${response}`;
    setAcking(key);
    setAckMsg((prev) => ({ ...prev, [alertId]: '' }));
    try {
      const result = await apiFetch<any>('/alert-acknowledgements', {
        method: 'POST',
        body: JSON.stringify({
          alertId,
          response,
          note: (ackNotes[alertId] || '').trim() || undefined,
        }),
      });
      setMyAcks((prev) => ({ ...prev, [alertId]: response }));
      setAckMsg((prev) => ({ ...prev, [alertId]: result.message }));
    } catch (err: any) {
      setAckMsg((prev) => ({ ...prev, [alertId]: err.message || 'Could not record acknowledgement.' }));
    } finally {
      setAcking(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await apiFetch('/alerts/sync', { method: 'POST' });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Synchronization failed.';
      setError(
        /401|403|authentication|forbidden/i.test(msg)
          ? 'Manual sync needs an EOC sign-in (District Officer / State EOC). Automatic polling continues in the background.'
          : msg
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubscribe() {
    const district = districtFilter.trim() || (stateFilter !== 'All' ? stateFilter : '');
    if (!district) {
      setSubscribeMsg('Enter a district (or pick a state) first, then subscribe.');
      return;
    }
    setSubscribing(true);
    setSubscribeMsg(null);
    try {
      const r = await subscribeForDistrict(district);
      setSubscribeMsg(r.message);
    } catch (err) {
      setSubscribeMsg(
        /401|authentication/i.test(err instanceof Error ? err.message : '')
          ? 'Sign in first — subscriptions are saved to your account.'
          : (err instanceof Error ? err.message : 'Subscription failed.')
      );
    } finally {
      setSubscribing(false);
    }
  }

  // Districts currently under warning — clicking one filters the list + map.
  const warnedDistricts = Array.from(
    new Set(alerts.map((a) => a.district).filter(Boolean))
  ).slice(0, 12);

  async function handleStage(alertId: string, district: string, state: string) {
    setStaging((p) => ({ ...p, [alertId]: true }));
    setStageMsg((p) => ({ ...p, [alertId]: '' }));
    try {
      const res = await apiFetch<{ ok: boolean; incidentId: string; message: string }>(
        `/alerts/official/${alertId}/stage`,
        { method: 'POST' }
      );
      setStageMsg((p) => ({
        ...p,
        [alertId]: `${res.message} Incident ${res.incidentId} now tracks the district response.`,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Staging failed.';
      setStageMsg((p) => ({
        ...p,
        [alertId]: /401|403|authentication|forbidden/i.test(msg)
          ? 'Sign in as District Officer / State EOC to stage. Citizens: check your district risk instead.'
          : msg,
      }));
    } finally {
      setStaging((p) => ({ ...p, [alertId]: false }));
    }
  }

  const mapMarkers = alerts.map((a) => ({
    id: a.id,
    lat: a.latitude,
    lng: a.longitude,
    title: a.title,
    subtitle: `${a.hazardType} (${a.severity}) • ${a.district}, ${a.state}`,
    type: 'ALERT' as const,
    details: {
      District: a.district,
      Severity: a.severity,
      Source: SOURCE_LABEL[a.source] || a.source,
      Status: a.verification.label,
      Area: a.areaLabel || (a.geometryPrecision === 'DISTRICT' ? 'District-level area' : 'Source geometry'),
    },
  }));

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'WARNING':
        return 'bg-error-container text-on-error-container border border-error/30';
      case 'WATCH':
        return 'bg-surface-container-highest text-tertiary-container border border-outline-variant/30';
      default:
        return 'bg-secondary-container text-on-secondary-container border border-secondary/30';
    }
  };

  const statusDot = (s: SourceHealth['status']) =>
    s === 'HEALTHY'
      ? 'bg-green-600'
      : s === 'DEGRADED'
        ? 'bg-amber-500'
        : s === 'CONFIGURATION_REQUIRED'
          ? 'bg-purple-500'
          : 'bg-red-500';

  const statusText = (s: SourceHealth) => {
    if (s.status === 'HEALTHY') return 'Healthy';
    if (s.status === 'DEGRADED') return 'Degraded';
    if (s.status === 'CONFIGURATION_REQUIRED') return 'Needs configuration';
    return s.enabled ? 'Unavailable' : 'Disabled';
  };

  return (
    <main className="jg-page min-h-[100dvh] bg-surface pb-space-3xl">
      {/* Header */}
      <section className="bg-surface-container-low py-space-xl border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="inline-flex min-h-[44px] items-center text-xs text-on-surface-variant hover:text-on-surface">Home</Link>
            <span className="text-xs text-on-surface-variant">/</span>
            <span className="text-xs text-primary font-bold">Official Warnings</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-headline-xl text-3xl font-bold text-on-surface tracking-tight">
                Active Official Warnings
              </h1>
              <p className="font-body-sm text-sm text-on-surface-variant mt-1 max-w-2xl">
                {loading ? 'Checking authoritative sources…' : `${alerts.length} verified warning${alerts.length === 1 ? '' : 's'}`}
                {generatedAt ? ` • Last synchronized: ${formatIST(lastSync || generatedAt)}` : ''}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Every warning below is traceable to its issuing authority. JeevanGrid reports source
                traceability — never 100% accuracy.
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="h-11 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
            >
              {syncing ? 'Synchronizing…' : 'Sync now'}
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm mt-space-lg max-w-4xl">
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant block mb-1">State / Territory</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
              >
                <option value="All">All States</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Assam">Assam</option>
                <option value="Bihar">Bihar</option>
                <option value="Odisha">Odisha</option>
                <option value="Himachal Pradesh">Himachal Pradesh</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Hazard Category</label>
              <select
                value={hazardFilter}
                onChange={(e) => setHazardFilter(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
              >
                <option value="All">All Hazards</option>
                <option value="Flood">Flood &amp; Surge</option>
                <option value="Rain">Heavy Rainfall</option>
                <option value="Cyclone">Tropical Cyclone</option>
                <option value="Heatwave">Heatwave Index</option>
                <option value="Landslide">Landslide &amp; Rockfall</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant block mb-1">Severity Level</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
              >
                <option value="All">All Severities</option>
                <option value="CRITICAL">Critical Danger</option>
                <option value="WARNING">Warning</option>
                <option value="WATCH">Watch / Advisory</option>
                <option value="INFO">Informational</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant block mb-1">District</label>
              <input
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                placeholder="e.g. Darbhanga"
                className="w-full h-11 px-3 rounded-xl bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="h-11 px-4 rounded-xl bg-secondary text-on-secondary text-xs font-bold disabled:opacity-50"
            >
              {subscribing ? 'Saving…' : 'Notify me about official warnings here'}
            </button>
            {subscribeMsg && <span className="text-[11px] text-on-surface-variant">{subscribeMsg}</span>}
          </div>
        </div>
      </section>

      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-xl flex flex-col gap-space-xl">
        {/* Source health */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-headline-sm text-base font-bold text-on-surface">Data Sources</h3>
            <span className="text-[11px] text-on-surface-variant">
              Last synchronization: {lastSync ? formatIST(lastSync) : '—'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {sources.length === 0 && (
              <span className="text-[11px] text-on-surface-variant">Source health unavailable.</span>
            )}
            {sources.map((s) => (
              <div key={s.name} className="rounded-xl border border-outline-variant/20 p-3 bg-surface">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusDot(s.status)}`} />
                  <span className="text-xs font-bold text-on-surface">{s.name}</span>
                  <span className="text-[11px] text-on-surface-variant ml-auto">{statusText(s)}</span>
                </div>
                <div className="text-[11px] text-on-surface-variant mt-1">{s.authority}</div>
                <div className="text-[11px] text-on-surface-variant mt-1">
                  Checked {timeAgo(s.lastSuccessAt || s.lastAttemptAt)}
                  {s.lastError ? ` • ${s.lastError.slice(0, 120)}` : ''}
                </div>
              </div>
            ))}
          </div>
          {error && <div className="text-[11px] text-red-600 mt-2">{error}</div>}
        </div>

        {/* Map */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-base font-bold text-on-surface">Spatial Alert Telemetry</h3>
            <span className="text-xs text-on-surface-variant">Showing {alerts.length} verified warnings</span>
          </div>
          {warnedDistricts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {warnedDistricts.map((d) => (
                <button
                  key={d}
                  onClick={() => setDistrictFilter(d === districtFilter ? '' : d)}
                  className={`min-h-[44px] px-3 py-2 rounded-full text-xs font-bold border transition-colors ${
                    d === districtFilter
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/30 hover:border-primary'
                  }`}
                  title={`Show warnings for ${d}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <LeafletMap
            center={[21.0, 78.0]}
            zoom={5}
            markers={mapMarkers}
            className="h-80 w-full"
          />
          <p className="text-[10px] text-on-surface-variant">
            Markers use source centroids. Warnings labelled “District-level area” carry district/LGD
            identifiers without an exact polygon — no boundary is invented.
          </p>
        </div>

        {/* Official list */}
        <div className="flex flex-col gap-space-md">
          <h2 className="font-headline-sm text-lg font-bold text-on-surface">
            Active Official Warnings ({alerts.length} verified)
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-on-surface-variant">
              Verifying warnings against authoritative sources…
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-space-xl text-center rounded-xl bg-surface-container-low border border-outline-variant/20">
              <div className="text-sm font-bold text-on-surface">No verified official warnings are currently active.</div>
              <div className="text-xs text-on-surface-variant mt-2">
                {staleCount > 0
                  ? `${staleCount} bulletin(s) withheld as stale (source not recently synchronized) — shown only after re-verification.`
                  : 'Sources were checked successfully and reported no active warnings for your filters.'}
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {sources.map((s) => (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-outline-variant/30 bg-surface-container-lowest"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(s.status)}`} />
                    {s.name} {s.status === 'HEALTHY' ? '✓' : s.status === 'CONFIGURATION_REQUIRED' ? '⚙ needs setup' : '⚠ temporarily unavailable'}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {alerts.map((alert) => (
                <article
                  key={alert.id}
                  id={`alert-${alert.id}`}
                  className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border flex flex-col justify-between ${
                    highlightId && alert.sourceAlertId === highlightId
                      ? 'border-primary ring-2 ring-primary/40'
                      : 'border-outline-variant/30'
                  }`}
                >
                  <div>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 break-words text-[11px] font-bold uppercase tracking-wider text-secondary">
                        [{alert.severity}] {alert.eventType || alert.hazardType} •{' '}
                        {alert.affectedArea || `${alert.district}, ${alert.state}`}
                      </span>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getSeverityBadge(alert.severity)}`}
                      >
                        {alert.severity}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                      {alert.areaLabel || (alert.geometryPrecision === 'DISTRICT' ? 'District-level area' : 'Source geometry')}
                    </div>

                    <h3 className="font-headline-sm text-base font-bold text-on-surface leading-snug">
                      {alert.headline || alert.title}
                    </h3>
                    <p className="font-body-sm text-xs text-on-surface-variant mt-2 leading-relaxed">
                      {alert.description}
                    </p>
                    {alert.instruction && (
                      <p className="text-xs text-on-surface mt-2 leading-relaxed">
                        <strong>Instructions:</strong> {alert.instruction}
                      </p>
                    )}

                    <dl className="mt-3 space-y-1 text-[11px] text-on-surface-variant">
                      <div className="flex gap-1.5"><dt className="font-bold">Issued by:</dt><dd>{alert.authority || SOURCE_LABEL[alert.source] || alert.source}</dd></div>
                      <div className="flex gap-1.5"><dt className="font-bold">Issued:</dt><dd>{alert.issuedIST || formatIST(alert.issuedAt)}</dd></div>
                      <div className="flex gap-1.5"><dt className="font-bold">Last checked:</dt><dd>{alert.lastCheckedIST || formatIST(alert.lastCheckedAt)} ({timeAgo(alert.lastCheckedAt)})</dd></div>
                      <div className="flex gap-1.5"><dt className="font-bold">Valid until:</dt><dd>{alert.validUntilIST || formatIST(alert.expiresAt)}</dd></div>
                      <div className="flex gap-1.5">
                        <dt className="font-bold">Source status:</dt>
                        <dd>{alert.verification.live ? '✓ Verified official source • LIVE' : '⚠ Verified but STALE — re-checking'}</dd>
                      </div>
                      <div className="flex gap-1.5"><dt className="font-bold">Source alert ID:</dt><dd className="break-all">{alert.sourceAlertId}</dd></div>
                    </dl>

                    {alert.sourceUrl && (
                      <a
                        href={alert.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex min-h-[44px] items-center text-xs font-bold text-primary hover:underline"
                      >
                        View Original Bulletin →
                      </a>
                    )}

                    <div className="mt-3 rounded-lg border border-primary/20 bg-[#f7fbf8] p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                          Acknowledge this warning
                        </span>
                        {myAcks[alert.id] && (
                          <span className="text-[10px] font-semibold text-primary">
                            Your last response: {ACK_LABELS[myAcks[alert.id]] || myAcks[alert.id]}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">
                        Optional. An acknowledgement is not a verified incident and does not dispatch a
                        team. Call 112 for immediate danger.
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {ACK_OPTIONS.map(([value, label, classes]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleAcknowledgement(alert.id, value)}
                            disabled={acking === `${alert.id}-${value}`}
                            aria-pressed={myAcks[alert.id] === value}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 disabled:opacity-50 ${classes} ${
                              myAcks[alert.id] === value ? 'ring-2 ring-primary/30' : ''
                            }`}
                          >
                            {acking === `${alert.id}-${value}` ? 'Saving…' : label}
                          </button>
                        ))}
                      </div>
                      <input
                        value={ackNotes[alert.id] || ''}
                        onChange={(e) =>
                          setAckNotes((prev) => ({ ...prev, [alert.id]: e.target.value }))
                        }
                        placeholder={user ? 'Optional note for officers (e.g. street or landmark)' : 'Sign in to acknowledge'}
                        disabled={!user}
                        className="mt-1.5 h-11 w-full rounded-xl border border-outline-variant/40 bg-white px-3 text-sm disabled:bg-surface-container-low"
                      />
                      {ackMsg[alert.id] && (
                        <p className="text-[10px] font-semibold text-on-surface mt-1">{ackMsg[alert.id]}</p>
                      )}
                      {!user && (
                        <Link to="/login" className="mt-1 inline-flex min-h-[44px] items-center text-xs font-bold text-primary underline">
                          Sign in to acknowledge
                        </Link>
                      )}
                    </div>

                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [alert.id]: !p[alert.id] }))}
                      className="mt-3 inline-flex min-h-[44px] items-center text-xs font-bold text-on-surface-variant hover:text-on-surface"
                      aria-expanded={!!expanded[alert.id]}
                    >
                      {expanded[alert.id] ? 'Hide Source & Verification ▲' : 'Source & Verification ▼'}
                    </button>
                    {expanded[alert.id] && (
                      <div className="mt-2 rounded-lg border border-outline-variant/20 bg-surface p-3 text-[11px] text-on-surface-variant space-y-1">
                        <div><strong>Source:</strong> {SOURCE_LABEL[alert.source] || alert.source}</div>
                        <div><strong>Source type:</strong> Official Government {alert.source === 'SACHET' ? 'CAP Feed' : 'Warning'}</div>
                        <div className="break-all"><strong>Alert ID:</strong> {alert.sourceAlertId}</div>
                        <div><strong>Issued:</strong> {alert.issuedIST || formatIST(alert.issuedAt)}</div>
                        <div><strong>Last checked:</strong> {alert.lastCheckedIST || formatIST(alert.lastCheckedAt)}</div>
                        <div><strong>Status:</strong> {alert.status}{alert.verification.stale ? ' (STALE — awaiting source re-confirmation)' : ' (Active)'}</div>
                        {alert.urgency && <div><strong>Urgency:</strong> {alert.urgency}</div>}
                        {alert.certainty && <div><strong>Certainty:</strong> {alert.certainty}</div>}
                        {alert.sourceReference && <div className="break-all"><strong>Reference:</strong> {alert.sourceReference}</div>}
                        <div>
                          <strong>Original: </strong>
                          {alert.sourceUrl ? (
                            <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center font-bold text-primary hover:underline">View official source</a>
                          ) : 'available via issuing authority portal'}
                        </div>
                        <div className="pt-1 text-[10px]">
                          To verify: open the original bulletin, match the Source alert ID and issue time above,
                          then confirm this card's issue/expiry times agree.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-space-md pt-space-sm border-t border-outline-variant/20 flex flex-col gap-1.5 text-[11px] text-on-surface-variant">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span>Source: <strong>{SOURCE_LABEL[alert.source] || alert.source}</strong> (single-authority attribution)</span>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/risk/${encodeURIComponent(alert.district || alert.state)}`}
                          className="inline-flex min-h-[44px] items-center font-bold text-secondary hover:underline"
                          title="Check JeevanGrid risk intelligence for this district"
                        >
                          Check district risk
                        </Link>
                        <button
                          onClick={() => handleStage(alert.id, alert.district, alert.state)}
                          disabled={!!staging[alert.id]}
                          className="inline-flex min-h-[44px] items-center gap-0.5 font-bold text-primary hover:underline disabled:opacity-50"
                          title="Stage JeevanGrid's operational district response for this official warning (EOC roles)"
                        >
                          <span>{staging[alert.id] ? 'Staging…' : 'Stage for District Response'}</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                    {stageMsg[alert.id] && (
                      <span className="text-[11px] text-on-surface">{stageMsg[alert.id]}</span>
                    )}
                    <span className="text-[10px]">
                      “Stage for District Response” starts JeevanGrid's internal EOC workflow — it does not
                      mean JeevanGrid issued this warning.
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Simulation acknowledgements — explicitly not official warnings */}
        {demoAlerts.length > 0 && (
          <div className="mt-space-xl rounded-2xl border border-[#fbbf24] bg-[#fffbeb] p-space-lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] border border-[#fbbf24] text-[10px] font-bold uppercase tracking-wide text-[#92400e]">
                SIMULATION
              </span>
              <h2 className="font-headline-sm text-base font-bold text-[#78350f]">
                Simulation alert acknowledgement
              </h2>
            </div>
            <p className="text-[11px] text-[#78350f] mt-1 max-w-3xl">
              These are <strong>demo records, not official warnings</strong>. They exist only to test the
              acknowledgement workflow. All entries are labelled SIMULATION. Do not treat them as real
              hazard information; check the official warnings above and the issuing authority.
            </p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {demoAlerts.slice(0, 4).map((alert) => (
                <article
                  key={alert.id}
                  className="rounded-xl border border-[#fbbf24]/70 bg-white/80 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#92400e]">
                      {alert.severity} · {alert.hazardType || 'Hazard'}
                    </span>
                    <span className="text-[10px] font-bold text-[#92400e]">
                      SIMULATION
                    </span>
                  </div>
                  <h3 className="text-[12px] font-bold text-on-surface mt-1">{alert.title}</h3>
                  <p className="text-[10.5px] text-on-surface-variant mt-0.5">
                    {alert.district}, {alert.state} · {alert.source}
                  </p>
                  <p className="text-[10.5px] text-on-surface-variant mt-1 line-clamp-2">
                    {alert.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ACK_OPTIONS.map(([value, label, classes]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleAcknowledgement(alert.id, value)}
                        disabled={acking === `${alert.id}-${value}`}
                        aria-pressed={myAcks[alert.id] === value}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border border-[#fbbf24]/50 disabled:opacity-50 ${classes} ${
                          myAcks[alert.id] === value ? 'ring-2 ring-[#b45309]/40' : ''
                        }`}
                      >
                        {acking === `${alert.id}-${value}` ? 'Saving…' : label}
                      </button>
                    ))}
                  </div>
                  {myAcks[alert.id] && (
                    <p className="text-[10px] font-semibold text-[#92400e] mt-1">
                      Recorded response: {ACK_LABELS[myAcks[alert.id]] || myAcks[alert.id]} (simulation)
                    </p>
                  )}
                  {ackMsg[alert.id] && (
                    <p className="text-[10px] font-semibold text-on-surface mt-1">{ackMsg[alert.id]}</p>
                  )}
                  {!user && (
                    <Link to="/login" className="mt-1 inline-flex min-h-[44px] items-center text-xs font-bold text-[#92400e] underline">
                      Sign in to test acknowledgement
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {/* JeevanGrid intelligence — kept strictly separate */}
        <div className="rounded-2xl p-space-lg border border-dashed border-outline-variant/40 bg-surface-container-low">
          <h3 className="font-headline-sm text-base font-bold text-on-surface">JeevanGrid Risk Intelligence</h3>
          <p className="text-xs text-on-surface-variant mt-1 max-w-3xl">
            Modelled flood, heat and weather risk for your district — calculated from rainfall, river data,
            terrain, historical risk and forecasts. <strong>This is a JeevanGrid risk assessment and is not
            an official government warning.</strong>
          </p>
          <Link to="/risk/Mumbai" className="mt-2 inline-flex min-h-[44px] items-center text-xs font-bold text-primary hover:underline">
            Check JeevanGrid risk for your district →
          </Link>
        </div>

        {/* Community reports — kept strictly separate */}
        <div className="rounded-2xl p-space-lg border border-dashed border-outline-variant/40 bg-surface-container-low">
          <h3 className="font-headline-sm text-base font-bold text-on-surface">Community &amp; Field Reports</h3>
          <p className="text-xs text-on-surface-variant mt-1 max-w-3xl">
            Citizen, volunteer and field-officer reports appear with an explicit verification state
            (Unverified → Verified Community Report) and are <strong>never</strong> presented as official warnings.
          </p>
          <Link to="/report-emergency" className="mt-2 inline-flex min-h-[44px] items-center text-xs font-bold text-primary hover:underline">
            Submit a field report →
          </Link>
        </div>
      </div>
    </main>
  );
};
