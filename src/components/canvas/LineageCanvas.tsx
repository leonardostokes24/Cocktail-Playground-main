import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background,
  useNodesState, useEdgesState, useReactFlow,
  type NodeMouseHandler, type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';

import { useProofStore } from '../../store/useProofStore';
import SpecNodeComponent from './SpecNode';
import GradientEdge from '../CustomEdge';
import IngredientLibrary from '../library/IngredientLibrary';
import SpecPanel from '../spec/SpecPanel';
import SettingsPanel from '../spec/SettingsPanel';
import RadialMenu, { type RadialContext } from '../radial/RadialMenu';
import ContextMenuFallback from '../radial/ContextMenuFallback';
import CommonsPanel from './CommonsPanel';

const NODE_TYPES = { specNode: SpecNodeComponent };
const EDGE_TYPES = { default: GradientEdge };

interface Props {
  user: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

export default function LineageCanvas({ user, onLoginClick, onLogoutClick }: Props) {
  const {
    specs, specsLoading, selectedSpecId,
    loadSpecs, loadSpecCosts, loadIngredients, loadAllSpecComponents,
    createSpec, editSpec, selectSpec,
    activeFormulaId,
  } = useProofStore(useShallow(state => ({
    specs: state.specs,
    specsLoading: state.specsLoading,
    selectedSpecId: state.selectedSpecId,
    loadSpecs: state.loadSpecs,
    loadSpecCosts: state.loadSpecCosts,
    loadIngredients: state.loadIngredients,
    loadAllSpecComponents: state.loadAllSpecComponents,
    createSpec: state.createSpec,
    editSpec: state.editSpec,
    selectSpec: state.selectSpec,
    activeFormulaId: state.activeFormulaId,
  })));

  const [showLibrary, setShowLibrary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'canvas' | 'commons'>('canvas');
  const [radialCtx, setRadialCtx] = useState<RadialContext | null>(null);
  const [menuMode, setMenuMode] = useState<'radial' | 'list'>('radial');
  const [isFirstRun, setIsFirstRun] = useState(() => !localStorage.getItem('proof_menu_onboarded'));
  const [zoom, setZoom] = useState(100);
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const didFitRef = useRef(false);
  // Stable ref for long-press callback — avoids rebuilding node data on every render
  const longPressRef = useRef<(nodeId: string, pos: { x: number; y: number }) => void>(() => {});
  const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow();

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!user) return;
    loadSpecs().then(() => loadSpecCosts());
    loadIngredients();
    loadAllSpecComponents();
  }, [user?.id]);

  useEffect(() => {
    setRfNodes(current => {
      const posMap = new Map(current.map(n => [n.id, n.position]));
      return specs.map(spec => ({
        id: spec.id,
        type: 'specNode' as const,
        position: posMap.get(spec.id) ?? { x: spec.canvas_x, y: spec.canvas_y },
        data: stableNodeData,
      }));
    });
  }, [specs]);

  useEffect(() => {
    setRfEdges(
      specs
        .filter(s => s.parent_spec_id)
        .map(s => ({
          id: `${s.parent_spec_id}→${s.id}`,
          source: s.parent_spec_id!,
          target: s.id,
          type: 'default',
          label: s.change_note || undefined,
        }))
    );
  }, [specs]);

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
    }, 300);
  }, [editSpec]);

  const handleNewSpec = useCallback(async () => {
    const x = specs.length ? Math.max(...specs.map(s => s.canvas_x)) + 280 : 100;
    const spec = await createSpec({ name: 'New Spec', canvas_x: x, canvas_y: 200 });
    selectSpec(spec.id);
  }, [specs, createSpec, selectSpec]);

  const handlePanelClose = useCallback(() => {
    setRfNodes(nds => nds.map(n => n.selected ? { ...n, selected: false } : n));
    selectSpec(null);
    loadSpecCosts();
  }, [selectSpec, loadSpecCosts, setRfNodes]);

  const onPaneClick = useCallback(() => {
    if (radialCtx) { setRadialCtx(null); return; }
    if (selectedSpecId) selectSpec(null);
  }, [radialCtx, selectedSpecId, selectSpec]);

  const openMenu = useCallback((ctx: RadialContext) => {
    setRadialCtx(ctx);
    setMenuMode(isFirstRun ? 'list' : 'radial');
  }, [isFirstRun]);

  const handleDismissFirstRun = useCallback(() => {
    localStorage.setItem('proof_menu_onboarded', '1');
    setIsFirstRun(false);
  }, []);

  const handleNodeLongPress = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    openMenu({ kind: 'node', nodeId, position: pos });
  }, [openMenu]);
  // Keep ref in sync so SpecNode always has the latest callback without node data rebuild
  longPressRef.current = handleNodeLongPress;

  // Stable nodeData object — same reference forever, so React.memo on SpecNode can skip re-renders
  const stableNodeData = useMemo(() => ({
    onLongPress: (nodeId: string, pos: { x: number; y: number }) => longPressRef.current(nodeId, pos),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    openMenu({ kind: 'canvas', position: { x: e.clientX, y: e.clientY } });
  }, [user, openMenu]);

  const onNodeContextMenu: NodeMouseHandler = useCallback((e, node) => {
    e.preventDefault();
    if (!user) return;
    openMenu({ kind: 'node', nodeId: node.id, position: { x: e.clientX, y: e.clientY } });
  }, [user, openMenu]);

  const handleZoomIn = useCallback(() => {
    zoomIn();
    setTimeout(() => setZoom(Math.round(getViewport().zoom * 100)), 200);
  }, [zoomIn, getViewport]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
    setTimeout(() => setZoom(Math.round(getViewport().zoom * 100)), 200);
  }, [zoomOut, getViewport]);

  const handleFit = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 });
    setTimeout(() => setZoom(Math.round(getViewport().zoom * 100)), 450);
  }, [fitView, getViewport]);

  const onMoveEnd = useCallback(() => {
    setZoom(Math.round(getViewport().zoom * 100));
  }, [getViewport]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--ground)', position: 'relative', overflow: 'hidden' }}>

      {/* Light blooms — give glass something to refract */}
      <div className="bloom bloom-indigo" style={{ left: -60, top: 60, width: 460, height: 460 }} />
      <div className="bloom bloom-teal" style={{ right: 60, top: -40, width: 420, height: 420 }} />
      <div className="bloom bloom-plum" style={{ left: '44%', bottom: -120, width: 520, height: 460 }} />

      {/* ── Floating toolbar ─────────────────────────────────── */}
      <div style={toolbar}>
        {/* Left: wordmark + toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span className="display" style={wordmark}>Proof</span>
          {specsLoading && <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)' }}>Loading…</span>}
          <div style={toggle}>
            <button
              onClick={() => setCanvasMode('canvas')}
              style={canvasMode === 'canvas' ? toggleActive : toggleInactive}
            >
              Canvas
            </button>
            <button
              onClick={() => setCanvasMode('commons')}
              style={canvasMode === 'commons' ? toggleActive : toggleInactive}
            >
              Commons
            </button>
          </div>
        </div>

        {/* Right: model selector + actions + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user && (
            <>
              <button onClick={() => setShowSettings(true)} style={modelPill}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--text-muted)' }}>Model</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>GP% ex-VAT</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>▾</span>
              </button>
              <button onClick={() => setShowLibrary(true)} style={toolbarBtn}>Library</button>
              <button onClick={handleNewSpec} style={{ ...toolbarBtn, color: 'var(--cyan)', borderColor: 'rgba(127,230,255,.3)' }}>+ New Spec</button>
              <button onClick={onLogoutClick} style={toolbarBtn}>Sign Out</button>
            </>
          )}
          {!user && (
            <button onClick={onLoginClick} style={{ ...toolbarBtn, color: 'var(--cyan)', borderColor: 'rgba(127,230,255,.3)' }}>Sign In</button>
          )}
          {user && (
            <div style={avatar}>
              {user.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas ───────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onMoveEnd={onMoveEnd}
          minZoom={0.15}
          maxZoom={2.5}
          onlyRenderVisibleElements
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,.04)" gap={28} size={1} />
        </ReactFlow>

        {/* Empty states */}
        {!specsLoading && specs.length === 0 && user && (
          <div style={emptyState}>
            <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              No specs yet — right-click to start your first riff.
            </p>
          </div>
        )}
        {!user && (
          <div style={emptyState}>
            <p style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
              Sign in to build your lineage canvas.
            </p>
            <button onClick={onLoginClick} style={{ ...toolbarBtn, padding: '8px 20px', color: 'var(--cyan)', borderColor: 'rgba(127,230,255,.3)' }}>Sign In</button>
          </div>
        )}
      </div>

      {/* ── Zoom dock ────────────────────────────────────────── */}
      <div style={zoomDock}>
        <button onClick={handleZoomOut} style={dockBtn}>−</button>
        <span style={dockZoom}>{zoom}%</span>
        <button onClick={handleZoomIn} style={dockBtn}>+</button>
        <div style={dockDivider} />
        <button onClick={handleFit} style={{ ...dockBtn, padding: '0 10px', width: 'auto', fontFamily: 'var(--font-ui)', fontSize: 11 }}>
          Fit lineage
        </button>
      </div>

      {/* ── Panels & menus ───────────────────────────────────── */}
      {showLibrary && <IngredientLibrary onClose={() => setShowLibrary(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {selectedSpecId && <SpecPanel specId={selectedSpecId} onClose={handlePanelClose} />}
      {canvasMode === 'commons' && <CommonsPanel onClose={() => setCanvasMode('canvas')} />}

      {radialCtx && menuMode === 'radial' && (
        <RadialMenu context={radialCtx} onClose={() => setRadialCtx(null)} />
      )}
      {radialCtx && menuMode === 'list' && (
        <ContextMenuFallback
          context={radialCtx}
          onClose={() => setRadialCtx(null)}
          onSwitchToRadial={() => setMenuMode('radial')}
          firstRun={isFirstRun}
          onDismissFirstRun={handleDismissFirstRun}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const toolbar: React.CSSProperties = {
  position: 'absolute',
  top: 20, left: 20, right: 20,
  height: 52,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 18px',
  borderRadius: 'var(--r-bar)',
  background: 'linear-gradient(168deg, rgba(255,255,255,.085), rgba(255,255,255,.025))',
  backdropFilter: 'blur(24px) saturate(135%)',
  WebkitBackdropFilter: 'blur(24px) saturate(135%)',
  border: '1px solid rgba(255,255,255,.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.2), 0 12px 30px -14px rgba(0,0,0,.7)',
  zIndex: 60,
  pointerEvents: 'all',
};

const wordmark: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.02em',
};

const toggle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.08)',
  borderRadius: 9,
  padding: 3,
};

const toggleActive: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
  fontWeight: 600,
  color: '#0c0b14',
  background: 'rgba(230,235,245,.92)',
  padding: '5px 12px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
};

const toggleInactive: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--text-muted)',
  padding: '5px 12px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

