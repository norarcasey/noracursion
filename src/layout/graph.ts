import type { VizModel } from '../core/model'
import { frame, routeEdge, type Placement } from './geometry'
import { NODE_RADIUS, type Layout, type LayoutNode } from './types'

/**
 * Graph layout: the coordinates the author supplied, framed.
 *
 * There is no algorithm here on purpose. §3.5 gives v1 author-supplied
 * coordinates and rules out anything that jitters between renders, and the
 * quickest way to ship a jittering layout is to compute one. A node with no
 * coordinates lands at the origin, which is visibly wrong rather than subtly
 * wrong.
 */
export function graph(model: VizModel): Layout {
  const placements = new Map<string, Placement>()

  const nodes: LayoutNode[] = model.nodes.map((node) => {
    const placement = { x: readNumber(node.meta?.x), y: readNumber(node.meta?.y) }
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
    if (from === undefined || to === undefined) return []
    return [routeEdge(edge, from, to)]
  })

  return frame(nodes, edges)
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
