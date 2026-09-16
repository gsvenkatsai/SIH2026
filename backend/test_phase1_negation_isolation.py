"""
Unit tests for Phase 1: Natural Language Isolation, Negation Engine, and Keyword Collision Prevention.
Verifies that:
1. Question text is isolated from patient answers and does not contaminate slot extraction.
2. Negations ("no left arm pain", "denies shortness of breath", "not sweating", "not crushing") are handled cleanly.
3. Keyword collisions (e.g. "worse on deep breath" vs "shortness of breath") do not spuriously trigger associated dyspnea.
4. Deterministic cardiac triage does not fire false alarms when symptoms are explicitly negated.
"""

from app.trees import is_negated, evaluate_cardiac_triage, get_empty_socrates_state
from app.groq_service import extract_socrates_slots

def test_is_negated_helper():
    """Verify is_negated correctly detects various clinical negation styles."""
    # Direct leading negation
    assert is_negated("left arm", "I have no pain in my left arm") is True
    assert is_negated("shortness of breath", "Patient denies shortness of breath") is True
    assert is_negated("sweat", "not sweating at all") is True
    assert is_negated("crushing", "it is not crushing, just dull ache") is True
    assert is_negated("radiation", "without any radiation") is True
    assert is_negated("arm", "does not radiate to arm") is True

    # Trailing negation
    assert is_negated("radiation", "radiation: none") is True
    assert is_negated("sweating", "sweating: absent") is True

    # Positive symptoms (must NOT be negated)
    assert is_negated("left arm", "severe pain radiating down my left arm") is False
    assert is_negated("sweat", "breaking out in cold sweats and feeling dizzy") is False
    assert is_negated("crushing", "feels like heavy crushing pressure on my chest") is False

def test_question_leakage_isolation():
    """
    Verify that anchor words in the kiosk's question ('crushing', 'left arm', 'jaw')
    do NOT contaminate the extracted slots if the patient says something else.
    """
    fake_history = [
        {
            "question": "Can you describe the pain? Is it pressure, crushing, sharp, burning, or aching?",
            "answer": "It is just a sharp needle-like prick."
        },
        {
            "question": "Does the pain travel or radiate anywhere else, like your left arm, jaw, neck, or back?",
            "answer": "No, it stays strictly in one single spot on the right side."
        }
    ]

    # Run extraction with the history
    res = extract_socrates_slots(
        chief_complaint="Sharp localized pain",
        history=fake_history,
        current_state=get_empty_socrates_state()
    )
    socrates = res["socrates"]

    # Character must be Sharp, NOT Crushing (even though 'crushing' was in question)
    assert socrates["character"]["status"] == "filled"
    assert "sharp" in socrates["character"]["value"].lower()
    assert "crushing" not in socrates["character"]["value"].lower()

    # Radiation must be localized / no radiation, NOT Left Arm or Jaw
    assert socrates["radiation"]["status"] == "filled"
    assert "left arm" not in socrates["radiation"]["value"].lower()
    assert "jaw" not in socrates["radiation"]["value"].lower()

def test_negation_in_slot_extraction():
    """Verify that explicitly negated symptoms are not recorded as positive entities."""
    narrative = "Mild ache in center of chest. No pain in left arm, no jaw pain, and not having shortness of breath or cold sweats."
    res = extract_socrates_slots(chief_complaint=narrative, history=[])
    socrates = res["socrates"]

    # Radiation must NOT be left arm or jaw
    rad_val = (socrates["radiation"]["value"] or "").lower()
    assert "left arm" not in rad_val
    assert "jaw" not in rad_val

    # Associated symptoms must NOT be dyspnea or diaphoresis
    assoc_val = (socrates["associated"]["value"] or "").lower()
    assert "dyspnea" not in assoc_val
    assert "shortness of breath" not in assoc_val
    assert "diaphoresis" not in assoc_val
    assert "sweat" not in assoc_val

def test_keyword_collision_deep_breath_vs_dyspnea():
    """Verify that 'worse on deep breath' fills Exacerbating but NOT Associated dyspnea."""
    narrative = "Chest discomfort since morning, 5/10, pain gets noticeably worse when taking a deep breath."
    res = extract_socrates_slots(chief_complaint=narrative, history=[])
    socrates = res["socrates"]

    # Exacerbating must be filled
    assert socrates["exacerbating"]["status"] == "filled"
    assert "deep breath" in socrates["exacerbating"]["value"].lower()

    # Associated must remain unfilled (no shortness of breath or cold sweats reported)
    assert socrates["associated"]["status"] in ["unfilled", "none"]
    assoc_val = (socrates["associated"]["value"] or "").lower()
    assert "shortness of breath" not in assoc_val
    assert "dyspnea" not in assoc_val

def test_triage_circuit_breaker_respects_negation():
    """Verify that cardiac triage does NOT fire CRITICAL_RED_FLAG when symptoms are negated."""
    # Patient denies radiation and dyspnea
    socrates_neg = get_empty_socrates_state()
    socrates_neg["character"] = {"value": "Dull ache", "status": "filled", "confidence": 0.9}
    socrates_neg["radiation"] = {"value": "No radiation (Localized)", "status": "filled", "confidence": 0.9}
    socrates_neg["associated"] = {"value": "None reported / Denies associated symptoms", "status": "filled", "confidence": 0.9}
    socrates_neg["severity"] = {"value": "4/10", "status": "filled", "confidence": 0.9}

    patient_narrative = "Dull ache in chest. No crushing pain, no left arm radiation, no shortness of breath, severity 4 out of 10."
    triage = evaluate_cardiac_triage(socrates_neg, text_corpus=patient_narrative)

    assert triage["triage_level"] != "CRITICAL_RED_FLAG", f"False red flag triggered: {triage}"
    assert triage["red_flag_alert"] is False
