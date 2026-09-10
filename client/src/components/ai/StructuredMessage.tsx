import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getStrings } from './assistantI18n';

export interface StructuredSection {
  key: string;
  title: string;
  level: 'info' | 'warning' | 'critical';
  body?: string;
  items?: string[];
  contacts?: Array<{ service: string; number: string }>;
  facilities?: Array<{ name: string; detail: string; phone?: string; distanceKm?: number }>;
}

export interface StructuredAction {
  kind: 'navigate' | 'tel' | 'suggest';
  label: string;
  to?: string;
  number?: string;
  query?: string;
}

/** Tiny safe renderer: paragraphs, **bold**, numbered/bullet lists. No HTML injection. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((l) => /^(\d+[.)]|[-•*])\s+/.test(l));
        if (isList) {
          const ordered = /^\d+[.)]\s+/.test(lines[0]);
          const items = lines.map((l) => l.replace(/^(\d+[.)]|[-•*])\s+/, ''));
          const List = ordered ? 'ol' : 'ul';
          return (
            <List key={bi} className={ordered ? 'list-decimal ml-5 flex flex-col gap-1' : 'list-disc ml-5 flex flex-col gap-1'}>
              {items.map((it, ii) => (
                <li key={ii}><Inline text={it} /></li>
              ))}
            </List>
          );
        }
        return (
          <p key={bi}>
            <Inline text={block} />
          </p>
        );
      })}
    </>
  );
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-bold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        )
      )}
    </>
  );
}

const levelStyles: Record<string, { wrap: string; head: string; icon: string }> = {
  info: {
    wrap: 'bg-surface-container-low border-outline-variant/30',
    head: 'text-on-surface',
    icon: 'info',
  },
  warning: {
    wrap: 'bg-[#fef3c7]/60 border-[#f59e0b]/50',
    head: 'text-[#92400e]',
    icon: 'warning',
  },
  critical: {
    wrap: 'bg-error-container/40 border-error/50',
    head: 'text-on-error-container',
    icon: 'emergency_home',
  },
};

interface Props {
  lang: string;
  headline: string;
  sections: StructuredSection[];
  actions: StructuredAction[];
  sources: Array<{ label: string; kind: 'live' | 'official' | 'model' | 'guidance' }>;
  timestamp: string;
  providerLabel: string;
  languageFallback: boolean;
  listening: boolean;
  reading: boolean;
  paused: boolean;
  ttsSupported: boolean;
  onListen: () => void;
  onStopListen: () => void;
  onPauseListen: () => void;
  onResumeListen: () => void;
  onSuggest: (query: string) => void;
}

export const StructuredMessage: React.FC<Props> = ({
  lang,
  headline,
  sections,
  actions,
  sources,
  timestamp,
  providerLabel,
  languageFallback,
  listening,
  reading,
  paused,
  ttsSupported,
  onListen,
  onStopListen,
  onPauseListen,
  onResumeListen,
  onSuggest,
}) => {
  const t = getStrings(lang);
  const navigate = useNavigate();

  const runAction = (a: StructuredAction) => {
    if (a.kind === 'navigate' && a.to) navigate(a.to);
    else if (a.kind === 'suggest' && a.query) onSuggest(a.query);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p className="font-headline-sm text-[15px] font-bold text-on-surface leading-snug">{headline}</p>

      {sections.map((s) => {
        const st = levelStyles[s.level] || levelStyles.info;
        const title = t.sectionTitles[s.key] && s.key !== 'answer' ? t.sectionTitles[s.key] : s.title;
        return (
          <div key={s.key} className={`rounded-lg border px-3 py-2.5 ${st.wrap}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1 ${st.head}`}>
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                {s.key === 'emergency' ? 'e911_emergency' : s.key === 'contacts' ? 'call' : s.key === 'help' ? 'night_shelter' : st.icon}
              </span>
              {title}
            </p>
            {s.body && (
              <div className="text-[13px] leading-relaxed text-on-surface flex flex-col gap-1.5">
                <RichText text={s.body} />
              </div>
            )}
            {s.items && (
              <ol className="text-[13px] leading-relaxed text-on-surface list-decimal ml-5 flex flex-col gap-1 mt-1">
                {s.items.map((it, i) => (
                  <li key={i}>
                    <Inline text={it} />
                  </li>
                ))}
              </ol>
            )}
            {s.contacts && (
              <div className="flex flex-col gap-1 mt-1.5">
                {s.contacts.map((c) => (
                  <a
                    key={c.number + c.service}
                    href={`tel:${c.number}`}
                    className="flex items-center justify-between gap-2 rounded-md bg-surface-container-lowest border border-outline-variant/20 px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-semibold text-on-surface">{c.service}</span>
                    <span className="font-code-num font-bold text-primary">{c.number}</span>
                  </a>
                ))}
              </div>
            )}
            {s.facilities && (
              <div className="flex flex-col gap-1 mt-1.5">
                {s.facilities.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between gap-2 rounded-md bg-surface-container-lowest border border-outline-variant/20 px-2.5 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-on-surface block truncate">{f.name}</span>
                      <span className="text-on-surface-variant block truncate">{f.detail}</span>
                    </div>
                    {f.phone && (
                      <a
                        href={`tel:${f.phone.replace(/[^+\d]/g, '')}`}
                        className="px-2.5 py-1 rounded-md bg-primary text-on-primary font-bold shrink-0"
                      >
                        Call
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <span key={a.label}>
              {a.kind === 'tel' ? (
                <a
                  href={`tel:${a.number}`}
                  className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-error-container text-on-error-container text-xs font-bold border border-error/30"
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">call</span>
                  {a.label}
                </a>
              ) : (
                <button
                  onClick={() => runAction(a)}
                  className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-surface-container-high text-primary text-xs font-bold hover:bg-surface-container-highest transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    {a.kind === 'navigate' ? 'arrow_forward' : 'chat'}
                  </span>
                  {a.label}
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-on-surface-variant">
        <span>{timestamp}</span>
        <span aria-hidden="true">·</span>
        <span>{providerLabel}</span>
        {sources.slice(0, 3).map((s) => (
          <span
            key={s.label}
            title={s.label}
            className={`px-1.5 py-px rounded-full font-bold uppercase tracking-wide ${
              s.kind === 'official'
                ? 'bg-secondary-container text-on-secondary-container'
                : s.kind === 'live'
                  ? 'bg-surface-container-high text-primary'
                  : 'bg-surface-container-low text-on-surface-variant'
            }`}
          >
            {t.sourceKinds[s.kind] || s.kind}
          </span>
        ))}
        {languageFallback && <span className="italic">{t.langFallbackNote}</span>}
        {ttsSupported && (
          <span className="ml-auto inline-flex items-center gap-1">
            {reading ? (
              <>
                <button
                  onClick={() => (paused ? onResumeListen() : onPauseListen())}
                  aria-label={paused ? 'Resume reading' : 'Pause reading'}
                  className="inline-flex items-center gap-1 font-bold text-secondary hover:text-on-secondary-container min-h-[28px]"
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                    {paused ? 'play_arrow' : 'pause'}
                  </span>
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={onStopListen}
                  aria-label={t.stop}
                  className="inline-flex items-center gap-1 font-bold text-secondary hover:text-on-secondary-container min-h-[28px]"
                >
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">stop_circle</span>
                  {t.stop}
                </button>
                <span className="font-bold text-secondary">{t.reading}</span>
              </>
            ) : (
              <button
                onClick={onListen}
                aria-label={t.listen}
                className="inline-flex items-center gap-1 font-bold text-secondary hover:text-on-secondary-container min-h-[28px]"
              >
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                  {listening ? 'graphic_eq' : 'volume_up'}
                </span>
                {t.listen}
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
};
