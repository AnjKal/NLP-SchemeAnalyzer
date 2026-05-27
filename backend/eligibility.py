import json
import logging
import os

import boto3
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env.local'))

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

logger = logging.getLogger('eligibility')

BEDROCK_MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"


def _bedrock_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


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


def _match_scheme(profile: dict, scheme: dict) -> dict:
    conditions = []
    score = 0

    state = (scheme.get('state') or '').strip()
    gender = (scheme.get('gender') or 'All').strip()
    income_limit = scheme.get('income_limit') or 0
    category = (scheme.get('category') or 'General').strip()

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
    if gender and gender not in ('All', 'NOT_FOUND', ''):
        if profile.get('gender') == gender:
            conditions.append(f"Gender matches ({gender})")
            score += 1
        # mismatch — no penalty, just no bonus
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

    total_possible = 10
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
        match_result = _match_scheme(profile, scheme)
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
        })

    order = {'Eligible': 0, 'Recommended': 1, 'Not Eligible': 2}
    results.sort(key=lambda r: (order.get(r['status'], 3), -r['confidenceScore']))

    logger.info("check_eligibility returning %d result(s)", len(results))
    return results
