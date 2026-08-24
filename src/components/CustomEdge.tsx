import React from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

const GRAD_ID = 'proof-edge-grad';

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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <>
      {/* SVG defs injected once — React deduplicates by id */}
      <defs>
        <linearGradient id={GRAD_ID} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7FE6FF" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff87d2" stopOpacity=".5" />
        </linearGradient>
      </defs>

      <path
        id={id}
        d={edgePath}
        stroke={isFork ? 'rgba(255,135,210,.6)' : `url(#${GRAD_ID})`}
        strokeWidth={isFork ? 1.4 : 1.6}
        strokeDasharray={isFork ? '5 4' : undefined}
        strokeLinecap={isFork ? 'round' : undefined}
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
              fontFamily: 'var(--font-ui)',
              fontSize: 10,
              fontWeight: 600,
              color: isFork ? '#ffd6f0' : 'var(--text-2)',
              background: 'rgba(12,11,20,.85)',
              border: `1px solid ${isFork ? 'rgba(255,135,210,.3)' : 'rgba(255,255,255,.08)'}`,
              padding: '2px 7px',
              borderRadius: 4,
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
