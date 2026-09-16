/**
 * useVoiceRecorder — real browser microphone recording via MediaRecorder.
 *
 * Full state machine (never a bare isRecording boolean):
 *   idle → requesting → recording → uploading → transcribing → transcribed
 *        ↘ error (with patient-friendly, translated error kind)
 *
 * The caller receives audio as a Blob and sends it to the FastAPI backend
 * (/voice/transcribe) — the Groq API key never touches the browser.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export const VOICE_STATE = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  RECORDING: 'recording',
  UPLOADING: 'uploading',
  TRANSCRIBING: 'transcribing',
  TRANSCRIBED: 'transcribed',
  ERROR: 'error',
};

const MAX_RECORDING_MS = 30000; // kiosk answers are short; hard cap protects storage & upload

export function useVoiceRecorder({ onRecordingStopped } = {}) {
  const [state, setState] = useState(VOICE_STATE.IDLE);
  const [errorKind, setErrorKind] = useState(null); // machine-readable, translated in the component
  const [elapsedMs, setElapsedMs] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const stoppedCbRef = useRef(onRecordingStopped);
  useEffect(() => {
    stoppedCbRef.current = onRecordingStopped;
  }, [onRecordingStopped]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startRecording = useCallback(async () => {
    setErrorKind(null);
    setElapsedMs(0);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorKind('mic.unsupported');
      setState(VOICE_STATE.ERROR);
      return;
    }

    setState(VOICE_STATE.REQUESTING);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setErrorKind('mic.permissionDenied');
      } else if (err && err.name === 'NotFoundError') {
        setErrorKind('mic.notFound');
      } else {
        setErrorKind('mic.generic');
      }
      setState(VOICE_STATE.ERROR);
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    let recorder;
    try {
      // Prefer formats Whisper reliably handles; browsers differ so probe in order.
      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = preferred.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      cleanup();
      setErrorKind('mic.unsupported');
      setState(VOICE_STATE.ERROR);
      return;
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      cleanup();
      if (blob.size < 2000) {
        // <2KB almost certainly means silence / an immediate stop.
        setErrorKind('mic.emptyRecording');
        setState(VOICE_STATE.ERROR);
        return;
      }
      setState(VOICE_STATE.TRANSCRIBED);
      if (stoppedCbRef.current) stoppedCbRef.current(blob);
    };

    recorder.start(250); // gather chunks for reliable blobs
    startedAtRef.current = Date.now();
    setState(VOICE_STATE.RECORDING);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);

    // Hard timeout: kiosk patients forget to tap stop.
    setTimeout(() => {
      if (mediaRecorderRef.current === recorder && recorder.state === 'recording') {
        try {
          recorder.stop();
        } catch {
          /* already stopping */
        }
      }
    }, MAX_RECORDING_MS);
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setState(VOICE_STATE.UPLOADING);
      try {
        recorder.stop(); // onstop builds the blob and calls onRecordingStopped
      } catch {
        cleanup();
        setErrorKind('mic.generic');
        setState(VOICE_STATE.ERROR);
      }
    }
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setErrorKind(null);
    setElapsedMs(0);
    setState(VOICE_STATE.IDLE);
  }, [cleanup]);

  const setBusy = useCallback(() => {
    /** Upload/transcribe phase — driven by the caller while it awaits the ASR API. */
    setState(VOICE_STATE.TRANSCRIBING);
  }, []);

  const setTranscribed = useCallback(() => {
    /** ASR succeeded — transcript is ready for patient confirmation. */
    setState(VOICE_STATE.TRANSCRIBED);
  }, []);

  const setError = useCallback((kind) => {
    setErrorKind(kind);
    setState(VOICE_STATE.ERROR);
  }, []);

  return { state, errorKind, elapsedMs, startRecording, stopRecording, reset, setBusy, setTranscribed, setError, setErrorKind };
}
