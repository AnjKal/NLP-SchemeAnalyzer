// Mocked frontend service layer for the Scheme Intelligence Platform.
//
// IMPORTANT: This file contains NO backend logic. Every function here is a
// placeholder that simulates what a real Neo4j traversal / Bedrock reasoning /
// S3 upload call would eventually return. When the backend is wired up, these
// function bodies are the only thing that needs to change — the UI consumes
// the same typed contracts (see scheme-types.ts).

import type {
  CitizenProfile,
  GraphData,
  GraphStats,
  GraphNodeKind,
  GraphRelationKind,
  SchemeEligibilityResult,
} from './scheme-types';

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

// --- Eligibility (Neo4j traversal + Bedrock reasoning, mocked) -------------

type SchemeRule = {
  id: string;
  schemeName: string;
  ministry: string;
  group: string; // citizen group node this scheme attaches to
  matches: (p: CitizenProfile) => { ok: boolean; conditions: string[] };
};

const SCHEME_RULES: SchemeRule[] = [
  {
    id: 'pm-kisan',
    schemeName: 'PM-KISAN Samman Nidhi',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    group: 'Farmer',
    matches: (p) => {
      const conditions: string[] = [];
      if (p.isFarmer) conditions.push('Registered as a farmer');
      if (typeof p.annualIncome === 'number' && p.annualIncome <= 200000)
        conditions.push('Annual income within small/marginal farmer limit');
      return { ok: p.isFarmer, conditions };
    },
  },
  {
    id: 'nsp-scholarship',
    schemeName: 'National Scholarship (Post-Matric)',
    ministry: 'Ministry of Social Justice & Empowerment',
    group: 'Student',
    matches: (p) => {
      const conditions: string[] = [];
      if (p.isStudent) conditions.push('Currently a student');
      if (p.category && p.category !== 'General')
        conditions.push(`Belongs to reserved category (${p.category})`);
      if (typeof p.annualIncome === 'number' && p.annualIncome <= 250000)
        conditions.push('Family income below scholarship ceiling');
      return { ok: p.isStudent && p.category !== 'General' && p.category !== '', conditions };
    },
  },
  {
    id: 'pmegp',
    schemeName: 'PMEGP (MSME Credit-Linked Subsidy)',
    ministry: 'Ministry of MSME',
    group: 'MSME',
    matches: (p) => {
      const conditions: string[] = [];
      if (p.isMsme) conditions.push('Operates a micro/small enterprise');
      if (typeof p.age === 'number' && p.age >= 18)
        conditions.push('Above minimum age of 18');
      return { ok: p.isMsme, conditions };
    },
  },
  {
    id: 'pmay-g',
    schemeName: 'Pradhan Mantri Awas Yojana (Gramin)',
    ministry: 'Ministry of Rural Development',
    group: 'Rural Citizen',
    matches: (p) => {
      const conditions: string[] = [];
      if (p.locality === 'Rural') conditions.push('Resident of a rural area');
      if (typeof p.annualIncome === 'number' && p.annualIncome <= 300000)
        conditions.push('Income within affordable-housing threshold');
      return { ok: p.locality === 'Rural', conditions };
    },
  },
  {
    id: 'divyangjan',
    schemeName: 'ADIP Scheme for Persons with Disabilities',
    ministry: 'Department of Empowerment of Persons with Disabilities',
    group: 'Persons with Disability',
    matches: (p) => {
      const conditions: string[] = [];
      if (p.hasDisability) conditions.push('Self-reported disability status');
      if (typeof p.annualIncome === 'number' && p.annualIncome <= 300000)
        conditions.push('Income within assistive-aid support limit');
      return { ok: p.hasDisability, conditions };
    },
  },
  {
    id: 'pmjay',
    schemeName: 'Ayushman Bharat (PM-JAY)',
    ministry: 'Ministry of Health & Family Welfare',
    group: 'Low Income Household',
    matches: (p) => {
      const conditions: string[] = [];
      const lowIncome = typeof p.annualIncome === 'number' && p.annualIncome <= 180000;
      if (lowIncome) conditions.push('Household income within PM-JAY limit');
      if (p.category && p.category !== 'General')
        conditions.push(`Priority category (${p.category})`);
      return { ok: lowIncome, conditions };
    },
  },
];

