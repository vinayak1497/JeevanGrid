import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BASEMAPS, type BasemapKey } from '../map/mapStyles';

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  type: 'ALERT' | 'HOSPITAL' | 'SHELTER' | 'INCIDENT' | 'USER_LOCATION' | 'QUAKE' | 'LIVE_POI' | 'EMERGENCY';
  details?: Record<string, any>;
}

export interface MapRiskZone {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
  fillOpacity?: number;
  label: string;
}

export interface MapFlowLine {
  id: string;
  points: Array<[number, number]>;
  color: string;
  weight?: number;
  dashArray?: string;
  label: string;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  riskZones?: MapRiskZone[];
  flowLines?: MapFlowLine[];
  basemap?: BasemapKey;
  radarUrl?: string | null;
  radarAttribution?: string;
  showZoneLabels?: boolean;
  className?: string;
  cornerTopRight?: React.ReactNode;
  resetSignal?: number;
  onLocateFound?: (lat: number, lng: number) => void;
  onLocateError?: (message: string) => void;
}

// Map center synchronizer (basemap switches never touch the view)
const CenterController: React.FC<{ center: [number, number]; zoom: number; resetSignal?: number }> = ({ center, zoom, resetSignal }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, resetSignal, map]);
  return null;
};

const cornerBtn =
  'w-9 h-9 rounded-lg bg-white text-on-surface border border-outline-variant/50 shadow-md flex items-center justify-center hover:bg-surface-container-low transition-colors';

const LocateButton: React.FC<{ onFound?: (lat: number, lng: number) => void; onError?: (m: string) => void }> = ({
  onFound,
  onError,
}) => {
  const map = useMap();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      aria-label="Locate me"
      title="Locate me"
      disabled={busy}
      className={cornerBtn}
      onClick={() => {
        if (!('geolocation' in navigator)) {
          onError?.('Geolocation is not supported on this device.');
          return;
        }
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setBusy(false);
            map.setView([pos.coords.latitude, pos.coords.longitude], 13);
            onFound?.(pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            setBusy(false);
            onError?.('Location permission denied or unavailable.');
          },
          { timeout: 8000 }
        );
      }}
    >
      <span className={`material-symbols-outlined text-[18px] ${busy ? 'animate-pulse' : ''}`}>my_location</span>
    </button>
  );
};

const ResetViewButton: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  return (
    <button
      aria-label="Reset view to district"
      title="Reset view to district"
      className={cornerBtn}
      onClick={() => map.setView(center, zoom)}
    >
      <span className="material-symbols-outlined text-[18px]">center_focus_strong</span>
    </button>
  );
};

