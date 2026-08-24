import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { computeSpecCosts } from '../../utils/calculations';
import { getFormula, formulaSecondArg } from '../../utils/formulaRegistry';
import { useProofStore } from '../../store/useProofStore';
import { twistNumbers } from '../../utils/twistNumbers';
import { childCounts } from '../../utils/childCounts';
import Glass from '../common/Glass';
import { clampLines } from '../common/clampLines';
import { typeDot } from '../common/typeDot';

export type SpecNodeData = {
  onLongPress?: (nodeId: string, pos: { x: number; y: number }) => void;
};

function SpecNode({ id, selected, data }: { id: string; selected: boolean; data: SpecNodeData }) {
  const spec             = useProofStore(s => s.specs.find(sp => sp.id === id));
  const components       = useProofStore(s => s.specComponentsMap[id]);
  const dilutionOverrides = useProofStore(s => s.dilutionOverrides);
  const vatRate          = useProofStore(s => s.vatRate);
  const sundriesPerServe = useProofStore(s => s.sundriesPerServe);
  const wasteRate        = useProofStore(s => s.wasteRate);
  const activeFormulaId  = useProofStore(s => s.activeFormulaId);
  const targetGpPct      = useProofStore(s => s.targetGpPct);
  const removeSpec       = useProofStore(s => s.removeSpec);
  // Numbers, so this node only re-renders when its own values move.
  const twistNo          = useProofStore(s => twistNumbers(s.specs)[id] ?? 0);
  const childCount       = useProofStore(s => childCounts(s.specs)[id] ?? 0);
  // Name of the published snapshot this was forked from, or null. A string, so
  // the node re-renders only when its own source name changes.
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
  const isPublished = spec.status === 'published';

  const costs = components
    ? computeSpecCosts(spec.method, spec.sale_price, components, dilutionOverrides, { sundriesPerServe, wasteRate })
    : null;

  // Headline metric via active formula
  const activeFormula = getFormula(activeFormulaId);
  const activeSecondArg = formulaSecondArg(activeFormula, spec.sale_price, targetGpPct);
  const headline = costs && activeSecondArg != null
    ? activeFormula.compute(costs.modifiedCost, activeSecondArg, vatRate)
    : null;

  // GP% always for the conic ring
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
  const twistLabel = twistNo ? `Twist ${twistNo}` : 'Twist';
  const descriptor = isFork
    ? (forkSourceName ? `Forked from ${forkSourceName}` : 'Forked from the commons')
    : isRoot
      ? [spec.method, spec.glass].filter(Boolean).join(' · ')
      : spec.change_note ? `${twistLabel} · ${spec.change_note}` : twistLabel;

  // Metrics collapse to one quiet footer line — pricing is secondary to the recipe.
  const metrics = costs
    ? [
        `${costs.finalAbvPct.toFixed(1)}% ABV`,
        `${Math.round(costs.finalVolumeMl)}ml`,
        costs.fullyPriced ? `${Math.round(gpPct)}% GP` : 'unpriced',
      ].join(' · ')
    : null;

  return (
    <Glass
      selected={selected}
      style={{ width: 232, padding: '15px 16px', cursor: 'pointer', position: 'relative' }}
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

      {/* Row 1: Name + ROOT badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="display" style={nameStyle} title={spec.name}>{spec.name}</h3>
          {descriptor && (
            <p style={descriptorStyle}>{descriptor}</p>
          )}
        </div>
        {isFork ? (
          <span style={forkBadge}>⑂ FORK</span>
        ) : isRoot ? (
          <span style={rootBadge}>◈ ROOT</span>
        ) : null}
      </div>

      {/* Row 2: the recipe — what's actually in the drink */}
      <div className="spec-node__recipe" style={recipeBody}>
        {components?.length ? (
          components.map((c) => (
            <div key={c.id} style={recipeRow}>
              <span style={amountCell}>
                {c.original_amount ?? c.amount_ml}
                <i style={unitCell}>&thinsp;{c.original_unit ?? 'ml'}</i>
              </span>
              <span style={typeDot(c.ingredients?.type, 5)} />
              <span style={ingredientName} title={c.ingredients?.name ?? undefined}>
                {c.ingredients?.name ?? '—'}
              </span>
            </div>
          ))
        ) : (
          <p style={emptyRecipe}>No ingredients yet</p>
        )}
      </div>

      {/* Footer: metrics + status */}
      <div style={footer}>
        <span style={attribution}>{metrics ?? spec.method ?? 'Spec'}</span>
        <span style={isPublished ? statusCommons : statusPrivate}>
          {isPublished
            ? <><span style={dot} />Commons</>
            : <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ flexShrink: 0 }}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Private</>
          }
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} style={handle} />
    </Glass>
  );
}

export default memo(SpecNode);

// ── Styles ────────────────────────────────────────────────────────────────────

const handle: React.CSSProperties = {
  background: 'rgba(127,230,255,.35)',
  border: '1px solid rgba(127,230,255,.2)',
  width: 8,
  height: 8,
};

const nameStyle: React.CSSProperties = {
  fontSize: 21,
  // 1.12 rather than 1 so the second line's descenders aren't clipped.
  lineHeight: 1.12,
  margin: 0,
  ...clampLines(2),
};

const descriptorStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--text-2)',
  margin: '5px 0 0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const rootBadge: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#8fe0ff',
  border: '1px solid rgba(127,230,255,.3)',
  borderRadius: 5,
  padding: '3px 6px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  marginLeft: 8,
};

// Magenta throughout the app means "crossed over from someone else" — the same
// hue the fork edge uses, so badge and edge read as one idea.
const forkBadge: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#ffd6f0',
  border: '1px solid rgba(255,135,210,.34)',
  borderRadius: 5,
  padding: '3px 6px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  marginLeft: 8,
};

const recipeBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  marginTop: 12,
  paddingTop: 11,
  borderTop: '1px solid rgba(255,255,255,.09)',
};

const recipeRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 7,
};

// Fixed mono gutter — amounts line up into a scannable column across the card.
const amountCell: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--text-2)',
  width: 52,
  textAlign: 'right',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

const unitCell: React.CSSProperties = {
  fontStyle: 'normal',
  fontSize: 9,
  color: 'var(--text-muted)',
};

const ingredientName: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 11.5,
  color: 'var(--text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
};

const emptyRecipe: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
  color: 'var(--text-muted)',
  margin: 0,
};

const footer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 14,
  paddingTop: 11,
  borderTop: '1px solid rgba(255,255,255,.09)',
};

const attribution: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9.5,
  color: 'var(--text-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const dot: React.CSSProperties = {
  display: 'inline-block',
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: 'var(--cyan)',
  boxShadow: '0 0 0 3px rgba(127,230,255,.15)',
  marginRight: 4,
};

const statusCommons: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 9,
  fontWeight: 600,
  color: '#8fe0ff',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  flexShrink: 0,
  marginLeft: 8,
};

const statusPrivate: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 9,
  fontWeight: 600,
  color: 'var(--text-muted)',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  flexShrink: 0,
  marginLeft: 8,
};
