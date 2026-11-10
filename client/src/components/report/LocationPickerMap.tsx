import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface PickedLocation {
  lat: number;
  lng: number;
}

const ClickCatcher: React.FC<{
  enabled: boolean;
  onAdd: (lat: number, lng: number) => void;
}> = ({ enabled, onAdd }) => {
  useMapEvents({
    click: (event) => {
      if (enabled) onAdd(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
};

/**
 * Manual incident-location picker. Click the map or drag the marker; the
 * parent owns the picked coordinates and performs reverse geocoding.
 */
export const LocationPickerMap: React.FC<{
  center?: [number, number];
  position?: PickedLocation | null;
  onPick?: (lat: number, lng: number) => void;
  height?: number;
  className?: string;
}> = ({
  center = [19.05, 72.87],
  position: initialPosition = null,
  onPick,
  height = 260,
  className = 'w-full overflow-hidden rounded-xl',
}) => {
  const [position, setPosition] = useState<PickedLocation | null>(initialPosition);

  useEffect(() => {
    if (initialPosition) setPosition(initialPosition);
  }, [initialPosition?.lat, initialPosition?.lng]);

  const handlePick = (lat: number, lng: number) => {
    const next = { lat, lng };
    setPosition(next);
    onPick?.(lat, lng);
  };

  const handleDragEnd = (event: any) => {
    const latLng = event?.target?.latLng;
    const lat = Number(latLng?.lat);
    const lng = Number(latLng?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const next = { lat, lng };
    setPosition(next);
    onPick?.(lat, lng);
  };

  return (
    <div className={className} style={{ height: `${height}px` }}>
      <MapContainer
        center={position ? [position.lat, position.lng] : center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {position ? (
          <Marker
            position={[position.lat, position.lng]}
            draggable
            eventHandlers={{ dragend: handleDragEnd }}
          />
        ) : null}
        <ClickCatcher enabled onAdd={handlePick} />
      </MapContainer>
    </div>
  );
};
