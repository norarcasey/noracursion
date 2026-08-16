import { IdFactory, type Cell, type VizModel, type VizNode } from './model'

interface ArrayCell {
  readonly id: string
  value: Cell
}

/**
 * A flat array, drawn as a row of indexed cells.
 *
 * **Ids follow elements, not positions.** `swap(0, 2)` moves the cell objects,
 * so the two nodes keep their ids and exchange places. Keyed on position
 * instead, a sort would be a sequence of labels blinking to new values in
 * stationary boxes — which is precisely the thing an animated sort is supposed
 * to show. This is the array's version of the rule in §3.1 that a rotation
 * moves nodes rather than recreating them.
 */
export class ArrayStructure {
  private readonly ids = new IdFactory('a')
  private cells: ArrayCell[]

  constructor(initial: readonly Cell[] = []) {
    this.cells = initial.map((value) => ({ id: this.ids.create(), value }))
  }

  get length(): number {
    return this.cells.length
  }

  values(): Cell[] {
    return this.cells.map((cell) => cell.value)
  }

  /** The stable id of the element currently at `index`. */
  idAt(index: number): string | undefined {
    return this.cells[index]?.id
  }

  get(index: number): Cell | undefined {
    return this.cells[index]?.value
  }

  /** Replaces the value in place; the cell — and so the node — keeps its id. */
  set(index: number, value: Cell): void {
    const cell = this.cells[index]
    if (cell === undefined) throw new RangeError(`No element at index ${index}.`)
    cell.value = value
  }

  push(value: Cell): number {
    this.cells.push({ id: this.ids.create(), value })
    return this.cells.length
  }

  pop(): Cell | undefined {
    return this.cells.pop()?.value
  }

  unshift(value: Cell): number {
    this.cells.unshift({ id: this.ids.create(), value })
    return this.cells.length
  }

  shift(): Cell | undefined {
    return this.cells.shift()?.value
  }

  insertAt(index: number, value: Cell): void {
    if (index < 0 || index > this.cells.length) {
      throw new RangeError(
        `Cannot insert at index ${index} of a length-${this.cells.length} array.`,
      )
    }
    this.cells.splice(index, 0, { id: this.ids.create(), value })
  }

  removeAt(index: number): Cell | undefined {
    if (index < 0 || index >= this.cells.length) return undefined
    return this.cells.splice(index, 1)[0].value
  }

  indexOf(value: Cell): number {
    return this.cells.findIndex((cell) => cell.value === value)
  }

  /** Exchanges two elements, carrying their ids with them. */
  swap(i: number, j: number): void {
    const first = this.cells[i]
    const second = this.cells[j]
    if (first === undefined || second === undefined) {
      throw new RangeError(`Cannot swap ${i} and ${j} in a length-${this.cells.length} array.`)
    }
    this.cells[i] = second
    this.cells[j] = first
  }

  toVizModel(): VizModel {
    const nodes: VizNode[] = this.cells.map((cell, index) => ({
      id: cell.id,
      label: String(cell.value),
      meta: { index },
    }))
    // A row has no edges: adjacency is carried by position.
    return { nodes, edges: [], layoutHint: 'row' }
  }
}
