/**
 * useTextToSpeech — question readback via the Web Speech API.
 *
 * Fallback strategy (per PRD §5.2 and TTS resilience requirements):
 *  1. Exact locale voice match (e.g. kn-IN) when the browser has one
 *  2. Language-family fallback (any kn / hi / en voice)
 *  3. Text-only mode: `available` is false and the UI shows a small
 *     non-blocking notice — the app NEVER becomes unusable.
 *
 * Duplicate-speech guard: `speak` is a no-op unless the text (or key) changes
 * or the caller explicitly requests a replay, so React re-renders and
 * StrictMode double-mounts cannot re-trigger audio.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

function loadVoicesWithRetry() {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      resolve([]);
      return;
    }
    let voices = synth.getVoices();
    if (voices && voices.length) {
      resolve(voices);
      return;
    }
    // Chrome populates voices asynchronously.
    let attempts = 0;
    const interval = setInterval(() => {
      voices = synth.getVoices();
      if ((voices && voices.length) || attempts > 10) {
        clearInterval(interval);
        resolve(voices || []);
      }
      attempts += 1;
    }, 150);
  });
}

function pickVoice(voices, langCode) {
  if (!voices || !voices.length) return null;
  const exact = voices.find((v) => (v.lang || '').toLowerCase().replace('_', '-') === langCode.toLowerCase());
  if (exact) return exact;
  const family = langCode.split('-')[0].toLowerCase();
  return voices.find((v) => (v.lang || '').toLowerCase().startsWith(family)) || null;
}

export function useTextToSpeech(langCode) {
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const lastSpokenRef = useRef(null); // { text, lang } — duplicate-speech guard
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadVoicesWithRetry().then((v) => {
      if (!cancelled) setVoices(v);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Voice availability is (langCode, voices)-dependent.
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setAvailable(false);
      availableRef.current = false;
      return;
    }
    const voice = pickVoice(voices, langCode);
    // A matching voice is preferred; the API itself can still attempt the
    // language, so mark available whenever the API exists and a voice was found.
    setAvailable(Boolean(voice));
  }, [langCode, voices]);

  const stop = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* no-op */
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text, { force = false } = {}) => {
      const synth = window.speechSynthesis;
      if (!synth || !text) return;

      const key = `${langCode}::${text}`;
      if (!force && lastSpokenRef.current === key) return; // re-render / StrictMode guard
      lastSpokenRef.current = key;

      synth.cancel(); // interrupt any current utterance before starting a new one
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = langCode;
      const voice = pickVoice(voices, langCode);
      if (voice) utter.voice = voice;
      utter.rate = 0.95; // slightly slower for elderly patients
      utter.pitch = 1.0;
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      setSpeaking(true);
      synth.speak(utter);
    },
    [langCode, voices]
  );

  const replay = useCallback(
    (text) => {
      speak(text, { force: true });
    },
    [speak]
  );

  // Stop speech on unmount so audio never bleeds across screens.
  useEffect(() => stop, [stop]);

  return { speak, replay, stop, speaking, available };
}
