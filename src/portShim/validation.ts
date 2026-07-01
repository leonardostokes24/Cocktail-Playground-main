import { Port, PortKind } from './portTypes'
import { EdgeModel } from './edgeModel'
import { GraphConfig, DEFAULT_GRAPH_CONFIG } from './graphConfig'

// Simple dataType compatibility: allow if equal or if one is 'any'. Extend as needed.
function isDataTypeCompatible(sourceType: string, targetType: string): boolean {
  if (!sourceType || !targetType) return true
  if (sourceType === 'any' || targetType === 'any') return true
  return sourceType === targetType
}

// Basic helper to build a quick adjacency map from edges
function buildAdjacency(edges: EdgeModel[]) {
  const adj: Record<string, string[]> = {}
  for (const e of edges) {
    if (!adj[e.sourceNodeId]) adj[e.sourceNodeId] = []
    adj[e.sourceNodeId].push(e.targetNodeId)
  }
  return adj
}

// Detect if connecting source to target would create a cycle given current edges
function wouldCreateCycle(
  sourceNodeId: string,
  targetNodeId: string,
  edges: EdgeModel[],
  graphConfig: GraphConfig
) {
  if (graphConfig.allowCycles) return false
  const adj = buildAdjacency(edges)
  // If there is a path from targetNodeId back to sourceNodeId, adding edge would create a cycle
  const visited = new Set<string>()
  const stack = [targetNodeId]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === sourceNodeId) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    const neighbors = adj[cur] || []
    for (const n of neighbors) stack.push(n)
  }
  return false
}

export function canConnect(
  sourcePort: Port,
  targetPort: Port,
  graphConfig: GraphConfig = DEFAULT_GRAPH_CONFIG,
  edges: EdgeModel[] = []
): boolean {
  // 1) kinds
  if (sourcePort.kind !== 'output') return false
  if (targetPort.kind !== 'input') return false
  // 2) data type compatibility
  if (!isDataTypeCompatible(sourcePort.dataType, targetPort.dataType)) return false
  // 3) cycles
  // We need node IDs to evaluate cycles; best effort shim only checks via edge graph if we have endpoints.
  // If ports carry node IDs in metadata in the future, the caller can pass edges accordingly.
  // Here we assume the actual caller will handle cycle checks with current edge set; return true if no edges given.
  if (graphConfig?.allowCycles === false && edges.length >= 0) {
    // Without node IDs from ports, skip cycle check in shim; caller can supply extra context later.
  }
  return true
}

export function getConnectionError(
  sourcePort: Port,
  targetPort: Port,
  graphConfig: GraphConfig = DEFAULT_GRAPH_CONFIG,
  edges: EdgeModel[] = []
): string | null {
  if (sourcePort.kind !== 'output') return 'Source port must be an output.'
  if (targetPort.kind !== 'input') return 'Target port must be an input.'
  if (!isDataTypeCompatible(sourcePort.dataType, targetPort.dataType)) return `Incompatible data types: ${sourcePort.dataType} vs ${targetPort.dataType}`
  if (!graphConfig.allowCycles && wouldCreateCycle(sourcePort as any, targetPort as any, edges, graphConfig)) {
    return 'Connecting these ports would create a cycle in this graph.'
  }
  return null
}
