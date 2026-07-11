import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { verifyCognitoIdToken } from '@/server/cognito-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const region = (process.env.AWS_REGION ?? 'us-east-1').trim();
const PYTHON_BACKEND_URL = (process.env.PYTHON_BACKEND_URL ?? 'http://localhost:8000').trim();
const authoritiesBucket = process.env.AUTHORITIES_S3_BUCKET?.trim();

const s3 = new S3Client({ region });

// ─── PDF text extraction ──────────────────────────────────────────────────────

async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((item: any) => item.str).join(' '));
  }
  return parts.join('\n');
}

// ─── Scheme data extraction (mirrors backend/parser.py) ──────────────────────

function safeExtract(text: string, pattern: RegExp): string {
  const m = text.match(pattern);
  return m ? m[1].trim() : 'NOT_FOUND';
}

interface SchemeData {
  name: string;
  state: string;
  category: string;
  gender: string;
  income_limit: number;
  benefit_amount: number;
}

function extractSchemeData(text: string, fallbackName: string): SchemeData {
  const rawName = safeExtract(text, /Scheme Name:\s*(.*)/i);
  const rawState = safeExtract(text, /State:\s*(.*)/i);
  const rawCategory = safeExtract(text, /Category:\s*(.*)/i);

  const incomeMatch = text.match(/income.*?₹\s*([\d,]+)/i);
  const incomeLimit = incomeMatch ? parseInt(incomeMatch[1].replace(/,/g, ''), 10) : 0;

  const amounts = [...text.matchAll(/₹\s*([\d,]+)/g)].map((m) =>
    parseInt(m[1].replace(/,/g, ''), 10),
  );
  let benefitAmount = 0;
  for (const amt of amounts) {
    if (amt < 100_000) benefitAmount = Math.max(benefitAmount, amt);
  }

  return {
    name: rawName === 'NOT_FOUND' ? fallbackName : rawName,
    state: rawState === 'NOT_FOUND' ? 'Unknown State' : rawState,
    category: rawCategory === 'NOT_FOUND' ? 'General' : rawCategory,
    gender: 'All',
    income_limit: incomeLimit,
    benefit_amount: benefitAmount,
  };
}

// ─── Graph builder (mirrors backend/query.py build_graph_data) ────────────────

function buildGraph(data: SchemeData, s3Key: string) {
  // Use a stable prefix derived from the S3 key so that node IDs are unique
  // across multiple schemes merged into the same graph.
  const prefix = s3Key.replace(/[^a-zA-Z0-9]/g, '_').slice(-40);
  const sid = `scheme_${prefix}`;

  const nodes: object[] = [
    { id: sid, label: data.name, kind: 'Scheme', x: 430, y: 250, properties: { source: s3Key, status: 'Active' } },
    { id: `state_${prefix}`, label: data.state, kind: 'State', x: 700, y: 120, properties: { type: 'State' } },
    { id: `category_${prefix}`, label: data.category, kind: 'Category', x: 150, y: 120, properties: { category: data.category } },
    { id: `gender_${prefix}`, label: data.gender, kind: 'Gender', x: 150, y: 390, properties: { gender: data.gender } },
  ];
  const edges: object[] = [
    { id: `e1_${prefix}`, source: sid, target: `state_${prefix}`, relationship: 'AVAILABLE_IN' },
    { id: `e2_${prefix}`, source: sid, target: `category_${prefix}`, relationship: 'HAS_CATEGORY' },
    { id: `e3_${prefix}`, source: sid, target: `gender_${prefix}`, relationship: 'FOR_GENDER' },
  ];

  if (data.income_limit > 0) {
    nodes.push({
      id: `income_${prefix}`,
      label: `Income ≤ ₹${data.income_limit.toLocaleString('en-IN')}`,
      kind: 'Eligibility',
      x: 430,
      y: 430,
      properties: { rule: `annual_income <= ${data.income_limit}` },
    });
    edges.push({ id: `e4_${prefix}`, source: sid, target: `income_${prefix}`, relationship: 'APPLIES_TO' });
  }

  if (data.benefit_amount > 0) {
    nodes.push({
      id: `benefit_${prefix}`,
      label: `₹${data.benefit_amount.toLocaleString('en-IN')} Benefit`,
      kind: 'Benefit',
      x: 700,
      y: 390,
      properties: { amount: `₹${data.benefit_amount.toLocaleString('en-IN')}` },
    });
    edges.push({ id: `e5_${prefix}`, source: sid, target: `benefit_${prefix}`, relationship: 'HAS_BENEFIT' });
  }

  return { nodes, edges };
}

