import React, { useState } from 'react';
import { apiFetch } from '../../api/client';
import { useAssistant } from '../../context/AssistantContext';
import { getStrings } from '../ai/assistantI18n';

type LocationPermissionCardProps = {
  /** Landing page variant keeps its own dismissal state; assistant panel uses context values. */
  variant?: 'landing' | 'assistant';
};

export const LocationPermissionCard: React.FC<LocationPermissionCardProps> = ({
  variant = 'landing',
}) => {
  const {
    lang,
    deviceLocation,
    locationPermission,
    locationMessage,
    locating,
    requestDeviceLocation,
    handleSetLocation,
    area,
    startReportFlow,
  } = useAssistant();
  const t = getStrings(lang);
  const [localAreaDraft, setLocalAreaDraft] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const useContextCard = variant === 'assistant';
  const show =
    useContextCard || (variant === 'landing' && !dismissed);

  if (!show) return null;

  const enableLocation = () => {
    void requestDeviceLocation();
  };

  const enterArea = () => {
    const value = localAreaDraft.trim();
    if (value) void handleSetLocation(value);
    setLocalAreaDraft('');
  };

  let content: React.ReactNode;

  if (locationPermission === 'GRANTED' && deviceLocation) {
    content = (
      <div className="rounded-2xl border border-secondary/40 bg-secondary-container/25 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
              Location ready
            </p>
            <p className="mt-1 text-sm font-bold text-on-surface">
              ±{deviceLocation.accuracyM ?? '?'} m accuracy · GPS source
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Captured at {new Date(deviceLocation.capturedAt).toLocaleTimeString()} ·{' '}
              {deviceLocation.address || deviceLocation.locality || 'Current area'}
            </p>
            {locationMessage && (
              <p className="mt-1 text-[11px] text-on-surface-variant">{locationMessage}</p>
            )}
          </div>
          <span className="material-symbols-outlined text-[22px] text-secondary" aria-hidden="true">
            my_location
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => startReportFlow()}
            className="min-h-[44px] rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary"
          >
            Report incident from this location
          </button>
          <button
            type="button"
            onClick={() => setLocalAreaDraft(area?.label || '')}
            className="min-h-[44px] rounded-xl border border-outline-variant/40 px-4 py-2.5 text-xs font-bold text-on-surface-variant"
          >
            Use different area
          </button>
        </div>
      </div>
    );
  }

  if (locationPermission === 'REQUESTING') {
    content = (
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
        <p className="text-sm font-bold text-on-surface">Requesting location…</p>
        <p className="mt-1 text-xs text-on-surface-variant">{locationMessage || 'Waiting for permission.'}</p>
      </div>
    );
  }

  if (
    locationPermission === 'DENIED' ||
    locationPermission === 'UNAVAILABLE' ||
    locationPermission === 'TIMEOUT' ||
    (locationPermission === 'NOT_REQUESTED' && !deviceLocation)
  ) {
    const needsLocation = locationPermission === 'NOT_REQUESTED';
    content = (
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
        <p className="text-sm font-bold text-on-surface">
          {needsLocation ? 'Enable location for safer incident mapping' : 'Device location unavailable'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          {locationMessage || 'We will not request continuous tracking. Location is captured only when you use it for a report.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={enableLocation}
            disabled={locating}
            className="min-h-[44px] rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary disabled:opacity-60"
          >
            {locating ? 'Locating…' : 'Enable Location'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="min-h-[44px] rounded-xl border border-outline-variant/40 px-4 py-2.5 text-xs font-bold text-on-surface-variant"
          >
            Not now
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={localAreaDraft}
            onChange={(e) => setLocalAreaDraft(e.target.value)}
            placeholder="Enter area, landmark or address"
            aria-label="Location area"
            className="h-11 min-w-0 flex-1 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={enterArea}
            className="h-11 rounded-xl bg-primary-container px-4 text-xs font-bold text-on-primary"
          >
            Use area
          </button>
        </div>
      </div>
    );
  }

  if (locationPermission === 'MANUAL') {
    content = (
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
        <p className="text-sm font-bold text-on-surface">Manual area set</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          This area is used for risk context. An incident can still use explicit device coordinates or a manual map pin.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={localAreaDraft}
            onChange={(e) => setLocalAreaDraft(e.target.value)}
            placeholder="Enter area, landmark or address"
            aria-label="Location area"
            className="h-11 min-w-0 flex-1 rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={enterArea}
            className="h-11 rounded-xl bg-primary-container px-4 text-xs font-bold text-on-primary"
          >
            Use area
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-location-permission-card
      className="w-full min-w-0 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm"
    >
      {content}
    </div>
  );
};
