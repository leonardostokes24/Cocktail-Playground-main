import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { UNITS } from '../../utils/units';
import { useProofStore } from '../../store/useProofStore';
import { childCounts } from '../../utils/childCounts';
import { searchCatalogueIngredients } from '../../lib/supabase/catalogue';
import { toMl } from '../../utils/units';
import { computeSpecCosts } from '../../utils/calculations';

/**
 * The floating action menu from Claude Design "Proof New UI" 8a.
 *
 * 8a draws it always-on-screen; here it opens and closes like a normal menu —
 * right-click or ⌘K to summon it at the pointer, escape or a click outside to
 * dismiss, and it closes itself once an action has run. What it keeps from 8a
 * is everything else: it names its target, never covers it, and the field acts
 * or searches depending on what you type.
 *
 * ⌥-drag the header to move it, ⌘. to pin it where you left it.
 */

type ActionId =
  | 'branch' | 'add' | 'group' | 'open'
  | 'duplicate' | 'to-prep' | 'publish' | 'delete';

type Action = {
  id: ActionId;
  label: string;
  accent?: boolean;
  /** Rendered but inert — the underlying capability doesn't exist yet. */
  soon?: boolean;
};

const ACTIONS: Action[] = [
  { id: 'branch',    label: 'Branch' },
  { id: 'add',       label: 'Add component' },
  // Tidy lives in the dock; this slot carries the one thing the canvas can't
  // derive for you — a group you meant.
  { id: 'group',     label: 'New group' },
  { id: 'open',      label: 'Open recipe' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'to-prep',   label: 'Convert to prep' },
  { id: 'publish',   label: 'Publish', accent: true },
  { id: 'delete',    label: 'Delete', accent: true },
];

const PIN_KEY = 'proof_menu_pin';
const MENU_W = 320;

/** A right-click summons the menu to the pointer. The nonce makes two
 *  right-clicks at the same point still register as two separate summons. */
export type Summon = { x: number; y: number; nonce: number };

interface Props {
  onNewSpec: () => void;
  /** Canvas selection, so "New group" can gather more than the menu's target. */
  selectedIds: string[];
  /** 'Open recipe' is the only route to the full editing panel now. */
  onOpenRecipe: (opts?: { builder?: boolean }) => void;
  summon: Summon | null;
}

