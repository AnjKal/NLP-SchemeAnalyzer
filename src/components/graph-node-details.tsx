'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Link2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  NODE_KIND_META,
  type GraphData,
  type GraphNode,
} from '@/lib/scheme-types';

type GraphNodeDetailsProps = {
  node: GraphNode;
  graph: GraphData;
  onClose?: () => void;
  onSelectNode?: (nodeId: string) => void;
};

/**
 * Details panel shown when a graph node is clicked: node metadata plus the
 * relationships connecting it to other nodes.
 */
export default function GraphNodeDetails({
  node,
  graph,
  onClose,
  onSelectNode,
}: GraphNodeDetailsProps) {
  const meta = NODE_KIND_META[node.kind];

  const connections = graph.edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => {
      const outgoing = e.source === node.id;
      const otherId = outgoing ? e.target : e.source;
      const other = graph.nodes.find((n) => n.id === otherId);
      return { edge: e, outgoing, other };
    })
    .filter((c) => c.other);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} />
          <Badge variant="secondary" className="font-normal">{meta.label}</Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div>
        <h3 className="font-headline text-base font-semibold leading-snug">{node.label}</h3>
      </div>

      {Object.keys(node.properties).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Properties</p>
          <dl className="space-y-1.5 rounded-lg border bg-muted/40 p-3">
            {Object.entries(node.properties).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-xs">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          Connected relationships ({connections.length})
        </p>
        <div className="space-y-1.5">
          {connections.map(({ edge, outgoing, other }) => (
            <button
              key={edge.id}
              onClick={() => other && onSelectNode?.(other.id)}
              className="flex w-full items-center gap-2 rounded-md border bg-background p-2 text-left text-xs transition-colors hover:bg-muted"
            >
              <span className="font-medium">{outgoing ? node.label : other!.label}</span>
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                {edge.relationship}
              </span>
              <span className="font-medium">{outgoing ? other!.label : node.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
