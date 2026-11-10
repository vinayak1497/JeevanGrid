/**
 * Global language selector.
 *
 * - Native script names, no flags, no emojis
 * - Keyboard navigation (ArrowUp/Down, Enter, Escape, Tab)
 * - Focus-visible states, aria-expanded/activedescendant, listbox semantics
 * - Closes on outside click / Escape
 * - Persists via LanguageProvider, updates UI without reload
 * - On phones the list becomes a bottom sheet so it can never be clipped by
 *   the viewport or sit under the assistant orb.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';
import { useLanguage } from '../i18n/LanguageContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Sheet } from './ui/Sheet';

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { lang, setLang, t } = useLanguage();
  const reduce = useReducedMotion();
  const isPhone = useMediaQuery('(max-width: 639px)');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, SUPPORTED_LANGUAGES.findIndex((l) => l.code === lang))
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === lang) ?? SUPPORTED_LANGUAGES[0];

  // Close on outside click (desktop popover only)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep active item in sync when opened
  useEffect(() => {
    if (open) setActiveIndex(Math.max(0, SUPPORTED_LANGUAGES.findIndex((l) => l.code === lang)));
  }, [open, lang]);

  const choose = (index: number) => {
    const item = SUPPORTED_LANGUAGES[index];
    if (!item) return;
    setLang(item.code);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % SUPPORTED_LANGUAGES.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + SUPPORTED_LANGUAGES.length) % SUPPORTED_LANGUAGES.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const renderOption = (index: number, mobile: boolean) => {
    const l = SUPPORTED_LANGUAGES[index];
    const selected = l.code === lang;
    const active = index === activeIndex;
    return (
      <button
        id={mobile ? undefined : `${listId}-${l.code}`}
        role="option"
        aria-selected={selected}
        type="button"
        onClick={() => choose(index)}
        onMouseEnter={() => setActiveIndex(index)}
        className={`flex w-full items-center gap-2 rounded-xl text-left transition-colors outline-none ${
          mobile ? 'min-h-[52px] px-3 py-2.5' : 'px-3 py-2'
        } ${
          active ? 'bg-surface-container-low' : ''
        }`}
      >
        <span
          className={`text-[13px] ${selected ? 'font-bold text-primary' : 'font-medium text-on-surface'}`}
        >
          {l.nativeName}
        </span>
        {l.code !== 'en' ? (
          <span className="truncate text-[11px] text-on-surface-variant">{l.englishName}</span>
        ) : null}
        {selected ? (
          <span
            className="ml-auto material-symbols-outlined text-[16px] text-primary"
            aria-hidden="true"
          >
            check
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onButtonKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${t('common.language')}: ${current.nativeName}`}
          title={t('common.language')}
          className="inline-flex h-11 min-w-0 max-w-[2.75rem] items-center justify-center gap-1 rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-2 text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:max-w-[9.5rem] sm:justify-start sm:px-2.5"
        >
          <span
            className="material-symbols-outlined shrink-0 text-[18px] text-on-surface-variant"
            aria-hidden="true"
          >
            translate
          </span>
          {!compact ? (
            <span className="hidden truncate text-xs font-semibold sm:inline" aria-hidden="true">
              {current.nativeName}
            </span>
          ) : null}
          <span
            className={`material-symbols-outlined shrink-0 text-[16px] text-on-surface-variant transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>

        {/* Desktop popover */}
        <AnimatePresence>
          {open && !isPhone ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-[calc(100%+0.5rem)] z-[110] hidden max-h-72 w-[min(17rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-outline-variant/40 bg-surface-container-lowest py-1.5 shadow-xl sm:block"
            >
              <p className="border-b border-outline-variant/20 px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t('common.language')}
              </p>
              <ul
                id={listId}
                role="listbox"
                aria-label={t('common.language')}
                aria-activedescendant={`${listId}-${SUPPORTED_LANGUAGES[activeIndex]?.code}`}
                tabIndex={-1}
                onKeyDown={onListKeyDown}
                className="py-1 outline-none"
              >
                {SUPPORTED_LANGUAGES.map((_, i) => (
                  <li key={SUPPORTED_LANGUAGES[i].code} role="presentation">
                    {renderOption(i, false)}
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Mobile sheet */}
      {isPhone ? (
        <Sheet
          open={open}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
          title={t('common.language')}
          size="sm"
        >
          <ul role="listbox" aria-label={t('common.language')} className="flex flex-col gap-1">
            {SUPPORTED_LANGUAGES.map((_, i) => (
              <li key={SUPPORTED_LANGUAGES[i].code} role="presentation">
                {renderOption(i, true)}
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}
    </>
  );
};
