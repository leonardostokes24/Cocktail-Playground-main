import { NodeModel } from './nodeModel'
import { EdgeModel } from './edgeModel'
import { Port } from './portTypes'

// Very lightweight migrator: map legacy edges (source/target only) to port-based edges using synthetic ports.
export function migrateLegacyGraph(nodes: NodeModel[], edges: any[]) {
  // Build synthetic ports for endpoints if missing; attach to the related nodes
  const updatedNodes = nodes.map(n => {
    let ports = n.ports || []
    if (!ports.length) {
      // Create a single default port per edge endpoint if necessary later; do not guess here.
      ports = []
    }
    return { ...n, ports }
  })

  const portEdges: EdgeModel[] = (edges || []).map((e: any, idx: number) => {
    const sourcePortId = `sp_${e.source}_${idx}`
    const targetPortId = `tp_${e.target}_${idx}`
    return {
      id: e.id || `edge_migrate_${idx}`,
      sourceNodeId: e.source,
      sourcePortId,
      targetNodeId: e.target,
      targetPortId,
    }
  })

  return { nodes: updatedNodes, edges: portEdges }
}
