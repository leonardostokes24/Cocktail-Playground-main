import React, { useCallback, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SpecComponent } from '../../../store/useProofStore';
import { toMl, UNITS } from '../../../utils/units';
import { typeDot } from '../../common/typeDot';

interface Props {
  component: SpecComponent;
  isHead: boolean;
  isTail: boolean;
  onUpdate: (id: string, amountMl: number, originalAmount: number, originalUnit: string) => void;
  onRemove: (id: string) => void;
}

/**
 * One pourable line in the stack — an ingredient or a prep. They differ only in
 * what marks them (type dot vs prep badge), so one block covers both rather than
 * two near-identical components.
 */
export default function ComponentBlock({ component, isHead, isTail, onUpdate, onRemove }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: component.id });

  const isPrep = !!component.prep_id;
  const ref = isPrep ? component.preps : component.ingredients;
  const name = ref?.name ?? '—';
  // Unpriced (null cost) is distinct from free — pricing is optional.
  const costPerMl = ref?.cost_per_ml;
  const lineCost = costPerMl == null ? null : component.amount_ml * Number(costPerMl);

  const [amount, setAmount] = useState(String(component.original_amount ?? component.amount_ml));
  const [unit, setUnit] = useState(component.original_unit ?? 'ml');

  const commit = useCallback((nextAmount: string, nextUnit: string) => {
    const num = parseFloat(nextAmount);
    if (!(num > 0)) return;
    onUpdate(component.id, toMl(num, nextUnit), num, nextUnit);
  }, [component.id, onUpdate]);

  const classes = ['blk', isHead ? 'blk--head' : '', isTail ? 'blk--tail' : '', isDragging ? 'blk--dragging' : '']
    .filter(Boolean).join(' ');

  return (
    <div
      ref={setNodeRef}
      className={classes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '10px 10px 10px 12px',
        minHeight: 44, // touch target ⚑
      }}
    >
      {/* Drag handle — the whole block isn't draggable so the inputs stay usable */}
      <button
        {...attributes}
        {...listeners}
        style={grip}
        aria-label={`Reorder ${name}`}
      >
        ⠿
      </button>

      {isPrep
        ? <span style={prepBadge}>prep</span>
        : <span style={typeDot(component.ingredients?.type, 7)} />}

      <span style={nameStyle} title={name}>{name}</span>

      <input
        type="number" min={0} step="any" inputMode="decimal"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        onBlur={() => commit(amount, unit)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={amountInput}
        aria-label={`Amount of ${name}`}
      />
      <select
        value={unit}
        onChange={e => { setUnit(e.target.value); commit(amount, e.target.value); }}
        style={unitSelect}
        aria-label={`Unit for ${name}`}
      >
        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>

      <span style={costStyle}>{lineCost == null ? '—' : `£${lineCost.toFixed(3)}`}</span>

      <button onClick={() => onRemove(component.id)} style={removeBtn} aria-label={`Remove ${name}`}>✕</button>
    </div>
  );
}

const grip: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-muted)',
  cursor: 'grab', fontSize: 13, lineHeight: 1, padding: '4px 2px',
  flexShrink: 0, touchAction: 'none', // let the pointer sensor own the gesture
};

const prepBadge: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 8.5, fontWeight: 700, letterSpacing: '.06em',
  textTransform: 'uppercase', color: '#bfeeff',
  background: 'rgba(127,230,255,.12)', border: '1px solid rgba(127,230,255,.28)',
  borderRadius: 4, padding: '2px 5px', flexShrink: 0,
};

const nameStyle: React.CSSProperties = {
  flex: 1, minWidth: 0,
  fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const amountInput: React.CSSProperties = {
  width: 58, flexShrink: 0,
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 6, color: 'var(--text)',
  fontFamily: 'var(--font-mono)', fontSize: 12.5, padding: '6px 7px',
  outline: 'none', textAlign: 'right',
};

const unitSelect: React.CSSProperties = {
  width: 74, flexShrink: 0,
  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 6, color: 'var(--text-2)',
  fontFamily: 'var(--font-mono)', fontSize: 11.5, padding: '6px 5px', outline: 'none',
};

const costStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
  minWidth: 50, textAlign: 'right', flexShrink: 0,
};

const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-muted)',
  cursor: 'pointer', fontSize: 12, padding: '6px 4px', flexShrink: 0, opacity: .7,
};
