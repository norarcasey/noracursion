import { ArrayStructure } from './arrayStructure'
import { compare, edgeId, type Cell, type VizEdge, type VizModel, type VizNode } from './model'

export type HeapKind = 'min' | 'max'

/**
 * A binary heap, stored as an array and drawn as a tree.
 *
 * CLAUDE.md §3.5 files heaps under the `row` layout, as heaps-as-arrays. This
 * draws them as a tree instead, because every heap operation is about the
 * parent-child relationship — sift up compares a node with its parent, sift
 * down with its children — and a row is the one shape that hides exactly that.
 * The array indices are still captioned under each node, so the arithmetic the
 * snippets do (`(i - 1) / 2`, `2i + 1`) stays visible; the tree is drawn *from*
 * those indices, which is the point being taught.
 */
export class BinaryHeap {
  private readonly cells: ArrayStructure

  constructor(
    initial: readonly Cell[] = [],
    readonly kind: HeapKind = 'min',
  ) {
    this.cells = new ArrayStructure([], kind === 'min' ? 'h' : 'x')
    // Built by repeated insertion so the initial heap is a real one, whatever
    // order the consumer supplied.
    for (const value of initial) this.push(value)
  }

  get size(): number {
    return this.cells.length
  }

  peek(): Cell | undefined {
    return this.cells.get(0)
  }

  get(index: number): Cell | undefined {
    return this.cells.get(index)
  }

  idAt(index: number): string | undefined {
    return this.cells.idAt(index)
  }

  values(): Cell[] {
    return this.cells.values()
  }

  /** Appends without restoring the heap property — the snippet sifts. */
  append(value: Cell): number {
    return this.cells.push(value)
  }

  /** Removes the last cell without restoring the heap property. */
  removeLast(): Cell | undefined {
    return this.cells.pop()
  }

  swap(i: number, j: number): void {
    this.cells.swap(i, j)
  }

  /** Insert with the sift built in, for building the initial heap. */
  push(value: Cell): void {
    this.cells.push(value)
    let index = this.cells.length - 1
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (!this.outOfOrder(index, parent)) break
      this.cells.swap(index, parent)
      index = parent
    }
  }

  /** Remove the root with the sift built in. */
  pop(): Cell | undefined {
    if (this.cells.length === 0) return undefined
    this.cells.swap(0, this.cells.length - 1)
    const removed = this.cells.pop()
    let index = 0
    for (;;) {
      const left = index * 2 + 1
      const right = index * 2 + 2
      let best = index
      if (left < this.cells.length && this.outOfOrder(left, best)) best = left
      if (right < this.cells.length && this.outOfOrder(right, best)) best = right
      if (best === index) break
      this.cells.swap(index, best)
      index = best
    }
    return removed
  }

  /** True when `child` ought to sit above `parent` for this heap's kind. */
  private outOfOrder(child: number, parent: number): boolean {
    const a = this.cells.get(child)
    const b = this.cells.get(parent)
    if (a === undefined || b === undefined) return false
    const order = compare(a, b)
    return this.kind === 'min' ? order < 0 : order > 0
  }

  /** True when the heap property holds everywhere. Tests assert on this. */
  isValid(): boolean {
    for (let index = 1; index < this.cells.length; index += 1) {
      if (this.outOfOrder(index, Math.floor((index - 1) / 2))) return false
    }
    return true
  }

  toVizModel(): VizModel {
    const nodes: VizNode[] = []
    const edges: VizEdge[] = []

    this.cells.values().forEach((value, index) => {
      const id = this.cells.idAt(index)
      if (id === undefined) return
      nodes.push({
        id,
        label: String(value),
        meta: { index, depth: Math.floor(Math.log2(index + 1)) },
      })

      // The tree is derived from the indices, not stored alongside them —
      // which is the fact the whole structure rests on.
      for (const [childIndex, slot, kind] of [
        [index * 2 + 1, 'left', 'child-left'],
        [index * 2 + 2, 'right', 'child-right'],
      ] as const) {
        const childId = this.cells.idAt(childIndex)
        if (childId === undefined) continue
        edges.push({ id: edgeId(id, slot), from: id, to: childId, kind })
      }
    })

    return { nodes, edges, layoutHint: 'tree', indexLabels: true }
  }
}
