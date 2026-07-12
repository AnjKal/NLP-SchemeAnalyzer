import json
import logging
import os
import re

import boto3
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

logger = logging.getLogger('eligibility')

BEDROCK_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"

# ---------------------------------------------------------------------------
# Scheme details lookup (Application Process / Documents Required)
# ---------------------------------------------------------------------------
# These aren't stored in Neo4j. Instead we load them from a JSON file that
# maps scheme name -> {applicationProcess, documentsRequired}. Matching is
# case-insensitive on the scheme name. Missing/unmatched schemes simply get
# empty strings, which the frontend already handles gracefully.
SCHEME_DETAILS_PATH = os.path.join(os.path.dirname(__file__), 'scheme_details.json')


def _normalize_scheme_name(name: str) -> str:
    """Lowercase, collapse all whitespace (incl. non-breaking spaces/tabs/
    newlines) to single spaces, and strip. Makes lookups resilient to
    formatting differences between how a name was typed in the PDF/Neo4j
    vs. the JSON file."""
    n = (name or '').replace('\xa0', ' ')
    n = re.sub(r'\s+', ' ', n).strip().lower()
    return n


def _load_scheme_details() -> dict:
    """Load the JSON lookup of documentsRequired/applicationProcess per
    scheme name (normalized, case-insensitive key match). Returns {} on any
    failure so a missing/corrupt file never breaks eligibility checks."""
    try:
        with open(SCHEME_DETAILS_PATH, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        normalized = {_normalize_scheme_name(k): v for k, v in raw.items()}
        logger.info(
            "Loaded scheme_details.json — %d entries: %s",
            len(normalized), list(normalized.keys())
        )
        return normalized
    except Exception as exc:
        logger.warning("Could not load scheme_details.json (path=%s): %s", SCHEME_DETAILS_PATH, exc)
        return {}


_SCHEME_DETAILS = _load_scheme_details()


def _get_scheme_details(scheme_name: str) -> dict:
    """Look up documentsRequired/applicationProcess for a scheme name coming
    back from Neo4j. Tries an exact normalized match first; if that fails,
    falls back to a substring match in either direction (handles cases like
    'PM Kisan Samman Nidhi' vs 'PM Kisan Samman Nidhi Yojana')."""
    key = _normalize_scheme_name(scheme_name)

    if key in _SCHEME_DETAILS:
        return _SCHEME_DETAILS[key]

    for stored_key, details in _SCHEME_DETAILS.items():
        if stored_key in key or key in stored_key:
            logger.info(
                "Scheme details fuzzy-matched — neo4j name=%r ~ json key=%r",
                scheme_name, stored_key
            )
            return details

    logger.warning(
        "No scheme_details match for %r (normalized=%r). Known keys: %s",
        scheme_name, key, list(_SCHEME_DETAILS.keys())
    )
    return {}


# ---------------------------------------------------------------------------
# Occupation-based hard filtering
# ---------------------------------------------------------------------------
# Some schemes are only meaningful for a specific occupation/life-status
# (e.g. "Widow"). These are detected by keyword match against the scheme's
# name/category coming back from Neo4j.
#
# Rule:
#   1. If a scheme's name/category matches one of these keyword groups, the
#      scheme is "occupation-restricted" to that group. It will ONLY be
#      returned for citizens whose typed Occupation matches that group.
#   2. If a citizen's Occupation matches one of these groups (e.g. types
#      "Widow"), then ONLY schemes restricted to that group are returned —
#      every generic/unrestricted scheme is excluded too, since it does not
#      apply to that occupation.
OCCUPATION_KEYWORDS = {
    'widow': ['widow', 'vidhava', 'vidhwa'],
    # Add more exclusive occupation groups here as needed, e.g.:
    # 'differently abled': ['divyang', 'disability', 'handicap'],
}


_TMP_NAME_RE = re.compile(r'^tmp[a-z0-9]{5,}$', re.IGNORECASE)


def _is_junk_scheme_name(name: str) -> bool:
    """True for placeholder/garbage scheme names that should never be
    surfaced to the user (e.g. 'NOT_FOUND', 'Unknown Scheme', or an
    auto-generated temp id like 'tmppskhmx84')."""
    n = (name or '').strip()
    if not n:
        return True
    if n.upper() in ('NOT_FOUND', 'UNKNOWN', 'UNKNOWN SCHEME', 'NULL', 'NONE'):
        return True
    if _TMP_NAME_RE.match(n):
        return True
    return False


def _matching_occupation_group(occupation: str):
    """Return the keyword-group key (e.g. 'widow') if the citizen's typed
    occupation matches one of the exclusive OCCUPATION_KEYWORDS groups,
    else None."""
    occupation = (occupation or '').strip().lower()
    if not occupation:
        return None
    for group_key, keywords in OCCUPATION_KEYWORDS.items():
        if any(kw in occupation for kw in keywords):
            return group_key
    return None


def _scheme_occupation_groups(scheme: dict) -> set:
    """Return the set of occupation-group keys this scheme is restricted to,
    based on its name/category text. Empty set = not occupation-restricted."""
    name_lower = (scheme.get('name') or '').lower()
    cat_lower = (scheme.get('category') or '').lower()
    groups = set()
    for group_key, keywords in OCCUPATION_KEYWORDS.items():
        if any(kw in name_lower or kw in cat_lower for kw in keywords):
            groups.add(group_key)
    return groups


def _occupation_allows_scheme(occupation_group, scheme_groups: set) -> bool:
    """Decide whether a scheme should even be considered/returned for this
    citizen, based purely on occupation restriction rules."""
    if scheme_groups:
        # Scheme is restricted to specific occupation(s) — only show if the
        # citizen's occupation matches one of them.
        return occupation_group in scheme_groups
    if occupation_group:
        # Citizen's occupation is an exclusive type (e.g. Widow) but this
        # scheme carries no occupation tag at all — not applicable.
        return False
    return True


GENDER_NAME_KEYWORDS = {
    'female': [
        'shaadi bhagya', 'shadi bhagya', 'marriage assistance', 'marriage scheme',
        'vivah sahayata', 'vivah yojana', 'kanyadan', 'kanya vivah', 'bridal assistance',
        'kanya', 'mahila', 'women', 'girl child', 'beti',
    ],
    # Add male-specific name keywords here if such schemes exist.
    'male': [],
}


def _scheme_effective_gender(scheme: dict) -> str:
    """Return 'male'/'female' if the scheme should be treated as
    gender-restricted, else '' (unrestricted). Prefers the explicit graph
    'gender' field; falls back to name/category keyword matching (e.g.
    'Shaadi Bhagya', 'Marriage Assistance') for schemes that are
    conceptually gender-restricted but not tagged as such in Neo4j."""
    raw = (scheme.get('gender') or '').strip().lower()
    if raw in ('male', 'female'):
        return raw
    name_lower = (scheme.get('name') or '').lower()
    cat_lower = (scheme.get('category') or '').lower()
    for g, keywords in GENDER_NAME_KEYWORDS.items():
        if any(kw in name_lower or kw in cat_lower for kw in keywords):
            return g
    return ''


def _gender_allows_scheme(citizen_gender: str, scheme_gender: str) -> bool:
    """Hard filter: if a scheme is restricted to a specific gender (e.g.
    'Female' for a marriage-assistance/Shaadi Bhagya scheme), only citizens
    of that gender are eligible. scheme_gender must already be the
    *effective* gender from _scheme_effective_gender ('male'/'female'/'')."""
    scheme_gender = (scheme_gender or '').strip().lower()
    if scheme_gender not in ('male', 'female'):
        return True
    citizen_gender = (citizen_gender or '').strip().lower()
    return citizen_gender == scheme_gender


def _bedrock_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def _effective_special_status(profile: dict) -> str:
    special_status = (profile.get('specialStatus') or '').strip().lower()
    occupation = (profile.get('occupation') or '').strip().lower()
    if special_status:
        return special_status
    if occupation in ('widow', 'widowed'):
        return occupation
    if 'widow' in occupation:
        return 'widow'
    return ''


def _explain_with_bedrock(profile: dict, scheme: dict, status: str, conditions: list) -> str:
    try:
        client = _bedrock_client()

        income = profile.get('annualIncome', '')
        income_str = f"₹{income:,}" if isinstance(income, int) and income > 0 else str(income) if income else "Not specified"

        income_limit = scheme.get('income_limit', 0) or 0
        benefit = scheme.get('benefit_amount', 0) or 0

        prompt = (
            "You are an expert on Indian government welfare schemes. "
            "Given a citizen's profile and a scheme from a Neo4j knowledge graph, "
            f"explain in 2-3 sentences why this citizen is {status.lower()} for this scheme.\n\n"
            "Citizen Profile:\n"
            f"- Age: {profile.get('age', 'Not specified')}\n"
            f"- Gender: {profile.get('gender', 'Not specified')}\n"
            f"- State: {profile.get('state', 'Not specified')}\n"
            f"- Area: {profile.get('locality', 'Not specified')}\n"
            f"- Annual Income: {income_str}\n"
            f"- Category: {profile.get('category', 'Not specified')}\n"
            f"- Occupation: {profile.get('occupation', 'Not specified')}\n"
            f"- Is Farmer: {profile.get('isFarmer', False)}\n"
            f"- Is Student: {profile.get('isStudent', False)}\n"
            f"- Has Disability: {profile.get('hasDisability', False)}\n"
            f"- Is MSME: {profile.get('isMsme', False)}\n\n"
            "Scheme Details (from Knowledge Graph):\n"
            f"- Name: {scheme.get('name', 'Unknown')}\n"
            f"- Available In: {scheme.get('state', 'All states') or 'All states'}\n"
            f"- Category: {scheme.get('category', 'General') or 'General'}\n"
            f"- Gender: {scheme.get('gender', 'All') or 'All'}\n"
            f"- Income Limit: {'₹' + f'{income_limit:,}' if income_limit > 0 else 'No limit'}\n"
            f"- Benefit: {'₹' + f'{benefit:,}' if benefit > 0 else 'Not specified'}\n\n"
            f"Eligibility Status: {status}\n"
            f"Conditions Satisfied: {', '.join(conditions) if conditions else 'None'}\n\n"
            "Provide a clear, concise explanation (2-3 sentences) in simple English."
        )

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 300,
            "messages": [{"role": "user", "content": prompt}],
        })

        response = client.invoke_model(modelId=BEDROCK_MODEL_ID, body=body)
        response_body = json.loads(response['body'].read())
        return response_body['content'][0]['text'].strip()

    except Exception as exc:
        logger.warning("Bedrock call failed: %s", exc)
        name = scheme.get('name', 'this scheme')
        if status == 'Eligible':
            suffix = ('Key factors: ' + ', '.join(conditions) + '.') if conditions else ''
            return f"This citizen satisfies the core eligibility conditions for {name}. {suffix}".strip()
        if status == 'Recommended':
            return (
                f"This citizen partially matches {name}. "
                "Some supporting conditions are met, so it is surfaced as a recommendation worth reviewing."
            )
        return f"The provided details do not establish a qualifying relationship to {name}."


