import React from 'react';
import {
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

/**
 * Two lineages, drawn differently on purpose (⚑ CLAUDE.md):
 *   branch — your own version of your own drink. Solid, the house gradient.
 *   fork   — someone else's drink, brought across. Dashed and single-hue, so a
 *            cross-creator jump never reads as one of your own branches.
 */

export default function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
}: EdgeProps) {
  const isFork = (data as { kind?: string } | undefined)?.kind === 'fork';
  // Orthogonal step routing with borderRadius 0 — the design draws lineage as
  // hard right angles, not curves, so the graph reads like a diagram.
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 0,
  });

  return (
    <>
      <path
        id={id}
        d={edgePath}
        stroke={isFork ? 'var(--accent)' : 'rgba(26,26,23,.42)'}
        strokeWidth={1}
        strokeDasharray={isFork ? '3 4' : undefined}
        fill="none"
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 9.5,
              fontWeight: 400,
              color: isFork ? 'var(--accent)' : 'var(--ink-72)',
              background: 'var(--card)',
              border: `1px solid ${isFork ? 'var(--accent-line)' : 'var(--rule)'}`,
              padding: '2px 7px',
              borderRadius: 0,
              whiteSpace: 'nowrap',
              marginBottom: 6,
            }}
          >
            {label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
