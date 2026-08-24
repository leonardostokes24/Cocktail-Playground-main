import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProofStore, type Prep, type Ingredient } from '../../store/useProofStore';
import { toMl, UNITS } from '../../utils/units';
import { typeDot } from '../common/typeDot';
import { clampLines } from '../common/clampLines';

interface Props {
  onClose: () => void;
}

export default function PrepLibrary({ onClose }: Props) {
  const {
    preps, prepsLoading, prepCosts, ingredients, catalogueIngredients,
    loadPreps, loadPrepComponents, addPrep, removePrep,
    addPrepComponent, removePrepComponent,
    loadIngredients, loadCatalogueIngredients, importCatalogueIngredient,
  } = useProofStore(useShallow(s => ({
    preps: s.preps,
    prepsLoading: s.prepsLoading,
    prepCosts: s.prepCosts,
    ingredients: s.ingredients,
    catalogueIngredients: s.catalogueIngredients,
    loadPreps: s.loadPreps,
    loadPrepComponents: s.loadPrepComponents,
    addPrep: s.addPrep,
    removePrep: s.removePrep,
    addPrepComponent: s.addPrepComponent,
    removePrepComponent: s.removePrepComponent,
    loadIngredients: s.loadIngredients,
    loadCatalogueIngredients: s.loadCatalogueIngredients,
    importCatalogueIngredient: s.importCatalogueIngredient,
  })));

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [yieldMl, setYieldMl] = useState('500');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadPreps();
    loadIngredients();
    loadCatalogueIngredients();
  }, [loadPreps, loadIngredients, loadCatalogueIngredients]);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    const y = parseFloat(yieldMl);
    if (!trimmed || !(y > 0)) return;
    const prep = await addPrep({ name: trimmed, yield_ml: y });
    setName(''); setYieldMl('500'); setCreating(false);
    setExpandedId(prep.id);
  }, [name, yieldMl, addPrep]);

  const handleExpand = useCallback((id: string) => {
    setExpandedId(prev => {
      if (prev === id) return null;
      loadPrepComponents(id);
      return id;
    });
  }, [loadPrepComponents]);

  return (
    <div style={panel}>
      <div style={header}>
        <span className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Preps
        </span>
        <span style={{ flex: 1 }} />
        {!creating && (
          <button onClick={() => setCreating(true)} style={primaryBtn}>+ New prep</button>
        )}
        <button onClick={onClose} style={closeBtn} aria-label="Close">✕</button>
      </div>

      {creating && (
        <div style={createRow}>
          <input
            autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="Name — e.g. Simple syrup" style={{ ...input, flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
          />
          <div style={inputWrap}>
            <input
              type="number" min={1} step={10} value={yieldMl}
              onChange={e => setYieldMl(e.target.value)}
              style={{ ...input, width: 78, border: 'none', background: 'none' }}
              aria-label="Yield in millilitres"
            />
            <span style={suffix}>ml yield</span>
          </div>
          <button onClick={handleCreate} style={primaryBtn}>Create</button>
          <button onClick={() => setCreating(false)} style={ghostBtn}>Cancel</button>
        </div>
      )}

      <div style={list}>
        {prepsLoading && <p style={dim}>Loading…</p>}

        {!prepsLoading && preps.length === 0 && (
          <div style={empty}>
            <p style={{ ...dim, margin: 0 }}>No preps yet.</p>
            <p style={{ ...dim, margin: '6px 0 0', fontSize: 11.5 }}>
              A prep is a batch you make once and pour from — syrups, cordials, infusions.
            </p>
          </div>
        )}

        {!prepsLoading && preps.map(prep => (
          <PrepCard
            key={prep.id}
            prep={prep}
            cost={prepCosts[prep.id]}
            expanded={expandedId === prep.id}
            onExpand={handleExpand}
            confirming={confirmDeleteId === prep.id}
            onAskDelete={setConfirmDeleteId}
            onDelete={async (id) => { await removePrep(id); setConfirmDeleteId(null); }}
            ingredients={ingredients}
            catalogueIngredients={catalogueIngredients}
            onResolveCatalogue={importCatalogueIngredient}
            onAddComponent={addPrepComponent}
            onRemoveComponent={removePrepComponent}
          />
        ))}
      </div>
    </div>
  );
}

// ── Prep card ─────────────────────────────────────────────────────────────────

type PrepCostLike = { cost_per_ml: number; unpriced_count: number; component_count: number } | undefined;

interface CardProps {
  prep: Prep;
  cost: PrepCostLike;
  expanded: boolean;
  onExpand: (id: string) => void;
  confirming: boolean;
  onAskDelete: (id: string | null) => void;
  onDelete: (id: string) => Promise<void>;
  ingredients: Ingredient[];
  catalogueIngredients: { id: string; name: string; type: string }[];
  onResolveCatalogue: (catalogueId: string) => Promise<Ingredient>;
  onAddComponent: (input: { prep_id: string; ingredient_id: string; amount_ml: number; original_amount?: number | null; original_unit?: string | null; position?: number }) => Promise<void>;
  onRemoveComponent: (prepId: string, id: string) => Promise<void>;
}

function PrepCard(props: CardProps) {
  const {
    prep, cost, expanded, onExpand, confirming, onAskDelete, onDelete,
    ingredients, catalogueIngredients, onResolveCatalogue, onAddComponent, onRemoveComponent,
  } = props;

  const components = useProofStore(s => s.prepComponentsMap[prep.id]);
  const [selection, setSelection] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('ml');
  const [saving, setSaving] = useState(false);

  // A prep with any unpriced ingredient is unpriced — not cheap (⚑ 0007).
  const unpriced = !cost || cost.unpriced_count > 0 || cost.component_count === 0;

  const ownedCatalogueIds = useMemo(
    () => new Set(ingredients.map(i => i.catalogue_id).filter(Boolean) as string[]),
    [ingredients]
  );
  const availableCatalogue = useMemo(
    () => catalogueIngredients.filter(c => !ownedCatalogueIds.has(c.id)),
    [catalogueIngredients, ownedCatalogueIds]
  );

  const handleAdd = useCallback(async () => {
    const num = parseFloat(amount);
    if (!selection || !(num > 0)) return;
    setSaving(true);
    try {
      const ingredientId = selection.startsWith('cat:')
        ? (await onResolveCatalogue(selection.slice(4))).id
        : selection.slice(4);
      await onAddComponent({
        prep_id: prep.id,
        ingredient_id: ingredientId,
        amount_ml: toMl(num, unit),
        original_amount: num,
        original_unit: unit,
        position: components?.length ?? 0,
      });
      setSelection(''); setAmount('');
    } finally {
      setSaving(false);
    }
  }, [selection, amount, unit, onResolveCatalogue, onAddComponent, prep.id, components?.length]);

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => onExpand(prep.id)} style={expandBtn} aria-expanded={expanded}>
          {expanded ? '−' : '+'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...prepName, ...clampLines(2) }} title={prep.name}>{prep.name}</div>
          <div style={metaRow}>
            <span style={meta}>{prep.yield_ml} ml yield</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>·</span>
            <span style={{ ...meta, fontFamily: 'var(--font-mono)' }}>
              {unpriced ? 'unpriced' : `£${Number(cost!.cost_per_ml).toFixed(4)}/ml`}
            </span>
          </div>
        </div>
        {confirming ? (
          <>
            <button onClick={() => onDelete(prep.id)} style={dangerBtn}>Delete</button>
            <button onClick={() => onAskDelete(null)} style={ghostBtn}>Keep</button>
          </>
        ) : (
          <button onClick={() => onAskDelete(prep.id)} style={ghostBtn}>Delete</button>
        )}
      </div>

      {expanded && (
        <div style={expandWrap}>
          {!components && <p style={dim}>Loading…</p>}
          {components && components.length === 0 && (
            <p style={{ ...dim, margin: '0 0 8px' }}>Nothing in this batch yet — add the first ingredient.</p>
          )}
          {components?.map(c => (
            <div key={c.id} style={compRow}>
              <span style={typeDot(c.ingredients?.type)} />
              <span style={{ flex: 1, minWidth: 0, ...compName }}>{c.ingredients?.name ?? '—'}</span>
              <span style={compAmount}>
                {c.original_amount ?? c.amount_ml}&thinsp;{c.original_unit ?? 'ml'}
              </span>
              <span style={compCost}>
                {c.ingredients?.cost_per_ml == null
                  ? '—'
                  : `£${(c.amount_ml * Number(c.ingredients.cost_per_ml)).toFixed(3)}`}
              </span>
              <button onClick={() => onRemoveComponent(prep.id, c.id)} style={removeBtn} aria-label="Remove">✕</button>
            </div>
          ))}

          <div style={addRow}>
            <select value={selection} onChange={e => setSelection(e.target.value)} style={{ ...input, flex: 1 }}>
              <option value="">— add ingredient —</option>
              {ingredients.length > 0 && (
                <optgroup label="Your ingredients">
                  {ingredients.map(i => (
                    <option key={i.id} value={`own:${i.id}`}>
                      {i.name}{i.pack_cost == null ? ' · unpriced' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {availableCatalogue.length > 0 && (
                <optgroup label="Catalogue">
                  {availableCatalogue.map(c => (
                    <option key={c.id} value={`cat:${c.id}`}>{c.name} ({c.type})</option>
                  ))}
                </optgroup>
              )}
            </select>
            <input
              type="number" min={0} step="any" value={amount} placeholder="Amt"
              onChange={e => setAmount(e.target.value)} style={{ ...input, width: 70 }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...input, width: 84 }}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={handleAdd} disabled={saving || !selection} style={primaryBtn}>
              {saving ? '…' : 'Add'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles (glass system) ─────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, bottom: 0, width: 620,
  background: 'var(--panel-fill)', WebkitBackdropFilter: 'var(--glass-blur)',
  borderLeft: '1px solid rgba(255,255,255,.12)',
  boxShadow: 'inset 1px 0 0 rgba(120,225,255,.22), -14px 0 48px rgba(0,0,0,.65)',
  zIndex: 3000, display: 'flex', flexDirection: 'column',
};

const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0,
};

const createRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0,
};

const list: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 4,
};

const card: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  padding: '10px 12px', borderRadius: 9, background: 'rgba(255,255,255,.035)',
};

const prepName: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
};

const metaRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 };
const meta: React.CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)' };

