'use client';

import { ArrowRight, GitBranch, Workflow } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReasoningHop } from '@/lib/scheme-types';

type EligibilityReasoningProps = {
  matchedEntities: string[];
  reasoningPath: ReasoningHop[];
  traversalLogic: string;
  className?: string;
};

/**
 * Visual, graph-style explanation of WHY a scheme matched — renders the
 * matched entities and the relationship traversal path
 * (e.g. Citizen → Farmer → PM-Kisan). Critical for explainability.
 */
export default function EligibilityReasoning({
  matchedEntities,
  reasoningPath,
  traversalLogic,
  className,
}: EligibilityReasoningProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <GitBranch className="h-4 w-4 text-primary" />
          Matched Entities
        </div>
        <div className="flex flex-wrap gap-2">
          {matchedEntities.map((e) => (
            <Badge key={e} variant="secondary" className="font-normal">{e}</Badge>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Workflow className="h-4 w-4 text-primary" />
          Relationship Path
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-lg border bg-muted/40 p-3">
          {reasoningPath.map((hop, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1">
              {i === 0 && (
                <span className="rounded-md bg-background px-2 py-1 text-xs font-medium shadow-sm">
                  {hop.from}
                </span>
              )}
              <span className="flex items-center gap-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                {hop.relationship}
                <ArrowRight className="h-3 w-3" />
              </span>
              <span className="rounded-md bg-background px-2 py-1 text-xs font-medium shadow-sm">
                {hop.to}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Traversal Logic</p>
        <code className="block rounded-md bg-muted px-3 py-2 text-xs text-foreground">
          {traversalLogic}
        </code>
      </div>
    </div>
  );
}
