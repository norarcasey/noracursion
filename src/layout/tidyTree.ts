import type { VizModel } from '../core/model'
import { frame, routeEdge, type Placement } from './geometry'
import { LEVEL_HEIGHT, NODE_RADIUS, SIBLING_SPACING, type Layout, type LayoutNode } from './types'

/**
 * Reingold–Tilford tidy tree layout, in Buchheim et al.'s linear-time form.
 *
 * §3.5 rules out `x = index * width` because it collapses on unbalanced trees —
 * exactly when the picture matters most. This produces non-overlapping
 * subtrees with each parent centred over its children, in one pass down and
 * one pass back up.
 *
 * The one deliberate departure: **a node with a single child gets a phantom
 * sibling on the empty side.** A plain tidy tree centres an only-child directly
 * under its parent, which draws a vertical edge and destroys the single most
 * important fact about a binary search tree — whether that child is the smaller
 * one or the larger one. The phantom occupies the missing slot, so the real
 * child visibly hangs left or right. It is never rendered.
 */
/**
 * A class rather than the plain object §9 would prefer, for one reason: the
 * algorithm's `ancestor` field starts out pointing at the node itself, and a
 * field initializer is the only way to write that without a type assertion or
 * a null sentinel that every read would then have to unwrap.
 */
class TidyNode {
  readonly children: TidyNode[] = []
  parent: TidyNode | null = null
  /** 1-based index among siblings, as the published algorithm indexes them. */
  number = 1
  prelim = 0
  mod = 0
  change = 0
  shift = 0
  ancestor: TidyNode = this
  thread: TidyNode | null = null
  x = 0
  y = 0

  /** null for a phantom, which reserves an empty slot and is never drawn. */
  constructor(readonly id: string | null) {}
}

function createNode(id: string | null): TidyNode {
  return new TidyNode(id)
}

interface ChildSlots {
  left?: string
  right?: string
  /** Children whose edge carried no left/right kind, in model order. */
  plain: string[]
}

export function tidyTree(model: VizModel): Layout {
  if (model.nodes.length === 0) return frame([], [])

  const byId = new Map(model.nodes.map((node) => [node.id, node]))
  const slots = new Map<string, ChildSlots>()
  const hasParent = new Set<string>()

  for (const edge of model.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue
    const entry = slots.get(edge.from) ?? { plain: [] }
    if (edge.kind === 'child-left') entry.left = edge.to
    else if (edge.kind === 'child-right') entry.right = edge.to
    else entry.plain.push(edge.to)
    slots.set(edge.from, entry)
    hasParent.add(edge.to)
  }

  const roots = model.nodes.filter((node) => !hasParent.has(node.id)).map((node) => node.id)
  // A cycle, or a model where every node has a parent, would otherwise recurse
  // forever. Fall back to laying every node out as its own root.
  const seeds = roots.length === 0 ? model.nodes.map((node) => node.id) : roots

  const visited = new Set<string>()
  const build = (id: string): TidyNode => {
    const node = createNode(id)
    if (visited.has(id)) return node
    visited.add(id)

    const entry = slots.get(id)
    if (entry !== undefined) {
      const { left, right, plain } = entry
      if (left !== undefined || right !== undefined) {
        // Binary: always fill both slots so the surviving child leans.
        if (left !== undefined && right !== undefined) {
          attach(node, build(left))
          attach(node, build(right))
        } else if (left !== undefined) {
          attach(node, build(left))
          attach(node, createNode(null))
        } else if (right !== undefined) {
          attach(node, createNode(null))
          attach(node, build(right))
        }
      }
      for (const child of plain) attach(node, build(child))
    }
    return node
  }

  // A single virtual root keeps a forest on one canvas without a second code
  // path; it is dropped before anything is drawn.
  const virtualRoot = createNode(null)
  for (const seed of seeds) attach(virtualRoot, build(seed))

  firstWalk(virtualRoot)
  secondWalk(virtualRoot, -virtualRoot.prelim, -1)

  const placements = new Map<string, Placement>()
  const nodes: LayoutNode[] = []
  const collect = (node: TidyNode): void => {
    if (node.id !== null) {
      const source = byId.get(node.id)
      if (source !== undefined) {
        placements.set(node.id, { x: node.x, y: node.y })
        nodes.push({
          id: source.id,
          label: source.label,
          x: node.x,
          y: node.y,
          radius: NODE_RADIUS,
          color: source.color,
          state: source.state,
          meta: source.meta,
        })
      }
    }
    for (const child of node.children) collect(child)
  }
  collect(virtualRoot)

  const edges = model.edges.flatMap((edge) => {
    const from = placements.get(edge.from)
    const to = placements.get(edge.to)
    if (from === undefined || to === undefined) return []
    return [routeEdge(edge, from, to)]
  })

  return frame(nodes, edges)
}

function attach(parent: TidyNode, child: TidyNode): void {
  child.parent = parent
  child.number = parent.children.length + 1
  parent.children.push(child)
}

// --- Buchheim et al. (2002), "Improving Walker's Algorithm to Run in Linear Time"