def _match_scheme(profile: dict, scheme: dict, occupation_group, scheme_groups: set) -> dict:
    # ------------------------------------------------------------------
    # Hard age check
    # If age is missing, invalid, or below 18, mark as Not Eligible.
    # ------------------------------------------------------------------
    try:
        age = profile.get("age")

        if age is None or str(age).strip() == "":
            return {
                "status": "Not Eligible",
                "conditions": [],
                "score": 0
            }

        age = int(float(age))

        if age < 18:
            return {
                "status": "Not Eligible",
                "conditions": [],
                "score": 0
            }

    except (ValueError, TypeError):
        return {
            "status": "Not Eligible",
            "conditions": [],
            "score": 0
        }

    conditions = []
    score = 0

    state = (scheme.get('state') or '').strip()
    gender = (scheme.get('gender') or 'All').strip()
    income_limit = scheme.get('income_limit') or 0
    category = (scheme.get('category') or 'General').strip()

    # Occupation match (only relevant when scheme is occupation-restricted;
    # by the time we get here, _occupation_allows_scheme has already ensured
    # any mismatch was filtered out, so a restricted scheme here is a match)
    if scheme_groups:
        occ_label = (profile.get('occupation') or '').strip() or occupation_group
        conditions.append(f"Occupation matches ({occ_label.title()})")
        score += 3

    # State
    if state and state not in ('Unknown State', 'Unknown', 'NOT_FOUND', 'All India', 'All'):
        if profile.get('state') == state:
            conditions.append(f"Located in {state}")
            score += 2
        else:
            score -= 1
    else:
        score += 1  # no state restriction

    # Gender
    effective_gender = _scheme_effective_gender(scheme)
    if effective_gender:
        if (profile.get('gender') or '').strip().lower() == effective_gender:
            conditions.append(f"Gender matches ({effective_gender.title()})")
            score += 1
        else:
            # Hard mismatch on a gender-restricted scheme — big penalty so
            # this can never reach Recommended/Eligible even if the caller
            # bypassed the check_eligibility-level hard filter.
            score -= 5
    else:
        score += 1  # no gender restriction

    # Income
    if income_limit and income_limit > 0:
        user_income = profile.get('annualIncome') or 0
        if isinstance(user_income, str):
            user_income = int(user_income) if user_income.isdigit() else 0
        if user_income <= income_limit:
            conditions.append(f"Annual income (₹{user_income:,}) within limit (₹{income_limit:,})")
            score += 2
        else:
            score -= 1
    else:
        score += 1  # no income restriction

    # Category — scheme-type labels are not demographic filters, treat as no restriction
    _SCHEME_TYPE_CATEGORIES = ('Agriculture Support', 'Social Welfare', 'Education', 'Health', 'Housing')
    if category and category not in ('General', 'NOT_FOUND', '') and category not in _SCHEME_TYPE_CATEGORIES:
        if profile.get('category') == category:
            conditions.append(f"Belongs to {category} category")
            score += 2
    else:
        score += 1  # no category restriction

    # Farmer / student / disability / msme hints from scheme name
    name_lower = scheme.get('name', '').lower()
    if profile.get('isFarmer') and any(k in name_lower for k in ('kisan', 'farm', 'agri', 'krishi', 'raitha', 'ryot')):
        conditions.append("Registered farmer — scheme targets agricultural households")
        score += 3
    if profile.get('isStudent') and any(k in name_lower for k in ('scholar', 'student', 'education', 'vidya')):
        conditions.append("Currently a student — scheme supports education")
        score += 3
    if profile.get('hasDisability') and any(k in name_lower for k in ('divyang', 'disability', 'handicap', 'adip')):
        conditions.append("Person with disability — scheme provides assistive support")
        score += 3
    if profile.get('isMsme') and any(k in name_lower for k in ('msme', 'enterprise', 'pmegp', 'mudra', 'startup')):
        conditions.append("MSME operator — scheme targets micro/small enterprises")
        score += 3
    special_status = _effective_special_status(profile)
    if special_status in ('widow', 'widowed') and any(k in name_lower for k in ('widow', 'widows')):
        conditions.append("Widow status — scheme targets widowed citizens")
        score += 3

    total_possible = 13 if scheme_groups else 10
    pct = score / total_possible

    if pct >= 0.50 and len(conditions) >= 2:
        status = 'Eligible'
    elif pct >= 0.3 or len(conditions) >= 1:
        status = 'Recommended'
    else:
        status = 'Not Eligible'

    return {'status': status, 'conditions': conditions, 'score': score}


