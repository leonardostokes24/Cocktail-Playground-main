import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Menu, BookOpen, ChevronLeft, ChevronRight, Share2, Download, PanelsTopLeft, Library as LibraryIcon, ZoomIn, ZoomOut, Maximize, Map as MapIcon, LogOut, User, Save, FolderOpen } from 'lucide-react';
import IngredientNode from './components/IngredientNode';
import SpecNode from './components/SpecNode';
import ContainerNode from './components/ContainerNode';
import CustomEdge from './components/CustomEdge';
import Sidebar from './components/Sidebar';
import LoginModal from './components/LoginModal';
import { findCocktailMatch } from './data/cocktailDB';
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

let idCounter = 0;
const getId = () => `node_${idCounter++}_${Date.now()}`;

function CocktailCanvas({ user, onLoginClick, onLogoutClick, onDemoLogin }: { user: any, onLoginClick: () => void, onLogoutClick: () => void, onDemoLogin: () => void }) {

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const { screenToFlowPosition, getNode, zoomIn, zoomOut, fitView, getViewport, setViewport } = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(100);
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

  // Sync zoom level for display
  useEffect(() => {
    const interval = setInterval(() => {
      // Small delay loop to keep UI sync without complex store listening
      const canvasEl = document.querySelector('.react-flow__viewport');
      if (canvasEl) {
        const style = window.getComputedStyle(canvasEl);
        const matrix = new DOMMatrixReadOnly(style.transform);
        setZoomLevel(Math.round(matrix.a * 100));
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // #region agent log
  }, []);
  
  // Track lock states to trigger structural re-sync
  const lockStatesHash = nodes
    .filter(n => n.type === 'spec')
    .map(n => `${n.id}:${n.data?.isLocked ?? true}`)
    .join('|');

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
  
  // --- Quick Action Wheel ---
  const [wheelConfig, setWheelConfig] = useState<{ 
    x: number; 
    y: number; 
    sourceId?: string; 
    handleType?: string;
    dropData?: any;
  } | null>(null);
  const connectionSource = useRef<{ nodeId: string; handleType: string } | null>(null);

  const onConnectStart = useCallback((_: any, { nodeId, handleType }: any) => {
    connectionSource.current = { nodeId, handleType: handleType || 'source' };
  }, []);

  const onConnectEnd = useCallback((event: any) => {
    if (!connectionSource.current) return;

    // Check if the drop was on a node (target)
    const targetIsPane = (event.target as Element).classList.contains('react-flow__pane');
    
    if (targetIsPane) {
      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
      setWheelConfig({ 
        x: clientX, 
        y: clientY, 
        sourceId: connectionSource.current.nodeId, 
        handleType: connectionSource.current.handleType 
      });
    }
  }, []);

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
  }, [edges, nodes, setNodes]);

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
        
        // Determine if the node should be restricted to the parent's bounds
        const isContainer = finalParent.type === 'container';
        const isLockedConnectedSpec = finalParent.type === 'spec' && 
                                    (finalParent.data?.isLocked !== false) && 
                                    edges.some(e => e.source === draggedNode.id && e.target === finalParent.id);
        
        const shouldRestrict = isContainer || isLockedConnectedSpec;

        return nds.map(node => {
          if (node.id === draggedNode.id) {
            return {
              ...node,
              parentId: finalParent.id,
              position: { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y },
              extent: shouldRestrict ? 'parent' : undefined
            } as Node;
          }
          return node;
        });
      }
 
       // 2. If dropped outside, handle unparenting
       if (draggedNode.parentId) {
           const currentParent = nds.find(n => n.id === draggedNode.parentId);
           const isLockedSpec = currentParent?.type === 'spec' && (currentParent.data?.isLocked !== false);
           
           // Only refuse to unparent if the spec is locked AND the ingredient is connected to it
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
  }, [setNodes]);




  // Sync parenting with edges
  useEffect(() => {
    setNodes((nds) => {
      let changed = false;
      const nextNodes = nds.map(node => {
        if (node.type !== 'ingredient') return node;

        const currentEdges = edges.filter(e => e.source === node.id);
        const specEdge = currentEdges.find(e => {
          const target = nds.find(n => n.id === e.target);
          return target?.type === 'spec';
        });

        // Resolve effective lock state: check per-node override, default to true
        const targetNodeId = specEdge?.target || node.parentId;
        const targetNodeCandidate = nds.find(n => n.id === targetNodeId);
        const nodeEffectiveLock = targetNodeCandidate?.data?.isLocked ?? true;

        // LOCK MODE: Ensure parented if connected
        if (nodeEffectiveLock) {
          if (specEdge && node.parentId !== specEdge.target) {
            const targetNode = nds.find(n => n.id === specEdge.target);
            if (!targetNode) return node;

            changed = true;
            const nodeAbs = HierarchyManager.getAbsolutePosition(node, nds);
            const parentAbs = HierarchyManager.getAbsolutePosition(targetNode, nds);
  
            return {
              ...node,
              parentId: specEdge.target,
              extent: (targetNodeCandidate?.data?.isLocked !== false) ? 'parent' : undefined,
              position: { x: nodeAbs.x - parentAbs.x, y: nodeAbs.y - parentAbs.y }
            };
          }

          if (!specEdge && node.parentId && nds.find(n => n.id === node.parentId)?.type === 'spec') {
            const parentNode = nds.find(n => n.id === node.parentId);
            if (!parentNode) return node;
            
            changed = true;
            const nodeAbs = HierarchyManager.getAbsolutePosition(node, nds);
            return {
              ...node,
              parentId: undefined,
              extent: undefined,
              position: { x: nodeAbs.x, y: nodeAbs.y }
            };
          }
        } 
        // LOOSE MODE: Ensure no parent if it was a spec parent
        else {
          if (node.parentId && nds.find(n => n.id === node.parentId)?.type === 'spec') {
            const parentNode = nds.find(n => n.id === node.parentId);
            if (!parentNode) return node;
            
            changed = true;
            const nodeAbs = HierarchyManager.getAbsolutePosition(node, nds);
            return {
              ...node,
              parentId: undefined,
              extent: undefined,
              position: { x: nodeAbs.x, y: nodeAbs.y }
            };
          }
        }

        return node;
      });

      return changed ? nextNodes : nds;
    });
  }, [edges, setNodes, lockStatesHash]);


  // --- Handle Connections ---
  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = getNode(params.source);
      const targetNode = getNode(params.target);

      if (!sourceNode || !targetNode || params.source === params.target) return;

      if (sourceNode.type === 'ingredient' && targetNode.type === 'spec') {
        const existingConnection = edges.find(e => e.source === params.source && e.target === params.target);
        if (existingConnection) return;

        // If locked, the useEffect will handle parenting correctly.
        // We just need to trigger the edge creation.
        
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

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleWheelAction = (action: 'branch' | 'blank' | 'expand' | 'single' | 'node') => {
    if (!wheelConfig) return;
    const { sourceId, x, y, dropData } = wheelConfig;
    const flowPos = screenToFlowPosition({ x, y });
    const newSpecId = getId();

    if (action === 'blank' || (action === 'single' && dropData?.nodeType === 'spec')) {
      const label = dropData?.label || 'Custom Recipe';
      const newSpecNode: Node = {
        id: newSpecId,
        type: 'spec',
        position: flowPos,
        data: { label, method: 'Experimenting...', glassware: 'Unknown', isMatched: false, isCustomOverride: false, ingredientsList: [] }
      };
      
      if (sourceId) {
        const sourceNode = getNode(sourceId);
        const newEdge: Edge = {
          id: `edge_${sourceId}_${newSpecId}`,
          source: sourceId,
          target: newSpecId,
          label: sourceNode?.type === 'ingredient' ? '1 oz' : 'Twist',
          animated: true,
          type: 'custom'
        };
        setEdges((eds) => [...eds, newEdge]);
      }

      setNodes((nds) => [...nds, newSpecNode]);
    } 
    else if (action === 'branch' && sourceId) {
      const sourceNode = getNode(sourceId);
      if (!sourceNode || sourceNode.type !== 'spec') return;
      
      const parentIncomingEdges = edges.filter(e => e.target === sourceId);
      const parentIngredients = parentIncomingEdges.map(e => {
        const n = nodes.find(node => node.id === e.source);
        if (n && n.type === 'ingredient') {
          return { node: n, amount: e.label as string };
        }
        return null;
      }).filter((item): item is { node: Node; amount: string } => item !== null);

      const targetSpecNode: Node = {
        id: newSpecId,
        type: 'spec',
        position: flowPos,
        data: { ...sourceNode.data, label: `Twist on ${sourceNode.data.label}`, isCustomOverride: true, ingredientsList: [] }
      };

      const newEdges: Edge[] = [
        {
          id: `lineage_${Date.now()}`,
          source: sourceId,
          target: newSpecId,
          label: 'Branch',
          animated: true,
          type: 'custom',
          style: { strokeDasharray: '5 5', strokeWidth: 2, stroke: '#94a3b8' }
        }
      ];

      const relPosX = -240;
      let relPosY = -(parentIngredients.length * 40);
      const newIngredients: Node[] = [];
      
      parentIngredients.forEach((item) => {
        const clonedId = getId();
        newIngredients.push({
          id: clonedId,
          type: 'ingredient',
          position: { x: relPosX, y: relPosY },
          parentId: newSpecId,
          extent: undefined,
          data: { ...item.node.data }
        });
        newEdges.push({
          id: `edge_${clonedId}_${newSpecId}`,
          source: clonedId,
          target: newSpecId,
          label: item.amount,
          animated: true,
          type: 'custom'
        });
        relPosY += 80;
      });

      setNodes((nds) => [...nds, targetSpecNode, ...newIngredients]);
      setEdges((eds) => [...eds, ...newEdges]);
    } 
    else if (action === 'expand' && dropData) {
      // Reuse the expansion logic from onDrop
      if (dropData.nodeType === 'spec' && dropData.label !== 'Custom Recipe') {
        const clusterNodes: Node[] = [];
        const clusterEdges: Edge[] = [];
        const specId = getId();
        
        const structures: Record<string, { ingredients: { label: string; type: string; amount: string }[] }> = {
          'The Sour': { ingredients: [{ label: 'Base Spirit', type: 'spirit', amount: '2 oz' }, { label: 'Citrus', type: 'citrus', amount: '0.75 oz' }, { label: 'Sweetener', type: 'sweetener', amount: '0.75 oz' }] },
          'Spirit-Forward': { ingredients: [{ label: 'Base Spirit', type: 'spirit', amount: '2 oz' }, { label: 'Fortified Wine', type: 'modifier', amount: '1 oz' }, { label: 'Aromatic Bitters', type: 'bitters', amount: '2 dashes' }] },
          'Highball': { ingredients: [{ label: 'Base Spirit', type: 'spirit', amount: '2 oz' }, { label: 'Modifier / Citrus', type: 'citrus', amount: '0.5 oz' }, { label: 'Sparkling Filler', type: 'sweetener', amount: '4 oz' }] },
          'Negroni Style': { ingredients: [{ label: 'Base Spirit', type: 'spirit', amount: '1 oz' }, { label: 'Bitters / Aperitif', type: 'modifier', amount: '1 oz' }, { label: 'Sweet Vermouth', type: 'modifier', amount: '1 oz' }] },
        };

        const config = structures[dropData.label];
        if (config) {
          clusterNodes.push({ id: specId, type: 'spec', position: flowPos, data: { label: dropData.label, method: 'Experimenting...', glassware: 'Unknown', isMatched: false, isCustomOverride: false, ingredientsList: [] } });
          config.ingredients.forEach((ing, idx) => {
            const ingId = getId();
            clusterNodes.push({ id: ingId, type: 'ingredient', position: { x: -300, y: (idx * 100) - ((config.ingredients.length * 100) / 2) + 100 }, parentId: specId, extent: undefined, data: { label: ing.label, type: ing.type } });
            clusterEdges.push({ id: `edge_${ingId}_${specId}`, source: ingId, target: specId, label: ing.amount, animated: true });
          });
          setNodes((nds) => [...nds, ...clusterNodes]);
          setEdges((eds) => [...eds, ...clusterEdges]);
        }
      } else if (dropData.nodeType === 'recipe') {
        const clusterNodes: Node[] = [];
        const clusterEdges: Edge[] = [];
        const specId = getId();
        const recipe = dropData.recipe;
        clusterNodes.push({ id: specId, type: 'spec', position: flowPos, data: { label: recipe.name, method: recipe.method, glassware: recipe.glass, isMatched: true, isCustomOverride: false, ingredientsList: [] } });
        if (recipe.standardIngredients) {
          recipe.standardIngredients.forEach((ing: any, idx: number) => {
            const ingId = getId();
            clusterNodes.push({ id: ingId, type: 'ingredient', position: { x: -300, y: (idx * 100) - ((recipe.standardIngredients.length * 100) / 2) + 100 }, parentId: specId, extent: undefined, data: { label: ing.label, type: ing.type } });
            clusterEdges.push({ id: `edge_${ingId}_${specId}`, source: ingId, target: specId, label: ing.amount, animated: false });
          });
        }
        setNodes((nds) => [...nds, ...clusterNodes]);
        setEdges((eds) => [...eds, ...clusterEdges]);
      }
    }
    else if (action === 'node' && dropData) {
      const intersectContainer = HierarchyManager.pickContainingNode(nodes.filter(n => n.type === 'container'), flowPos, nodes, { width: 300, height: 300 });
      const newNode: Node = {
        id: getId(),
        type: dropData.nodeType,
        position: intersectContainer ? { x: flowPos.x - intersectContainer.position.x, y: flowPos.y - intersectContainer.position.y } : flowPos,
        parentId: intersectContainer?.id,
        extent: intersectContainer ? 'parent' : undefined,
        data: { label: dropData.label, type: dropData.categoryType, method: dropData.nodeType === 'spec' ? 'Experimenting...' : null, glassware: dropData.nodeType === 'spec' ? 'Unknown' : null, isMatched: false, isCustomOverride: false, ingredientsList: [] },
      };
      if (dropData.nodeType === 'container') newNode.style = { width: 300, height: 300 };
      setNodes((nds) => nds.concat(newNode));
    }
    
    setWheelConfig(null);
  };


  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const reactFlowData = event.dataTransfer.getData('application/reactflow');
      if (!reactFlowData) return;
      
      const parsedData = JSON.parse(reactFlowData);
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      
      // --- FEATURE: HOT SWAPPING ---
      const intersectedNode = nodes.find(n => (
        n.type === 'ingredient' && 
        Math.abs(n.position.x - position.x) < 80 && 
        Math.abs(n.position.y - position.y) < 40
      ));
      
      if (intersectedNode && parsedData.nodeType === 'ingredient') {
        setNodes((nds) => nds.map(node => {
          if (node.id === intersectedNode.id) {
            return { ...node, data: { ...node.data, label: parsedData.label, type: parsedData.categoryType } };
          }
          return node;
        }));
        return;
      }

      // Instead of immediate creation, open the action wheel
      setWheelConfig({
        x: event.clientX,
        y: event.clientY,
        dropData: parsedData
      });
    },
    [screenToFlowPosition, setNodes, nodes]
  );


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
    <div className="canvas-container" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={sortNodesByHierarchy(nodes)}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onEdgeClick={onEdgeClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={(event) => {
          // Only open wheel if clicking the pane (not a node or control)
          if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('react-flow__pane')) {
            setWheelConfig({
              x: event.clientX,
              y: event.clientY,
            });
          }
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
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
        <div className="header-badge">
          <span className="badge-text">Canvas: <span className="badge-accent">Menu R&D Spring 24</span></span>
          <span className="badge-divider">|</span>
          <span className="badge-text">Nodes: {nodes.length}</span>
        </div>
       <div className="header-actions">
            <button className="header-btn desktop-only">Presentation Mode</button>
            {!user ? (
              <>
                <button className="header-btn" onClick={onLoginClick}>
                  <User size={16} /> Sign In
                </button>
                <button className="header-btn" onClick={onDemoLogin} style={{ border: '1px dashed #10b981', color: '#10b981' }}>
                  🚀 Demo Mode
                </button>
              </>
            ) : (
              <>
                <button 
                  className="header-btn" 
                  onClick={onLogoutClick}
                  title="Sign Out"
                >
                  <LogOut size={16} /> Sign Out
                </button>
                <button 
                  className="header-btn" 
                  onClick={() => setGalleryOpen(true)} 
                  title="Load Saved Canvas"
                >
                  <FolderOpen size={16} /> Gallery
                </button>
                <button 
                  className="header-btn" 
                  onClick={() => {
                    const name = prompt('Enter canvas name:');
                    if (name) {
                      setCanvasName(name);
                      saveCanvas();
                    }
                  }} 
                  title="Save Current Canvas"
                >
                  <Save size={16} /> Save
                </button>
              </>
            )}
            <button className="header-btn primary" onClick={() => setExportModalOpen(true)} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export Spec'}
            </button>
          </div>

      </div>

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

      {wheelConfig && (
        <div 
          onClick={() => setWheelConfig(null)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 2000, cursor: 'default'
          }}
        >
          <div 
            style={{
              position: 'absolute',
              left: wheelConfig.x,
              top: wheelConfig.y,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: '#1e293b',
              padding: '12px',
              borderRadius: '16px',
              border: '1px solid #334155',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              minWidth: '200px',
              animation: 'scaleIn 0.15s ease-out'
            }}
          >
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', textAlign: 'center' }}>
              Drop Action
            </div>
            {getNode(wheelConfig.sourceId)?.type === 'spec' && (
              <button 
                onClick={(e) => { e.stopPropagation(); handleWheelAction('branch'); }}
                className="wheel-button"
                style={{ background: '#059669', color: 'white' }}
              >
                🌿 Branch & Copy Spec
              </button>
            )}
            {wheelConfig.dropData && (
              <>
                {wheelConfig.dropData.nodeType === 'spec' && wheelConfig.dropData.label !== 'Custom Recipe' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleWheelAction('expand'); }}
                    className="wheel-button"
                    style={{ background: '#3b82f6', color: 'white' }}
                  >
                    ✨ Expand Cluster
                  </button>
                )}
                {wheelConfig.dropData.nodeType === 'recipe' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleWheelAction('expand'); }}
                    className="wheel-button"
                    style={{ background: '#3b82f6', color: 'white' }}
                  >
                    📑 Expand Recipe
                  </button>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); handleWheelAction('node'); }}
                  className="wheel-button"
                  style={{ background: '#64748b', color: 'white' }}
                >
                  📦 Add Single Node
                </button>
              </>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); handleWheelAction('blank'); }}
              className="wheel-button"
              style={{ background: '#334155', color: '#e2e8f0' }}
            >
              📝 New Blank Spec
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setWheelConfig(null); }}
              className="wheel-button"
              style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(window.innerWidth > 1024);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(window.innerWidth > 1280);
  const [user, setUser] = useState<any>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    // Check for existing session
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

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setLeftSidebarOpen(false);
        setRightSidebarOpen(false);
      } else {
        setLeftSidebarOpen(true);
        setRightSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-layout">
      <ReactFlowProvider>
        <>
          <Sidebar 
            type="builder" 
            isOpen={leftSidebarOpen} 
            user={user} 
            onTabChange={(type) => {
              if (type === 'builder') {
                setLeftSidebarOpen(true);
                setRightSidebarOpen(false);
              } else {
                setLeftSidebarOpen(false);
                setRightSidebarOpen(true);
              }
            }}
          />
          <Sidebar 
            type="library" 
            isOpen={rightSidebarOpen} 
            user={user} 
            onTabChange={(type) => {
              if (type === 'library') {
                setRightSidebarOpen(true);
                setLeftSidebarOpen(false);
              } else {
                setRightSidebarOpen(false);
                setLeftSidebarOpen(true);
              }
            }}
          />
          <CocktailCanvas 
            user={user} 
            onLoginClick={() => setIsLoginOpen(true)} 
            onLogoutClick={handleSignOut} 
            onDemoLogin={handleDemoLogin}
          />
          
          {isLoginOpen && (
            <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
          )}

          {(leftSidebarOpen || rightSidebarOpen) && (
            <div 
              className="mobile-backdrop" 
              onClick={() => {
                setLeftSidebarOpen(false);
                setRightSidebarOpen(false);
              }} 
            />
          )}
          
          {/* Mobile Toggle Buttons */}
          <div className="mobile-toggles">
            <button 
              onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
              className={`toggle-btn left ${leftSidebarOpen ? 'active' : ''}`}
              title="Toggle Builder"
            >
              <PanelsTopLeft size={20} />
            </button>
            
            <button 
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              className={`toggle-btn right ${rightSidebarOpen ? 'active' : ''}`}
              title="Toggle Library"
            >
              <LibraryIcon size={20} />
            </button>
          </div>
        </>
      </ReactFlowProvider>

    </div>
  );
}

