"""
Predefined Clinical Decision Trees & SOCRATES Domain Protocols for MediKiosk
Chief Complaints supported: Chest Pain, Fever, Cough (and fallback General)
"""

from typing import Dict, Any, List, Optional
import re

# Canonical 8 Dimensions of the SOCRATES Clinical Protocol
SOCRATES_DIMENSIONS: List[str] = [
    "site",
    "onset",
    "character",
    "radiation",
    "associated",
    "timing",
    "exacerbating",
    "severity"
]

# Alias dictionary to support clinical synonyms seamlessly
SOCRATES_DIMENSION_ALIASES: Dict[str, str] = {
    "exacerbating_relieving": "exacerbating",
    "aggravating": "exacerbating",
    "relieving": "exacerbating",
    "exacerbating_factors": "exacerbating",
    "associated_symptoms": "associated",
}

# Detailed Clinical Domain Metadata for the 8 SOCRATES Dimensions
SOCRATES_METADATA: Dict[str, Dict[str, Any]] = {
    "site": {
        "dimension": "site",
        "name": "Site",
        "clinical_definition": "Anatomical location of the pain or symptom (e.g. retrosternal, lateral, epigastric).",
        "key_entities": ["retrosternal", "substernal", "precordial", "left-sided chest", "epigastric", "diffuse"],
        "priority": 1
    },
    "onset": {
        "dimension": "onset",
        "name": "Onset",
        "clinical_definition": "Speed of onset (sudden vs. gradual) and triggering activity.",
        "key_entities": ["sudden acute onset", "gradual onset", "at rest", "during physical exertion", "postprandial"],
        "priority": 2
    },
    "character": {
        "dimension": "character",
        "name": "Character",
        "clinical_definition": "Sensory nature and quality of the pain (e.g. crushing, pressure, sharp, burning, aching).",
        "key_entities": ["crushing", "heavy pressure", "squeezing tightness", "sharp / pleuritic", "burning / acid reflux", "dull ache"],
        "priority": 3
    },
    "radiation": {
        "dimension": "radiation",
        "name": "Radiation",
        "clinical_definition": "Spread or radiation pathway (e.g. left arm, neck, jaw, epigastrium, back).",
        "key_entities": ["radiates to left arm", "radiates to neck / jaw", "radiates to interscapular back", "radiates to epigastrium", "localized / no radiation"],
        "priority": 4
    },
    "associated": {
        "dimension": "associated",
        "name": "Associated Symptoms",
        "clinical_definition": "Autonomic and co-occurring clinical signs (e.g. diaphoresis, dyspnea, nausea, palpitations, presyncope).",
        "key_entities": ["diaphoresis (cold sweats)", "dyspnea (shortness of breath)", "nausea / vomiting", "palpitations", "dizziness / presyncope"],
        "priority": 5
    },
    "timing": {
        "dimension": "timing",
        "name": "Timing",
        "clinical_definition": "Temporal pattern, constancy, and duration of episodes (e.g. constant vs. episodic).",
        "key_entities": ["constant / unremitting", "episodic in waves", "crescendo-decrescendo", "intermittent"],
        "priority": 6
    },
    "exacerbating": {
        "dimension": "exacerbating",
        "name": "Exacerbating / Relieving Factors",
        "clinical_definition": "Aggravating or alleviating factors (e.g. exertion, respiration, rest, antacids, posture).",
        "alias": "exacerbating_relieving",
        "key_entities": ["aggravated by exertion", "worse on deep inspiration / coughing", "relieved by rest", "relieved by sublingual nitrates", "relieved by antacids", "postural variation"],
        "priority": 7
    },
    "severity": {
        "dimension": "severity",
        "name": "Severity",
        "clinical_definition": "Pain intensity quantified on a 0–10 numeric rating scale (NRS).",
        "key_entities": ["0-10 numeric rating scale", "mild (1-3)", "moderate (4-6)", "severe (7-10)", "unbearable"],
        "priority": 8
    }
}

# Standalone Fallback Clarification Questions per SOCRATES Dimension
SOCRATES_FALLBACK_QUESTIONS: Dict[str, str] = {
    "site": "Where exactly in your chest or body is the pain located? Could you point to or describe the exact spot?",
    "onset": "Did the discomfort start suddenly in an instant, or did it build up gradually over hours or days?",
    "character": "Can you describe what the pain feels like—is it crushing pressure, a sharp stabbing ache, or a burning feeling?",
    "radiation": "Does the pain spread anywhere else, such as to your left arm, jaw, neck, back, or stomach?",
    "associated": "Are you having any other symptoms with this, like cold sweats, shortness of breath, nausea, or lightheadedness?",
    "timing": "Has the pain been steady and constant since it began, or does it come and go in waves?",
    "exacerbating": "Does anything make the pain better or worse, like taking a deep breath, resting quietly, moving, or eating?",
    "severity": "On a scale of 0 to 10, where 0 is no pain and 10 is unbearable pain, how severe is it right now?"
}

