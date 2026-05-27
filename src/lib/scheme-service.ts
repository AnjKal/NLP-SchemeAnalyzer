import type {
  CitizenProfile,
  GraphData,
  GraphStats,
  GraphNodeKind,
  GraphRelationKind,
  SchemeEligibilityResult,
} from './scheme-types';

/**
 * Evaluates eligibility by querying the Neo4j graph (built from real S3 PDFs)
 * and calling AWS Bedrock Claude for natural-language explanations.
 * The auth token is passed through so the Next.js API route can verify it.
 */
export async function evaluateEligibility(
  profile: CitizenProfile,
  authToken?: string,
): Promise<SchemeEligibilityResult[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch('/api/check-eligibility', {
    method: 'POST',
    headers,
    body: JSON.stringify(profile),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Eligibility check failed' }));
    throw new Error(err.error ?? 'Eligibility check failed');
  }

  return res.json() as Promise<SchemeEligibilityResult[]>;
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
