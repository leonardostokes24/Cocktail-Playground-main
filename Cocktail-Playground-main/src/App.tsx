import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useStore,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ZoomIn, ZoomOut, Maximize, Map as MapIcon, LogOut, User, Save, FolderOpen } from 'lucide-react';
import IngredientNode from './components/IngredientNode';
import SpecNode from './components/SpecNode';
import ContainerNode from './components/ContainerNode';
import CustomEdge from './components/CustomEdge';
import RadialWheel from './components/RadialWheel';
import LoginModal from './components/LoginModal';
import { findCocktailMatch, ibaCocktails, type Cocktail } from './data/cocktailDB';
import { exportFlowToPdf, type ExportMode, type Orientation, type PaperSize } from './utils/exportPdf';
import { supabase } from './services/supabaseClient';
import { HierarchyManager } from './utils/hierarchy';
import { sortNodesByHierarchy } from './utils/hierarchySorting';

const nodeTypes = {
  ingredient: IngredientNode,
  spec: SpecNode,
  container: ContainerNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const FORMULA_STRUCTURES: Record<string, { ingredients: { label: string; type: string; amount: string }[] }> = {
  'The Sour': { ingredients: [{ label: 'Base Spirit', type: 'spirit', amount: '2 oz' }, { label: 'Citrus', type: 'citrus', amount: '0.75 oz' }, { label: 'Sweetener', type: 'sweetener', amount: '0.75 oz' }] },
  'Spirit-Forward': { ingredients: [{ label: 'Base Spirit', type: 'spirit', amount: '2 oz' }, { label: 'Fortified Wine', type: 'modifier', amount: '1 oz' }, { label: 'Aromatic Bitters', type: 'bitters', amount: '2 dashes' }] },
  'Highball': { ingredients: [{ label: 'Base Spirit', type: 'spirit', amount: '2 oz' }, { label: 'Modifier / Citrus', type: 'citrus', amount: '0.5 oz' }, { label: 'Sparkling Filler', type: 'sweetener', amount: '4 oz' }] },
  'Negroni Style': { ingredients: [{ label: 'Base Spirit', type: 'spirit', amount: '1 oz' }, { label: 'Bitters / Aperitif', type: 'modifier', amount: '1 oz' }, { label: 'Sweet Vermouth', type: 'modifier', amount: '1 oz' }] },
};

let idCounter = 0;
const getId = () => `node_${idCounter++}_${Date.now()}`;

function CocktailCanvas({ user, onLoginClick, onLogoutClick, onDemoLogin }: { user: any, onLoginClick: () => void, onLogoutClick: () => void, onDemoLogin: () => void }) {

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const { screenToFlowPosition, getNode, zoomIn, zoomOut, fitView, getViewport, setViewport } = useReactFlow();
  // Reactive zoom — only re-renders when the rounded integer zoom value changes.
  const zoomLevel = useStore((s: any) => Math.round(s.transform[2] * 100));
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('allNodes');
  const [exportPaper, setExportPaper] = useState<PaperSize>('a4');
  const [exportOrientation, setExportOrientation] = useState<Orientation>('landscape');

  // --- Canvas Saving & Gallery ---
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [savedCanvases, setSavedCanvases] = useState<any[]>([]);
  const [canvasName, setCanvasName] = useState("");

  const fetchCanvases = useCallback(async () => {
    if (!user) return;

    if (user.id === 'demo-user-123') {
      const local = localStorage.getItem('demo_canvases');
      setSavedCanvases(local ? JSON.parse(local) : []);
      return;
    }

    const { data, error } = await supabase
      .from('canvases')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setSavedCanvases(data);
  }, [user]);

  useEffect(() => {
    fetchCanvases();
  }, [fetchCanvases]);

  const saveCanvas = async () => {
    if (!user || !canvasName) return;

    if (user.id === 'demo-user-123') {
      const local = localStorage.getItem('demo_canvases');
      const current = local ? JSON.parse(local) : [];
      const updated = [...current.filter((c: any) => c.name !== canvasName), {
        id: Date.now().toString(),
        name: canvasName,
        nodes,
        edges,
        user_id: user.id,
        created_at: new Date().toISOString(),
      }];
      localStorage.setItem('demo_canvases', JSON.stringify(updated));
      alert('Canvas saved successfully (Demo Mode)!');
      setCanvasName("");
      fetchCanvases();
      return;
    }

    const { error } = await supabase.from('canvases').upsert({
      name: canvasName,
      nodes,
      edges,
      user_id: user.id,
    });
    if (error) {
      alert('Error saving canvas: ' + error.message);
    } else {
      alert('Canvas saved successfully!');
      setCanvasName("");
      fetchCanvases();
    }
  };

  const loadCanvas = (canvas: any) => {
    setNodes(sortNodesByHierarchy(canvas.nodes));
    setEdges(canvas.edges);
    setGalleryOpen(false);
  };

  // Track lock states — memoized so the parenting effect only re-runs when
  // a spec's isLocked flag actually changes, not on every node mutation.
  const lockStatesHash = useMemo(
    () => nodes.filter(n => n.type === 'spec').map(n => `${n.id}:${n.data?.isLocked ?? true}`).join('|'),
    [nodes]
  );

  // Memoize sorted nodes so the O(n log n) sort isn't repeated on every render.
  const sortedNodes = useMemo(() => sortNodesByHierarchy(nodes), [nodes]);

  // --- Modal States ---
  const [modalConfig, setModalConfig] = useState<{
    type: 'amount' | 'twist' | 'edit-edge';
    params: Connection | Partial<Edge>;
    sourceNode?: Node;
    targetNode?: Node;
    edgeId?: string;
  } | null>(null);

  const [amountInput, setAmountInput] = useState("");
  const [twistLabel, setTwistLabel] = useState("");
  const [newIngName, setNewIngName] = useState("");
  const [newIngAmount, setNewIngAmount] = useState("");
  const [inheritedList, setInheritedList] = useState<{ node: Node; amount: string | undefined }[]>([]);

  // --- Radial Wheel ---
  const [radialPos, setRadialPos] = useState<{ x: number; y: number } | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);

  // --- Auto-Matcher & Recipe List Sync ---
  useEffect(() => {
    setNodes((currentNodes) => {
      let nodesChanged = false;

      const updatedNodes = currentNodes.map(node => {
        if (node.type !== 'spec') return node;

        const incomingEdges = edges.filter(e => e.target === node.id);

        // 1. Compile ingredients list for display
        const ingredientsList = incomingEdges.map(edge => {
          const sourceNode = currentNodes.find(n => n.id === edge.source);
          if (sourceNode && sourceNode.type === 'ingredient') {
            return { name: sourceNode.data.label as string, amount: edge.label as string };
          }
          return null;
        }).filter((i): i is { name: string; amount: string } => i !== null);

        // 2. Check for changes to avoid loops
        const currentListStr = JSON.stringify(node.data.ingredientsList || []);
        const newListStr = JSON.stringify(ingredientsList);
        const listChanged = currentListStr !== newListStr;

        let newLabel = (node.data.label as string) || 'Custom Recipe';
        let newMethod = (node.data.method as string) || 'Experimenting...';
        let newGlass = (node.data.glassware as string) || 'Unknown';
        let newIsMatched = !!node.data.isMatched;

        // 3. Match IBA cocktails if not overridden
        if (!node.data.isCustomOverride) {
          const match = findCocktailMatch(ingredientsList.map(i => i.name));
          if (match) {
            newLabel = match.name;
            newMethod = match.method;
            newGlass = match.glass;
            newIsMatched = true;
          } else {
            newLabel = 'Custom Recipe';
            newMethod = 'Experimenting...';
            newGlass = 'Unknown';
            newIsMatched = false;
          }
        }

        if (listChanged || node.data.label !== newLabel || node.data.isMatched !== newIsMatched) {
          nodesChanged = true;
          return {
            ...node,
            data: {
              ...node.data,
              label: newLabel,
              method: newMethod,
              glassware: newGlass,
              isMatched: newIsMatched,
              ingredientsList: ingredientsList
            }
          };
        }
        return node;
      });

      return nodesChanged ? updatedNodes : currentNodes;
    });
  // Only re-run when edges change. currentNodes is always fresh inside
  // the setNodes updater callback, so removing `nodes` from deps here
  // is safe and breaks the circular update loop.
  }, [edges, setNodes]);

  const onNodeDragStop = useCallback((_: any, draggedNode: Node) => {
    setNodes((nds) => {
      const abs = HierarchyManager.getAbsolutePosition(draggedNode, nds);

      // 1. Find the best containing node (Container or Spec)
      const parentContainer = HierarchyManager.pickContainingNode(
        nds.filter(n => n.type === 'container' && n.id !== draggedNode.id),
        abs,
        nds,
        { width: 300, height: 300 }
      );

      const parentSpecCandidate = HierarchyManager.pickContainingNode(
        nds.filter(n => n.type === 'spec' && n.id !== draggedNode.id),
        abs,
        nds,
        { width: 240, height: 160 }
      );

      // A Spec only acts as a parent if it's in "Locked" mode
      const parentSpec = (parentSpecCandidate?.data?.isLocked !== false) ? parentSpecCandidate : null;
      const finalParent = parentContainer || parentSpec;

      if (finalParent) {
        if (draggedNode.parentId === finalParent.id) return nds;

        const parentAbs = HierarchyManager.getAbsolutePosition(finalParent, nds);

        // Containers restrict dragging with extent:'parent'; spec parenting is loose (no extent)
        const isContainer = finalParent.type === 'container';

        return nds.map(node => {
          if (node.id === draggedNode.id) {
            return {
              ...node,
              parentId: finalParent.id,
              position: { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y },
              extent: isContainer ? 'parent' : undefined
            } as Node;
          }
          return node;
        });
      }

      // 2. If dropped outside, handle unparenting
      if (draggedNode.parentId) {
          const currentParent = nds.find(n => n.id === draggedNode.parentId);
          const isLockedSpec = currentParent?.type === 'spec' && (currentParent.data?.isLocked !== false);

          if (isLockedSpec) {
            const isConnected = edges.some(e => e.source === draggedNode.id && e.target === currentParent?.id);
            if (isConnected) return nds;
          }

          return nds.map(node => {
            if (node.id === draggedNode.id) {
              return {
                ...node,
                parentId: undefined,
                position: { x: abs.x, y: abs.y },
                extent: undefined
              } as Node;
            }
            return node;
          });
      }

      return nds;
    });
  }, [setNodes, edges]);

  // Sync parenting with edges — uses a Map for O(1) node lookups instead of
  // repeated Array.find() calls (was O(n) per ingredient per edge change).
  useEffect(() => {
    setNodes((nds) => {
      let changed = false;
      const nodeMap = new Map<string, Node>(nds.map(n => [n.id, n]));
      const edgesBySource = new Map<string, Edge[]>();
      for (const e of edges) {
        const arr: Edge[] = edgesBySource.get(e.source) ?? [];
        arr.push(e);
        edgesBySource.set(e.source, arr);
      }

      const nextNodes = nds.map(node => {
        if (node.type !== 'ingredient') return node;

        const outgoing: Edge[] = edgesBySource.get(node.id) ?? [];
        const specEdge = outgoing.find(e => nodeMap.get(e.target)?.type === 'spec');

        const targetNodeId = specEdge?.target ?? node.parentId;
        const targetCandidate = nodeMap.get(targetNodeId ?? '');
        const isLocked = targetCandidate?.data?.isLocked ?? true;

        if (isLocked) {
          // LOCK MODE — ingredient travels with its connected spec (parentId only, no extent so it can still be dragged freely)
          if (specEdge && node.parentId !== specEdge.target) {
            const targetNode = nodeMap.get(specEdge.target);
            if (!targetNode) return node;
            changed = true;
            const nodeAbs = HierarchyManager.getAbsolutePosition(node, nds);
            const parentAbs = HierarchyManager.getAbsolutePosition(targetNode, nds);
            return {
              ...node,
              parentId: specEdge.target,
              extent: undefined,
              position: { x: nodeAbs.x - parentAbs.x, y: nodeAbs.y - parentAbs.y },
            };
          }
          if (!specEdge && node.parentId && nodeMap.get(node.parentId)?.type === 'spec') {
            changed = true;
            const nodeAbs = HierarchyManager.getAbsolutePosition(node, nds);
            return { ...node, parentId: undefined, extent: undefined, position: nodeAbs };
          }
        } else {
          // LOOSE MODE — detach from spec parent so ingredients float freely
          if (node.parentId && nodeMap.get(node.parentId)?.type === 'spec') {
            changed = true;
            const nodeAbs = HierarchyManager.getAbsolutePosition(node, nds);
            return { ...node, parentId: undefined, extent: undefined, position: nodeAbs };
          }
        }

        return node;
      });

      return changed ? nextNodes : nds;
    });
  }, [edges, setNodes, lockStatesHash]);

  // Close overflow menu when clicking outside
  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as HTMLElement)) {
        setShowOverflow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOverflow]);

  // Long-press to open radial wheel on touch devices
  const onCanvasTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    longPressTimer.current = setTimeout(() => {
      if (touchStartPos.current) {
        setRadialPos({ x: touchStartPos.current.x, y: touchStartPos.current.y });
        touchStartPos.current = null;
      }
    }, 550);
  }, []);

  const onCanvasTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 12) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      touchStartPos.current = null;
    }
  }, []);

  const onCanvasTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  }, []);

  // --- Handle Connections ---
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = getNode(params.source);
      const targetNode = getNode(params.target);

      if (!sourceNode || !targetNode || params.source === params.target) return;

      if (sourceNode.type === 'ingredient' && targetNode.type === 'spec') {
        const existingConnection = edges.find(e => e.source === params.source && e.target === params.target);
        if (existingConnection) return;

        setAmountInput("1 oz");
        setModalConfig({ type: 'amount', params, sourceNode, targetNode });
      }
      else if (sourceNode.type === 'spec' && targetNode.type === 'spec') {
        setInheritedList([]);
        const parentIncomingEdges = edges.filter(e => e.target === sourceNode.id);
        const parentIngredients = parentIncomingEdges.map(e => {
          const n = nodes.find(node => node.id === e.source);
          if (n && n.type === 'ingredient') {
            return { node: n, amount: e.label as string };
          }
          return null;
        }).filter((item): item is { node: Node; amount: string } => item !== null);

        setInheritedList(parentIngredients);
        setTwistLabel("Twist on " + (sourceNode.data.label || "classic"));
        setNewIngName("");
        setNewIngAmount("");
        setModalConfig({ type: 'twist', params, sourceNode, targetNode });
      }
    },
    [getNode, edges, nodes]
  );

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    if (edge.label) {
      setAmountInput(edge.label as string);
    } else {
      setAmountInput("");
    }
    setModalConfig({ type: 'edit-edge', params: { id: edge.id }, edgeId: edge.id });
  }, []);

  const handleSaveConnection = () => {
    if (!modalConfig) return;

    if (modalConfig.type === 'amount') {
      const newEdge = { ...modalConfig.params, label: amountInput, animated: true, type: 'custom' };
      setEdges((eds) => addEdge(newEdge, eds));
    }
    else if (modalConfig.type === 'edit-edge') {
      setEdges((eds) => eds.map(e => e.id === modalConfig.edgeId ? { ...e, label: amountInput } : e));
    }
    else if (modalConfig.type === 'twist') {
      const newNodesToAdd: Node[] = [];
      const newEdgesToAdd: Edge[] = [];
      const targetNode = modalConfig.targetNode!;
      const targetAbs = HierarchyManager.getAbsolutePosition(targetNode, nodes);

      // 1. Lineage Edge (Dashed)
      const lineageEdge: Edge = {
        id: `lineage_${Date.now()}`,
        ...modalConfig.params,
        label: twistLabel,
        animated: true,
        style: { strokeDasharray: '5 5', strokeWidth: 2, stroke: '#94a3b8' }
      } as Edge;
      newEdgesToAdd.push(lineageEdge);

      // 2. Clone Inherited Ingredients
      const relPosX = -240;
      let relPosY = -(inheritedList.length * 40);

      inheritedList.forEach((item) => {
        const clonedId = getId();

        newNodesToAdd.push({
          id: clonedId,
          type: 'ingredient',
          position: (targetNode.data.isLocked ?? true) ? { x: relPosX, y: relPosY } : { x: targetAbs.x + relPosX, y: targetAbs.y + relPosY },
          parentId: (targetNode.data.isLocked ?? true) ? targetNode.id : undefined,
          extent: undefined,
          data: { ...item.node.data }
        });

        newEdgesToAdd.push({
          id: `edge_${clonedId}_${targetNode.id}`,
          source: clonedId,
          target: targetNode.id,
          label: item.amount,
          animated: true
        });

        relPosY += 80;
      });

      // 3. New Twist Ingredient
      if (newIngName.trim() !== "") {
        const brandNewId = getId();
        newNodesToAdd.push({
          id: brandNewId,
          type: 'ingredient',
          position: (targetNode.data.isLocked ?? true) ? { x: relPosX, y: relPosY } : { x: targetAbs.x + relPosX, y: targetAbs.y + relPosY },
          parentId: (targetNode.data.isLocked ?? true) ? targetNode.id : undefined,
          extent: undefined,
          data: { label: newIngName, type: 'modifier' }
        });

        newEdgesToAdd.push({
          id: `edge_${brandNewId}_${targetNode.id}`,
          source: brandNewId,
          target: targetNode.id,
          label: newIngAmount || "1 part",
          animated: true
        });
      }

      setNodes((nds) => [...nds, ...newNodesToAdd]);
      setEdges((eds) => [...eds, ...newEdgesToAdd]);
    }

    setModalConfig(null);
  };

  // --- Radial Wheel Node Creation ---
  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setRadialPos({ x: event.clientX, y: event.clientY });
  }, []);

  // Resolves whether a flow position falls inside a container and returns
  // the parentId + position relative to that container if so.
  const resolveContainer = useCallback(
    (flowPos: { x: number; y: number }, nds: Node[]) => {
      const container = HierarchyManager.pickContainingNode(
        nds.filter(n => n.type === 'container'),
        flowPos,
        nds,
        { width: 300, height: 300 }
      );
      if (!container) return { parentId: undefined, resolvedPos: flowPos };
      const parentAbs = HierarchyManager.getAbsolutePosition(container, nds);
      return {
        parentId: container.id,
        resolvedPos: { x: flowPos.x - parentAbs.x, y: flowPos.y - parentAbs.y },
      };
    },
    []
  );

  const handleCreateIngredient = useCallback((label: string, type: string) => {
    if (!radialPos) return;
    const flowPos = screenToFlowPosition(radialPos);
    setNodes((nds) => {
      const { parentId, resolvedPos } = resolveContainer(flowPos, nds);
      return [...nds, {
        id: getId(), type: 'ingredient',
        position: resolvedPos,
        parentId,
        extent: parentId ? 'parent' : undefined,
        data: { label, type },
      } as Node];
    });
  }, [radialPos, screenToFlowPosition, setNodes, resolveContainer]);

  const handleCreateSpec = useCallback(() => {
    if (!radialPos) return;
    const flowPos = screenToFlowPosition(radialPos);
    setNodes((nds) => {
      const { parentId, resolvedPos } = resolveContainer(flowPos, nds);
      return [...nds, {
        id: getId(), type: 'spec',
        position: resolvedPos,
        parentId,
        extent: parentId ? 'parent' : undefined,
        data: { label: 'Custom Recipe', method: 'Experimenting...', glassware: 'Unknown', isMatched: false, isCustomOverride: false, ingredientsList: [] },
      } as Node];
    });
  }, [radialPos, screenToFlowPosition, setNodes, resolveContainer]);

  const handleCreateContainer = useCallback(() => {
    if (!radialPos) return;
    const flowPos = screenToFlowPosition(radialPos);
    // Containers don't nest inside other containers.
    setNodes((nds) => [...nds, {
      id: getId(), type: 'container',
      position: flowPos,
      style: { width: 300, height: 300 },
      data: { label: 'New Group', type: 'container' },
    } as Node]);
  }, [radialPos, screenToFlowPosition, setNodes]);

  const handleExpandFormula = useCallback((label: string) => {
    if (!radialPos) return;
    const flowPos = screenToFlowPosition(radialPos);
    const config = FORMULA_STRUCTURES[label];
    if (!config) return;
    const specId = getId();
    setNodes((nds) => {
      const { parentId, resolvedPos } = resolveContainer(flowPos, nds);
      const clusterNodes: Node[] = [
        { id: specId, type: 'spec', position: resolvedPos, parentId, extent: parentId ? 'parent' : undefined,
          data: { label, method: 'Experimenting...', glassware: 'Unknown', isMatched: false, isCustomOverride: false, ingredientsList: [] } }
      ];
      config.ingredients.forEach((ing, idx) => {
        const ingId = getId();
        clusterNodes.push({
          id: ingId, type: 'ingredient',
          position: { x: -300, y: (idx * 100) - ((config.ingredients.length * 100) / 2) + 100 },
          parentId: specId,
          data: { label: ing.label, type: ing.type },
        });
      });
      setEdges((eds) => [
        ...eds,
        ...config.ingredients.map((ing, idx) => {
          const ingId = clusterNodes[idx + 1].id;
          return { id: `edge_${ingId}_${specId}`, source: ingId, target: specId, label: ing.amount, animated: true };
        }),
      ]);
      return [...nds, ...clusterNodes];
    });
  }, [radialPos, screenToFlowPosition, setNodes, setEdges, resolveContainer]);

  const handleExpandRecipe = useCallback((recipe: Cocktail) => {
    if (!radialPos) return;
    const flowPos = screenToFlowPosition(radialPos);
    const specId = getId();
    setNodes((nds) => {
      const { parentId, resolvedPos } = resolveContainer(flowPos, nds);
      const clusterNodes: Node[] = [
        { id: specId, type: 'spec', position: resolvedPos, parentId, extent: parentId ? 'parent' : undefined,
          data: { label: recipe.name, method: recipe.method, glassware: recipe.glass, isMatched: true, isCustomOverride: false, ingredientsList: [] } }
      ];
      const ings = recipe.standardIngredients ?? [];
      ings.forEach((ing, idx) => {
        const ingId = getId();
        clusterNodes.push({
          id: ingId, type: 'ingredient',
          position: { x: -300, y: (idx * 100) - ((ings.length * 100) / 2) + 100 },
          parentId: specId,
          data: { label: ing.label, type: ing.type },
        });
      });
      setEdges((eds) => [
        ...eds,
        ...ings.map((ing, idx) => {
          const ingId = clusterNodes[idx + 1].id;
          return { id: `edge_${ingId}_${specId}`, source: ingId, target: specId, label: ing.amount, animated: false };
        }),
      ]);
      return [...nds, ...clusterNodes];
    });
  }, [radialPos, screenToFlowPosition, setNodes, setEdges, resolveContainer]);

  const handleExportPdf = useCallback(async () => {
    const flowElement = reactFlowWrapper.current?.querySelector('.react-flow') as HTMLElement | null;
    if (!flowElement) {
      setExportMessage('Unable to locate canvas for export.');
      return;
    }

    setIsExporting(true);
    setExportMessage(null);
    setExportModalOpen(false);
    let viewportSnapshot: { x: number; y: number; zoom: number } | null = null;

    try {
      flowElement.classList.add('export-mode');
      if (exportMode === 'allNodes') {
        viewportSnapshot = getViewport();
        await fitView({ padding: 0.2, duration: 0, includeHiddenNodes: false });
      }

      await exportFlowToPdf({
        flowElement,
        mode: exportMode,
        paperSize: exportPaper,
        orientation: exportOrientation,
      });
      setExportMessage('PDF exported successfully.');
    } catch (error) {
      console.error(error);
      setExportMessage('Export failed. Try viewport mode or a smaller canvas.');
    } finally {
      if (viewportSnapshot) {
        await setViewport(viewportSnapshot, { duration: 0 });
      }
      flowElement.classList.remove('export-mode');
      setIsExporting(false);
    }
  }, [exportMode, exportOrientation, exportPaper, fitView, getViewport, setViewport]);

  return (
    <div
      className="canvas-container"
      ref={reactFlowWrapper}
      onTouchStart={onCanvasTouchStart}
      onTouchMove={onCanvasTouchMove}
      onTouchEnd={onCanvasTouchEnd}
    >
      <ReactFlow
        nodes={sortedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
        panOnScroll={false}
        zoomOnScroll={true}
        fitView
      >
        <Background color="#334155" gap={24} variant="dots" />
        {showMiniMap && <MiniMap zoomable pannable nodeColor={(n) => n.type === 'spec' ? '#1e293b' : '#e2e8f0'} />}
      </ReactFlow>

      {/* Floating Canvas Dock */}
      <div className="canvas-dock">
        <div className="dock-group">
          <button onClick={() => zoomOut()} className="dock-btn" title="Zoom Out"><ZoomOut size={16} /></button>
          <div className="dock-label">{zoomLevel}%</div>
          <button onClick={() => zoomIn()} className="dock-btn" title="Zoom In"><ZoomIn size={16} /></button>
        </div>

        <div className="dock-divider" />

        <button onClick={() => fitView({ padding: 0.2, duration: 800 })} className="dock-btn" title="Fit to View">
          <Maximize size={16} />
        </button>

        <div className="dock-divider" />

        <button
          onClick={() => setShowMiniMap(!showMiniMap)}
          className={`dock-btn ${showMiniMap ? 'active' : ''}`}
          title="Toggle Minimap"
        >
          <MapIcon size={16} />
        </button>
      </div>

      <div className="canvas-header">
        {/* Brand */}
        <div className="header-brand">
          <div className="header-logo">🍹</div>
          <span className="header-title desktop-only">Cocktail Playground</span>
          <span className="header-count">{nodes.length} nodes</span>
        </div>

        {/* Actions */}
        <div className="header-actions">
          {/* Desktop secondary buttons */}
          <div className="header-secondary">
            {!user ? (
              <>
                <button className="header-btn" onClick={onLoginClick}>
                  <User size={14} /> Sign In
                </button>
                <button className="header-btn" onClick={onDemoLogin} style={{ border: '1px dashed #10b981', color: '#10b981' }}>
                  🚀 Demo
                </button>
              </>
            ) : (
              <>
                <button className="header-btn" onClick={() => setGalleryOpen(true)}>
                  <FolderOpen size={14} /> Gallery
                </button>
                <button
                  className="header-btn"
                  onClick={() => {
                    const name = prompt('Enter canvas name:');
                    if (name) { setCanvasName(name); saveCanvas(); }
                  }}
                >
                  <Save size={14} /> Save
                </button>
                <button className="header-btn" onClick={onLogoutClick}>
                  <LogOut size={14} /> Sign Out
                </button>
              </>
            )}
          </div>

          {/* Mobile overflow ⋯ */}
          <div className="mobile-overflow-wrapper" ref={overflowRef}>
            <button
              className="header-btn mobile-overflow-btn"
              onClick={() => setShowOverflow(o => !o)}
              title="More options"
            >
              ⋯
            </button>
            {showOverflow && (
              <div className="overflow-menu">
                {!user ? (
                  <>
                    <button className="overflow-item" onClick={() => { onLoginClick(); setShowOverflow(false); }}>
                      👤 Sign In
                    </button>
                    <button className="overflow-item" onClick={() => { onDemoLogin(); setShowOverflow(false); }}>
                      🚀 Demo Mode
                    </button>
                  </>
                ) : (
                  <>
                    <button className="overflow-item" onClick={() => { setGalleryOpen(true); setShowOverflow(false); }}>
                      📁 Gallery
                    </button>
                    <button className="overflow-item" onClick={() => {
                      const name = prompt('Enter canvas name:');
                      if (name) { setCanvasName(name); saveCanvas(); }
                      setShowOverflow(false);
                    }}>
                      💾 Save
                    </button>
                    <button className="overflow-item" onClick={() => { onLogoutClick(); setShowOverflow(false); }}>
                      ↩ Sign Out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button className="header-btn primary" onClick={() => setExportModalOpen(true)} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export Spec'}
          </button>
        </div>
      </div>

      {/* Mobile FAB — opens radial wheel at screen centre */}
      <button
        className="mobile-fab no-export"
        onClick={() => setRadialPos({ x: window.innerWidth / 2, y: window.innerHeight - 160 })}
        title="Add node"
      >
        +
      </button>

      {exportMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: '92px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2200,
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid #334155',
            color: '#e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {exportMessage}
        </div>
      )}

      {exportModalOpen && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.7)', zIndex: 2100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            style={{
              background: '#1e293b', padding: '24px', borderRadius: '16px',
              width: '420px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              border: '1px solid #334155',
            }}
          >
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '10px', color: 'white' }}>
              Export Canvas to PDF
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '18px' }}>
              Choose your layout and whether to export the current viewport or fit all nodes.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                Size
                <select value={exportPaper} onChange={(e) => setExportPaper(e.target.value as PaperSize)} style={{ background: '#0f172a', color: 'white', border: '1px solid #334155', borderRadius: '8px', padding: '10px' }}>
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
                Orientation
                <select value={exportOrientation} onChange={(e) => setExportOrientation(e.target.value as Orientation)} style={{ background: '#0f172a', color: 'white', border: '1px solid #334155', borderRadius: '8px', padding: '10px' }}>
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#cbd5e1', marginBottom: '24px' }}>
              Content
              <select value={exportMode} onChange={(e) => setExportMode(e.target.value as ExportMode)} style={{ background: '#0f172a', color: 'white', border: '1px solid #334155', borderRadius: '8px', padding: '10px' }}>
                <option value="allNodes">All nodes (fit to canvas)</option>
                <option value="viewport">Current viewport</option>
              </select>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setExportModalOpen(false)}
                style={{ padding: '12px 20px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleExportPdf}
                style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#059669', color: 'white', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
              >
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {galleryOpen && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.8)', zIndex: 2200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div
            style={{
              background: '#1e293b', padding: '32px', borderRadius: '24px',
              width: '500px', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid #334155', color: 'white'
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '20px', fontWeight: 800 }}>
              Canvas Gallery
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {savedCanvases.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No saved canvases found.</p>
              ) : (
                savedCanvases.map(canvas => (
                  <div
                    key={canvas.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '16px', background: '#0f172a', borderRadius: '12px',
                      border: '1px solid #334155', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => loadCanvas(canvas)}
                  >
                    <span style={{ fontWeight: 600 }}>{canvas.name}</span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(canvas.created_at).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setGalleryOpen(false)}
              style={{
                marginTop: '24px', width: '100%', padding: '12px', borderRadius: '12px',
                border: '1px solid #334155', background: 'transparent', color: 'white',
                cursor: 'pointer', fontWeight: 600
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {modalConfig && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(2, 6, 23, 0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#1e293b', padding: '24px', borderRadius: '16px',
            width: '380px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            border: '1px solid #334155',
            animation: 'fadeIn 0.2s ease-out'
          }}>

            {(modalConfig.type === 'amount' || modalConfig.type === 'edit-edge') && (
              <>
                <h3 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '10px', color: 'white' }}>
                  {modalConfig.type === 'amount' ? 'Ingredient Amount' : 'Edit Amount'}
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                  {modalConfig.type === 'amount'
                    ? <span>Specify the volume for <b style={{ color: '#e2e8f0' }}>{modalConfig.sourceNode?.data.label}</b>.</span>
                    : "Update the measurement for this connection."
                  }
                </p>
                <input
                  autoFocus
                  type="text"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveConnection()}
                  placeholder="e.g. 2 oz, 3 dashes"
                  style={{ width: '94%', padding: '12px', marginBottom: '24px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '16px', outline: 'none' }}
                />
              </>
            )}

            {modalConfig.type === 'twist' && (
              <>
                <h3 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '10px', color: 'white' }}>Branch Cocktail</h3>

                <div style={{ marginBottom: '16px', background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🧬 Inheriting Formula:</span>
                  <ul style={{ margin: '12px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#cbd5e1' }}>
                    {inheritedList.length > 0
                      ? inheritedList.map((i, idx) => <li key={idx} style={{ marginBottom: '4px' }}><b style={{ color: '#10b981' }}>{i.amount}</b> {i.node.data.label}</li>)
                      : <li style={{ color: '#475569', fontStyle: 'italic' }}>No ingredients in parent spec.</li>
                    }
                  </ul>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Twist Logic (Edge Label):</label>
                  <input
                    autoFocus
                    type="text"
                    value={twistLabel}
                    placeholder="e.g. Fat-washed spirit, Subbed agave"
                    onChange={(e) => setTwistLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveConnection()}
                    style={{ width: '94%', padding: '12px', marginTop: '8px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Add Variation Ingredient:</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input
                      type="text"
                      value={newIngName}
                      placeholder="e.g. Chili Oil"
                      onChange={(e) => setNewIngName(e.target.value)}
                      style={{ flex: 2, padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }}
                    />
                    <input
                      type="text"
                      value={newIngAmount}
                      placeholder="Amt"
                      onChange={(e) => setNewIngAmount(e.target.value)}
                      style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', outline: 'none' }}
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setModalConfig(null)}
                style={{ padding: '12px 20px', borderRadius: '8px', border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConnection}
                style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#059669', color: 'white', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
              >
                {modalConfig.type === 'amount' ? 'Connect' : modalConfig.type === 'edit-edge' ? 'Update' : 'Branch Spec'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Radial Wheel */}
      {radialPos && (
        <RadialWheel
          x={radialPos.x}
          y={radialPos.y}
          onClose={() => setRadialPos(null)}
          onCreateIngredient={handleCreateIngredient}
          onCreateSpec={handleCreateSpec}
          onCreateContainer={handleCreateContainer}
          onExpandFormula={handleExpandFormula}
          onExpandRecipe={handleExpandRecipe}
          ibaCocktails={ibaCocktails}
        />
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleDemoLogin = () => {
    setUser({
      id: 'demo-user-123',
      email: 'demo@example.com',
      user_metadata: { full_name: 'Demo User' }
    });
    setIsLoginOpen(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="app-layout">
      <ReactFlowProvider>
        <>
          <CocktailCanvas
            user={user}
            onLoginClick={() => setIsLoginOpen(true)}
            onLogoutClick={handleSignOut}
            onDemoLogin={handleDemoLogin}
          />

          {isLoginOpen && (
            <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onAuthChange={(session) => setUser(session?.user ?? null)} />
          )}
        </>
      </ReactFlowProvider>
    </div>
  );
}
