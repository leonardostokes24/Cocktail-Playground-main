import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -100%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: 'all',
            zIndex: 1000,
            marginBottom: '8px'
          }}
          className="nodrag nopan"
        >
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: '#0f172a',
              border: '1px solid #475569',
              padding: '4px 10px',
              borderRadius: '999px',
              color: '#e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
              cursor: 'default',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap' }}>{label}</span>
            <button
              onClick={onDelete}
              title="Delete connection"
              style={{
                background: '#1e293b',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                fontSize: '10px',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s'
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