def check_eligibility(profile: dict, driver) -> list:
    logger.info("check_eligibility called — profile=%s", profile)

    occupation_group = _matching_occupation_group(profile.get('occupation'))

    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (s:Scheme)
                OPTIONAL MATCH (s)-[:AVAILABLE_IN]->(st:State)
                OPTIONAL MATCH (s)-[:HAS_CATEGORY]->(c:Category)
                OPTIONAL MATCH (s)-[:FOR_GENDER]->(g:Gender)
                OPTIONAL MATCH (s)-[:APPLIES_TO]->(e:Eligibility)
                OPTIONAL MATCH (s)-[:HAS_BENEFIT]->(b:Benefit)
                RETURN s.name AS name,
                       st.name AS state,
                       c.name AS category,
                       g.type AS gender,
                       e.limit AS income_limit,
                       b.amount AS benefit_amount
                """
            )
            records = list(result)
    except Exception as exc:
        logger.exception("Neo4j query failed: %s", exc)
        return []

    logger.info("Found %d scheme record(s) in Neo4j", len(records))

    # Deduplicate by scheme name (multiple OPTIONAL MATCH rows per scheme)
    schemes_by_name: dict = {}
    for record in records:
        name = record.get('name') or 'Unknown Scheme'
        if _is_junk_scheme_name(name):
            continue
        if name not in schemes_by_name:
            schemes_by_name[name] = {
                'name': name,
                'state': record.get('state') or '',
                'category': record.get('category') or 'General',
                'gender': record.get('gender') or 'All',
                'income_limit': record.get('income_limit') or 0,
                'benefit_amount': record.get('benefit_amount') or 0,
            }

    results = []
    for scheme in schemes_by_name.values():
        scheme_groups = _scheme_occupation_groups(scheme)

        # Hard filter: skip this scheme entirely if occupation rules say it
        # doesn't apply to this citizen (e.g. widow-only scheme for a
        # non-widow, or a generic scheme when citizen's occupation is an
        # exclusive type like "Widow").
        if not _occupation_allows_scheme(occupation_group, scheme_groups):
            continue

        # Hard filter: skip this scheme entirely if it's restricted to a
        # gender the citizen doesn't match (e.g. a marriage-assistance
        # scheme reserved for Female applicants shown to a Male citizen).
        effective_gender = _scheme_effective_gender(scheme)
        if not _gender_allows_scheme(profile.get('gender'), effective_gender):
            continue

        match_result = _match_scheme(profile, scheme, occupation_group, scheme_groups)
        status = match_result['status']
        conditions = match_result['conditions']
        score = match_result['score']

        reasoning_path = [
            {'from': 'Citizen', 'relationship': 'BELONGS_TO', 'to': scheme.get('category') or 'General'},
            {'from': scheme.get('category') or 'General', 'relationship': 'ELIGIBLE_FOR', 'to': scheme['name']},
        ]
        if scheme.get('state'):
            reasoning_path.append(
                {'from': scheme['name'], 'relationship': 'AVAILABLE_IN', 'to': scheme['state']}
            )

        matched_entities = ['Citizen', scheme.get('category') or 'General', scheme['name']]
        if scheme.get('state'):
            matched_entities.append(scheme['state'])

        traversal_logic = f"Citizen → {scheme.get('category') or 'General'} → {scheme['name']}"
        if scheme.get('state'):
            traversal_logic += f" → {scheme['state']}"

        confidence_score = min(20 + score * 8, 95) if status != 'Not Eligible' else 20
        if confidence_score >= 80:
            confidence = 'High'
        elif confidence_score >= 60:
            confidence = 'Medium'
        else:
            confidence = 'Low'

        why_matched = (
            f"The knowledge graph links this citizen to '{scheme['name']}' via matched eligibility criteria."
            if status != 'Not Eligible'
            else f"No qualifying graph path found between this citizen's profile and '{scheme['name']}'."
        )

        ai_explanation = _explain_with_bedrock(profile, scheme, status, conditions)

        cypher_preview = (
            f'MATCH (s:Scheme {{name: "{scheme["name"]}"}})' + "\n"
            "OPTIONAL MATCH (s)-[:AVAILABLE_IN]->(st:State)\n"
            "OPTIONAL MATCH (s)-[:FOR_GENDER]->(g:Gender)\n"
            "OPTIONAL MATCH (s)-[:APPLIES_TO]->(e:Eligibility)\n"
            "RETURN s, st, g, e LIMIT 1;"
        )

        scheme_id = scheme['name'].lower().replace(' ', '-').replace('_', '-')

        details = _get_scheme_details(scheme['name'])

        results.append({
            'id': scheme_id,
            'schemeName': scheme['name'],
            'ministry': f"Scheme for {scheme.get('state', 'India') or 'India'}",
            'status': status,
            'confidence': confidence,
            'confidenceScore': confidence_score,
            'whyMatched': why_matched,
            'conditionsSatisfied': conditions,
            'matchedEntities': matched_entities,
            'reasoningPath': reasoning_path,
            'traversalLogic': traversal_logic,
            'cypherPreview': cypher_preview,
            'aiExplanation': ai_explanation,
            'documentsRequired': details.get('documentsRequired', ''),
            'applicationProcess': details.get('applicationProcess', ''),
        })

    order = {'Eligible': 0, 'Recommended': 1, 'Not Eligible': 2}
    results.sort(key=lambda r: (order.get(r['status'], 3), -r['confidenceScore']))

    logger.info("check_eligibility returning %d result(s)", len(results))
    return results