import React from 'react';

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || typeof value === 'undefined') return 'Unavailable';
  return new Intl.NumberFormat('en-IN').format(value);
}

const TONES: Record<string, string> = {
  neutral: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40',
  primary: 'bg-[#e9f3ed] text-primary border-primary/20',
  warning: 'bg-[#fff7ed] text-[#9a3412] border-[#fed7aa]',
  danger: 'bg-error-container text-on-error-container border-error/20',
  info: 'bg-[#eef2ff] text-[#3730a3] border-[#c7d2fe]',
  simulation: 'bg-[#fef3c7] text-[#92400e] border-[#fbbf24]',
};

export const StatusBadge: React.FC<{
  tone?: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'neutral', children, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${TONES[tone]} ${className}`}
  >
    {children}
  </span>
);

export function verificationTone(status: string): keyof typeof TONES {
  if (status === 'OFFICER_VERIFIED' || status === 'RESOLVED') return 'primary';
  if (status === 'CORROBORATED') return 'info';
  if (status === 'DUPLICATE_SUSPECTED') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

export function confidenceTone(confidence: string): keyof typeof TONES {
  if (confidence === 'HIGH') return 'primary';
  if (confidence === 'MEDIUM') return 'info';
  if (confidence === 'LOW') return 'warning';
  return 'danger';
}

export const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, actions, children, className = '' }) => (
  <section
    className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm ${className}`}
  >
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-space-md pt-space-md">
      <div className="flex items-start gap-2.5">
        {icon && (
          <span className="material-symbols-outlined text-[21px] text-primary mt-0.5" aria-hidden="true">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-sm font-bold text-on-surface">{title}</h2>
          {subtitle && <p className="text-[11px] text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
    <div className="p-space-md">{children}</div>
  </section>
);

export const Metric: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof TONES;
}> = ({ label, value, hint, tone = 'neutral' }) => (
  <div className={`rounded-xl border px-3 py-2.5 ${TONES[tone]}`}>
    <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</div>
    <div className="text-xl font-bold font-code-num leading-tight mt-0.5">{value}</div>
    {hint && <div className="text-[10px] mt-0.5 opacity-80 leading-snug">{hint}</div>}
  </div>
);

export const EmptyState: React.FC<{ icon?: string; title: string; body?: string }> = ({
  icon = 'inbox',
  title,
  body,
}) => (
  <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-4 py-6 text-center">
    <span className="material-symbols-outlined text-[26px] text-on-surface-variant" aria-hidden="true">
      {icon}
    </span>
    <div className="text-xs font-bold text-on-surface mt-1">{title}</div>
    {body && <p className="text-[11px] text-on-surface-variant mt-1 max-w-md mx-auto">{body}</p>}
  </div>
);

export const DataCaveat: React.FC<{ children: React.ReactNode; tone?: keyof typeof TONES }> = ({
  children,
  tone = 'neutral',
}) => (
  <div className={`rounded-lg border px-3 py-2 text-[10.5px] leading-relaxed ${TONES[tone]}`}>
    {children}
  </div>
);

export const primaryButton =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]';
export const secondaryButton =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] border border-outline-variant/40';
export const dangerButton =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-error-container text-on-error-container text-xs font-bold hover:bg-[#ffd7d7] disabled:opacity-50 transition-all active:scale-[0.98] border border-error/25';
