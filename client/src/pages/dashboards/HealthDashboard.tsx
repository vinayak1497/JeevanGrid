import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface HealthIndicator {
  key: string;
  label: string;
  level: string;
  score: number | null;
  evidence: string[];
  contributors: { variable: string; value: string; influence: string }[];
  insufficientData: boolean;
  observedAt: string | null;
}

function levelBadge(level: string): string {
  switch (level) {
    case 'SEVERE':
      return 'bg-error text-on-error';
    case 'HIGH':
      return 'bg-error-container text-on-error-container';
    case 'MODERATE':
      return 'bg-[#fef3c7] text-[#92400e]';
    case 'LOW':
      return 'bg-[#e9f3ed] text-primary';
    default:
      return 'bg-surface-container-high text-on-surface-variant';
  }
}

function scoreBar(level: string, score: number | null): string {
  if (score === null) return 'bg-outline-variant';
  switch (level) {
    case 'SEVERE':
    case 'HIGH':
      return 'bg-error';
    case 'MODERATE':
      return 'bg-[#d97706]';
    default:
      return 'bg-surface-tint';
  }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' IST'
  );
}

const SCENARIOS = [
  { key: 'rain25', label: '+25% rainfall' },
  { key: 'rain50', label: '+50% rainfall' },
  { key: 'heat2', label: '+2°C temperature' },
  { key: 'aqi50', label: 'AQI +50' },
];

