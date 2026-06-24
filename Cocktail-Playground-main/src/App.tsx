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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import IngredientNode from './components/IngredientNode';
import SpecNode from './components/SpecNode';
import ContainerNode from './components/ContainerNode';
import CustomEdge from './components/CustomEdge';
import RadialWheel from './components/RadialWheel';
import LoginModal from './components/LoginModal';
import type { Cocktail } from './data/cocktailDB';
import { searchCocktails, matchCocktailByIngredients } from './services/cocktailSearch';
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

// Returns the ideal container size and spec position for a new spec-group.
// For a blank spec (0 ingredients) the container is small; for formula/recipe clusters
// it expands so ingredient nodes (at x = -300 relative to spec) fit inside.
function computeSpecGroupLayout(nIngredients: number) {
  if (nIngredients === 0) {
    // 380 × 420 — spec card with pricing/GP rows is ~270px tall; this gives
    // comfortable margins and room for a few extra ingredient rows before the
    // user needs to resize the container manually with NodeResizer.
    return { specX: 24, specY: 48, width: 380, height: 420 };
  }
  // Ingredients are positioned at y = (idx*100) - (n*100/2) + 100 relative to spec.
  const topIngY    = -(nIngredients * 100 / 2) + 100;
  const bottomIngY = (nIngredients - 1) * 100 - (nIngredients * 100 / 2) + 100;
  // Push spec down enough that the top ingredient stays inside the container (≥ 30px from top)
  const specX = 320;
  const specY = Math.max(80, 30 - topIngY);
  const height = Math.max(300, specY + bottomIngY + 100);
  return { specX, specY, width: 640, height };
}

