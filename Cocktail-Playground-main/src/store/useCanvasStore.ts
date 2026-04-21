import { create } from 'zustand';
import { Node, Edge, Connection, EdgeChange, NodeChange, addEdge } from '@xyflow/react';
import { findCocktailMatch } from '../data/cocktailDB';

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  
  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  updateNodeData: (nodeId: string, data: any) => void;
  deleteNode: (nodeId: string) => void;
  
  // Domain Logic
  handleNodeDragStop: (draggedNode: Node, allNodes: Node[]) => void;
  syncParenting: () => void;
  autoMatchSpecs: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
    // Trigger logic that depends on node movement
    get().syncParenting();
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
    get().autoMatchSpecs();
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
    get().autoMatchSpecs();
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map(node => 
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
    });
    get().autoMatchSpecs();
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter(n => n.id !== nodeId),
      edges: get().edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    });
  },

  handleNodeDragStop: (draggedNode, allNodes) => {
    const { nodes, edges } = get();
    
    if (draggedNode.type === 'container') return;

    const abs = getAbsolutePosition(draggedNode, allNodes);
    
    const parentContainer = pickContainingNode(
      allNodes.filter(n => n.type === 'container' && n.id !== draggedNode.id),
      abs,
      allNodes,
      { width: 300, height: 300 }
    );

    const parentSpecCandidate = pickContainingNode(
      allNodes.filter(n => n.type === 'spec' && n.id !== draggedNode.id),
      abs,
      allNodes,
      { width: 240, height: 160 }
    );

    const parentSpec = (parentSpecCandidate?.data?.isLocked !== false) ? parentSpecCandidate : null;
    const finalParent = parentContainer || parentSpec;

    if (finalParent) {
      if (draggedNode.parentId === finalParent.id) return;
      
      const parentAbs = getAbsolutePosition(finalParent, allNodes);
      set({
        nodes: allNodes.map(node => 
          node.id === draggedNode.id 
            ? { ...node, parentId: finalParent.id, position: { x: abs.x - parentAbs.x, y: abs.y - parentAbs.y }, extent: 'parent' } 
            : node
        )
      });
    } else if (draggedNode.parentId) {
      const currentParent = allNodes.find(n => n.id === draggedNode.parentId);
      const isLockedSpec = currentParent?.type === 'spec' && (currentParent.data?.isLocked !== false);
      
      if (!isLockedSpec) {
        set({
          nodes: allNodes.map(node => 
            node.id === draggedNode.id 
              ? { ...node, parentId: undefined, position: { x: abs.x, y: abs.y }, extent: undefined } 
              : node
          )
        });
      }
    }
  },

  syncParenting: () => {
    const { nodes, edges } = get();
    let changed = false;

    const nextNodes = nodes.map(node => {
      if (node.type !== 'ingredient') return node;

      const specEdge = edges.find(e => e.source === node.id && nodes.find(n => n.id === e.target)?.type === 'spec');
      const targetNodeId = specEdge?.target || node.parentId;
      const targetNode = nodes.find(n => n.id === targetNodeId);
      const isLocked = targetNode?.data?.isLocked ?? true;

      if (isLocked && specEdge && node.parentId !== specEdge.target) {
        changed = true;
        const nodeAbs = getAbsolutePosition(node, nodes);
        const parentAbs = getAbsolutePosition(targetNode!, nodes);
        return { ...node, parentId: specEdge.target, extent: undefined, position: { x: nodeAbs.x - parentAbs.x, y: nodeAbs.y - parentAbs.y } };
      } 
      
      if (!isLocked && node.parentId && nodes.find(n => n.id === node.parentId)?.type === 'spec') {
        changed = true;
        const nodeAbs = getAbsolutePosition(node, nodes);
        return { ...node, parentId: undefined, extent: undefined, position: { x: nodeAbs.x, y: nodeAbs.y } };
      }

      return node;
    });

    if (changed) set({ nodes: nextNodes });
  },

  autoMatchSpecs: () => {
    const { nodes, edges } = get();
    let changed = false;

    const updatedNodes = nodes.map(node => {
      if (node.type !== 'spec') return node;
      if (node.data.isCustomOverride) return node;

      const incomingEdges = edges.filter(e => e.target === node.id);
      const ingredientsList = incomingEdges.map(edge => {
        const src = nodes.find(n => n.id === edge.source);
        return src?.type === 'ingredient' ? { name: src.data.label, amount: edge.label } : null;
      }).filter(Boolean);

      const match = findCocktailMatch(ingredientsList.map(i => (i as any).name));
      
      if (match) {
        if (node.data.label !== match.name) {
          changed = true;
          return { ...node, data: { ...node.data, label: match.name, method: match.method, glassware: match.glass, isMatched: true, ingredientsList } };
        }
      } else if (node.data.isMatched) {
        changed = true;
        return { ...node, data: { ...node.data, label: 'Custom Recipe', method: 'Experimenting...', glassware: 'Unknown', isMatched: false, ingredientsList } };
      }
      return node;
    });

    if (changed) set({ nodes: updatedNodes });
  },
}));

// Helpers
function applyNodeChanges(changes: NodeChange[], nodes: Node[]) {
  // Simplified for brevity, in real app use @xyflow/react's applyNodeChanges
  return nodes; // This needs actual implementation or import
}

function applyEdgeChanges(changes: EdgeChange[], edges: Edge[]) {
  return edges; // This needs actual implementation or import
}

function getAbsolutePosition(node: Node, allNodes: Node[]) {
  let { x, y } = node.position;
  let parentId = node.parentId;
  while (parentId) {
    const parent = allNodes.find(n => n.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

function pickContainingNode(candidates: Node[], point: { x: number; y: number }, allNodes: Node[], defaults: { width: number; height: number }) {
  return candidates
    .map(node => {
      const abs = getAbsolutePosition(node, allNodes);
      const width = node.measured?.width || defaults.width;
      const height = node.measured?.height || defaults.height;
      return { node, bounds: { x: abs.x, y: abs.y, width, height, area: width * height } };
    })
    .filter(({ bounds }) => point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height)
    .sort((a, b) => a.bounds.area - b.bounds.area)[0]?.node ?? null;
}
