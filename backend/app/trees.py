"""
Predefined Decision Trees for MediKiosk
Chief Complaints supported: Chest Pain, Fever, Cough (and fallback General)
"""

DECISION_TREES = {
    "chest_pain": [
        {
            "id": "cp_onset",
            "question": "When did the chest pain start, and did it come on suddenly or gradually?",
            "category": "onset"
        },
        {
            "id": "cp_character",
            "question": "Can you describe the pain? Is it pressure, crushing, sharp, burning, or aching?",
            "category": "character"
        },
        {
            "id": "cp_radiation",
            "question": "Does the pain travel or radiate anywhere else, like your left arm, jaw, neck, or back?",
            "category": "radiation"
        },
        {
            "id": "cp_associated",
            "question": "Are you experiencing any shortness of breath, sweating, nausea, dizziness, or palpitations?",
            "category": "associated_symptoms"
        },
        {
            "id": "cp_aggravating",
            "question": "Does anything make the pain better or worse (e.g. taking a deep breath, changing positions, resting)?",
            "category": "aggravating_factors"
        }
    ],
    "fever": [
        {
            "id": "fv_duration",
            "question": "How many days have you had a fever, and what was the highest temperature measured?",
            "category": "duration_and_grade"
        },
        {
            "id": "fv_pattern",
            "question": "Is the fever continuous throughout the day or does it come and go with chills or night sweats?",
            "category": "pattern"
        },
        {
            "id": "fv_associated",
            "question": "Do you have chills, body aches, severe headache, sore throat, or cough?",
            "category": "associated_symptoms"
        },
        {
            "id": "fv_urinary_GI",
            "question": "Have you noticed any urinary burning, abdominal pain, nausea, or diarrhea?",
            "category": "systemic_review"
        },
        {
            "id": "fv_meds",
            "question": "Have you taken any fever-reducing medication (like Paracetamol/Ibuprofen), and did it help?",
            "category": "medications"
        }
    ],
    "cough": [
        {
            "id": "cg_duration",
            "question": "How long have you had this cough, and is it worse at night or early morning?",
            "category": "duration"
        },
        {
            "id": "cg_type",
            "question": "Is it a dry cough or a wet/productive cough with mucus or phlegm?",
            "category": "cough_type"
        },
        {
            "id": "cg_phlegm_color",
            "question": "If coughing up phlegm, what color is it (clear, yellow, green, or blood-tinged)?",
            "category": "phlegm_details"
        },
        {
            "id": "cg_breathlessness",
            "question": "Do you experience wheezing, chest tightness, or shortness of breath when coughing?",
            "category": "respiratory_distress"
        },
        {
            "id": "cg_triggers",
            "question": "Is the cough triggered by dust, cold air, exercise, or lying down flat?",
            "category": "triggers"
        }
    ],
    "default": [
        {
            "id": "gen_duration",
            "question": "How long have you been experiencing these symptoms?",
            "category": "duration"
        },
        {
            "id": "gen_severity",
            "question": "On a scale of 1 to 10, how severe are your symptoms right now?",
            "category": "severity"
        },
        {
            "id": "gen_associated",
            "question": "Have you noticed any other symptoms like fever, fatigue, nausea, or pain?",
            "category": "associated_symptoms"
        },
        {
            "id": "gen_prior_history",
            "question": "Have you had similar symptoms in the past, or do you have any chronic medical conditions?",
            "category": "medical_history"
        }
    ]
}

def get_tree_key(chief_complaint: str) -> str:
    complaint_lower = chief_complaint.lower()
    
    # Require specific cardiac/chest keywords (MUST NOT trigger on generic 'pain' alone like 'knee pain')
    if "chest" in complaint_lower or "heart" in complaint_lower or "cardiac" in complaint_lower or "angina" in complaint_lower or "sternum" in complaint_lower:
        return "chest_pain"
    elif "fever" in complaint_lower or "temp" in complaint_lower or "chills" in complaint_lower or "pyrexia" in complaint_lower:
        return "fever"
    elif "cough" in complaint_lower or "cold" in complaint_lower or "throat" in complaint_lower or "phlegm" in complaint_lower or "sputum" in complaint_lower:
        return "cough"
    
    # Fallback to General for all unmapped complaints
    return "default"
