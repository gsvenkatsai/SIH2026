const API_BASE_URL = "http://localhost:8005";

import { normalizeLanguage } from './i18n';

export async function apiStartInterview(chiefComplaint, patientName = "Anonymous Patient", language = "en-IN") {
  const response = await fetch(`${API_BASE_URL}/interview/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chief_complaint: chiefComplaint,
      patient_name: patientName,
      language: normalizeLanguage(language)
    })
  });
  if (!response.ok) throw new Error("Failed to start interview");
  return response.json();
}

export async function apiAnswerInterview(visitId, questionId, answer, shortenIntake = false, meta = null) {
  /** meta: { language, input_mode?, original_transcript?, confidence? } —
   *  input_mode defaults to 'text'; voice metadata is only sent when present. */
  const response = await fetch(`${API_BASE_URL}/interview/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visit_id: visitId,
      question_id: questionId,
      answer: answer,
      shorten_intake: shortenIntake,
      ...(meta ? {
        input_mode: meta.input_mode || "text",
        language: meta.language,
        original_transcript: meta.original_transcript,
        transcription_confidence: meta.confidence
      } : {})
    })
  });
  if (!response.ok) throw new Error("Failed to submit answer");
  return response.json();
}

export async function apiTranscribeVoice(audioBlob, language = "en-IN") {
  /** ASR only — clinical interpretation happens via apiAnswerInterview. */
  const formData = new FormData();
  formData.append("file", audioBlob, "speech.webm");
  formData.append("language", normalizeLanguage(language));

  const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    let detail = "mic.transcriptionFailed";
    try {
      const body = await response.json();
      if (body.detail) detail = mapAsrError(body.detail);
    } catch {
      /* non-JSON error body */
    }
    const err = new Error("Voice transcription failed");
    err.kind = detail;
    throw err;
  }
  return response.json(); // { success, language, transcript, confidence }
}

export async function apiAnswerInterviewVoice(visitId, questionId, audioBlob, language = "en-IN") {
  /** Legacy combined endpoint — retained for backwards compatibility. */
  const formData = new FormData();
  formData.append("visit_id", visitId);
  formData.append("question_id", questionId);
  formData.append("language", normalizeLanguage(language));
  formData.append("file", audioBlob, "user_voice.webm");

  const response = await fetch(`${API_BASE_URL}/interview/answer-voice`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Voice transcription error: ${errText}`);
  }
  return response.json();
}

function mapAsrError(detail) {
  switch (detail) {
    case "no_api_key":
    case "asr_unavailable":
      return "mic.serviceUnavailable";
    case "empty_audio":
      return "mic.emptyRecording";
    case "unsupported_format":
      return "mic.transcriptionFailed";
    default:
      return "mic.transcriptionFailed";
  }
}

export async function apiUploadDocument(visitId, file) {
  const formData = new FormData();
  formData.append("visit_id", visitId);
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/document/extract`, {
    method: "POST",
    body: formData
  });
  if (!response.ok) throw new Error("Failed to upload and extract document");
  return response.json();
}

export async function apiFinalizeRecord(visitId) {
  const response = await fetch(`${API_BASE_URL}/record/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visit_id: visitId })
  });
  if (!response.ok) throw new Error("Failed to finalize clinical record");
  return response.json();
}

export async function apiGetDoctorQueue() {
  const response = await fetch(`${API_BASE_URL}/doctor/queue`);
  if (!response.ok) throw new Error("Failed to fetch doctor queue");
  return response.json();
}

export async function apiGetPatientRecord(visitId) {
  const response = await fetch(`${API_BASE_URL}/doctor/patient/${visitId}`);
  if (!response.ok) throw new Error("Failed to fetch patient record");
  return response.json();
}

export async function apiApproveRecord(visitId, edits = null, notes = null) {
  const response = await fetch(`${API_BASE_URL}/doctor/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visit_id: visitId,
      edits: edits,
      notes: notes
    })
  });
  if (!response.ok) throw new Error("Failed to approve record");
  return response.json();
}
