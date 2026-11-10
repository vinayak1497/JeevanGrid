import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';

interface FooterGroup {
  heading: string;
  links?: Array<{ label: string; to: string }>;
  children?: React.ReactNode;
}

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const reduce = useReducedMotion();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const groups: FooterGroup[] = [
    {
      heading: t('footer.platform'),
      links: [
        { label: t('nav.home'), to: '/' },
        { label: t('nav.disasters'), to: '/alerts' },
        { label: t('nav.resources'), to: '/resources' },
        { label: t('nav.assistant'), to: '/assistant' },
      ],
    },
    {
      heading: t('footer.preparedness'),
      links: [
        { label: 'Safety Protocols', to: '/guides' },
        { label: 'Flood Evacuation Plans', to: '/guides/flood' },
        { label: 'Cyclone Readiness', to: '/guides/cyclone' },
        { label: 'Family Emergency Kits', to: '/guides/earthquake' },
      ],
    },
  ];

  const helplines = [
    { label: 'Disaster Helpline (NDRF)', number: '1078', critical: false },
    { label: 'Medical / Ambulance', number: '108', critical: false },
    { label: 'National Emergency (Police)', number: '112', critical: true },
    { label: 'Women Helpline', number: '1091', critical: false },
  ];

  const toggle = (heading: string) => setOpenGroup((current) => (current === heading ? null : heading));

  return (
    <footer className="mt-space-3xl w-full border-t border-outline-variant/30 bg-surface-container-low pb-[max(1.5rem,var(--jg-safe-bottom))] pt-space-xl">
      <div className="jg-container px-[max(1rem,var(--jg-safe-left))]">
        <div className="grid grid-cols-1 gap-space-xl md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-space-sm lg:col-span-2">
            <div className="flex items-center gap-space-xs">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
                <span
                  className="material-symbols-outlined text-[19px]"
                  aria-hidden="true"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
                >
                  shield
                </span>
              </span>
              <span className="font-headline-sm text-headline-sm font-bold text-primary">JeevanGrid</span>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-on-surface-variant">
              {t('footer.tagline')}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-highest px-2.5 py-1 text-[11px] font-semibold text-on-surface">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-live" aria-hidden="true">
                  <span className="absolute inset-0 animate-signal-pulse rounded-full bg-signal-live" />
                </span>
                Operational Grid 99.98%
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-highest px-2.5 py-1 text-[11px] font-semibold text-on-surface">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  accessibility_new
                </span>
                WCAG 2.1 AAA
              </span>
            </div>
          </div>

          {/* Link groups — stacked accordion on phones, columns on desktop */}
          {groups.map((group) => {
            const expanded = openGroup === group.heading;
            return (
              <div key={group.heading} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => toggle(group.heading)}
                  aria-expanded={expanded}
                  className="flex min-h-[44px] w-full items-center justify-between border-b border-outline-variant/25 text-left md:pointer-events-none md:border-none"
                >
                  <span className="text-sm font-bold text-on-surface">{group.heading}</span>
                  <span
                    className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200 md:hidden ${
                      expanded ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: reduce ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden md:!h-auto md:!opacity-100"
                    >
                      <div className="flex flex-col gap-0.5 pb-2 pt-1">
                        {group.links?.map((link) => (
                          <Link
                            key={link.to}
                            to={link.to}
                            className="flex min-h-[44px] items-center text-sm text-on-surface-variant transition-colors hover:text-on-surface"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                {/* Desktop always-visible copy */}
                <div className="hidden flex-col gap-0.5 md:flex">
                  {group.links?.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="flex min-h-[44px] items-center text-sm text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Emergency directory */}
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-on-surface">{t('footer.directory')}</h3>
            <div className="mt-2 flex flex-col">
              {helplines.map((line, index) => (
                <div
                  key={line.number}
                  className={`flex items-center justify-between gap-3 py-2.5 ${
                    index < helplines.length - 1 ? 'border-b border-outline-variant/25' : ''
                  }`}
                >
                  <span className="min-w-0 text-xs leading-snug text-on-surface-variant">
                    {line.label}
                  </span>
                  <a
                    href={`tel:${line.number}`}
                    className={`jg-code inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-3 py-2 text-sm hover:underline ${
                      line.critical ? 'text-error' : 'text-primary'
                    }`}
                  >
                    {line.number}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-space-xl flex flex-col gap-3 border-t border-outline-variant/30 pt-space-lg md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-2xl flex-col gap-1">
            <p className="text-[11px] leading-relaxed text-on-surface-variant">{t('footer.notice')}</p>
            <p className="text-[11px] leading-relaxed text-on-surface-variant">{t('footer.rights')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="font-medium text-secondary">Calm Authority</span>
            <span className="text-outline-variant" aria-hidden="true">
              ·
            </span>
            <span className="font-medium text-primary">Civic Solace</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
