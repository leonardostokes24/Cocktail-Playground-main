import React, { useMemo, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Ingredient, CatalogueIngredient, Prep } from '../../store/useProofStore';
import { typeDot } from '../common/typeDot';

// Encodes what a palette item will become when dropped/tapped.
export type PaletteItem =
  | { kind: 'own'; id: string; name: string; type: string | null; unpriced: boolean }
  | { kind: 'catalogue'; id: string; name: string; type: string | null }
  | { kind: 'prep'; id: string; name: string };

interface Props {
  ingredients: Ingredient[];
  catalogue: CatalogueIngredient[];
  preps: Prep[];
  onAdd: (item: PaletteItem) => void;
}

export default function PaletteRail({ ingredients, catalogue, preps, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const match = (s: string) => !q || s.toLowerCase().includes(q);

  // Catalogue entries you already own are hidden — they appear under "Yours".
  const ownedCatalogueIds = useMemo(
    () => new Set(ingredients.map(i => i.catalogue_id).filter(Boolean) as string[]),
    [ingredients]
  );

  const own: PaletteItem[] = useMemo(
    () => ingredients.filter(i => match(i.name)).map(i => ({
      kind: 'own', id: i.id, name: i.name, type: i.type, unpriced: i.pack_cost == null,
    })),
    [ingredients, q]
  );
  const cat: PaletteItem[] = useMemo(
    () => catalogue.filter(c => !ownedCatalogueIds.has(c.id) && match(c.name))
      .slice(0, 60)
      .map(c => ({ kind: 'catalogue', id: c.id, name: c.name, type: c.type })),
    [catalogue, ownedCatalogueIds, q]
  );
  const prepItems: PaletteItem[] = useMemo(
    () => preps.filter(p => match(p.name)).map(p => ({ kind: 'prep', id: p.id, name: p.name })),
    [preps, q]
  );

  return (
    <div className="builder-rail" style={rail}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search ingredients, preps…"
        style={search}
        aria-label="Search the palette"
      />

      <div style={scroll}>
        <Group title="Your ingredients" items={own} onAdd={onAdd} empty="Nothing yet — pull from the catalogue below." />
        <Group title="Preps" items={prepItems} onAdd={onAdd} empty="No preps yet." />
        <Group title="Catalogue" items={cat} onAdd={onAdd} empty="No matches." />
      </div>

      <p style={hint}>Drag a block into the drink, or tap to add it to the end.</p>
    </div>
  );
}

function Group({ title, items, onAdd, empty }: {
  title: string; items: PaletteItem[]; onAdd: (i: PaletteItem) => void; empty: string;
}) {
  return (
    <section style={{ marginBottom: 14 }}>
      <p style={groupTitle}>{title}</p>
      {items.length === 0
        ? <p style={groupEmpty}>{empty}</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map(item => <PaletteChip key={`${item.kind}:${item.id}`} item={item} onAdd={onAdd} />)}
          </div>}
    </section>
  );
}

function PaletteChip({ item, onAdd }: { item: PaletteItem; onAdd: (i: PaletteItem) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${item.kind}:${item.id}`,
    data: { paletteItem: item },
  });

  // The chip is both draggable and tappable, so a completed drag would also fire
  // a click and add the ingredient twice. Only treat it as a tap if the pointer
  // barely moved between down and up.
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    downAt.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e);
  };

  const handleClick = (e: React.MouseEvent) => {
    const start = downAt.current;
    downAt.current = null;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return; // that was a drag
    onAdd(item);
  };

  return (
    <div
      ref={setNodeRef}
      className="blk-chip"
      style={{ ...chip, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      // Tap-to-append: the reliable path on touch and for keyboard users.
      onClick={handleClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(item); } }}
      role="button"
      tabIndex={0}
      aria-label={`Add ${item.name}`}
    >
      {item.kind === 'prep'
        ? <span style={prepBadge}>prep</span>
        : <span style={typeDot(item.type, 7)} />}
      <span style={chipName} title={item.name}>{item.name}</span>
      {item.kind === 'own' && item.unpriced && <span style={unpricedTag}>unpriced</span>}
      {item.kind === 'catalogue' && <span style={catTag}>+</span>}
    </div>
  );
}

const rail: React.CSSProperties = {
  width: 264, flexShrink: 0,
  borderRight: '1px solid rgba(255,255,255,.09)',
  display: 'flex', flexDirection: 'column',
  padding: '14px 12px', gap: 10,
  minHeight: 0,
};

const search: React.CSSProperties = {
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 8, color: 'var(--text)',
  fontFamily: 'var(--font-ui)', fontSize: 12, padding: '9px 10px', outline: 'none',
  flexShrink: 0,
};

const scroll: React.CSSProperties = { flex: 1, overflowY: 'auto', minHeight: 0 };

const groupTitle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
  letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)',
  margin: '0 0 6px',
};

const groupEmpty: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', margin: 0, opacity: .8,
};

const chip: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 10px', minHeight: 44, // touch target ⚑
  userSelect: 'none', touchAction: 'none',
};

const chipName: React.CSSProperties = {
  flex: 1, minWidth: 0,
  fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--text-2)',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const prepBadge: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 8, fontWeight: 700, letterSpacing: '.06em',
  textTransform: 'uppercase', color: '#bfeeff',
  background: 'rgba(127,230,255,.12)', border: '1px solid rgba(127,230,255,.28)',
  borderRadius: 4, padding: '2px 4px', flexShrink: 0,
};

const unpricedTag: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 9, color: 'var(--text-muted)', flexShrink: 0,
};

const catTag: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0,
};

const hint: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--text-muted)',
  margin: 0, lineHeight: 1.45, flexShrink: 0,
};
