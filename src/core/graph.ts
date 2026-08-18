import {
  compare,
  edgeId,
  IdFactory,
  type Cell,
  type VizEdge,
  type VizModel,
  type VizNode,
} from './model'
import { isNodeSeed, type NodeSeed, type SeedData } from '../types'

interface GraphNode {
  readonly id: string
  readonly label: Cell
  readonly x: number
  readonly y: number
}

interface GraphEdge {
  readonly from: Cell
  readonly to: Cell
  readonly weight: number
}

/** Radius of the ring plain values are arranged on. */
const RING_RADIUS = 110

/**
 * An undirected weighted graph, positioned by the author.
 *
 * §3.5 makes v1 graphs author-positioned and forbids a layout that jitters
 * between renders, so coordinates come in with the data rather than being
 * computed. When a consumer passes plain values instead of `NodeSeed`s there
 * are no coordinates and no edges to work with, so they are arranged in a ring
 * and joined into a cycle — a real graph, placed by a formula that depends only
 * on how many nodes there are, so it is as stable as coordinates would be.
 */
export class Graph {
  private readonly ids = new IdFactory('g')
  private readonly nodes: GraphNode[] = []
  private readonly byLabel = new Map<string, GraphNode>()
  private readonly edges: GraphEdge[] = []

  constructor(seed: SeedData = []) {
    const seeds = seed.every(isNodeSeed) && seed.length > 0 ? seed : ring(seed)
    for (const entry of seeds) {
      const label = entry.label
      const key = String(label)
      if (this.byLabel.has(key)) continue
      const node = { id: this.ids.create(), label, x: entry.x, y: entry.y }
      this.nodes.push(node)
      this.byLabel.set(key, node)
    }
    for (const entry of seeds) {
      for (const edge of entry.edges ?? []) {
        this.connect(entry.label, edge.to, edge.weight ?? 1)
      }
    }
  }

  get size(): number {
    return this.nodes.length
  }

  labels(): Cell[] {
    return this.nodes.map((node) => node.label)
  }

  idOf(label: Cell): string | undefined {
    return this.byLabel.get(String(label))?.id
  }

  has(label: Cell): boolean {
    return this.byLabel.has(String(label))
  }

  /** Neighbours in a stable order, so a traversal is reproducible. */
  neighbors(label: Cell): Cell[] {
    const key = String(label)
    const found: Cell[] = []
    for (const edge of this.edges) {
      if (String(edge.from) === key) found.push(edge.to)
      else if (String(edge.to) === key) found.push(edge.from)
    }
    return found.sort(compare)
  }

  /** The weight between two nodes, or null when they are not joined. */
  weight(a: Cell, b: Cell): number | null {
    const [x, y] = [String(a), String(b)]
    for (const edge of this.edges) {
      const [from, to] = [String(edge.from), String(edge.to)]
      if ((from === x && to === y) || (from === y && to === x)) return edge.weight
    }
    return null
  }

  connect(a: Cell, b: Cell, weight = 1): void {
    if (!this.has(a) || !this.has(b)) {
      throw new Error(`Cannot join ${String(a)} to ${String(b)}: one of them is not in the graph.`)
    }
    if (this.weight(a, b) !== null) return
    this.edges.push({ from: a, to: b, weight })
  }

  toVizModel(): VizModel {
    const nodes: VizNode[] = this.nodes.map((node) => ({
      id: node.id,
      label: String(node.label),
      meta: { x: node.x, y: node.y },
    }))

    const edges: VizEdge[] = []
    for (const edge of this.edges) {
      const from = this.byLabel.get(String(edge.from))
      const to = this.byLabel.get(String(edge.to))
      if (from === undefined || to === undefined) continue
      edges.push({
        id: edgeId(from.id, `to:${to.id}`),
        from: from.id,
        to: to.id,
        kind: 'weighted',
        // Unit weights are the absence of weighting, and labelling every edge
        // "1" is noise that hides the ones that matter.
        label: edge.weight === 1 ? undefined : String(edge.weight),
      })
    }

    return { nodes, edges, layoutHint: 'graph' }
  }
}

/**
 * Plain values, arranged on a circle and joined into a cycle. Depends only on
 * the count and the order, so it is deterministic — the property §3.5 actually
 * cares about.
 */
function ring(values: SeedData): NodeSeed[] {
  const labels = values.map((value) => (isNodeSeed(value) ? value.label : value))
  return labels.map((label, index) => {
    const angle = (index / Math.max(1, labels.length)) * Math.PI * 2 - Math.PI / 2
    return {
      label,
      x: Math.round(Math.cos(angle) * RING_RADIUS * 1000) / 1000,
      y: Math.round(Math.sin(angle) * RING_RADIUS * 1000) / 1000,
      edges: labels.length < 2 ? [] : [{ to: labels[(index + 1) % labels.length] }],
    }
  })
}
