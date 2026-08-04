import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useShallow } from 'zustand/react/shallow';

import { useProofStore } from '../../store/useProofStore';
import { computeSpecCosts } from '../../utils/calculations';
import ComponentBlock from './blocks/ComponentBlock';
import MethodBlock from './blocks/MethodBlock';
import FieldBlock from './blocks/FieldBlock';
import PaletteRail, { type PaletteItem } from './PaletteRail';
import { clampLines } from '../common/clampLines';

const GLASSES = ['coupe', 'rocks', 'highball', 'martini', 'flute', 'nick & nora'];

interface Props {
  specId: string;
  onClose: () => void;
}

export default function RecipeBuilder({ specId, onClose }: Props) {
  const {
    specs, specComponentsMap, ingredients, catalogueIngredients, preps,
    dilutionOverrides, sundriesPerServe, wasteRate,
    editSpec, addComponent, editComponent, removeComponent, reorderComponents,
    loadIngredients, loadCatalogueIngredients, loadPreps, loadSpecComponents,
    importCatalogueIngredient,
  } = useProofStore(useShallow(s => ({
    specs: s.specs,
    specComponentsMap: s.specComponentsMap,
    ingredients: s.ingredients,
    catalogueIngredients: s.catalogueIngredients,
    preps: s.preps,
    dilutionOverrides: s.dilutionOverrides,
    sundriesPerServe: s.sundriesPerServe,
    wasteRate: s.wasteRate,
    editSpec: s.editSpec,
    addComponent: s.addComponent,
    editComponent: s.editComponent,
    removeComponent: s.removeComponent,
    reorderComponents: s.reorderComponents,
    loadIngredients: s.loadIngredients,
    loadCatalogueIngredients: s.loadCatalogueIngredients,
    loadPreps: s.loadPreps,
    loadSpecComponents: s.loadSpecComponents,
    importCatalogueIngredient: s.importCatalogueIngredient,
  })));

  const spec = specs.find(s => s.id === specId);
  const components = useMemo(
    () => [...(specComponentsMap[specId] ?? [])].sort((a, b) => a.position - b.position),
    [specComponentsMap, specId]
  );

  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    loadIngredients();
    loadCatalogueIngredients();
    loadPreps();
    loadSpecComponents(specId);
  }, [specId, loadIngredients, loadCatalogueIngredients, loadPreps, loadSpecComponents]);

  // Esc closes — the overlay is modal over the canvas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sensors = useSensors(
    // Distance activation so a tap still reads as a tap, not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Delay on touch so the overlay can still be scrolled with a finger.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const costs = useMemo(
    () => spec
      ? computeSpecCosts(spec.method, spec.sale_price, components, dilutionOverrides, { sundriesPerServe, wasteRate })
      : null,
    [spec, components, dilutionOverrides, sundriesPerServe, wasteRate]
  );

  // Adding a block: a catalogue pick is materialized into your library first
  // (unpriced — pricing is optional), then appended as a component.
  const addFromPalette = useCallback(async (item: PaletteItem) => {
    if (!spec) return;
    const position = components.length;
    if (item.kind === 'prep') {
      await addComponent({ spec_id: specId, prep_id: item.id, amount_ml: 20, original_amount: 20, original_unit: 'ml', position });
      return;
    }
    const ingredientId = item.kind === 'catalogue'
      ? (await importCatalogueIngredient(item.id)).id
      : item.id;
    await addComponent({
      spec_id: specId, ingredient_id: ingredientId,
      amount_ml: 25, original_amount: 25, original_unit: 'ml', position,
    });
  }, [spec, specId, components.length, addComponent, importCatalogueIngredient]);

  const handleDragStart = useCallback((e: DragStartEvent) => setDragging(String(e.active.id)), []);

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;

    // Dropped in from the palette
    const paletteItem = active.data.current?.paletteItem as PaletteItem | undefined;
    if (paletteItem) { await addFromPalette(paletteItem); return; }

    // Reordering within the stack
    if (active.id !== over.id) {
      const ids = components.map(c => c.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return;
      const next = [...ids];
      next.splice(to, 0, ...next.splice(from, 1));
      await reorderComponents(specId, next);
    }
  }, [components, addFromPalette, reorderComponents, specId]);

  const handleUpdate = useCallback((id: string, amountMl: number, originalAmount: number, originalUnit: string) => {
    editComponent(id, { amount_ml: amountMl, original_amount: originalAmount, original_unit: originalUnit });
  }, [editComponent]);

  if (!spec) return null;

  return (
    <div style={overlay} role="dialog" aria-label={`Edit ${spec.name}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={shell}>
          {/* Header */}
          <div style={header}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 className="display" style={{ ...title, ...clampLines(2) }} title={spec.name}>{spec.name}</h2>
              <p style={subtitle}>Build the drink from blocks</p>
            </div>
            <div style={readout}>
              <Readout label="ABV" value={costs ? `${costs.finalAbvPct.toFixed(1)}%` : '—'} />
              <Readout label="Volume" value={costs ? `${Math.round(costs.finalVolumeMl)}ml` : '—'} />
              <Readout
                label="Cost"
                value={costs?.fullyPriced ? `£${costs.modifiedCost.toFixed(2)}` : 'unpriced'}
                muted={!costs?.fullyPriced}
              />
            </div>
            <button onClick={onClose} style={doneBtn}>Done</button>
          </div>

          <div style={body}>
            <PaletteRail
              ingredients={ingredients}
              catalogue={catalogueIngredients}
              preps={preps}
              onAdd={addFromPalette}
            />

            <div style={stackPane}>
              <div style={stack}>
                <FieldBlock
                  label="Glass"
                  value={spec.glass}
                  placeholder="e.g. coupe"
                  suggestions={GLASSES}
                  onSave={v => editSpec(specId, { glass: v })}
                />

                <MethodBlock
                  method={spec.method}
                  onChangeMethod={m => editSpec(specId, { method: m })}
                  isEmpty={components.length === 0}
                >
                  <SortableContext items={components.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {components.map((c, i) => (
                      <ComponentBlock
                        key={c.id}
                        component={c}
                        isHead={i === 0}
                        isTail={i === components.length - 1}
                        onUpdate={handleUpdate}
                        onRemove={removeComponent}
                      />
                    ))}
                  </SortableContext>
                </MethodBlock>

                <FieldBlock
                  label="Garnish"
                  value={spec.garnish}
                  placeholder="e.g. orange peel"
                  onSave={v => editSpec(specId, { garnish: v })}
                />
              </div>
            </div>
          </div>
        </div>

        <DragOverlay>
          {dragging ? <div style={ghost}>Drop into the drink</div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Readout({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={readoutLabel}>{label}</div>
      <div style={{ ...readoutValue, color: muted ? 'var(--text-muted)' : 'var(--text)' }}>{value}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 4000,
  background: 'rgba(8,7,14,.72)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  display: 'flex', padding: 20,
};

const shell: React.CSSProperties = {
  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
  borderRadius: 16,
  background: 'var(--panel-fill)',
  border: '1px solid rgba(255,255,255,.13)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.16), 0 30px 70px -20px rgba(0,0,0,.8)',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 16,
  padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.08)', flexShrink: 0,
};

const title: React.CSSProperties = { fontSize: 22, margin: 0, lineHeight: 1.15, color: 'var(--text)' };

const subtitle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0',
};

const readout: React.CSSProperties = { display: 'flex', gap: 18, flexShrink: 0, paddingTop: 2 };

const readoutLabel: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 8.5, fontWeight: 700,
  letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)',
};

const readoutValue: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 15, marginTop: 2,
};

const doneBtn: React.CSSProperties = {
  background: 'rgba(127,230,255,.14)', border: '1px solid rgba(127,230,255,.32)',
  borderRadius: 9, color: 'var(--cyan)', cursor: 'pointer',
  fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600,
  padding: '10px 18px', flexShrink: 0, minHeight: 44,
};

const body: React.CSSProperties = { flex: 1, display: 'flex', minHeight: 0 };

const stackPane: React.CSSProperties = { flex: 1, minWidth: 0, overflowY: 'auto', padding: '18px 22px' };

const stack: React.CSSProperties = {
  maxWidth: 620, margin: '0 auto',
  display: 'flex', flexDirection: 'column', gap: 10,
};

const ghost: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text)',
  background: 'rgba(127,230,255,.18)', border: '1px solid rgba(127,230,255,.4)',
  borderRadius: 8, padding: '10px 14px', pointerEvents: 'none',
};
