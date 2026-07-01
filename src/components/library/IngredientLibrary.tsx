import React, { useEffect, useState } from 'react';
import { useProofStore } from '../../store/useProofStore';
import type { Ingredient, IngredientInput } from '../../lib/supabase/queries';
import IngredientForm from './IngredientForm';

type Mode = { kind: 'idle' } | { kind: 'adding' } | { kind: 'editing'; ingredient: Ingredient };

interface Props {
  onClose: () => void;
}

export default function IngredientLibrary({ onClose }: Props) {
  const { ingredients, ingredientsLoading, ingredientsError, loadIngredients, addIngredient, editIngredient, removeIngredient } = useProofStore();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadIngredients(); }, []);

  const handleSave = async (input: IngredientInput) => {
    if (mode.kind === 'adding') {
      await addIngredient(input);
    } else if (mode.kind === 'editing') {
      await editIngredient(mode.ingredient.id, input);
    }
    setMode({ kind: 'idle' });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await removeIngredient(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={header}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Cost Library</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {mode.kind === 'idle' && (
            <button onClick={() => setMode({ kind: 'adding' })} style={btnAdd}>+ Add ingredient</button>
          )}
          <button onClick={onClose} style={btnClose}>✕</button>
        </div>
      </div>

      {/* Add / Edit form */}
      {mode.kind !== 'idle' && (
        <div style={{ padding: '0 16px 12px' }}>
          <IngredientForm
            initial={mode.kind === 'editing' ? mode.ingredient : undefined}
            onSave={handleSave}
            onCancel={() => setMode({ kind: 'idle' })}
          />
        </div>
      )}

      {/* Status */}
      {ingredientsLoading && <p style={msg}>Loading…</p>}
      {ingredientsError && <p style={{ ...msg, color: '#f87171' }}>Error: {ingredientsError}</p>}

      {/* Table */}
      {!ingredientsLoading && (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {ingredients.length === 0 ? (
            <p style={msg}>No ingredients yet — add one above.</p>
          ) : (
            <table style={table}>
              <thead>
                <tr>
                  {['Name', 'Type', 'ABV %', 'Pack ml', 'Cost £', '£/ml', ''].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => (
                  <tr key={ing.id} style={tr}>
                    <td style={td}>{ing.name}</td>
                    <td style={{ ...td, color: '#64748b' }}>{ing.type ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{ing.abv}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{ing.pack_size_ml}</td>
                    <td style={{ ...td, textAlign: 'right' }}>£{Number(ing.pack_cost).toFixed(2)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#10b981' }}>
                      £{Number(ing.cost_per_ml).toFixed(4)}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setMode({ kind: 'editing', ingredient: ing })}
                        style={btnIcon}
                        title="Edit"
                      >✏️</button>
                      <button
                        onClick={() => handleDelete(ing.id)}
                        disabled={deletingId === ing.id}
                        style={{ ...btnIcon, marginLeft: 4, opacity: deletingId === ing.id ? 0.5 : 1 }}
                        title="Delete"
                      >🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 680,
  background: 'rgba(10,15,28,0.97)', backdropFilter: 'blur(16px)',
  borderLeft: '1px solid #1e293b', zIndex: 3000,
  display: 'flex', flexDirection: 'column',
  boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
};

const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', borderBottom: '1px solid #1e293b', flexShrink: 0,
};

const msg: React.CSSProperties = { color: '#64748b', fontSize: 13, padding: '16px 20px' };

const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };

const th: React.CSSProperties = {
  color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
  letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'left',
  borderBottom: '1px solid #1e293b', position: 'sticky', top: 0,
  background: 'rgba(10,15,28,0.97)',
};

const td: React.CSSProperties = { padding: '8px 12px', color: '#e2e8f0', borderBottom: '1px solid #0f172a' };

const tr: React.CSSProperties = { transition: 'background 0.1s' };

const btnAdd: React.CSSProperties = {
  background: '#10b981', border: 'none', borderRadius: 6,
  color: 'white', fontSize: 12, fontWeight: 600, padding: '5px 12px', cursor: 'pointer',
};

const btnClose: React.CSSProperties = {
  background: 'rgba(30,41,59,0.8)', border: '1px solid #334155', borderRadius: 6,
  color: '#94a3b8', fontSize: 13, padding: '4px 10px', cursor: 'pointer',
};

const btnIcon: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px',
};