export default function SelectionMenu({ onNewSpec, onOpenRecipe, summon, selectedIds }: Props) {
  const specs        = useProofStore(s => s.specs);
  const selectedId   = useProofStore(s => s.selectedSpecId);
  const selectSpec   = useProofStore(s => s.selectSpec);
  const branchSpec   = useProofStore(s => s.branchSpec);
  const publishSpec  = useProofStore(s => s.publishSpec);
  const removeSpec   = useProofStore(s => s.removeSpec);
  const duplicate    = useProofStore(s => s.duplicateSpecs);
  const createGroupFrom = useProofStore(s => s.createGroupFrom);
  const ingredients  = useProofStore(s => s.ingredients);
  const recentIds    = useProofStore(s => s.recentIngredientIds);
  const componentsMap = useProofStore(s => s.specComponentsMap);
  const addComponent = useProofStore(s => s.addComponent);
  const importCatalogue = useProofStore(s => s.importCatalogueIngredient);
  const addPrep      = useProofStore(s => s.addPrep);
  const addPrepComponent = useProofStore(s => s.addPrepComponent);
  const dilution     = useProofStore(s => s.dilutionOverrides);
  const sundries     = useProofStore(s => s.sundriesPerServe);
  const wasteRate    = useProofStore(s => s.wasteRate);

  const { flowToScreenPosition } = useReactFlow();
  const viewport = useViewport();

  const [query, setQuery] = useState('');
  // Keep typing past the actions and the field becomes an ingredient search —
  // 8a's own lineage (6a/6b) is exactly this: type to act, keep typing to find.
  const [catalogueHits, setCatalogueHits] = useState<{ id: string; name: string; type: string | null }[]>([]);
  const [pending, setPending] = useState<{ id: string; name: string; catalogue: boolean } | null>(null);
  const [amount, setAmount] = useState('30');
  const [unit, setUnit] = useState('ml');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pinned, setPinned] = useState<{ x: number; y: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem(PIN_KEY) ?? 'null'); } catch { return null; }
  });
  // Where a right-click put it. Outranks the tether, yields to an explicit pin.
  const [summoned, setSummoned] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<{ dx: number; dy: number } | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const spec = specs.find(s => s.id === selectedId) ?? null;
  const detaching = spec ? (childCounts(specs)[spec.id] ?? 0) : 0;

  // Index in the same creation order the node headers use, so "spec 02" on the
  // menu and "02" on the card are the same number.
  const specIndex = useMemo(() => {
    if (!spec) return 0;
    const ordered = [...specs].sort((a, b) =>
      a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at));
    return ordered.findIndex(s => s.id === spec.id) + 1;
  }, [specs, spec]);

  // A changed target invalidates a pending delete and the typed query.
  useEffect(() => { setConfirmDelete(false); setQuery(''); }, [selectedId]);

  // A right-click drops the menu at the pointer and puts the cursor in the
  // field, so the same gesture that used to open the radial now opens a
  // command line onto the thing under it.
  useEffect(() => {
    if (!summon) return;
    const clampedX = Math.min(Math.max(12, summon.x), window.innerWidth - MENU_W - 12);
    const clampedY = Math.min(Math.max(64, summon.y), window.innerHeight - 380);
    // A right-click is an explicit "come here", so it outranks — and clears — a
    // pin. Without this, pinning once meant right-click could never move the
    // menu again, which reads as the gesture being broken.
    setPinned(null);
    try { localStorage.removeItem(PIN_KEY); } catch { /* private mode */ }
    setSummoned({ x: clampedX, y: clampedY });
    setOpen(true);
    setPending(null);
    setConfirmDelete(false);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [summon]);

  // ── Position: beside the target, flipping rather than covering it ──────────
  const anchored = useMemo(() => {
    if (pinned) return pinned;
    if (summoned) return summoned;
    if (!spec) return { x: window.innerWidth - MENU_W - 32, y: 96 };
    const p = flowToScreenPosition({ x: spec.canvas_x, y: spec.canvas_y });
    const right = p.x + 244 * viewport.zoom + 28;
    const wouldOverflow = right + MENU_W > window.innerWidth - 16;
    return {
      x: wouldOverflow ? Math.max(16, p.x - MENU_W - 28) : right,
      y: Math.min(Math.max(72, p.y), window.innerHeight - 380),
    };
  }, [pinned, summoned, spec, flowToScreenPosition, viewport]);

  // ── Keyboard: ⌘K focuses, ⌘. pins/unpins ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === 'Escape' && open) {
        // The field handles its own escape first (back out of the amount step).
        if (document.activeElement === inputRef.current) return;
        setOpen(false);
      }
      if (meta && e.key === '.') {
        e.preventDefault();
        setPinned(prev => {
          const next = prev ? null : anchored;
          try { localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
          return next;
        });
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!open) return;
      if (shellRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [anchored, open]);

  // ── ⌥-drag the header to move it ───────────────────────────────────────────
  const onHeaderDown = useCallback((e: React.PointerEvent) => {
    if (!e.altKey) return;
    e.preventDefault();
    dragFrom.current = { dx: e.clientX - anchored.x, dy: e.clientY - anchored.y };
    const move = (ev: PointerEvent) => {
      if (!dragFrom.current) return;
      setPinned({ x: ev.clientX - dragFrom.current.dx, y: ev.clientY - dragFrom.current.dy });
    };
    const up = () => {
      dragFrom.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPinned(p => {
        try { localStorage.setItem(PIN_KEY, JSON.stringify(p)); } catch { /* private mode */ }
        return p;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [anchored]);

  // ── Running an action ──────────────────────────────────────────────────────
  const run = useCallback(async (a: Action) => {
    if (a.soon || busy) return;
    if (!spec) { if (a.id === 'branch') onNewSpec(); return; }

    if (a.id === 'delete' && !confirmDelete) { setConfirmDelete(true); return; }

    setBusy(true);
    setError(null);
    try {
      switch (a.id) {
        case 'branch':    await branchSpec(spec.id); break;
        case 'open':      selectSpec(spec.id); onOpenRecipe(); break;
        case 'add':       selectSpec(spec.id); onOpenRecipe({ builder: true }); break;
        case 'duplicate': await duplicate([spec.id]); break;
        case 'group': {
          // Group the whole selection if there is one, otherwise just this spec.
          const ids = selectedIds.length ? selectedIds : [spec.id];
          await createGroupFrom(ids, spec.name);
          break;
        }
        case 'to-prep': {
          // A prep is a batch, so its yield is the spec's finished volume —
          // dilution included, because that is what actually ends up in the jar.
          const comps = componentsMap[spec.id] ?? [];
          if (!comps.length) break;
          const costs = computeSpecCosts(spec.method, spec.sale_price, comps, dilution,
            { sundriesPerServe: sundries, wasteRate });
          const prep = await addPrep({
            name: spec.name,
            yield_ml: Math.max(1, Math.round(costs.finalVolumeMl)),
            method: spec.method,
            notes: `Converted from spec "${spec.name}".`,
          });
          // prep_components take ingredients only — no nesting (⚑). A prep
          // component inside the spec can't travel, so it is skipped rather
          // than flattened into something the costing would double-count.
          let pos = 0;
          for (const c of comps) {
            if (!c.ingredient_id) continue;
            await addPrepComponent({
              prep_id: prep.id,
              ingredient_id: c.ingredient_id,
              amount_ml: c.amount_ml,
              original_amount: c.original_amount,
              original_unit: c.original_unit,
              position: pos++,
            });
          }
          break;
        }
        case 'publish':   await publishSpec(spec.id); break;
        case 'delete':    await removeSpec(spec.id); break;
      }
    } catch (err) {
      // An action that fails must say so — closing silently reads as "done".
      setError(err instanceof Error ? err.message : 'That action failed');
      setBusy(false);
      return;
    } finally {
      setConfirmDelete(false);
    }
    setBusy(false);
    setQuery('');
    setOpen(false);
  }, [spec, specs, busy, confirmDelete, branchSpec, selectSpec, duplicate, createGroupFrom, selectedIds, componentsMap,
      dilution, sundries, wasteRate, addPrep, addPrepComponent, publishSpec, removeSpec, onNewSpec, onOpenRecipe]);

  const q = query.trim().toLowerCase();

  // Typing filters the actions first — they are what you usually want.
  const matches = q ? ACTIONS.filter(a => a.label.toLowerCase().includes(q)) : ACTIONS;

  // Catalogue lookup is remote, so it streams in beside the local list rather
  // than blocking it. A failure is silent: the catalogue is a bonus, never a gate.
  useEffect(() => {
    if (!q || !spec) { setCatalogueHits([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      searchCatalogueIngredients(q)
        .then(rows => { if (!cancelled) setCatalogueHits(rows.map(r => ({ id: r.id, name: r.name, type: r.type }))); })
        .catch(() => { if (!cancelled) setCatalogueHits([]); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, spec]);

  // ⚑ Recents first, then everything else. Catalogue entries you don't own are
  // appended and imported unpriced on the way in.
  const results = useMemo(() => {
    if (!q || !spec) return [];
    const rank = new Map(recentIds.map((id, i) => [id, i]));
    const own = ingredients
      .filter(i => i.name.toLowerCase().includes(q))
      .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
      .map(i => ({ id: i.id, name: i.name, type: i.type, catalogue: false }));
    const ownNames = new Set(own.map(o => o.name.toLowerCase()));
    const fromCatalogue = catalogueHits
      .filter(c => !ownNames.has(c.name.toLowerCase()))
      .map(c => ({ id: c.id, name: c.name, type: c.type, catalogue: true }));
    return [...own, ...fromCatalogue].slice(0, 6);
  }, [q, spec, ingredients, recentIds, catalogueHits]);

  const commitAmount = useCallback(async () => {
    if (!spec || !pending) return;
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setBusy(true);
    try {
      // A catalogue pick isn't yours yet — import it unpriced first. ⚑ The
      // shared catalogue's suggested price is never adopted on your behalf.
      const ingredientId = pending.catalogue
        ? (await importCatalogue(pending.id, null)).id
        : pending.id;
      await addComponent({
        spec_id: spec.id,
        ingredient_id: ingredientId,
        prep_id: null,
        amount_ml: toMl(n, unit),
        original_amount: n,
        original_unit: unit,
        position: componentsMap[spec.id]?.length ?? 0,
      });
      setPending(null);
      setQuery('');
      setAmount('30');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }, [spec, pending, amount, unit, importCatalogue, addComponent, componentsMap]);

  const onFieldKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (pending) { setPending(null); return; }
      if (query) { setQuery(''); return; }
      setOpen(false);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Actions win over ingredients — "del" should delete, not find Delicata.
    if (matches.length) { run(matches[0]); return; }
    if (results.length) setPending({ id: results[0].id, name: results[0].name, catalogue: results[0].catalogue });
  }, [matches, results, pending, query, run]);

  if (!open) return null;

  return (
    <div ref={shellRef} style={{ ...shell, left: anchored.x, top: anchored.y }} className="nodrag nopan">
      <div style={header} onPointerDown={onHeaderDown}>
        <span>acting on</span>
        <span style={{ opacity: .72 }}>⌥ drag · ⌘. {pinned ? 'unpin' : 'pin'} · esc close</span>
      </div>

      <div style={targetRow}>
        <span style={targetName}>{spec ? spec.name : 'Nothing selected'}</span>
        <span style={targetMeta}>
          {spec ? `spec ${String(specIndex).padStart(2, '0')}` : 'empty canvas'}
        </span>
      </div>

      <div style={fieldRow}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onFieldKey}
          placeholder="Type to act or search"
          style={field}
        />
        <span style={fieldHint}>⌘K</span>
      </div>

      {pending ? (
        <div style={amountBox}>
          <div style={amountName}>{pending.name}{pending.catalogue && <span style={importTag}>import</span>}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              autoFocus type="number" min={0} step="any" value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitAmount(); }
                                if (e.key === 'Escape') setPending(null); }}
              style={amountInput}
            />
            <select value={unit} onChange={e => setUnit(e.target.value)} style={unitSelect}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={commitAmount} disabled={busy} style={addBtn}>{busy ? 'Adding…' : 'Add'}</button>
            <button onClick={() => setPending(null)} style={backBtn}>Back</button>
          </div>
        </div>
      ) : results.length ? (
        <div style={resultList}>
          {results.map(r => (
            <button key={`${r.catalogue}:${r.id}`}
                    onClick={() => setPending({ id: r.id, name: r.name, catalogue: r.catalogue })}
                    style={resultRow}>
              <span style={{ flex: 1, textAlign: 'left' }}>{r.name}</span>
              {r.type && <span style={resultType}>{r.type}</span>}
              {r.catalogue && <span style={importTag}>import</span>}
            </button>
          ))}
        </div>
      ) : null}

      <div style={grid}>
        {matches.map((a, i) => {
          const isDeleteArmed = a.id === 'delete' && confirmDelete;
          return (
            <button
              key={a.id}
              onClick={() => run(a)}
              disabled={a.soon || busy || (!spec && a.id !== 'branch')}
              title={a.soon ? 'Not built yet' : undefined}
              style={cell(i, matches.length, {
                accent: a.accent,
                soon: a.soon,
                inert: !spec && a.id !== 'branch',
                armed: isDeleteArmed,
              })}
            >
              {isDeleteArmed
                ? (detaching ? `Delete? ${detaching} detach` : 'Delete?')
                : (!spec && a.id === 'branch') ? 'New spec'
                : a.label}
              {a.soon && <span style={soonTag}>soon</span>}
            </button>
          );
        })}
      </div>

      {error && <div style={errorRow}>{error}</div>}

      <div style={footer}>
        {pending ? '↵ to add · esc to go back'
          : results.length ? `${results.length} ingredient${results.length > 1 ? 's' : ''} · ↵ adds the first`
          : spec ? 'type to act or search · esc to close'
          : 'empty canvas → new spec'}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shell: React.CSSProperties = {
  position: 'fixed',
  width: MENU_W,
  zIndex: 55,
  background: 'var(--card)',
  border: '1px solid var(--ink)',
  boxShadow: 'var(--lift-lg)',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '9px 15px',
  background: 'var(--ink)',
  color: 'var(--on-ink)',
  font: '400 10px/1 var(--font-mono)',
  letterSpacing: '.1em',
  cursor: 'grab',
  userSelect: 'none',
};

const targetRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 10,
  padding: '12px 15px 11px',
  borderBottom: '1px solid rgba(26,26,23,.2)',
};

const targetName: React.CSSProperties = {
  font: '500 19px/1.05 var(--font-display)',
  color: 'var(--ink)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const targetMeta: React.CSSProperties = {
  font: '400 9.5px/1 var(--font-mono)',
  color: 'var(--ink-72)',
  flexShrink: 0,
};

const fieldRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '11px 15px',
  borderBottom: '1px solid rgba(26,26,23,.2)',
};

const field: React.CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  outline: 'none',
  font: '400 17px/1 var(--font-display)',
  color: 'var(--ink)',
  padding: 0,
};

const fieldHint: React.CSSProperties = {
  font: '400 9.5px/1 var(--font-mono)',
  color: 'var(--ink-72)',
  flexShrink: 0,
  paddingLeft: 8,
};

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
};

const cell = (
  i: number,
  total: number,
  o: { accent?: boolean; soon?: boolean; inert?: boolean; armed?: boolean },
): React.CSSProperties => {
  const lastRow = i >= total - (total % 2 === 0 ? 2 : 1);
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    textAlign: 'left',
    padding: '11px 15px',
    background: o.armed ? 'var(--accent)' : 'none',
    color: o.armed ? 'var(--on-ink)' : o.accent ? 'var(--accent)' : 'var(--ink)',
    border: 'none',
    borderRight: i % 2 === 0 ? '1px solid rgba(26,26,23,.12)' : 'none',
    borderBottom: lastRow ? 'none' : '1px solid rgba(26,26,23,.12)',
    font: '400 13px/1 var(--font-display)',
    cursor: o.soon || o.inert ? 'default' : 'pointer',
    opacity: o.soon || o.inert ? .38 : 1,
  };
};

const soonTag: React.CSSProperties = {
  font: '400 8.5px/1 var(--font-mono)',
  letterSpacing: '.06em',
  color: 'var(--ink-72)',
  border: '1px solid var(--rule)',
  padding: '2px 4px',
};

const resultList: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  borderBottom: '1px solid rgba(26,26,23,.2)',
};