const expandWrap: React.CSSProperties = {
  marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.08)',
};

const compRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
};

const compName: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text-2)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const compAmount: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-muted)',
  minWidth: 62, textAlign: 'right',
};

const compCost: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
  minWidth: 52, textAlign: 'right',
};

const addRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
  paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.06)',
};

const input: React.CSSProperties = {
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 7, color: 'var(--text)', fontFamily: 'var(--font-ui)', fontSize: 12,
  padding: '7px 9px', outline: 'none', minWidth: 0,
};

const inputWrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 2,
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 7, padding: '0 9px 0 0',
};

const suffix: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap',
};

const primaryBtn: React.CSSProperties = {
  background: 'rgba(127,230,255,.12)', border: '1px solid rgba(127,230,255,.3)',
  borderRadius: 7, color: 'var(--cyan)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: 600, padding: '7px 13px',
  whiteSpace: 'nowrap', flexShrink: 0,
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 11.5, padding: '7px 11px',
  whiteSpace: 'nowrap', flexShrink: 0,
};

const dangerBtn: React.CSSProperties = {
  ...ghostBtn, color: '#ff9d9d', borderColor: 'rgba(255,120,120,.35)',
  background: 'rgba(255,120,120,.12)', fontWeight: 600,
};

const expandBtn: React.CSSProperties = {
  width: 26, height: 26, flexShrink: 0,
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 7, color: 'var(--text-2)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 14, lineHeight: 1,
};

const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
  fontSize: 11, padding: '2px 4px', flexShrink: 0, opacity: 0.7,
};

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 14, padding: '4px 6px', flexShrink: 0,
};

const dim: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-muted)', padding: '4px 2px',
};

const empty: React.CSSProperties = { padding: '28px 16px', textAlign: 'center' };
