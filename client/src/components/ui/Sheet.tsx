/**
 * Bottom sheet / dialog primitive.
 *
 * On phones this is a bottom sheet that slides up from the safe-area edge;
 * on tablets and up it becomes a centred dialog. Either way it locks page
 * scroll, traps focus, closes on Escape, and never lets its content spill
 * outside the viewport.
 */
import React, { useCallback, useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Set false for dialogs that must be answered (e.g. emergency dials). */
  dismissible?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
};

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = 'md',
}) => {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    document.addEventListener('keydown', handleKeyDown);
    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>('[data-sheet-autofocus]');
      (target ?? panel).focus();
    }, 60);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      window.clearTimeout(timer);
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center sm:justify-center">
          <motion.div
            className="absolute inset-0 bg-on-surface/45 backdrop-blur-[2px]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.22 }}
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={
              reduce
                ? false
                : { opacity: 0, y: '4%', scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: '4%', scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full ${SIZES[size]} flex max-h-[92dvh] sm:max-h-[86dvh] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-2xl outline-none`}
          >
            {/* Grab handle (mobile only) */}
            <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-outline-variant" />
            </div>

            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-outline-variant/30 px-5 pb-3 pt-3 sm:px-6 sm:pt-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-bold leading-tight text-on-surface">
                  {title}
                </h2>
                {description ? (
                  <p id={descId} className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={!dismissible}
                aria-label="Close"
                className="jg-icon-button -mr-1 shrink-0 text-on-surface-variant disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
              {children}
            </div>

            {footer ? (
              <footer className="shrink-0 border-t border-outline-variant/30 bg-surface-container-low px-5 py-3 pb-[calc(0.75rem+var(--jg-safe-bottom))] sm:px-6 sm:pb-4">
                {footer}
              </footer>
            ) : (
              <div className="h-[calc(0.75rem+var(--jg-safe-bottom))] shrink-0 sm:h-0" aria-hidden="true" />
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
};
