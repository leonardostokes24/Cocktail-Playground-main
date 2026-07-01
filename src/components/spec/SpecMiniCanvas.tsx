import React, { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background,
  useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import SpecRootNode, { type SpecRootData } from './SpecRootNode';
import SpecComponentMiniNode, { type SpecComponentMiniData } from './SpecComponentMiniNode';
import type { Spec, SpecComponent, Ingredient, SpecInput } from '../../store/useProofStore';

// NODE_TYPES outside the component — stable reference, never changes.
const NODE_TYPES = { specRoot: SpecRootNode, specComponent: SpecComponentMiniNode };

const ROOT_X    = 40;
const COMP_X    = 320;
const SPACING   = 110;
const ROOT_H    = 120; // approximate rendered height of root node

interface Props {
  spec: Spec;
  components: SpecComponent[];
  ingredients: Ingredient[];
  onSaveSpec: (patch: Partial<SpecInput>) => void;
  onAddRequest: () => void;
  onUpdate: (id: string, amountMl: number, originalAmount: number, originalUnit: string) => void;
  onRemove: (id: string) => void;
}

function SpecMiniCanvasInner({ spec, components, onSaveSpec, onAddRequest, onUpdate, onRemove }: Props) {
  const { fitView } = useReactFlow();

  // Refs so callbacks never trigger effect re-runs — they always call the latest version.
  const saveRef   = useRef(onSaveSpec);
  const addRef    = useRef(onAddRequest);
  const updateRef = useRef(onUpdate);
  const removeRef = useRef(onRemove);
  useEffect(() => { saveRef.current   = onSaveSpec;  }, [onSaveSpec]);
  useEffect(() => { addRef.current    = onAddRequest; }, [onAddRequest]);
  useEffect(() => { updateRef.current = onUpdate;     }, [onUpdate]);
  useEffect(() => { removeRef.current = onRemove;     }, [onRemove]);

  // Stable callbacks — created once, never recreated.
  const stableSave   = useCallback((p: Partial<SpecInput>) => saveRef.current(p), []);
  const stableAdd    = useCallback(() => addRef.current(), []);
  const stableUpdate = useCallback((id: string, ml: number, amt: number, unit: string) => updateRef.current(id, ml, amt, unit), []);
  const stableRemove = useCallback((id: string) => removeRef.current(id), []);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Full rebuild when the spec id changes (different spec opened) or component
  // list structure changes (added / removed ingredient).
  // Stable callbacks are deps so the array is initialised correctly on first mount,
  // but they never change after that so this effect won't re-fire for edits.
  const specId    = spec.id;
  const compCount = components.length;
  useEffect(() => {
    const totalH = Math.max(1, compCount) * SPACING;
    const rootY  = Math.max(0, (totalH - ROOT_H) / 2);

    setRfNodes([
      {
        id: '__root__',
        type: 'specRoot',
        position: { x: ROOT_X, y: rootY },
        data: { spec, onSave: stableSave, onAddComponent: stableAdd } satisfies SpecRootData,
        draggable: false,
        selectable: false,
      },
      ...components.map((c, i) => ({
        id: c.id,
        type: 'specComponent',
        position: { x: COMP_X, y: i * SPACING },
        data: { component: c, onUpdate: stableUpdate, onRemove: stableRemove } satisfies SpecComponentMiniData,
        draggable: false,
        selectable: false,
      })),
    ]);

    setRfEdges(
      components.map(c => ({
        id: `root→${c.id}`,
        source: '__root__',
        target: c.id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#334155', strokeWidth: 1.5 },
      }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specId, compCount, stableSave, stableAdd, stableUpdate, stableRemove]);

  // Patch root node data when spec fields change (name / method / glass).
  // Runs cheaply — only updates the one node, no layout change.
  useEffect(() => {
    setRfNodes(nds =>
      nds.map(n =>
        n.id === '__root__'
          ? { ...n, data: { spec, onSave: stableSave, onAddComponent: stableAdd } }
          : n
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  // Patch component node data when amounts / costs change (e.g. after an edit save).
  useEffect(() => {
    const byId = new Map(components.map(c => [c.id, c]));
    setRfNodes(nds =>
      nds.map(n => {
        const c = byId.get(n.id);
        return c ? { ...n, data: { component: c, onUpdate: stableUpdate, onRemove: stableRemove } } : n;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components]);

  // Fit view when number of nodes changes.
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 80);
    return () => clearTimeout(t);
  }, [compCount, fitView]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll
      proOptions={{ hideAttribution: true }}
      style={{ width: '100%', height: '100%', background: 'rgba(5,10,20,0.95)' }}
    >
      <Background color="#1e293b" gap={20} size={1} />
    </ReactFlow>
  );
}

export default function SpecMiniCanvas(props: Props) {
  return (
    // Explicit 100% fill so ReactFlow can measure its container.
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <SpecMiniCanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
