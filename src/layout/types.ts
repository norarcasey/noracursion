import type { EdgeKind, EdgeState, NodeColor, NodeState } from '../core/model'

/** CLAUDE.md §3.5: `Node = <circle r={18}>`. */
export const NODE_RADIUS = 18

/** Padding between the content's bounding box and the viewBox edge. */
export const PADDING = 24

/** Centre-to-centre spacing for a row of array cells. */
export const ROW_SPACING = NODE_RADIUS * 2 + 20

/** Wider than a row: a chain has to fit an arrowhead between neighbours. */
export const CHAIN_SPACING = NODE_RADIUS * 2 + 44

/** Minimum centre-to-centre distance between adjacent nodes in a tree. */
export const SIBLING_SPACING = NODE_RADIUS * 2 + 24

/** Vertical distance between tree levels. */
export const LEVEL_HEIGHT = NODE_RADIUS * 4

export interface LayoutNode {
  readonly id: string
  readonly label: string
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly color?: NodeColor
  readonly state?: NodeState
  readonly meta?: Record<string, unknown>
}

/**
 * An edge with its endpoints already trimmed back to the circles' rims, so an
 * arrowhead lands on the boundary instead of under the target node.
 */
export interface LayoutEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind?: EdgeKind
  readonly label?: string
  readonly state?: EdgeState
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
  /** Length of the trimmed segment; the renderer scales a unit line by this. */
  readonly length: number
  /** Rotation of the segment in degrees, clockwise from the positive x axis. */
  readonly angle: number
}

export interface Layout {
  readonly nodes: readonly LayoutNode[]
  readonly edges: readonly LayoutEdge[]
  readonly width: number
  readonly height: number
  /** Fits the content plus `PADDING` on every side (§3.5). */
  readonly viewBox: string
}

export const EMPTY_LAYOUT: Layout = {
  nodes: [],
  edges: [],
  width: 0,
  height: 0,
  viewBox: '0 0 0 0',
}
