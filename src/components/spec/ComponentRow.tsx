import React from 'react';
import { typeDot } from '../common/typeDot';
import type { SpecComponent } from '../../store/useProofStore';

interface Props {
  component: SpecComponent;
}

/**
 * Read-only summary of one recipe line in the spec drawer. Editing lives in the
 * block builder (`components/builder/RecipeBuilder.tsx`) — this is the at-a-glance
 * view that keeps per-line costs next to the drawer's costing breakdown.
 */
export default function ComponentRow({ component }: Props) {
  const isPrep = !!component.prep_id;
  const ref = isPrep ? component.preps : component.ingredients;
  const name = ref?.name ?? '—';
  // Unpriced (cost_per_ml null) is distinct from free — pricing is optional.
  const rowCost = ref?.cost_per_ml == null ? null : component.amount_ml * Number(ref.cost_per_ml);

  return (
    <div style={row}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
        {isPrep
          ? <span style={prepBadge}>prep</span>
          : <span style={typeDot(component.ingredients?.type)} />}
        <span style={nameStyle} title={name}>{name}</span>
      </div>

      <span style={amountStyle}>
        {component.original_amount ?? component.amount_ml}&thinsp;{component.original_unit ?? 'ml'}
      </span>

      <span style={costStyle}>{rowCost == null ? '—' : `£${rowCost.toFixed(3)}`}</span>
    </div>
  );
}

const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7,
};

const nameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};

const prepBadge: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 8, fontWeight: 700, letterSpacing: '.06em',
  textTransform: 'uppercase', color: '#bfeeff',
  background: 'rgba(127,230,255,.12)', border: '1px solid rgba(127,230,255,.28)',
  borderRadius: 4, padding: '2px 4px', flexShrink: 0,
};

const amountStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)',
  flexShrink: 0, minWidth: 62, textAlign: 'right',
};

const costStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
  whiteSpace: 'nowrap', minWidth: 48, textAlign: 'right', flexShrink: 0,
};
