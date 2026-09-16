"""
Unit tests for Phase 1: Clinical Domain & Protocol Definitions
Verifies formal 8-slot SOCRATES schema, metadata, trees, and fallback questions.
"""


from app.schemas import (
    SocratesDimensionValue,
    SocratesProfile,
    DecisionTreeQuestion
)
from app.trees import (
    SOCRATES_DIMENSIONS,
    SOCRATES_METADATA,
    SOCRATES_FALLBACK_QUESTIONS,
    DECISION_TREES,
    get_empty_socrates_state,
    normalize_dimension,
    get_dimension_metadata,
    get_fallback_question,
    get_tree_key,
    get_tree_questions
)

def test_socrates_dimensions_coverage():
    """Verify that all 8 canonical dimensions are present."""
    expected_8 = ["site", "onset", "character", "radiation", "associated", "timing", "exacerbating", "severity"]
    assert SOCRATES_DIMENSIONS == expected_8
    assert len(SOCRATES_DIMENSIONS) == 8

def test_empty_socrates_state():
    """Verify empty state initialization for all 8 slots."""
    empty_state = get_empty_socrates_state()
    assert len(empty_state) == 8
    for dim in SOCRATES_DIMENSIONS:
        assert dim in empty_state
        assert empty_state[dim]["value"] is None
        assert empty_state[dim]["confidence"] == 0.0
        assert empty_state[dim]["source"] == "interview"
        assert empty_state[dim]["status"] == "unfilled"

def test_socrates_metadata():
    """Verify clinical domain metadata for each of the 8 dimensions."""
    for dim in SOCRATES_DIMENSIONS:
        meta = get_dimension_metadata(dim)
        assert meta is not None, f"Missing metadata for dimension: {dim}"
        assert "name" in meta
        assert "clinical_definition" in meta
        assert "key_entities" in meta
        assert len(meta["key_entities"]) > 0
        assert "priority" in meta

    # Test alias support
    exac_meta = get_dimension_metadata("exacerbating_relieving")
    assert exac_meta is not None
    assert exac_meta["dimension"] == "exacerbating"

def test_socrates_fallback_questions():
    """Verify fallback questions for all dimensions."""
    for dim in SOCRATES_DIMENSIONS:
        q = get_fallback_question(dim)
        assert isinstance(q, str) and len(q) > 10, f"Invalid fallback question for {dim}"

def test_decision_trees_have_dimensions_and_fallbacks():
    """Verify all decision trees have socrates_dimension and fallback_question for every node."""
    for tree_name, questions in DECISION_TREES.items():
        assert len(questions) > 0, f"Tree '{tree_name}' has no questions"
        for q in questions:
            # Validate schema
            validated = DecisionTreeQuestion(**q)
            assert validated.id is not None
            assert len(validated.question) > 0
            assert validated.fallback_question is not None and len(validated.fallback_question) > 0
            assert validated.socrates_dimension is not None, f"Question {q['id']} in {tree_name} lacks socrates_dimension"
            assert validated.socrates_dimension in SOCRATES_DIMENSIONS

def test_chest_pain_tree_socrates_coverage():
    """Verify chest_pain decision tree explicitly covers all 8 SOCRATES dimensions."""
    cp_tree = DECISION_TREES["chest_pain"]
    covered_dims = [q["socrates_dimension"] for q in cp_tree]
    for dim in SOCRATES_DIMENSIONS:
        assert dim in covered_dims, f"Chest pain tree misses SOCRATES dimension '{dim}'"

def test_socrates_profile_pydantic_model():
    """Verify SocratesProfile schema with validations, aliases, and helper methods."""
    profile = SocratesProfile(
        site=SocratesDimensionValue(value="Retrosternal", confidence=0.9, status="filled"),
        character=SocratesDimensionValue(value="Crushing", confidence=0.95, status="filled"),
        exacerbating_relieving=SocratesDimensionValue(value="Worse on exertion", confidence=0.9, status="filled")
    )

    # Verify alias synchronization
    assert profile.exacerbating is not None
    assert profile.exacerbating.value == "Worse on exertion"
    assert profile.exacerbating_relieving.value == "Worse on exertion"

    # Verify helper methods
    filled = profile.get_filled_dimensions()
    assert "site" in filled
    assert "character" in filled
    assert "exacerbating" in filled
    assert "onset" not in filled

    unfilled = profile.get_unfilled_dimensions()
    assert "onset" in unfilled
    assert "radiation" in unfilled
    assert "associated" in unfilled
    assert "timing" in unfilled
    assert "severity" in unfilled
    assert "site" not in unfilled

    # Verify dictionary export
    d = profile.to_dict()
    assert d["site"]["value"] == "Retrosternal"
    assert d["onset"] is None
    assert d["exacerbating"]["value"] == "Worse on exertion"

def test_get_tree_key_routing():
    """Verify chief complaint routing correctly maps to chest_pain, fever, cough, or default."""
    assert get_tree_key("Severe chest pain radiating to left jaw") == "chest_pain"
    assert get_tree_key("High fever with chills") == "fever"
    assert get_tree_key("Dry cough for 3 days") == "cough"
    assert get_tree_key("Knee pain after running") == "default"
    assert get_tree_key("Abdominal cramps") == "default"

if __name__ == "__main__":
    test_socrates_dimensions_coverage()
    test_empty_socrates_state()
    test_socrates_metadata()
    test_socrates_fallback_questions()
    test_decision_trees_have_dimensions_and_fallbacks()
    test_chest_pain_tree_socrates_coverage()
    test_socrates_profile_pydantic_model()
    test_get_tree_key_routing()
    print("All Phase 1 SOCRATES unit tests passed successfully!")
