import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ulid } from 'ulid';
import { ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddbDoc, historyTableName } from '@/server/dynamodb';
import { verifyCognitoIdToken } from '@/server/cognito-auth';
import { getJson, putJson } from '@/server/s3-json';
import { presignGetUrl } from '@/ai/s3';
import type { HistoryItem, Document } from '@/lib/history';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DocumentSchema = z.object({
  name: z.string(),
  url: z.string(),
  s3Key: z.string().optional(),
  mimeType: z.string().optional(),
});

const ChatItemSchema = z.object({
  userId: z.string(),
  type: z.literal('chat'),
  document: DocumentSchema,
  analysis: z.any().nullable(),
  messages: z.array(z.object({ sender: z.enum(['user', 'ai']), content: z.string() })),
});

const CompareItemSchema = z.object({
  userId: z.string(),
  type: z.literal('compare'),
  documentA: DocumentSchema,
  documentB: DocumentSchema,
  comparison: z.any().nullable(),
});

const GraphItemSchema = z.object({
  userId: z.string(),
  type: z.literal('graph'),
  document: DocumentSchema,
  graph: z.any().nullable(),
});

const EligibilityItemSchema = z.object({
  userId: z.string(),
  type: z.literal('eligibility'),
  profile: z.any(),
  results: z.array(z.any()).nullable(),
});

const CreateHistoryItemSchema = z.union([ChatItemSchema, CompareItemSchema, GraphItemSchema, EligibilityItemSchema]);

async function hydrateDocumentUrls(doc: Document): Promise<Document> {
  if (doc.s3Key) {
    const url = await presignGetUrl(doc.s3Key);
    return { ...doc, url };
  }
  return doc;
}

async function hydrateHistoryItem(item: any): Promise<HistoryItem> {
  const base = {
    id: item.id as string,
    userId: item.userId as string,
    createdAt: item.createdAt as number,
  };

  if (item.type === 'chat') {
    const [analysis, messages] = await Promise.all([
      item.analysisKey ? getJson<any>(item.analysisKey).catch(() => null) : Promise.resolve(null),
      item.messagesKey ? getJson<any>(item.messagesKey).catch(() => []) : Promise.resolve([]),
    ]);

    return {
      ...base,
      type: 'chat',
      document: await hydrateDocumentUrls(item.document as Document),
      analysis,
      messages: Array.isArray(messages) ? messages : [],
    } as HistoryItem;
  }

  if (item.type === 'graph') {
    const graph = item.graphKey ? await getJson<any>(item.graphKey).catch(() => null) : null;
    return {
      ...base,
      type: 'graph',
      document: await hydrateDocumentUrls(item.document as Document),
      graph,
    } as HistoryItem;
  }

  if (item.type === 'eligibility') {
    const results = item.resultsKey ? await getJson<any>(item.resultsKey).catch(() => null) : null;
    return {
      ...base,
      type: 'eligibility',
      profile: item.profile,
      results,
    } as HistoryItem;
  }

  const comparison = item.comparisonKey ? await getJson<any>(item.comparisonKey).catch(() => null) : null;

  return {
    ...base,
    type: 'compare',
    documentA: await hydrateDocumentUrls(item.documentA as Document),
    documentB: await hydrateDocumentUrls(item.documentB as Document),
    comparison,
  } as HistoryItem;
}

export async function GET(req: Request) {
  console.log('[history/route:GET] request received');
  try {
    if (!historyTableName) throw new Error('Missing DDB_HISTORY_TABLE env var');

    const decoded = await verifyCognitoIdToken(req.headers.get('authorization'));
    const uid = decoded.sub;

    const result = await ddbDoc.send(
      new ScanCommand({
        TableName: historyTableName,
        FilterExpression: '#userId = :userId',
        ExpressionAttributeNames: { '#userId': 'userId' },
        ExpressionAttributeValues: { ':userId': uid },
      })
    );
    const items = result.Items ?? [];
    const hydrated = await Promise.all(items.map(hydrateHistoryItem));
    console.log('[history/route:GET] hydration complete — returning', hydrated.length, 'items');

    return NextResponse.json({ items: hydrated });
  } catch (err: any) {
    console.error('[history/route:GET] ERROR:', err?.message ?? err);
    const message = err?.message ?? 'Failed to load history';
    const status = message.includes('Authorization') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    if (!historyTableName) throw new Error('Missing DDB_HISTORY_TABLE env var');

    const decoded = await verifyCognitoIdToken(req.headers.get('authorization'));
    const uid = decoded.sub;

    const body = CreateHistoryItemSchema.parse(await req.json());

    // Enforce userId from token.
    const userId = uid;

    const id = ulid();
    const createdAt = Date.now();

    const base = {
      id,
      userId,
      type: body.type,
      createdAt,
    } as const;

    if (body.type === 'chat') {
      const messagesKey = `history/${userId}/${id}/messages.json`;
      await putJson(messagesKey, body.messages ?? []);

      let analysisKey: string | undefined;
      if (body.analysis) {
        analysisKey = `history/${userId}/${id}/analysis.json`;
        await putJson(analysisKey, body.analysis);
      }

      await ddbDoc.send(
        new PutCommand({
          TableName: historyTableName,
          Item: {
            ...base,
            document: body.document,
            messagesKey,
            analysisKey,
          },
        })
      );

      return NextResponse.json({ id });
    }

    if (body.type === 'graph') {
      let graphKey: string | undefined;
      if (body.graph) {
        graphKey = `history/${userId}/${id}/graph.json`;
        await putJson(graphKey, body.graph);
      }

      await ddbDoc.send(
        new PutCommand({
          TableName: historyTableName,
          Item: {
            ...base,
            document: body.document,
            graphKey,
          },
        })
      );

      return NextResponse.json({ id });
    }

    if (body.type === 'eligibility') {
      let resultsKey: string | undefined;
      if (body.results) {
        resultsKey = `history/${userId}/${id}/results.json`;
        await putJson(resultsKey, body.results);
      }

      await ddbDoc.send(
        new PutCommand({
          TableName: historyTableName,
          Item: {
            ...base,
            profile: body.profile,
            resultsKey,
          },
        })
      );

      return NextResponse.json({ id });
    }

    let comparisonKey: string | undefined;
    if (body.comparison) {
      comparisonKey = `history/${userId}/${id}/comparison.json`;
      await putJson(comparisonKey, body.comparison);
    }

    await ddbDoc.send(
      new PutCommand({
        TableName: historyTableName,
        Item: {
          ...base,
          documentA: body.documentA,
          documentB: body.documentB,
          comparisonKey,
        },
      })
    );

    return NextResponse.json({ id });
  } catch (err: any) {
    const message = err?.message ?? 'Failed to create history item';
    const status = message.includes('Authorization') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
