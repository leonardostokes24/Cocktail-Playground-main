import { Node } from '@xyflow/react';

export const HierarchyManager = {
  getAbsolutePosition: (node: Node, allNodes: Node[]) => {
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
  },

  getNodeBounds: (node: Node, allNodes: Node[], defaults: { width: number; height: number }) => {
    const abs = HierarchyManager.getAbsolutePosition(node, allNodes);
    const width = node.measured?.width || (typeof node.style?.width === 'number' ? node.style.width : defaults.width);
    const height = node.measured?.height || (typeof node.style?.height === 'number' ? node.style.height : defaults.height);
    return {
      x: abs.x,
      y: abs.y,
      width,
      height,
      area: width * height
    };
  },

  pickContainingNode: (
    candidates: Node[],
    point: { x: number; y: number },
    allNodes: Node[],
    defaults: { width: number; height: number }
  ) => {
    return candidates
      .map(node => ({ node, bounds: HierarchyManager.getNodeBounds(node, allNodes, defaults) }))
      .filter(({ bounds }) => (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height
      ))
      .sort((a, b) => a.bounds.area - b.bounds.area)[0]?.node ?? null;
  }
};
