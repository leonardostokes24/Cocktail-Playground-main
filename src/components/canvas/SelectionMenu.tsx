import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useProofStore } from '../../store/useProofStore';
import { childCounts } from '../../utils/childCounts';

/**
 * The floating action menu from Claude Design "Proof New UI" 8a.
 *
 * Always on screen and tethered to whatever is selected, rather than summoned at
 * the pointer and dismissed. That is the whole idea of 8a: the nodes stay plain
 * cards and the menu is the one live surface. It never covers its own target —
 * it sits to the side of the selected node and flips when it would run off.
 *
 * ⌥-drag the header to move it, ⌘. to pin it where you left it, ⌘K to type.
 */

type ActionId =
  | 'branch' | 'add' | 'swap' | 'open'
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
  { id: 'swap',      label: 'Swap', soon: true },
  { id: 'open',      label: 'Open recipe' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'to-prep',   label: 'Convert to prep', soon: true },
  { id: 'publish',   label: 'Publish', accent: true },
  { id: 'delete',    label: 'Delete', accent: true },
];

const PIN_KEY = 'proof_menu_pin';
const MENU_W = 320;

interface Props {
  onNewSpec: () => void;
  /** 'Open recipe' is the only route to the full editing panel now. */
  onOpenRecipe: () => void;
}

export default function SelectionMenu({ onNewSpec, onOpenRecipe }: Props) {
  const specs        = useProofStore(s => s.specs);
  const selectedId   = useProofStore(s => s.selectedSpecId);
  const selectSpec   = useProofStore(s => s.selectSpec);
  const branchSpec   = useProofStore(s => s.branchSpec);
  const publishSpec  = useProofStore(s => s.publishSpec);
  const removeSpec   = useProofStore(s => s.removeSpec);
  const duplicate    = useProofStore(s => s.duplicateSpecs);

  const { flowToScreenPosition } = useReactFlow();
  const viewport = useViewport();

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pinned, setPinned] = useState<{ x: number; y: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem(PIN_KEY) ?? 'null'); } catch { return null; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<{ dx: number; dy: number } | null>(null);

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

  // ── Position: beside the target, flipping rather than covering it ──────────
  const anchored = useMemo(() => {
    if (pinned) return pinned;
    if (!spec) return { x: window.innerWidth - MENU_W - 32, y: 96 };
    const p = flowToScreenPosition({ x: spec.canvas_x, y: spec.canvas_y });
    const right = p.x + 244 * viewport.zoom + 28;
    const wouldOverflow = right + MENU_W > window.innerWidth - 16;
    return {
      x: wouldOverflow ? Math.max(16, p.x - MENU_W - 28) : right,
      y: Math.min(Math.max(72, p.y), window.innerHeight - 380),
    };
  }, [pinned, spec, flowToScreenPosition, viewport]);

  // ── Keyboard: ⌘K focuses, ⌘. pins/unpins ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); }
      if (meta && e.key === '.') {
        e.preventDefault();
        setPinned(prev => {
          const next = prev ? null : anchored;
          try { localStorage.setItem(PIN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [anchored]);

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
    try {
      switch (a.id) {
        case 'branch':    await branchSpec(spec.id); break;
        case 'open':
        case 'add':       selectSpec(spec.id); onOpenRecipe(); break;
        case 'duplicate': await duplicate([spec.id]); break;
        case 'publish':   await publishSpec(spec.id); break;
        case 'delete':    await removeSpec(spec.id); break;
      }
    } finally {
      setBusy(false);
      setConfirmDelete(false);
      setQuery('');
    }
  }, [spec, busy, confirmDelete, branchSpec, selectSpec, duplicate, publishSpec, removeSpec, onNewSpec, onOpenRecipe]);

  // Typing filters the actions; ↵ runs the only remaining one.
  const matches = query.trim()
    ? ACTIONS.filter(a => a.label.toLowerCase().includes(query.trim().toLowerCase()))
    : ACTIONS;

  const onFieldKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setQuery(''); (e.target as HTMLInputElement).blur(); }
    if (e.key === 'Enter' && matches.length) { e.preventDefault(); run(matches[0]); }
  }, [matches, run]);

  return (
    <div style={{ ...shell, left: anchored.x, top: anchored.y }} className="nodrag nopan">
      <div style={header} onPointerDown={onHeaderDown}>
        <span>acting on</span>
        <span style={{ opacity: .72 }}>⌥ drag to move · ⌘. to {pinned ? 'unpin' : 'pin'}</span>
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

      <div style={footer}>
        {spec ? 'follows the selection' : 'empty canvas → new spec'}
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

const footer: React.CSSProperties = {
  padding: '8px 15px',
  borderTop: '1px solid rgba(26,26,23,.2)',
  font: '400 9.5px/1 var(--font-mono)',
  color: 'var(--ink-72)',
};
