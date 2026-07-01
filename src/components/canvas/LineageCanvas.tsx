import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  type NodeMouseHandler, type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useProofStore } from '../../store/useProofStore';
import SpecNodeComponent from './SpecNode';
import IngredientLibrary from '../library/IngredientLibrary';
import SpecPanel from '../spec/SpecPanel';
import RadialMenu, { type RadialContext } from '../radial/RadialMenu';

// Defined outside component so the reference never changes between renders.
const NODE_TYPES = { specNode: SpecNodeComponent };

// Stable empty object shared across all nodes — SpecNode reads from store directly.
const EMPTY_DATA = {} as Record<string, never>;

interface Props {
  user: any;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

export default function LineageCanvas({ user, onLoginClick, onLogoutClick }: Props) {
  const {
    specs, specsLoading, selectedSpecId,
    loadSpecs, loadSpecCosts, loadIngredients, loadAllSpecComponents,
    createSpec, editSpec, selectSpec,
  } = useProofStore();

  const [showLibrary, setShowLibrary] = useState(false);
  const [radialCtx, setRadialCtx] = useState<RadialContext | null>(null);
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const didFitRef = useRef(false);
  const { fitView } = useReactFlow();

  // React Flow owns node/edge state — this is the source of truth for positions
  // and selection so React Flow never fights with external state.
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // Load data when user logs in
  useEffect(() => {
    if (!user) return;
    loadSpecs().then(() => loadSpecCosts());
    loadIngredients();
    loadAllSpecComponents();
  }, [user?.id]);

  // Sync node list from store.
  // Preserve React Flow's current position for existing nodes (drag positions are
  // held in React Flow state, not persisted to the store until the debounce fires).
  useEffect(() => {
    setRfNodes(current => {
      const posMap = new Map(current.map(n => [n.id, n.position]));
      return specs.map(spec => ({
        id: spec.id,
        type: 'specNode' as const,
        position: posMap.get(spec.id) ?? { x: spec.canvas_x, y: spec.canvas_y },
        data: EMPTY_DATA,
      }));
    });
  }, [specs]);

  // Sync edges
  useEffect(() => {
    setRfEdges(
      specs
        .filter(s => s.parent_spec_id)
        .map(s => ({
          id: `${s.parent_spec_id}→${s.id}`,
          source: s.parent_spec_id!,
          target: s.id,
          type: 'smoothstep',
          label: s.change_note || undefined,
          style: { stroke: '#334155', strokeWidth: 1.5 },
          labelStyle: { fill: '#64748b', fontSize: 11 },
          labelBgStyle: { fill: 'rgba(10,15,28,0.85)', fillOpacity: 0.85 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        }))
    );
  }, [specs]);

  // Fit view once after initial load (nodes go from empty → populated)
  useEffect(() => {
    if (rfNodes.length > 0 && !didFitRef.current) {
      didFitRef.current = true;
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
    }
  }, [rfNodes.length]);

  // ── Handlers ─────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    selectSpec(node.id);
  }, [selectSpec]);

  const onNodeDragStop: OnNodeDrag = useCallback((_evt, node) => {
    clearTimeout(dragSaveTimer.current);
    dragSaveTimer.current = setTimeout(() => {
      editSpec(node.id, { canvas_x: node.position.x, canvas_y: node.position.y });
    }, 500);
  }, [editSpec]);

  const handleNewSpec = useCallback(async () => {
    const x = specs.length ? Math.max(...specs.map(s => s.canvas_x)) + 280 : 100;
    const spec = await createSpec({ name: 'New Spec', canvas_x: x, canvas_y: 200 });
    selectSpec(spec.id);
  }, [specs, createSpec, selectSpec]);

  const handlePanelClose = useCallback(() => {
    // Clear React Flow selection state
    setRfNodes(nds => nds.map(n => n.selected ? { ...n, selected: false } : n));
    selectSpec(null);
    loadSpecCosts();
  }, [selectSpec, loadSpecCosts, setRfNodes]);

  const onPaneClick = useCallback(() => {
    if (radialCtx) { setRadialCtx(null); return; }
    if (selectedSpecId) selectSpec(null);
  }, [radialCtx, selectedSpecId, selectSpec]);

  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    setRadialCtx({ kind: 'canvas', position: { x: e.clientX, y: e.clientY } });
  }, [user]);

  const onNodeContextMenu: NodeMouseHandler = useCallback((e, node) => {
    e.preventDefault();
    if (!user) return;
    setRadialCtx({ kind: 'node', nodeId: node.id, position: { x: e.clientX, y: e.clientY } });
  }, [user]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🍹</span>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#e2e8f0', letterSpacing: '-0.01em' }}>Proof</span>
          {specsLoading && <span style={{ fontSize: 11, color: '#475569' }}>Loading…</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {user ? (
            <>
              <button onClick={() => setShowLibrary(true)} style={hBtn()}>🧪 Library</button>
              <button onClick={handleNewSpec} style={hBtn('#10b981')}>+ New Spec</button>
              <button onClick={onLogoutClick} style={hBtn()}>Sign Out</button>
            </>
          ) : (
            <button onClick={onLoginClick} style={hBtn('#10b981')}>Sign In</button>
          )}
        </div>
      </header>

      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid #1e293b', borderRadius: 8 }} />
          <MiniMap
            style={{ background: 'rgba(10,15,28,0.9)', border: '1px solid #1e293b' }}
            nodeColor="#1e293b"
            maskColor="rgba(0,0,0,0.4)"
          />
        </ReactFlow>

        {!specsLoading && specs.length === 0 && user && (
          <div style={emptyState}>
            <p style={{ color: '#475569', fontSize: 14, marginBottom: 16 }}>No specs yet — start your first riff.</p>
            <button onClick={handleNewSpec} style={hBtn('#10b981', true)}>+ Create first spec</button>
          </div>
        )}
        {!user && (
          <div style={emptyState}>
            <p style={{ color: '#475569', fontSize: 14, marginBottom: 16 }}>Sign in to build your lineage canvas.</p>
            <button onClick={onLoginClick} style={hBtn('#10b981', true)}>Sign In</button>
          </div>
        )}
      </div>

      {showLibrary && <IngredientLibrary onClose={() => setShowLibrary(false)} />}
      {selectedSpecId && <SpecPanel specId={selectedSpecId} onClose={handlePanelClose} />}
      {radialCtx && <RadialMenu context={radialCtx} onClose={() => setRadialCtx(null)} />}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 16px', background: 'rgba(10,15,28,0.95)',
  borderBottom: '1px solid #1e293b', flexShrink: 0, zIndex: 10,
  backdropFilter: 'blur(12px)',
};

function hBtn(color = '#475569', large = false): React.CSSProperties {
  return {
    background: color === '#10b981' ? 'rgba(16,185,129,0.15)' : 'rgba(30,41,59,0.8)',
    border: `1px solid ${color === '#10b981' ? 'rgba(16,185,129,0.4)' : '#334155'}`,
    borderRadius: 6, color: color === '#10b981' ? '#10b981' : '#94a3b8',
    cursor: 'pointer', fontSize: large ? 14 : 12, fontWeight: 600,
    padding: large ? '8px 20px' : '5px 12px',
  };
}

const emptyState: React.CSSProperties = {
  position: 'absolute', top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center', pointerEvents: 'all',
};
