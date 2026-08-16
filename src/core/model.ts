/**
 * The normalized shape every structure serializes to (CLAUDE.md §3.1).
 *
 * Layout and rendering only ever see this. A structure's internal
 * representation — an array of cells, a chain of nodes, a tree — never leaves
 * `core/`.
 */

/**
 * CLAUDE.md §3.1 writes this as `'red' | 'black' | string`, which TypeScript
 * collapses to plain `string`: the two meaningful values stop being suggested
 * and stop being checked. `(string & {})` keeps the union open for a custom
 * palette while preserving both.
 */
export type NodeColor = 'red' | 'black' | (string & {})

/** Execution state, overlaid by the bridge; `core/` always serializes `idle`. */
export type NodeState = 'idle' | 'visiting' | 'compared' | 'swapped' | 'found' | 'removed'

export type EdgeKind = 'child-left' | 'child-right' | 'next' | 'prev' | 'parent' | 'weighted'

export type EdgeState = 'idle' | 'traversing' | 'active'

export interface VizNode {
  /** Stable across mutations — every animation depends on this. */
  readonly id: string
  readonly label: string
  readonly color?: NodeColor
  readonly state?: NodeState
  readonly meta?: Record<string, unknown>
}

export interface VizEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind?: EdgeKind
  readonly label?: string
  readonly state?: EdgeState
}

export interface VizModel {
  readonly nodes: readonly VizNode[]
  readonly edges: readonly VizEdge[]
  readonly layoutHint: 'tree' | 'chain' | 'row' | 'graph'
}

/** The values a structure can hold. Ordered structures need them comparable. */
export type Cell = number | string

/**
 * Ordering for `Cell`. Numbers compare numerically and strings
 * lexicographically; a mixed comparison falls back to string order rather than
 * producing the silent nonsense `1 < 'a' === false && 1 > 'a' === false`.
 */
export function compare(a: Cell, b: Cell): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  const left = String(a)
  const right = String(b)
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * Sequential, per-structure node ids.
 *
 * Deterministic on purpose: the same operations on a fresh structure always
 * produce the same ids, which is what lets layout be a pure function of the
 * model (§6.4) and lets a golden test assert on ids at all. A random or
 * time-based id would make both untestable.
 */
export class IdFactory {
  private next = 1

  constructor(private readonly prefix: string) {}

  create(): string {
    const id = `${this.prefix}${this.next}`
    this.next += 1
    return id
  }
}

/**
 * An edge's id comes from its *parent and slot*, not from the pair of endpoints.
 *
 * A rotation rewires which child sits in a slot. Keying on the endpoints would
 * destroy one edge and create another, so the renderer would fade a line out
 * and a new one in; keying on the slot keeps one edge whose endpoint moves,
 * which is what a rotation actually looks like.
 */
export function edgeId(fromId: string, slot: string): string {
  return `${fromId}:${slot}`
}