def get_empty_socrates_state() -> Dict[str, Dict[str, Any]]:
    """Returns an empty 8-dimension SOCRATES state dictionary with audit history."""
    return {
        dim: {
            "value": None,
            "confidence": 0.0,
            "source": "interview",
            "status": "unfilled",
            "history": []
        }
        for dim in SOCRATES_DIMENSIONS
    }

def normalize_dimension(dim: str) -> str:
    """Resolves dimension name or alias to canonical form."""
    cleaned = dim.lower().strip()
    return SOCRATES_DIMENSION_ALIASES.get(cleaned, cleaned)

def get_dimension_metadata(dim: str) -> Optional[Dict[str, Any]]:
    """Returns clinical domain definition and metadata for a SOCRATES dimension."""
    norm = normalize_dimension(dim)
    return SOCRATES_METADATA.get(norm)

def get_fallback_question(dim: str) -> str:
    """Returns the standardized clinical fallback question for a SOCRATES dimension."""
    norm = normalize_dimension(dim)
    return SOCRATES_FALLBACK_QUESTIONS.get(norm, "Could you describe your symptoms in more detail?")

# Priority Slot Resolver configuration
# For chest pain / ACS triage: Severity and Radiation take high diagnostic priority
CHEST_PAIN_DIMENSION_PRIORITY: Dict[str, int] = {
    "site": 1,
    "character": 2,
    "radiation": 3,
    "severity": 4,
    "associated": 5,
    "onset": 6,
    "exacerbating": 7,
    "timing": 8
}

def is_dimension_filled(dimension_state: Optional[Dict[str, Any]], confidence_threshold: float = 0.7) -> bool:
    """Returns True if the dimension is filled with confidence >= threshold and non-empty value."""
    if not dimension_state or not isinstance(dimension_state, dict):
        return False
    status = dimension_state.get("status")
    conf = float(dimension_state.get("confidence", 0.0))
    val = dimension_state.get("value")
    return status == "filled" and conf >= confidence_threshold and bool(val)

def select_next_question(
    tree_key: str,
    tree_questions: List[Dict[str, Any]],
    socrates_state: Dict[str, Any],
    answered_ids: Optional[List[str]] = None,
    confidence_threshold: float = 0.7
) -> Optional[Dict[str, Any]]:
    """
    Priority Slot Resolver:
    Evaluates socrates_state, filters out dimensions already filled (confidence >= threshold),
    and selects the highest priority unfilled slot question.
    """
    answered_set = set(answered_ids or [])
    candidates = []

    for q in tree_questions:
        q_id = q.get("id")
        dim = q.get("socrates_dimension")
        dim_norm = normalize_dimension(dim) if dim else None
        dim_state = socrates_state.get(dim_norm) if (socrates_state and dim_norm) else None

        if dim and is_dimension_filled(dim_state, confidence_threshold):
            # Slot already answered with high confidence; dynamically skip!
            continue

        if tree_key == "chest_pain" and dim_norm:
            prio = CHEST_PAIN_DIMENSION_PRIORITY.get(dim_norm, q.get("priority", 99))
        else:
            prio = q.get("priority", 99)

        # 1. If already asked, check for one-shot clarification retry on unclear slots
        if q_id in answered_set:
            clarify_id = f"{q_id}_clarify"
            # If the slot remains unclear after initial inquiry and clarification hasn't been asked yet:
            if clarify_id not in answered_set and dim_state and dim_state.get("status") == "unclear":
                clarify_q = dict(q)
                clarify_q["id"] = clarify_id
                clarify_q["question"] = q.get("fallback_question", q.get("question"))
                clarify_q["is_clarification"] = True
                candidates.append((prio + 0.1, clarify_q))
            continue

        candidates.append((prio, q))

    if not candidates:
        return None

    # Sort candidates by clinical priority ascending (1 = highest urgency)
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]

