import React, { useCallback, useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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

import { Menu, BookOpen, ChevronLeft, ChevronRight, Share2, Download, PanelsTopLeft, Library as LibraryIcon, ZoomIn, ZoomOut, Maximize, Map as MapIcon } from 'lucide-react';
import IngredientNode from './components/IngredientNode';
import SpecNode from './components/SpecNode';
import ContainerNode from './components/ContainerNode';
import CustomEdge from './components/CustomEdge';
import Sidebar from './components/Sidebar';
import { findCocktailMatch } from './data/cocktailDB';
import { matchFromIngredients } from './api/cocktaildb';

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

function CocktailCanvas({ onIngredientsChange }: { onIngredientsChange: (names: string[]) => void }) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const cdbTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const cdbHashRef = useRef<Map<string, string>>(new Map());
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const { screenToFlowPosition, getNode, zoomIn, zoomOut, fitView } = useReactFlow();
  const [zoomLevel, setZoomLevel] = useState(100);

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
    sourceId: string; 
    handleType: string;
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
            // Preserve a previously CDB-matched result as long as ingredients haven't changed
            const cdbIngs = node.data.cdbMatchedIngredients as string[] | undefined;
            if (cdbIngs) {
              const currentHash = ingredientsList.map(i => i.name).sort().join('\x00');
              const cdbHash = [...cdbIngs].sort().join('\x00');
              if (currentHash === cdbHash) {
                newLabel = node.data.label as string;
                newMethod = node.data.method as string;
                newGlass = node.data.glassware as string;
                newIsMatched = true;
              } else {
                newLabel = 'Custom Recipe';
                newMethod = 'Experimenting...';
                newGlass = 'Unknown';
                newIsMatched = false;
              }
            } else {
              newLabel = 'Custom Recipe';
              newMethod = 'Experimenting...';
              newGlass = 'Unknown';
              newIsMatched = false;
            }
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

  // Async CocktailDB matcher — fires 1.5s after the last change, only for unmatched specs
  useEffect(() => {
    clearTimeout(cdbTimerRef.current);
    cdbTimerRef.current = setTimeout(async () => {
      const specsToQuery = nodes.filter(n => {
        if (n.type !== 'spec' || n.data.isMatched || n.data.isCustomOverride) return false;
        const ings = (n.data.ingredientsList as { name: string }[]) || [];
        if (ings.length < 2) return false;
        const hash = ings.map(i => i.name).sort().join('\x00');
        return cdbHashRef.current.get(n.id) !== hash;
      });

      for (const spec of specsToQuery) {
        const ings = (spec.data.ingredientsList as { name: string }[]).map(i => i.name);
        const hash = ings.slice().sort().join('\x00');
        cdbHashRef.current.set(spec.id, hash);
        try {
          const match = await matchFromIngredients(ings);
          if (match) {
            setNodes(nds => nds.map(n => {
              if (n.id !== spec.id) return n;
              const currentIngs = (n.data.ingredientsList as { name: string }[]).map(i => i.name);
              return {
                ...n,
                data: {
                  ...n.data,
                  label: match.name,
                  method: match.method,
                  glassware: match.glass,
                  isMatched: true,
                  cdbMatchedIngredients: currentIngs,
                },
              };
            }));
          }
        } catch {
          // silently ignore network errors
        }
      }
    }, 1500);

    return () => clearTimeout(cdbTimerRef.current);
  }, [nodes, setNodes]);

  // Helper to calculate absolute position and resolve parenting changes safely
  const getAbsolutePosition = useCallback((node: Node, allNodes: Node[]) => {
    let x = node.position.x;
    let y = node.position.y;
    let currentParentId = node.parentId;
    
    while (currentParentId) {
      const parent = allNodes.find(n => n.id === currentParentId);
      if (!parent) break;
      x += parent.position.x;
      y += parent.position.y;
      currentParentId = parent.parentId;
    }
    return { x, y };
  }, []);

  const onNodeDragStop = useCallback((_: any, draggedNode: Node) => {
    if (draggedNode.type === 'container') return;

    setNodes((nds) => {
      const abs = getAbsolutePosition(draggedNode, nds);
      
      // 1. Check if dropped over a container
      const parentContainer = nds.find(n => (
        n.type === 'container' && 
        n.id !== draggedNode.id &&
        abs.x >= n.position.x && abs.x <= n.position.x + (n.measured?.width || 300) &&
        abs.y >= n.position.y && abs.y <= n.position.y + (n.measured?.height || 300)
      ));

      const parentSpecCandidate = nds.find(n => (
        n.type === 'spec' && 
        n.id !== draggedNode.id &&
        abs.x >= n.position.x && abs.x <= n.position.x + (n.measured?.width || 240) &&
        abs.y >= n.position.y && abs.y <= n.position.y + (n.measured?.height || 160)
      ));

      // Only parent to Spec if the Spec is currently in "Lock" mode
      const parentSpec = (parentSpecCandidate?.data?.isLocked !== false) ? parentSpecCandidate : null;

      const finalParent = parentContainer || parentSpec;

      if (finalParent) {
        if (draggedNode.parentId === finalParent.id) return nds;

        return nds.map(node => {
          if (node.id === draggedNode.id) {
            const containerAbs = getAbsolutePosition(finalParent, nds);
            return {
              ...node,
              parentId: finalParent.id,
              position: { x: abs.x - containerAbs.x, y: abs.y - containerAbs.y },
              extent: 'parent'
            } as Node;
          }
          return node;
        });
      }

      // 2. If dropped outside and was in a container or spec, unparent it
      if (draggedNode.parentId) {
         const currentParent = nds.find(n => n.id === draggedNode.parentId);
         const isLockedSpec = currentParent?.type === 'spec' && (currentParent.data?.isLocked !== false);
         
         // If the parent spec is locked, do NOT unparent the ingredient node. This keeps it attached
         // to the spec even if dragged outside its visual bounds, unless it's dropped over a new parent.
         if (isLockedSpec) {
           return nds;
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
  }, [setNodes, getAbsolutePosition]);

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
            const nodeAbs = getAbsolutePosition(node, nds);
            const parentAbs = getAbsolutePosition(targetNode, nds);

            return {
              ...node,
              parentId: specEdge.target,
              extent: undefined,
              position: { x: nodeAbs.x - parentAbs.x, y: nodeAbs.y - parentAbs.y }
            };
          }

          if (!specEdge && node.parentId && nds.find(n => n.id === node.parentId)?.type === 'spec') {
            const parentNode = nds.find(n => n.id === node.parentId);
            if (!parentNode) return node;
            
            changed = true;
            const nodeAbs = getAbsolutePosition(node, nds);
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
            const nodeAbs = getAbsolutePosition(node, nds);
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
  }, [edges, setNodes, getAbsolutePosition, lockStatesHash]);

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
        
        setAmountInput("30 ml");
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
      const targetAbs = getAbsolutePosition(targetNode, nodes);

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

  const handleWheelAction = (action: 'branch' | 'blank') => {
    if (!wheelConfig) return;
    const { sourceId, x, y } = wheelConfig;
    const sourceNode = getNode(sourceId);
    if (!sourceNode) return;

    const flowPos = screenToFlowPosition({ x, y });
    const newSpecId = getId();

    if (action === 'blank') {
      const newSpecNode: Node = {
        id: newSpecId,
        type: 'spec',
        position: flowPos,
        data: { label: 'Custom Recipe', method: 'Experimenting...', glassware: 'Unknown', isMatched: false, isCustomOverride: false, ingredientsList: [] }
      };
      
      const newEdge: Edge = {
        id: `edge_${sourceId}_${newSpecId}`,
        source: sourceId,
        target: newSpecId,
        label: sourceNode.type === 'ingredient' ? '30 ml' : 'Twist',
        animated: true,
        type: 'custom'
      };

      setNodes((nds) => [...nds, newSpecNode]);
      setEdges((eds) => [...eds, newEdge]);
    } 
    else if (action === 'branch' && sourceNode.type === 'spec') {
      // Branching logic similar to twist but triggered from wheel
      const parentIncomingEdges = edges.filter(e => e.target === sourceId);
      const parentIngredients = parentIncomingEdges.map(e => {
        const n = nodes.find(node => node.id === e.source);
        if (n && n.type === 'ingredient') {
          return { node: n, amount: e.label as string };
        }
        return null;
      }).filter((item): item is { node: Node; amount: string } => item !== null);

      const targetPos = flowPos;
      const targetSpecNode: Node = {
        id: newSpecId,
        type: 'spec',
        position: targetPos,
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
      // Check if we dropped an ingredient on an existing ingredient node
      // We'll use a simple coordinate-based check since we don't have the internal flow event here easily
      const intersectedNode = nodes.find(n => (
        n.type === 'ingredient' && 
        Math.abs(n.position.x - position.x) < 80 && 
        Math.abs(n.position.y - position.y) < 40
      ));

      if (intersectedNode && parsedData.nodeType === 'ingredient') {
        setNodes((nds) => nds.map(node => {
          if (node.id === intersectedNode.id) {
            return {
              ...node,
              data: { ...node.data, label: parsedData.label, type: parsedData.categoryType }
            };
          }
          return node;
        }));
        return;
      }

      // --- FEATURE: SMART FORMULA CLUSTERS ---
      if (parsedData.nodeType === 'spec' && parsedData.label !== 'Custom Recipe') {
        const clusterNodes: Node[] = [];
        const clusterEdges: Edge[] = [];
        const specId = getId();
        
        // Define common formula structures
        const structures: Record<string, { ingredients: { label: string; type: string; amount: string }[] }> = {
          'The Sour': {
             ingredients: [
               { label: 'Base Spirit', type: 'spirit', amount: '60 ml' },
               { label: 'Citrus', type: 'citrus', amount: '22 ml' },
               { label: 'Sweetener', type: 'sweetener', amount: '22 ml' }
             ]
          },
          'Spirit-Forward': {
            ingredients: [
               { label: 'Base Spirit', type: 'spirit', amount: '60 ml' },
               { label: 'Fortified Wine', type: 'modifier', amount: '30 ml' },
               { label: 'Aromatic Bitters', type: 'bitters', amount: '2 dashes' }
            ]
          },
          'Highball': {
            ingredients: [
               { label: 'Base Spirit', type: 'spirit', amount: '60 ml' },
               { label: 'Modifier / Citrus', type: 'citrus', amount: '15 ml' },
               { label: 'Sparkling Filler', type: 'sweetener', amount: '120 ml' }
            ]
          },
          'Negroni Style': {
            ingredients: [
               { label: 'Base Spirit', type: 'spirit', amount: '30 ml' },
               { label: 'Bitters / Aperitif', type: 'modifier', amount: '30 ml' },
               { label: 'Sweet Vermouth', type: 'modifier', amount: '30 ml' }
            ]
          }
        };

        const config = structures[parsedData.label];
        
        if (config) {
          clusterNodes.push({
            id: specId,
            type: 'spec',
            position,
            data: { label: parsedData.label, method: 'Experimenting...', glassware: 'Unknown', isMatched: false, isCustomOverride: false, ingredientsList: [] }
          });

          config.ingredients.forEach((ing, idx) => {
            const ingId = getId();
            const relPosX = -200;
            const relPosY = (idx * 80) - 80;
            
            clusterNodes.push({
              id: ingId,
              type: 'ingredient',
              position: { x: relPosX, y: relPosY },
              parentId: specId,
              extent: undefined,
              data: { label: ing.label, type: ing.type }
            });
            clusterEdges.push({
              id: `edge_${ingId}_${specId}`,
              source: ingId,
              target: specId,
              label: ing.amount,
              animated: true
            });
          });

          setNodes((nds) => [...nds, ...clusterNodes]);
          setEdges((eds) => [...eds, ...clusterEdges]);
          return;
        }
      }

      // --- FEATURE: FULL RECIPE EXPANSION ---
      if (parsedData.nodeType === 'recipe') {
        const clusterNodes: Node[] = [];
        const clusterEdges: Edge[] = [];
        const specId = getId();
        const recipe = parsedData.recipe;
        
        clusterNodes.push({
          id: specId,
          type: 'spec',
          position,
          data: { 
            label: recipe.name, 
            method: recipe.method, 
            glassware: recipe.glass, 
            isMatched: true, 
            isCustomOverride: false, 
            ingredientsList: [] 
          }
        });

        if (recipe.standardIngredients) {
          recipe.standardIngredients.forEach((ing: any, idx: number) => {
            const ingId = getId();
            const relPosX = -220;
            const relPosY = (idx * 85) - ((recipe.standardIngredients.length * 85) / 2) + 40;
            
            clusterNodes.push({
              id: ingId,
              type: 'ingredient',
              position: { x: relPosX, y: relPosY },
              parentId: specId,
              extent: undefined,
              data: { label: ing.label, type: ing.type }
            });
            clusterEdges.push({
              id: `edge_${ingId}_${specId}`,
              source: ingId,
              target: specId,
              label: ing.amount,
              animated: false
            });
          });
        }

        setNodes((nds) => [...nds, ...clusterNodes]);
        setEdges((eds) => [...eds, ...clusterEdges]);
        return;
      }

      // --- DEFAULT: SINGLE NODE DROP ---
      const intersectContainer = nodes.find(n => (
        n.type === 'container' && 
        position.x >= n.position.x && position.x <= n.position.x + (n.measured?.width || 300) &&
        position.y >= n.position.y && position.y <= n.position.y + (n.measured?.height || 300)
      ));

      const newNode: Node = {
        id: getId(),
        type: parsedData.nodeType,
        position: intersectContainer 
          ? { x: position.x - intersectContainer.position.x, y: position.y - intersectContainer.position.y }
          : position,
        parentId: intersectContainer?.id,
        extent: intersectContainer ? 'parent' : undefined,
        data: { 
          label: parsedData.label, 
          type: parsedData.categoryType,
          method: parsedData.nodeType === 'spec' ? 'Experimenting...' : null,
          glassware: parsedData.nodeType === 'spec' ? 'Unknown' : null,
          isMatched: false,
          isCustomOverride: false,
          ingredientsList: []
        },
      };

      // Spec special initialization
      if (parsedData.nodeType === 'container') {
        newNode.style = { width: 300, height: 300 };
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes, nodes]
  );

  // Sync ingredient node labels to parent App so the library sidebar can suggest cocktails
  useEffect(() => {
    const names = nodes
      .filter(n => n.type === 'ingredient')
      .map(n => n.data.label as string)
      .filter(Boolean);
    onIngredientsChange(names);
  }, [nodes, onIngredientsChange]);

  const exportToExcel = useCallback(() => {
    const specNodes = nodes.filter(n => n.type === 'spec');
    if (specNodes.length === 0) {
      alert('No cocktail specs on the canvas to export.');
      return;
    }

    const rows: (string | number)[][] = [
      ['Cocktail', 'Method', 'Glassware', 'Ingredient', 'Amount'],
    ];

    specNodes.forEach((node, idx) => {
      const name = (node.data.label as string) || 'Unnamed';
      const method = (node.data.method as string) || '';
      const glass = (node.data.glassware as string) || '';
      const ingredients = (node.data.ingredientsList as { name: string; amount: string }[]) || [];

      if (ingredients.length === 0) {
        rows.push([name, method, glass, '', '']);
      } else {
        ingredients.forEach((ing, i) => {
          rows.push([
            i === 0 ? name : '',
            i === 0 ? method : '',
            i === 0 ? glass : '',
            ing.name,
            ing.amount,
          ]);
        });
      }

      if (idx < specNodes.length - 1) {
        rows.push(['', '', '', '', '']);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cocktail Specs');
    XLSX.writeFile(wb, 'cocktail-specs.xlsx');
  }, [nodes]);

  return (
    <div className="canvas-container" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
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
           <button className="header-btn primary" onClick={exportToExcel}>Export Spec</button>
        </div>
      </div>

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
  const [canvasIngredients, setCanvasIngredients] = useState<string[]>([]);

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
        <Sidebar type="builder" isOpen={leftSidebarOpen} />
        <Sidebar type="library" isOpen={rightSidebarOpen} canvasIngredients={canvasIngredients} />
        <CocktailCanvas onIngredientsChange={setCanvasIngredients} />
        
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
      </ReactFlowProvider>
    </div>
  );
}
