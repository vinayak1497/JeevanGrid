import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client';
import { LeafletMap, type MapMarker, type MapPolygon } from '../LeafletMap';
import { PolygonDrawMap } from './PolygonDrawMap';
import {
  DataCaveat,
  EmptyState,
  Metric,
  SectionCard,
  StatusBadge,
  confidenceTone,
  formatDateTime,
  formatNumber,
  primaryButton,
  secondaryButton,
} from './IntelligenceUI';

interface ImpactPanelProps {
  district: string;
  state?: string;
  alerts?: any[];
  summary?: any;
  satelliteLayers?: any[];
}

interface Point {
  lat: number;
  lng: number;
}

function geometryToPolygons(geometry: any, color: string, label: string, dashArray?: string): MapPolygon[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return [
      {
        id: `${label}-0`,
        positions: (geometry.coordinates?.[0] || []).map(([lng, lat]: number[]) => [lat, lng] as [number, number]),
        color,
        label,
        dashArray,
      },
    ];
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).map((polygon: number[][][], index: number) => ({
      id: `${label}-${index}`,
      positions: (polygon?.[0] || []).map(([lng, lat]: number[]) => [lat, lng] as [number, number]),
      color,
      label: `${label}${geometry.coordinates.length > 1 ? ` #${index + 1}` : ''}`,
      dashArray,
    }));
  }
  return [];
}

