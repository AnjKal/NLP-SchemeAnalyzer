'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  NODE_KIND_META,
  type GraphData,
  type GraphNode,
  type GraphEdge,
} from '@/lib/scheme-types';

type GraphViewerProps = {
  graph: GraphData;
  selectedNodeId?: string | null;
  onNodeClick?: (node: GraphNode) => void;
  className?: string;
};

const VIEW_W = 860;
const VIEW_H = 520;
const NODE_R = 34;
const PAD = NODE_R + 50;

/** Fruchterman-Reingold force-directed layout. Ignores backend-provided x/y. */
function forceLayout(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  if (nodes.length === 0) return nodes;
  if (nodes.length === 1) return [{ ...nodes[0], x: VIEW_W / 2, y: VIEW_H / 2 }];

  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  const r0 = Math.min(VIEW_W - PAD * 2, VIEW_H - PAD * 2) * 0.36;

  // Start: spread evenly on a circle so there are no degenerate initial overlaps
  let pos = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return { ...n, x: cx + r0 * Math.cos(angle), y: cy + r0 * Math.sin(angle) };
  });

  // Scale ideal distance to canvas area
  const IDEAL = Math.max(120, Math.sqrt((VIEW_W * VIEW_H) / nodes.length) * 1.1);
  const REP = IDEAL * IDEAL * 0.75;
  const ATTR = 0.055;
  const ITER = 280;
  let temp = 70;

  for (let iter = 0; iter < ITER; iter++) {
    const fx = new Float64Array(pos.length);
    const fy = new Float64Array(pos.length);

    // Repulsion between every pair
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const d2 = dx * dx + dy * dy + 1;
        const d = Math.sqrt(d2);
        const f = REP / d2;
        fx[i] -= (f * dx) / d;
        fy[i] -= (f * dy) / d;
        fx[j] += (f * dx) / d;
        fy[j] += (f * dy) / d;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const si = pos.findIndex((n) => n.id === edge.source);
      const ti = pos.findIndex((n) => n.id === edge.target);
      if (si === -1 || ti === -1) continue;
      const dx = pos[ti].x - pos[si].x;
      const dy = pos[ti].y - pos[si].y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const f = ATTR * d;
      fx[si] += (f * dx) / d;
      fy[si] += (f * dy) / d;
      fx[ti] -= (f * dx) / d;
      fy[ti] -= (f * dy) / d;
    }

    // Apply forces with temperature cap and boundary clamp
    pos = pos.map((n, i) => {
      let vx = fx[i];
      let vy = fy[i];
      const spd = Math.sqrt(vx * vx + vy * vy);
      if (spd > temp) {
        vx = (vx / spd) * temp;
        vy = (vy / spd) * temp;
      }
      return {
        ...n,
        x: Math.max(PAD, Math.min(VIEW_W - PAD, n.x + vx)),
        y: Math.max(PAD, Math.min(VIEW_H - PAD - 10, n.y + vy)),
      };
    });

    temp *= 0.97;
  }

  return pos;
}

export default function GraphViewer({
  graph,
  selectedNodeId,
  onNodeClick,
  className,
}: GraphViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  // Recompute layout only when graph data changes (stable reference from state)
  const layoutNodes = useMemo(
    () => forceLayout(graph.nodes, graph.edges),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph.nodes, graph.edges],
  );

  const nodeById = useCallback(
    (id: string) => layoutNodes.find((n) => n.id === id),
    [layoutNodes],
  );

  const clampZoom = (z: number) => Math.min(2.5, Math.max(0.3, z));

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clampZoom(z - e.deltaY * 0.0015));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setIsPanning(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.x),
      y: dragRef.current.oy + (e.clientY - dragRef.current.y),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setIsPanning(false);
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-lg bg-muted/30', className)}>
      {/* Controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => clampZoom(z + 0.2))}
          title="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setZoom((z) => clampZoom(z - 0.2))}
          title="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} title="Reset view">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5 rounded-lg border bg-background/90 p-2 shadow-sm backdrop-blur max-w-[55%]">
        {Object.entries(NODE_KIND_META).map(([kind, meta]) => (
          <Badge key={kind} variant="outline" className="gap-1.5 border-transparent text-[10px] font-normal">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
          </Badge>
        ))}
      </div>

      <svg
        className={cn('h-full w-full touch-none', isPanning ? 'cursor-grabbing' : 'cursor-grab')}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
          {/* Edges */}
          {graph.edges.map((edge) => {
            const a = nodeById(edge.source);
            const b = nodeById(edge.target);
            if (!a || !b) return null;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const x1 = a.x + ux * NODE_R;
            const y1 = a.y + uy * NODE_R;
            const x2 = b.x - ux * (NODE_R + 8);
            const y2 = b.y - uy * (NODE_R + 8);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            return (
              <g key={edge.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  markerEnd="url(#arrow)"
                />
                <text
                  x={mx}
                  y={my - 5}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 9 }}
                >
                  {edge.relationship}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((node) => {
            const meta = NODE_KIND_META[node.kind];
            const isSelected = node.id === selectedNodeId;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeClick?.(node);
                }}
              >
                <circle
                  r={NODE_R}
                  fill={meta.color}
                  stroke={isSelected ? '#0f172a' : meta.ring}
                  strokeWidth={isSelected ? 3.5 : 2}
                  opacity={0.95}
                />
                <text textAnchor="middle" dy="-2" fill="white" style={{ fontSize: 8, fontWeight: 600 }}>
                  {node.kind}
                </text>
                <text
                  textAnchor="middle"
                  y={NODE_R + 15}
                  className="fill-foreground"
                  style={{ fontSize: 10, fontWeight: 500 }}
                >
                  {node.label.length > 22 ? node.label.slice(0, 21) + '…' : node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
        Drag to pan · scroll to zoom · click a node for details
      </div>
    </div>
  );
}
