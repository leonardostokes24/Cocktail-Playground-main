import React, { useState } from 'react';
import { toMl, UNITS } from '../../utils/units';
import type { Ingredient } from '../../store/useProofStore';

interface Props {
  ingredients: Ingredient[];
  nextPosition: number;
  specId: string;
  onAdd: (payload: {
    spec_id: string; ingredient_id: string; amount_ml: number;
    original_amount: number; original_unit: string; position: number;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function AddComponentForm({ ingredients, nextPosition, specId, onAdd, onCancel }: Props) {
  const [ingredientId, setIngredientId] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('ml');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = ingredients.find((i) => i.id === ingredientId);
  const amountNum = parseFloat(amount);
  const previewMl = selected && amountNum > 0 ? toMl(amountNum, unit) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredientId) { setError('Select an ingredient'); return; }
    if (!amountNum || amountNum <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true);
    try {
      await onAdd({
        spec_id: specId,
        ingredient_id: ingredientId,
        amount_ml: toMl(amountNum, unit),
        original_amount: amountNum,
        original_unit: unit,
        position: nextPosition,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <select style={inp} value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} autoFocus>
        <option value="">— select ingredient —</option>
        {ingredients.map((i) => (
          <option key={i.id} value={i.id}>{i.name}{i.type ? ` (${i.type})` : ''}</option>
        ))}
      </select>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          style={{ ...inp, width: 80 }}
          type="number" min={0} step="any"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select style={{ ...inp, width: 86, cursor: 'pointer' }} value={unit} onChange={(e) => setUnit(e.target.value)}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        {previewMl != null && (
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--mute)', fontSize: 11, whiteSpace: 'nowrap' }}>
            = {previewMl.toFixed(1)} ml
          </span>
        )}
      </div>

      {error && <span style={{ fontFamily: 'var(--font-ui)', color: '#f87171', fontSize: 12 }}>{error}</span>}

      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" disabled={saving} style={addBtn}>{saving ? '…' : 'Add'}</button>
        <button type="button" onClick={onCancel} style={cancelBtn}>Cancel</button>
      </div>
    </form>
  );
}

const formStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--glass-border)',
  borderRadius: 9, padding: '10px 12px',
};

const inp: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--glass-border)',
  borderRadius: 6, color: 'var(--ink)',
  fontFamily: 'var(--font-ui)', fontSize: 13,
  padding: '5px 8px', outline: 'none', width: '100%',
  boxSizing: 'border-box' as const,
};

const addBtn: React.CSSProperties = {
  background: 'rgba(127,230,255,0.12)', border: '1px solid rgba(127,230,255,0.28)',
  borderRadius: 6, color: 'var(--cyan)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, padding: '5px 16px',
};

const cancelBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
  borderRadius: 6, color: 'var(--mute)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 13, padding: '5px 12px',
};