export const ImpactAssessmentPanel: React.FC<ImpactPanelProps> = ({
  district,
  state = 'Maharashtra',
  alerts = [],
  summary = null,
  satelliteLayers = [],
}) => {
  const [mode, setMode] = useState<'alert' | 'location' | 'draw' | 'file'>('alert');
  const [selectedAlertId, setSelectedAlertId] = useState(alerts[0]?.id || '');
  const [locationInput, setLocationInput] = useState(district);
  const [hazardType, setHazardType] = useState('Flood');
  const [points, setPoints] = useState<Point[]>([]);
  const [fileGeometry, setFileGeometry] = useState<any>(null);
  const [fileLabel, setFileLabel] = useState('');
  const [simulation, setSimulation] = useState(false);
  const [showSatellite, setShowSatellite] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId);

  useEffect(() => {
    if (!selectedAlertId && alerts[0]?.id) setSelectedAlertId(alerts[0].id);
  }, [alerts, selectedAlertId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = district ? `?district=${encodeURIComponent(district)}&take=8` : '?take=8';
        const response = await apiFetch<{ assessments: any[] }>(`/impact/assessments${query}`);
        if (!cancelled) setHistory(response.assessments || []);
      } catch {
        if (!cancelled) setHistory([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [district]);

  useEffect(() => {
    if (selectedAlert) {
      setHazardType(selectedAlert.hazardType || 'Flood');
      if (selectedAlert.isDemoData) setSimulation(true);
    }
  }, [selectedAlertId]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawnGeometry = () => {
    if (points.length < 3) return null;
    const ring = points.map((p) => [p.lng, p.lat]);
    ring.push([points[0].lng, points[0].lat]);
    return { type: 'Polygon', coordinates: [ring] };
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileGeometry(null);
    setFileLabel('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const type = parsed?.type === 'Feature' ? parsed.geometry?.type : parsed?.type;
      if (!['Polygon', 'MultiPolygon', 'FeatureCollection'].includes(type)) {
        throw new Error('GeoJSON must be a Polygon, MultiPolygon, or FeatureCollection of polygons.');
      }
      setFileGeometry(parsed);
      setFileLabel(`${file.name} (${Math.round(file.size / 1024)} KB)`);
    } catch (err: any) {
      setError(`Could not read GeoJSON: ${err.message}`);
    }
  };

  const assess = async () => {
    setLoading(true);
    setError(null);
    try {
      let body: any;
      if (mode === 'alert') {
        if (!selectedAlertId) throw new Error('Select an official warning first.');
        body = { alertId: selectedAlertId };
      } else if (mode === 'location') {
        if (!locationInput.trim()) throw new Error('Enter a location to assess.');
        body = {
          location: locationInput.trim(),
          district,
          state,
          hazardType,
          isSimulation: simulation,
        };
      } else if (mode === 'draw') {
        const geometry = drawnGeometry();
        if (!geometry) throw new Error('Place at least three points on the map.');
        body = {
          geometry,
          district,
          state,
          hazardType,
          isSimulation: simulation,
          locationName: simulation ? 'SIMULATION — officer-drawn scenario' : 'Officer-drawn assessment polygon',
        };
      } else {
        if (!fileGeometry) throw new Error('Choose a GeoJSON polygon file first.');
        body = {
          geometry: fileGeometry,
          district,
          state,
          hazardType,
          isSimulation: simulation,
          locationName: fileLabel,
        };
      }
      const response = await apiFetch<any>('/impact/assess', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult(response);
      setHistory((current) => [response, ...current.filter((item) => item.id !== response.id)].slice(0, 8));
    } catch (err: any) {
      setError(err.message || 'Impact assessment failed.');
    } finally {
      setLoading(false);
    }
  };

  const satellitePolygons = showSatellite
    ? satelliteLayers.flatMap((layer) =>
        geometryToPolygons(
          layer.geojson,
          '#1d4ed8',
          `${layer.isSimulation ? 'SIMULATION · ' : ''}${layer.eventName}`,
          '8 5'
        )
      )
    : [];

  const resultPolygons = result ? geometryToPolygons(result.geometry, result.isSimulation ? '#b45309' : '#ba1a1a', 'Exposure extent') : [];
  const hospitalMarkers: MapMarker[] =
    result?.evidence?.infrastructure?.sampleHospitals?.map((h: any, index: number) => ({
      id: `impact-hospital-${index}`,
      lat: h.latitude,
      lng: h.longitude,
      type: 'HOSPITAL',
      title: h.name,
      subtitle: `Registry hospital · ${h.distanceKm} km from centre`,
    })) || [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-space-md">
      <div className="xl:col-span-2 flex flex-col gap-space-md">
        <SectionCard
          title="Impact-based exposure"
          subtitle="Population and infrastructure inside a selected or scenario extent."
          icon="crisis_alert"
          actions={
            <StatusBadge tone="warning">
              <span className="material-symbols-outlined text-[12px]">info</span>
              Estimate only
            </StatusBadge>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Assessment source">
              {[
                ['alert', 'Official warning'],
                ['location', 'Location'],
                ['draw', 'Draw scenario'],
                ['file', 'GeoJSON file'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => setMode(value as any)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border ${
                    mode === value
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'alert' && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold" htmlFor="impact-alert">Verified official warning</label>
                {alerts.length === 0 ? (
                  <DataCaveat tone="warning">
                    No live verified official warning is currently loaded for {district}. Use a location or
                    draw a clearly labelled scenario polygon. JeevanGrid will not invent a warning.
                  </DataCaveat>
                ) : (
                  <select
                    id="impact-alert"
                    value={selectedAlertId}
                    onChange={(e) => setSelectedAlertId(e.target.value)}
                    className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs"
                  >
                    {alerts.map((alert) => (
                      <option key={alert.id} value={alert.id}>
                        {alert.severity} · {alert.title}
                      </option>
                    ))}
                  </select>
                )}
                {selectedAlert?.isDemoData && (
                  <StatusBadge tone="simulation" className="mt-1 w-fit">Simulation dataset</StatusBadge>
                )}
                {selectedAlert?.geometryPrecision === 'DISTRICT' && (
                  <p className="text-[10px] text-on-surface-variant">
                    This warning has no exact CAP polygon. The assessment will use a labelled 8 km
                    district approximation, not an inundation boundary.
                  </p>
                )}
              </div>
            )}

            {mode === 'location' && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold" htmlFor="impact-location">Area or landmark</label>
                <input
                  id="impact-location"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="e.g. Kurla West, Mumbai"
                  className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs"
                />
                <p className="text-[10px] text-on-surface-variant">
                  An 8 km approximation is used when no official polygon exists. It is labelled
                  DISTRICT_APPROXIMATION in the result.
                </p>
              </div>
            )}

            {mode === 'draw' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold">Click the map to add at least 3 points</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPoints(points.slice(0, -1))}
                      disabled={!points.length}
                      className="min-h-[44px] text-xs font-bold px-3 py-2 rounded-xl border border-outline-variant/40 disabled:opacity-40"
                    >
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoints([])}
                      disabled={!points.length}
                      className="min-h-[44px] text-xs font-bold px-3 py-2 rounded-xl border border-outline-variant/40 disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <PolygonDrawMap center={[19.076, 72.8777]} points={points} onChange={setPoints} />
                <p className="text-[10px] text-on-surface-variant">
                  {points.length} point{points.length === 1 ? '' : 's'} placed. The polygon closes
                  automatically when assessed.
                </p>
              </div>
            )}

            {mode === 'file' && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold" htmlFor="impact-file">Scenario GeoJSON</label>
                <input
                  id="impact-file"
                  type="file"
                  accept=".geojson,.json,application/geo+json,application/json"
                  onChange={handleFile}
                  className="block w-full text-[11px] text-on-surface-variant file:mr-2 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-surface-container-high file:text-on-surface file:text-[11px] file:font-bold"
                />
                {fileLabel && <p className="text-[10px] text-primary font-semibold">{fileLabel}</p>}
                <p className="text-[10px] text-on-surface-variant">
                  FeatureCollection, Polygon or MultiPolygon. Maximum 20,000 points; geometry is
                  validated server-side.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold" htmlFor="impact-hazard">Hazard type</label>
                <select
                  id="impact-hazard"
                  value={hazardType}
                  onChange={(e) => setHazardType(e.target.value)}
                  disabled={mode === 'alert'}
                  className="h-11 px-3 rounded-xl bg-surface-container-low border border-outline-variant/40 text-xs disabled:opacity-60"
                >
                  {['Flood', 'Extreme Rainfall', 'Cyclone', 'Landslide', 'Earthquake', 'Heatwave', 'Severe Air Pollution'].map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-3 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulation}
                  onChange={(e) => setSimulation(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#0A3A28]"
                />
                <span>
                  <strong>Label as SIMULATION</strong>
                  <span className="block text-on-surface-variant">Required for training polygons and demo datasets.</span>
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg bg-error-container text-on-error-container px-3 py-2 text-[11px] font-semibold">
                {error}
              </div>
            )}

            <button type="button" onClick={assess} disabled={loading} className={primaryButton}>
              <span className="material-symbols-outlined text-[17px]">
                {loading ? 'hourglass_top' : 'calculate'}
              </span>
              {loading ? 'Contacting WorldPop & OpenStreetMap…' : 'Calculate exposure'}
            </button>
            <p className="text-[10px] text-on-surface-variant">
              Typical first run takes 10–30 seconds. WorldPop population is a gridded estimate;
              OpenStreetMap counts may be unavailable and are never replaced with invented numbers.
            </p>
          </div>
        </SectionCard>

        {summary && (
          <SectionCard title="District exposure summary" icon="analytics">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Assessments" value={summary.assessmentCount ?? 0} tone="neutral" />
              <Metric
                label="High-confidence"
                value={summary.highConfidenceAssessments ?? 0}
                tone="primary"
              />
            </div>
            {summary.latest && (
              <button
                type="button"
                onClick={() => setResult(summary.latest)}
                className="mt-2 w-full text-left rounded-lg border border-outline-variant/40 px-3 py-2 text-[11px] hover:bg-surface-container-low"
              >
                <span className="font-bold">{summary.latest.locationName}</span>
                <span className="block text-on-surface-variant">
                  {summary.latest.hazardType} · {formatNumber(summary.latest.populationExposed)} estimated
                  people · {formatDateTime(summary.latest.createdAt)}
                </span>
              </button>
            )}
            <p className="text-[10px] text-on-surface-variant mt-2">
              {summary.note || 'Do not sum separate assessments as unique people.'}
            </p>
          </SectionCard>
        )}
      </div>

      <div className="xl:col-span-3 flex flex-col gap-space-md">
        <SectionCard
          title={result ? `${result.locationName}` : 'Exposure result'}
          subtitle={
            result
              ? `${result.hazardType} · ${result.precision.replace(/_/g, ' ')} · calculated ${formatDateTime(result.createdAt)}`
              : 'No assessment calculated yet in this session.'
          }
          icon="map"
          actions={
            result && (
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge tone={confidenceTone(result.confidence)}>{result.confidence} confidence</StatusBadge>
                {result.isSimulation && <StatusBadge tone="simulation">Simulation</StatusBadge>}
                {result.cached && <StatusBadge tone="neutral">Cached</StatusBadge>}
              </div>
            )
          }
        >
          {!result ? (
            <EmptyState
              icon="travel_explore"
              title="Run an exposure assessment"
              body="Choose an official warning, a location, or a scenario polygon. JeevanGrid reports data gaps explicitly."
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Metric label="Estimated people" value={formatNumber(result.populationExposed)} hint="WorldPop gridded estimate" tone="primary" />
                <Metric label="Children under 5" value={formatNumber(result.childrenExposed)} hint="WorldPop age group" tone="info" />
                <Metric label="People 65+" value={formatNumber(result.elderlyExposed)} hint="WorldPop age group" tone="info" />
                <Metric label="Hospitals" value={formatNumber(result.hospitalsExposed)} hint={result.evidence?.infrastructure?.provider} tone="neutral" />
                <Metric label="Schools" value={formatNumber(result.schoolsExposed)} hint="OpenStreetMap count" tone="neutral" />
                <Metric label="Major road segments" value={formatNumber(result.roadsExposed)} hint="OSM highways: motorway–secondary" tone="neutral" />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <StatusBadge tone="neutral">Area {result.areaKm2 ?? '—'} km²</StatusBadge>
                <StatusBadge tone="neutral">Density {result.populationDensity ?? '—'} /km²</StatusBadge>
                <StatusBadge tone="neutral">Data year {result.dataYear ?? 'unavailable'}</StatusBadge>
                <StatusBadge tone="neutral">{result.populationSource || 'WorldPop unavailable'}</StatusBadge>
              </div>

              <div className="rounded-xl overflow-hidden border border-outline-variant/30 relative">
                <LeafletMap
                  center={[result.latitude, result.longitude]}
                  zoom={11}
                  className="h-72 w-full"
                  markers={[
                    {
                      id: 'impact-center',
                      lat: result.latitude,
                      lng: result.longitude,
                      type: 'ALERT',
                      title: result.locationName,
                      subtitle: 'Assessment centre',
                    },
                    ...hospitalMarkers,
                  ]}
                  polygons={[...satellitePolygons, ...resultPolygons]}
                />
                <div className="absolute bottom-2 left-2 z-[500] flex flex-col gap-1 rounded-lg bg-white/95 border border-outline-variant/40 px-2 py-1.5 text-[10px] shadow">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#ba1a1a]/60 border border-[#ba1a1a]" /> Exposure extent</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#1d4ed8]/40 border border-[#1d4ed8]" /> Satellite layer</span>
                  {satelliteLayers.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={showSatellite} onChange={(e) => setShowSatellite(e.target.checked)} />
                      Show satellite layers
                    </label>
                  )}
                </div>
              </div>

              <DataCaveat tone={result.confidence === 'INSUFFICIENT' ? 'danger' : 'warning'}>
                <strong>What this is not:</strong> {result.limitations}
              </DataCaveat>

              {result.evidence?.warnings?.length > 0 && (
                <details className="rounded-lg border border-outline-variant/40 px-3 py-2 text-[11px]">
                  <summary className="font-bold cursor-pointer">Data gaps and provider notes ({result.evidence.warnings.length})</summary>
                  <ul className="list-disc pl-4 mt-1.5 text-on-surface-variant space-y-0.5">
                    {result.evidence.warnings.map((warning: string, index: number) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}

              {result.evidence?.infrastructure?.sampleHospitals?.length > 0 && (
                <div className="rounded-lg border border-outline-variant/40 px-3 py-2">
                  <div className="text-[11px] font-bold">Registry hospitals inside the extent</div>
                  <ul className="text-[11px] text-on-surface-variant mt-1 space-y-0.5">
                    {result.evidence.infrastructure.sampleHospitals.map((hospital: any, index: number) => (
                      <li key={index} className="flex items-start justify-between gap-3">
                        <span className="min-w-0 flex-1 break-words">{hospital.name}</span>
                        <span className="font-code-num shrink-0">{hospital.distanceKm} km</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[10px] text-on-surface-variant">
                These are estimated exposure figures. They are not casualty counts, damage
                assessments, or confirmation that any facility is operating.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent assessments" subtitle="Cached results; re-run for current data." icon="history">
          {history.length === 0 ? (
            <EmptyState title="No assessments stored yet" body="Results are cached for 24 hours to reduce provider load." />
          ) : (
            <div className="flex flex-col gap-1.5">
              {history.map((item) => (
                <button
                  key={item.id || item.createdAt}
                  type="button"
                  onClick={() => setResult(item)}
                  className="w-full text-left rounded-lg border border-outline-variant/40 px-3 py-2 hover:bg-surface-container-low"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-[11px] font-bold">{item.locationName}</span>
                    <div className="flex gap-1">
                      {item.isSimulation && <StatusBadge tone="simulation">Sim</StatusBadge>}
                      <StatusBadge tone={confidenceTone(item.confidence)}>{item.confidence}</StatusBadge>
                    </div>
                  </div>
                  <div className="text-[10px] text-on-surface-variant mt-0.5">
                    {item.hazardType} · {formatNumber(item.populationExposed)} people · {formatDateTime(item.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};
