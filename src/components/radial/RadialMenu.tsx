import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useProofStore } from '../../store/useProofStore';
import type { Ingredient } from '../../store/useProofStore';
import { UNITS } from '../../utils/units';
import RadialRing, { type Segment } from './RadialRing';
import RadialSearch from './RadialSearch';

export type RadialContext =
  | { kind: 'canvas'; position: { x: number; y: number } }
  | { kind: 'node';   nodeId: string; position: { x: number; y: number } };

type Phase =
  | { tag: 'main' }
  | { tag: 'sub-ring' }
  | { tag: 'search'; categoryType: string | null; categoryLabel: string }
  | { tag: 'add-amount'; ingredient: Ingredient }
  | { tag: 'confirm-delete' };

interface Props {
  context: RadialContext;
  onClose: () => void;
}

// ── Segment definitions ───────────────────────────────────────────────────────

const CANVAS_SEGMENTS: Segment[] = [
  { id: 'new-spec',      label: 'New Spec',      icon: '✦',  color: 'rgba(127,230,255,0.7)' },
  { id: 'search-lib',   label: 'Library',        icon: '⌕',  disabled: true },
  { id: 'quick-ingest', label: 'Ingest',          icon: '⇩',  disabled: true },
  { id: 'new-prep',     label: 'New Prep',        icon: '⚗',  disabled: true },
];

const NODE_SEGMENTS: Segment[] = [
  { id: 'branch',     label: 'Branch',         icon: '⎇',  color: 'rgba(127,230,255,0.7)' },
  { id: 'add-ing',    label: 'Add Ingredient', icon: '+',   color: 'rgba(127,230,255,0.7)' },
  { id: 'open-spec',  label: 'Open Spec',      icon: '→',   color: 'rgba(127,230,255,0.7)' },
  { id: 'delete',     label: 'Delete',         icon: '✕',   color: 'rgba(255,100,100,0.7)' },
];

const CONFIRM_SEGMENTS: Segment[] = [
  { id: 'confirm', label: 'Confirm Delete', icon: '✕', color: 'rgba(239,68,68,0.8)' },
  { id: 'cancel',  label: 'Cancel',         icon: '←', color: 'rgba(127,230,255,0.7)' },
];

const CATEGORY_SEGMENTS: Segment[] = [
  { id: 'spirit',    label: 'Spirit',    icon: '🥃' },
  { id: 'modifier',  label: 'Modifier',  icon: '🍹' },
  { id: 'citrus',    label: 'Citrus',    icon: '🍋' },
  { id: 'sweetener', label: 'Sweetener', icon: '🍬' },
  { id: 'bitters',   label: 'Bitters',   icon: '💧' },
  { id: 'prep',      label: 'Prep',      icon: '⚗',  disabled: true },
  { id: 'syrup',     label: 'Syrup',     icon: '🫙' },
  { id: 'other',     label: 'Other',     icon: '○' },
];

