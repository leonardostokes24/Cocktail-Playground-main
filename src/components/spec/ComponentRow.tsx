import React, { useState } from 'react';
import { toMl, UNITS } from '../../utils/units';
import type { SpecComponent } from '../../store/useProofStore';

interface Props {
  component: SpecComponent;
  onUpdate: (id: string, amountMl: number, originalAmount: number, originalUnit: string) => void;
  onRemove: (id: string) => void;
}

export default function ComponentRow({ component, onUpdate, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(component.original_amount ?? component.amount_ml));
  const [unit, setUnit] = useState(component.original_unit ?? 'ml');
  const [hovered, setHovered] = useState(false);

  const ing = component.ingredients;
  const rowCost = component.amount_ml * Number(ing?.cost_per_ml ?? 0);

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { setEditing(false); return; }
    onUpdate(component.id, toMl(num, unit), num, unit);
    setEditing(false);
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 7,
        background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Name + type */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ing?.name ?? '—'}
        </span>
        {ing?.type && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            {ing.type}
          </span>
        )}
      </div>

      {/* Amount (editable) */}
      {editing ? (
        <span style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <input
            autoFocus
            type="number"
            min={0}
            step="any"
            style={miniInp}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          />
          <select style={{ ...miniInp, cursor: 'pointer' }} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={handleSave} style={confirmBtn}>✓</button>
          <button onClick={() => setEditing(false)} style={cancelBtn}>✕</button>
        </span>
      ) : (
        <button onClick={() => setEditing(true)} style={amtBtn} title="Click to edit">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--mute)' }}>
            {component.original_amount ?? component.amount_ml}&thinsp;{component.original_unit ?? 'ml'}
          </span>
        </button>
      )}

      {/* Cost */}
      {!editing && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--mute)', whiteSpace: 'nowrap', minWidth: 48, textAlign: 'right' }}>
          £{rowCost.toFixed(3)}
        </span>
      )}

      {/* Remove */}
      <button onClick={() => onRemove(component.id)} style={delBtn} title="Remove">✕</button>
    </div>
  );
}

const miniInp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--glass-border)',
  borderRadius: 5, color: 'var(--ink)',
  fontFamily: 'var(--font-mono)', fontSize: 12, padding: '3px 6px',
  outline: 'none', width: 56,
};

const amtBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '2px 4px', borderRadius: 4, flexShrink: 0,
};

const confirmBtn: React.CSSProperties = {
  background: 'rgba(127,230,255,0.12)', border: '1px solid rgba(127,230,255,0.28)',
  borderRadius: 5, color: 'var(--cyan)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, padding: '2px 7px',
};

const cancelBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
  borderRadius: 5, color: 'var(--mute)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 11, padding: '2px 6px',
};

const delBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--mute)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 11, padding: '2px 4px', flexShrink: 0,
  opacity: 0.6,
};
