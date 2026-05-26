'use client';

import { Check, Loader2, AlertCircle, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { PipelineStage } from '@/lib/scheme-types';

type ProcessingStatusProps = {
  stages: PipelineStage[];
};

/**
 * Vertical, staged progress indicator for the PDF → Knowledge Graph pipeline.
 * Each stage reflects its own running/done/error state.
 */
export default function ProcessingStatus({ stages }: ProcessingStatusProps) {
  const done = stages.filter((s) => s.status === 'done').length;
  const pct = Math.round((done / stages.length) * 100);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium">Processing pipeline</span>
          <span className="text-muted-foreground">{done} / {stages.length}</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <ol className="space-y-1">
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1;
          return (
            <li key={stage.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                    stage.status === 'done' && 'border-emerald-500 bg-emerald-500 text-white',
                    stage.status === 'running' && 'border-primary bg-primary/10 text-primary',
                    stage.status === 'error' && 'border-rose-500 bg-rose-500 text-white',
                    stage.status === 'pending' && 'border-muted-foreground/30 text-muted-foreground'
                  )}
                >
                  {stage.status === 'done' && <Check className="h-3.5 w-3.5" />}
                  {stage.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {stage.status === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
                  {stage.status === 'pending' && <Circle className="h-2 w-2 fill-current" />}
                </span>
                {!isLast && (
                  <span
                    className={cn(
                      'my-0.5 w-px flex-1',
                      stage.status === 'done' ? 'bg-emerald-500/60' : 'bg-border'
                    )}
                  />
                )}
              </div>
              <div className={cn('pb-3', isLast && 'pb-0')}>
                <p
                  className={cn(
                    'text-sm font-medium',
                    stage.status === 'pending' && 'text-muted-foreground'
                  )}
                >
                  {stage.label}
                </p>
                <p className="text-xs text-muted-foreground">{stage.detail ?? stage.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
