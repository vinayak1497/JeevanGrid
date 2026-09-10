import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceState = 'ready' | 'recording' | 'processing' | 'error' | 'unsupported' | 'denied';

interface UseSpeechRecognitionOptions {
  lang: string;
  onTranscript: (text: string) => void;
  onStateChange?: (s: VoiceState) => void;
}

/**
 * On-device speech recognition (Web Speech API) with a subtle level meter.
 * Transcript is always returned for user review — never auto-sent.
 */
export function useSpeechRecognition({ lang, onTranscript, onStateChange }: UseSpeechRecognitionOptions) {
  const [state, setState] = useState<VoiceState>('ready');
  const [levels, setLevels] = useState<number[]>(new Array(12).fill(0));
  const recogRef = useRef<any>(null);
  const audioRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; stream: MediaStream; raf: number } | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const supported =
    typeof window !== 'undefined' &&
    (Boolean((window as any).SpeechRecognition) || Boolean((window as any).webkitSpeechRecognition));

  const setBoth = useCallback(
    (s: VoiceState) => {
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange]
  );

  const stopMeter = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      cancelAnimationFrame(a.raf);
      a.stream.getTracks().forEach((t) => t.stop());
      a.ctx.close().catch(() => undefined);
      audioRef.current = null;
    }
    setLevels(new Array(12).fill(0));
  }, []);

  const stop = useCallback(() => {
    try {
      recogRef.current?.stop();
    } catch {
      // ignore
    }
    stopMeter();
    setBoth('processing');
  }, [stopMeter, setBoth]);

  const start = useCallback(async () => {
    if (!supported) {
      setBoth('unsupported');
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // Level meter (mic permission doubles as the permission gate)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars: number[] = [];
        for (let i = 0; i < 12; i++) {
          const v = data[Math.floor((i * data.length) / 12)] / 255;
          bars.push(Math.max(0.06, Math.min(1, v)));
        }
        setLevels(bars);
        const cur = audioRef.current;
        if (cur) cur.raf = requestAnimationFrame(tick);
      };
      audioRef.current = { ctx, analyser, stream, raf: requestAnimationFrame(tick) };
    } catch {
      stopMeter();
      setBoth('denied');
      return;
    }

    const recog = new SR();
    recog.lang = lang;
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.continuous = false;
    let finalText = '';

    recog.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0]?.transcript || '';
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      const combined = (finalText + ' ' + interim).trim();
      if (combined) onTranscriptRef.current(combined);
    };
    recog.onerror = (e: any) => {
      stopMeter();
      const err = String(e?.error || '');
      if (err === 'not-allowed' || err === 'service-not-allowed') setBoth('denied');
      else if (err === 'aborted') setBoth('ready');
      else setBoth('error');
    };
    recog.onend = () => {
      stopMeter();
      setState((prev) => (prev === 'recording' ? 'ready' : prev));
    };
    recogRef.current = recog;
    try {
      recog.start();
      setBoth('recording');
    } catch {
      stopMeter();
      setBoth('error');
    }
  }, [supported, lang, stopMeter, setBoth]);

  useEffect(
    () => () => {
      try {
        recogRef.current?.abort();
      } catch {
        // ignore
      }
      stopMeter();
    },
    [stopMeter]
  );

  return { state, levels, supported, start, stop, reset: () => setBoth('ready') };
}
