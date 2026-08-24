import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { computeSpecCosts } from '../../utils/calculations';
import { getFormula, formulaSecondArg } from '../../utils/formulaRegistry';
import { useProofStore } from '../../store/useProofStore';
import { twistNumbers } from '../../utils/twistNumbers';
import { childCounts } from '../../utils/childCounts';
import Glass from '../common/Glass';
import { clampLines } from '../common/clampLines';

export type SpecNodeData = {
  onLongPress?: (nodeId: string, pos: { x: number; y: number }) => void;
};

function SpecNode({ id, selected, data }: { id: string; selected: boolean; data: SpecNodeData }) {
  const spec             = useProofStore(s => s.specs.find(sp => sp.id === id));
  const components       = useProofStore(s => s.specComponentsMap[id]);
  const dilutionOverrides = useProofStore(s => s.dilutionOverrides);
  const sundriesPerServe = useProofStore(s => s.sundriesPerServe);
  const wasteRate        = useProofStore(s => s.wasteRate);
  const vatRate          = useProofStore(s => s.vatRate);
  const targetGpPct      = useProofStore(s => s.targetGpPct);
  const removeSpec       = useProofStore(s => s.removeSpec);
  // Numbers, so this node only re-renders when its own values move.
  const twistNo          = useProofStore(s => twistNumbers(s.specs)[id] ?? 0);
  const childCount       = useProofStore(s => childCounts(s.specs)[id] ?? 0);
  // Name of the published snapshot this was forked from, or null. A string, so
  // the node re-renders only when its own source name changes.
  // Position of this spec in the whole canvas, so the header can carry an index
  // the way the design's "01 / 02" strip does. Ordered by creation, stable.
  const specIndex        = useProofStore(s => {
    const ordered = [...s.specs].sort((a, b) =>
      a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at));
    return ordered.findIndex(sp => sp.id === id) + 1;
  });
  const forkSourceName   = useProofStore(s => {
    const fid = s.specs.find(sp => sp.id === id)?.forked_from_published_id;
    return fid ? (s.forkSources[fid]?.name ?? null) : null;
  });

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Corner delete is two-step: the first click arms it, the second commits.
  // No modal, no confirm() — the button itself carries the confirmation.
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    clearTimeout(longPressTimer.current);
    clearTimeout(disarmTimer.current);
  }, []);

  // React Flow reads pointerdown on the node to start a drag and to select.
  // The button is its own thing, so nothing it receives may reach the canvas.
  const swallow = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const disarm = useCallback(() => {
    clearTimeout(disarmTimer.current);
    setArmed(false);
  }, []);

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (deleting) return;

    if (!armed) {
      setArmed(true);
      // An armed delete left alone shouldn't stay a live trigger under the cursor.
      clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setArmed(false), 3200);
      return;
    }

    clearTimeout(disarmTimer.current);
    setDeleting(true);
    try {
      await removeSpec(id);
      // Success unmounts this node — nothing to reset.
    } catch {
      // Leave the card in place and return to rest; the spec still exists.
      setDeleting(false);
      setArmed(false);
    }
  }, [armed, deleting, id, removeSpec]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      data.onLongPress?.(id, { x: touch.clientX, y: touch.clientY });
    }, 300);
  }, [id, data]);

  const clearLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  if (!spec) return null;

  // A fork has no parent_spec_id — its parent is someone else's published
  // snapshot — so testing parent alone labelled every fork as a ROOT, which is
  // the one thing it definitively is not.
  const isFork = !!spec.forked_from_published_id;
  const isRoot = !spec.parent_spec_id && !isFork;

  const costs = components
    ? computeSpecCosts(spec.method, spec.sale_price, components, dilutionOverrides, { sundriesPerServe, wasteRate })
    : null;


  // GP drives the first footer cell.
  const gpFormula = getFormula('gp_ex_vat');
  const gpSecondArg = formulaSecondArg(gpFormula, spec.sale_price, targetGpPct);
  const gpPct = costs && gpSecondArg != null
    ? Math.max(0, Math.min(100, gpFormula.compute(costs.modifiedCost, gpSecondArg, vatRate)))
    : 0;

  // Deleting a spec doesn't delete its twists — parent_spec_id is ON DELETE SET
  // NULL, so they survive as roots. The confirmation says so rather than letting
  // the lineage come apart quietly.
  const confirmSentence = childCount
    ? `Delete ${spec.name}? ${childCount} twist${childCount > 1 ? 's' : ''} will detach and become root${childCount > 1 ? 's' : ''}.`
    : `Delete ${spec.name}?`;

  // Descriptor line — how the drink is made (the recipe body carries what's in it).
  const role = isFork ? 'fork' : isRoot ? 'root' : twistNo ? `twist ${twistNo}` : 'twist';
  const twistLabel = twistNo ? `Twist ${twistNo}` : 'Twist';
  // Three mono cells: gp, abv, volume. Unpriced says so rather than showing 0,
  // which would read as free.
  const footerCells = costs
    ? [
        { label: 'gp',  value: costs.fullyPriced ? `${Math.round(gpPct)}% gp` : 'unpriced',
          accent: costs.fullyPriced && gpPct < targetGpPct },
        { label: 'abv', value: `${costs.finalAbvPct.toFixed(0)}%` },
        { label: 'vol', value: `${Math.round(costs.finalVolumeMl)}ml` },
      ]
    : [{ label: 'gp', value: 'no data', accent: false }];

  const descriptor = isFork
    ? (forkSourceName ? `Forked from ${forkSourceName}` : 'Forked from the commons')
    : isRoot
      ? [spec.method, spec.glass].filter(Boolean).join(' · ')
      : spec.change_note ? `${twistLabel} · ${spec.change_note}` : twistLabel;


  return (
    <Glass
      selected={selected}
      style={{ width: 244, cursor: 'pointer', position: 'relative' }}
      onTouchStart={onTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <Handle type="target" position={Position.Top} style={handle} />

      <button
        type="button"
        className="spec-node__delete nodrag nopan"
        data-armed={armed || undefined}
        disabled={deleting}
        aria-label={armed ? confirmSentence : `Delete ${spec.name}`}
        title={armed ? confirmSentence : 'Delete'}
        onClick={handleDelete}
        onPointerDown={swallow}
        onMouseDown={swallow}
        onTouchStart={swallow}
        onMouseLeave={disarm}
        onBlur={disarm}
      >
        {armed ? (
          <span className="spec-node__delete-label">
            {childCount ? `Delete? ${childCount} detach` : 'Delete?'}
          </span>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
          </svg>
        )}
      </button>

      {/* Header strip: index + what this node is. Inverts when selected. */}
      <div style={selected ? headerStripSelected : isFork ? headerStripFork : headerStrip}>
        <span>{String(specIndex).padStart(2, '0')}</span>
        <span>{role}</span>
      </div>

      {/* Name + descriptor */}
      <div style={{ padding: '12px 12px 0' }}>
        <h3 className="display" style={nameStyle} title={spec.name}>{spec.name}</h3>
        {descriptor && <p style={descriptorStyle}>{descriptor}</p>}
      </div>

      {/* The recipe — only carried by the selected card, as in the design */}
      {components?.length ? (
        <div className="spec-node__recipe" style={recipeBody}>
          {components.map((c) => (
            <div key={c.id} style={recipeRow}>
              <span style={ingredientName} title={c.ingredients?.name ?? c.preps?.name ?? undefined}>
                {c.ingredients?.name ?? c.preps?.name ?? '—'}
              </span>
              <span style={amountCell}>
                {c.original_amount ?? c.amount_ml}{c.original_unit ?? 'ml'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '0 12px 12px' }}><p style={emptyRecipe}>No ingredients yet</p></div>
      )}

      {/* Footer: the numbers, in mono cells divided by hairlines */}
      <div style={footer}>
        {footerCells.map((cell, i) => (
          <span key={cell.label} style={footerCell(i === footerCells.length - 1, cell.accent)}>
            {cell.value}
          </span>
        ))}
      </div>

      {/* Attribution travels with a fork, always */}
      {isFork && forkSourceName && (
        <div style={attributionRow}>forked · {forkSourceName}</div>
      )}

      <Handle type="source" position={Position.Bottom} style={handle} />
    </Glass>
  );
}

export default memo(SpecNode);

// ── Styles ────────────────────────────────────────────────────────────────────

const handle: React.CSSProperties = {
  background: 'var(--ink)',
  border: 'none',
  borderRadius: 0,
  width: 5,
  height: 5,
};

/* The mono strip: an index and what this node is. It earns its place — the
   number is the spec's position in the lineage, the word is its role. */
const stripBase: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '7px 12px',
  font: "400 10px/1 var(--font-mono)",
  letterSpacing: '.1em',
  borderBottom: '1px solid var(--rule)',
};

const headerStrip: React.CSSProperties = { ...stripBase, color: 'var(--ink-72)' };

const headerStripFork: React.CSSProperties = { ...stripBase, color: 'var(--accent)' };

const headerStripSelected: React.CSSProperties = {
  ...stripBase,
  background: 'var(--ink)',
  color: 'var(--on-ink)',
  borderBottom: '1px solid var(--ink)',
};

const nameStyle: React.CSSProperties = {
  font: '500 22px/1.05 var(--font-display)',
  margin: 0,
  color: 'var(--ink)',
  ...clampLines(2),
};

const descriptorStyle: React.CSSProperties = {
  font: '400 12.5px/1.4 var(--font-display)',
  color: 'var(--ink-72)',
  margin: '5px 0 0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const recipeBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '11px 12px',
};

const recipeRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 10,
};

const ingredientName: React.CSSProperties = {
  font: '400 12.5px/1 var(--font-display)',
  color: 'var(--ink)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

const amountCell: React.CSSProperties = {
  font: '400 10.5px/1 var(--font-mono)',
  color: 'var(--ink-72)',
  flexShrink: 0,
};

const emptyRecipe: React.CSSProperties = {
  font: '400 12.5px/1 var(--font-display)',
  color: 'var(--ink-45)',
  margin: 0,
};

const footer: React.CSSProperties = {
  display: 'flex',
  borderTop: '1px solid var(--rule)',
};

const footerCell = (last: boolean, accent?: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '8px 12px',
  font: '400 10.5px/1 var(--font-mono)',
  color: accent ? 'var(--accent)' : 'var(--ink-72)',
  borderRight: last ? 'none' : '1px solid var(--rule-faint)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

/* Attribution is data and rides on every fork card, always (⚑). */
const attributionRow: React.CSSProperties = {
  padding: '7px 12px',
  borderTop: '1px solid var(--rule)',
  font: '400 10.5px/1 var(--font-mono)',
  color: 'var(--ink-72)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
