import React, { useMemo } from 'react';
import { useNodes, useViewport } from '@xyflow/react';
import { useProofStore } from '../../store/useProofStore';
import { groupsOf } from '../../utils/groups';

/**
 * Ghost groups: a hull behind each lineage family.
 *
 * ⚑ CLAUDE.md forbids adding node types, so this is not a React Flow group
 * node — it is one layer under the cards, sharing the viewport transform, with
 * pointer-events off. Groups own no data and are re-derived from lineage on
 * every change, so they split and merge correctly with no state to repair.
 *
 * Bounds come from React Flow's measured node sizes rather than assumed ones,
 * because a card's height depends on how long its recipe is.
 */

const PAD = 26;
const LABEL_H = 20;

export default function GroupLayer() {
  const specs = useProofStore(s => s.specs);
  const nodes = useNodes();
  const { x, y, zoom } = useViewport();

  const hulls = useMemo(() => {
    const groups = groupsOf(specs);
    if (!groups.length) return [];

    const byId = new Map(nodes.map(n => [n.id, n]));
    return groups.flatMap(g => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let seen = 0;
      for (const id of g.specIds) {
        const n = byId.get(id);
        if (!n) continue;
        // measured is populated after the first render pass; fall back to the
        // card's known width and a modest height so nothing jumps on mount.
        const w = n.measured?.width ?? 244;
        const h = n.measured?.height ?? 120;
        minX = Math.min(minX, n.position.x);
        minY = Math.min(minY, n.position.y);
        maxX = Math.max(maxX, n.position.x + w);
        maxY = Math.max(maxY, n.position.y + h);
        seen++;
      }
      if (seen < 2) return [];
      return [{
        id: g.rootId,
        name: g.name,
        count: g.specIds.length,
        left: minX - PAD,
        top: minY - PAD - LABEL_H,
        width: (maxX - minX) + PAD * 2,
        height: (maxY - minY) + PAD * 2 + LABEL_H,
      }];
    });
  }, [specs, nodes]);

  if (!hulls.length) return null;

  return (
    <div style={layer}>
      <div style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        {hulls.map(h => (
          <div key={h.id} style={{ ...hull, left: h.left, top: h.top, width: h.width, height: h.height }}>
            <div style={label}>
              <span>{h.name}</span>
              <span style={countStyle}>{String(h.count).padStart(2, '0')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const layer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: 0,
};

/* Ghost, but legible: on paper at 2.5% a wash is literally invisible. A dashed
   hairline plus a faint warm wash reads as an enclosure without competing with
   the cards inside it. */
const hull: React.CSSProperties = {
  position: 'absolute',
  border: '1px dashed rgba(26,26,23,.34)',
  background: 'rgba(26,26,23,.045)',
};

const label: React.CSSProperties = {
  position: 'absolute',
  top: -1,
  left: -1,
  height: LABEL_H,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 9px',
  background: 'var(--ink)',
  border: '1px solid var(--ink)',
  font: '400 10px/1 var(--font-mono)',
  letterSpacing: '.08em',
  color: 'var(--on-ink)',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  overflow: 'hidden',
};

const countStyle: React.CSSProperties = {
  color: 'rgba(242,240,234,.6)',
};
