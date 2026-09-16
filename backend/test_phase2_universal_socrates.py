"""
Unit tests for Phase 2: Universal 8-Dimension SOCRATES Protocol & Atypical ACS Routing.
Verifies that:
1. The 'default' tree covers all 8 canonical SOCRATES dimensions.
2. Every question in the 'default' tree adheres to the DecisionTreeQuestion schema.
3. Atypical Acute Coronary Syndrome (ACS) presentations are correctly routed to 'chest_pain'.
4. Other non-chest complaints (abdominal, migraine, trauma) route to the universal 'default' tree.
5. Priority Slot Resolver dynamically skips filled slots in the 'default' tree.
"""

from app.schemas import DecisionTreeQuestion
from app.trees import (
    DECISION_TREES,
    SOCRATES_DIMENSIONS,
    get_tree_key,
    get_tree_questions,
    get_empty_socrates_state,
    select_next_question
)

def test_default_tree_full_socrates_coverage():
    """Verify that the universal 'default' tree explicitly covers all 8 canonical SOCRATES dimensions."""
    default_tree = DECISION_TREES["default"]
    assert len(default_tree) == 8, f"Expected 8 questions in default tree, found {len(default_tree)}"

    covered_dims = set()
    for q in default_tree:
        validated = DecisionTreeQuestion(**q)
        assert validated.id is not None
        assert len(validated.question) > 0
        assert validated.fallback_question is not None and len(validated.fallback_question) > 0
        assert validated.socrates_dimension in SOCRATES_DIMENSIONS
        covered_dims.add(validated.socrates_dimension)

    for dim in SOCRATES_DIMENSIONS:
        assert dim in covered_dims, f"Default universal tree missing dimension: {dim}"

def test_atypical_cardiac_routing():
    """Verify that atypical ACS presentations (jaw+arm, epigastric+sweat, dyspnea+sweat) route to 'chest_pain'."""
    # Atypical 1: Epigastric distress with cold sweats (common in diabetic/female ACS)
    assert get_tree_key("Severe epigastric burning and breaking out in cold sweats") == "chest_pain"

    # Atypical 2: Jaw tightness radiating down to left arm
    assert get_tree_key("Jaw tightness and pain radiating to left arm") == "chest_pain"

    # Atypical 3: Sudden breathlessness with diaphoresis
    assert get_tree_key("Sudden shortness of breath and diaphoresis") == "chest_pain"

    # Atypical 4: Left arm numbness with dyspnea
    assert get_tree_key("Left arm numb and trouble breathing") == "chest_pain"

def test_non_cardiac_complaints_route_to_universal_default():
    """Verify that general acute pain/symptom complaints route to the universal 'default' tree."""
    assert get_tree_key("Abdominal cramps and stomach discomfort") == "default"
    assert get_tree_key("Severe throbbing migraine headache") == "default"
    assert get_tree_key("Right flank pain and back spasm") == "default"
    assert get_tree_key("Knee pain and joint swelling after marathon") == "default"

def test_standard_fever_and_cough_routing():
    """Verify fever and cough complaints still map to their specialized trees."""
    assert get_tree_key("High fever with chills and shivering") == "fever"
    assert get_tree_key("Continuous dry cough with throat pain") == "cough"

def test_priority_slot_resolver_on_universal_default():
    """
    Verify that when a patient with abdominal pain already shares Site and Severity,
    the Priority Slot Resolver skips those and presents the highest priority unfilled slot.
    """
    socrates_state = get_empty_socrates_state()
    # Patient reported site (stomach) and severity (7/10)
    socrates_state["site"] = {"value": "Lower right abdomen", "confidence": 0.9, "status": "filled"}
    socrates_state["severity"] = {"value": "7/10", "confidence": 0.9, "status": "filled"}

    default_questions = get_tree_questions("default")
    next_q = select_next_question(
        tree_key="default",
        tree_questions=default_questions,
        socrates_state=socrates_state,
        answered_ids=[]
    )

    assert next_q is not None
    # Site (prio 1) was filled -> next highest priority is Onset (prio 2)
    assert next_q["socrates_dimension"] == "onset"
    assert next_q["id"] == "gen_onset"
