/**
 * Small shared UI atoms used across citizen and operations screens.
 *
 * These exist so the same information pattern (a metric, a status chip, an
 * empty state) looks identical everywhere, and so each one is built to
 * survive a 360px viewport without overflow.
 */
import React from 'react';
import { LiveSignal } from './Motion';

/* ------------------------------------------------------------------ */
/* PageHeader — title + supporting line + optional actions.            */
/* ------------------------------------------------------------------ */
export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}> = ({ eyebrow, title, description, actions, className = '' }) => (
  <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
    <div className="min-w-0">
      {eyebrow ? (
        <p className="jg-eyebrow text-signal-live mb-1.5">{eyebrow}</p>
      ) : null}
      <h1 className="text-headline-xl text-headline-xl text-on-surface">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-prose-measure text-sm leading-relaxed text-on-surface-variant">
          {description}
        </p>
      ) : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

/* ------------------------------------------------------------------ */
/* StatCard — one operational number.                                   */
/* ------------------------------------------------------------------ */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: string;
  tone?: 'default' | 'live' | 'warn' | 'critical' | 'info';
  className?: string;
}> = ({ label, value, hint, icon, tone = 'default', className = '' }) => {
  const toneRing =
    tone === 'live'
      ? 'border-signal-live/35 bg-signal-live-soft/60'
      : tone === 'warn'
        ? 'border-signal-warn/35 bg-signal-warn-soft/60'
        : tone === 'critical'
          ? 'border-signal-critical/35 bg-signal-critical-soft/60'
          : tone === 'info'
            ? 'border-signal-info/35 bg-signal-info-soft/60'
            : 'border-outline-variant/45 bg-surface-container-lowest';
  const iconTone =
    tone === 'live'
      ? 'text-signal-live'
      : tone === 'warn'
        ? 'text-signal-warn'
        : tone === 'critical'
          ? 'text-signal-critical'
          : tone === 'info'
            ? 'text-signal-info'
            : 'text-primary';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md ${toneRing} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="jg-eyebrow text-on-surface-variant min-w-0">{label}</p>
        {icon ? (
          <span className={`material-symbols-outlined text-[18px] shrink-0 ${iconTone}`} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="jg-metric mt-2 text-2xl leading-none">{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-on-surface-variant">{hint}</p> : null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* StatusChip — lifecycle status, always colour + label (never colour  */
/* alone, so it stays readable for colour-blind users).                */
/* ------------------------------------------------------------------ */
const STATUS_TONES: Record<string, string> = {
  NEW: 'bg-surface-container-high text-on-surface-variant',
  UNVERIFIED: 'bg-surface-container-high text-on-surface-variant',
  DUPLICATE_SUSPECTED: 'bg-signal-warn-soft text-signal-warn',
  VERIFIED: 'bg-signal-info-soft text-signal-info',
  ASSIGNED: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  ACCEPTED: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  EN_ROUTE: 'bg-signal-info-soft text-signal-info',
  ON_SITE: 'bg-signal-live-soft text-signal-live',
  IN_PROGRESS: 'bg-signal-live-soft text-signal-live',
  RESOLVED_PENDING_REVIEW: 'bg-signal-warn-soft text-signal-warn',
  RESOLVED: 'bg-signal-live-soft text-signal-live',
  REJECTED: 'bg-signal-critical-soft text-signal-critical',
  REOPENED: 'bg-signal-warn-soft text-signal-warn',
  PENDING: 'bg-surface-container-high text-on-surface-variant',
  DISPATCHED: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  OFFICER_VERIFIED: 'bg-signal-info-soft text-signal-info',
  CORROBORATED: 'bg-signal-info-soft text-signal-info',
  ACTIVE: 'bg-signal-live-soft text-signal-live',
};

export const StatusChip: React.FC<{
  status: string;
  className?: string;
  pulse?: boolean;
}> = ({ status, className = '', pulse = false }) => {
  const tone = STATUS_TONES[String(status).toUpperCase()] ?? 'bg-surface-container-high text-on-surface-variant';
  const label = String(status)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${tone} ${className}`}
    >
      {pulse ? <LiveSignal tone="live" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* EmptyState — an empty screen is an invitation to act.               */
/* ------------------------------------------------------------------ */
export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon = 'inbox', title, description, action, className = '' }) => (
  <div
    className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low px-5 py-10 text-center ${className}`}
  >
    <span
      className="material-symbols-outlined text-[30px] text-on-surface-variant/70"
      aria-hidden="true"
    >
      {icon}
    </span>
    <p className="mt-2 text-sm font-bold text-on-surface">{title}</p>
    <p className="mt-1 max-w-sm text-xs leading-relaxed text-on-surface-variant">{description}</p>
    {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
  </div>
);

/* ------------------------------------------------------------------ */
/* SectionLabel — a rule with a label, used to break long pages.       */
/* ------------------------------------------------------------------ */
export const SectionLabel: React.FC<{
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ children, action, className = '' }) => (
  <div className={`flex items-center justify-between gap-3 ${className}`}>
    <h2 className="text-sm font-bold tracking-tight text-on-surface">{children}</h2>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

/* ------------------------------------------------------------------ */
/* KeyValue — a definition row that never overflows.                   */
/* ------------------------------------------------------------------ */
export const KeyValue: React.FC<{
  label: string;
  value: React.ReactNode;
  className?: string;
  mono?: boolean;
}> = ({ label, value, className = '', mono = false }) => (
  <div className={`flex flex-col gap-0.5 min-w-0 ${className}`}>
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
      {label}
    </span>
    <span className={`min-w-0 break-words text-xs text-on-surface ${mono ? 'jg-code' : ''}`}>
      {value}
    </span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Skeleton — loading placeholder that matches real content height.    */
/* ------------------------------------------------------------------ */
export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div className={`jg-skeleton ${className}`} aria-hidden="true" />
);
