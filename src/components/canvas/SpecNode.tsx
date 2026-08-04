import React, { memo, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { computeSpecCosts } from '../../utils/calculations';
import { getFormula, formulaSecondArg } from '../../utils/formulaRegistry';
import { useProofStore } from '../../store/useProofStore';
import Glass from '../common/Glass';
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

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  const isRoot = !spec.parent_spec_id;
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

  // Descriptor line — how the drink is made (the recipe body carries what's in it).
  const descriptor = isRoot
    ? [spec.method, spec.glass].filter(Boolean).join(' · ')
    : spec.change_note ? `Twist · ${spec.change_note}` : 'Twist';

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
      style={{ width: 232, padding: '15px 16px', cursor: 'pointer' }}
      onTouchStart={onTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <Handle type="target" position={Position.Left} style={handle} />

      {/* Row 1: Name + ROOT badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="display" style={nameStyle} title={spec.name}>{spec.name}</h3>
          {descriptor && (
            <p style={descriptorStyle}>{descriptor}</p>
          )}
        </div>
        {isRoot && (
          <span style={rootBadge}>◈ ROOT</span>
        )}
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

      <Handle type="source" position={Position.Right} style={handle} />
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
  lineHeight: 1,
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
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
