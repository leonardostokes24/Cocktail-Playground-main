import React, { useCallback, useEffect, useRef, useState } from 'react';
import { placeRoot } from '../../utils/layout';
import { useProofStore } from '../../store/useProofStore';
import { UNITS } from '../../utils/units';
import CommandPad, { PAD_SIZE, type Segment } from './CommandPad';
import { childCounts } from '../../utils/childCounts';
import { searchCatalogueIngredients } from '../../lib/supabase/catalogue';
import RadialSearch, { type SearchItem } from './RadialSearch';

export type RadialContext =
  | { kind: 'canvas'; position: { x: number; y: number } }
  | { kind: 'node';   nodeId: string; position: { x: number; y: number } };

type Phase =
  | { tag: 'main' }
  | { tag: 'sub-ring' }
  | { tag: 'search'; categoryType: string | null; categoryLabel: string; kind: 'ingredient' | 'prep' }
  | { tag: 'add-amount'; item: SearchItem; kind: 'ingredient' | 'prep' }
  | { tag: 'confirm-delete' };

interface Props {
  context: RadialContext;
  onClose: () => void;
  onOpenLibrary?: () => void;
  onOpenPreps?: () => void;
  onOpenIngest?: () => void;
}

// ── Segment definitions ───────────────────────────────────────────────────────

const CANVAS_SEGMENTS: Segment[] = [
  { id: 'new-spec',     label: 'New spec',  icon: 'spark' },
  { id: 'search-lib',   label: 'Library',   icon: 'library' },
  { id: 'new-prep',     label: 'Preps',     icon: 'flask' },
  { id: 'quick-ingest', label: 'Ingest',    icon: 'ingest' },
];

const NODE_SEGMENTS: Segment[] = [
  { id: 'branch',     label: 'Branch',    icon: 'branch' },
  { id: 'add-ing',    label: 'Add',       icon: 'plus' },
  { id: 'open-spec',  label: 'Open',      icon: 'open' },
  { id: 'duplicate',  label: 'Duplicate', icon: 'duplicate' },
  { id: 'publish',    label: 'Publish',   icon: 'publish' },
  { id: 'delete',     label: 'Delete',    icon: 'trash' },
];

const CONFIRM_SEGMENTS: Segment[] = [
  { id: 'confirm', label: 'Delete it', icon: 'trash' },
  { id: 'cancel',  label: 'Keep it',   icon: 'back', accent: 'neutral' },
];

const CATEGORY_SEGMENTS: Segment[] = [
  { id: 'spirit',    label: 'Spirit',    icon: 'bottle' },
  { id: 'modifier',  label: 'Modifier',  icon: 'glass' },
  { id: 'citrus',    label: 'Citrus',    icon: 'citrus' },
  { id: 'sweetener', label: 'Sweetener', icon: 'cube' },
  { id: 'bitters',   label: 'Bitters',   icon: 'drop' },
  { id: 'prep',      label: 'Prep',      icon: 'flask' },
  { id: 'syrup',     label: 'Syrup',     icon: 'jar' },
  { id: 'other',     label: 'Other',     icon: 'circle' },
];

