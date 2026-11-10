import React, { useState } from 'react';
import { getStrings } from './assistantI18n';

export interface ContextBarProps {
  lang: string;
  area: { city: string; district: string; state: string } | null;
  riskLevel: string | null;
  riskScore: number | null;
  updatedAt: string | null;
  loading: boolean;
  onSetLocation: (text: string) => void;
  onUseDeviceLocation: () => void;
  locating: boolean;
  /** Slim single-line layout for the floating assistant panel. */
  compact?: boolean;
}

/**
 * Location + risk context strip. Collapses to a location prompt
 * when nothing is known. Change flow is always explicit.
 */
export const ContextBar: React.FC<ContextBarProps> = ({
  lang,
  area,
  riskLevel,
  riskScore,
  updatedAt,
  loading,
  onSetLocation,
  onUseDeviceLocation,
  locating,
  compact = false,
}) => {
  const t = getStrings(lang);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (compact && !area && !editing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-2.5 py-1.5">
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-hidden="true">
          location_off
        </span>
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-on-surface-variant">
          {t.setLocationPrompt}
        </p>
        <button
          type="button"
          onClick={onUseDeviceLocation}
          disabled={locating}
          aria-label={t.useMyLocation}
          title={t.useMyLocation}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            my_location
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 min-h-[44px] rounded-xl bg-primary-container px-3.5 text-xs font-bold text-on-primary"
        >
          {t.changeLocation}
        </button>
      </div>
    );
  }

  if (compact && (editing || !area)) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            onSetLocation(draft.trim());
            setEditing(false);
            setDraft('');
          }
        }}
        className="flex gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-low p-1.5"
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="City, district or state"
          aria-label={t.changeLocation}
          className="h-11 min-w-0 flex-1 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-primary-container px-3.5 text-xs font-bold text-on-primary"
        >
          {t.send}
        </button>
        {area && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label={t.changeLocation}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-on-surface-variant"
          >
            ✕
          </button>
        )}
      </form>
    );
  }

  if (compact && area) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-2.5 py-1.5">
        <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
          location_on
        </span>
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-on-surface">
          {area.district} · {area.state}
        </p>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {loading ? '…' : riskLevel ? `${riskLevel}${riskScore !== null ? ` · ${riskScore}` : ''}` : '—'}
        </span>
        <button
          type="button"
          onClick={onUseDeviceLocation}
          disabled={locating}
          aria-label={t.useMyLocation}
          title={t.useMyLocation}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
            my_location
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t.changeLocation}
          title={t.changeLocation}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
            edit_location_alt
          </span>
        </button>
      </div>
    );
  }

  if (!area && !editing) {
    return (
      <div className="rounded-xl bg-surface-container-low border border-outline-variant/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <p className="text-xs text-on-surface-variant font-medium">{t.setLocationPrompt}</p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onUseDeviceLocation}
            disabled={locating}
            className="min-h-[44px] px-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs font-bold text-on-surface disabled:opacity-50"
          >
            {locating ? t.locating : t.useMyLocation}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="min-h-[44px] px-4 rounded-xl bg-primary-container text-on-primary text-xs font-bold"
          >
            {t.changeLocation}
          </button>
        </div>
      </div>
    );
  }

  if (editing || !area) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            onSetLocation(draft.trim());
            setEditing(false);
            setDraft('');
          }
        }}
        className="rounded-xl bg-surface-container-low border border-outline-variant/30 px-3 py-2.5 flex gap-2"
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="City, district or state — e.g. Guwahati"
          aria-label={t.changeLocation}
          className="min-w-0 flex-1 h-11 px-3 rounded-xl bg-surface-container-lowest text-sm text-on-surface border border-outline-variant/40 outline-none focus:border-primary"
        />
        <button type="submit" className="min-h-[44px] px-4 rounded-xl bg-primary-container text-on-primary text-xs font-bold">
          {t.send}
        </button>
        {area && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="min-h-[44px] px-3 rounded-xl text-xs font-bold text-on-surface-variant"
          >
            ✕
          </button>
        )}
      </form>
    );
  }

  return (
    <div className="rounded-xl bg-primary text-on-primary px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 justify-between">
      <div className="flex items-center gap-2.5">
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">location_on</span>
        <div>
          <p className="text-[10px] uppercase tracking-wider opacity-80 font-bold">{t.contextTitle}</p>
          <p className="text-sm font-bold leading-tight">
            {area.district} · {area.state}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider opacity-80 font-bold">{t.riskLabel}</p>
          <p className="text-sm font-bold leading-tight">
            {loading ? '…' : riskLevel ? `${riskLevel}${riskScore !== null ? ` · ${riskScore}/100` : ''}` : '—'}
          </p>
        </div>
        <div className="hidden sm:block">
          <p className="text-[10px] uppercase tracking-wider opacity-80 font-bold">{t.dataUpdated}</p>
          <p className="text-xs font-semibold leading-tight">{updatedAt || '—'}</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onUseDeviceLocation}
            disabled={locating}
            title={t.useMyLocation}
            aria-label={t.useMyLocation}
            className="h-11 w-11 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">my_location</span>
          </button>
          <button
            onClick={() => setEditing(true)}
            className="min-h-[44px] px-4 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors"
          >
            {t.changeLocation}
          </button>
        </div>
      </div>
    </div>
  );
};