function CocktailCanvas({ user, onLoginClick, onLogoutClick, onDemoLogin }: { user: any, onLoginClick: () => void, onLogoutClick: () => void, onDemoLogin: () => void }) {

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

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

  const saveCanvas = async (nameToSave: string) => {
    if (!user || !nameToSave.trim()) return;
    const name = nameToSave.trim();

    if (user.id === 'demo-user-123') {
      const local = localStorage.getItem('demo_canvases');
      const current = local ? JSON.parse(local) : [];
      const updated = [...current.filter((c: any) => c.name !== name), {
        id: Date.now().toString(),
        name,
        nodes,
        edges,
        user_id: user.id,
        created_at: new Date().toISOString(),
      }];
      localStorage.setItem('demo_canvases', JSON.stringify(updated));
      showToast('Canvas saved (Demo Mode)');
      setSaveModalOpen(false);
      setCanvasName('');
      fetchCanvases();
      return;
    }

    const { error } = await supabase.from('canvases').upsert({ name, nodes, edges, user_id: user.id });
    if (error) {
      showToast('Error saving: ' + error.message, 'error');
    } else {
      showToast('Canvas saved!');
      setSaveModalOpen(false);
      setCanvasName('');
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

  const mergeGroups = useCallback((idA: string, idB: string) => {
    setNodes(nds => {
      const a = nds.find(n => n.id === idA);
      const b = nds.find(n => n.id === idB);
      if (!a || !b) return nds;

      const aAbs = HierarchyManager.getAbsolutePosition(a, nds);
      const bAbs = HierarchyManager.getAbsolutePosition(b, nds);
      const aW = (a.style?.width as number) || 300;
      const aH = (a.style?.height as number) || 200;
      const bW = (b.style?.width as number) || 300;
      const bH = (b.style?.height as number) || 200;

      const minX = Math.min(aAbs.x, bAbs.x) - 24;
      const minY = Math.min(aAbs.y, bAbs.y) - 24;
      const maxX = Math.max(aAbs.x + aW, bAbs.x + bW) + 24;
      const maxY = Math.max(aAbs.y + aH, bAbs.y + bH) + 24;

      return nds
        .filter(n => n.id !== idB)
        .map(n => {
          if (n.id === idA) {
            return {
              ...n,
              position: { x: minX, y: minY },
              parentId: undefined,
              extent: undefined,
              style: { ...n.style, width: maxX - minX, height: maxY - minY },
              data: { ...n.data, isSpecGroup: false },
              selected: false,
            };
          }
          if (n.parentId === idA) {
            const childAbs = HierarchyManager.getAbsolutePosition(n, nds);
            return { ...n, position: { x: childAbs.x - minX, y: childAbs.y - minY }, selected: false };
          }
          if (n.parentId === idB) {
            const childAbs = HierarchyManager.getAbsolutePosition(n, nds);
            return { ...n, parentId: idA, position: { x: childAbs.x - minX, y: childAbs.y - minY }, selected: false };
          }
          return { ...n, selected: false };
        });
    });
  }, [setNodes]);

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

  // --- Ingredient List Sync ---
  // Keeps each spec's ingredientsList up to date as edges change.
  useEffect(() => {
    setNodes((currentNodes) => {
      let nodesChanged = false;

      const updatedNodes = currentNodes.map(node => {
        if (node.type !== 'spec') return node;

        const incomingEdges = edges.filter(e => e.target === node.id);

        const ingredientsList = incomingEdges.map(edge => {
          const sourceNode = currentNodes.find(n => n.id === edge.source);
          if (sourceNode && sourceNode.type === 'ingredient') {
            return { name: sourceNode.data.label as string, amount: edge.label as string };
          }
          return null;
        }).filter((i): i is { name: string; amount: string } => i !== null);

        const currentListStr = JSON.stringify(node.data.ingredientsList || []);
        const newListStr = JSON.stringify(ingredientsList);

        if (currentListStr !== newListStr) {
          nodesChanged = true;
          return { ...node, data: { ...node.data, ingredientsList } };
        }
        return node;
      });

      return nodesChanged ? updatedNodes : currentNodes;
    });
  }, [edges, setNodes]);

  // --- Cocktail Auto-Matcher ---
  // Watches edges (not nodes) to avoid an infinite loop.
  // Reads the latest nodes snapshot via a ref so we never need nodes in deps.
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const matcherTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (matcherTimerRef.current) clearTimeout(matcherTimerRef.current);
    matcherTimerRef.current = setTimeout(async () => {
      const snapNodes = nodesRef.current;
      for (const node of snapNodes) {
        if (node.type !== 'spec' || node.data.isCustomOverride) continue;
        const ingredientsList = (node.data.ingredientsList ?? []) as { name: string }[];
        if (ingredientsList.length < 2) {
          if (node.data.isMatched) {
            setNodes(nds => nds.map(n => n.id === node.id
              ? { ...n, data: { ...n.data, label: 'Custom Recipe', method: 'Experimenting...', glassware: 'Unknown', isMatched: false } }
              : n
            ));
          }
          continue;
        }
        const names = ingredientsList.map(i => i.name);
        const match = await matchCocktailByIngredients(names);
        setNodes(nds => nds.map(n => {
          if (n.id !== node.id) return n;
          if (match) {
            return { ...n, data: { ...n.data, label: match.name, method: match.method, glassware: match.glass, isMatched: true } };
          }
          if (n.data.isMatched) {
            return { ...n, data: { ...n.data, label: 'Custom Recipe', method: 'Experimenting...', glassware: 'Unknown', isMatched: false } };
          }
          return n;
        }));
      }
    }, 800);
    return () => { if (matcherTimerRef.current) clearTimeout(matcherTimerRef.current); };
  }, [edges, setNodes]);

  const onNodeDragStop = useCallback((_: any, draggedNode: Node) => {
    // Containers: check if the dragged container's center is inside another container → merge
    if (draggedNode.type === 'container') {
      const nds = nodesRef.current;
      const draggedAbs = HierarchyManager.getAbsolutePosition(draggedNode, nds);
      const dW = (draggedNode.style?.width as number) || 300;
      const dH = (draggedNode.style?.height as number) || 200;
      const centerX = draggedAbs.x + dW / 2;
      const centerY = draggedAbs.y + dH / 2;

      const target = nds.find(n => {
        if (n.type !== 'container' || n.id === draggedNode.id) return false;
        const tAbs = HierarchyManager.getAbsolutePosition(n, nds);
        const tW = (n.style?.width as number) || 300;
        const tH = (n.style?.height as number) || 200;
        return centerX >= tAbs.x && centerX <= tAbs.x + tW &&
               centerY >= tAbs.y && centerY <= tAbs.y + tH;
      });

      if (target) {
        mergeGroups(draggedNode.id, target.id);
        showToast('Groups merged — click ⚡ on the container to split');
      }
      return;
    }

    // Ingredients / specs: parenting logic
    setNodes((nds) => {
      const abs = HierarchyManager.getAbsolutePosition(draggedNode, nds);

      // Find the best containing node (Container or Spec)
      const parentContainer = HierarchyManager.pickContainingNode(
        nds.filter(n => n.type === 'container' && n.id !== draggedNode.id),
        abs,
        nds,
        { width: 300, height: 300 }
      );

      // Only ingredients can be pulled into a spec via drag
      const parentSpecCandidate = draggedNode.type === 'ingredient'
        ? HierarchyManager.pickContainingNode(
            nds.filter(n => n.type === 'spec' && n.id !== draggedNode.id),
            abs,
            nds,
            { width: 240, height: 160 }
          )
        : null;

      const parentSpec = (parentSpecCandidate?.data?.isLocked !== false) ? parentSpecCandidate : null;
      const finalParent = parentContainer || parentSpec;

      if (finalParent) {
        if (draggedNode.parentId === finalParent.id) return nds;
        const parentAbs = HierarchyManager.getAbsolutePosition(finalParent, nds);
        return nds.map(node => {
          if (node.id === draggedNode.id) {
            return {
              ...node,
              parentId: finalParent.id,
              position: { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y },
              extent: undefined,
            } as Node;
          }
          return node;
        });
      }

      // Dropped outside all containers/specs — handle unparenting
      if (draggedNode.parentId) {
        const currentParent = nds.find(n => n.id === draggedNode.parentId);

        // Never unparent a node from a container via drag alone.
        // Containers use explicit delete / unmerge / NodeResizer to manage children.
        // Without this guard, dragging a spec even slightly outside the container
        // frame would sever the parent-child link and break "move together" behaviour.
        if (currentParent?.type === 'container') return nds;

        const isLockedSpec = currentParent?.type === 'spec' && (currentParent.data?.isLocked !== false);
        if (isLockedSpec) {
          const isConnected = edges.some(e => e.source === draggedNode.id && e.target === currentParent?.id);
          if (isConnected) return nds;
        }
        return nds.map(node => {
          if (node.id === draggedNode.id) {
            return { ...node, parentId: undefined, position: { x: abs.x, y: abs.y }, extent: undefined } as Node;
          }
          return node;
        });
      }

      return nds;
    });
  }, [setNodes, edges, mergeGroups, showToast]);

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
      const newEdge = { ...modalConfig.params, id: `edge_${Date.now()}`, label: amountInput, animated: true, type: 'custom' };
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
    (flowPos: { x: number; y: number }, nds: Node[], excludeSpecGroups = false) => {
      const candidates = nds.filter(n =>
        n.type === 'container' && (!excludeSpecGroups || !n.data?.isSpecGroup)
      );
      const container = HierarchyManager.pickContainingNode(
        candidates,
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
    const specId = getId();
    const groupId = getId();
    const { specX, specY, width, height } = computeSpecGroupLayout(0);
    setNodes((nds) => {
      const { parentId: outerParentId, resolvedPos } = resolveContainer(flowPos, nds, true);
      const groupNode: Node = {
        id: groupId,
        type: 'container',
        position: { x: resolvedPos.x - specX, y: resolvedPos.y - specY },
        parentId: outerParentId,
        extent: outerParentId ? 'parent' : undefined,
        style: { width, height },
        data: { label: 'Spec Group', isSpecGroup: true },
      };
      const specNode: Node = {
        id: specId,
        type: 'spec',
        position: { x: specX, y: specY },
        parentId: groupId,
        data: { label: 'Custom Recipe', method: 'Experimenting...', glassware: 'Unknown', isMatched: false, isCustomOverride: false, ingredientsList: [] },
      };
      return [...nds, groupNode, specNode];
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
    const groupId = getId();
    const { specX, specY, width, height } = computeSpecGroupLayout(config.ingredients.length);
    setNodes((nds) => {
      const { parentId: outerParentId, resolvedPos } = resolveContainer(flowPos, nds, true);
      const clusterNodes: Node[] = [
        {
          id: groupId, type: 'container',
          position: { x: resolvedPos.x - specX, y: resolvedPos.y - specY },
          parentId: outerParentId,
          extent: outerParentId ? 'parent' : undefined,
          style: { width, height },
          data: { label, isSpecGroup: true },
        },
        {
          id: specId, type: 'spec',
          position: { x: specX, y: specY },
          parentId: groupId,
          data: { label, method: 'Experimenting...', glassware: 'Unknown', isMatched: false, isCustomOverride: false, ingredientsList: [] },
        },
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
          const ingId = clusterNodes[idx + 2].id;
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
    const groupId = getId();
    const ings = recipe.standardIngredients ?? [];
    const { specX, specY, width, height } = computeSpecGroupLayout(ings.length);
    setNodes((nds) => {
      const { parentId: outerParentId, resolvedPos } = resolveContainer(flowPos, nds, true);
      const clusterNodes: Node[] = [
        {
          id: groupId, type: 'container',
          position: { x: resolvedPos.x - specX, y: resolvedPos.y - specY },
          parentId: outerParentId,
          extent: outerParentId ? 'parent' : undefined,
          style: { width, height },
          data: { label: recipe.name, isSpecGroup: true },
        },
        {
          id: specId, type: 'spec',
          position: { x: specX, y: specY },
          parentId: groupId,
          data: { label: recipe.name, method: recipe.method, glassware: recipe.glass, isMatched: true, isCustomOverride: false, ingredientsList: [] },
        },
      ];
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
          const ingId = clusterNodes[idx + 2].id;
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
        <Background color="rgba(139,92,246,0.25)" gap={32} size={1.4} variant="cross" />
        {showMiniMap && <MiniMap zoomable pannable nodeColor={(n) => n.type === 'spec' ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.15)'} />}
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="canvas-empty-hint">
          <div className="hint-icon">🍹</div>
          <div className="hint-title">Build Your First Spec</div>
          <div className="hint-sub">Right-click canvas · long-press on mobile · or tap +</div>
        </div>
      )}

      {/* Floating Canvas Dock */}
      <div className="canvas-dock">
        <div className="dock-group">
          <Button variant="ghost" size="icon-sm" onClick={() => zoomOut()} title="Zoom Out"><ZoomOut size={15} /></Button>
          <div className="dock-label">{zoomLevel}%</div>
          <Button variant="ghost" size="icon-sm" onClick={() => zoomIn()} title="Zoom In"><ZoomIn size={15} /></Button>
        </div>

        <Separator orientation="vertical" className="h-5 mx-1 bg-border/40" />

        <Button variant="ghost" size="icon-sm" onClick={() => fitView({ padding: 0.2, duration: 800 })} title="Fit to View">
          <Maximize size={15} />
        </Button>

        <Separator orientation="vertical" className="h-5 mx-1 bg-border/40" />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowMiniMap(!showMiniMap)}
          title="Toggle Minimap"
          className={showMiniMap ? 'text-primary' : ''}
        >
          <MapIcon size={15} />
        </Button>
      </div>

      <div className="canvas-header">
        {/* Brand */}
        <div className="header-brand">
          <div className="header-logo">🍹</div>
          <span className="header-title desktop-only">Cocktail Playground</span>
          <Badge variant="secondary" className="text-xs font-semibold tabular-nums">{nodes.length} nodes</Badge>
        </div>

        {/* Actions */}
        <div className="header-actions">
          {/* Desktop secondary buttons */}
          <div className="header-secondary">
            {!user ? (
              <>
                <Button variant="outline" size="sm" onClick={onLoginClick}>
                  <User size={14} /> Sign In
                </Button>
                <Button variant="outline" size="sm" onClick={onDemoLogin} className="border-dashed border-emerald-500 text-emerald-400 hover:bg-emerald-950 hover:text-emerald-300">
                  🚀 Demo
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setGalleryOpen(true)}>
                  <FolderOpen size={14} /> Gallery
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSaveModalOpen(true)}>
                  <Save size={14} /> Save
                </Button>
                <Button variant="outline" size="sm" onClick={onLogoutClick}>
                  <LogOut size={14} /> Sign Out
                </Button>
              </>
            )}
          </div>

          {/* Mobile overflow — shadcn DropdownMenu handles open/close state */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="mobile-overflow-btn">⋯</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {!user ? (
                <>
                  <DropdownMenuItem onClick={onLoginClick}><User size={14} /> Sign In</DropdownMenuItem>
                  <DropdownMenuItem onClick={onDemoLogin}>🚀 Demo Mode</DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => setGalleryOpen(true)}><FolderOpen size={14} /> Gallery</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSaveModalOpen(true)}><Save size={14} /> Save</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogoutClick}><LogOut size={14} /> Sign Out</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" onClick={() => setExportModalOpen(true)} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export Spec'}
          </Button>
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

      {toast && (
        <div
          style={{
            position: 'absolute',
            bottom: '92px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2200,
            background: toast.type === 'error' ? 'rgba(127,29,29,0.95)' : 'rgba(6,78,59,0.95)',
            border: `1px solid ${toast.type === 'error' ? '#dc2626' : '#059669'}`,
            color: '#f8fafc',
            borderRadius: '10px',
            padding: '10px 18px',
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {toast.type === 'error' ? '✗ ' : '✓ '}{toast.message}
        </div>
      )}

      <Dialog open={saveModalOpen} onOpenChange={(open) => { setSaveModalOpen(open); if (!open) setCanvasName(''); }}>
        <DialogContent className="sm:max-w-sm bg-transparent border-0 shadow-none">
          <DialogHeader>
            <DialogTitle>Save Canvas</DialogTitle>
            <DialogDescription>Give this canvas a name to save it to your gallery.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="e.g. Saturday Night Menu"
            value={canvasName}
            onChange={(e) => setCanvasName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canvasName.trim() && saveCanvas(canvasName)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSaveModalOpen(false); setCanvasName(''); }}>Cancel</Button>
            <Button onClick={() => saveCanvas(canvasName)} disabled={!canvasName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-md bg-transparent border-0 shadow-none">
          <DialogHeader>
            <DialogTitle>Export Canvas to PDF</DialogTitle>
            <DialogDescription>Choose layout and whether to export the current viewport or fit all nodes.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              Size
              <select value={exportPaper} onChange={(e) => setExportPaper(e.target.value as PaperSize)}
                className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground">
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              Orientation
              <select value={exportOrientation} onChange={(e) => setExportOrientation(e.target.value as Orientation)}
                className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground">
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Content
            <select value={exportMode} onChange={(e) => setExportMode(e.target.value as ExportMode)}
              className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground">
              <option value="allNodes">All nodes (fit to canvas)</option>
              <option value="viewport">Current viewport</option>
            </select>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancel</Button>
            <Button onClick={handleExportPdf}>Export PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="sm:max-w-lg bg-transparent border-0 shadow-none">
          <DialogHeader>
            <DialogTitle>Canvas Gallery</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            {savedCanvases.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No saved canvases found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {savedCanvases.map(canvas => (
                  <button
                    key={canvas.id}
                    onClick={() => loadCanvas(canvas)}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="font-semibold text-sm">{canvas.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(canvas.created_at).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGalleryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalConfig !== null} onOpenChange={(open) => { if (!open) setModalConfig(null); }}>
        <DialogContent className="sm:max-w-sm bg-transparent border-0 shadow-none">
          {modalConfig && (modalConfig.type === 'amount' || modalConfig.type === 'edit-edge') && (
            <>
              <DialogHeader>
                <DialogTitle>{modalConfig.type === 'amount' ? 'Ingredient Amount' : 'Edit Amount'}</DialogTitle>
                <DialogDescription>
                  {modalConfig.type === 'amount'
                    ? <>Specify the volume for <strong className="text-foreground">{modalConfig.sourceNode?.data.label as string}</strong>.</>
                    : 'Update the measurement for this connection.'}
                </DialogDescription>
              </DialogHeader>
              <Input
                autoFocus
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveConnection()}
                placeholder="e.g. 2 oz, 3 dashes"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalConfig(null)}>Cancel</Button>
                <Button onClick={handleSaveConnection}>{modalConfig.type === 'amount' ? 'Connect' : 'Update'}</Button>
              </DialogFooter>
            </>
          )}

          {modalConfig?.type === 'twist' && (
            <>
              <DialogHeader>
                <DialogTitle>Branch Cocktail</DialogTitle>
              </DialogHeader>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">🧬 Inheriting Formula</p>
                <ul className="space-y-1 text-sm text-foreground/80 list-disc list-inside">
                  {inheritedList.length > 0
                    ? inheritedList.map((i, idx) => (
                        <li key={idx}><span className="font-bold text-primary">{i.amount}</span> {i.node.data.label as string}</li>
                      ))
                    : <li className="italic text-muted-foreground">No ingredients in parent spec.</li>}
                </ul>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Twist Logic</label>
                <Input
                  autoFocus
                  value={twistLabel}
                  placeholder="e.g. Fat-washed spirit, Subbed agave"
                  onChange={(e) => setTwistLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveConnection()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add Variation Ingredient</label>
                <div className="flex gap-2">
                  <Input className="flex-[2]" value={newIngName} placeholder="e.g. Chili Oil" onChange={(e) => setNewIngName(e.target.value)} />
                  <Input className="flex-1" value={newIngAmount} placeholder="Amt" onChange={(e) => setNewIngAmount(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalConfig(null)}>Cancel</Button>
                <Button onClick={handleSaveConnection}>Branch Spec</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
          onSearchCocktails={searchCocktails}
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
