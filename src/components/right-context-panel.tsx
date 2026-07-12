'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PanelRight, Database, Sparkles, BarChart3 } from 'lucide-react';
import EligibilityReasoning from './eligibility-reasoning';
import GraphNodeDetails from './graph-node-details';
import {
  NODE_KIND_META,
  type GraphData,
  type GraphNode,
  type GraphStats,
  type SchemeEligibilityResult,
} from '@/lib/scheme-types';

type EligibilityContext = {
  mode: 'eligibility';
  result: SchemeEligibilityResult | null;
};

type GraphContext = {
  mode: 'graph';
  graph: GraphData | null;
  stats: GraphStats | null;
  selectedNode: GraphNode | null;
  onSelectNode?: (nodeId: string) => void;
};

type RightContextPanelProps = (EligibilityContext | GraphContext) & {
  onClose?: () => void;
};

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l bg-card xl:flex">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <PanelRight className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </aside>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <Sparkles className="h-8 w-8" />
      <p className="mt-3 max-w-[12rem] text-xs">{text}</p>
    </div>
  );
}

export default function RightContextPanel(props: RightContextPanelProps) {
  if (props.mode === 'eligibility') {
    const { result } = props;
    return (
      <PanelShell title="Reasoning & Context">
        {!result ? (
          <EmptyState text="Select a scheme's reasoning panel to see graph traversal and the Cypher query preview." />
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold leading-snug">{result.schemeName}</h3>
              <p className="text-xs text-muted-foreground">{result.ministry}</p>
            </div>

            <div className="rounded-lg border bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Confidence score</span>
                <Badge variant="secondary">{result.confidence} · {result.confidenceScore}%</Badge>
              </div>
            </div>

            {/* Scheme Application Details */}
            {(result.documentsRequired || result.applicationProcess) && (
              <>
                <Separator />
                
                {result.documentsRequired && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Documents Required</p>
                    <div className="text-xs text-muted-foreground whitespace-pre-line">
                      {result.documentsRequired}
                    </div>
                  </div>
                )}
                
                {result.applicationProcess && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">Application Process</p>
                    <div className="text-xs text-muted-foreground whitespace-pre-line">
                      {result.applicationProcess}
                    </div>
                  </div>
                )}
              </>
            )}

            <Separator />

            <EligibilityReasoning
              matchedEntities={result.matchedEntities}
              reasoningPath={result.reasoningPath}
              traversalLogic={result.traversalLogic}
            />

            <Separator />

            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                Cypher query preview
              </p>
              <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                <code>{result.cypherPreview}</code>
              </pre>
            </div>
          </div>
        )}
      </PanelShell>
    );
  }

  // Graph generator mode
  const { graph, stats, selectedNode, onSelectNode } = props;
  return (
    <PanelShell title="Graph Context">
      {!graph ? (
        <EmptyState text="Generate a graph from a PDF to view statistics, extracted entities and node details here." />
      ) : selectedNode ? (
        <GraphNodeDetails
          node={selectedNode}
          graph={graph}
          onSelectNode={onSelectNode}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Nodes</p>
              <p className="text-2xl font-semibold">{stats?.nodeCount ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Relationships</p>
              <p className="text-2xl font-semibold">{stats?.edgeCount ?? 0}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              Extracted entities
            </p>
            <div className="space-y-1.5">
              {stats &&
                Object.entries(stats.entityCounts)
                  .filter(([, count]) => count > 0)
                  .map(([kind, count]) => {
                    const meta = NODE_KIND_META[kind as keyof typeof NODE_KIND_META];
                    return (
                      <div key={kind} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                          {meta.label}
                        </span>
                        <span className="font-medium">{count}</span>
                      </div>
                    );
                  })}
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Database className="h-3.5 w-3.5" />
              Relationship counts
            </p>
            <div className="space-y-1.5">
              {stats &&
                Object.entries(stats.relationshipCounts)
                  .filter(([, count]) => count > 0)
                  .map(([rel, count]) => (
                    <div key={rel} className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className="font-normal">{rel}</Badge>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
            </div>
          </div>

          <p className="pt-2 text-center text-[11px] text-muted-foreground">
            Click any node in the graph to inspect its details.
          </p>
        </div>
      )}
    </PanelShell>
  );
}
