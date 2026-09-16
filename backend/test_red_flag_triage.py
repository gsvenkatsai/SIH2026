"""
Unit tests for Phase 3: Emergency Red-Flag Circuit Breaker
Verifies deterministic ACS triage heuristics, STEMI simulation, and emergency intake shortening.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.trees import evaluate_cardiac_triage

client = TestClient(app)

def test_deterministic_cardiac_triage_rules():
    """
    Test individual branches of the deterministic ACS circuit breaker:
    Condition: (ischemic character OR radiation) AND (autonomic symptoms OR severity >= 7)
    """
    # 1. Crushing pain + sweating -> RED FLAG
    state1 = {
        "character": {"value": "Crushing pressure", "status": "filled"},
        "associated": {"value": "Diaphoresis (cold sweats)", "status": "filled"},
        "radiation": {"value": "None", "status": "filled"},
        "severity": {"value": "4/10", "status": "filled"}
    }
    res1 = evaluate_cardiac_triage(state1)
    assert res1["triage_level"] == "CRITICAL_RED_FLAG"
    assert res1["red_flag_alert"] is True
    assert "RED FLAG" in res1["triage_message"]

    # 2. Left arm radiation + Severity 8/10 -> RED FLAG
    state2 = {
        "character": {"value": "Dull ache", "status": "filled"},
        "radiation": {"value": "Radiates to left arm", "status": "filled"},
        "associated": {"value": "None", "status": "filled"},
        "severity": {"value": "8/10 Numeric Pain Rating", "status": "filled"}
    }
    res2 = evaluate_cardiac_triage(state2)
    assert res2["triage_level"] == "CRITICAL_RED_FLAG"
    assert res2["red_flag_alert"] is True

    # 3. Jaw radiation + Shortness of breath -> RED FLAG
    state3 = {
        "character": {"value": "Aching", "status": "filled"},
        "radiation": {"value": "Radiates to jaw and neck", "status": "filled"},
        "associated": {"value": "Dyspnea / shortness of breath", "status": "filled"},
        "severity": {"value": "5/10", "status": "filled"}
    }
    res3 = evaluate_cardiac_triage(state3)
    assert res3["triage_level"] == "CRITICAL_RED_FLAG"
    assert res3["red_flag_alert"] is True

    # 4. Crushing pain alone without autonomic or high severity -> ALERT
    state4 = {
        "character": {"value": "Crushing pressure", "status": "filled"},
        "radiation": {"value": "None", "status": "filled"},
        "associated": {"value": "None", "status": "filled"},
        "severity": {"value": "4/10", "status": "filled"}
    }
    res4 = evaluate_cardiac_triage(state4)
    assert res4["triage_level"] == "ALERT"
    assert res4["red_flag_alert"] is False

    # 5. Non-cardiac pleuritic sharp pain -> NORMAL
    state5 = {
        "character": {"value": "Sharp stabbing", "status": "filled"},
        "radiation": {"value": "None", "status": "filled"},
        "associated": {"value": "Cough", "status": "filled"},
        "severity": {"value": "3/10", "status": "filled"}
    }
    res5 = evaluate_cardiac_triage(state5)
    assert res5["triage_level"] == "NORMAL"
    assert res5["red_flag_alert"] is False

    print("✓ Deterministic cardiac triage rules validated across all combinations")

def test_stemi_narrative_simulation():
    """
    Simulate a classic STEMI patient narrative at /interview/start:
    'Crushing chest pressure since 1 hour ago radiating to left arm and jaw with cold sweats, severity 9/10'
    Must immediately flag RED and return emergency clinical attention message.
    """
    stemi_narrative = (
        "Crushing chest pressure since 1 hour ago radiating to left arm and jaw with cold sweats, severity 9/10"
    )

    res = client.post("/interview/start", json={
        "chief_complaint": stemi_narrative,
        "patient_name": "STEMI Emergency Patient",
        "language": "English"
    })
    assert res.status_code == 200, res.text
    data = res.json()

    # Verify RED triage level and emergency alert banner
    assert "RED" in data["triage_level"], f"Expected RED in triage_level, got {data['triage_level']}"
    assert data["triage_status"] == "CRITICAL_RED_FLAG"
    assert data["red_flag_alert"] is True
    assert data["triage_message"] is not None
    assert "RED FLAG" in data["triage_message"]
    assert data["can_shorten"] is True

    print(f"✓ STEMI simulation successfully triggered: {data['triage_level']}")
    print(f"  Alert Message: {data['triage_message']}")

def test_shortening_circuit_breaker(visit_id=None, question_id=None):
    """
    Verify that when a red flag is active, the intake can be immediately shortened
    to transition the patient to doctor review without forcing them to complete all remaining questions.
    """
    if not visit_id:
        # Start a red flag interview
        res = client.post("/interview/start", json={
            "chief_complaint": "Crushing chest pain radiating to jaw and left arm with heavy sweating",
            "patient_name": "Emergency Patient Bob",
            "language": "English"
        })
        assert res.status_code == 200
        start_data = res.json()
        visit_id = start_data["visit_id"]
        question_id = start_data["question_id"]

    # Answer requesting emergency doctor review / shorten intake
    res = client.post("/interview/answer", json={
        "visit_id": visit_id,
        "question_id": question_id,
        "answer": "I feel very weak, emergency please call doctor now",
        "shorten_intake": True
    })
    assert res.status_code == 200, res.text
    ans_data = res.json()

    # Must immediately complete section and not ask further questions
    assert ans_data["status"] == "section_complete", f"Expected section_complete, got {ans_data['status']}"
    assert ans_data["next_question"] is None
    assert ans_data["red_flag_alert"] is True
    assert "RED" in ans_data["triage_level"]

    print("✓ Emergency shortening circuit breaker successfully expedited patient directly to doctor review")

def test_doctor_queue_prioritization():
    """
    Verify that emergency red-flag visits are sorted to the top of the doctor queue.
    """
    # 1. Create a normal visit
    res_norm = client.post("/interview/start", json={
        "chief_complaint": "Mild knee ache after jogging",
        "patient_name": "Routine Patient",
        "language": "English"
    })
    norm_id = res_norm.json()["visit_id"]

    # 2. Create a critical red flag visit
    res_red = client.post("/interview/start", json={
        "chief_complaint": "Crushing chest pain radiating to left arm with profuse sweating, 9/10",
        "patient_name": "Critical Cardiac Patient",
        "language": "English"
    })
    red_id = res_red.json()["visit_id"]

    # 3. Check queue
    res_queue = client.get("/doctor/queue")
    assert res_queue.status_code == 200, res_queue.text
    queue = res_queue.json()

    # The red flag visit should appear ahead of normal visits
    red_index = next((i for i, item in enumerate(queue) if item["visit_id"] == red_id), None)
    norm_index = next((i for i, item in enumerate(queue) if item["visit_id"] == norm_id), None)

    assert red_index is not None, "Red visit not in doctor queue"
    assert norm_index is not None, "Norm visit not in doctor queue"
    assert red_index < norm_index, f"Expected red-flag visit ({red_index}) before normal visit ({norm_index})"

    # Verify patient detail view contains triage status
    res_pat = client.get(f"/doctor/patient/{red_id}")
    assert res_pat.status_code == 200
    pat_data = res_pat.json()
    assert pat_data["triage_level"] == "CRITICAL_RED_FLAG"
    assert pat_data["red_flag_alert"] is True

    print("✓ Doctor queue emergency prioritization successfully verified (Red Flag placed at top)")

if __name__ == "__main__":
    test_deterministic_cardiac_triage_rules()
    v_id, q_id = test_stemi_narrative_simulation()
    test_shortening_circuit_breaker(v_id, q_id)
    test_doctor_queue_prioritization()
    print("All Phase 3 Emergency Red-Flag Circuit Breaker tests passed successfully!")
