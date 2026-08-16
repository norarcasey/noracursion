import type { VizModel } from '../core/model'
import { frame, routeEdge, type Placement } from './geometry'
import { CHAIN_SPACING, NODE_RADIUS, ROW_SPACING, type Layout, type LayoutNode } from './types'

/**
 * A horizontal line of nodes in model order.
 *
 * Backs both `row` (arrays and heaps-as-arrays) and `chain` (linked lists);
 * they differ only in spacing, since a chain has to leave room for the
 * arrowhead between neighbours. Index labels are drawn by the renderer from
 * each node's `meta.index`, not baked into the geometry.
 */
function line(model: VizModel, spacing: number): Layout {
  const placements = new Map<string, Placement>()
  const nodes: LayoutNode[] = model.nodes.map((node, index) => {
    const placement = { x: index * spacing, y: 0 }
    placements.set(node.id, placement)
    return {
      id: node.id,
      label: node.label,
      x: placement.x,
      y: placement.y,
      radius: NODE_RADIUS,
      color: node.color,
      state: node.state,
      meta: node.meta,
    }
  })

  const edges = model.edges.flatMap((edge) => {
    const from = placements.get(edge.from)
    const to = placements.get(edge.to)
    // An edge naming a node that is not in the model is a bug upstream; drop it
    // rather than emitting NaN coordinates that would break the whole frame.
    if (from === undefined || to === undefined) return []
    return [routeEdge(edge, from, to)]
  })

  return frame(nodes, edges)
}

export function row(model: VizModel): Layout {
  return line(model, ROW_SPACING)
}

export function chain(model: VizModel): Layout {
  return line(model, CHAIN_SPACING)
}
