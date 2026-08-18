import type { NodeColor, NodeState, VizModel } from '../core/model'
import type { VizEvent } from './events'

/**
 * Turns a stream of `VizEvent`s into the paint layer on top of a `VizModel`.
 *
 * `core/` serializes structure and nothing else; execution state lives here.
 * That split is what makes `colorMode: 'structure'` and `colorMode: 'state'`
 * (§2) two views of the same model rather than two models.
 *
 * How long each kind of paint lasts is a judgement call, so it is written down:
 *
 * - **visiting** — one node at a time. A second `visit` moves it, and leaves a
 *   `traversing` edge behind, which is the trail §3.4 asks for.
 * - **compared** / **swapped** — the most recent pair only. These mark a moment,
 *   and keeping every past comparison lit would end with the whole structure
 *   highlighted and nothing readable.
 * - **colour** and **marks** — persistent, because they record a fact about the
 *   node (a red-black colour, a `pivot` badge) rather than a moment.
 */
export class Overlay {
  private visiting: string | null = null
  private compared: readonly [string, string] | null = null
  private swapped: readonly [string, string] | null = null
  private readonly colors = new Map<string, NodeColor>()
  private readonly marks = new Map<string, string>()
  /** Unordered node pairs that the traversal has walked between. */
  private readonly trail = new Set<string>()

  apply(event: VizEvent): void {
    switch (event.type) {
      case 'visit': {
        if (this.visiting !== null && this.visiting !== event.nodeId) {
          this.trail.add(pairKey(this.visiting, event.nodeId))
        }
        this.visiting = event.nodeId
        return
      }
      case 'compare':
        this.compared = [event.a, event.b]
        return
      case 'swap':
        this.swapped = [event.a, event.b]
        return
      case 'set-color':
        this.colors.set(event.nodeId, event.color)
        return
      case 'mark':
        if (event.label === null) this.marks.delete(event.nodeId)
        else this.marks.set(event.nodeId, event.label)
        return
      case 'log':
        return
    }
  }

  /** Applies the current paint to a freshly serialized model. */
  decorate(model: VizModel): VizModel {
    return {
      // Spread rather than listing the fields: this only paints nodes and
      // edges, and anything else the structure declared about itself has to
      // survive the trip untouched.
      ...model,
      nodes: model.nodes.map((node) => {
        const state = this.stateOf(node.id)
        const color = this.colors.get(node.id) ?? node.color
        const mark = this.marks.get(node.id)
        return {
          ...node,
          ...(state === undefined ? {} : { state }),
          ...(color === undefined ? {} : { color }),
          ...(mark === undefined ? {} : { meta: { ...node.meta, mark } }),
        }
      }),
      edges: model.edges.map((edge) => {
        // The edge into the node being visited right now is the live one; the
        // rest of the trail is history.
        const live =
          this.visiting !== null && (edge.from === this.visiting || edge.to === this.visiting)
        if (live && this.trail.has(pairKey(edge.from, edge.to))) {
          return { ...edge, state: 'active' }
        }
        if (this.trail.has(pairKey(edge.from, edge.to))) return { ...edge, state: 'traversing' }
        return edge
      }),
    }
  }

  private stateOf(id: string): NodeState | undefined {
    // Most recent action wins: a node that was just swapped should read as
    // swapped even if it is also the one being visited.
    if (this.swapped !== null && (this.swapped[0] === id || this.swapped[1] === id))
      return 'swapped'
    if (this.compared !== null && (this.compared[0] === id || this.compared[1] === id)) {
      return 'compared'
    }
    if (this.visiting === id) return 'visiting'
    return undefined
  }
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
