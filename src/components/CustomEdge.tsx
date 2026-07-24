import React from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

const GRAD_ID = 'proof-edge-grad';

export default function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
}: EdgeProps) {
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
        stroke={`url(#${GRAD_ID})`}
        strokeWidth={1.6}
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
              color: 'var(--text-2)',
              background: 'rgba(12,11,20,.85)',
              border: '1px solid rgba(255,255,255,.08)',
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
