import { NextResponse } from 'next/server';
import { verifyCognitoIdToken } from '@/server/cognito-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PYTHON_BACKEND_URL = (process.env.PYTHON_BACKEND_URL ?? 'http://localhost:8000').trim();

export async function POST(req: Request) {
  try {
    await verifyCognitoIdToken(req.headers.get('authorization'));

    const body = await req.json();

    const backendRes = await fetch(`${PYTHON_BACKEND_URL}/check-eligibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Allow up to 60 s — Bedrock calls for multiple schemes can be slow.
      signal: AbortSignal.timeout(60_000),
    });

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({ detail: 'Backend error' }));
      return NextResponse.json(
        { error: err.detail ?? 'Eligibility check failed' },
        { status: backendRes.status },
      );
    }

    const results = await backendRes.json();
    return NextResponse.json(results);
  } catch (err: any) {
    const message = err?.message ?? 'Eligibility check failed';
    const status = message.includes('Authorization') ? 401 : 500;
    console.error('[check-eligibility] error — status=%d, message=%s', status, message);
    return NextResponse.json({ error: message }, { status });
  }
}
