import React, { memo, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { computeSpecCosts } from '../../utils/calculations';
import { getFormula, formulaSecondArg } from '../../utils/formulaRegistry';
import { useProofStore } from '../../store/useProofStore';
import Glass from '../common/Glass';

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

  // Descriptor line
  const descriptor = isRoot
    ? [spec.method, spec.glass, components?.length ? `${components.length} parts` : null].filter(Boolean).join(' · ')
    : spec.change_note ? `Fork · ${spec.change_note}` : 'Fork';

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

      {/* Row 2: Gauge row */}
      <div style={gaugeRow}>
        {/* GP conic ring — only once every component is priced. Pricing is optional,
            so the drink's composition (ABV, volume) leads until then. */}
        {costs?.fullyPriced ? (
          <div className="gp-gauge" style={{ '--gp': gpPct } as React.CSSProperties}>
            <div className="gp-gauge__inner">
              <span className="gp-gauge__num">{Math.round(gpPct)}</span>
              <span className="gp-gauge__unit">GP%</span>
            </div>
          </div>
        ) : (
          <div style={unpricedBadge}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9.5, fontWeight: 600, color: 'var(--mute)', letterSpacing: '0.04em' }}>
              unpriced
            </span>
          </div>
        )}

        {/* ABV + Volume readouts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span className="readout">
            <b>{costs ? costs.finalAbvPct.toFixed(1) : '—'}</b>
            <i>&nbsp;% ABV</i>
          </span>
          <span className="readout">
            <b>{costs ? Math.round(costs.finalVolumeMl) : '—'}</b>
            <i>&nbsp;ml</i>
          </span>
        </div>
      </div>

      {/* Footer: attribution + status */}
      <div style={footer}>
        <span style={attribution}>
          {spec.method || 'Spec'}
          {spec.glass ? <span style={{ color: 'var(--text-muted)' }}> · {spec.glass}</span> : null}
        </span>
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

const gaugeRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginTop: 13,
};

const unpricedBadge: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: '50%',
  border: '1px dashed rgba(255,255,255,.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  flexShrink: 0,
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
  fontFamily: 'var(--font-ui)',
  fontSize: 10.5,
  color: 'var(--text-2)',
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
