import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models import Patient, Visit, InterviewResponse, Document, FinalRecord

client = TestClient(app)

def test_complete_socrates_workflow():
    print("\n=======================================================")
    print("      TRUE SOCRATES CLINICAL INTAKE END-TO-END TEST    ")
    print("=======================================================\n")
    
    # Clean test DB
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # ---------------------------------------------------------
    # STEP 1: Patient starts intake at Kiosk with acute chest pain
    # ---------------------------------------------------------
    print("[1] Patient Kiosk: Starting intake with acute chest pain...")
    start_payload = {
        "chief_complaint": "Crushing pain in center of chest since 2 hours ago, 9/10, worse with exertion",
        "patient_name": "Arun Verma",
        "language": "English"
    }
    res_start = client.post("/interview/start", json=start_payload)
    assert res_start.status_code == 200, f"Start failed: {res_start.text}"
    start_data = res_start.json()
    visit_id = start_data["visit_id"]
    print(f"  ✓ Visit created: ID #{visit_id}")
    print(f"  ✓ Initial Triage Status: {start_data['triage_status']}")
    print(f"  ✓ Red Flag Alert: {start_data['red_flag_alert']}")
    print(f"  ✓ Dynamic Next Question: {start_data['question']} (ID: {start_data['question_id']})")
    
    # Verify slots extracted at start
    socrates_state = start_data.get("socrates_state", {})
    assert socrates_state.get("site", {}).get("value") is not None, "Site should be filled from complaint"
    assert socrates_state.get("severity", {}).get("value") is not None, "Severity should be filled from complaint"
    assert socrates_state.get("character", {}).get("value") is not None, "Character should be filled from complaint"

    # ---------------------------------------------------------
    # STEP 2: Patient answers next question with radiation & autonomic distress
    # ---------------------------------------------------------
    print("\n[2] Patient Kiosk: Answering with radiation to left arm and cold sweats...")
    answer_payload = {
        "visit_id": visit_id,
        "question_id": start_data["question_id"],
        "answer": "Yes, it radiates down my left arm into my jaw, and I am breaking out in cold sweats.",
        "shorten_intake": False
    }
    res_ans = client.post("/interview/answer", json=answer_payload)
    assert res_ans.status_code == 200, f"Answer failed: {res_ans.text}"
    ans_data = res_ans.json()
    print(f"  ✓ Triage Status: {ans_data['triage_status']}")
    print(f"  ✓ Red Flag Alert: {ans_data['red_flag_alert']}")
    print(f"  ✓ Can Shorten Intake: {ans_data['can_shorten']}")
    assert ans_data["triage_status"] == "CRITICAL_RED_FLAG", "Must trigger CRITICAL_RED_FLAG"
    assert ans_data["red_flag_alert"] is True
    assert ans_data["can_shorten"] is True

    # ---------------------------------------------------------
    # STEP 3: Expedited Circuit Breaker Triggered (Emergency Shortening)
    # ---------------------------------------------------------
    print("\n[3] Patient Kiosk: Activating Emergency Circuit Breaker (Shorten Intake)...")
    shorten_payload = {
        "visit_id": visit_id,
        "question_id": ans_data.get("next_question_id", "cp_radiation"),
        "answer": "Patient requested emergency expedited intake.",
        "shorten_intake": True
    }
    res_shorten = client.post("/interview/answer", json=shorten_payload)
    assert res_shorten.status_code == 200
    shorten_data = res_shorten.json()
    print(f"  ✓ Intake Completed Immediately: {shorten_data['is_complete']}")
    assert shorten_data["is_complete"] is True

    # ---------------------------------------------------------
    # STEP 4: Document Upload with Ischemic ECG & Nitrates
    # ---------------------------------------------------------
    print("\n[4] Document Upload: Uploading ECG and prescription records...")
    db = SessionLocal()
    doc = Document(
        visit_id=visit_id,
        image_path="uploads/cardiac_emergency_referral.pdf",
        filename="cardiac_emergency_referral.pdf",
        extracted_json={
            "diagnoses": ["Acute Coronary Syndrome", "Anterior STEMI"],
            "medications": [{"name": "Nitroglycerin 0.4mg SL"}, {"name": "Aspirin 325mg"}],
            "clinical_notes": ["Anterior ST elevation in V1-V4", "Substernal chest pressure"]
        }
    )
    db.add(doc)
    db.commit()
    db.close()
    print("  ✓ Document attached to visit.")

    # ---------------------------------------------------------
    # STEP 5: Record Finalization & Evidence Tagging
    # ---------------------------------------------------------
    print("\n[5] Safety Engine: Finalizing record and synthesizing 8-card SOCRATES matrix...")
    res_fin = client.post("/record/finalize", json={"visit_id": visit_id})
    assert res_fin.status_code == 200, f"Finalize failed: {res_fin.text}"
    fin_data = res_fin.json()
    rec = fin_data["structured_record"]

    assert "socrates_matrix" in rec, "Structured record missing socrates_matrix"
    matrix = rec["socrates_matrix"]
    assert len(matrix) == 8, f"Expected 8 dimensions, got {len(matrix)}"
    print(f"  ✓ Synthesized 8-cell SOCRATES matrix:")
    for dim, cell in matrix.items():
        print(f"    • [{cell['source_icon']}] {cell['label']}: \"{cell['value']}\" (Status: {cell['status']}, Conf: {cell['confidence']})")

    assert matrix["character"]["status"] == "alert"
    assert matrix["radiation"]["status"] == "alert"
    assert matrix["severity"]["status"] == "alert"
    assert len(rec.get("attention_flags", [])) > 0, "Expected attention flag for ACS"
    print(f"  ✓ Clinical Attention Flags: {rec['attention_flags']}")

    # ---------------------------------------------------------
    # STEP 6: Doctor Portal Queue Prioritization
    # ---------------------------------------------------------
    print("\n[6] Doctor Portal: Verifying emergency triage queue prioritization...")
    res_queue = client.get("/doctor/queue")
    assert res_queue.status_code == 200
    queue = res_queue.json()
    assert len(queue) > 0
    top_patient = queue[0]
    print(f"  ✓ Top of Doctor Queue: Patient #{top_patient['visit_id']} ({top_patient['patient_name']}) - Triage: {top_patient['triage_level']}")
    assert top_patient["visit_id"] == visit_id
    assert top_patient["triage_level"] == "CRITICAL_RED_FLAG"
    assert top_patient["red_flag_alert"] is True

    # ---------------------------------------------------------
    # STEP 7: Doctor Patient View & Matrix Editing
    # ---------------------------------------------------------
    print("\n[7] Doctor Review: Inspecting and modifying SOCRATES matrix...")
    res_pat = client.get(f"/doctor/patient/{visit_id}")
    assert res_pat.status_code == 200
    pat_data = res_pat.json()
    doc_matrix = pat_data["structured_record"]["socrates_matrix"]
    assert len(doc_matrix) == 8
    print("  ✓ Doctor successfully received 8-cell matrix.")

    # Doctor corrects / confirms slots
    doc_matrix["site"]["value"] = "Retrosternal and precordial (Confirmed by exam)"
    doc_matrix["severity"]["value"] = "9/10 (Severe anginal pain, morphine administered)"
    
    # ---------------------------------------------------------
    # STEP 8: Doctor Approval Sign-off
    # ---------------------------------------------------------
    print("\n[8] Doctor Approval: Submitting physician sign-off with edited matrix...")
    approve_payload = {
        "visit_id": visit_id,
        "edits": {
            **pat_data["structured_record"],
            "overall_summary": "Confirmed Acute STEMI. Transferred urgently to cath lab for primary PCI.",
            "socrates_matrix": doc_matrix
        },
        "notes": "Emergency stat cath lab activation requested."
    }
    res_app = client.post("/doctor/approve", json=approve_payload)
    assert res_app.status_code == 200
    app_data = res_app.json()
    print(f"  ✓ Approval status: {app_data['status']}")
    assert app_data["status"] == "approved"

    # Verify persisted changes in database
    res_verify = client.get(f"/doctor/patient/{visit_id}")
    assert res_verify.status_code == 200
    v_data = res_verify.json()
    assert v_data["approved_by_doctor"] is True
    assert "cath lab" in v_data["doctor_notes"]
    assert "morphine administered" in v_data["structured_record"]["socrates_matrix"]["severity"]["value"]
    print("  ✓ Persisted doctor matrix edits and signed approval verified in DB!")

    print("\n=======================================================")
    print(" >>> COMPLETE TRUE SOCRATES PROTOCOL VERIFIED (100%) <<<")
    print("=======================================================\n")

if __name__ == "__main__":
    test_complete_socrates_workflow()
