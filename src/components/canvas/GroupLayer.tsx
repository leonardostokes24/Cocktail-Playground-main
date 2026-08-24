import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNodes, useReactFlow, useViewport } from '@xyflow/react';
import { useProofStore } from '../../store/useProofStore';
import { groupsOf, manualGroupsOf } from '../../utils/groups';

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
  const editSpec = useProofStore(s => s.editSpec);
  const removeSpecs = useProofStore(s => s.removeSpecs);
  const specGroups = useProofStore(s => s.specGroups);
  const ungroup = useProofStore(s => s.ungroup);
  const nodes = useNodes();
  const { setNodes } = useReactFlow();
  const { x, y, zoom } = useViewport();
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ ids: Set<string>; lastX: number; lastY: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Drag the hull itself. The cards render above this layer, so a press on the
   * visible margin grabs the whole family while a press on a card still reaches
   * the card — no dead zone, and no need to hunt for a small handle.
   */
  const startDrag = useCallback((e: React.PointerEvent, ids: string[], groupId: string) => {
    // Only a primary press, and never from the delete button.
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { ids: new Set(ids), lastX: e.clientX, lastY: e.clientY };
    setDragging(groupId);

    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      // Screen pixels ÷ zoom = flow units, or the group would outrun the
      // cursor when zoomed out and lag it when zoomed in.
      const dx = (ev.clientX - d.lastX) / zoom;
      const dy = (ev.clientY - d.lastY) / zoom;
      d.lastX = ev.clientX;
      d.lastY = ev.clientY;
      setNodes(ns => ns.map(n => (d.ids.has(n.id)
        ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
        : n)));
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const d = drag.current;
      drag.current = null;
      setDragging(null);
      if (!d) return;
      // Persist once at the end — one write per member, not one per frame.
      setNodes(ns => {
        for (const n of ns) {
          if (d.ids.has(n.id)) editSpec(n.id, { canvas_x: n.position.x, canvas_y: n.position.y });
        }
        return ns;
      });
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [zoom, setNodes, editSpec]);

  /**
   * Two-step, like the card corner — but what it does depends on the kind.
   * A manual group is a container: removing it must not remove the drinks.
   * A lineage hull isn't a container, it *is* the family, so there is nothing
   * to dissolve and the only meaningful destructive action is deleting them.
   */
  const handleDelete = useCallback(async (e: React.MouseEvent, rootId: string, ids: string[], kind: 'lineage' | 'manual') => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (armed !== rootId) {
      setArmed(rootId);
      clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setArmed(null), 3200);
      return;
    }
    clearTimeout(disarmTimer.current);
    setBusy(true);
    try {
      if (kind === 'manual') await ungroup(rootId);
      else await removeSpecs(ids);
      setArmed(null);
    } finally {
      setBusy(false);
    }
  }, [armed, busy, removeSpecs, ungroup]);

  const hulls = useMemo(() => {
    // Manual groups first, so a deliberate set draws over the family it sits in.
    const groups = [...groupsOf(specs), ...manualGroupsOf(specs, specGroups)];
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
      // A lineage hull needs two cards to mean anything; a manual one doesn't.
      if (seen < (g.kind === 'manual' ? 1 : 2)) return [];
      return [{
        id: g.rootId,
        name: g.name,
        count: g.specIds.length,
        specIds: g.specIds,
        kind: g.kind,
        left: minX - PAD,
        top: minY - PAD - LABEL_H,
        width: (maxX - minX) + PAD * 2,
        height: (maxY - minY) + PAD * 2 + LABEL_H,
      }];
    });
  }, [specs, nodes, specGroups]);

  if (!hulls.length) return null;

  return (
    <div style={layer}>
      <div style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        {hulls.map(h => (
          <div
            key={h.id}
            className="nodrag nopan"
            style={{ ...(dragging === h.id ? hullDragging : hull),
                     ...(h.kind === 'manual' ? hullManual : null),
                     left: h.left, top: h.top, width: h.width, height: h.height }}
            onPointerDown={e => startDrag(e, h.specIds, h.id)}
            title="Drag to move the whole family"
          >
            <div style={h.kind === 'manual' ? labelManual : label}>
              <span style={grip} aria-hidden="true">⠿</span>
              <span style={nameStyle}>{h.name}</span>
              <span style={countStyle}>{String(h.count).padStart(2, '0')}</span>
              <button
                type="button"
                onClick={e => handleDelete(e, h.id, h.specIds, h.kind)}
                onPointerDown={e => e.stopPropagation()}
                disabled={busy}
                style={del(armed === h.id)}
                aria-label={h.kind === 'manual'
                  ? (armed === h.id ? `Confirm ungroup ${h.name} — the ${h.count} specs stay` : `Ungroup ${h.name}`)
                  : (armed === h.id ? `Confirm delete all ${h.count} specs in ${h.name}` : `Delete the ${h.name} family`)}
                title={h.kind === 'manual'
                  ? 'Remove the group — the drinks stay'
                  : (armed === h.id ? `Deletes all ${h.count} specs` : 'Delete this family')}
              >
                {armed === h.id ? (h.kind === 'manual' ? 'ungroup?' : `delete ${h.count}?`) : '✕'}
              </button>
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
  // React Flow stacks pane at 1 and viewport at 2. At 0 the pane sat above this
  // layer and swallowed every press aimed at a hull, so the group looked
  // draggable and wasn't. At 1, later DOM order puts it above the pane while
  // the viewport — and therefore every card — still paints on top.
  zIndex: 1,
};

/* Ghost, but legible: on paper at 2.5% a wash is literally invisible. A dashed
   hairline plus a faint warm wash reads as an enclosure without competing with
   the cards inside it. */
const hull: React.CSSProperties = {
  position: 'absolute',
  border: '1px dashed rgba(26,26,23,.34)',
  background: 'rgba(26,26,23,.045)',
  // The hull itself is the drag surface. Its interior is covered by the cards,
  // which sit above this layer, so a press on the visible margin grabs the
  // family and a press on a card still reaches the card.
  pointerEvents: 'auto',
  cursor: 'grab',
};

/* A manual group is deliberate, so it draws as a solid enclosure — a derived
   family stays dashed, the way a suggestion should. */
const hullManual: React.CSSProperties = {
  border: '1px solid rgba(26,26,23,.42)',
  background: 'rgba(194,42,6,.045)',
};

const labelManual: React.CSSProperties = {
  position: 'absolute',
  top: -1,
  left: -1,
  height: LABEL_H,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 9px',
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  font: '400 10px/1 var(--font-mono)',
  letterSpacing: '.08em',
  color: 'var(--on-ink)',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  overflow: 'hidden',
  pointerEvents: 'auto',
  userSelect: 'none',
};

const hullDragging: React.CSSProperties = {
  ...hull,
  cursor: 'grabbing',
  background: 'rgba(26,26,23,.075)',
  borderStyle: 'solid',
};

const grip: React.CSSProperties = {
  color: 'rgba(242,240,234,.5)',
  letterSpacing: 0,
};

const nameStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const del = (isArmed: boolean): React.CSSProperties => ({
  marginLeft: 2,
  padding: isArmed ? '2px 5px' : '0 2px',
  background: isArmed ? 'var(--accent)' : 'none',
  border: 'none',
  color: isArmed ? 'var(--on-ink)' : 'rgba(242,240,234,.55)',
  font: '400 9px/1 var(--font-mono)',
  letterSpacing: '.06em',
  cursor: 'pointer',
});

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
  pointerEvents: 'auto',
  userSelect: 'none',
};

const countStyle: React.CSSProperties = {
  color: 'rgba(242,240,234,.6)',
};
