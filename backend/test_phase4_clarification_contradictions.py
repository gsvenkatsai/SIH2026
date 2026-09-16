"""
Unit tests for Phase 4: Clarification Fallbacks, Contradiction Flags & Deprecation Elimination.
Verifies:
1. One-shot clarification loop: When a slot is unclear, select_next_question issues a {q_id}_clarify question using fallback_question.
2. Anti-looping: Answering the clarify question marks it answered and avoids infinite questioning.
3. Verbal self-contradiction detection: Revisions in socrates_state history are surfaced as contradiction flags in merge_record_and_flag.
4. Deprecation check: database and models import and initialize cleanly without SQLAlchemy 2.0 or datetime.utcnow warnings.
"""

import warnings
from app.trees import (
    select_next_question,
    DECISION_TREES,
    get_empty_socrates_state
)
from app.groq_service import merge_record_and_flag
from app.database import engine, Base
from app.models import Visit, Patient

def test_one_shot_clarification_on_unclear_slot():
    """Verify that an unclear slot triggers a one-shot clarify question using fallback_question."""
    questions = DECISION_TREES["chest_pain"]
    socrates_state = get_empty_socrates_state()
    # Mark site as unclear
    socrates_state["site"] = {
        "value": "Somewhere in the chest area",
        "confidence": 0.4,
        "status": "unclear",
        "history": []
    }
    # Pretend cp_site was already asked
    answered_ids = ["cp_site"]

    next_q = select_next_question(
        tree_key="chest_pain",
        tree_questions=questions,
        socrates_state=socrates_state,
        answered_ids=answered_ids
    )

    assert next_q is not None
    assert next_q["id"] == "cp_site_clarify"
    assert next_q.get("is_clarification") is True
    # The question text should be the fallback question
    orig_q = next(q for q in questions if q["id"] == "cp_site")
    assert next_q["question"] == orig_q["fallback_question"]

def test_clarification_anti_looping():
    """Verify that once a clarify question is answered, it is never asked again."""
    questions = DECISION_TREES["chest_pain"]
    socrates_state = get_empty_socrates_state()
    # Mark site as unclear still
    socrates_state["site"] = {
        "value": "Still vague",
        "confidence": 0.4,
        "status": "unclear",
        "history": []
    }
    # Both original question and clarify question are in answered_ids
    answered_ids = ["cp_site", "cp_site_clarify"]

    next_q = select_next_question(
        tree_key="chest_pain",
        tree_questions=questions,
        socrates_state=socrates_state,
        answered_ids=answered_ids
    )

    # Should move on to another question or None if all done, NOT repeat cp_site_clarify
    if next_q:
        assert next_q["id"] != "cp_site"
        assert next_q["id"] != "cp_site_clarify"

def test_verbal_self_contradiction_detection():
    """Verify that socrates_state history revisions are surfaced in contradiction_flags."""
    socrates_state = get_empty_socrates_state()
    socrates_state["severity"] = {
        "value": "9/10 unbearable pain",
        "confidence": 0.95,
        "status": "filled",
        "source": "interview",
        "source_icon": "🎤",
        "history": [
            {
                "previous_value": "Mild ache 2/10",
                "confidence": 0.8,
                "timestamp": "2026-09-16T10:00:00Z"
            }
        ]
    }

    res = merge_record_and_flag(
        chief_complaint="Chest tightness",
        patient_name="John Doe",
        patient_language="English",
        interview_responses=[
            {"question": "How severe?", "answer": "Initially a 2, but now it has reached 9 out of 10!"}
        ],
        documents=[],
        socrates_state=socrates_state
    )

    contradictions = res.get("contradiction_flags", [])
    assert any("Verbal Symptom Revision" in c and "Severity" in c for c in contradictions), (
        f"Expected Verbal Symptom Revision for Severity in contradiction_flags, got: {contradictions}"
    )
    assert any("2/10" in c and "9/10" in c for c in contradictions)

def test_no_sqlalchemy_or_datetime_deprecation_warnings():
    """Verify clean database imports and model creation without warnings."""
    with warnings.catch_warnings(record=True) as recorded_warnings:
        warnings.simplefilter("always")

        # Test Base and engine access
        _ = engine
        _ = Base.metadata

        # Instantiate test instances of Visit and Patient to verify default utc_now callable
        p = Patient(name="Test Patient", language="English")
        v = Visit(patient_id=1, chief_complaint="Chest pain")

        # Filter for MovedIn20Warning or datetime.utcnow
        deprecations = [
            str(w.message) for w in recorded_warnings
            if "MovedIn20Warning" in str(type(w.category).__name__)
            or "utcnow" in str(w.message).lower()
            or "declarative_base" in str(w.message).lower()
        ]
        assert len(deprecations) == 0, f"Found unexpected deprecations: {deprecations}"
