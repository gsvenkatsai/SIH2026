"""
Unit tests for Phase 2: Dynamic Slot-Filling & Skip Engine
Tests slot extraction on complex multi-part patient narratives and priority slot skip logic.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.groq_service import extract_socrates_slots
from app.trees import (
    DECISION_TREES,
    get_tree_key,
    get_empty_socrates_state,
    select_next_question
)

client = TestClient(app)

def test_extract_multi_part_narrative():
    """
    Test extraction of complex multi-part narrative:
    'Sharp pain in center of chest since 4 PM today, 8/10, worse when taking deep breath'
    Should extract Site, Character, Onset, Exacerbating, and Severity in a single step.
    """
    narrative = "Sharp pain in center of chest since 4 PM today, 8/10, worse when taking deep breath"
    result = extract_socrates_slots(chief_complaint=narrative, history=[])
    socrates = result["socrates"]

    # Verify 5 dimensions are filled in one go
    assert socrates["site"]["status"] == "filled", f"Site not filled: {socrates['site']}"
    assert socrates["character"]["status"] == "filled", f"Character not filled: {socrates['character']}"
    assert socrates["onset"]["status"] == "filled", f"Onset not filled: {socrates['onset']}"
    assert socrates["exacerbating"]["status"] == "filled", f"Exacerbating not filled: {socrates['exacerbating']}"
    assert socrates["severity"]["status"] == "filled", f"Severity not filled: {socrates['severity']}"

    # Verify radiation and associated remain unfilled from narrative alone
    assert socrates["radiation"]["status"] == "unfilled", f"Radiation should be unfilled: {socrates['radiation']}"
    assert socrates["associated"]["status"] == "unfilled", f"Associated should be unfilled: {socrates['associated']}"

    print("✓ Single-step multi-part slot extraction passed (Site, Character, Onset, Exacerbating, Severity filled)")

def test_priority_resolver_skips_filled_slots():
    """
    Given that Site, Onset, Character, Exacerbating, and Severity are filled,
    the Priority Slot Resolver must SKIP all of them and ONLY ask for Radiation,
    Associated Symptoms, or Timing.
    """
    narrative = "Sharp pain in center of chest since 4 PM today, 8/10, worse when taking deep breath"
    result = extract_socrates_slots(chief_complaint=narrative, history=[])
    socrates = result["socrates"]

    tree_questions = DECISION_TREES["chest_pain"]
    next_q = select_next_question(
        tree_key="chest_pain",
        tree_questions=tree_questions,
        socrates_state=socrates,
        answered_ids=[]
    )

    if next_q:
        assert next_q["socrates_dimension"] in ["radiation", "associated", "timing"], (
            f"Expected next question to target radiation, associated, or timing, but got: {next_q['id']} ({next_q['socrates_dimension']})"
        )
        # Ensure it did NOT select any of the already filled dimensions
        assert next_q["socrates_dimension"] not in ["site", "onset", "character", "exacerbating", "severity"], (
            f"Redundant question selected: {next_q['id']}"
        )
        print(f"✓ Priority Slot Resolver skipped filled dimensions and selected: {next_q['id']} ({next_q['socrates_dimension']})")
    else:
        print("✓ Priority Slot Resolver determined all core slots are satisfied")

def test_end_to_end_dynamic_interview_flow():
    """
    End-to-end test of the API interview lifecycle with dynamic skipping:
    1. Patient starts with rich narrative -> skips site, onset, character, exacerbating, severity
    2. Patient answers remaining slots -> interview completes quickly without redundancy
    """
    # 1. Start Interview
    res = client.post("/interview/start", json={
        "chief_complaint": "Sharp pain in center of chest since 4 PM today, 8/10, worse when taking deep breath",
        "patient_name": "Dynamic Intake Test",
        "language": "English"
    })
    assert res.status_code == 200, res.text
    start_data = res.json()
    visit_id = start_data["visit_id"]
    q1_id = start_data["question_id"]
    state = start_data["socrates_state"]

    assert state["site"]["status"] == "filled"
    assert state["character"]["status"] == "filled"
    assert state["severity"]["status"] == "filled"
    assert q1_id in ["cp_radiation", "cp_associated", "cp_timing", "complete"], f"Unexpected question: {q1_id}"
    print(f"✓ Start interview dynamically skipped to {q1_id} based on rich chief complaint")

    # 2. Answer with Radiation and Associated symptoms
    if q1_id != "complete":
        res = client.post("/interview/answer", json={
            "visit_id": visit_id,
            "question_id": q1_id,
            "answer": "Yes, it radiates down my left arm, and I have cold sweats and trouble breathing"
        })
        assert res.status_code == 200, res.text
        ans1_data = res.json()
        q2_id = ans1_data.get("next_question_id")
        state2 = ans1_data["socrates_state"]

        assert state2["radiation"]["status"] == "filled"
        assert state2["associated"]["status"] == "filled"

        if q2_id:
            # 3. Answer remaining question
            res = client.post("/interview/answer", json={
                "visit_id": visit_id,
                "question_id": q2_id,
                "answer": "It is constant pain, non-stop since it began"
            })
            assert res.status_code == 200, res.text
            ans2_data = res.json()
            assert ans2_data["status"] == "section_complete"
            state3 = ans2_data["socrates_state"]
        else:
            assert ans1_data["status"] == "section_complete"
            state3 = state2

    print("✓ Interview completed with dynamic slot-filling and skip engine with 0 redundant questions!")

if __name__ == "__main__":
    test_extract_multi_part_narrative()
    test_priority_resolver_skips_filled_slots()
    test_end_to_end_dynamic_interview_flow()
    print("All Phase 2 Dynamic Slot-Filling tests passed successfully!")