def is_negated(phrase: str, text: str) -> bool:
    """
    Clinical Negation Boundary Checker (NegEx-inspired).
    Detects if a clinical entity or symptom keyword is negated within its clause.
    Respects contrastive conjunctions ('but', 'however', 'yet', 'except') and clause boundaries.
    Examples:
      - "no left arm pain" -> True
      - "denies shortness of breath" -> True
      - "not having shortness of breath or cold sweats" -> True
      - "no pain in arm, but having cold sweats" -> arm: True, cold sweats: False
      - "sweating: none" -> True
      - "radiating to left arm" -> False
    """
    if not phrase or not text:
        return False
    text_lower = text.lower()
    phrase_lower = phrase.lower().strip()

    # Split into clinical sub-clauses bounded by punctuation (period, exclamation, question mark, semicolon) or contrastive conjunctions
    clauses = re.split(r'[.!?;]|\b(?:but|however|yet|except|although)\b', text_lower)
    for clause in clauses:
        clause = clause.strip()
        if not clause:
            continue
        # Check if the target phrase (or its stem) exists in this clause
        if re.search(rf'\b{re.escape(phrase_lower)}\w*\b', clause):
            # Check leading negation trigger in the same clause
            neg_trigger = r'\b(no|not|never|denies|denied|without|negative for|free of|rule out|zero|neither|nor|doesn\'t|does not|didn\'t|did not|isn\'t|is not|wasn\'t|was not|hardly|scarcely)\b'
            lead_pattern = rf'{neg_trigger}[\s\w\',-]*?\b{re.escape(phrase_lower)}\w*\b'
            if re.search(lead_pattern, clause):
                return True

            # Check trailing negation trigger in the same clause (e.g. "left arm: no", "radiation: none/absent")
            neg_suffix = r'\b(no|none|absent|denied|nil|not present)\b'
            trail_pattern = rf'\b{re.escape(phrase_lower)}\w*\b\s*(?::|is|was)?\s*{neg_suffix}'
            if re.search(trail_pattern, clause):
                return True

    return False

def evaluate_cardiac_triage(
    socrates_state: Optional[Dict[str, Any]] = None,
    text_corpus: str = ""
) -> Dict[str, Any]:
    """
    Deterministic Cardiac Red-Flag Circuit Breaker.
    Evaluates acute coronary syndrome (ACS) risk based on SOCRATES entities and narrative text:
    Condition:
      (character in ['crushing', 'heavy', 'pressure'] OR radiation in ['left arm', 'jaw'])
      AND
      (associated contains 'sweating' OR 'shortness of breath' OR severity >= 7)
    """
    socrates = socrates_state or {}
    corpus = (text_corpus or "").lower()

    char_val = (socrates.get("character", {}).get("value") or "").lower()
    rad_val = (socrates.get("radiation", {}).get("value") or "").lower()
    assoc_val = (socrates.get("associated", {}).get("value") or "").lower()
    sev_val = (socrates.get("severity", {}).get("value") or "").lower()

    # 1. Ischemic Character heuristic (check positive, non-negated matches)
    ischemic_keywords = ["crushing", "heavy", "pressure", "squeezing", "tight", "oppressive", "tightness"]
    has_ischemic_char = any(k in char_val and not is_negated(k, char_val) for k in ischemic_keywords) or any(
        k in corpus and not is_negated(k, corpus) for k in ischemic_keywords
    )

    # 2. Cardiac Radiation heuristic (exclude localized / no radiation)
    radiation_keywords = ["left arm", "left shoulder", "jaw", "neck", "mandible", "throat"]
    is_rad_val_negative = any(w in rad_val for w in ["no radiation", "localized", "none", "nowhere", "does not radiate", "doesn't radiate"])
    has_radiation = False
    if not is_rad_val_negative:
        has_radiation = any(k in rad_val and not is_negated(k, rad_val) for k in radiation_keywords) or any(
            k in corpus and not is_negated(k, corpus) for k in radiation_keywords
        )

    # 3. Autonomic Symptoms heuristic (ignore 'deep breath' as dyspnea)
    clean_corpus = re.sub(r'\bdeep\s+breath(?:ing)?\b', '', corpus)
    clean_assoc = re.sub(r'\bdeep\s+breath(?:ing)?\b', '', assoc_val)
    autonomic_keywords = ["sweat", "diaphor", "shortness of breath", "dyspnea", "breathless", "gasping"]
    has_autonomic = any(k in clean_assoc and not is_negated(k, clean_assoc) for k in autonomic_keywords) or any(
        k in clean_corpus and not is_negated(k, clean_corpus) for k in autonomic_keywords
    )

    # 4. Severe Pain heuristic (NRS >= 7 or severe descriptors)
    has_severe = False
    all_sev_text = f"{sev_val} {corpus}"
    if not is_negated("pain", all_sev_text) and not is_negated("severe", all_sev_text):
        ratio_match = re.search(r'\b([0-9]|10)\s*(?:/|\s*out of\s*)\s*10\b', all_sev_text)
        if ratio_match:
            score = int(ratio_match.group(1))
            if score >= 7:
                has_severe = True
        else:
            standalone = re.findall(r'\b(?:score|severity|rating|pain)?\s*(?:is|level)?\s*([7-9]|10)\b', all_sev_text)
            if standalone:
                has_severe = True

        if not has_severe and any(k in all_sev_text and not is_negated(k, all_sev_text) for k in ["severe", "unbearable", "excruciating", "worst pain"]):
            has_severe = True

    # Deterministic ACS Red-Flag Circuit Breaker
    is_red_flag = (has_ischemic_char or has_radiation) and (has_autonomic or has_severe)

    if is_red_flag:
        return {
            "triage_level": "CRITICAL_RED_FLAG",
            "triage_status": "CRITICAL_RED_FLAG",
            "red_flag_alert": True,
            "can_shorten": True,
            "triage_message": (
                "🚨 EMERGENCY RED FLAG: Potential Acute Coronary Syndrome (ACS) detected! "
                "High-risk ischemic presentation (crushing/radiating chest pain + autonomic distress or severe pain >= 7). "
                "Immediate medical staff intervention required!"
            )
        }
    elif has_ischemic_char or has_radiation or has_severe:
        return {
            "triage_level": "ALERT",
            "triage_status": "ALERT",
            "red_flag_alert": False,
            "can_shorten": False,
            "triage_message": "⚠️ Significant cardiac symptom presentation. Priority physician consultation recommended."
        }
    else:
        return {
            "triage_level": "NORMAL",
            "triage_status": "NORMAL",
            "red_flag_alert": False,
            "can_shorten": False,
            "triage_message": None
        }