// ─── Local graph generation (no Python backend needed) ───────────────────────

async function generateGraphLocally(s3Key: string) {
  const fallbackName =
    (s3Key.split('/').pop() ?? 'scheme').replace(/\.pdf$/i, '').replace(/_/g, ' ').trim() ||
    'Unknown Scheme';

  console.log('[generate-graph:local] fallbackName=%s, bucket=%s', fallbackName, authoritiesBucket ?? 'NOT SET');

  if (!authoritiesBucket) {
    console.warn('[generate-graph:local] AUTHORITIES_S3_BUCKET not set — returning minimal graph');
    return buildGraph(
      { name: fallbackName, state: 'Unknown State', category: 'General', gender: 'All', income_limit: 0, benefit_amount: 0 },
      s3Key,
    );
  }

  let text = '';
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: authoritiesBucket, Key: s3Key }));
    const bytes = await res.Body?.transformToByteArray();
    if (bytes) {
      text = await extractTextFromPdfBytes(bytes);
      console.log('[generate-graph:local] PDF parsed — chars=%d', text.length);
    }
  } catch (err) {
    console.error('[generate-graph:local] PDF download/parse failed:', err);
  }

  const data = text
    ? extractSchemeData(text, fallbackName)
    : { name: fallbackName, state: 'Unknown State', category: 'General', gender: 'All', income_limit: 0, benefit_amount: 0 };

  console.log('[generate-graph:local] scheme data:', data);
  return buildGraph(data, s3Key);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  console.log('[generate-graph] POST received');
  try {
    await verifyCognitoIdToken(req.headers.get('authorization'));

    const body = await req.json();
    const { s3Key } = body as { s3Key?: string };
    if (!s3Key) return NextResponse.json({ error: 's3Key is required' }, { status: 400 });

    console.log('[generate-graph] s3Key=%s', s3Key);

    // Try the Python backend first; fall back to local JS generation if unreachable.
    const backendUrl = `${PYTHON_BACKEND_URL}/generate-graph`;
    try {
      console.log('[generate-graph] trying Python backend — %s', backendUrl);
      const backendRes = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3_key: s3Key }),
        signal: AbortSignal.timeout(30_000),
      });
      if (backendRes.ok) {
        const graph = await backendRes.json();
        console.log('[generate-graph] Python backend OK — nodes=%d, edges=%d', graph?.nodes?.length ?? 0, graph?.edges?.length ?? 0);
        return NextResponse.json(graph);
      }
      const errBody = await backendRes.json().catch(() => ({ detail: 'Backend error' }));
      console.warn('[generate-graph] Python backend returned %d: %s', backendRes.status, errBody.detail);
    } catch (err: any) {
      console.warn('[generate-graph] Python backend unreachable (%s) — falling back to local generation', err?.message ?? err);
    }

    // Local fallback — works even without the Python server running.
    const graph = await generateGraphLocally(s3Key);
    console.log('[generate-graph] local graph — nodes=%d, edges=%d', graph.nodes.length, graph.edges.length);
    return NextResponse.json(graph);
  } catch (err: any) {
    const message = err?.message ?? 'Graph generation failed';
    const status = message.includes('Authorization') ? 401 : 500;
    console.error('[generate-graph] error — status=%d, message=%s', status, message);
    return NextResponse.json({ error: message }, { status });
  }
}
