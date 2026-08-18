import { ArrayStructure } from './arrayStructure'
import type { Cell, VizModel } from './model'

/**
 * A stack, drawn as a row with its top end marked.
 *
 * Built on `ArrayStructure` because that is what a stack is — the difference is
 * the discipline, not the storage. Pushing and popping happen at the right-hand
 * end, so the top is where new work appears and where it leaves from, and the
 * marked end is the only thing distinguishing the picture from an array's.
 */
export class Stack {
  private readonly cells: ArrayStructure

  constructor(initial: readonly Cell[] = []) {
    this.cells = new ArrayStructure(initial, 's')
  }

  get size(): number {
    return this.cells.length
  }

  isEmpty(): boolean {
    return this.cells.length === 0
  }

  /** The value on top, without removing it. */
  peek(): Cell | undefined {
    return this.cells.get(this.cells.length - 1)
  }

  push(value: Cell): number {
    return this.cells.push(value)
  }

  pop(): Cell | undefined {
    return this.cells.pop()
  }

  idAt(index: number): string | undefined {
    return this.cells.idAt(index)
  }

  toArray(): Cell[] {
    return this.cells.values()
  }

  toVizModel(): VizModel {
    const model = this.cells.toVizModel()
    const top = model.nodes.length - 1
    return {
      ...model,
      nodes: model.nodes.map((node, index) => ({
        ...node,
        meta: { ...node.meta, role: index === top ? 'top' : undefined },
      })),
    }
  }
}