const LABEL_FOR: Record<string, string> = {
  spirit: 'Spirit', modifier: 'Modifier', citrus: 'Citrus',
  sweetener: 'Sweetener', bitters: 'Bitters', syrup: 'Syrup', other: 'Other',
  prep: 'Preps',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RadialMenu({ context, onClose, onOpenLibrary, onOpenPreps, onOpenIngest }: Props) {
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
  const publishSpec     = useProofStore(s => s.publishSpec);
  const specs           = useProofStore(s => s.specs);
  const preps           = useProofStore(s => s.preps);
  const recentIds       = useProofStore(s => s.recentIngredientIds);
  const importCatalogue = useProofStore(s => s.importCatalogueIngredient);
  // The catalogue is a remote lookup, so it streams in beside the local list
  // rather than blocking it — your own ingredients appear instantly either way.
  const [catalogueHits, setCatalogueHits] = useState<SearchItem[]>([]);

  // Clamp so the pad stays inside the viewport
  const HALF = PAD_SIZE / 2;
  const MARGIN = 16;
  const clampedX = Math.max(HALF + MARGIN, Math.min(window.innerWidth  - HALF - MARGIN, context.position.x));
  const clampedY = Math.max(HALF + MARGIN, Math.min(window.innerHeight - HALF - MARGIN, context.position.y));
  const position = { x: clampedX, y: clampedY };
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
    if (phase.tag !== 'search' || phase.kind === 'prep') { setCatalogueHits([]); return; }
    let cancelled = false;
    searchCatalogueIngredients('', phase.categoryType ?? undefined)
      .then(rows => { if (!cancelled) setCatalogueHits(rows.map(r => ({ id: r.id, name: r.name, type: r.type }))); })
      .catch(() => { if (!cancelled) setCatalogueHits([]); });  // catalogue is a bonus, never a blocker
    return () => { cancelled = true; };
  }, [phase]);

  useEffect(() => {
    if (phase.tag === 'add-amount') {
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [phase.tag]);

  // ── Canvas ring handlers ──────────────────────────────────────────────────
  const handleCanvasSelect = useCallback(async (id: string) => {
    if (id === 'new-spec') {
      const at = placeRoot(specs);
      await createSpec({ name: 'New Spec', canvas_x: at.x, canvas_y: at.y });
      onClose();
      return;
    }
    if (id === 'search-lib') { onOpenLibrary?.(); onClose(); return; }
    if (id === 'new-prep')   { onOpenPreps?.();   onClose(); return; }
    if (id === 'quick-ingest') { onOpenIngest?.(); onClose(); return; }
  }, [specs, createSpec, onClose, onOpenLibrary, onOpenPreps, onOpenIngest]);

  // ── Node ring handlers ────────────────────────────────────────────────────
  const handleNodeSelect = useCallback(async (id: string) => {
    if (!nodeId) return;
    if (id === 'branch')    { await branchSpec(nodeId); onClose(); }
    if (id === 'open-spec') { selectSpec(nodeId); onClose(); }
    if (id === 'add-ing')   { setPhase({ tag: 'sub-ring' }); }
    if (id === 'delete')    { setPhase({ tag: 'confirm-delete' }); }
    if (id === 'publish')   { await publishSpec(nodeId); onClose(); }
    if (id === 'duplicate') {
      const parent = specs.find(s => s.id === nodeId);
      if (!parent) return;
      const copy = await createSpec({
        name: `${parent.name} copy`,
        method: parent.method,
        glass: parent.glass,
        garnish: parent.garnish,
        build_text: parent.build_text,
        sale_price: parent.sale_price,
        canvas_x: parent.canvas_x + 280,
        canvas_y: parent.canvas_y - 60,
      });
      const parentComponents = specComponentsMap[nodeId] ?? [];
      for (const comp of parentComponents) {
        await addComponent({
          spec_id: copy.id,
          ingredient_id: comp.ingredient_id,
          prep_id: comp.prep_id,
          amount_ml: comp.amount_ml,
          original_amount: comp.original_amount,
          original_unit: comp.original_unit,
          position: comp.position,
        });
      }
      selectSpec(copy.id);
      onClose();
    }
  }, [nodeId, branchSpec, selectSpec, publishSpec, createSpec, addComponent, specComponentsMap, specs, onClose]);

  // ── Sub-ring: category ────────────────────────────────────────────────────
  const handleCategorySelect = useCallback((catId: string) => {
    if (CATEGORY_SEGMENTS.find(s => s.id === catId)?.disabled) return;
    setPhase({
      tag: 'search',
      categoryType: catId === 'other' || catId === 'prep' ? null : catId,
      categoryLabel: LABEL_FOR[catId] ?? catId,
      kind: catId === 'prep' ? 'prep' : 'ingredient',
    });
  }, []);

  // ── Search result ─────────────────────────────────────────────────────────
  const handleItemSelect = useCallback((item: SearchItem) => {
    setPhase(prev => (prev.tag === 'search'
      ? { tag: 'add-amount', item, kind: prev.kind }
      : prev));
  }, []);

  // ── Add confirm ───────────────────────────────────────────────────────────
  const handleAddConfirm = useCallback(async () => {
    if (!nodeId || phase.tag !== 'add-amount') return;
    const { item, kind } = phase;
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;

    // A catalogue pick isn't yours yet. Import it unpriced first — ⚑ the shared
    // catalogue's suggested price is never adopted on the user's behalf.
    let resolvedId = item.id;
    if (resolvedId.startsWith('catalogue:')) {
      const imported = await importCatalogue(resolvedId.slice('catalogue:'.length), null);
      resolvedId = imported.id;
    }
    const { toMl } = await import('../../utils/units');
    const nextPos = specComponentsMap[nodeId]?.length ?? 0;
    // spec_components is ingredient XOR prep — never both.
    await addComponent({
      spec_id: nodeId,
      ingredient_id: kind === 'ingredient' ? resolvedId : null,
      prep_id: kind === 'prep' ? resolvedId : null,
      amount_ml: toMl(amountNum, unit),
      original_amount: amountNum,
      original_unit: unit,
      position: nextPos,
    });
    selectSpec(nodeId);
    onClose();
  }, [nodeId, phase, amount, unit, specComponentsMap, addComponent, selectSpec, onClose, importCatalogue]);

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
  const showPad = !showSearch && !showAmount;

  // What the pad's centre names — the target, not the tool.
  const targetSpec = nodeId ? specs.find(s => s.id === nodeId) : null;
  const padTitle = (() => {
    if (phase.tag === 'confirm-delete') return `Delete ${targetSpec?.name ?? 'spec'}?`;
    if (phase.tag === 'sub-ring') return 'Add what?';
    if (context.kind === 'canvas') return 'Canvas';
    return targetSpec?.name ?? 'Spec';
  })();
  // Deleting a spec detaches its twists rather than deleting them — say which,
  // and how many, instead of a generic "cannot be undone".
  const detaching = targetSpec ? (childCounts(specs)[targetSpec.id] ?? 0) : 0;
  const padSubtitle = phase.tag === 'confirm-delete'
    ? (detaching
        ? `${detaching} twist${detaching > 1 ? 's' : ''} detach`
        : 'cannot be undone')
    : undefined;

  // The search phase filters here so RadialSearch stays a dumb list.
  const localItems: SearchItem[] = phase.tag === 'search'
    ? (phase.kind === 'prep'
        ? preps.map(p => ({ id: p.id, name: p.name, type: 'prep' }))
        : ingredients.filter(i => !phase.categoryType || i.type === phase.categoryType))
    : [];

  // ⚑ Recents first — the radial rule. Everything else keeps its order.
  const rank = new Map(recentIds.map((id, i) => [id, i]));
  const ordered = [...localItems].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Infinity;
    const rb = rank.has(b.id) ? rank.get(b.id)! : Infinity;
    return ra - rb;
  });

  // Catalogue entries you don't own yet, appended and marked so they read as an
  // import rather than something already in your library.
  const ownNames = new Set(localItems.map(i => i.name.toLowerCase()));
  const searchItems: SearchItem[] = [
    ...ordered,
    ...catalogueHits
      .filter(c => !ownNames.has(c.name.toLowerCase()))
      .map(c => ({ ...c, id: `catalogue:${c.id}`, type: c.type })),
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        style={backdrop}
        onClick={onClose}
        onContextMenu={e => { e.preventDefault(); onClose(); }}
      />

      {/* Pad container */}
      <div style={{ ...wheel, left: position.x, top: position.y }} onClick={e => e.stopPropagation()}>

        {showPad && (
          <CommandPad
            segments={currentSegments}
            title={padTitle}
            subtitle={padSubtitle}
            onSelect={handleSelect}
            onEscape={handleEscape}
          />
        )}

        {/* Centre hub */}
        <div style={centre}>
          {showSearch && phase.tag === 'search' && (
            <RadialSearch
              items={searchItems}
              categoryLabel={phase.categoryLabel}
              emptyHint={phase.kind === 'prep'
                ? 'No preps yet — make one in Preps first'
                : `No ${phase.categoryLabel.toLowerCase()} yet — add via Library first`}
              onSelect={handleItemSelect}
              onEscape={goBack}
            />
          )}

          {showAmount && phase.tag === 'add-amount' && (
            <div style={amountBox} onClick={e => e.stopPropagation()}>
              <span style={amountName}>{phase.item.name}</span>
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
                <button onClick={handleAddConfirm} style={confirmBtn}>Add</button>
                <button onClick={goBack} style={cancelBtn}>Back</button>
              </div>
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
  // A plain dim, not glass — a full-screen backdrop-filter is banned, and the
  // pad has no panel of its own, so this is what keeps its labels readable.
  background: 'rgba(6,5,12,.52)',
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
  pointerEvents: 'all',
};


const amountBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
  background: 'linear-gradient(168deg, rgba(255,255,255,.10), rgba(255,255,255,.04))',
  backdropFilter: 'blur(24px) saturate(135%)',
  WebkitBackdropFilter: 'blur(24px) saturate(135%)',
  border: '1px solid rgba(255,255,255,.16)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.24), inset 1.2px 0 0 rgba(120,225,255,.42), inset -1.2px 0 0 rgba(255,135,210,.36), 0 18px 36px -16px rgba(0,0,0,.8)',
  borderRadius: 12,
  padding: '12px 14px',
  width: 180,
  transform: 'translate(-50%, -50%)',
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