const modelPill: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 9,
  padding: '6px 11px',
  cursor: 'pointer',
};

const toolbarBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,.05)',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 7,
  color: 'var(--text-2)',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 500,
  padding: '5px 12px',
};

const avatar: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  background: 'linear-gradient(140deg, #3a3380, #5a2a66)',
  border: '1px solid rgba(255,255,255,.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  flexShrink: 0,
};

const emptyState: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center',
  pointerEvents: 'all',
};

const zoomDock: React.CSSProperties = {
  position: 'absolute',
  bottom: 22,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: 5,
  borderRadius: 13,
  background: 'linear-gradient(168deg, rgba(255,255,255,.08), rgba(255,255,255,.03))',
  backdropFilter: 'blur(24px) saturate(135%)',
  WebkitBackdropFilter: 'blur(24px) saturate(135%)',
  border: '1px solid rgba(255,255,255,.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 14px 34px -14px rgba(0,0,0,.7)',
  zIndex: 60,
  pointerEvents: 'all',
};

const dockBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 7,
  color: 'var(--text-2)',
  fontFamily: 'var(--font-ui)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

const dockZoom: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-2)',
  minWidth: 40,
  textAlign: 'center',
  userSelect: 'none',
};

const dockDivider: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'rgba(255,255,255,.1)',
  margin: '0 2px',
};
