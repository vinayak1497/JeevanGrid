/**
 * The JeevanGrid AI conversation surface.
 *
 * Rendered by the full /assistant page and by the floating panel. Both read
 * and write the same AssistantContext, so messages, draft input, location and
 * emergency state survive switching between the two modes.
 */
import React, { useCallback, useEffect, useId, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useAssistant } from '../../context/AssistantContext';
import { getStrings } from './assistantI18n';
import { ContextBar } from './ContextBar';
import { EmergencyPanel } from './EmergencyPanel';
import { StructuredMessage } from './StructuredMessage';
import { ToolActivity } from './ToolActivity';
import { EmergencyReportFlow } from '../report/EmergencyReportFlow';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useSpeechSynthesis, cleanForSpeech } from './useSpeechSynthesis';

const SPEECH_LANGS = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', as: 'as-IN' } as const;

export interface AssistantConversationProps {
  variant?: 'page' | 'panel';
  /** Focus the composer when the floating panel opens on desktop. */
  autoFocusComposer?: boolean;
}

export const AssistantConversation: React.FC<AssistantConversationProps> = ({
  variant = 'page',
  autoFocusComposer = false,
}) => {
  const {
    lang,
    messages,
    input,
    setInput,
    sending,
    freshId,
    area,
    riskLevel,
    riskScore,
    riskUpdated,
    riskLoading,
    locating,
    emergencyCtx,
    reportFlow,
    closeReportFlow,
    sendQuery,
    handleSetLocation,
    handleDeviceLocation,
  } = useAssistant();
  const t = getStrings(lang);
  const isPanel = variant === 'panel';
  const reduceMotion = useReducedMotion();
  const composerId = useId();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { supported: ttsSupported, speakingId, paused, speak, stop: stopSpeech, pause, resume } =
    useSpeechSynthesis();

  const voice = useSpeechRecognition({
    lang: SPEECH_LANGS[lang],
    onTranscript: (text) => setInput(text),
  });

  useEffect(() => {
    if (!autoFocusComposer) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => window.clearTimeout(timer);
  }, [autoFocusComposer]);

  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages, sending, reduceMotion]);

  const handleSend = useCallback(
    (raw: string) => {
      stopSpeech();
      void sendQuery(raw);
    },
    [sendQuery, stopSpeech]
  );

  const suggestions =
    riskLevel === 'HIGH' || riskLevel === 'SEVERE'
      ? t.suggestHigh
      : messages.some((m) => /earthquake|tremor/i.test(m.text))
        ? t.suggestQuake
        : t.suggestCalm;
  const WelcomeHeading = isPanel ? 'h2' : 'h1';

  const voiceStatus =
    voice.state === 'recording' ||
    voice.state === 'denied' ||
    voice.state === 'error' ||
    voice.state === 'unsupported';

  return (
    <div
      className={
        isPanel
          ? 'flex min-h-0 flex-1 flex-col bg-surface-container-lowest'
          : 'flex min-w-0 flex-col gap-space-md'
      }
    >
      {!isPanel && (
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
      )}

      {isPanel && (
        <div className="shrink-0 border-b border-outline-variant/20 px-3 py-2">
          <ContextBar
            compact
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
        </div>
      )}

      {!isPanel && emergencyCtx && (
        <EmergencyPanel
          lang={lang}
          reason={emergencyCtx.reason}
          hospitals={emergencyCtx.hospitals || []}
          locationLabel={area?.label || 'your area'}
        />
      )}

      <div
        className={
          isPanel
            ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-3'
            : 'flex flex-col gap-space-md'
        }
      >
        {isPanel && emergencyCtx && (
          <EmergencyPanel
            lang={lang}
            reason={emergencyCtx.reason}
            hospitals={emergencyCtx.hospitals || []}
            locationLabel={area?.label || 'your area'}
          />
        )}

        {messages.length === 0 && (
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-outline-variant/30">
            <WelcomeHeading
              className={
                isPanel
                  ? 'text-lg font-bold text-on-surface leading-tight'
                  : 'font-headline-xl text-2xl font-bold text-on-surface'
              }
            >
              {t.introTitle}
            </WelcomeHeading>
            <p className="text-xs text-on-surface-variant mt-1 max-w-xl">{t.introSub}</p>
            <div className={`grid gap-2 mt-4 ${isPanel ? 'grid-cols-1 xs:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {t.actions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => handleSend(a.query)}
                  disabled={sending}
                  className={`text-left rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 transition-colors disabled:opacity-50 ${
                    isPanel ? 'p-2.5 min-h-[52px]' : 'p-3 min-h-[56px]'
                  }`}
                >
                  <span className="block text-[13px] font-bold text-on-surface">{a.label}</span>
                  <span className="block text-[11px] text-on-surface-variant">{a.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
                    <span
                      className="w-5 h-5 rounded-md bg-primary text-on-primary flex items-center justify-center"
                      aria-hidden="true"
                    >
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
                        speak(m.id, text, SPEECH_LANGS[lang]);
                      }}
                      onStopListen={stopSpeech}
                      onPauseListen={pause}
                      onResumeListen={resume}
                      onSuggest={(q) => handleSend(q)}
                    />
                  ) : (
                    <p className="text-[13px] leading-relaxed text-on-surface whitespace-pre-line">
                      {m.text}
                    </p>
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
                <span
                  className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                {t.toolWorking}
              </div>
            </div>
          )}
          {reportFlow?.active && (
            <EmergencyReportFlow initialText={reportFlow.initialText} onClose={() => closeReportFlow()} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {(!isPanel || messages.length > 0) && (
        <div className={isPanel ? 'shrink-0 px-4 pt-2' : ''}>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
            {t.suggestionsTitle}
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                disabled={sending}
                className="min-h-[44px] shrink-0 px-3 py-2 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold whitespace-nowrap border border-outline-variant/30 transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {voiceStatus && (
        <div className={isPanel ? 'mt-2 flex shrink-0 flex-col gap-2 px-4' : 'flex flex-col gap-2'}>
          {voice.state === 'recording' && (
            <div
              className="rounded-xl bg-error-container/30 border border-error/40 px-4 py-2.5 flex items-center gap-3"
              role="status"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse shrink-0" aria-hidden="true" />
              <div className="flex items-end gap-[3px] h-6 shrink-0" aria-hidden="true">
                {voice.levels.map((v, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-error/70"
                    style={{ height: `${Math.round(v * 24)}px` }}
                  />
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
            <p className="text-xs text-error font-semibold" role="alert">
              {t.micDenied}
            </p>
          )}
          {voice.state === 'error' && (
            <p className="text-xs text-error font-semibold" role="alert">
              {t.voiceError}
            </p>
          )}
          {voice.state === 'unsupported' && (
            <p className="text-xs text-on-surface-variant font-semibold" role="status">
              {t.voiceUnsupported}
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className={
          isPanel
            ? 'mt-2 flex shrink-0 items-center gap-2 border-t border-outline-variant/30 bg-surface-container-lowest px-4 py-3'
            : 'sticky bottom-0 z-10 flex items-center gap-2 border-t border-outline-variant/30 bg-surface/95 px-1 py-2 backdrop-blur-md'
        }
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
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
            mic
          </span>
        </button>
        <label className="sr-only" htmlFor={composerId}>
          Message
        </label>
        <input
          id={composerId}
          ref={inputRef}
          data-assistant-composer
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => inputRef.current?.scrollIntoView({ block: 'nearest' })}
          placeholder={t.composerPlaceholder}
          autoComplete="off"
          className="min-w-0 flex-1 h-12 px-4 rounded-xl bg-surface-container-lowest text-on-surface text-sm border border-outline-variant/40 outline-none focus:border-primary shadow-sm"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label={t.send}
          className="h-12 px-4 sm:px-5 rounded-xl bg-primary-container hover:bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-60 shrink-0"
        >
          <span className="hidden sm:inline">{t.send}</span>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            send
          </span>
        </button>
      </form>
      {input && voice.state === 'ready' && (
        <p className={`text-[10px] text-on-surface-variant ${isPanel ? 'px-4 pb-2' : '-mt-2'}`}>
          {t.editBeforeSend}
        </p>
      )}
    </div>
  );
};
