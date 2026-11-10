/**
 * Floating launcher for the existing JeevanGrid AI assistant.
 *
 * The orb is only mounted on the landing page. It opens the exact same
 * conversation surface used by /assistant, backed by AssistantContext, so
 * expanding to the full page preserves the entire conversation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAssistant } from '../../context/AssistantContext';
import { getStrings } from './assistantI18n';
import { AssistantConversation } from './AssistantConversation';

const SparkleIcon: React.FC<{ className?: string }> = ({ className = 'h-7 w-7' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M11.2 2.8a.9.9 0 0 1 1.6 0l1.5 4.5a2 2 0 0 0 1.3 1.3l4.5 1.5a.9.9 0 0 1 0 1.6l-4.5 1.5a2 2 0 0 0-1.3 1.3l-1.5 4.5a.9.9 0 0 1-1.6 0l-1.5-4.5a2 2 0 0 0-1.3-1.3L4 11.7a.9.9 0 0 1 0-1.6l4.5-1.5a2 2 0 0 0 1.3-1.3l1.4-4.5Z"
      fill="currentColor"
    />
    <path
      d="M18.8 15.1a.55.55 0 0 1 1 0l.7 2.1a1.2 1.2 0 0 0 .8.8l2.1.7a.55.55 0 0 1 0 1l-2.1.7a1.2 1.2 0 0 0-.8.8l-.7 2.1a.55.55 0 0 1-1 0l-.7-2.1a1.2 1.2 0 0 0-.8-.8l-2.1-.7a.55.55 0 0 1 0-1l2.1-.7a1.2 1.2 0 0 0 .8-.8l.7-2.1Z"
      fill="currentColor"
      opacity=".85"
    />
  </svg>
);

export const FloatingAssistant: React.FC = () => {
  const navigate = useNavigate();
  const { lang, conn } = useAssistant();
  const t = getStrings(lang);
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const orbRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const isDesktop =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;

  const close = () => {
    setOpen(false);
    window.setTimeout(() => orbRef.current?.focus(), 0);
  };

  const handleExpand = () => {
    setOpen(false);
    navigate('/assistant');
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        orbRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Mobile has no composer autofocus (avoids the keyboard covering the sheet),
  // so move focus into the dialog for keyboard/screen-reader users.
  useEffect(() => {
    if (!open || isDesktop) return;
    const timer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('[data-panel-close]')?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [open, isDesktop]);

  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia('(max-width: 639px)');
    const previousOverflow = document.body.style.overflow;
    const syncBodyScroll = () => {
      document.body.style.overflow = media.matches ? 'hidden' : previousOverflow;
    };
    syncBodyScroll();
    media.addEventListener('change', syncBodyScroll);
    return () => {
      media.removeEventListener('change', syncBodyScroll);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const connMeta =
    conn === 'online'
      ? { label: t.statusOnline, dot: 'bg-surface-tint' }
      : conn === 'degraded'
        ? { label: t.statusDegraded, dot: 'bg-[#d97706]' }
        : conn === 'offline'
          ? { label: t.statusOffline, dot: 'bg-error' }
          : { label: t.statusConnecting, dot: 'bg-outline animate-pulse' };

  const orbLabel = open ? t.floatingClose : t.floatingOpen;

  return createPortal(
    <>
      {/* The orb only exists on tablets and up. On phones a fixed orb always
          lands on top of something important, so the bottom navigation bar
          carries the assistant entry instead. */}
      <div
        className="fixed right-[max(1rem,var(--jg-safe-right))] z-[100] hidden sm:block"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <button
          ref={orbRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={orbLabel}
          aria-expanded={open}
          aria-controls="jeevangrid-ai-panel"
          aria-describedby="jeevangrid-ai-tooltip"
          className="group relative flex h-16 w-16 items-center justify-center rounded-full outline-none motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:scale-[1.06] motion-safe:active:scale-95 focus-visible:ring-4 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {/* Diffused outer glow */}
          <span
            aria-hidden="true"
            className="absolute -inset-2 rounded-full bg-[radial-gradient(circle_at_30%_22%,rgba(251,191,36,0.55),rgba(217,70,239,0.42)_34%,rgba(79,70,229,0.55)_68%,rgba(79,70,229,0)_78%)] opacity-80 blur-xl motion-safe:transition-opacity motion-safe:duration-300 group-hover:opacity-100"
          />
          {/* Luminous rim */}
          <span
            aria-hidden="true"
            className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-amber-300/80 via-fuchsia-400/70 to-indigo-500/80 blur-[2px]"
          />
          {/* Orb body */}
          <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_20%,#fde68a_0%,#f0abfc_20%,#818cf8_45%,#4f46e5_70%,#1e1b4b_100%)] shadow-[0_10px_30px_rgba(79,70,229,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)] ring-1 ring-white/40">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_22%,rgba(255,255,255,0.8),transparent_38%)] opacity-70"
            />
            <span className="relative flex items-center justify-center text-white drop-shadow-[0_1px_6px_rgba(30,27,75,0.45)]">
              {open ? (
                <span className="material-symbols-outlined text-[26px]" aria-hidden="true">
                  close
                </span>
              ) : (
                <SparkleIcon className="h-7 w-7" />
              )}
            </span>
          </span>

          <span
            id="jeevangrid-ai-tooltip"
            role="tooltip"
            className="pointer-events-none absolute right-full top-1/2 mr-3 hidden -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg bg-on-surface px-3 py-1.5 text-[11px] font-semibold text-surface opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none sm:block"
          >
            {orbLabel}
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.section
            ref={panelRef}
            id="jeevangrid-ai-panel"
            role="dialog"
            aria-label={t.floatingTitle}
            aria-modal="false"
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-x-3 z-[120] hidden flex-col overflow-hidden rounded-t-3xl border border-white/70 bg-surface-container-lowest shadow-[0_24px_80px_-20px_rgba(11,23,32,0.4)] ring-1 ring-primary/10 sm:inset-x-auto sm:left-auto sm:right-6 sm:top-auto sm:flex sm:h-[min(620px,calc(100dvh-9rem))] sm:w-[400px] sm:max-h-[calc(100dvh-12rem)]"
            style={{
              // Clear the fixed header (plus safe area) above.
              top: 'calc(var(--jg-header-h) + env(safe-area-inset-top) + 0.5rem)',
              bottom: 'calc(1rem + env(safe-area-inset-bottom))',
            }}
          >
            <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant/30 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.18),transparent_65%)] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_30%_20%,#fde68a_0%,#f0abfc_20%,#818cf8_45%,#4f46e5_70%,#1e1b4b_100%)] text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)] ring-1 ring-white/50">
                  <SparkleIcon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-on-surface">{t.floatingTitle}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-on-surface-variant">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connMeta.dot}`} aria-hidden="true" />
                    <span className="truncate">{connMeta.label}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleExpand}
                  aria-label={t.floatingExpand}
                  title={t.floatingExpand}
                  className="jg-icon-button h-11 w-11 shrink-0 text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="material-symbols-outlined text-[19px]" aria-hidden="true">
                    open_in_full
                  </span>
                </button>
                <button
                  type="button"
                  data-panel-close
                  onClick={close}
                  aria-label={t.floatingClose}
                  title={t.floatingClose}
                  className="jg-icon-button h-11 w-11 shrink-0 text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>
            </header>

            <AssistantConversation variant="panel" autoFocusComposer={isDesktop} />
          </motion.section>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};
