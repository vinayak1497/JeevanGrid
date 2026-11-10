import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getStrings } from '../components/ai/assistantI18n';
import { AssistantConversation } from '../components/ai/AssistantConversation';
import { useAssistant } from '../context/AssistantContext';
import { Sheet } from '../components/ui/Sheet';
import { LiveSignal } from '../components/ui/Motion';

export const AssistantPage: React.FC<{ onOpenEmergencyModal: () => void }> = ({
  onOpenEmergencyModal,
}) => {
  const { lang, conn, area, riskLevel, riskScore, riskUpdated, riskLoading, helplines } =
    useAssistant();
  const t = getStrings(lang);
  const reduce = useReducedMotion();
  const [contextOpen, setContextOpen] = useState(false);

  const connMeta =
    conn === 'online'
      ? { label: t.statusOnline, tone: 'live' as const, text: 'text-primary' }
      : conn === 'degraded'
        ? { label: t.statusDegraded, tone: 'warn' as const, text: 'text-signal-warn' }
        : conn === 'offline'
          ? { label: t.statusOffline, tone: 'critical' as const, text: 'text-error' }
          : { label: t.statusConnecting, tone: 'idle' as const, text: 'text-on-surface-variant' };

  const contextCard = (
    <>
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
          {t.contextTitle}
        </h2>
        {area ? (
          <div className="flex flex-col gap-1 text-xs">
            <p className="text-sm font-bold text-on-surface">{area.district}</p>
            <p className="text-on-surface-variant">
              {area.city} · {area.state}
            </p>
            <p className="text-on-surface-variant">
              {t.riskLabel}:{' '}
              <strong className="text-on-surface">
                {riskLoading ? '…' : riskLevel || '—'}
              </strong>
              {riskScore !== null ? ` · ${riskScore}/100` : ''}
            </p>
            <p className="text-on-surface-variant">
              {t.dataUpdated}: {riskUpdated || '—'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant">{t.setLocationPrompt}</p>
        )}
      </div>

      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
        <button
          type="button"
          onClick={onOpenEmergencyModal}
          className="jg-button-danger w-full"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            call
          </span>
          {t.needRescue}
        </button>
        <div className="mt-2 flex flex-col">
          {helplines.map((h) => (
            <a
              key={h.code}
              href={`tel:${h.code}`}
              className="flex min-h-[44px] items-center justify-between gap-3 border-b border-outline-variant/20 py-2 last:border-0"
            >
              <span className="min-w-0 flex-1 text-xs text-on-surface-variant">{h.service}</span>
              <span className="jg-code shrink-0 text-primary">{h.code}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
        <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
          Official sources
        </h2>
        <div className="flex flex-col gap-1 text-xs">
          {[
            ['IMD warnings', 'https://mausam.imd.gov.in/'],
            ['SACHET (NDMA)', 'https://sachet.ndma.gov.in/'],
            ['INCOIS advisories', 'https://incois.gov.in/'],
          ].map(([label, url]) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-secondary hover:underline"
            >
              {label}
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                open_in_new
              </span>
            </a>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <main className="jg-page flex min-h-[100dvh] flex-col bg-surface pb-space-2xl">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-space-md px-[max(1rem,var(--jg-safe-left))] py-space-lg">
        {/* Status + context actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center text-xs text-on-surface-variant hover:text-on-surface"
            >
              Home
            </Link>
            <span className="text-xs text-on-surface-variant" aria-hidden="true">
              /
            </span>
            <span className="truncate text-xs font-bold text-primary">AI Safety Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              role="status"
              aria-label={connMeta.label}
              className={`inline-flex h-8 items-center gap-2 rounded-full border border-outline-variant/40 bg-surface-container-lowest px-3 text-[11px] font-bold ${connMeta.text}`}
            >
              <LiveSignal tone={connMeta.tone} />
              {connMeta.label}
            </span>
            {/* On phones the sidebar content lives behind this button. */}
            <button
              type="button"
              onClick={() => setContextOpen(true)}
              className="jg-button-secondary lg:hidden"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                info
              </span>
              Context
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-space-md lg:grid-cols-3">
          {/* Conversation column — shared with the floating panel */}
          <div className="min-w-0 lg:col-span-2">
            <AssistantConversation variant="page" />
          </div>

          {/* Context sidebar (desktop) */}
          <aside className="sticky top-24 hidden flex-col gap-space-md lg:flex">{contextCard}</aside>
        </div>
      </div>

      {/* Mobile context sheet */}
      <Sheet
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        title="Context and helplines"
        description="Your area, live risk and emergency numbers."
      >
        <div className="flex flex-col gap-3">{contextCard}</div>
      </Sheet>
    </main>
  );
};
