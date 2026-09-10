import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { LeafletMap } from '../components/LeafletMap';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('All');
  const [hazardFilter, setHazardFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');

  useEffect(() => {
    async function loadAlerts() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (stateFilter !== 'All') queryParams.append('state', stateFilter);
        if (hazardFilter !== 'All') queryParams.append('hazardType', hazardFilter);
        if (severityFilter !== 'All') queryParams.append('severity', severityFilter);

        const res = await apiFetch(`/alerts?${queryParams.toString()}`);
        setAlerts(res.alerts || []);
      } catch (err) {
        console.error('Failed to load alerts:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAlerts();
  }, [stateFilter, hazardFilter, severityFilter]);

  const mapMarkers = alerts.map((a) => ({
    id: a.id,
    lat: a.latitude,
    lng: a.longitude,
    title: a.title,
    subtitle: `${a.hazardType} (${a.severity}) • ${a.state}`,
    type: 'ALERT' as const,
    details: {
      District: a.district,
      Severity: a.severity,
      Source: a.source,
      Status: a.status,
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

  return (
    <main className="w-full pt-20 pb-space-3xl min-h-screen bg-surface">
      {/* Header Banner */}
      <section className="bg-surface-container-low py-space-xl border-b border-outline-variant/30">
        <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface">Home</Link>
            <span className="text-xs text-on-surface-variant">/</span>
            <span className="text-xs text-primary font-bold">National Early Warnings</span>
          </div>
          <h1 className="font-headline-xl text-3xl font-bold text-on-surface tracking-tight">
            Live Disaster Alerts &amp; Advisories
          </h1>
          <p className="font-body-sm text-sm text-on-surface-variant mt-1 max-w-2xl">
            Official multi-hazard bulletins issued by IMD, Central Water Commission, and State Emergency Operations Centres.
          </p>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm mt-space-lg max-w-3xl">
            <div>
              <label className="text-[11px] font-bold text-on-surface-variant block mb-1">State / Territory</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
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
                className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
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
                className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/30 outline-none focus:border-primary"
              >
                <option value="All">All Severities</option>
                <option value="CRITICAL">Critical Danger</option>
                <option value="WARNING">Warning</option>
                <option value="WATCH">Watch / Advisory</option>
                <option value="INFO">Informational</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-container-max mx-auto px-margin-mobile lg:px-margin-desktop mt-space-xl flex flex-col gap-space-xl">
        {/* National Alerts Map */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-base font-bold text-on-surface">Spatial Alert Telemetry</h3>
            <span className="text-xs text-on-surface-variant">Showing {alerts.length} Active Geographical Warnings</span>
          </div>
          <LeafletMap
            center={[21.0000, 78.0000]} // India approximate center
            zoom={5}
            markers={mapMarkers}
            className="h-80 w-full"
          />
        </div>

        {/* Alerts List */}
        <div className="flex flex-col gap-space-md">
          <h2 className="font-headline-sm text-lg font-bold text-on-surface">
            Active Warning Bulletins ({alerts.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-on-surface-variant">
              Loading active telemetry...
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-space-xl text-center rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant">
              No active warnings match your selected filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
                        {alert.hazardType} • {alert.district}, {alert.state}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getSeverityBadge(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>

                    <h3 className="font-headline-sm text-base font-bold text-on-surface leading-snug">
                      {alert.title}
                    </h3>

                    <p className="font-body-sm text-xs text-on-surface-variant mt-2 leading-relaxed">
                      {alert.description}
                    </p>
                  </div>

                  <div className="mt-space-md pt-space-sm border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>Source: <strong>{alert.source}</strong></span>
                    <Link
                      to={`/risk/${encodeURIComponent(alert.district || alert.state)}`}
                      className="font-bold text-primary hover:underline flex items-center gap-0.5"
                    >
                      <span>District Staging</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
