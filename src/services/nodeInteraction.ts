import { Node } from '@xyflow/react';
import { getResponsiveNodeDefaults } from '../utils/responsive';

/**
 * Calculate absolute position of a node accounting for parent nesting
 */
export const getAbsolutePosition = (
  node: Node,
  allNodes: Node[]
): { x: number; y: number } => {
  let x = node.position.x;
  let y = node.position.y;
  let currentParentId = node.parentId;

  // Walk up the parent chain
  while (currentParentId) {
    const parent = allNodes.find((n) => n.id === currentParentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    currentParentId = parent.parentId;
  }

  return { x, y };
};

/**
 * Get bounding box of a node for intersection testing
 */
export const getNodeBounds = (
  node: Node,
  allNodes: Node[],
  viewport: { width: number; height: number },
  typeDefaults?: { [key: string]: { width: number; height: number } }
) => {
  const abs = getAbsolutePosition(node, allNodes);
  const defaults = typeDefaults || getResponsiveNodeDefaults(viewport);
  const nodeDefaults = defaults[node.type!] || { width: 240, height: 160 };

  const width = node.measured?.width ||
    (typeof node.style?.width === 'number' ? node.style.width : nodeDefaults.width);
  const height = node.measured?.height ||
    (typeof node.style?.height === 'number' ? node.style.height : nodeDefaults.height);

  return {
    x: abs.x,
    y: abs.y,
    width,
    height,
    area: width * height,
  };
};

/**
 * Check if a point is within bounds
 */
export const isPointInBounds = (
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number }
): boolean => {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
};

/**
 * Find the smallest container that contains a point
 * Returns null if no container found
 */
export const pickContainingNode = (
  candidates: Node[],
  point: { x: number; y: number },
  allNodes: Node[],
  viewport: { width: number; height: number }
): Node | null => {
  const defaults = getResponsiveNodeDefaults(viewport);

  return candidates
    .map((node) => ({
      node,
      bounds: getNodeBounds(node, allNodes, viewport, defaults),
    }))
    .filter(({ bounds }) => isPointInBounds(point, bounds))
    .sort((a, b) => a.bounds.area - b.bounds.area)[0]?.node ?? null;
};

/**
 * Calculate relative position when moving node into a parent container
 * Converts absolute world coordinates to relative parent coordinates
 */
export const calculateRelativePosition = (
  absolutePos: { x: number; y: number },
  parentNode: Node,
  allNodes: Node[]
): { x: number; y: number } => {
  const parentAbs = getAbsolutePosition(parentNode, allNodes);
  return {
    x: absolutePos.x - parentAbs.x,
    y: absolutePos.y - parentAbs.y,
  };
};

/**
 * Get the closest valid parent for a dragged node
 * Respects lock states and node type constraints
 */
export const getClosestValidParent = (
  draggedNode: Node,
  draggedNodeAbs: { x: number; y: number },
  allNodes: Node[],
  viewport: { width: number; height: number }
): Node | null => {
  // First check if dropped over a container
  const containerCandidates = allNodes.filter(
    (n) => n.type === 'container' && n.id !== draggedNode.id
  );
  const parentContainer = pickContainingNode(
    containerCandidates,
    draggedNodeAbs,
    allNodes,
    viewport
  );

  if (parentContainer) {
    return parentContainer;
  }

  // Then check if dropped over a spec (only if ingredient and spec is locked)
  if (draggedNode.type === 'ingredient') {
    const specCandidates = allNodes.filter(
      (n) => n.type === 'spec' && n.id !== draggedNode.id
    );
    const specCandidate = pickContainingNode(
      specCandidates,
      draggedNodeAbs,
      allNodes,
      viewport
    );

    // Only parent to spec if it's in lock mode
    if (specCandidate && (specCandidate.data?.isLocked !== false)) {
      return specCandidate;
    }
  }

  return null;
};

/**
 * Check if a node should remain parented when dragged outside its parent
 * Respects lock states
 */
export const shouldRemainParented = (node: Node, allNodes: Node[]): boolean => {
  if (!node.parentId) return false;

  const parent = allNodes.find((n) => n.id === node.parentId);
  if (!parent) return false;

  // If parent is a locked spec and node is ingredient, stay parented
  if (
    parent.type === 'spec' &&
    node.type === 'ingredient' &&
    (parent.data?.isLocked !== false)
  ) {
    return true;
  }

  // If parent is a container, always stay parented
  if (parent.type === 'container') {
    return true;
  }

  return false;
};

/**
 * Validate if a node can be parented to another node
 */
export const canParentTo = (
  draggedNode: Node,
  potentialParent: Node
): boolean => {
  // Can't parent to self
  if (draggedNode.id === potentialParent.id) return false;

  // Can't parent container to container that could be its parent
  if (draggedNode.type === 'container' && potentialParent.type === 'container') {
    // Prevent circular parenting - would need to walk tree to fully validate
    return true; // Simplified for now
  }

  // Can parent ingredient to locked spec
  if (
    draggedNode.type === 'ingredient' &&
    potentialParent.type === 'spec' &&
    (potentialParent.data?.isLocked !== false)
  ) {
    return true;
  }

  // Can parent anything to container
  if (potentialParent.type === 'container') {
    return true;
  }

  return false;
};

/**
 * Get measured dimensions for a node type
 * Falls back to responsive defaults if not yet measured
 */
export const getNodeDimensions = (
  node: Node,
  viewport: { width: number; height: number }
): { width: number; height: number } => {
  if (node.measured?.width && node.measured?.height) {
    return {
      width: node.measured.width,
      height: node.measured.height,
    };
  }

  if (
    typeof node.style?.width === 'number' &&
    typeof node.style?.height === 'number'
  ) {
    return {
      width: node.style.width,
      height: node.style.height,
    };
  }

  const defaults = getResponsiveNodeDefaults(viewport);
  return defaults[node.type!] || { width: 240, height: 160 };
};
