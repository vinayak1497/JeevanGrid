import React, { useEffect, useState } from 'react';
import { getStrings } from './assistantI18n';

export interface ToolStepView {
  key: string;
  label: string;
  status: 'done' | 'skipped';
  detail?: string;
}

/**
 * Compact agentic activity indicator: steps tick over quickly while the
 * reply streams in, then collapse into a one-line summary with details.
 */
export const ToolActivity: React.FC<{ steps: ToolStepView[]; lang: string; live: boolean }> = ({
  steps,
  lang,
  live,
}) => {
  const t = getStrings(lang);
  const [visibleCount, setVisibleCount] = useState(live ? 0 : steps.length);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!live) {
      setVisibleCount(steps.length);
      return;
    }
    setVisibleCount(0);
    if (steps.length === 0) return;
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= steps.length) window.clearInterval(timer);
    }, 450);
    return () => window.clearInterval(timer);
  }, [live, steps]);

  if (steps.length === 0) return null;
  const complete = !live || visibleCount >= steps.length;

  return (
    <div className="rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2" aria-live="polite">
      {!complete ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-on-surface flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            {t.toolWorking}
          </span>
          {steps.slice(0, visibleCount).map((s) => (
            <span key={s.key} className="text-[11px] text-surface-tint font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">check_circle</span>
              {s.label}
              {s.detail && <span className="text-on-surface-variant font-normal">· {s.detail}</span>}
            </span>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <span className="text-[11px] font-bold text-surface-tint flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">verified</span>
            {t.toolDone} · {steps.filter((s) => s.status === 'done').length}/{steps.length}
          </span>
          <span className="text-[11px] font-bold text-primary">{expanded ? t.hideDetails : t.viewDetails}</span>
        </button>
      )}
      {complete && expanded && (
        <div className="mt-1.5 pt-1.5 border-t border-outline-variant/20 flex flex-col gap-1">
          {steps.map((s) => (
            <span key={s.key} className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                {s.status === 'done' ? 'check_circle' : 'remove_circle'}
              </span>
              {s.label}
              {s.detail && <span>· {s.detail}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
