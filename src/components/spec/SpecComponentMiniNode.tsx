import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { toMl, UNITS } from '../../utils/units';
import type { SpecComponent } from '../../store/useProofStore';

export type SpecComponentMiniData = {
  component: SpecComponent;
  onUpdate: (id: string, amountMl: number, originalAmount: number, originalUnit: string) => void;
  onRemove: (id: string) => void;
};

function SpecComponentMiniNode({ data }: { data: SpecComponentMiniData }) {
  const { component, onUpdate, onRemove } = data;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(component.original_amount ?? component.amount_ml));
  const [unit, setUnit] = useState(component.original_unit ?? 'ml');

  const ing = component.ingredients;
  const rowCost = component.amount_ml * Number(ing?.cost_per_ml ?? 0);

  const save = () => {
    const num = parseFloat(amount);
    if (num > 0) onUpdate(component.id, toMl(num, unit), num, unit);
    setEditing(false);
  };

  return (
    <div style={card}>
      <Handle type="target" position={Position.Left} style={handle} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={ingName}>{ing?.name ?? '—'}</div>
          {ing?.type && <div style={type}>{ing.type}</div>}
        </div>
        <button onClick={() => onRemove(component.id)} style={delBtn} title="Remove">✕</button>
      </div>

      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        {editing ? (
          <>
            <input
              autoFocus
              style={{ ...miniInp, width: 52 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            />
            <select style={{ ...miniInp, width: 62 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={save} style={saveBtn}>✓</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} style={amtBtn} title="Click to edit">
              {component.original_amount ?? component.amount_ml}{' '}{component.original_unit ?? 'ml'}
            </button>
            <span style={costBadge}>£{rowCost.toFixed(3)}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(SpecComponentMiniNode);

const card: React.CSSProperties = {
  background: 'rgba(15,23,42,0.95)', border: '1px solid #1e293b',
  borderRadius: 10, padding: '9px 11px', width: 178,
  boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
};
const ingName: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 };
const type: React.CSSProperties = { fontSize: 10, color: '#475569', marginTop: 1 };
const delBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 11, padding: 0, flexShrink: 0 };
const miniInp: React.CSSProperties = { background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 11, padding: '2px 5px' };
const amtBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12, padding: 0 };
const saveBtn: React.CSSProperties = { background: '#10b981', border: 'none', borderRadius: 4, color: 'white', cursor: 'pointer', fontSize: 10, padding: '2px 5px' };
const costBadge: React.CSSProperties = { fontSize: 10, color: '#10b981', marginLeft: 'auto' };
const handle: React.CSSProperties = { background: '#334155', border: '1.5px solid #475569', width: 8, height: 8 };
