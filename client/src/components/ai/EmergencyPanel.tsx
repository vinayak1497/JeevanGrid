import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getStrings } from './assistantI18n';

export interface EmergencyPlace {
  name: string;
  detail: string;
  phone?: string;
}

/**
 * Emergency-mode panel: actions first, never buried in chat text.
 * The assistant cannot dispatch services — every path is call/navigate.
 */
export const EmergencyPanel: React.FC<{
  lang: string;
  reason?: string;
  hospitals: EmergencyPlace[];
  locationLabel: string;
}> = ({ lang, reason, hospitals, locationLabel }) => {
  const t = getStrings(lang);
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);

  const shareLocation = async () => {
    const text = `I need emergency help. My area: ${locationLabel}. Please call me back. (via JeevanGrid)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="alert"
      aria-label={t.emergencyTitle}
      className="rounded-xl border-2 border-error bg-error-container/25 p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-lg bg-error text-on-error flex items-center justify-center shrink-0" aria-hidden="true">
          <span className="material-symbols-outlined text-[22px]">e911_emergency</span>
        </span>
        <div>
          <h3 className="font-headline-sm text-base font-bold text-on-error-container leading-tight">
            {t.emergencyTitle}
          </h3>
          <p className="text-xs text-on-surface mt-0.5">
            {reason ? `${reason}. ` : ''}{t.emergencySub}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a
          href="tel:112"
          className="py-3 rounded-lg bg-error text-on-error font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#991b1b] transition-colors min-h-[48px]"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">call</span>
          {t.call112}
        </a>
        <button
          onClick={() => navigate(`/risk/${encodeURIComponent(locationLabel)}`)}
          className="py-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-bold text-sm flex items-center justify-center gap-2 min-h-[48px]"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">night_shelter</span>
          {t.findShelter}
        </button>
        <button
          onClick={() => navigate(`/risk/${encodeURIComponent(locationLabel)}`)}
          className="py-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-bold text-sm flex items-center justify-center gap-2 min-h-[48px]"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">local_hospital</span>
          {t.findHospital}
        </button>
        <button
          onClick={shareLocation}
          className="py-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface font-bold text-sm flex items-center justify-center gap-2 min-h-[48px]"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">share_location</span>
          {copied ? t.copied : t.shareLocation}
        </button>
      </div>

      {hospitals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {hospitals.slice(0, 2).map((h) => (
            <div key={h.name} className="flex items-center justify-between gap-2 text-xs bg-surface-container-lowest rounded-lg px-3 py-2 border border-outline-variant/20">
              <div className="min-w-0">
                <span className="font-bold text-on-surface block truncate">{h.name}</span>
                <span className="text-on-surface-variant block truncate">{h.detail}</span>
              </div>
              {h.phone && (
                <a href={`tel:${h.phone.replace(/[^+\d]/g, '')}`} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold shrink-0">
                  Call
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
