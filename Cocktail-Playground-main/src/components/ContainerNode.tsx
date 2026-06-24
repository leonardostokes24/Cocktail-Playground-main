import React, { useState } from 'react';
import { NodeResizer, useReactFlow, type Node } from '@xyflow/react';
import { HierarchyManager } from '../utils/hierarchy';

// Accent palette per group type
function getAccent(isSpecGroup: boolean | undefined) {
  if (isSpecGroup === true)  return { bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.22)',  active: '#10b981' };
  if (isSpecGroup === false) return { bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.22)',  active: '#f59e0b' };
  /* user-created */         return { bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.22)', active: '#818cf8' };
}

export default function ContainerNode({ id, data, selected }: any) {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || 'New Group');

  const accent = getAccent(data.isSpecGroup);

  const handleSave = () => {
    setIsEditing(false);
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n));
  };

  const deleteNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes(nds => {
      const remaining = nds.filter(n => n.id !== id);
      return remaining.map(node => {
        if (node.parentId === id) {
          return {
            ...node,
            parentId: undefined,
            position: HierarchyManager.getAbsolutePosition(node, nds),
            extent: undefined,
          };
        }
        return node;
      });
    });
  };

  const handleUnmerge = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes(nds => {
      const specChildren = nds.filter(n => n.parentId === id && n.type === 'spec');
      if (specChildren.length === 0) return nds;

      const toRemove = new Set<string>([id]);
      const newNodes: Node[] = [];

      specChildren.forEach(spec => {
        const specAbs = HierarchyManager.getAbsolutePosition(spec, nds);
        const newGroupId = `specgroup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const ingChildren = nds.filter(n => n.parentId === spec.id);

        // Container sized to hold the spec comfortably
        newNodes.push({
          id: newGroupId,
          type: 'container',
          position: { x: specAbs.x - 24, y: specAbs.y - 48 },
          style: { width: 360, height: 300 },
          data: { label: (spec.data.label as string) || 'Spec Group', isSpecGroup: true },
        } as Node);

        // Spec: no extent restriction so it can grow beyond container bounds
        newNodes.push({
          ...spec,
          parentId: newGroupId,
          extent: undefined,
          position: { x: 24, y: 48 },
        } as Node);

        // Ingredients keep their positions relative to the spec
        ingChildren.forEach(ing => {
          const ingAbs = HierarchyManager.getAbsolutePosition(ing, nds);
          newNodes.push({
            ...ing,
            position: { x: ingAbs.x - specAbs.x, y: ingAbs.y - specAbs.y },
          } as Node);
        });

        toRemove.add(spec.id);
        ingChildren.forEach(i => toRemove.add(i.id));
      });

      return [...nds.filter(n => !toRemove.has(n.id)), ...newNodes];
    });
  };

  return (
    <div
      style={{
        background: selected
          ? `${accent.bg.replace('0.06', '0.10')}`
          : accent.bg,
        border: `1.5px solid ${selected ? accent.active : accent.border}`,
        borderRadius: '14px',
        height: '100%',
        width: '100%',
        position: 'relative',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: selected
          ? `0 0 0 1px ${accent.active}40, 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)`
          : `0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={160}
        lineStyle={{ border: `1.5px solid ${accent.active}` }}
        handleStyle={{ width: 8, height: 8, background: accent.active, border: 'none', borderRadius: 2 }}
      />

      {/* Label inside top-left — Figma frame style */}
      <div className="no-export" style={{
        position: 'absolute',
        top: 10,
        left: 14,
        right: 80,
        pointerEvents: isEditing ? 'auto' : 'none',
      }}>
        {isEditing ? (
          <input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={{
              fontSize: '11px',
              fontWeight: 800,
              background: 'rgba(0,0,0,0.4)',
              color: 'white',
              border: `1px solid ${accent.active}`,
              borderRadius: '4px',
              padding: '2px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              outline: 'none',
              width: '100%',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: selected ? accent.active : `${accent.active}99`,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </div>
        )}
      </div>

      {/* Action buttons — top-right inside */}
      <div className="no-export" style={{
        position: 'absolute',
        top: 6,
        right: 8,
        display: 'flex',
        gap: '4px',
        zIndex: 10,
      }}>
        <button
          onClick={e => { e.stopPropagation(); setIsEditing(true); }}
          title="Rename group"
          style={btnStyle('rgba(255,255,255,0.12)')}
        >
          ✏️
        </button>

        {data.isSpecGroup === false && (
          <button
            onClick={handleUnmerge}
            title="Split back into individual spec groups"
            style={btnStyle(accent.active + '33')}
          >
            ⚡
          </button>
        )}

        <button
          onClick={deleteNode}
          title="Delete group"
          style={btnStyle('#f8717133')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    color: 'white',
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  };
}
