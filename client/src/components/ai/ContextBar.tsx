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
}) => {
  const t = getStrings(lang);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!area && !editing) {
    return (
      <div className="rounded-xl bg-surface-container-low border border-outline-variant/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <p className="text-xs text-on-surface-variant font-medium">{t.setLocationPrompt}</p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={onUseDeviceLocation}
            disabled={locating}
            className="px-3 h-9 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-xs font-bold text-on-surface disabled:opacity-50"
          >
            {locating ? t.locating : t.useMyLocation}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="px-3 h-9 rounded-lg bg-primary-container text-on-primary text-xs font-bold"
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
          className="flex-1 h-10 px-3 rounded-lg bg-surface-container-lowest text-sm text-on-surface border border-outline-variant/40 outline-none focus:border-primary"
        />
        <button type="submit" className="px-4 h-10 rounded-lg bg-primary-container text-on-primary text-xs font-bold">
          {t.send}
        </button>
        {area && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-3 h-10 rounded-lg text-xs font-bold text-on-surface-variant"
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
            className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">my_location</span>
          </button>
          <button
            onClick={() => setEditing(true)}
            className="px-3 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors"
          >
            {t.changeLocation}
          </button>
        </div>
      </div>
    </div>
  );
};
