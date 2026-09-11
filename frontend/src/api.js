const API_BASE_URL = "http://localhost:8005";

export async function apiStartInterview(chiefComplaint, patientName = "Anonymous Patient", language = "English") {
  const response = await fetch(`${API_BASE_URL}/interview/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chief_complaint: chiefComplaint,
      patient_name: patientName,
      language: language
    })
  });
  if (!response.ok) throw new Error("Failed to start interview");
  return response.json();
}

export async function apiAnswerInterview(visitId, questionId, answer) {
  const response = await fetch(`${API_BASE_URL}/interview/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visit_id: visitId,
      question_id: questionId,
      answer: answer
    })
  });
  if (!response.ok) throw new Error("Failed to submit answer");
  return response.json();
}

export async function apiAnswerInterviewVoice(visitId, questionId, audioBlob, language = "English") {
  let langCode = "en";
  if (language === "Hindi" || language === "hi") langCode = "hi";
  if (language === "Kannada" || language === "kn") langCode = "kn";

  const formData = new FormData();
  formData.append("visit_id", visitId);
  formData.append("question_id", questionId);
  formData.append("language", langCode);
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
