import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { getStrings, type AssistantLang } from '../components/ai/assistantI18n';
import { useLanguage } from '../i18n/LanguageContext';
import { ContextBar } from '../components/ai/ContextBar';
import { LanguageSelector } from '../components/ai/LanguageSelector';
import { ToolActivity, type ToolStepView } from '../components/ai/ToolActivity';
import { EmergencyPanel } from '../components/ai/EmergencyPanel';
import {
  StructuredMessage,
  type StructuredAction,
  type StructuredSection,
} from '../components/ai/StructuredMessage';
import { useSpeechRecognition } from '../components/ai/useSpeechRecognition';
import { useSpeechSynthesis, cleanForSpeech } from '../components/ai/useSpeechSynthesis';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  headline?: string;
  sections?: StructuredSection[];
  actions?: StructuredAction[];
  sources?: Array<{ label: string; kind: 'live' | 'official' | 'model' | 'guidance' }>;
  toolActivity?: ToolStepView[];
  emergency?: boolean;
  emergencyReason?: string;
  hospitals?: Array<{ name: string; detail: string; phone?: string }>;
  providerLabel?: string;
  languageFallback?: boolean;
  error?: boolean;
}

interface Area {
  city: string;
  district: string;
  state: string;
  label: string;
}

type ConnState = 'connecting' | 'online' | 'degraded' | 'offline';

