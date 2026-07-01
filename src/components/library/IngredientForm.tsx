import React, { useState } from 'react';
import type { Ingredient, IngredientInput } from '../../lib/supabase/queries';

const TYPES = ['spirit', 'liqueur', 'vermouth', 'amaro', 'juice', 'syrup', 'bitters', 'mixer', 'other'];

const BLANK: IngredientInput = { name: '', type: null, abv: 0, pack_size_ml: 700, pack_cost: 0 };

interface Props {
  initial?: Ingredient;
  onSave: (input: IngredientInput) => Promise<void>;
  onCancel: () => void;
}

export default function IngredientForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm] = useState<IngredientInput>(
    initial
      ? { name: initial.name, type: initial.type, abv: initial.abv, pack_size_ml: initial.pack_size_ml, pack_cost: initial.pack_cost }
      : BLANK
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<IngredientInput>) => setForm((f) => ({ ...f, ...patch }));

  const costPerMl = form.pack_size_ml > 0 ? (form.pack_cost / form.pack_size_ml) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.pack_size_ml <= 0) { setError('Pack size must be > 0'); return; }
    setSaving(true);
    try {
      await onSave({ ...form, name: form.name.trim(), type: form.type || null });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.row}>
        <label style={styles.label}>Name</label>
        <input
          style={styles.input}
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Tanqueray London Dry"
          autoFocus
        />
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Type</label>
        <select style={styles.select} value={form.type ?? ''} onChange={(e) => set({ type: e.target.value || null })}>
          <option value="">— select —</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{ ...styles.row, gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>ABV %</label>
          <input style={styles.input} type="number" min={0} max={100} step={0.1}
            value={form.abv} onChange={(e) => set({ abv: parseFloat(e.target.value) || 0 })} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Pack size (ml)</label>
          <input style={styles.input} type="number" min={1} step={1}
            value={form.pack_size_ml} onChange={(e) => set({ pack_size_ml: parseFloat(e.target.value) || 0 })} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Pack cost (£)</label>
          <input style={styles.input} type="number" min={0} step={0.01}
            value={form.pack_cost} onChange={(e) => set({ pack_cost: parseFloat(e.target.value) || 0 })} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={styles.label}>Cost / ml</label>
          <input style={{ ...styles.input, color: '#94a3b8', cursor: 'not-allowed' }}
            readOnly value={`£${costPerMl.toFixed(4)}`} />
        </div>
      </div>

      {error && <p style={{ color: '#f87171', fontSize: 12, margin: '4px 0 0' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" onClick={onCancel} style={styles.btnSecondary}>Cancel</button>
        <button type="submit" disabled={saving} style={styles.btnPrimary}>
          {saving ? 'Saving…' : initial ? 'Update' : 'Add ingredient'}
        </button>
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex', flexDirection: 'column', gap: 10,
    background: 'rgba(15,23,42,0.8)', border: '1px solid #1e293b',
    borderRadius: 10, padding: 14,
  },
  row: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    background: 'rgba(30,41,59,0.8)', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', fontSize: 13, padding: '5px 8px', outline: 'none', width: '100%',
  },
  select: {
    background: 'rgba(30,41,59,0.8)', border: '1px solid #334155', borderRadius: 6,
    color: '#e2e8f0', fontSize: 13, padding: '5px 8px', outline: 'none', width: '100%',
  },
  btnPrimary: {
    background: '#10b981', border: 'none', borderRadius: 6, color: 'white',
    fontSize: 13, fontWeight: 600, padding: '6px 14px', cursor: 'pointer',
  },
  btnSecondary: {
    background: 'rgba(30,41,59,0.8)', border: '1px solid #334155', borderRadius: 6,
    color: '#94a3b8', fontSize: 13, padding: '6px 14px', cursor: 'pointer',
  },
};