const FullscreenButton: React.FC<{ targetRef: React.RefObject<HTMLDivElement> }> = ({ targetRef }) => {
  const map = useMap();
  const [active, setActive] = React.useState(false);
  useEffect(() => {
    const onChange = () => {
      const isFull = Boolean(document.fullscreenElement);
      setActive(isFull);
      // Leaflet must recalc tile layout after the container resizes
      setTimeout(() => map.invalidateSize(), 250);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [map]);
  return (
    <button
      aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
      title={active ? 'Exit fullscreen' : 'Enter fullscreen'}
      className={cornerBtn}
      onClick={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => undefined);
        } else {
          targetRef.current?.requestFullscreen?.().catch(() => undefined);
        }
      }}
    >
      <span className="material-symbols-outlined text-[18px]">{active ? 'fullscreen_exit' : 'fullscreen'}</span>
    </button>
  );
};

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center = [19.0760, 72.8777],
  zoom = 12,
  markers = [],
  riskZones = [],
  flowLines = [],
  basemap = 'standard',
  radarUrl = null,
  radarAttribution = 'Precipitation radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>',
  showZoneLabels = false,
  className = 'h-96 w-full',
  cornerTopRight = null,
  resetSignal = 0,
  onLocateFound,
  onLocateError,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const base = BASEMAPS[basemap] || BASEMAPS.standard;

  // Create customized SVG icons for different marker types
  const createMarkerIcon = (type: MapMarker['type']) => {
    let color = '#15432c'; // primary green
    let iconName = 'location_on';

    if (type === 'ALERT' || type === 'INCIDENT') {
      color = '#ba1a1a'; // error red
      iconName = 'warning';
    } else if (type === 'QUAKE') {
      color = '#7c2d12'; // deep seismic brown-red
      iconName = 'activity_zone';
    } else if (type === 'LIVE_POI') {
      color = '#6d28d9'; // civic violet for live OSM POIs
      iconName = 'place';
    } else if (type === 'EMERGENCY') {
      color = '#b45309'; // restrained amber for fire/police
      iconName = 'local_police';
    } else if (type === 'HOSPITAL') {
      color = '#023d67'; // tertiary blue
      iconName = 'local_hospital';
    } else if (type === 'SHELTER') {
      color = '#2a6866'; // secondary teal
      iconName = 'night_shelter';
    } else if (type === 'USER_LOCATION') {
      color = '#3b674e';
      iconName = 'my_location';
    }

    return L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">
          <span class="material-symbols-outlined" style="font-size: 18px; line-height: 1;">${iconName}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  };

  return (
    <div ref={wrapperRef} className={`relative rounded-xl overflow-hidden shadow-sm border border-outline-variant/30 bg-surface-container-low ${className}`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <CenterController center={center} zoom={zoom} resetSignal={resetSignal} />
        {/* Basemap swaps here; overlays below are untouched by the switch */}
        <TileLayer
          key={base.key}
          attribution={base.attribution}
          url={base.url}
          {...(base.subdomains ? { subdomains: base.subdomains } : {})}
          maxZoom={base.maxZoom}
        />
        {radarUrl && (
          <TileLayer url={radarUrl} attribution={radarAttribution} opacity={0.55} zIndex={5} />
        )}
        {flowLines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.points}
            pathOptions={{
              color: line.color,
              weight: line.weight ?? 3,
              opacity: 0.85,
              ...(line.dashArray ? { dashArray: line.dashArray } : {}),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1} sticky>
              <span className="text-[11px] font-bold">{line.label}</span>
            </Tooltip>
          </Polyline>
        ))}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={createMarkerIcon(marker.type)}
          >
            <Popup>
              <div className="p-1 max-w-xs font-sans text-xs">
                <div className="flex items-center gap-1 font-bold text-sm text-on-surface">
                  <span>{marker.title}</span>
                </div>
                {marker.subtitle && (
                  <p className="text-on-surface-variant text-[11px] mt-0.5">{marker.subtitle}</p>
                )}
                {marker.details && (
                  <div className="mt-2 pt-1.5 border-t border-outline-variant/20 flex flex-col gap-0.5">
                    {Object.entries(marker.details).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-[11px]">
                        <span className="text-on-surface-variant capitalize">{key}:</span>
                        <span className="font-semibold text-on-surface">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
        {riskZones.map((zone) => (
          <Circle
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={zone.radiusM}
            pathOptions={{
              color: zone.color,
              weight: 2,
              opacity: 0.9,
              fillColor: zone.color,
              fillOpacity: zone.fillOpacity ?? 0.18,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent={showZoneLabels}>
              <span className="text-[11px] font-bold">{zone.label}</span>
            </Tooltip>
          </Circle>
        ))}
        <div className="leaflet-bottom leaflet-right">
          <div className="leaflet-control flex flex-col gap-1.5 !m-0 !mb-3 !mr-3">
            <LocateButton onFound={onLocateFound} onError={onLocateError} />
            <ResetViewButton center={center} zoom={zoom} />
            <FullscreenButton targetRef={wrapperRef} />
          </div>
        </div>
      </MapContainer>
      {cornerTopRight}
    </div>
  );
};
