import type { VizEdge } from '../core/model'
import {
  EMPTY_LAYOUT,
  NODE_RADIUS,
  PADDING,
  type Layout,
  type LayoutEdge,
  type LayoutNode,
} from './types'

/** Where a node sits, before edges are routed between them. */
export interface Placement {
  readonly x: number
  readonly y: number
}

/**
 * Route an edge between two placed nodes, trimming both ends back to the rim
 * of the circle.
 *
 * Centre-to-centre would run the line under both nodes, which is invisible
 * until an arrowhead needs to point at something — then it lands in the middle
 * of the target circle. Trimming also gives the renderer a length and an angle,
 * which is what lets it draw the edge as one transformed unit line and animate
 * it with the same CSS transition the nodes use.
 */
export function routeEdge(
  edge: VizEdge,
  from: Placement,
  to: Placement,
  fromRadius = NODE_RADIUS,
  toRadius = NODE_RADIUS,
): LayoutEdge {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy)

  // Two nodes at the same point have no direction to trim along. Emit a
  // zero-length edge rather than dividing by zero and producing NaN, which
  // would silently poison every downstream position.
  if (distance === 0) {
    return {
      ...edge,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      length: 0,
      angle: 0,
    }
  }

  const unitX = dx / distance
  const unitY = dy / distance
  const x1 = from.x + unitX * fromRadius
  const y1 = from.y + unitY * fromRadius
  const trimmed = Math.max(0, distance - fromRadius - toRadius)

  return {
    ...edge,
    x1,
    y1,
    x2: x1 + unitX * trimmed,
    y2: y1 + unitY * trimmed,
    length: trimmed,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

/**
 * Shift everything so the content starts at `PADDING`, and size the viewBox to
 * fit. Layout functions compute positions in whatever space is natural to them
 * — a tidy tree's root lands wherever the algorithm puts it — and this is the
 * single place that turns those into drawable coordinates.
 */
export function frame(nodes: readonly LayoutNode[], edges: readonly LayoutEdge[]): Layout {
  if (nodes.length === 0) return EMPTY_LAYOUT

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.radius)
    minY = Math.min(minY, node.y - node.radius)
    maxX = Math.max(maxX, node.x + node.radius)
    maxY = Math.max(maxY, node.y + node.radius)
  }

  const offsetX = PADDING - minX
  const offsetY = PADDING - minY
  const width = maxX - minX + PADDING * 2
  const height = maxY - minY + PADDING * 2

  return {
    nodes: nodes.map((node) => ({ ...node, x: node.x + offsetX, y: node.y + offsetY })),
    edges: edges.map((edge) => ({
      ...edge,
      x1: edge.x1 + offsetX,
      y1: edge.y1 + offsetY,
      x2: edge.x2 + offsetX,
      y2: edge.y2 + offsetY,
    })),
    width,
    height,
    viewBox: `0 0 ${round(width)} ${round(height)}`,
  }
}

/** Keeps the viewBox string stable across floating-point noise. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
