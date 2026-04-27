import { Node } from '@xyflow/react';

export const sortNodesByHierarchy = (nodes: Node[]): Node[] => {
  const sorted: Node[] = [];
  const visited = new Set<string>();

  const visit = (node: Node) => {
    if (visited.has(node.id)) return;

    if (node.parentId) {
      const parent = nodes.find(n => n.id === node.parentId);
      if (parent) {
        visit(parent);
      }
    }

    visited.add(node.id);
    sorted.push(node);
  };

  nodes.forEach(node => visit(node));
  return sorted;
};