function firstWalk(v: TidyNode): void {
  if (v.children.length === 0) {
    const left = leftSibling(v)
    v.prelim = left === null ? 0 : left.prelim + SIBLING_SPACING
    return
  }

  let defaultAncestor = v.children[0]
  for (const child of v.children) {
    firstWalk(child)
    defaultAncestor = apportion(child, defaultAncestor)
  }
  executeShifts(v)

  const midpoint = (v.children[0].prelim + v.children[v.children.length - 1].prelim) / 2
  const left = leftSibling(v)
  if (left === null) {
    v.prelim = midpoint
  } else {
    v.prelim = left.prelim + SIBLING_SPACING
    v.mod = v.prelim - midpoint
  }
}

function secondWalk(v: TidyNode, modSum: number, depth: number): void {
  v.x = v.prelim + modSum
  v.y = depth * LEVEL_HEIGHT
  for (const child of v.children) secondWalk(child, modSum + v.mod, depth + 1)
}

/**
 * Push `v`'s subtree right until it clears everything to its left, walking the
 * inner contours of both. The threads are what make this linear rather than
 * quadratic: they let a walk continue past the bottom of a shallow subtree.
 */
function apportion(v: TidyNode, defaultAncestor: TidyNode): TidyNode {
  const leftBrother = leftSibling(v)
  if (leftBrother === null) return defaultAncestor

  let insideRight: TidyNode = v
  let outsideRight: TidyNode = v
  let insideLeft: TidyNode = leftBrother
  let outsideLeft: TidyNode | null = leftmostSibling(v)
  if (outsideLeft === null) return defaultAncestor

  let shiftInsideRight = v.mod
  let shiftOutsideRight = v.mod
  let shiftInsideLeft = insideLeft.mod
  let shiftOutsideLeft = outsideLeft.mod

  let ancestorResult = defaultAncestor

  for (;;) {
    const nextInsideLeft = nextRight(insideLeft)
    const nextInsideRight = nextLeft(insideRight)
    if (nextInsideLeft === null || nextInsideRight === null) break

    const nextOutsideLeft = nextLeft(outsideLeft)
    const nextOutsideRight = nextRight(outsideRight)
    if (nextOutsideLeft === null || nextOutsideRight === null) break

    insideLeft = nextInsideLeft
    insideRight = nextInsideRight
    outsideLeft = nextOutsideLeft
    outsideRight = nextOutsideRight
    outsideRight.ancestor = v

    const overlap =
      insideLeft.prelim +
      shiftInsideLeft -
      (insideRight.prelim + shiftInsideRight) +
      SIBLING_SPACING
    if (overlap > 0) {
      moveSubtree(ancestorOf(insideLeft, v, ancestorResult), v, overlap)
      shiftInsideRight += overlap
      shiftOutsideRight += overlap
    }

    shiftInsideLeft += insideLeft.mod
    shiftInsideRight += insideRight.mod
    shiftOutsideLeft += outsideLeft.mod
    shiftOutsideRight += outsideRight.mod
  }

  const trailingLeft = nextRight(insideLeft)
  if (trailingLeft !== null && nextRight(outsideRight) === null) {
    outsideRight.thread = trailingLeft
    outsideRight.mod += shiftInsideLeft - shiftOutsideRight
  }

  const trailingRight = nextLeft(insideRight)
  if (trailingRight !== null && nextLeft(outsideLeft) === null) {
    outsideLeft.thread = trailingRight
    outsideLeft.mod += shiftInsideRight - shiftOutsideLeft
    ancestorResult = v
  }

  return ancestorResult
}

function moveSubtree(from: TidyNode, to: TidyNode, shift: number): void {
  const subtrees = to.number - from.number
  if (subtrees === 0) return
  to.change -= shift / subtrees
  to.shift += shift
  from.change += shift / subtrees
  to.prelim += shift
  to.mod += shift
}

function executeShifts(v: TidyNode): void {
  let shift = 0
  let change = 0
  for (let index = v.children.length - 1; index >= 0; index -= 1) {
    const child = v.children[index]
    child.prelim += shift
    child.mod += shift
    change += child.change
    shift += child.shift + change
  }
}

function nextLeft(v: TidyNode): TidyNode | null {
  return v.children.length > 0 ? v.children[0] : v.thread
}

function nextRight(v: TidyNode): TidyNode | null {
  return v.children.length > 0 ? v.children[v.children.length - 1] : v.thread
}

function leftSibling(v: TidyNode): TidyNode | null {
  if (v.parent === null || v.number <= 1) return null
  return v.parent.children[v.number - 2]
}

function leftmostSibling(v: TidyNode): TidyNode | null {
  if (v.parent === null) return null
  const first = v.parent.children[0]
  return first === v ? null : first
}

function ancestorOf(insideLeft: TidyNode, v: TidyNode, defaultAncestor: TidyNode): TidyNode {
  if (v.parent !== null && v.parent.children.includes(insideLeft.ancestor)) {
    return insideLeft.ancestor
  }
  return defaultAncestor
}
