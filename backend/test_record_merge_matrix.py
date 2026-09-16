import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.groq_service import (
    merge_record_and_flag,
    detect_document_contradictions,
    build_socrates_matrix
)
from app.trees import SOCRATES_DIMENSIONS

def test_detect_contradictions():
    print("--- Test 1: Contradiction Detection ---")
    
    # Patient denies prior cardiac history verbally
    interview_responses = [
        {"question": "Do you have any past heart conditions?", "answer": "No, never had any heart disease or chest pain before, this is the first time."},
        {"question": "Are you taking regular medications?", "answer": "I don't take any pills or medicines."}
    ]
    
    documents = [
        {
            "filename": "discharge_summary_2025.pdf",
            "extracted_json": {
                "diagnoses": ["Coronary Artery Disease", "Previous NSTEMI"],
                "medications": [{"name": "Isosorbide Mononitrate 30mg"}, {"name": "Aspirin 75mg"}]
            }
        }
    ]
    
    contradictions = detect_document_contradictions(
        interview_responses=interview_responses,
        documents=documents,
        chief_complaint="Chest pain"
    )
    
    print(f"Detected {len(contradictions)} contradictions:")
    for c in contradictions:
        print(f"  • {c}")
    
    assert len(contradictions) >= 2, f"Expected at least 2 contradictions, got {len(contradictions)}"
    assert any("Coronary Artery Disease" in c or "NSTEMI" in c for c in contradictions)
    assert any("Isosorbide" in c or "Aspirin" in c for c in contradictions)
    print("✓ Contradiction detection passed!")

def test_build_socrates_matrix_full_dimensions():
    print("\n--- Test 2: Build SOCRATES Matrix (All 8 Dimensions) ---")
    
    socrates_state = {
        "site": {"value": "Substernal center of chest", "confidence": 0.95, "source": "interview"},
        "onset": {"value": "2 hours ago, sudden onset", "confidence": 0.90, "source": "interview"},
        "character": {"value": "Crushing heavy tightness", "confidence": 0.92, "source": "interview"},
        "radiation": {"value": "Radiates down left arm and into jaw", "confidence": 0.88, "source": "interview"},
        "associated": {"value": "Profuse cold sweating and shortness of breath", "confidence": 0.95, "source": "interview"},
        "timing": {"value": "Constant, unremitting", "confidence": 0.85, "source": "interview"},
        "exacerbating": {"value": "Worse on exertion, no relief with rest", "confidence": 0.80, "source": "interview"},
        "severity": {"value": "9/10 severe pain", "confidence": 1.0, "source": "interview"}
    }
    
    matrix = build_socrates_matrix(
        socrates_state=socrates_state,
        interview_responses=[],
        documents=[]
    )
    
    assert len(matrix) == 8, f"Expected 8 dimensions, got {len(matrix)}"
    for dim in SOCRATES_DIMENSIONS:
        assert dim in matrix, f"Missing dimension {dim}"
        cell = matrix[dim]
        assert "dimension" in cell
        assert "label" in cell
        assert "value" in cell
        assert "status" in cell
        assert "source" in cell
        assert "source_icon" in cell
        assert "source_details" in cell
        assert "confidence" in cell
        assert cell["confidence"] > 0.0
    
    # Verify Red-Flag Alert tagging on acute presentation
    assert matrix["character"]["status"] == "alert", f"Expected alert for crushing character, got {matrix['character']['status']}"
    assert matrix["radiation"]["status"] == "alert", f"Expected alert for left arm radiation, got {matrix['radiation']['status']}"
    assert matrix["associated"]["status"] == "alert", f"Expected alert for sweating/shortness of breath, got {matrix['associated']['status']}"
    assert matrix["severity"]["status"] == "alert", f"Expected alert for 9/10 severity, got {matrix['severity']['status']}"
    
    print("✓ 8-cell SOCRATES matrix built and alert tags validated!")

def test_merge_record_and_flag_synthesis():
    print("\n--- Test 3: merge_record_and_flag integration ---")
    
    socrates_state = {
        "site": {"value": "Center of chest", "confidence": 0.9, "source": "interview"},
        "severity": {"value": "8/10", "confidence": 0.95, "source": "interview"}
    }
    
    interview_responses = [
        {"question": "Where is the pain?", "answer": "Right in the center of my chest"},
        {"question": "How severe is it?", "answer": "About 8 out of 10"},
        {"question": "Any other medical problems in the past?", "answer": "No past cardiac history at all, never had heart trouble."}
    ]
    
    documents = [
        {
            "filename": "old_prescription.pdf",
            "extracted_json": {
                "medications": [{"name": "Nitroglycerin sublingual"}],
                "diagnoses": ["Angina Pectoris"]
            }
        }
    ]
    
    result = merge_record_and_flag(
        chief_complaint="Chest pain",
        patient_name="Ramesh Sharma",
        patient_language="English",
        interview_responses=interview_responses,
        documents=documents,
        socrates_state=socrates_state
    )
    
    assert "socrates_matrix" in result, "Missing socrates_matrix in result"
    assert len(result["socrates_matrix"]) == 8, f"Expected 8 dimensions in matrix, got {len(result['socrates_matrix'])}"
    assert "contradiction_flags" in result, "Missing contradiction_flags in result"
    assert len(result["contradiction_flags"]) > 0, "Expected contradiction flag between interview and doc"
    assert "attention_flags" in result, "Missing attention_flags in result"
    
    # Check that severity 8/10 is alert
    assert result["socrates_matrix"]["severity"]["status"] == "alert"
    assert result["socrates_matrix"]["site"]["source_icon"] in ["🎤", "🎤 📄"]
    
    print("✓ merge_record_and_flag integration test passed successfully!")

if __name__ == "__main__":
    test_detect_contradictions()
    test_build_socrates_matrix_full_dimensions()
    test_merge_record_and_flag_synthesis()
    print("\n>>> ALL PHASE 4 BACKEND TESTS PASSED SUCCESSFULLY! <<<")
