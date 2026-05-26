// Shared frontend types for the Government Scheme Intelligence Platform.
// These describe the shapes returned by the (mocked) Neo4j + Bedrock service
// layer. No backend logic lives here — only the contracts the UI renders.

export type Gender = 'Male' | 'Female' | 'Other';
export type Locality = 'Rural' | 'Urban';
export type SocialCategory = 'SC' | 'ST' | 'OBC' | 'General';

export type CitizenProfile = {
  age: number | '';
  gender: Gender | '';
  state: string;
  locality: Locality | '';
  annualIncome: number | '';
  occupation: string;
  category: SocialCategory | '';
  isStudent: boolean;
  isFarmer: boolean;
  isMsme: boolean;
  hasDisability: boolean;
};

export const EMPTY_PROFILE: CitizenProfile = {
  age: '',
  gender: '',
  state: '',
  locality: '',
  annualIncome: '',
  occupation: '',
  category: '',
  isStudent: false,
  isFarmer: false,
  isMsme: false,
  hasDisability: false,
};

export type EligibilityStatus = 'Eligible' | 'Recommended' | 'Not Eligible';
export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

// A single hop in the graph-reasoning path, e.g. User -> Farmer -> PM-Kisan.
export type ReasoningHop = {
  from: string;
  relationship: string; // e.g. ELIGIBLE_FOR, BELONGS_TO
  to: string;
};

export type SchemeEligibilityResult = {
  id: string;
  schemeName: string;
  ministry: string;
  status: EligibilityStatus;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  whyMatched: string;
  conditionsSatisfied: string[];
  // Graph-based explainability.
  matchedEntities: string[];
  reasoningPath: ReasoningHop[];
  traversalLogic: string;
  cypherPreview: string;
  // Natural-language summary (would come from Bedrock).
  aiExplanation: string;
};

// --- Knowledge graph types -------------------------------------------------

export type GraphNodeKind =
  | 'Scheme'
  | 'Category'
  | 'State'
  | 'Gender'
  | 'Eligibility'
  | 'Benefit';

export type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  // Layout position in the SVG coordinate space.
  x: number;
  y: number;
  properties: Record<string, string>;
};

export type GraphRelationKind =
  | 'AVAILABLE_IN'
  | 'HAS_CATEGORY'
  | 'FOR_GENDER'
  | 'HAS_BENEFIT'
  | 'APPLIES_TO';

export type GraphEdge = {
  id: string;
  source: string; // node id
  target: string; // node id
  relationship: GraphRelationKind;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphStats = {
  nodeCount: number;
  edgeCount: number;
  entityCounts: Record<GraphNodeKind, number>;
  relationshipCounts: Record<GraphRelationKind, number>;
};

// --- PDF processing pipeline ----------------------------------------------

export type PipelineStageId =
  | 'upload'
  | 's3'
  | 'extract-text'
  | 'extract-entities'
  | 'relationships'
  | 'neo4j'
  | 'visualize';

export type StageStatus = 'pending' | 'running' | 'done' | 'error';

export type PipelineStage = {
  id: PipelineStageId;
  label: string;
  description: string;
  status: StageStatus;
  detail?: string;
};

export const INITIAL_PIPELINE: PipelineStage[] = [
  { id: 'upload', label: 'PDF Upload', description: 'Reading the selected PDF file', status: 'pending' },
  { id: 's3', label: 'S3 Storage', description: 'Storing the document in Amazon S3', status: 'pending' },
  { id: 'extract-text', label: 'Text Extraction', description: 'Extracting text content from the PDF', status: 'pending' },
  { id: 'extract-entities', label: 'Entity Extraction', description: 'Identifying schemes, ministries and benefits', status: 'pending' },
  { id: 'relationships', label: 'Relationship Generation', description: 'Inferring relationships between entities', status: 'pending' },
  { id: 'neo4j', label: 'Neo4j Insertion', description: 'Writing nodes and edges into the graph database', status: 'pending' },
  { id: 'visualize', label: 'Graph Ready', description: 'Rendering the interactive knowledge graph', status: 'pending' },
];

export const NODE_KIND_META: Record<
  GraphNodeKind,
  { color: string; ring: string; label: string }
> = {
  Scheme:     { color: '#06b6d4', ring: '#22d3ee', label: 'Scheme' },
  Category:   { color: '#d97706', ring: '#f59e0b', label: 'Category' },
  State:      { color: '#ca8a04', ring: '#eab308', label: 'State' },
  Gender:     { color: '#7c3aed', ring: '#a78bfa', label: 'Gender' },
  Eligibility:{ color: '#0ea5e9', ring: '#38bdf8', label: 'Eligibility' },
  Benefit:    { color: '#10b981', ring: '#34d399', label: 'Benefit' },
};