# Predefined Decision Trees with explicit socrates_dimension tags and fallback questions
DECISION_TREES: Dict[str, List[Dict[str, Any]]] = {
    "chest_pain": [
        {
            "id": "cp_site",
            "question": "Where exactly in your chest is the pain located (e.g., center behind breastbone, left side, or right side)?",
            "fallback_question": "Could you point to or describe where the chest pain feels most intense? Is it in the center of your chest or to one side?",
            "category": "site",
            "socrates_dimension": "site",
            "priority": 1
        },
        {
            "id": "cp_onset",
            "question": "When did the chest pain start, and did it come on suddenly or gradually?",
            "fallback_question": "Did the chest pain begin suddenly in a single moment, or did it build up gradually over hours or days?",
            "category": "onset",
            "socrates_dimension": "onset",
            "priority": 2
        },
        {
            "id": "cp_character",
            "question": "Can you describe the pain? Is it pressure, crushing, sharp, burning, or aching?",
            "fallback_question": "Does it feel like a heavy weight pressing down, a tight band, a sharp poke, or a burning sensation?",
            "category": "character",
            "socrates_dimension": "character",
            "priority": 3
        },
        {
            "id": "cp_radiation",
            "question": "Does the pain travel or radiate anywhere else, like your left arm, jaw, neck, or back?",
            "fallback_question": "Do you feel any spread of the discomfort into your left arm, shoulder, up into your jaw or teeth, or through to your back?",
            "category": "radiation",
            "socrates_dimension": "radiation",
            "priority": 4
        },
        {
            "id": "cp_associated",
            "question": "Are you experiencing any shortness of breath, sweating, nausea, dizziness, or palpitations?",
            "fallback_question": "Besides the chest pain, are you having cold sweats, trouble catching your breath, sick stomach, or feeling dizzy?",
            "category": "associated_symptoms",
            "socrates_dimension": "associated",
            "priority": 5
        },
        {
            "id": "cp_timing",
            "question": "Is the pain constant and continuous, or does it come and go in waves or episodes?",
            "fallback_question": "Has the pain been there non-stop since it began, or has it been coming and going in spells?",
            "category": "timing",
            "socrates_dimension": "timing",
            "priority": 6
        },
        {
            "id": "cp_aggravating",
            "question": "Does anything make the pain better or worse (e.g. taking a deep breath, changing positions, resting, or exertion)?",
            "fallback_question": "Does resting quietly ease the chest pain, or does walking, taking a deep breath, or pressing on the chest change it?",
            "category": "aggravating_factors",
            "socrates_dimension": "exacerbating",
            "priority": 7
        },
        {
            "id": "cp_severity",
            "question": "On a scale of 0 to 10 (where 0 is no pain and 10 is unbearable pain), how severe is the pain right now?",
            "fallback_question": "If 0 is completely pain-free and 10 is the worst pain you could imagine, what number would you give it right now?",
            "category": "severity",
            "socrates_dimension": "severity",
            "priority": 8
        }
    ],
    "fever": [
        {
            "id": "fv_duration",
            "question": "How many days have you had a fever, and what was the highest temperature measured?",
            "fallback_question": "When did the fever first begin, and do you know roughly what temperature you reached?",
            "category": "duration_and_grade",
            "socrates_dimension": "onset",
            "priority": 1
        },
        {
            "id": "fv_pattern",
            "question": "Is the fever continuous throughout the day or does it come and go with chills or night sweats?",
            "fallback_question": "Does your body stay hot constantly all day, or does the fever spike up and down with shivers?",
            "category": "pattern",
            "socrates_dimension": "timing",
            "priority": 2
        },
        {
            "id": "fv_associated",
            "question": "Do you have chills, body aches, severe headache, sore throat, or cough?",
            "fallback_question": "Are you feeling other sickness signs like shivering, intense head ache, throat soreness, or general body pain?",
            "category": "associated_symptoms",
            "socrates_dimension": "associated",
            "priority": 3
        },
        {
            "id": "fv_urinary_GI",
            "question": "Have you noticed any urinary burning, abdominal pain, nausea, or diarrhea?",
            "fallback_question": "Any discomfort or stinging when you pee, stomach cramps, vomiting, or loose watery stools?",
            "category": "systemic_review",
            "socrates_dimension": "associated",
            "priority": 4
        },
        {
            "id": "fv_meds",
            "question": "Have you taken any fever-reducing medication (like Paracetamol/Ibuprofen), and did it help?",
            "fallback_question": "Did taking paracetamol or other fever medicine bring your temperature down or make you feel better?",
            "category": "medications",
            "socrates_dimension": "exacerbating",
            "priority": 5
        }
    ],
    "cough": [
        {
            "id": "cg_duration",
            "question": "How long have you had this cough, and is it worse at night or early morning?",
            "fallback_question": "How many days or weeks have you been coughing, and what time of day does it bother you most?",
            "category": "duration",
            "socrates_dimension": "onset",
            "priority": 1
        },
        {
            "id": "cg_type",
            "question": "Is it a dry cough or a wet/productive cough with mucus or phlegm?",
            "fallback_question": "Are you coughing up any phlegm or mucus, or is it a dry, scratchy cough?",
            "category": "cough_type",
            "socrates_dimension": "character",
            "priority": 2
        },
        {
            "id": "cg_phlegm_color",
            "question": "If coughing up phlegm, what color is it (clear, yellow, green, or blood-tinged)?",
            "fallback_question": "What color does the mucus look like—clear, yellowish, green, or have you seen any streaks of blood?",
            "category": "phlegm_details",
            "socrates_dimension": "character",
            "priority": 3
        },
        {
            "id": "cg_breathlessness",
            "question": "Do you experience wheezing, chest tightness, or shortness of breath when coughing?",
            "fallback_question": "Do you struggle to catch your breath, hear a whistling sound when breathing, or feel chest tightness when you cough?",
            "category": "respiratory_distress",
            "socrates_dimension": "associated",
            "priority": 4
        },
        {
            "id": "cg_triggers",
            "question": "Is the cough triggered by dust, cold air, exercise, or lying down flat?",
            "fallback_question": "Does lying down in bed, cold breezes, smoke, or walking cause you to start coughing more?",
            "category": "triggers",
            "socrates_dimension": "exacerbating",
            "priority": 5
        }
    ],
    "default": [
        {
            "id": "gen_site",
            "question": "Where exactly in your body is the pain or discomfort located?",
            "fallback_question": "Could you point to or describe the exact area of your body where you feel the discomfort?",
            "category": "site",
            "socrates_dimension": "site",
            "priority": 1
        },
        {
            "id": "gen_onset",
            "question": "When did this problem start, and did it come on suddenly or gradually?",
            "fallback_question": "Did your symptoms begin suddenly in a moment, or build up gradually over hours or days?",
            "category": "duration_and_onset",
            "socrates_dimension": "onset",
            "priority": 2
        },
        {
            "id": "gen_character",
            "question": "How would you describe what the sensation feels like (e.g., sharp, dull ache, burning, cramping, throbbing)?",
            "fallback_question": "What kind of sensation is it—is it a sharp pain, a dull ache, burning, or throbbing?",
            "category": "character",
            "socrates_dimension": "character",
            "priority": 3
        },
        {
            "id": "gen_severity",
            "question": "On a scale of 0 to 10 (where 0 is no discomfort and 10 is unbearable pain), how severe is it right now?",
            "fallback_question": "On a 0 to 10 scale where 0 is pain-free and 10 is the worst pain imaginable, what number describes your discomfort right now?",
            "category": "severity",
            "socrates_dimension": "severity",
            "priority": 4
        },
        {
            "id": "gen_radiation",
            "question": "Does the discomfort stay in one spot, or does it spread or radiate anywhere else in your body?",
            "fallback_question": "Does the discomfort travel or spread to any other part of your body, or stay strictly in one place?",
            "category": "radiation",
            "socrates_dimension": "radiation",
            "priority": 5
        },
        {
            "id": "gen_associated",
            "question": "Have you noticed any other symptoms, such as fever, sweating, nausea, dizziness, or shortness of breath?",
            "fallback_question": "Along with your main complaint, have you felt feverish, nauseous, lightheaded, or noticed any other symptoms?",
            "category": "associated_symptoms",
            "socrates_dimension": "associated",
            "priority": 6
        },
        {
            "id": "gen_exacerbating",
            "question": "Does anything make the discomfort better or worse (e.g., resting, moving, eating, or changing positions)?",
            "fallback_question": "Have you noticed anything that gives you relief, or does any specific movement or posture make it worse?",
            "category": "exacerbating_relieving",
            "socrates_dimension": "exacerbating",
            "priority": 7
        },
        {
            "id": "gen_timing",
            "question": "Is the discomfort continuous and constant, or does it come and go in waves or episodes?",
            "fallback_question": "Has the feeling been steady non-stop since it began, or has it been coming and going intermittently?",
            "category": "timing",
            "socrates_dimension": "timing",
            "priority": 8
        }
    ]
}