const LABEL_FOR: Record<string, string> = {
  spirit: 'Spirit', modifier: 'Modifier', citrus: 'Citrus',
  sweetener: 'Sweetener', bitters: 'Bitters', syrup: 'Syrup', other: 'Other',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RadialMenu({ context, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ tag: 'main' });
  const [amount, setAmount] = useState('30');
  const [unit, setUnit] = useState('ml');
  const amountRef = useRef<HTMLInputElement>(null);

  const ingredients = useProofStore(s => s.ingredients);
  const specComponentsMap = useProofStore(s => s.specComponentsMap);
  const createSpec      = useProofStore(s => s.createSpec);
  const branchSpec      = useProofStore(s => s.branchSpec);
  const addComponent    = useProofStore(s => s.addComponent);
  const selectSpec      = useProofStore(s => s.selectSpec);
  const removeSpec      = useProofStore(s => s.removeSpec);
  const specs           = useProofStore(s => s.specs);

  const { position } = context;
  const nodeId = context.kind === 'node' ? context.nodeId : null;

  const goBack = useCallback(() => {
    setPhase(prev => {
      if (prev.tag === 'search' || prev.tag === 'add-amount') return { tag: 'sub-ring' };
      if (prev.tag === 'sub-ring' || prev.tag === 'confirm-delete') return { tag: 'main' };
      return prev;
    });
  }, []);

  const handleEscape = useCallback(() => {
    setPhase(prev => {
      if (prev.tag === 'main') { onClose(); return prev; }
      return { tag: 'main' };
    });
  }, [onClose]);

  useEffect(() => {
    if (phase.tag === 'add-amount') {
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [phase.tag]);

  // ── Canvas ring handlers ──────────────────────────────────────────────────
  const handleCanvasSelect = useCallback(async (id: string) => {
    if (id === 'new-spec') {
      const x = specs.length ? Math.max(...specs.map(s => s.canvas_x)) + 280 : 100;
      await createSpec({ name: 'New Spec', canvas_x: x, canvas_y: 200 });
      onClose();
    }
  }, [specs, createSpec, onClose]);

  // ── Node ring handlers ────────────────────────────────────────────────────
  const handleNodeSelect = useCallback(async (id: string) => {
    if (!nodeId) return;
    if (id === 'branch')    { await branchSpec(nodeId); onClose(); }
    if (id === 'open-spec') { selectSpec(nodeId); onClose(); }
    if (id === 'add-ing')   { setPhase({ tag: 'sub-ring' }); }
    if (id === 'delete')    { setPhase({ tag: 'confirm-delete' }); }
  }, [nodeId, branchSpec, selectSpec, onClose]);

  // ── Sub-ring: category ────────────────────────────────────────────────────
  const handleCategorySelect = useCallback((catId: string) => {
    if (CATEGORY_SEGMENTS.find(s => s.id === catId)?.disabled) return;
    setPhase({ tag: 'search', categoryType: catId === 'other' ? null : catId, categoryLabel: LABEL_FOR[catId] ?? catId });
  }, []);

  // ── Search result ─────────────────────────────────────────────────────────
  const handleIngredientSelect = useCallback((ing: Ingredient) => {
    setPhase({ tag: 'add-amount', ingredient: ing });
  }, []);

  // ── Add confirm ───────────────────────────────────────────────────────────
  const handleAddConfirm = useCallback(async () => {
    if (!nodeId || phase.tag !== 'add-amount') return;
    const { ingredient } = phase;
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;
    const { toMl } = await import('../../utils/units');
    const nextPos = specComponentsMap[nodeId]?.length ?? 0;
    await addComponent({
      spec_id: nodeId,
      ingredient_id: ingredient.id,
      amount_ml: toMl(amountNum, unit),
      original_amount: amountNum,
      original_unit: unit,
      position: nextPos,
    });
    selectSpec(nodeId);
    onClose();
  }, [nodeId, phase, amount, unit, specComponentsMap, addComponent, selectSpec, onClose]);

  // ── Delete confirm ────────────────────────────────────────────────────────
  const handleConfirmSelect = useCallback(async (id: string) => {
    if (id === 'cancel') { setPhase({ tag: 'main' }); return; }
    if (id === 'confirm' && nodeId) { await removeSpec(nodeId); onClose(); }
  }, [nodeId, removeSpec, onClose]);

  // ── Segment dispatcher ────────────────────────────────────────────────────
  const handleSelect = useCallback((id: string) => {
    if (context.kind === 'canvas') { handleCanvasSelect(id); return; }
    if (phase.tag === 'main')           handleNodeSelect(id);
    else if (phase.tag === 'sub-ring')  handleCategorySelect(id);
    else if (phase.tag === 'confirm-delete') handleConfirmSelect(id);
  }, [context.kind, phase, handleCanvasSelect, handleNodeSelect, handleCategorySelect, handleConfirmSelect]);

  // ── Current ring ─────────────────────────────────────────────────────────
  const currentSegments = (() => {
    if (context.kind === 'canvas') return CANVAS_SEGMENTS;
    if (phase.tag === 'confirm-delete') return CONFIRM_SEGMENTS;
    if (phase.tag === 'sub-ring') return CATEGORY_SEGMENTS;
    return NODE_SEGMENTS;
  })();

  const showSearch = phase.tag === 'search';
  const showAmount = phase.tag === 'add-amount';
  const showRing   = !showSearch;

  return (
    <>
      {/* Backdrop */}
      <div
        style={backdrop}
        onClick={onClose}
        onContextMenu={e => { e.preventDefault(); onClose(); }}
      />

      {/* Wheel container */}
      <div style={{ ...wheel, left: position.x, top: position.y }} onClick={e => e.stopPropagation()}>

        {showRing && (
          <RadialRing
            segments={currentSegments}
            onSelect={handleSelect}
            onEscape={handleEscape}
            radius={phase.tag === 'sub-ring' ? 110 : 96}
            size={phase.tag === 'sub-ring' ? 68 : 64}
          />
        )}

        {/* Centre content */}
        <div style={centre}>
          {showSearch && phase.tag === 'search' && (
            <RadialSearch
              ingredients={ingredients}
              categoryType={phase.categoryType}
              categoryLabel={phase.categoryLabel}
              onSelect={handleIngredientSelect}
              onEscape={goBack}
            />
          )}

          {showAmount && phase.tag === 'add-amount' && (
            <div style={amountBox} onClick={e => e.stopPropagation()}>
              <span style={amountName}>{phase.ingredient.name}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  ref={amountRef}
                  type="number"
                  min={0}
                  step="any"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddConfirm(); if (e.key === 'Escape') goBack(); }}
                  style={amountInput}
                />
                <select value={unit} onChange={e => setUnit(e.target.value)} style={unitSelect}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={handleAddConfirm} style={confirmBtn}>✓ Add</button>
                <button onClick={goBack} style={cancelBtn}>✕</button>
              </div>
            </div>
          )}

          {!showSearch && !showAmount && (
            <div style={centreLabel}>
              {context.kind === 'canvas' && <span style={centreTip}>Right-click</span>}
              {phase.tag === 'confirm-delete' && <span style={{ ...centreTip, color: '#f87171' }}>Delete?</span>}
              {phase.tag === 'sub-ring' && <span style={centreTip}>Category</span>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2000,
};

const wheel: React.CSSProperties = {
  position: 'fixed',
  zIndex: 2001,
  transform: 'translate(-50%, -50%)',
  animation: 'radialAppear 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

const centre: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'all',
};

const centreLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 54, height: 54,
  background: 'linear-gradient(168deg, rgba(255,255,255,.07), rgba(255,255,255,.02))',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--glass-border)',
  borderRadius: '50%',
  boxShadow: 'inset 1px 0 0 var(--edge-cyan), inset -1px 0 0 var(--edge-magenta)',
};

const centreTip: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
  color: 'var(--mute)', letterSpacing: '0.04em', textAlign: 'center',
};

const amountBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
  background: 'linear-gradient(168deg, rgba(255,255,255,.10), rgba(255,255,255,.04))',
  backdropFilter: 'blur(24px) saturate(135%)',
  WebkitBackdropFilter: 'blur(24px) saturate(135%)',
  border: '1px solid var(--glass-border)',
  boxShadow: 'inset 1px 0 0 var(--edge-cyan), inset -1px 0 0 var(--edge-magenta), inset 0 1px 0 var(--edge-top), 0 16px 40px rgba(0,0,0,.6)',
  borderRadius: 12,
  padding: '12px 14px',
  width: 180,
  transform: 'translateY(-50%)',
};

const amountName: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
  color: 'var(--ink)', textAlign: 'center', maxWidth: 152,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const amountInput: React.CSSProperties = {
  width: 72, padding: '5px 8px',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6, color: 'var(--ink)', fontSize: 13,
  fontFamily: 'var(--font-mono)', outline: 'none',
};

const unitSelect: React.CSSProperties = {
  padding: '5px 4px',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 6, color: 'var(--ink)', fontSize: 12,
  fontFamily: 'var(--font-ui)', outline: 'none', cursor: 'pointer',
};

const confirmBtn: React.CSSProperties = {
  padding: '5px 12px', background: 'rgba(127,230,255,0.15)',
  border: '1px solid rgba(127,230,255,0.35)', borderRadius: 6,
  color: 'var(--cyan)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};

const cancelBtn: React.CSSProperties = {
  padding: '5px 10px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
  color: 'var(--mute)', fontSize: 12, cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};
