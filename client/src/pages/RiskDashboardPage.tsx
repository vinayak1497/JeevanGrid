import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch } from '../api/client';
import { LeafletMap } from '../components/LeafletMap';
import { MapLayerControl, MapOverlaysControl, type LegendItem } from '../components/MapLayerControl';
import { PRESETS, type BasemapKey, type ClarityKey, type OverlayKey, type PresetKey } from '../map/mapStyles';

export const RiskDashboardPage: React.FC<{ onOpenEmergencyModal: () => void }> = ({ onOpenEmergencyModal }) => {
  const { location: locationParam } = useParams<{ location?: string }>();
  const navigate = useNavigate();

  const [locationInput, setLocationInput] = useState(locationParam || 'Mumbai');
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the search box in sync when navigating between locations.
  useEffect(() => {
    setLocationInput(locationParam || 'Mumbai');
  }, [locationParam]);

  // Live Data Engine panels (independent loading so one feed never blocks the page)
  const [quakes, setQuakes] = useState<any>(null);
  const [quakesLoading, setQuakesLoading] = useState(true);
  const [facilities, setFacilities] = useState<any>(null);
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);
  const [aqiLive, setAqiLive] = useState<any>(null);
  const [aqiLoading, setAqiLoading] = useState(true);

  // Map layer toggles: risk choropleth zone, hazards, medical, shelters, live OSM, quakes
  const [activeLayers, setActiveLayers] = useState<Set<OverlayKey>>(
    new Set(['risk', 'medical', 'shelters', 'live', 'quakes', 'boundary'])
  );
  const toggleLayer = (layer: OverlayKey) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
    setPreset(null);
  };

  // GIS map state: basemap, operational preset, clarity, live line overlays
  const [basemap, setBasemap] = useState<BasemapKey>('standard');
  const [preset, setPreset] = useState<PresetKey | null>(null);
  const [clarity, setClarity] = useState<ClarityKey>('standard');
  const [geoOverlays, setGeoOverlays] = useState<any>(null);
  const [geoOverlaysLoading, setGeoOverlaysLoading] = useState(true);
  const [radarUrl, setRadarUrl] = useState<string | null>(null);
  const [radarMeta, setRadarMeta] = useState<string>('Live precipitation radar');
  const [locateNotice, setLocateNotice] = useState<string | null>(null);
  const [locateMarker, setLocateMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [resetTick, setResetTick] = useState(0);

  const resetMapView = () => {
    setLocateMarker(null);
    setLocateNotice(null);
    setResetTick((t) => t + 1);
  };

  const applyPreset = (p: PresetKey) => {
    const def = PRESETS.find((x) => x.key === p);
    if (!def) return;
    setPreset(p);
    setActiveLayers(new Set(def.overlays));
  };

  useEffect(() => {
    async function fetchRisk() {
      setLoading(true);
      setError(null);
      try {
        const query = locationParam || 'Mumbai';
        const res = await apiFetch(`/risk/${encodeURIComponent(query)}`);
        setAnalysis(res.analysis);
      } catch (err: any) {
        console.error('Failed to load risk analysis:', err);
        setError(err.message || 'Failed to analyze risk.');
      } finally {
        setLoading(false);
      }
    }
    async function fetchQuakes() {
      setQuakesLoading(true);
      try {
        const query = locationParam || 'Mumbai';
        const res = await apiFetch(`/earthquakes?location=${encodeURIComponent(query)}`);
        setQuakes(res.earthquakes);
      } catch (err) {
        console.warn('Earthquake feed unavailable:', err);
        setQuakes(null);
      } finally {
        setQuakesLoading(false);
      }
    }
    async function fetchFacilities() {
      setFacilitiesLoading(true);
      try {
        const query = locationParam || 'Mumbai';
        const res = await apiFetch(`/facilities?location=${encodeURIComponent(query)}`);
        setFacilities(res);
      } catch (err) {
        console.warn('Facilities feed unavailable:', err);
        setFacilities(null);
      } finally {
        setFacilitiesLoading(false);
      }
    }
    async function fetchAqi() {
      setAqiLoading(true);
      try {
        const query = locationParam || 'Mumbai';
        const res = await apiFetch(`/aqi?location=${encodeURIComponent(query)}`);
        setAqiLive(res.aqi);
      } catch (err) {
        console.warn('AQI feed unavailable:', err);
        setAqiLive(null);
      } finally {
        setAqiLoading(false);
      }
    }
    async function fetchGeoOverlays() {
      setGeoOverlaysLoading(true);
      try {
        const query = locationParam || 'Mumbai';
        const res = await apiFetch(`/geo/overlays?location=${encodeURIComponent(query)}`);
        setGeoOverlays(res.overlays);
      } catch (err) {
        console.warn('Geo overlays unavailable:', err);
        setGeoOverlays(null);
      } finally {
        setGeoOverlaysLoading(false);
      }
    }
    fetchRisk();
    fetchQuakes();
    fetchFacilities();
    fetchAqi();
    fetchGeoOverlays();
    setLocateMarker(null);
    setLocateNotice(null);
  }, [locationParam]);

  // Live precipitation radar tiles (RainViewer, keyless) — fetched only when enabled
  useEffect(() => {
    if (!activeLayers.has('weather') || radarUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: any = await res.json();
        const frames: any[] = data?.radar?.past || [];
        const last = frames[frames.length - 1];
        if (!last?.path || !last?.time) throw new Error('No radar frames');
        if (!cancelled) {
          setRadarUrl(`https://tilecache.rainviewer.com${last.path}/256/{z}/{x}/{y}/2/1_1.png`);
          setRadarMeta(`Live radar · ${new Date(last.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        }
      } catch (err) {
        console.warn('RainViewer radar unavailable:', err);
        if (!cancelled) setRadarMeta('Radar offline — try again later');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeLayers, radarUrl]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (locationInput.trim()) {
      navigate(`/risk/${encodeURIComponent(locationInput.trim())}`);
    }
  };

  // Map markers preparation (layer-filtered; minimal clarity declutters minor POIs)
  const mapMarkers = React.useMemo(() => {
    if (!analysis) return [];
    const markers: any[] = [];
    const detailed = clarity !== 'minimal';

    // User location marker
    if (analysis.coordinates) {
      markers.push({
        id: 'loc-center',
        lat: analysis.coordinates.lat,
        lng: analysis.coordinates.lng,
        title: analysis.location,
        subtitle: `Overall Risk: ${analysis.overallRiskLevel}`,
        type: 'USER_LOCATION',
        layer: 'risk',
        details: {
          'Risk Score': `${analysis.riskScore}/100`,
          'Rainfall Expected': `${analysis.rainfallExpectedMm} mm`,
        },
      });
    }

    // Hospitals
    if (activeLayers.has('medical')) {
      (analysis.nearestHospitals || []).forEach((h: any) => {
        markers.push({
          id: `hosp-${h.id}`,
          lat: h.latitude,
          lng: h.longitude,
          title: h.name,
          subtitle: `Avail Beds: ${h.availableBeds} | ICU: ${h.availableIcuBeds}`,
          type: 'HOSPITAL',
          layer: 'medical',
          details: {
            Address: h.address,
            Phone: h.contactPhone,
            'Oxygen Reserve': `${h.oxygenStockDays} days`,
          },
        });
      });
    }

    // Shelters
    if (activeLayers.has('shelters')) {
      (analysis.nearestShelters || []).forEach((s: any) => {
        markers.push({
          id: `shelt-${s.id}`,
          lat: s.latitude,
          lng: s.longitude,
          title: s.name,
          subtitle: `Occupancy: ${s.currentOccupancy}/${s.capacity}`,
          type: 'SHELTER',
          layer: 'shelters',
          details: {
            Address: s.address,
            Amenities: s.amenities,
            Contact: s.contactPerson,
          },
        });
      });
    }

    // Live OSM facilities (Overpass)
    if (activeLayers.has('live') && detailed) {
      (facilities?.liveFacilities || [])
        .filter((f: any) => f.kind === 'hospital' || f.kind === 'shelter')
        .forEach((f: any) => {
        markers.push({
          id: `live-${f.id}`,
          lat: f.latitude,
          lng: f.longitude,
          title: f.name,
          subtitle: f.kind === 'hospital' ? 'Live OSM medical POI' : 'Live OSM shelter candidate',
          type: 'LIVE_POI',
          layer: 'live',
          details: {
            ...(f.address ? { Address: f.address } : {}),
            ...(f.phone ? { Phone: f.phone } : {}),
            ...(f.operator ? { Operator: f.operator } : {}),
            ...(f.distanceKm !== undefined ? { Distance: `${f.distanceKm} km` } : {}),
            Source: 'OpenStreetMap',
          },
        });
      });
    }

    // USGS earthquake events
    if (activeLayers.has('quakes') && detailed) {
      (quakes?.events || []).slice(0, 8).forEach((q: any) => {
        if (typeof q.latitude === 'number' && typeof q.longitude === 'number') {
          markers.push({
            id: `quake-${q.id}`,
            lat: q.latitude,
            lng: q.longitude,
            title: `M${q.magnitude} — ${q.place}`,
            subtitle: 'USGS observed event (not a prediction)',
            type: 'QUAKE',
            layer: 'quakes',
            details: {
              Magnitude: `M${q.magnitude}`,
              Depth: `${q.depthKm} km`,
              Date: q.time ? q.time.slice(0, 10) : '—',
            },
          });
        }
      });
    }

    // Live emergency facilities: fire stations & police posts (Overpass)
    if (activeLayers.has('emergency')) {
      (facilities?.liveFacilities || [])
        .filter((f: any) => f.kind === 'emergency')
        .slice(0, 10)
        .forEach((f: any) => {
          markers.push({
            id: `emg-${f.id}`,
            lat: f.latitude,
            lng: f.longitude,
            title: f.name,
            subtitle: 'Live emergency facility (OSM)',
            type: 'EMERGENCY',
            layer: 'emergency',
            details: {
              ...(f.address ? { Address: f.address } : {}),
              ...(f.phone ? { Phone: f.phone } : {}),
              ...(f.distanceKm !== undefined ? { Distance: `${f.distanceKm} km` } : {}),
              Source: 'OpenStreetMap',
            },
          });
        });
    }

    // Browser geolocation pin
    if (locateMarker) {
      markers.push({
        id: 'loc-me',
        lat: locateMarker.lat,
        lng: locateMarker.lng,
        title: 'Your device location',
        subtitle: 'Browser geolocation (this session only)',
        type: 'USER_LOCATION',
        layer: 'risk',
      });
    }

    return markers;
  }, [analysis, facilities, quakes, activeLayers, clarity, locateMarker]);

  // Choropleth-style risk zones: district highlight circle + quake epicenter rings
  const riskZones = React.useMemo(() => {
    if (!analysis?.coordinates) return [];
    const zones: any[] = [];
    const levelColor =
      analysis.overallRiskLevel === 'SEVERE' || analysis.overallRiskLevel === 'HIGH'
        ? '#ba1a1a'
        : analysis.overallRiskLevel === 'MODERATE'
          ? '#d97706'
          : '#3b674e';
    if (activeLayers.has('risk')) {
      // District highlight radius scales with map granularity (state view = wider)
      const granularity = analysis.resolvedGeo?.granularity;
      const radiusM = granularity === 'state' ? 90000 : 12000 + analysis.riskScore * 120;
      zones.push({
        id: 'district-risk',
        lat: analysis.coordinates.lat,
        lng: analysis.coordinates.lng,
        radiusM,
        color: levelColor,
        fillOpacity: 0.16,
        label: `${analysis.district || analysis.location} — ${analysis.overallRiskLevel} (${analysis.riskScore}/100)`,
      });
    }
    if (activeLayers.has('quakes') && clarity !== 'minimal') {
      (quakes?.events || []).slice(0, 5).forEach((q: any) => {
        if (typeof q.latitude === 'number') {
          zones.push({
            id: `quake-ring-${q.id}`,
            lat: q.latitude,
            lng: q.longitude,
            radiusM: Math.max(5000, (q.magnitude || 4) * 8000),
            color: '#7c2d12',
            fillOpacity: 0.08,
            label: `M${q.magnitude} epicenter approx.`,
          });
        }
      });
    }
    return zones;
  }, [analysis, quakes, activeLayers, clarity]);

  // Real linework overlays: OSM rivers (blue) + district boundary (slate dashed)
  const flowLines = React.useMemo(() => {
    const lines: any[] = [];
    if (activeLayers.has('rivers')) {
      (geoOverlays?.rivers || []).forEach((r: any) => {
        lines.push({
          id: `river-${r.id}`,
          points: r.points,
          color: '#2f6fbf',
          weight: 3,
          label: r.name || 'River (OSM)',
        });
      });
    }
    if (activeLayers.has('boundary') && geoOverlays?.boundary) {
      (geoOverlays.boundary.lines || []).forEach((l: any) => {
        lines.push({
          id: `bnd-${l.id}`,
          points: l.points,
          color: '#475569',
          weight: 2,
          dashArray: '6 4',
          label: `${geoOverlays.boundary.name} boundary (OSM)`,
        });
      });
    }
    return lines;
  }, [geoOverlays, activeLayers]);

  const liveShelterCount = (facilities?.liveFacilities || []).filter((f: any) => f.kind === 'shelter').length;
  const liveEmergencyCount = (facilities?.liveFacilities || []).filter((f: any) => f.kind === 'emergency').length;

  const overlayStatus: Partial<Record<OverlayKey, string>> = {
    risk: `${analysis?.overallRiskLevel || ''} · score ${analysis?.riskScore ?? '—'}`,
    medical: `${(analysis?.nearestHospitals || []).length} designated`,
    shelters: facilitiesLoading ? 'syncing…' : `${liveShelterCount} live`,
    live: facilities?.liveSource === 'overpass' ? `live · OSM` : facilitiesLoading ? 'syncing…' : 'offline',
    quakes: quakesLoading ? 'syncing…' : quakes?.source === 'usgs' ? `${quakes.count} observed` : 'USGS offline',
    rivers: geoOverlaysLoading ? 'loading…' : geoOverlays?.source === 'overpass' ? `${(geoOverlays.rivers || []).length} rivers · OSM` : 'OSM offline',
    boundary: geoOverlaysLoading ? 'loading…' : geoOverlays?.boundary ? `${geoOverlays.boundary.name} · OSM` : 'not found on OSM',
    weather: activeLayers.has('weather') ? radarMeta : 'RainViewer radar',
    emergency: facilitiesLoading ? 'syncing…' : `${liveEmergencyCount} live POIs`,
  };

  // Dynamic legend: only enabled overlays, actual rendered colors
  const legend: LegendItem[] = React.useMemo(() => {
    const items: LegendItem[] = [];
    if (activeLayers.has('risk') && analysis) {
      items.push({ shape: 'dot', color: riskColor(analysis.overallRiskLevel), label: `${analysis.overallRiskLevel} risk zone (${analysis.riskScore}/100)` });
    }
    if (activeLayers.has('medical')) items.push({ shape: 'dot', color: '#023d67', label: 'Hospitals' });
    if (activeLayers.has('shelters')) items.push({ shape: 'dot', color: '#2a6866', label: 'Shelters' });
    if (activeLayers.has('live')) items.push({ shape: 'dot', color: '#6d28d9', label: 'Live OSM facilities' });
    if (activeLayers.has('emergency')) items.push({ shape: 'dot', color: '#b45309', label: 'Fire stations & police' });
    if (activeLayers.has('quakes')) {
      items.push({ shape: 'dot', color: '#7c2d12', label: 'Earthquake M < 4' });
      items.push({ shape: 'dot', color: '#7c2d12', label: 'Earthquake M 4–5' });
      items.push({ shape: 'dot', color: '#7c2d12', label: 'Earthquake M 5+' });
    }
    if (activeLayers.has('rivers')) items.push({ shape: 'line', color: '#2f6fbf', label: 'Rivers (OSM)' });
    if (activeLayers.has('boundary')) items.push({ shape: 'line', color: '#475569', label: 'District boundary (OSM)' });
    if (activeLayers.has('weather')) items.push({ shape: 'square', color: '#60a5fa', label: 'Live precipitation radar' });
    return items;
  }, [activeLayers, analysis, riskColor]);

  const mapZoom = analysis?.resolvedGeo?.zoom ?? 12;

  function riskColor(level: string): string {
    return level === 'SEVERE' || level === 'HIGH'
      ? '#ba1a1a'
      : level === 'MODERATE'
        ? '#d97706'
        : '#3b674e';
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'SEVERE':
        return 'text-error bg-error-container border-error/30';
      case 'HIGH':
        return 'text-error bg-error-container border-error/30';
      case 'MODERATE':
        return 'text-[#92400e] bg-[#fef3c7] border-[#fde68a]';
      default:
        return 'text-primary bg-[#e9f3ed] border-[#c7e2d3]';
    }
  };

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      {/* Top Banner / Location Selector */}
      <section className="bg-surface-container-low py-space-xl border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface">Home</Link>
              <span className="text-xs text-on-surface-variant">/</span>
              <span className="text-xs text-primary font-bold">Disaster Forecast Intelligence</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              Hyperlocal Hazard Diagnostic
            </h1>
            <p className="font-body-sm text-sm text-on-surface-variant mt-1">
              Real-time multi-hazard telemetry, basin stage indicators, and civic response staging.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="Enter city, district or state (e.g. Guwahati)"
                className="w-full h-11 pl-9 pr-3 rounded-lg bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/40 outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="h-11 px-space-md rounded-lg bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-all flex items-center gap-1"
            >
              <span>Analyze</span>
            </button>
          </form>
        </div>
      </section>

      {/* Main Analysis Content */}
      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-semibold text-on-surface-variant">Synthesizing Doppler &amp; Basin Telemetry...</span>
          </div>
        ) : error ? (
          <div className="p-space-lg rounded-xl bg-error-container text-on-error-container text-center max-w-md mx-auto">
            <p className="font-bold mb-2">Notice</p>
            <p className="text-xs">{error}</p>
            <button
              onClick={() => navigate('/risk/Mumbai')}
              className="mt-4 px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold"
            >
              Load Default (Mumbai)
            </button>
          </div>
        ) : analysis && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-space-xl"
          >
            {/* Primary Overview Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
              {/* Overall Risk Score Card */}
              <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-xs uppercase font-bold text-secondary tracking-wider">
                      Assessment Telemetry
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Window: {analysis.forecastWindow}
                    </span>
                  </div>

                  <h2 className="font-headline-lg text-2xl font-bold text-on-surface mt-2">
                    {analysis.location}
                  </h2>

                  {/* Overall Risk Chip */}
                  <div className="mt-space-md flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-xl border font-bold text-base flex items-center gap-2 ${getRiskColor(analysis.overallRiskLevel)}`}>
                      <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse"></span>
                      <span>Overall Risk: {analysis.overallRiskLevel}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-on-surface-variant">Risk Index</span>
                      <span className="font-code-num text-xl font-bold text-on-surface">{analysis.riskScore} / 100</span>
                    </div>
                  </div>

                  {/* Meter Progress Bar */}
                  <div className="w-full mt-space-md">
                    <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${analysis.riskScore}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full ${analysis.riskScore > 70 ? 'bg-error' : analysis.riskScore > 40 ? 'bg-[#d97706]' : 'bg-surface-tint'}`}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-on-surface-variant mt-1 font-medium">
                      <span>Low (0-39)</span>
                      <span>Moderate (40-69)</span>
                      <span>High / Severe (70+)</span>
                    </div>
                  </div>

                  {/* Rainfall & Flood Stage Details */}
                  <div className="grid grid-cols-2 gap-space-sm mt-space-lg pt-space-md border-t border-outline-variant/20">
                    <div className="p-space-sm rounded-lg bg-surface-container-low">
                      <span className="text-[11px] text-on-surface-variant">Precipitation Expected</span>
                      <p className="font-code-num text-base font-bold text-primary mt-0.5">{analysis.rainfallExpectedMm} mm</p>
                    </div>
                    <div className="p-space-sm rounded-lg bg-surface-container-low">
                      <span className="text-[11px] text-on-surface-variant">Hydrological Staging</span>
                      <p className="text-xs font-bold text-on-surface mt-0.5 truncate" title={analysis.floodRiskStage}>{analysis.floodRiskStage}</p>
                    </div>
                  </div>
                </div>

                {/* Direct Action Buttons */}
                <div className="mt-space-lg flex gap-space-xs pt-space-sm border-t border-outline-variant/20">
                  <Link
                    to="/assistant"
                    className="flex-1 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                    <span>Ask AI Assistant</span>
                  </Link>
                  <button
                    onClick={onOpenEmergencyModal}
                    className="flex-1 py-2 rounded-lg bg-error-container hover:bg-error/20 text-on-error-container font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">call</span>
                    <span>Emergency Lines</span>
                  </button>
                </div>
              </div>

              {/* Active Hazards Breakdown */}
              <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-space-md">
                    <h3 className="font-headline-sm text-lg font-bold text-on-surface">Active Hazard Profiles</h3>
                    <span className="text-xs font-semibold text-secondary">
                      {analysis.activeHazards?.length || 0} Monitored Hazards
                    </span>
                  </div>

                  <div className="flex flex-col gap-space-sm">
                    {analysis.activeHazards?.map((h: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-space-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm"
                      >
                        <div className="flex items-start gap-space-sm">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5 ${h.level === 'High' ? 'bg-error' : h.level === 'Moderate' ? 'bg-[#d97706]' : 'bg-surface-tint'}`}>
                            <span className="material-symbols-outlined text-[18px]">
                              {h.type.toLowerCase().includes('rain') ? 'rainy' : h.type.toLowerCase().includes('flood') ? 'flood' : h.type.toLowerCase().includes('heat') ? 'thermostat' : 'warning'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-headline-sm text-sm font-bold text-on-surface">{h.type}</h4>
                              <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-[10px] font-bold text-on-surface-variant uppercase">
                                {h.status}
                              </span>
                            </div>
                            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">{h.description}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right sm:pl-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${getRiskColor(h.level.toUpperCase())}`}>
                            {h.level} Vulnerability
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Affected Zones Chip List */}
                <div className="mt-space-lg pt-space-md border-t border-outline-variant/20">
                  <span className="text-xs font-bold text-on-surface-variant block mb-1.5">Affected Local Zones / Catchments:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.affectedZones?.map((zone: string) => (
                      <span key={zone} className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface text-xs font-medium">
                        {zone}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live data provenance — which real feeds produced this assessment */}
            {analysis.dataProvenance && (
              <div className="bg-surface-container-lowest rounded-xl px-space-xl py-space-md shadow-sm border border-outline-variant/30 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
                <span className="font-bold text-on-surface uppercase tracking-wider">Live sources:</span>
                <span>Geocoding: {analysis.dataProvenance.geocoding}</span>
                <span>Weather: {analysis.dataProvenance.weather}</span>
                <span>Air: {analysis.dataProvenance.airQuality}</span>
                <span>Seismic: {analysis.dataProvenance.seismicity}</span>
                <span className="font-semibold text-on-surface">{analysis.dataProvenance.officialAlerts}</span>
                {analysis.isDemoData && (
                  <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] font-bold">OFFLINE SNAPSHOT — live feeds unreachable</span>
                )}
              </div>
            )}

            {/* Real official alerts for THIS location (verified government warnings only) */}
            <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30">
              <div className="flex items-center justify-between mb-space-sm">
                <h3 className="font-headline-sm text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]">campaign</span>
                  <span>Official Alerts — {analysis.district || analysis.location}</span>
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  {(analysis.officialAlerts || []).length > 0 ? `● Live · ${(analysis.officialAlerts || []).length} active` : '○ No active alerts'}
                </span>
              </div>
              {(analysis.officialAlerts || []).length > 0 ? (
                <div className="flex flex-col gap-space-xs">
                  {(analysis.officialAlerts || []).map((a: any) => (
                    <div key={a.id} className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.severity === 'CRITICAL' ? 'bg-error text-white' : a.severity === 'WARNING' ? 'bg-error-container text-on-error-container' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                          {a.severity}
                        </span>
                        <span className="text-xs font-bold text-on-surface">{a.headline || a.title}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{a.description}</p>
                      {a.instruction && (
                        <p className="text-[11px] text-on-surface mt-1"><strong>Instruction:</strong> {a.instruction}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-on-surface-variant">
                        <span>Authority: <strong className="text-on-surface">{a.authority || a.source}</strong></span>
                        {a.issuedIST && <span>Issued: {a.issuedIST}</span>}
                        {a.sourceUrl && (
                          <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline">
                            View source bulletin ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  No active verified government alerts (SACHET / IMD / CWC / INCOIS) for{' '}
                  <strong className="text-on-surface">{analysis.location}</strong> right now. The hazard
                  profiles above are computed from live weather, air-quality and seismic observations for
                  these exact coordinates ({analysis.coordinates?.lat?.toFixed(3)}, {analysis.coordinates?.lng?.toFixed(3)}).
                  Always follow fresh IMD / DDMA bulletins before acting.
                </p>
              )}
            </div>

            {/* Interactive Map Section */}
            <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-label-sm text-xs text-secondary font-bold uppercase tracking-wider">Spatial Staging</span>
                  <h3 className="font-headline-sm text-lg font-bold text-on-surface mt-0.5">
                    Shelters, Hospitals &amp; Emergency Grid Map
                  </h3>
                  {analysis.resolvedGeo && (
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      District detection: <strong className="text-on-surface">{analysis.resolvedGeo.district}</strong>
                      {' '}({analysis.resolvedGeo.state}) · {analysis.resolvedGeo.granularity} view · zoom {mapZoom}
                      {analysis.resolvedGeo.matchedFromGeoIndex ? ' · matched in Assets/geo index' : ''}
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant sm:text-right">
                  Use Layers for basemaps &amp; information layers.
                </p>
              </div>

              {locateNotice && (
                <p className="text-[11px] font-semibold text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-1.5" role="status">
                  {locateNotice}
                </p>
              )}

              {/* Leaflet Map Embed with GIS layer control */}
              <LeafletMap
                center={[analysis.coordinates.lat, analysis.coordinates.lng]}
                zoom={mapZoom}
                markers={mapMarkers}
                riskZones={riskZones}
                flowLines={flowLines}
                basemap={basemap}
                radarUrl={activeLayers.has('weather') ? radarUrl : null}
                showZoneLabels={clarity === 'detailed'}
                resetSignal={resetTick}
                className="h-96 w-full"
                onLocateFound={(lat, lng) => {
                  setLocateMarker({ lat, lng });
                  setLocateNotice('Device location pinned on the map for this session.');
                }}
                onLocateError={(message) => setLocateNotice(message)}
                cornerTopRight={
                  <>
                    <MapLayerControl
                      basemap={basemap}
                      onBasemapChange={setBasemap}
                      preset={preset}
                      onPreset={applyPreset}
                      clarity={clarity}
                      onClarity={setClarity}
                      onResetView={resetMapView}
                    />
                    <MapOverlaysControl
                      activeOverlays={activeLayers}
                      onToggleOverlay={toggleLayer}
                      overlayStatus={overlayStatus}
                      legend={legend}
                    />
                  </>
                }
              />
              <p className="text-[11px] text-on-surface-variant">
                District highlight is a centroid risk-radius render and boundary linework comes from OpenStreetMap
                (Assets/geo ships metadata without polygons). No synthetic boundaries are drawn.
              </p>
            </div>

            {/* Live Telemetry Panels: observation, air quality, seismicity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
              {/* Live observation */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface">Live Observation</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {(analysis.liveSources || []).includes('open-meteo') ? '● Live · Open-Meteo' : '○ Demo climatology'}
                  </span>
                </div>
                {analysis.telemetry ? (
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="font-code-num text-2xl font-bold text-primary">{analysis.telemetry.temperatureC}°C</span>
                      <span className="text-on-surface-variant">{analysis.telemetry.condition}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <div className="p-2 rounded-lg bg-surface-container-low text-center">
                        <div className="text-[10px] text-on-surface-variant">Humidity</div>
                        <div className="font-bold text-on-surface">{analysis.telemetry.humidityPct}%</div>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-container-low text-center">
                        <div className="text-[10px] text-on-surface-variant">Wind</div>
                        <div className="font-bold text-on-surface">{analysis.telemetry.windKph} km/h</div>
                      </div>
                      <div className="p-2 rounded-lg bg-surface-container-low text-center">
                        <div className="text-[10px] text-on-surface-variant">Rain 24h</div>
                        <div className="font-bold text-on-surface">{analysis.telemetry.rainfallMm24h} mm</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">Telemetry unavailable for this location.</p>
                )}
              </div>

              {/* Air quality */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface">Air Quality</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {aqiLoading ? '… syncing' : aqiLive?.isDemoData === false ? '● Live · Open-Meteo' : aqiLive ? '○ Demo' : '○ Offline'}
                  </span>
                </div>
                {aqiLoading ? (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant py-4">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Fetching AQI…</span>
                  </div>
                ) : aqiLive ? (
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="font-code-num text-2xl font-bold text-secondary">{aqiLive.aqi}</span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-[10px] font-bold">{aqiLive.status}</span>
                    </div>
                    <p className="text-on-surface-variant">{aqiLive.location}</p>
                    <p className="text-on-surface-variant text-[11px]">PM2.5 {aqiLive.pm25} · PM10 {aqiLive.pm10}</p>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">AQI feed unreachable. Follow CPCB bulletins.</p>
                )}
              </div>

              {/* Seismicity */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface">Recent Earthquakes</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {quakesLoading ? '… syncing' : quakes?.source === 'usgs' ? '● Live · USGS' : '○ Offline'}
                  </span>
                </div>
                {quakesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant py-4">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Querying USGS…</span>
                  </div>
                ) : quakes && quakes.count > 0 ? (
                  <div className="flex flex-col gap-1.5 text-xs max-h-40 overflow-y-auto pr-1">
                    {quakes.events.slice(0, 5).map((q: any) => (
                      <a key={q.id} href={q.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                        <span className="font-bold text-on-surface">M{q.magnitude}</span>
                        <span className="text-on-surface-variant"> — {q.place}</span>
                        <span className="block text-[10px] text-on-surface-variant">{q.time?.slice(0, 10)} · {q.depthKm} km deep</span>
                      </a>
                    ))}
                    <p className="text-[10px] text-on-surface-variant">Observed events only — never predictions.</p>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant">
                    {quakes?.source === 'usgs'
                      ? 'No M4+ earthquakes within 500 km recently. Baseline seismic zoning still applies.'
                      : 'USGS feed unreachable. Baseline seismic zoning still applies.'}
                  </p>
                )}
              </div>
            </div>

            {/* Emergency contacts */}
            {analysis.emergencyContacts?.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30">
                <div className="flex items-center gap-2 mb-space-sm">
                  <span className="material-symbols-outlined text-error text-[20px]">call</span>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">Emergency Information — Direct Lines</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-xs">
                  {analysis.emergencyContacts.map((c: any) => (
                    <a
                      key={c.number + c.service}
                      href={`tel:${c.number}`}
                      className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between gap-2 border border-outline-variant/20"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface">{c.service}</span>
                        <span className="font-code-num text-sm font-bold text-primary">{c.number}</span>
                      </div>
                      <span className="material-symbols-outlined text-primary text-[18px]">call</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Structured Guidance: What To Do vs What Not To Do */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
              {/* WHAT TO DO */}
              <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30">
                <div className="flex items-center gap-2 mb-space-md text-primary">
                  <span className="material-symbols-outlined text-[24px]">task_alt</span>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">WHAT TO DO</h3>
                </div>
                <ul className="flex flex-col gap-space-sm text-xs text-on-surface">
                  {analysis.whatToDo?.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 p-space-xs rounded-lg bg-surface-container-low">
                      <span className="material-symbols-outlined text-surface-tint text-[18px] shrink-0 mt-0.5">check_circle</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* WHAT NOT TO DO */}
              <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30">
                <div className="flex items-center gap-2 mb-space-md text-error">
                  <span className="material-symbols-outlined text-[24px]">cancel</span>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">WHAT NOT TO DO</h3>
                </div>
                <ul className="flex flex-col gap-space-sm text-xs text-on-surface">
                  {analysis.whatNotToDo?.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 p-space-xs rounded-lg bg-error-container/40">
                      <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">block</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Nearest Hospitals & Shelters Directory */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-lg">
              {/* Nearest Hospitals */}
              <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30">
                <div className="flex items-center justify-between mb-space-md">
                  <h3 className="font-headline-sm text-base font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">local_hospital</span>
                    <span>Designated Medical Facilities</span>
                  </h3>
                  <span className="text-xs text-on-surface-variant font-medium">Beds &amp; ICU Staged</span>
                </div>

                <div className="flex flex-col gap-space-xs">
                  {analysis.nearestHospitals?.map((h: any) => (
                    <div key={h.id} className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-on-surface">{h.name}</span>
                        <span className="text-[11px] text-on-surface-variant truncate max-w-xs">{h.address}</span>
                        <div className="flex items-center gap-3 mt-1 text-[11px]">
                          <span className="text-primary font-semibold">Available Beds: {h.availableBeds}</span>
                          <span className="text-secondary font-semibold">Available ICU: {h.availableIcuBeds}</span>
                        </div>
                      </div>
                      <a
                        href={`tel:${h.contactPhone}`}
                        className="px-3 py-1 rounded-lg bg-primary text-on-primary text-xs font-semibold shrink-0"
                      >
                        Call
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Public Relief Shelters (real OSM data first, demo registry labeled) */}
              <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border border-outline-variant/30">
                <div className="flex items-center justify-between mb-space-md">
                  <h3 className="font-headline-sm text-base font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">night_shelter</span>
                    <span>Public Relief Shelters</span>
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {facilitiesLoading
                      ? '… syncing live shelters'
                      : (facilities?.liveFacilities || []).filter((f: any) => f.kind === 'shelter').length > 0
                        ? `● Live · OSM (${(facilities.liveFacilities as any[]).filter((f: any) => f.kind === 'shelter').length} near you)`
                        : facilities?.designatedDataIsDemo
                          ? '○ Demo registry'
                          : '○ Live feed offline'}
                  </span>
                </div>

                {facilitiesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant py-4">
                    <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                    <span>Fetching live shelters near {analysis.district || analysis.location}…</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-space-xs">
                    {/* Real, live shelters from OpenStreetMap */}
                    {(facilities?.liveFacilities || [])
                      .filter((f: any) => f.kind === 'shelter')
                      .slice(0, 6)
                      .map((s: any) => (
                        <div key={s.id} className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/20 flex items-center justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-on-surface flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{s.name}</span>
                              <span className="px-1.5 py-px rounded-full bg-surface-tint text-white text-[9px] font-bold uppercase shrink-0">Live</span>
                            </span>
                            <span className="text-[11px] text-on-surface-variant truncate max-w-xs">
                              {[s.address, s.distanceKm !== undefined ? `${s.distanceKm} km away` : null].filter(Boolean).join(' · ') || 'Community shelter candidate'}
                            </span>
                            <span className="text-[11px] text-on-surface-variant mt-0.5">
                              {[s.operator ? `Run by ${s.operator}` : null, 'Availability unconfirmed — call ahead'].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                          {s.phone ? (
                            <a
                              href={`tel:${s.phone.replace(/[^+\d]/g, '')}`}
                              title={s.phone}
                              className="px-3 py-1 rounded-lg bg-secondary text-on-secondary text-xs font-semibold shrink-0"
                            >
                              Contact
                            </a>
                          ) : (
                            <span className="text-[10px] text-on-surface-variant shrink-0 text-right">No phone<br />listed on OSM</span>
                          )}
                        </div>
                      ))}

                    {(facilities?.liveFacilities || []).filter((f: any) => f.kind === 'shelter').length === 0 && (
                      <p className="text-xs text-on-surface-variant">
                        No live shelter records reachable right now. Call <strong>112</strong> or use the emergency lines above for staging guidance.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Scientific Disclaimer Note */}
            <div className="p-space-md rounded-xl bg-surface-container-high/40 text-center text-on-surface-variant text-[11px] border border-outline-variant/30 leading-relaxed">
              <span className="font-bold text-on-surface">Telemetry Note: </span>
              {analysis.scientificDisclaimer}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
};
