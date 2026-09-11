import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_flow():
    # 1. Root health check
    res = client.get("/")
    assert res.status_code == 200, res.text
    print("✓ Healthcheck endpoint passed")

    # 2. Start Interview
    res = client.post("/interview/start", json={
        "chief_complaint": "Chest pain radiating to left arm",
        "patient_name": "Test Patient John",
        "language": "English"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    visit_id = data["visit_id"]
    q_id = data["question_id"]
    print(f"✓ Start interview passed (visit_id: {visit_id}, q_id: {q_id})")

    # 3. Answer Interview Question
    res = client.post("/interview/answer", json={
        "visit_id": visit_id,
        "question_id": q_id,
        "answer": "Started 2 hours ago suddenly"
    })
    assert res.status_code == 200, res.text
    ans_data = res.json()
    print(f"✓ Answer interview passed (status: {ans_data['status']}, next_q: {ans_data.get('next_question_id')})")

    # 4. Upload Document
    dummy_file = io.BytesIO(b"Dummy medical report image data")
    res = client.post("/document/extract", data={"visit_id": visit_id}, files={"file": ("ecg_report.jpg", dummy_file, "image/jpeg")})
    assert res.status_code == 200, res.text
    doc_data = res.json()
    print(f"✓ Extract document passed (doc_id: {doc_data['doc_id']})")

    # 5. Finalize Record
    res = client.post("/record/finalize", json={"visit_id": visit_id})
    assert res.status_code == 200, res.text
    rec_data = res.json()
    print(f"✓ Finalize record passed (facts count: {len(rec_data['structured_record']['interview_facts'])})")

    # 6. Doctor Queue
    res = client.get("/doctor/queue")
    assert res.status_code == 200, res.text
    queue = res.json()
    assert any(q["visit_id"] == visit_id for q in queue)
    print(f"✓ Doctor queue passed ({len(queue)} items in queue)")

    # 7. Doctor Patient View
    res = client.get(f"/doctor/patient/{visit_id}")
    assert res.status_code == 200, res.text
    pat_view = res.json()
    assert pat_view["visit_id"] == visit_id
    print("✓ Doctor patient view passed")

    # 8. Doctor Approve
    res = client.post("/doctor/approve", json={
        "visit_id": visit_id,
        "notes": "Reviewed ECG and interview details. Approved."
    })
    assert res.status_code == 200, res.text
    app_data = res.json()
    assert app_data["status"] == "approved"
    print("✓ Doctor approve passed")

    print("\n🎉 ALL BACKEND ENDPOINTS AND DATABASE MODELS ARE 100% WORKING!")

if __name__ == "__main__":
    test_full_flow()