export const HealthDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locationInput, setLocationInput] = useState('');
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [scenarioKey, setScenarioKey] = useState<string | null>(null);
  const [scenario, setScenario] = useState<any>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const loadHealthData = useCallback(async () => {
    try {
      const res = await apiFetch('/dashboards/health');
      setData(res);
      if (!locationInput && res?.healthIntelligence?.location) {
        setLocationInput(res.healthIntelligence.location);
      }
    } catch (err) {
      console.error('Failed to load health dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadHealthData();
  }, [loadHealthData]);

  // Live assessment embedded in the dashboard response (officer's district).
  // A custom location query replaces it below — both are deterministic-first.
  const hi = data?.healthIntelligence || null;
  const shown: any = scenario || hi;

  async function handleAssess(e?: React.FormEvent) {
    e?.preventDefault();
    if (!locationInput.trim()) return;
    setAssessLoading(true);
    setAssessError(null);
    setScenario(null);
    setScenarioKey(null);
    try {
      const res = await apiFetch(
        `/health-intelligence/assess?location=${encodeURIComponent(locationInput.trim())}`
      );
      setData((prev: any) => ({ ...prev, healthIntelligence: res }));
      setLocationInput(res.location || locationInput);
    } catch (err) {
      setAssessError(err instanceof Error ? err.message : 'Assessment failed.');
    } finally {
      setAssessLoading(false);
    }
  }

  async function handleScenario(key: string) {
    setScenarioKey(key);
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const res = await apiFetch('/health-intelligence/scenario', {
        method: 'POST',
        body: JSON.stringify({ location: shown?.location || locationInput.trim(), preset: key }),
      });
      setScenario(res);
    } catch (err) {
      setScenarioError(err instanceof Error ? err.message : 'Scenario failed.');
    } finally {
      setScenarioLoading(false);
    }
  }

  if (loading) {
    return <div className="pt-28 pb-20 text-center text-xs text-on-surface-variant">Loading Public Health Intelligence Hub...</div>;
  }

  const summary = data?.summary || {};
  const indicators: HealthIndicator[] = shown?.assessment?.indicators || [];
  const elevatedCount = indicators.filter((i) => (i.score ?? 0) >= 50).length;
  const nugen = shown?.nugen || null;
  const interp = nugen?.interpretation || null;

  const liveScoreFor = (key: string): number | null =>
    (hi?.assessment?.indicators || []).find((i: any) => i.key === key)?.score ?? null;

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      <section className="bg-surface-container-low py-space-lg border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
              Department of Health &amp; Family Welfare
            </span>
            <h1 className="font-headline-xl text-2xl font-bold text-on-surface">
              Disaster Medical &amp; Hospital Surge Grid
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Health Officer: <strong>{user?.name || 'Dr. Sunita Deshmukh, MD'}</strong> • Surveillance Level: Active
            </p>
          </div>
          <form onSubmit={handleAssess} className="flex gap-2 w-full md:w-auto">
            <input
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Assess location (e.g. Thane, Maharashtra)"
              className="h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary flex-1 md:w-72"
            />
            <button
              type="submit"
              disabled={assessLoading}
              className="h-10 px-4 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
            >
              {assessLoading ? 'Assessing…' : 'Assess'}
            </button>
          </form>
        </div>
      </section>

      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-lg flex flex-col gap-space-lg">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Available General Beds</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-primary">{summary.availableBeds}</span>
              <span className="text-xs text-on-surface-variant">/ {summary.totalBeds}</span>
            </div>
            <span className="text-[10px] text-secondary font-semibold mt-1">
              Occupancy: {summary.bedOccupancyRate}%
            </span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Available ICU Units</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-secondary">{summary.availableIcu}</span>
              <span className="text-xs text-on-surface-variant">/ {summary.totalIcu}</span>
            </div>
            <span className="text-[10px] text-secondary font-semibold mt-1">
              ICU Surge: {summary.icuOccupancyRate}%
            </span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Average Oxygen Buffer</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-surface-tint">{summary.avgOxygenStockDays}</span>
              <span className="text-xs text-on-surface-variant">Days</span>
            </div>
            <span className="text-[10px] text-surface-tint font-semibold mt-1">Supply Lines Secure</span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs flex flex-col">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase">Elevated Exposures</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-display-lg text-2xl font-bold text-primary">
                {indicators.length ? elevatedCount : '—'}
              </span>
              <span className="text-xs text-on-surface-variant">Live indicators ≥ 50</span>
            </div>
            <span className="text-[10px] text-on-surface font-semibold mt-1">
              {shown ? `Calculated ${fmtTime(shown.assessment?.calculatedAt)}` : 'Awaiting assessment'}
            </span>
          </div>
        </div>

        {assessError && <div className="text-[11px] text-red-600">{assessError}</div>}

        {/* CLIMATE → HEALTH INTELLIGENCE */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-outline-variant/30 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="font-headline-sm text-base font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">eco</span>
              <span>Climate → Health Intelligence{scenario ? ' — SCENARIO (not a forecast)' : ''}</span>
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {shown?.assessment?.confidence
                ? `Confidence: ${shown.assessment.confidence}`
                : 'Awaiting assessment'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant max-w-3xl">
            {shown?.assessment?.headline || 'Run an assessment to compute environmental health risk indicators.'}{' '}
            <strong>Environmental health risk indicators — not medical diagnoses.</strong>
          </p>
          {shown && (
            <p className="text-[11px] text-on-surface-variant mt-1">
              Evidence: Rainfall {shown.evidence?.rainfall?.mm72h ?? '—'} mm / 72h · Temperature{' '}
              {shown.evidence?.climate?.temperatureC ?? '—'}°C · Humidity{' '}
              {shown.evidence?.humidity?.percent ?? '—'}% · AQI {shown.evidence?.aqi?.usAqi ?? '—'} ·
              Flood risk: {(shown.evidence?.floodRisk as any)?.stage || '—'}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm mt-space-md">
            {indicators.map((ind) => (
              <div key={ind.key} className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/20">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-xs text-on-surface">{ind.label}</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${levelBadge(ind.level)}`}>
                    {ind.level === 'INSUFFICIENT_DATA' ? 'Insufficient data' : `${ind.level}${ind.score !== null ? ` · ${ind.score}` : ''}`}
                  </span>
                </div>
                {ind.score !== null && (
                  <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden mt-2">
                    <div className={`h-full ${scoreBar(ind.level, ind.score)}`} style={{ width: `${ind.score}%` }} />
                  </div>
                )}
                <ul className="mt-2 space-y-1">
                  {ind.evidence.map((e, i) => (
                    <li key={i} className="text-[11px] text-on-surface-variant leading-relaxed">• {e}</li>
                  ))}
                </ul>
                <button
                  onClick={() => setExpanded((p) => ({ ...p, [ind.key]: !p[ind.key] }))}
                  className="mt-2 text-[11px] font-bold text-primary hover:underline"
                  aria-expanded={!!expanded[ind.key]}
                >
                  {expanded[ind.key] ? 'Hide — why this risk? ▲' : 'Why this risk? ▼'}
                </button>
                {expanded[ind.key] && (
                  <div className="mt-2 rounded-lg bg-surface p-3 text-[11px] text-on-surface-variant space-y-1.5">
                    {ind.contributors.map((c, i) => (
                      <div key={i}>
                        <strong className="text-on-surface">{c.variable}:</strong> {c.value}
                        <span className="block text-[10px]">{c.influence}</span>
                      </div>
                    ))}
                    <div className="text-[10px]">Observed: {fmtTime(ind.observedAt)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {indicators.length === 0 && (
            <p className="text-[11px] text-on-surface-variant mt-3">
              No assessment available for this location yet — live climate inputs could not be reached.
            </p>
          )}

          {/* Vulnerability */}
          {shown?.assessment?.vulnerability && (
            <div className="mt-space-md rounded-xl bg-surface-container-low border border-outline-variant/20 p-space-md text-[11px] text-on-surface-variant">
              <strong className="text-on-surface">Care capacity nearby:</strong>{' '}
              {shown.assessment.vulnerability.hospitalsNearby ?? '—'} hospitals ·{' '}
              {shown.assessment.vulnerability.availableBedsNearby ?? '—'} beds available.
              {shown.assessment.vulnerability.unavailableFactors.length > 0 && (
                <span className="block mt-1">
                  <strong className="text-on-surface">Unavailable (not estimated):</strong>{' '}
                  {shown.assessment.vulnerability.unavailableFactors.join('; ')}.
                </span>
              )}
            </div>
          )}

          {/* Nugen interpretation */}
          <div className="mt-space-md rounded-xl border border-secondary/30 bg-secondary-container/20 p-space-md">
            <h3 className="font-bold text-xs text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">smart_toy</span>
              <span>Nugen Health Intelligence</span>
              <span className="text-[10px] font-normal text-on-surface-variant">AI-assisted interpretation — not medical diagnosis</span>
            </h3>
            {!nugen?.available || !interp ? (
              <p className="text-[11px] text-on-surface-variant mt-2">
                Nugen interpretation unavailable{nugen?.reason ? `: ${nugen.reason}` : '.'} The calculated
                environmental risks above are unaffected and remain fully usable.
              </p>
            ) : (
              <div className="mt-2 space-y-2 text-[11px] text-on-surface-variant">
                <div>
                  <strong className="text-on-surface">Why it matters</strong>
                  <ul className="mt-0.5 space-y-0.5">
                    {interp.whyItMatters.map((x: string, i: number) => <li key={i}>• {x}</li>)}
                  </ul>
                </div>
                <div>
                  <strong className="text-on-surface">Who is most vulnerable</strong>
                  <ul className="mt-0.5 space-y-0.5">
                    {interp.vulnerableGroups.map((x: string, i: number) => <li key={i}>• {x}</li>)}
                  </ul>
                </div>
                <div>
                  <strong className="text-on-surface">Recommended preparedness</strong>
                  <ul className="mt-0.5 space-y-0.5">
                    {interp.preparednessActions.map((x: string, i: number) => <li key={i}>• {x}</li>)}
                  </ul>
                </div>
                {interp.dataGaps.length > 0 && (
                  <div>
                    <strong className="text-on-surface">What would improve confidence</strong>
                    <ul className="mt-0.5 space-y-0.5">
                      {interp.dataGaps.map((x: string, i: number) => <li key={i}>• {x}</li>)}
                    </ul>
                  </div>
                )}
                <div className="text-[10px]">
                  Model confidence: <strong>{interp.confidence}</strong>
                  {interp.uncertaintyNotes ? ` — ${interp.uncertaintyNotes}` : ''}
                </div>
              </div>
            )}
          </div>

          {/* Preparedness simulator */}
          <div className="mt-space-md rounded-xl border border-dashed border-outline-variant/40 p-space-md">
            <h3 className="font-bold text-xs text-on-surface">Preparedness simulator — “What if rainfall increases?”</h3>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              Recalculates the deterministic indicators on adjusted live inputs. SCENARIO — not a forecast.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => handleScenario(s.key)}
                  disabled={scenarioLoading || !shown}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-50 ${
                    scenarioKey === s.key
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/30 hover:border-primary'
                  }`}
                >
                  {s.label}
                </button>
              ))}
              {scenario && (
                <button
                  onClick={() => { setScenario(null); setScenarioKey(null); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-on-surface-variant hover:text-on-surface"
                >
                  Back to live assessment
                </button>
              )}
            </div>
            {scenarioLoading && <p className="text-[11px] text-on-surface-variant mt-2">Recalculating scenario…</p>}
            {scenarioError && <p className="text-[11px] text-red-600 mt-2">{scenarioError}</p>}
            {scenario && !scenarioLoading && (
              <div className="mt-3 rounded-lg bg-surface p-3 text-[11px] text-on-surface-variant space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                  Scenario: {scenario.scenarioLabel} — not a forecast
                </div>
                {(scenario.assessment?.indicators || []).map((ind: any) => {
                  const liveScore = liveScoreFor(ind.key);
                  const delta = liveScore !== null && ind.score !== null ? ind.score - liveScore : null;
                  return (
                    <div key={ind.key} className="flex items-center justify-between gap-2">
                      <span><strong className="text-on-surface">{ind.label}</strong> — {ind.level}{ind.score !== null ? ` · ${ind.score}` : ''}</span>
                      {delta !== null && delta !== 0 && (
                        <span className={`font-bold ${delta > 0 ? 'text-error' : 'text-primary'}`}>
                          {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`} vs live
                        </span>
                      )}
                    </div>
                  );
                })}
                {scenario.nugen?.interpretation ? (
                  <div className="pt-1">
                    <strong className="text-on-surface">How priorities change ({scenario.nugen.modelUsed}):</strong>
                    <ul className="mt-0.5 space-y-0.5">
                      {scenario.nugen.interpretation.preparednessActions.map((x: string, i: number) => (
                        <li key={i}>• {x}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="pt-1">Nugen scenario explanation unavailable — deterministic scenario scores above still apply.</div>
                )}
              </div>
            )}
          </div>

          {/* Provenance */}
          {shown?.provenance && (
            <div className="mt-space-md text-[10px] text-on-surface-variant leading-relaxed border-t border-outline-variant/20 pt-3">
              <strong className="text-on-surface">Provenance:</strong>{' '}
              {(shown.provenance.dataSources || []).join(' · ') || 'No live inputs reachable.'}
              <span className="block">
                Calculated {fmtTime(shown.provenance.calculationTimestamp)} · Nugen model:{' '}
                {shown.provenance.nugenModelUsed || 'not used'} · Interpreted{' '}
                {shown.provenance.nugenInterpretationTimestamp ? fmtTime(shown.provenance.nugenInterpretationTimestamp) : '—'}
                {shown.provenance.assessmentId ? ` · Record ${shown.provenance.assessmentId.slice(0, 8)}` : ''} ·{' '}
                {shown.location} ({shown.coordinates?.lat?.toFixed(2)}, {shown.coordinates?.lng?.toFixed(2)})
              </span>
              <span className="block mt-1">
                Environmental indicators are calculated, not diagnosed. Nugen output is an AI-assisted
                interpretation — never an official government warning.
              </span>
            </div>
          )}
        </div>

        {/* Hospital Inventory Table */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-outline-variant/30 shadow-sm">
          <h2 className="font-headline-sm text-base font-bold text-on-surface mb-space-md">
            Facility Bed &amp; Trauma Surge Capacities
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant text-[11px] uppercase">
                  <th className="py-2.5 px-3">Hospital Name</th>
                  <th className="py-2.5 px-3">District</th>
                  <th className="py-2.5 px-3">Total Beds</th>
                  <th className="py-2.5 px-3">Available Beds</th>
                  <th className="py-2.5 px-3">Available ICU</th>
                  <th className="py-2.5 px-3">Oxygen Stock</th>
                  <th className="py-2.5 px-3">Dispatch Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {data?.hospitals?.map((h: any) => (
                  <tr key={h.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3 px-3 font-bold text-on-surface">{h.name}</td>
                    <td className="py-3 px-3 text-on-surface-variant">{h.district}</td>
                    <td className="py-3 px-3 font-code-num">{h.totalBeds}</td>
                    <td className="py-3 px-3 font-code-num font-bold text-primary">{h.availableBeds}</td>
                    <td className="py-3 px-3 font-code-num font-bold text-secondary">{h.availableIcuBeds}</td>
                    <td className="py-3 px-3 font-code-num">{h.oxygenStockDays} days</td>
                    <td className="py-3 px-3">
                      <a href={`tel:${h.contactPhone}`} className="text-primary font-bold hover:underline font-code-num">
                        {h.contactPhone}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
};
