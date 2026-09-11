import io
import requests

BASE_URL = "http://localhost:8005"

def test_full_system():
    print("🚀 Starting End-to-End System Verification against live backend...")

    # 1. Health check
    res = requests.get(f"{BASE_URL}/")
    assert res.status_code == 200
    print("✓ 1. Backend Server is Online:", res.json())

    # 2. Start Patient Interview
    start_payload = {
        "chief_complaint": "Chest pain radiating to left arm and sweating",
        "patient_name": "Anita Verma",
        "language": "Hindi"
    }
    res = requests.post(f"{BASE_URL}/interview/start", json=start_payload)
    assert res.status_code == 200, res.text
    data = res.json()
    visit_id = data["visit_id"]
    q1_id = data["question_id"]
    print(f"✓ 2. Patient Intake Started. Visit #{visit_id}. Initial Q: '{data['question']}'")

    # 3. Answer Q1
    res = requests.post(f"{BASE_URL}/interview/answer", json={
        "visit_id": visit_id,
        "question_id": q1_id,
        "answer": "Pain started 3 hours ago suddenly after walking up stairs."
    })
    assert res.status_code == 200, res.text
    q2_data = res.json()
    print(f"✓ 3. Q1 Answered. Next Q: '{q2_data['next_question']}'")

    # 4. Answer Q2
    res = requests.post(f"{BASE_URL}/interview/answer", json={
        "visit_id": visit_id,
        "question_id": q2_data["next_question_id"],
        "answer": "Heavy crushing pressure in center of chest."
    })
    assert res.status_code == 200, res.text
    print("✓ 4. Q2 Answered.")

    # 5. Document Upload
    dummy_img = io.BytesIO(b"Simulated ECG & Prescription Image Content")
    res = requests.post(
        f"{BASE_URL}/document/extract",
        data={"visit_id": visit_id},
        files={"file": ("ecg_prescription_aug2026.jpg", dummy_img, "image/jpeg")}
    )
    assert res.status_code == 200, res.text
    doc_res = res.json()
    print(f"✓ 5. Document Extracted. Doc ID: {doc_res['doc_id']}. Confidence: {doc_res['confidence']*100}%")

    # 6. Record Finalization (Synthesis with Evidence Tags)
    res = requests.post(f"{BASE_URL}/record/finalize", json={"visit_id": visit_id})
    assert res.status_code == 200, res.text
    final_res = res.json()
    structured = final_res["structured_record"]
    print("✓ 6. Record Finalized with Evidence Tags & Flags:")
    print(f"   - Interview Facts: {len(structured['interview_facts'])}")
    print(f"   - Document Facts: {len(structured['document_facts'])}")
    print(f"   - Attention Flags: {structured['attention_flags']}")

    # 7. Doctor Queue View
    res = requests.get(f"{BASE_URL}/doctor/queue")
    assert res.status_code == 200
    queue = res.json()
    visit_in_queue = next(v for v in queue if v["visit_id"] == visit_id)
    print(f"✓ 7. Doctor Queue Verified. Visit status: '{visit_in_queue['status']}'")

    # 8. Doctor Detail View
    res = requests.get(f"{BASE_URL}/doctor/patient/{visit_id}")
    assert res.status_code == 200
    pat_record = res.json()
    print(f"✓ 8. Doctor Patient Detail Loaded for Visit #{visit_id}")

    # 9. Doctor Edits & Approval
    res = requests.post(f"{BASE_URL}/doctor/approve", json={
        "visit_id": visit_id,
        "notes": "ECG shows sinus rhythm. Recommended STAT Troponin I and cardiology consultation.",
        "edits": {
            **structured,
            "overall_summary": "Patient presented with acute crushing chest pain radiating to left arm. Physician approved for immediate clinical workup."
        }
    })
    assert res.status_code == 200, res.text
    app_res = res.json()
    print(f"✓ 9. Record Approved by Physician: {app_res['message']}")

    print("\n🎉 ALL 6 SCREENS & END-TO-END WORKFLOW 100% OPERATIONAL & VERIFIED!")

if __name__ == "__main__":
    test_full_system()
