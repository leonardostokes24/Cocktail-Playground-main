import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Spec, SpecInput } from '../../store/useProofStore';
import { METHODS } from '../../utils/calculations';

export type SpecRootData = {
  spec: Spec;
  onSave: (patch: Partial<SpecInput>) => void;
  onAddComponent: () => void;
};

function SpecRootNode({ data }: { data: SpecRootData }) {
  const { spec, onSave, onAddComponent } = data;
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(spec.name);

  const saveName = () => {
    const t = nameDraft.trim();
    if (t && t !== spec.name) onSave({ name: t });
    setEditingName(false);
  };

  return (
    <div style={card}>
      {/* Name */}
      {editingName ? (
        <input
          autoFocus
          style={nameInput}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
        />
      ) : (
        <div style={name} onClick={() => { setNameDraft(spec.name); setEditingName(true); }} title="Click to rename">
          {spec.name}
        </div>
      )}

      {/* Method + glass */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <select
          style={sel}
          value={spec.method ?? ''}
          onChange={(e) => onSave({ method: e.target.value || null })}
        >
          <option value="">— method —</option>
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          style={{ ...sel, flex: 1 }}
          value={spec.glass ?? ''}
          placeholder="glass"
          onChange={(e) => onSave({ glass: e.target.value || null })}
        />
      </div>

      {/* Add component */}
      <button onClick={onAddComponent} style={addBtn}>+ Add ingredient</button>

      <Handle type="source" position={Position.Right} style={handle} />
    </div>
  );
}

export default memo(SpecRootNode);

const card: React.CSSProperties = {
  background: 'rgba(15,23,42,0.98)', border: '1.5px solid #1e293b',
  borderRadius: 12, padding: '12px 14px', width: 200,
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
};
const name: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: '#e2e8f0',
  cursor: 'text', lineHeight: 1.3,
};
const nameInput: React.CSSProperties = {
  background: 'transparent', border: 'none', borderBottom: '1px solid #10b981',
  color: '#e2e8f0', fontSize: 14, fontWeight: 700, outline: 'none', width: '100%',
};
const sel: React.CSSProperties = {
  background: '#0f172a', border: '1px solid #334155', borderRadius: 5,
  color: '#94a3b8', fontSize: 11, padding: '3px 6px', outline: 'none',
};
const addBtn: React.CSSProperties = {
  marginTop: 10, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
  borderRadius: 6, color: '#10b981', cursor: 'pointer', fontSize: 11,
  fontWeight: 600, padding: '4px 10px', width: '100%',
};
const handle: React.CSSProperties = { background: '#334155', border: '1.5px solid #475569', width: 8, height: 8 };
