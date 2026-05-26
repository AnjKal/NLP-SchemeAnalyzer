'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Info,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EligibilityReasoning from './eligibility-reasoning';
import type {
  ConfidenceLevel,
  EligibilityStatus,
  SchemeEligibilityResult,
} from '@/lib/scheme-types';

const STATUS_META: Record<
  EligibilityStatus,
  { className: string; icon: React.ReactNode; label: string }
> = {
  Eligible: {
    className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: 'Eligible',
  },
  Recommended: {
    className: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    label: 'Recommended',
  },
  'Not Eligible': {
    className: 'bg-rose-100 text-rose-700 hover:bg-rose-100',
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: 'Not Eligible',
  },
};

const CONFIDENCE_COLOR: Record<ConfidenceLevel, string> = {
  High: 'text-emerald-600',
  Medium: 'text-amber-600',
  Low: 'text-rose-600',
};

type SchemeResultsProps = {
  results: SchemeEligibilityResult[] | null;
  onInspect?: (result: SchemeEligibilityResult) => void;
};

function SchemeCard({
  result,
  onInspect,
}: {
  result: SchemeEligibilityResult;
  onInspect?: (result: SchemeEligibilityResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[result.status];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base leading-snug">{result.schemeName}</CardTitle>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              {result.ministry}
            </p>
          </div>
          <Badge className={cn('shrink-0 gap-1', meta.className)}>
            {meta.icon}
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confidence</span>
            <span className={cn('font-semibold', CONFIDENCE_COLOR[result.confidence])}>
              {result.confidence} · {result.confidenceScore}%
            </span>
          </div>
          <Progress value={result.confidenceScore} className="h-1.5" />
        </div>

        <p className="text-sm text-muted-foreground">{result.whyMatched}</p>

        {result.conditionsSatisfied.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium">Conditions satisfied</p>
            <ul className="space-y-1">
              {result.conditionsSatisfied.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
                Why it matched
              </Button>
            </CollapsibleTrigger>
            {onInspect && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                onClick={() => onInspect(result)}
              >
                <Info className="h-3.5 w-3.5" />
                Reasoning panel
              </Button>
            )}
          </div>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="rounded-lg border bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI Explanation
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{result.aiExplanation}</p>
            </div>
            <EligibilityReasoning
              matchedEntities={result.matchedEntities}
              reasoningPath={result.reasoningPath}
              traversalLogic={result.traversalLogic}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default function SchemeResults({ results, onInspect }: SchemeResultsProps) {
  if (!results) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Sparkles className="h-12 w-12" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">No results yet</h2>
        <p className="mt-1 max-w-sm text-sm">
          Fill in the citizen details on the left and run an eligibility check to see
          matched government schemes, recommendations and graph-based reasoning.
        </p>
      </div>
    );
  }

  const eligibleCount = results.filter((r) => r.status === 'Eligible').length;
  const recommendedCount = results.filter((r) => r.status === 'Recommended').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          <CheckCircle2 className="h-3.5 w-3.5" /> {eligibleCount} Eligible
        </Badge>
        <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100">
          <Sparkles className="h-3.5 w-3.5" /> {recommendedCount} Recommended
        </Badge>
      </div>
      {results.map((r) => (
        <SchemeCard key={r.id} result={r} onInspect={onInspect} />
      ))}
    </div>
  );
}