const EMERGENCY_SCAN =
  /\b(trapped|stuck|cannot get out|can'?t breathe|breathing|chest pain|flooding (my|our|the)? ?(house|home)|water (rising|inside)|fire|burning|gas leak|smell gas|injur|bleeding|ambulance|unconscious|collapse|drown|swept away|fas[ae]? gaya|phas gaya|bachao|madad)\b/i;

const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const AssistantPage: React.FC<{ onOpenEmergencyModal: () => void }> = ({ onOpenEmergencyModal }) => {
  const navigate = useNavigate();
  // Global language (header selector) drives the assistant — single selection,
  // whole-app adaptation (spec §2). Assistant chrome dictionaries reuse the
  // same 5 codes, so this cast is always valid.
  const { lang: appLang, setLang: setAppLang } = useLanguage();
  const lang = appLang as AssistantLang;
  const setLang = (l: AssistantLang) => setAppLang(l);
  const t = getStrings(lang);

  const [conn, setConn] = useState<ConnState>('connecting');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);

  const [area, setArea] = useState<Area | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [riskLevel, setRiskLevel] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskUpdated, setRiskUpdated] = useState<string | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const [helplines, setHelplines] = useState<Array<{ service: string; code: string }>>([]);
  const [emergencyCtx, setEmergencyCtx] = useState<{ reason: string; hospitals: ChatMsg['hospitals'] } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { supported: ttsSupported, speakingId, paused, speak, stop: stopSpeech, pause, resume } = useSpeechSynthesis();

  const voice = useSpeechRecognition({
    lang: { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', as: 'as-IN' }[lang],
    onTranscript: (text) => setInput(text),
  });

  // -- backend status (honest, polled on mount) --------------------------------
  const checkStatus = useCallback(async () => {
    try {
      const s: any = await apiFetch('/ai/status');
      setConn(s.degraded ? 'degraded' : 'online');
    } catch {
      setConn('offline');
    }
  }, []);
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // -- context: risk + helplines -------------------------------------------------
  useEffect(() => {
    apiFetch('/resources/helplines')
      .then((r: any) => setHelplines((r.helplines || []).slice(0, 6)))
      .catch(() => setHelplines([]));
  }, []);

  const refreshRisk = useCallback(async (label: string) => {
    setRiskLoading(true);
    try {
      const r: any = await apiFetch(`/risk/${encodeURIComponent(label)}`);
      setRiskLevel(r.analysis.overallRiskLevel);
      setRiskScore(r.analysis.riskScore);
      setRiskUpdated(now());
    } catch {
      setRiskLevel(null);
      setRiskScore(null);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  useEffect(() => {
    if (area) refreshRisk(area.label);
  }, [area, refreshRisk]);

  const applyArea = useCallback(
    (city: string, district: string, state: string, c: { lat: number; lng: number } | null) => {
      const label = `${city}, ${state}`;
      setArea({ city, district, state, label });
      setCoords(c);
      setRiskLevel(null);
      setRiskScore(null);
    },
    []
  );

  const handleSetLocation = useCallback(
    async (text: string) => {
      try {
        const r: any = await apiFetch(`/geo/resolve?location=${encodeURIComponent(text)}`);
        applyArea(r.geo.city, r.geo.district, r.geo.state, null);
      } catch {
        applyArea(text, text, 'India', null);
      }
    },
    [applyArea]
  );

  const handleDeviceLocation = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r: any = await apiFetch(`/geo/nearest?lat=${latitude}&lng=${longitude}`);
          applyArea(r.geo.city, r.geo.district, r.geo.state, { lat: latitude, lng: longitude });
        } catch {
          applyArea('Current area', 'Current district', 'India', { lat: latitude, lng: longitude });
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  }, [applyArea]);

  // -- chat ----------------------------------------------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const sendQuery = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query || sending) return;
      if (query === '__action:report') {
        navigate('/report-emergency');
        return;
      }
      stopSpeech();
      const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', text: query, timestamp: now() };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput('');
      setSending(true);
      setFreshId(null);

      if (EMERGENCY_SCAN.test(query)) {
        setEmergencyCtx({ reason: 'Possible emergency detected in your message', hospitals: [] });
      }

      try {
        const payload: any = {
          messages: history.map((m) => ({ role: m.role, content: m.text })),
          language: lang,
        };
        if (area) payload.location = area.label;
        if (coords) payload.coords = coords;
        const res: any = await apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify(payload) });
        setConn('online');
        const msgId = `a-${Date.now()}`;
        const assistant: ChatMsg = {
          id: msgId,
          role: 'assistant',
          text: res.response || '',
          timestamp: now(),
          headline: res.headline || 'Safety guidance',
          sections: res.sections || [],
          actions: (res.actions || []).map((a: any) =>
            a.kind === 'suggest' ? { ...a, kind: 'suggest' as const } : a
          ),
          sources: res.sources || [],
          toolActivity: res.toolActivity || [],
          emergency: Boolean(res.emergency),
          providerLabel: res.provider === 'local' ? 'JeevanGrid safety engine' : `${res.provider} · JeevanGrid validation`,
          languageFallback: Boolean(res.languageFallback),
        };
        if (res.emergency) {
          const help = (res.sections || []).find((s: any) => s.key === 'help');
          setEmergencyCtx({
            reason: res.headline,
            hospitals: (help?.facilities || []).map((f: any) => ({ name: f.name, detail: f.detail, phone: f.phone })),
          });
        }
        setMessages((prev) => [...prev, assistant]);
        setFreshId(msgId);
        window.setTimeout(() => {
          setFreshId((cur) => (cur === msgId ? null : cur));
        }, 4000);
      } catch (err) {
        console.error('AI assistant error:', err);
        setConn((c) => (c === 'online' ? c : 'offline'));
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text: 'The safety service is unreachable right now. If you are in danger, call 112 immediately. Otherwise, check your local risk map or try again shortly.',
            timestamp: now(),
            error: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [sending, messages, lang, area, coords, navigate, stopSpeech]
  );

  const suggestions =
    riskLevel === 'HIGH' || riskLevel === 'SEVERE'
      ? t.suggestHigh
      : messages.some((m) => /earthquake|tremor/i.test(m.text))
        ? t.suggestQuake
        : t.suggestCalm;

  const connMeta =
    conn === 'online'
      ? { label: t.statusOnline, dot: 'bg-surface-tint', text: 'text-primary' }
      : conn === 'degraded'
        ? { label: t.statusDegraded, dot: 'bg-[#d97706]', text: 'text-[#92400e]' }
        : conn === 'offline'
          ? { label: t.statusOffline, dot: 'bg-error', text: 'text-error' }
          : { label: t.statusConnecting, dot: 'bg-outline animate-pulse', text: 'text-on-surface-variant' };

  return (
    <main className="w-full pt-20 pb-space-2xl min-h-screen bg-surface flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-margin-mobile lg:px-margin-desktop py-space-lg flex-1 flex flex-col gap-space-md">
        {/* Breadcrumb + status + language */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs text-on-surface-variant hover:text-on-surface">
              Home
            </Link>
            <span className="text-xs text-on-surface-variant">/</span>
            <span className="text-xs text-primary font-bold">AI Safety Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              role="status"
              aria-label={connMeta.label}
              className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-surface-container-lowest border border-outline-variant/30 text-[11px] font-bold ${connMeta.text}`}
            >
              <span className={`w-2 h-2 rounded-full ${connMeta.dot}`} aria-hidden="true" />
              {connMeta.label}
            </span>
            <LanguageSelector value={lang} onChange={setLang} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md items-start">
          {/* Conversation column */}
          <div className="lg:col-span-2 flex flex-col gap-space-md min-w-0">
            <ContextBar
              lang={lang}
              area={area}
              riskLevel={riskLevel}
              riskScore={riskScore}
              updatedAt={riskUpdated}
              loading={riskLoading}
              onSetLocation={handleSetLocation}
              onUseDeviceLocation={handleDeviceLocation}
              locating={locating}
            />

            {emergencyCtx && (
              <EmergencyPanel
                lang={lang}
                reason={emergencyCtx.reason}
                hospitals={emergencyCtx.hospitals || []}
                locationLabel={area?.label || 'your area'}
              />
            )}

            {/* Welcome action cards */}
            {messages.length === 0 && (
              <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-outline-variant/30">
                <h1 className="font-headline-xl text-2xl font-bold text-on-surface">{t.introTitle}</h1>
                <p className="text-xs text-on-surface-variant mt-1 max-w-xl">{t.introSub}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {t.actions.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => sendQuery(a.query)}
                      disabled={sending}
                      className="text-left p-3 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 transition-colors disabled:opacity-50 min-h-[56px]"
                    >
                      <span className="block text-[13px] font-bold text-on-surface">{a.label}</span>
                      <span className="block text-[11px] text-on-surface-variant">{a.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex flex-col gap-space-md" aria-live="polite" aria-label="Conversation">
              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-primary-container text-on-primary px-4 py-2.5">
                      <p className="text-[13px] leading-relaxed whitespace-pre-line">{m.text}</p>
                      <p className="text-[10px] opacity-70 text-right mt-1">{m.timestamp}</p>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <div
                      className={`max-w-full sm:max-w-[92%] w-full rounded-2xl rounded-tl-md px-4 py-3 border ${
                        m.error
                          ? 'bg-error-container/30 border-error/40'
                          : 'bg-surface-container-lowest border-outline-variant/30 shadow-sm'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-on-surface-variant mb-1.5 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-md bg-primary text-on-primary flex items-center justify-center" aria-hidden="true">
                          <span className="material-symbols-outlined text-[13px]">shield</span>
                        </span>
                        JeevanGrid AI
                        <span className="font-normal">{m.timestamp}</span>
                      </p>
                      {m.sections && m.sections.length > 0 ? (
                        <StructuredMessage
                          lang={lang}
                          headline={m.headline || ''}
                          sections={m.sections}
                          actions={m.actions || []}
                          sources={m.sources || []}
                          timestamp=""
                          providerLabel={m.providerLabel || ''}
                          languageFallback={Boolean(m.languageFallback)}
                          listening={false}
                          reading={speakingId === m.id}
                          paused={paused}
                          ttsSupported={ttsSupported}
                          onListen={() => {
                            const text = `${m.headline || ''}. ${cleanForSpeech(m.sections || [])}`;
                            speak(m.id, text, { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', as: 'as-IN' }[lang]);
                          }}
                          onStopListen={stopSpeech}
                          onPauseListen={pause}
                          onResumeListen={resume}
                          onSuggest={(q) => sendQuery(q)}
                        />
                      ) : (
                        <p className="text-[13px] leading-relaxed text-on-surface whitespace-pre-line">{m.text}</p>
                      )}
                      {m.toolActivity && m.toolActivity.length > 0 && (
                        <div className="mt-2">
                          <ToolActivity steps={m.toolActivity} lang={lang} live={freshId === m.id} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-md bg-surface-container-lowest border border-outline-variant/30 shadow-sm px-4 py-3 flex items-center gap-2 text-xs text-on-surface-variant">
                    <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    {t.toolWorking}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            <div>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                {t.suggestionsTitle}
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendQuery(s)}
                    disabled={sending}
                    className="px-2.5 py-1.5 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface text-[11px] font-semibold whitespace-nowrap border border-outline-variant/30 transition-colors shrink-0 disabled:opacity-50 min-h-[36px]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice status */}
            {voice.state === 'recording' && (
              <div className="rounded-xl bg-error-container/30 border border-error/40 px-4 py-2.5 flex items-center gap-3" role="status">
                <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse shrink-0" aria-hidden="true" />
                <div className="flex items-end gap-[3px] h-6 shrink-0" aria-hidden="true">
                  {voice.levels.map((v, i) => (
                    <span key={i} className="w-[3px] rounded-full bg-error/70" style={{ height: `${Math.round(v * 24)}px` }} />
                  ))}
                </div>
                <span className="text-xs font-bold text-on-error-container">{t.voiceRecording}</span>
                <button
                  onClick={voice.stop}
                  className="ml-auto px-3 h-9 rounded-lg bg-error text-on-error text-xs font-bold"
                >
                  {t.stop}
                </button>
              </div>
            )}
            {voice.state === 'denied' && (
              <p className="text-xs text-error font-semibold" role="alert">{t.micDenied}</p>
            )}
            {voice.state === 'error' && (
              <p className="text-xs text-error font-semibold" role="alert">{t.voiceError}</p>
            )}
            {voice.state === 'unsupported' && (
              <p className="text-xs text-on-surface-variant font-semibold" role="status">{t.voiceUnsupported}</p>
            )}

            {/* Composer (sticky, one-hand friendly) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendQuery(input);
              }}
              className="sticky bottom-0 bg-surface pt-1 pb-1 flex gap-2 items-center"
            >
              <button
                type="button"
                onClick={() => (voice.state === 'recording' ? voice.stop() : voice.start())}
                aria-label={t.voiceReady}
                title={t.voiceReady}
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors border ${
                  voice.state === 'recording'
                    ? 'bg-error text-on-error border-transparent'
                    : 'bg-surface-container-lowest text-primary border-outline-variant/40 hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">mic</span>
              </button>
              <label className="sr-only" htmlFor="ai-composer">Message</label>
              <input
                id="ai-composer"
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.composerPlaceholder}
                autoComplete="off"
                className="flex-1 h-12 px-4 rounded-xl bg-surface-container-lowest text-on-surface text-[13px] border border-outline-variant/40 outline-none focus:border-primary shadow-sm min-w-0"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label={t.send}
                className="h-12 px-4 sm:px-5 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-60 shrink-0"
              >
                <span className="hidden sm:inline">{t.send}</span>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
              </button>
            </form>
            {input && voice.state === 'ready' && (
              <p className="text-[10px] text-on-surface-variant -mt-2">{t.editBeforeSend}</p>
            )}
          </div>

          {/* Context sidebar (desktop) */}
          <aside className="hidden lg:flex flex-col gap-space-md sticky top-24">
            <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30">
              <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                {t.contextTitle}
              </h2>
              {area ? (
                <div className="flex flex-col gap-1 text-xs">
                  <p className="font-bold text-on-surface text-sm">{area.district}</p>
                  <p className="text-on-surface-variant">{area.city} · {area.state}</p>
                  <p className="text-on-surface-variant">
                    {t.riskLabel}: <strong className="text-on-surface">{riskLoading ? '…' : riskLevel || '—'}</strong>
                    {riskScore !== null && ` · ${riskScore}/100`}
                  </p>
                  <p className="text-on-surface-variant">{t.dataUpdated}: {riskUpdated || '—'}</p>
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant">{t.setLocationPrompt}</p>
              )}
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30">
              <button
                onClick={onOpenEmergencyModal}
                className="w-full py-2.5 rounded-xl bg-error-container hover:bg-error/20 text-on-error-container text-xs font-bold flex items-center justify-center gap-1.5 border border-error/30 min-h-[44px]"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">call</span>
                {t.needRescue}
              </button>
              <div className="mt-2 flex flex-col">
                {helplines.map((h) => (
                  <a
                    key={h.code}
                    href={`tel:${h.code}`}
                    className="flex items-center justify-between py-1.5 border-b border-outline-variant/20 last:border-0 text-xs"
                  >
                    <span className="text-on-surface-variant">{h.service}</span>
                    <span className="font-code-num font-bold text-primary">{h.code}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30">
              <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
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
                    className="text-secondary font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    {label}
                    <span className="material-symbols-outlined text-[13px]" aria-hidden="true">open_in_new</span>
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile emergency shortcut */}
        <div className="lg:hidden sticky bottom-[72px] flex justify-end pointer-events-none">
          <button
            onClick={onOpenEmergencyModal}
            aria-label={t.needRescue}
            className="pointer-events-auto w-12 h-12 rounded-full bg-error text-on-error shadow-lg flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">call</span>
          </button>
        </div>
      </div>
    </main>
  );
};
