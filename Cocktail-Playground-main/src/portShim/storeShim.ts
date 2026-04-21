import { NodeModel } from './portShim/nodeModel'
import { EdgeModel } from './portShim/edgeModel'
import { Port } from './portShim/portTypes'
import { GraphConfig, DEFAULT_GRAPH_CONFIG } from './portShim/graphConfig'

export interface PortShimGraph {
  nodes: NodeModel[]
  edges: EdgeModel[]
  config: GraphConfig
}

// In-memory projection that mirrors current graph data
export function initFromCurrentGraph(currentNodes: any[], currentEdges: any[]): PortShimGraph {
  const nodes: NodeModel[] = (currentNodes || []).map((n: any) => ({
    id: n.id,
    type: n.type,
    data: n.data,
    ports: Array.isArray(n.ports) ? n.ports as Port[] : []
  }))

  const edges: EdgeModel[] = (currentEdges || []).map((e: any, idx: number) => ({
    id: e.id ?? `pe edge ${idx}`,
    sourceNodeId: e.source,
    sourcePortId: e.sourcePortId ?? `sp_${e.source}_${idx}`,
    targetNodeId: e.target,
    targetPortId: e.targetPortId ?? `tp_${e.target}_${idx}`,
  }))

  return {
    nodes,
    edges,
    config: DEFAULT_GRAPH_CONFIG
  }
}
