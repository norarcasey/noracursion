import { edgeId, IdFactory, type Cell, type VizEdge, type VizModel, type VizNode } from './model'

interface DListNode {
  readonly id: string
  value: Cell
  next: DListNode | null
  prev: DListNode | null
}

/**
 * A doubly linked list.
 *
 * Serializes both directions, so the picture shows what the structure actually
 * costs: every insertion and removal has two links to mend, not one. The
 * backward edges are drawn in their own lane by the chain layout, because two
 * edges between the same pair of nodes would otherwise land on top of each
 * other and look like one.
 */
export class DoublyLinkedList {
  private readonly ids = new IdFactory('d')
  private head: DListNode | null = null
  private tail: DListNode | null = null
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

  /** Walking back from the tail, which is the thing this structure can do. */
  toArrayReversed(): Cell[] {
    const values: Cell[] = []
    for (let node = this.tail; node !== null; node = node.prev) values.push(node.value)
    return values
  }

  idAt(index: number): string | undefined {
    return this.nodeAt(index)?.id
  }

  get(index: number): Cell | undefined {
    return this.nodeAt(index)?.value
  }

  indexOf(value: Cell): number {
    let index = 0
    for (let node = this.head; node !== null; node = node.next) {
      if (node.value === value) return index
      index += 1
    }
    return -1
  }

  push(value: Cell): void {
    const node: DListNode = { id: this.ids.create(), value, next: null, prev: this.tail }
    if (this.tail === null) this.head = node
    else this.tail.next = node
    this.tail = node
    this.count += 1
  }

  unshift(value: Cell): void {
    const node: DListNode = { id: this.ids.create(), value, next: this.head, prev: null }
    if (this.head === null) this.tail = node
    else this.head.prev = node
    this.head = node
    this.count += 1
  }

  insertAt(index: number, value: Cell): void {
    if (index < 0 || index > this.count) {
      throw new RangeError(`Cannot insert at index ${index} of a length-${this.count} list.`)
    }
    if (index === 0) return this.unshift(value)
    if (index === this.count) return this.push(value)
    const after = this.nodeAt(index)
    if (after === null) throw new RangeError(`No node at index ${index}.`)
    const before = after.prev
    if (before === null) throw new RangeError(`No node before index ${index}.`)
    const node: DListNode = { id: this.ids.create(), value, next: after, prev: before }
    before.next = node
    after.prev = node
    this.count += 1
  }

  removeAt(index: number): Cell | undefined {
    const node = this.nodeAt(index)
    if (node === null) return undefined
    if (node.prev === null) this.head = node.next
    else node.prev.next = node.next
    if (node.next === null) this.tail = node.prev
    else node.next.prev = node.prev
    this.count -= 1
    return node.value
  }

  remove(value: Cell): boolean {
    const index = this.indexOf(value)
    if (index === -1) return false
    this.removeAt(index)
    return true
  }

  private nodeAt(index: number): DListNode | null {
    if (index < 0 || index >= this.count) return null
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
        edges.push({
          id: edgeId(node.next.id, 'prev'),
          from: node.next.id,
          to: node.id,
          kind: 'prev',
        })
      }
      position += 1
    }
    return { nodes, edges, layoutHint: 'chain' }
  }
}
