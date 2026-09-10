import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Speech synthesis output (browser engine).
 * Only cleaned safety guidance is spoken — never metadata, buttons,
 * URLs, or tool internals. Structured so a server TTS provider can
 * replace the engine behind speak()/stop() later.
 */

/** Strip markdown, sources, URLs and UI artefacts down to speakable prose. */
export function cleanForSpeech(sections: Array<{ key: string; title: string; body?: string; items?: string[] }>): string {
  const skip = new Set(['note']);
  const parts: string[] = [];
  for (const s of sections) {
    if (skip.has(s.key)) continue;
    if (s.key === 'contacts' || s.key === 'help') continue;
    if (s.body) parts.push(stripMd(s.body));
    if (s.items) {
      for (const it of s.items.slice(0, 6)) parts.push(stripMd(it));
    }
  }
  return parts.join(' ').slice(0, 1200);
}

function stripMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[•\-*]\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function useSpeechSynthesis() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [supported] = useState(
    typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    utterRef.current = null;
    setSpeakingId(null);
    setPaused(false);
  }, [supported]);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    (id: string, text: string, lang: string) => {
      if (!supported || !text.trim()) return false;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const match =
        voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
      if (match) utter.voice = match;
      utter.onend = () => {
        setSpeakingId(null);
        setPaused(false);
        utterRef.current = null;
      };
      utter.onerror = () => {
        setSpeakingId(null);
        setPaused(false);
        utterRef.current = null;
      };
      utterRef.current = utter;
      setPaused(false);
      setSpeakingId(id);
      window.speechSynthesis.speak(utter);
      return true;
    },
    [supported]
  );

  const pause = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, [supported]);

  return { supported, speakingId, paused, speak, stop, pause, resume };
}