function confidenceFromConditions(count: number): {
  level: SchemeEligibilityResult['confidence'];
  score: number;
} {
  if (count >= 3) return { level: 'High', score: 88 + Math.min(count, 5) };
  if (count === 2) return { level: 'Medium', score: 72 };
  return { level: 'Low', score: 55 };
}

/**
 * Mocked eligibility evaluation. In production this would issue a Cypher
 * traversal against Neo4j and pass the matched subgraph to Bedrock for
 * natural-language reasoning. Here it derives results deterministically from
 * the profile so the UI is fully demonstrable offline.
 */
export async function evaluateEligibility(
  profile: CitizenProfile
): Promise<SchemeEligibilityResult[]> {
  await wait(1100); // simulate traversal + LLM latency

  const results: SchemeEligibilityResult[] = SCHEME_RULES.map((rule) => {
    const { ok, conditions } = rule.matches(profile);
    const status: SchemeEligibilityResult['status'] = ok
      ? 'Eligible'
      : conditions.length > 0
        ? 'Recommended'
        : 'Not Eligible';
    const { level, score } = confidenceFromConditions(conditions.length + (ok ? 1 : 0));

    const reasoningPath = [
      { from: 'Citizen', relationship: 'BELONGS_TO', to: rule.group },
      { from: rule.group, relationship: 'ELIGIBLE_FOR', to: rule.schemeName },
      { from: rule.schemeName, relationship: 'PROVIDED_BY', to: rule.ministry },
    ];

    return {
      id: rule.id,
      schemeName: rule.schemeName,
      ministry: rule.ministry,
      status,
      confidence: level,
      confidenceScore: status === 'Not Eligible' ? 20 : score,
      whyMatched:
        status === 'Not Eligible'
          ? `No graph path connects this citizen profile to ${rule.schemeName}.`
          : `The graph links this citizen to the "${rule.group}" group, which is ${status === 'Eligible' ? 'directly eligible for' : 'associated with'} ${rule.schemeName}.`,
      conditionsSatisfied: conditions,
      matchedEntities: ['Citizen', rule.group, rule.schemeName, rule.ministry],
      reasoningPath,
      traversalLogic: `Citizen → ${rule.group} → ${rule.schemeName} → ${rule.ministry}`,
      cypherPreview: `MATCH (c:Citizen)-[:BELONGS_TO]->(g:CitizenGroup {name: "${rule.group}"})\n      -[:ELIGIBLE_FOR]->(s:Scheme {name: "${rule.schemeName}"})\n      -[:PROVIDED_BY]->(m:Ministry)\nRETURN s, m, g LIMIT 1;`,
      aiExplanation:
        status === 'Eligible'
          ? `Based on the matched graph path, this citizen satisfies the core eligibility conditions for ${rule.schemeName}. ${conditions.length ? 'Key factors: ' + conditions.join('; ') + '.' : ''}`
          : status === 'Recommended'
            ? `This citizen partially matches ${rule.schemeName}. Some supporting conditions are met, so it is surfaced as a recommendation worth reviewing.`
            : `The provided details do not establish a qualifying relationship to ${rule.schemeName}.`,
    };
  });

  // Surface eligible first, then recommended, then the rest.
  const order = { Eligible: 0, Recommended: 1, 'Not Eligible': 2 } as const;
  return results.sort(
    (a, b) =>
      order[a.status] - order[b.status] || b.confidenceScore - a.confidenceScore
  );
}

export function computeGraphStats(graph: GraphData): GraphStats {
  const entityCounts = {
    Scheme: 0,
    Category: 0,
    State: 0,
    Gender: 0,
    Eligibility: 0,
    Benefit: 0,
  } as Record<GraphNodeKind, number>;
  for (const n of graph.nodes) entityCounts[n.kind] += 1;

  const relationshipCounts = {
    AVAILABLE_IN: 0,
    HAS_CATEGORY: 0,
    FOR_GENDER: 0,
    HAS_BENEFIT: 0,
    APPLIES_TO: 0,
  } as Record<GraphRelationKind, number>;
  for (const e of graph.edges) relationshipCounts[e.relationship] += 1;

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    entityCounts,
    relationshipCounts,
  };
}