def get_tree_key(chief_complaint: str) -> str:
    """
    Maps free-text chief complaint to appropriate clinical decision tree.
    Recognizes direct cardiac keywords, atypical ischemic ACS equivalents (diabetics/elderly/women),
    fever, and cough, defaulting to the universal 8-dimension SOCRATES protocol.
    """
    complaint_lower = chief_complaint.lower()

    # 1. Direct Cardiac / Chest Keywords
    cardiac_direct = any(w in complaint_lower for w in [
        "chest", "heart", "cardiac", "angina", "sternum", "retrosternal",
        "substernal", "precordial", "myocardial"
    ])

    # 2. Atypical Acute Coronary Syndrome (ACS) equivalents (diabetics, elderly, women)
    has_jaw = any(w in complaint_lower for w in ["jaw", "mandible", "neck", "throat"])
    has_arm = any(w in complaint_lower for w in ["left arm", "arm pain", "left shoulder", "arm numb"])
    has_sweat = any(w in complaint_lower for w in ["sweat", "diaphor", "cold sweat"])
    has_dyspnea = any(w in complaint_lower for w in ["shortness of breath", "breathless", "dyspnea", "gasping", "trouble breathing", "suffocat"])
    has_epigastric = any(w in complaint_lower for w in ["epigastric", "upper stomach", "stomach burning", "indigestion", "heartburn"])

    atypical_cardiac = (
        (has_jaw and has_arm) or
        (has_epigastric and (has_sweat or has_dyspnea)) or
        (has_arm and (has_sweat or has_dyspnea)) or
        (has_dyspnea and has_sweat)
    )

    if cardiac_direct or atypical_cardiac:
        return "chest_pain"
    elif any(w in complaint_lower for w in ["fever", "temp", "chills", "pyrexia", "high body heat", "shivering"]):
        return "fever"
    elif any(w in complaint_lower for w in ["cough", "cold", "throat", "phlegm", "sputum", "wheez"]):
        return "cough"

    # Universal 8-Dimension SOCRATES Protocol for all other complaints (abdominal, migraine, trauma, musculoskeletal)
    return "default"

def get_tree_questions(tree_key: str) -> List[Dict[str, Any]]:
    """Returns list of question dictionaries for the given tree key."""
    return DECISION_TREES.get(tree_key, DECISION_TREES["default"])
