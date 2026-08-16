import { edgeId, IdFactory, type Cell, type VizEdge, type VizModel, type VizNode } from './model'

interface ListNode {
  readonly id: string
  value: Cell
  next: ListNode | null
}

/**
 * A singly linked list, drawn as a chain.
 *
 * Every operation is pointer surgery on nodes that already exist, so a node
 * keeps its id for its whole life. Removing from the middle relinks its
 * neighbours rather than rebuilding the tail, which is what makes the
 * animation read as one node leaving rather than the list flickering.
 */
export class LinkedList {
  private readonly ids = new IdFactory('l')
  private head: ListNode | null = null
  private count = 0

  constructor(initial: readonly Cell[] = []) {
    for (const value of initial) this.push(value)
  }

  get length(): number {
    return this.count
  }

  toArray(): Cell[] {
    const values: Cell[] = []
    for (let node = this.head; node !== null; node = node.next) values.push(node.value)
    return values
  }

  /** The stable id of the node at `index`, for tests and for the bridge. */
  idAt(index: number): string | undefined {
    return this.nodeAt(index)?.id
  }

  get(index: number): Cell | undefined {
    return this.nodeAt(index)?.value
  }

  /** Appends to the tail. O(n) — the list has no tail pointer, by design. */
  push(value: Cell): void {
    const node: ListNode = { id: this.ids.create(), value, next: null }
    this.count += 1
    if (this.head === null) {
      this.head = node
      return
    }
    let current = this.head
    while (current.next !== null) current = current.next
    current.next = node
  }

  unshift(value: Cell): void {
    this.head = { id: this.ids.create(), value, next: this.head }
    this.count += 1
  }

  insertAt(index: number, value: Cell): void {
    if (index < 0 || index > this.count) {
      throw new RangeError(`Cannot insert at index ${index} of a length-${this.count} list.`)
    }
    if (index === 0) {
      this.unshift(value)
      return
    }
    const previous = this.nodeAt(index - 1)
    if (previous === null) throw new RangeError(`No node before index ${index}.`)
    previous.next = { id: this.ids.create(), value, next: previous.next }
    this.count += 1
  }

  removeAt(index: number): Cell | undefined {
    if (index < 0 || index >= this.count) return undefined
    if (index === 0) {
      const removed = this.head
      if (removed === null) return undefined
      this.head = removed.next
      this.count -= 1
      return removed.value
    }
    const previous = this.nodeAt(index - 1)
    const removed = previous === null ? null : previous.next
    if (previous === null || removed === null) return undefined
    previous.next = removed.next
    this.count -= 1
    return removed.value
  }

  /** Removes the first node holding `value`. Returns whether it found one. */
  remove(value: Cell): boolean {
    const index = this.indexOf(value)
    if (index === -1) return false
    this.removeAt(index)
    return true
  }

  indexOf(value: Cell): number {
    let index = 0
    for (let node = this.head; node !== null; node = node.next) {
      if (node.value === value) return index
      index += 1
    }
    return -1
  }

  /** Reverses the links in place. Ids stay put, so nodes visibly travel. */
  reverse(): void {
    let previous: ListNode | null = null
    let current = this.head
    while (current !== null) {
      const next: ListNode | null = current.next
      current.next = previous
      previous = current
      current = next
    }
    this.head = previous
  }

  private nodeAt(index: number): ListNode | null {
    if (index < 0) return null
    let current = this.head
    for (let i = 0; i < index && current !== null; i += 1) current = current.next
    return current
  }

  toVizModel(): VizModel {
    const nodes: VizNode[] = []
    const edges: VizEdge[] = []
    let position = 0
    for (let node = this.head; node !== null; node = node.next) {
      nodes.push({ id: node.id, label: String(node.value), meta: { index: position } })
      if (node.next !== null) {
        edges.push({
          id: edgeId(node.id, 'next'),
          from: node.id,
          to: node.next.id,
          kind: 'next',
        })
      }
      position += 1
    }
    return { nodes, edges, layoutHint: 'chain' }
  }
}