const resultRow: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 8,
  padding: '9px 15px',
  background: 'none', border: 'none',
  borderBottom: '1px solid var(--rule-faint)',
  font: '400 13px/1 var(--font-display)', color: 'var(--ink)',
  cursor: 'pointer', textAlign: 'left',
};

const resultType: React.CSSProperties = {
  font: '400 9.5px/1 var(--font-mono)', color: 'var(--ink-72)',
};

const importTag: React.CSSProperties = {
  font: '400 8.5px/1 var(--font-mono)', letterSpacing: '.06em',
  color: 'var(--accent)', border: '1px solid var(--accent-line)',
  padding: '2px 4px', marginLeft: 6,
};

const amountBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 9,
  padding: '12px 15px',
  borderBottom: '1px solid rgba(26,26,23,.2)',
};

const amountName: React.CSSProperties = {
  font: '500 15px/1 var(--font-display)', color: 'var(--ink)',
};

const amountInput: React.CSSProperties = {
  width: 74, padding: '7px 9px',
  background: 'none', border: '1px solid var(--rule-strong)', borderRadius: 0,
  font: '400 12.5px/1 var(--font-mono)', color: 'var(--ink)', outline: 'none',
};

const unitSelect: React.CSSProperties = {
  padding: '7px 6px',
  background: 'none', border: '1px solid var(--rule-strong)', borderRadius: 0,
  font: '400 12.5px/1 var(--font-mono)', color: 'var(--ink)', outline: 'none',
};

const addBtn: React.CSSProperties = {
  padding: '7px 13px', background: 'var(--ink)', color: 'var(--on-ink)',
  border: '1px solid var(--ink)', borderRadius: 0,
  font: '400 12.5px/1 var(--font-display)', cursor: 'pointer',
};

const backBtn: React.CSSProperties = {
  padding: '7px 11px', background: 'none', color: 'var(--ink-72)',
  border: '1px solid var(--rule-strong)', borderRadius: 0,
  font: '400 12.5px/1 var(--font-display)', cursor: 'pointer',
};

const errorRow: React.CSSProperties = {
  padding: '9px 15px',
  borderTop: '1px solid var(--accent-line)',
  background: 'rgba(194,42,6,.06)',
  font: '400 11.5px/1.4 var(--font-display)',
  color: 'var(--accent)',
};

const footer: React.CSSProperties = {
  padding: '8px 15px',
  borderTop: '1px solid rgba(26,26,23,.2)',
  font: '400 9.5px/1 var(--font-mono)',
  color: 'var(--ink-72)',
};
