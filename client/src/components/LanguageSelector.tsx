/**
 * Premium global language selector (spec §5).
 *
 * - Native script names, no flags, no emojis
 * - Keyboard navigation (ArrowUp/Down, Enter, Escape, Tab)
 * - Focus-visible states, aria-expanded/activedescendant, listbox semantics
 * - Closes on outside click / Escape
 * - Persists via LanguageProvider, updates UI without reload
 * - Flexible width — Indic labels are longer than English (spec §21)
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { SUPPORTED_LANGUAGES } from '../i18n/languages';
import { useLanguage } from '../i18n/LanguageContext';

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { lang, setLang, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, SUPPORTED_LANGUAGES.findIndex((l) => l.code === lang))
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === lang) ?? SUPPORTED_LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open ]);

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

  return (
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
        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-w-0 max-w-[11rem]"
      >
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0" aria-hidden="true">
          translate
        </span>
        {!compact && (
          <span className="text-xs font-semibold truncate" aria-hidden="true">
            {current.nativeName}
          </span>
        )}
        <span
          className={`material-symbols-outlined text-[16px] text-on-surface-variant shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 min-w-[12rem] max-w-[16rem] bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/40 py-1.5 z-[60]">
          <p className="px-3 pb-1.5 pt-1 text-[10px] uppercase font-bold tracking-wider text-on-surface-variant border-b border-outline-variant/20">
            {t('common.language')}
          </p>
          <ul
            id={listId}
            role="listbox"
            aria-label={t('common.language')}
            aria-activedescendant={`${listId}-${SUPPORTED_LANGUAGES[activeIndex]?.code}`}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="py-1 outline-none max-h-72 overflow-y-auto"
          >
            {SUPPORTED_LANGUAGES.map((l, i) => {
              const selected = l.code === lang;
              const active = i === activeIndex;
              return (
                <li key={l.code} role="presentation">
                  <button
                    id={`${listId}-${l.code}`}
                    role="option"
                    aria-selected={selected}
                    type="button"
                    onClick={() => choose(i)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors outline-none focus-visible:bg-surface-container-low ${
                      active ? 'bg-surface-container-low' : ''
                    }`}
                  >
                    <span className={`text-[13px] ${selected ? 'font-bold text-primary' : 'font-medium text-on-surface'}`}>
                      {l.nativeName}
                    </span>
                    {l.code !== 'en' && (
                      <span className="text-[11px] text-on-surface-variant">{l.englishName}</span>
                    )}
                    {selected && (
                      <span className="ml-auto material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                        check
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
