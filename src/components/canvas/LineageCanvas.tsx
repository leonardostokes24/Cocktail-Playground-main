import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, SelectionMode,
  useNodesState, useEdgesState, useReactFlow,
  type NodeMouseHandler, type OnNodeDrag,
  type OnConnect, type OnConnectStart, type OnConnectEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';

import { useProofStore } from '../../store/useProofStore';
import SpecNodeComponent from './SpecNode';
import GradientEdge from '../CustomEdge';
import IngredientLibrary from '../library/IngredientLibrary';
import PrepLibrary from '../library/PrepLibrary';
import IngestPanel from '../library/IngestPanel';
import VenuePanel from '../library/VenuePanel';
import SpecPanel from '../spec/SpecPanel';
import SettingsPanel from '../spec/SettingsPanel';
import { detachedBy } from '../../utils/childCounts';
import CommonsPanel from './CommonsPanel';
import SelectionMenu, { type Summon } from './SelectionMenu';
import GroupLayer from './GroupLayer';

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
    createSpec, editSpec, selectSpec, branchSpec, attachBranch,
    removeSpecs, duplicateSpecs, tidySpecs, publishSpecs,
    activeFormulaId, forkSources, loadForkSources, layoutNonce,
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
    branchSpec: state.branchSpec,
    attachBranch: state.attachBranch,
    removeSpecs: state.removeSpecs,
    duplicateSpecs: state.duplicateSpecs,
    tidySpecs: state.tidySpecs,
    publishSpecs: state.publishSpecs,
    activeFormulaId: state.activeFormulaId,
    layoutNonce: state.layoutNonce,
    forkSources: state.forkSources,
    loadForkSources: state.loadForkSources,
  })));

  const [showLibrary, setShowLibrary] = useState(false);
  const [showPreps, setShowPreps] = useState(false);
  const [showIngest, setShowIngest] = useState(false);
  const [showVenues, setShowVenues] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Selecting a node and opening its recipe are different things now: the
  // tethered menu is what a click reveals, and the full panel is one explicit
  // action away. Nodes stay plain cards (8a).
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelBuilder, setPanelBuilder] = useState(false);
  // Group hulls are a view preference, so it survives a reload.
  const [showGroups, setShowGroups] = useState(() => {
    try { return localStorage.getItem('proof_show_groups') !== '0'; } catch { return true; }
  });
  const [canvasMode, setCanvasMode] = useState<'canvas' | 'commons'>('canvas');
  // Right-click summons the tethered menu to the pointer (it replaced the radial).
  const [summon, setSummon] = useState<Summon | null>(null);
  const [zoom, setZoom] = useState(100);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  // Marquee mode: drag the pane to draw a selection box instead of panning.
  const [boxSelect, setBoxSelect] = useState(false);
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const didFitRef = useRef(false);
  const layoutRef = useRef(0);
  // Stable ref for long-press callback — avoids rebuilding node data on every render
  const longPressRef = useRef<(nodeId: string, pos: { x: number; y: number }) => void>(() => {});
  const { fitView, zoomIn, zoomOut, getViewport, screenToFlowPosition } = useReactFlow();
  // Source node of an in-progress handle drag (for drag-to-empty → twist).
  const connectingFrom = useRef<string | null>(null);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!user) return;
    loadSpecs().then(() => { loadSpecCosts(); loadForkSources(); });
    loadIngredients();
    loadAllSpecComponents();
  }, [user?.id]);

  useEffect(() => {
    // A layout pass (Tidy) is the one case where stored coordinates must win:
    // otherwise the live positions preserved below discard the new layout.
    //
    // This is computed HERE, not inside the updater. StrictMode double-invokes
    // updaters to surface impure ones: mutating the ref in there made the second
    // call see takeStored === false and return the old positions, so every Tidy
    // computed a correct layout and then threw it away.
    const takeStored = layoutRef.current !== layoutNonce;
    layoutRef.current = layoutNonce;

    setRfNodes(current => {
      // Carry live canvas state across the rebuild. Position AND selection live in
      // React Flow, not the store — dropping `selected` here silently cleared the
      // selection on every specs change (e.g. the debounced drag-position save),
      // which made the bulk actions look broken.
      const liveById = new Map(current.map(n => [n.id, n]));
      return specs.map(spec => {
        const live = liveById.get(spec.id);
        return {
          id: spec.id,
          type: 'specNode' as const,
          position: takeStored || !live ? { x: spec.canvas_x, y: spec.canvas_y } : live.position,
          selected: live?.selected ?? false,
          data: stableNodeData,
        };
      });
    });
  }, [specs, layoutNonce]);

  useEffect(() => {
    // Branch: your own version of your own drink — parent is a spec you own.
    const branchEdges = specs
      .filter(s => s.parent_spec_id)
      .map(s => ({
        id: `${s.parent_spec_id}→${s.id}`,
        source: s.parent_spec_id!,
        target: s.id,
        type: 'default',
        label: s.change_note || undefined,
        data: { kind: 'branch' as const },
      }));

    // Fork: crossed over from a published snapshot. An edge can only be drawn
    // when that snapshot's live spec is also on this canvas — for a genuine
    // cross-user fork it belongs to someone else and RLS hides it, so the node
    // carries a FORK badge instead of a dangling edge to nowhere.
    const onCanvas = new Set(specs.map(s => s.id));
    const forkEdges = specs
      .filter(s => s.forked_from_published_id)
      .map(s => {
        const src = forkSources[s.forked_from_published_id!];
        if (!src?.spec_id || !onCanvas.has(src.spec_id) || src.spec_id === s.id) return null;
        return {
          id: `fork:${src.spec_id}→${s.id}`,
          source: src.spec_id,
          target: s.id,
          type: 'default',
          label: 'forked',
          data: { kind: 'fork' as const },
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    setRfEdges([...branchEdges, ...forkEdges]);
  }, [specs, forkSources]);

  useEffect(() => {
    if (rfNodes.length > 0 && !didFitRef.current) {
      didFitRef.current = true;
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
    }
  }, [rfNodes.length]);

  // ── Handlers ─────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((evt, node) => {
    // Multi-select (⌘/Ctrl or Shift) builds a selection — don't open the panel over it.
    if (evt.metaKey || evt.ctrlKey || evt.shiftKey) return;
    selectSpec(node.id);
    setPanelOpen(false);
  }, [selectSpec]);

  const onNodeDragStop: OnNodeDrag = useCallback((_evt, node) => {
    clearTimeout(dragSaveTimer.current);
    dragSaveTimer.current = setTimeout(() => {
      editSpec(node.id, { canvas_x: node.position.x, canvas_y: node.position.y });
    }, 300);
  }, [editSpec]);

  // ── Lineage gestures ─────────────────────────────────────────
  const onConnectStart: OnConnectStart = useCallback((_evt, params) => {
    connectingFrom.current = params.nodeId ?? null;
  }, []);

  // Drag a node's handle onto another node → attach it as a branch (cycle-guarded).
  const onConnect: OnConnect = useCallback((conn) => {
    if (conn.source && conn.target && conn.source !== conn.target) {
      attachBranch(conn.target, conn.source);
    }
  }, [attachBranch]);

  // Drag a node's handle onto empty canvas → spawn a twist (branch child) there.
  const onConnectEnd: OnConnectEnd = useCallback((event) => {
    const source = connectingFrom.current;
    connectingFrom.current = null;
    if (!source || !user) return;
    const target = event.target as Element | null;
    if (!target?.classList?.contains('react-flow__pane')) return; // dropped on a node → onConnect handled it
    const point = 'changedTouches' in event ? event.changedTouches[0] : (event as MouseEvent);
    const pos = screenToFlowPosition({ x: point.clientX, y: point.clientY });
    // Centre the 232px-wide node under the cursor. Height is content-driven now
    // (recipe rows), so only nudge y by the header — don't assume a fixed height.
    branchSpec(source, { x: pos.x - 116, y: pos.y - 28 });
  }, [screenToFlowPosition, branchSpec, user]);

  // ── Selection & bulk actions ─────────────────────────────────
  // React Flow owns selection state; derive the ids rather than duplicating it.
  const selectedIds = useMemo(() => rfNodes.filter(n => n.selected).map(n => n.id), [rfNodes]);

  // Twists whose parent is in the selection but which aren't selected themselves
  // survive the delete as roots. The dock names them before you commit.
  const bulkDetaching = useMemo(
    () => detachedBy(specs, selectedIds),
    [specs, selectedIds],
  );
  const selectedCount = selectedIds.length;
  const hasSelection = selectedCount > 0;
  const actionsDisabled = !hasSelection || bulkBusy;

  // Widths mirror each panel's own style; the widest open one reserves space so
  // the dock never sits underneath it.
  const openPanelWidth = Math.max(
    selectedSpecId && panelOpen ? 560 : 0, // SpecPanel
    showLibrary ? 680 : 0,             // IngredientLibrary
    showPreps ? 620 : 0,               // PrepLibrary
    showSettings ? 420 : 0,            // SettingsPanel
    canvasMode === 'commons' ? 500 : 0 // CommonsPanel (480 + 20 right margin)
  );

  // A changed selection invalidates a pending delete confirmation.
  useEffect(() => { setConfirmingDelete(false); }, [selectedCount]);

  const clearSelection = useCallback(() => {
    setRfNodes(nds => nds.map(n => (n.selected ? { ...n, selected: false } : n)));
    selectSpec(null);
  }, [setRfNodes, selectSpec]);

  // Every bulk action ends with the selection cleared, so the dock returns to rest.
  // allowEmpty: Tidy is meaningful with nothing selected (it straightens the
  // whole canvas); every other bulk action needs a target.
  const runBulk = useCallback(async (fn: (ids: string[]) => Promise<void>, allowEmpty = false) => {
    if ((!selectedIds.length && !allowEmpty) || bulkBusy) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      await fn(selectedIds);
      clearSelection();
    } catch (err) {
      // Surface it in the dock — a silent failure here reads as "delete is broken".
      // Supabase rejects with a PostgrestError object, not an Error instance, so
      // check for a message property too or the real reason is lost.
      const message =
        err instanceof Error ? err.message
        : typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Action failed';
      setBulkError(message);
    } finally {
      setBulkBusy(false);
      setConfirmingDelete(false);
    }
  }, [selectedIds, bulkBusy, clearSelection]);

  const handleNewSpec = useCallback(async () => {
    const x = specs.length ? Math.max(...specs.map(s => s.canvas_x)) + 280 : 100;
    const spec = await createSpec({ name: 'New Spec', canvas_x: x, canvas_y: 200 });
    selectSpec(spec.id);
  }, [specs, createSpec, selectSpec]);

  const handlePanelClose = useCallback(() => {
    setPanelOpen(false);
    setPanelBuilder(false);
    loadSpecCosts();
  }, [loadSpecCosts]);

  const onPaneClick = useCallback(() => {
    if (selectedSpecId) selectSpec(null);
    setPanelOpen(false);
  }, [selectedSpecId, selectSpec]);

  const summonMenu = useCallback((nodeId: string | null, pos: { x: number; y: number }) => {
    selectSpec(nodeId);
    setPanelOpen(false);
    setSummon({ x: pos.x, y: pos.y, nonce: Date.now() });
  }, [selectSpec]);

  const handleNodeLongPress = useCallback((nodeId: string, pos: { x: number; y: number }) => {
    summonMenu(nodeId, pos);
  }, [summonMenu]);
  // Keep ref in sync so SpecNode always has the latest callback without node data rebuild
  longPressRef.current = handleNodeLongPress;

  // Stable nodeData object — same reference forever, so React.memo on SpecNode can skip re-renders
  const stableNodeData = useMemo(() => ({
    onLongPress: (nodeId: string, pos: { x: number; y: number }) => longPressRef.current(nodeId, pos),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    summonMenu(null, { x: e.clientX, y: e.clientY });
  }, [user, summonMenu]);

  const onNodeContextMenu: NodeMouseHandler = useCallback((e, node) => {
    e.preventDefault();
    if (!user) return;
    summonMenu(node.id, { x: e.clientX, y: e.clientY });
  }, [user, summonMenu]);

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

      <div className="bloom bloom-teal" style={{ right: 60, top: -40, width: 420, height: 420 }} />
      <div className="bloom bloom-plum" style={{ left: '44%', bottom: -120, width: 520, height: 460 }} />

      {/* ── Floating toolbar ─────────────────────────────────── */}
      <div style={toolbar}>
        {/* Left: wordmark + the whole nav, as the design groups it */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <span className="display" style={wordmark}>Proof</span>
          <div style={toggle}>
            <button onClick={() => setCanvasMode('canvas')}
                    style={canvasMode === 'canvas' ? toggleActive : toggleInactive}>Canvas</button>
            <button onClick={() => setCanvasMode('commons')}
                    style={canvasMode === 'commons' ? toggleActive : toggleInactive}>Commons</button>
            {user && <>
              <button onClick={() => setShowLibrary(true)} style={toolbarBtn}>Library</button>
              <button onClick={() => setShowPreps(true)} style={toolbarBtn}>Preps</button>
              <button onClick={() => setShowVenues(true)} style={toolbarBtn}>Venues</button>
            </>}
          </div>
          {specsLoading && <span style={loadingNote}>Loading…</span>}
        </div>

        {/* Right: costing model + the one live action + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
          {user && (
            <>
              <button onClick={() => setShowSettings(true)} style={modelPill}>
                model <span style={{ color: 'var(--ink)' }}>{activeFormulaId === 'gp_ex_vat' ? 'gp% ex-vat' : activeFormulaId}</span> ▾
              </button>
              <button onClick={handleNewSpec} style={{ ...toolbarBtn, color: 'var(--accent)' }}>+ New spec</button>
              <button onClick={onLogoutClick} style={toolbarBtn}>Sign out</button>
            </>
          )}
          {!user && (
            <button onClick={onLoginClick} style={{ ...toolbarBtn, color: 'var(--accent)' }}>Sign in</button>
          )}
          {user && (
            <div style={avatar}>
              {user.email?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
        </div>
      </div>

      {/* ── Canvas ───────────────────────────────────────────── */}
      {/* Below ~55% zoom the recipe rows are unreadable — CSS hides them (see index.css). */}
      <div style={{ position: 'absolute', inset: 0 }} data-zoom={zoom < 55 ? 'far' : 'near'}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onMoveEnd={onMoveEnd}
          minZoom={0.15}
          maxZoom={2.5}
          onlyRenderVisibleElements
          // Select mode: drag the pane to marquee-select. Middle mouse still pans
          // (button 2 is left alone so right-click keeps opening the radial menu).
          selectionOnDrag={boxSelect}
          panOnDrag={boxSelect ? [1] : true}
          // Partial: touching a node selects it — full containment is too fussy
          // now that nodes are tall recipe cards.
          selectionMode={SelectionMode.Partial}
          // Backspace would remove nodes from canvas state only, leaving the DB rows
          // to reappear on reload. Deletion goes through the dock (store-backed).
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          {showGroups && <GroupLayer />}
          <Background color="var(--dot)" gap={26} size={1} />
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

      {/* ── Dock: zoom + selection actions ───────────────────── */}
      {/* Keep the dock clear of whichever side panel is open (widths match each
          panel's own style) so its buttons stay clickable. */}
      <div style={{ ...dockRail, right: 12 + openPanelWidth }}>
      <div style={zoomDock}>
        <button onClick={handleZoomOut} style={dockBtn} aria-label="Zoom out">−</button>
        <span style={dockZoom}>{zoom}%</span>
        <button onClick={handleZoomIn} style={dockBtn} aria-label="Zoom in">+</button>
        <div style={dockDivider} />
        <button onClick={handleFit} style={dockTextBtn}>Fit lineage</button>

        {/* Tool mode: pan vs marquee-select */}
        <div style={dockDivider} />
        <button
          onClick={() => setBoxSelect(false)}
          style={dockToggleBtn(!boxSelect)}
          title="Pan the canvas (drag to move)"
          aria-pressed={!boxSelect}
        >
          Pan
        </button>
        <button
          onClick={() => setBoxSelect(true)}
          style={dockToggleBtn(boxSelect)}
          title="Select box (drag to select nodes)"
          aria-pressed={boxSelect}
        >
          Select
        </button>

        {/* Selection actions — always present; inert until nodes are selected */}
        <div style={dockDivider} />
        {confirmingDelete && hasSelection ? (
          <>
            <span style={{ ...dockCount, color: '#ffb4b4' }}>
              {bulkDetaching
                ? `Delete ${selectedCount}? ${bulkDetaching} detach`
                : `Delete ${selectedCount}?`}
            </span>
            <button
              onClick={() => runBulk(removeSpecs)}
              disabled={bulkBusy}
              style={{ ...dockActionBtn(bulkBusy), color: '#ff9d9d', borderColor: 'rgba(255,120,120,.35)', background: 'rgba(255,120,120,.12)' }}
            >
              {bulkBusy ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => setConfirmingDelete(false)} style={dockActionBtn(false)}>Keep</button>
          </>
        ) : (
          <>
            <span style={hasSelection ? dockCount : dockCountIdle}>
              {hasSelection ? `${selectedCount} selected` : 'None selected'}
            </span>
            <button onClick={() => runBulk(duplicateSpecs)} disabled={actionsDisabled} style={dockActionBtn(actionsDisabled)}>Duplicate</button>
            <button onClick={() => runBulk(tidySpecs, true)} disabled={bulkBusy} style={dockActionBtn(bulkBusy)} title="Straighten the lineage — the whole canvas if nothing is selected">Tidy</button>
            <button
              onClick={() => setShowGroups(v => {
                const next = !v;
                try { localStorage.setItem('proof_show_groups', next ? '1' : '0'); } catch { /* private mode */ }
                return next;
              })}
              style={dockToggleBtn(showGroups)}
              aria-pressed={showGroups}
              title={showGroups ? 'Hide lineage groups' : 'Show lineage groups'}
            >
              Groups
            </button>
            <button onClick={() => runBulk(publishSpecs)} disabled={actionsDisabled} style={dockActionBtn(actionsDisabled)}>Publish</button>
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={actionsDisabled}
              style={{ ...dockActionBtn(actionsDisabled), color: actionsDisabled ? 'var(--text-muted)' : '#ff9d9d' }}
            >
              Delete
            </button>
            <button
              onClick={clearSelection}
              disabled={actionsDisabled}
              style={{ ...dockBtn, opacity: actionsDisabled ? 0.35 : 1, cursor: actionsDisabled ? 'default' : 'pointer' }}
              aria-label="Clear selection"
            >
              ✕
            </button>
          </>
        )}

        {bulkError && (
          <>
            <div style={dockDivider} />
            <span style={dockErrorText} title={bulkError}>{bulkError}</span>
            <button onClick={() => setBulkError(null)} style={dockBtn} aria-label="Dismiss error">✕</button>
          </>
        )}
      </div>
      </div>

      {/* ── Panels & menus ───────────────────────────────────── */}
      {showLibrary && <IngredientLibrary onClose={() => setShowLibrary(false)} />}
      {showPreps && <PrepLibrary onClose={() => setShowPreps(false)} />}
      {showVenues && <VenuePanel onClose={() => setShowVenues(false)} />}
      {showIngest && (
        <IngestPanel onClose={() => setShowIngest(false)} onDone={(id) => selectSpec(id)} />
      )}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {canvasMode === 'canvas' && user && <SelectionMenu
          onNewSpec={handleNewSpec}
          onOpenRecipe={(o) => { setPanelOpen(true); setPanelBuilder(!!o?.builder); }}
          summon={summon}
        />}

      {selectedSpecId && panelOpen && <SpecPanel specId={selectedSpecId} onClose={handlePanelClose} openBuilder={panelBuilder} />}
      {canvasMode === 'commons' && <CommonsPanel onClose={() => setCanvasMode('canvas')} />}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

/* Full-bleed rule across the top, as in the design — not a floating pill. */
const toolbar: React.CSSProperties = {
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: 52,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 24px',
  gap: 18,
  background: 'var(--card)',
  borderBottom: '1px solid rgba(26,26,23,.22)',
  zIndex: 60,
  pointerEvents: 'all',
};

const loadingNote: React.CSSProperties = {
  font: '400 10px/1 var(--font-mono)',
  color: 'var(--ink-45)',
  whiteSpace: 'nowrap',
};

const wordmark: React.CSSProperties = {
  font: '500 17px/1 var(--font-display)',
  color: 'var(--ink)',
};

/* Nav reads as words with a rule under the current one — no pill, no chrome. */
const toggle: React.CSSProperties = {
  display: 'flex',
  gap: 22,
  alignItems: 'baseline',
};

const toggleActive: React.CSSProperties = {
  font: '400 13px/1 var(--font-display)',
  color: 'var(--ink)',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--ink)',
  padding: '0 0 2px',
  cursor: 'pointer',
};

const toggleInactive: React.CSSProperties = {
  font: '400 13px/1 var(--font-display)',
  color: 'var(--ink-72)',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid transparent',
  padding: '0 0 2px',
  cursor: 'pointer',
};

const modelPill: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
  background: 'none',
  border: 'none',
  padding: 0,
  font: "400 10.5px/1 var(--font-mono)",
  color: 'var(--ink-72)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const toolbarBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  borderRadius: 0,
  color: 'var(--ink-72)',
  cursor: 'pointer',
  font: '400 13px/1 var(--font-display)',
  padding: 0,
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const avatar: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 0,
  background: 'none',
  border: '1px solid rgba(26,26,23,.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  font: "400 10px/1 var(--font-mono)",
  color: 'var(--ink)',
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

// The dock lives inside dockRail, which centres it in the space a side panel
// isn't using — so its right-hand buttons can never end up under a panel.
const zoomDock: React.CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  flexWrap: 'wrap',
  maxWidth: 'calc(100vw - 48px)',
  background: 'var(--card)',
  border: '1px solid var(--rule-strong)',
  borderRadius: 0,
  overflow: 'hidden',
  pointerEvents: 'all',
};

