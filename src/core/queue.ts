import { ArrayStructure } from './arrayStructure'
import type { Cell, VizModel } from './model'

/**
 * A queue, drawn as a row with both ends marked.
 *
 * Values join at the back and leave from the front, which is the one fact that
 * separates it from a stack — so both ends are labelled rather than just one.
 */
export class Queue {
  private readonly cells: ArrayStructure

  constructor(initial: readonly Cell[] = []) {
    this.cells = new ArrayStructure(initial, 'q')
  }

  get size(): number {
    return this.cells.length
  }

  isEmpty(): boolean {
    return this.cells.length === 0
  }

  /** The value at the front, without removing it. */
  peek(): Cell | undefined {
    return this.cells.get(0)
  }

  enqueue(value: Cell): number {
    return this.cells.push(value)
  }

  dequeue(): Cell | undefined {
    return this.cells.shift()
  }

  idAt(index: number): string | undefined {
    return this.cells.idAt(index)
  }

  toArray(): Cell[] {
    return this.cells.values()
  }

  toVizModel(): VizModel {
    const model = this.cells.toVizModel()
    const back = model.nodes.length - 1
    return {
      ...model,
      nodes: model.nodes.map((node, index) => ({
        ...node,
        meta: {
          ...node.meta,
          role: index === 0 ? 'front' : index === back ? 'back' : undefined,
        },
      })),
    }
  }
}
