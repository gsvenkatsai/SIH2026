"""
Unit tests for Phase 3: Model Tiering, Token Optimization & Slot Revision Audit Trail.
Verifies:
1. Model tiering configuration (FAST_MODEL_NAME vs SYNTHESIS_MODEL_NAME).
2. Slot revision tracking preserves prior values and timestamps when symptoms evolve.
3. Empty SOCRATES state includes initialized history audit trail.
4. socrates_matrix preserves history for doctor dashboard visibility.
"""

from app.schemas import SocratesDimensionValue
from app.trees import get_empty_socrates_state, SOCRATES_DIMENSIONS
from app.groq_service import (
    FAST_MODEL_NAME,
    SYNTHESIS_MODEL_NAME,
    extract_socrates_slots,
    build_socrates_matrix
)

def test_tiered_model_configuration():
    """Verify that distinct models are tiered for fast dialogue vs deep synthesis."""
    assert FAST_MODEL_NAME == "llama-3.1-8b-instant", f"Expected fast model llama-3.1-8b-instant, got {FAST_MODEL_NAME}"
    assert SYNTHESIS_MODEL_NAME == "llama-3.3-70b-versatile", f"Expected synthesis model llama-3.3-70b-versatile, got {SYNTHESIS_MODEL_NAME}"
    assert FAST_MODEL_NAME != SYNTHESIS_MODEL_NAME, "Fast and synthesis models should be tiered separately"

def test_empty_socrates_state_has_history():
    """Verify empty SOCRATES state initializes history audit lists on all 8 slots."""
    empty_state = get_empty_socrates_state()
    for dim in SOCRATES_DIMENSIONS:
        assert dim in empty_state
        assert "history" in empty_state[dim], f"Dimension {dim} missing history field"
        assert isinstance(empty_state[dim]["history"], list)
        assert len(empty_state[dim]["history"]) == 0

def test_socrates_dimension_value_schema_with_history():
    """Verify SocratesDimensionValue Pydantic model validates history entries."""
    slot = SocratesDimensionValue(
        value="3/10",
        confidence=0.9,
        status="filled",
        history=[
            {"previous_value": "8/10", "confidence": 0.95, "timestamp": "2026-09-16T10:00:00Z"}
        ]
    )
    assert slot.value == "3/10"
    assert len(slot.history) == 1
    assert slot.history[0]["previous_value"] == "8/10"

def test_slot_revision_tracking_on_symptom_evolution():
    """
    Simulate symptom evolution:
    Turn 1: Patient reports initial severity of 9/10.
    Turn 2: After resting, patient reports pain eased to 3/10.
    Verify that current value is 3/10 and history contains the 9/10 entry.
    """
    initial_res = extract_socrates_slots(
        chief_complaint="Severe crushing chest pain, 9 out of 10",
        history=[],
        current_state=get_empty_socrates_state()
    )
    state_turn1 = initial_res["socrates"]
    assert "9" in state_turn1["severity"]["value"]
    assert len(state_turn1["severity"]["history"]) == 0

    # Turn 2: Patient reports symptom revision
    updated_res = extract_socrates_slots(
        chief_complaint="Severe crushing chest pain",
        history=[
            {"question": "How severe is the pain?", "answer": "9 out of 10"},
            {"question": "How is it feeling now after sitting down?", "answer": "It has noticeably eased, now 3 out of 10"}
        ],
        current_state=state_turn1,
        latest_input="It has noticeably eased, now 3 out of 10"
    )
    state_turn2 = updated_res["socrates"]

    # Verify new value is 3/10
    assert "3" in state_turn2["severity"]["value"], f"Expected 3 in value, got {state_turn2['severity']['value']}"

    # Verify audit trail archived the previous 9/10 value
    history = state_turn2["severity"]["history"]
    assert len(history) >= 1, f"Expected at least 1 history revision entry, got {history}"
    assert "9" in history[0]["previous_value"], f"Prior value not archived correctly: {history[0]}"
    assert "timestamp" in history[0]

def test_build_socrates_matrix_preserves_revision_history():
    """Verify that build_socrates_matrix includes revision history in the output matrix."""
    soc_state = get_empty_socrates_state()
    soc_state["severity"] = {
        "value": "3/10 Numeric Pain Rating",
        "confidence": 0.95,
        "source": "interview",
        "status": "filled",
        "history": [
            {"previous_value": "9/10 Numeric Pain Rating", "confidence": 0.95, "timestamp": "2026-09-16T10:00:00Z"}
        ]
    }

    matrix = build_socrates_matrix(
        socrates_state=soc_state,
        interview_responses=[],
        documents=[]
    )

    sev_cell = matrix["severity"]
    assert "history" in sev_cell
    assert len(sev_cell["history"]) == 1
    assert "9/10" in sev_cell["history"][0]["previous_value"]