// Full-width rail; `right` shrinks to clear whichever side panel is open, and the
// dock centres in what's left. zIndex sits above the panels (SpecPanel is 3100)
// so the dock is never buried — that bug made Delete unclickable.
const dockRail: React.CSSProperties = {
  position: 'absolute',
  bottom: 24,
  left: 24,
  maxWidth: 'calc(100vw - 48px)',
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 3200,
};

const dockBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  borderRight: '1px solid var(--rule)',
  borderRadius: 0,
  color: 'var(--ink)',
  font: '400 11px/1 var(--font-mono)',
  cursor: 'pointer',
};

const dockTextBtn: React.CSSProperties = {
  height: 30,
  display: 'flex',
  alignItems: 'center',
  padding: '0 13px',
  background: 'none',
  border: 'none',
  borderRight: '1px solid var(--rule)',
  borderRadius: 0,
  color: 'var(--ink)',
  font: '400 12.5px/1 var(--font-display)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function dockToggleBtn(active: boolean): React.CSSProperties {
  return {
    ...dockTextBtn,
    background: active ? 'var(--ink)' : 'none',
    color: active ? 'var(--on-ink)' : 'var(--ink-72)',
  };
}

// The selection actions are always mounted, so they need a resting (inert) state.
function dockActionBtn(disabled: boolean): React.CSSProperties {
  return {
    ...dockTextBtn,
    color: disabled ? 'var(--ink-45)' : 'var(--ink)',
    cursor: disabled ? 'default' : 'pointer',
  };
}

const dockCount: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 13px',
  borderRight: '1px solid var(--rule)',
  font: '400 10.5px/1 var(--font-mono)',
  color: 'var(--accent)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const dockErrorText: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
  color: '#ff9d9d',
  maxWidth: 260,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const dockCountIdle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 13px',
  borderRight: '1px solid var(--rule)',
  font: '400 10.5px/1 var(--font-mono)',
  color: 'var(--ink-45)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const dockZoom: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 52,
  padding: '8px 12px',
  borderRight: '1px solid var(--rule)',
  font: '400 11px/1 var(--font-mono)',
  color: 'var(--ink)',
  whiteSpace: 'nowrap',
};

const dockDivider: React.CSSProperties = { display: 'none' };
