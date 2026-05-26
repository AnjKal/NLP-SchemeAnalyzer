import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { verifyCognitoIdToken } from '@/server/cognito-auth';

const region = (process.env.AWS_REGION ?? 'us-east-1').trim();
const authoritiesBucket = process.env.AUTHORITIES_S3_BUCKET?.trim();
const s3 = new S3Client({ region });

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(req: Request) {
  try {
    await verifyCognitoIdToken(req.headers.get('authorization'));

    if (!authoritiesBucket) {
      return NextResponse.json({ error: 'AUTHORITIES_S3_BUCKET is not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const key = `pdfs/${Date.now()}-${sanitizeFilename(file.name)}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: authoritiesBucket,
        Key: key,
        Body: bytes,
        ContentType: 'application/pdf',
      }),
    );

    return NextResponse.json({ key });
  } catch (err: any) {
    const message = err?.message ?? 'Upload failed';
    const status = message.includes('Authorization') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
