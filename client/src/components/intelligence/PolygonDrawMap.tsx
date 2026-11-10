import React, { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Point {
  lat: number;
  lng: number;
}

const ClickCatcher: React.FC<{ enabled: boolean; onAdd: (lat: number, lng: number) => void }> = ({
  enabled,
  onAdd,
}) => {
  useMapEvents({
    click(event) {
      if (enabled) onAdd(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

/**
 * Minimal, dependency-free polygon drawing surface. Click to add vertices.
 * The parent is responsible for labelling the polygon as a simulation if used
 * for a tabletop scenario.
 */
export const PolygonDrawMap: React.FC<{
  center: [number, number];
  zoom?: number;
  points: Point[];
  onChange: (points: Point[]) => void;
  enabled?: boolean;
  className?: string;
}> = ({ center, zoom = 10, points, onChange, enabled = true, className = 'h-64 w-full rounded-xl overflow-hidden' }) => {
  const [view, setView] = useState<[number, number]>(center);

  useEffect(() => {
    // Only recenter when the requested center actually changes, so drawing
    // does not fight the map view.
    setView(center);
  }, [center[0], center[1]]);

  return (
    <div className={className}>
      <MapContainer center={view} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCatcher enabled={enabled} onAdd={(lat, lng) => onChange([...points, { lat, lng }])} />
        {points.length > 1 && (
          <Polyline
            positions={points.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#9a3412', weight: 2, dashArray: '6 4' }}
          />
        )}
        {points.map((p, index) => (
          <CircleMarker
            key={`${p.lat}-${p.lng}-${index}`}
            center={[p.lat, p.lng]}
            radius={5}
            pathOptions={{ color: '#7c2d12', fillColor: '#fff7ed', fillOpacity: 1, weight: 2 }}
          />
        ))}
      </MapContainer>
    </div>
  );
};
