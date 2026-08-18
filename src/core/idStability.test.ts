import { describe, expect, it } from 'vitest'
import { ArrayStructure } from './arrayStructure'
import { LinkedList } from './linkedList'
import type { VizModel } from './model'
import { DoublyLinkedList } from './doublyLinkedList'
import { Queue } from './queue'
import { RedBlackTree } from './redBlackTree'
import { Stack } from './stack'
import { BinarySearchTree } from './tree'

/**
 * Node id stability (CLAUDE.md §6.3).
 *
 * If ids churn, every animation becomes a flicker: the renderer keys motion on
 * the id, so an id that changes reads as one node being destroyed and a
 * different one appearing, rather than as a node moving. These tests are the
 * guard on that, and they matter most for the operations that *rearrange*
 * structure — rotations and deletions — because that is exactly when a naive
 * implementation rebuilds nodes.
 */

/** id → label, which is the binding that has to survive a mutation. */
function labelsById(model: VizModel): Map<string, string> {
  return new Map(model.nodes.map((node) => [node.id, node.label]))
}

function edgesById(model: VizModel): Map<string, string> {
  return new Map(model.edges.map((edge) => [edge.id, `${edge.from}->${edge.to}`]))
}

/** Asserts a lookup found a node, and narrows the id. A miss is a test bug. */
function nodeId(value: string | undefined): string {
  if (value === undefined) throw new Error('expected the structure to contain that value')
  return value
}

describe('binary search tree', () => {
  it('leaves existing node ids alone when inserting', () => {
    const tree = new BinarySearchTree([5, 3, 8])
    const before = labelsById(tree.toVizModel())

    tree.insert(7)
    tree.insert(1)
    const after = labelsById(tree.toVizModel())

    for (const [id, label] of before) {
      expect(after.get(id)).toBe(label)
    }
    expect(after.size).toBe(before.size + 2)
  })

  it('preserves every id through a rotation, rewiring only the edges', () => {
    const tree = new BinarySearchTree([5, 3, 8, 7, 9])
    const beforeNodes = labelsById(tree.toVizModel())
    const beforeEdges = edgesById(tree.toVizModel())
    const rootId = nodeId(tree.idOf(5))
    const pivotId = nodeId(tree.idOf(8))

    expect(tree.rotateLeft(5)).toBe(true)

    const afterNodes = labelsById(tree.toVizModel())
    // Same nodes, same labels, same ids — nothing was recreated.
    expect(afterNodes).toEqual(beforeNodes)
    // A rotation must not disturb the ordering it exists to preserve.
    expect(tree.inOrder()).toEqual([3, 5, 7, 8, 9])

    const afterEdges = edgesById(tree.toVizModel())
    expect(afterEdges).not.toEqual(beforeEdges)
    // The edge id is the parent's slot, so 5's right edge survives and simply
    // points somewhere new — the renderer animates one line instead of
    // crossfading two.
    expect(beforeEdges.get(`${rootId}:right`)).toBe(`${rootId}->${pivotId}`)
    expect(afterEdges.get(`${rootId}:right`)).toBe(`${rootId}->${tree.idOf(7)}`)
    expect(afterEdges.get(`${pivotId}:left`)).toBe(`${pivotId}->${rootId}`)
  })

  it('moves the successor rather than copying its value when deleting', () => {
    const tree = new BinarySearchTree([5, 3, 8, 7, 9])
    const successorId = nodeId(tree.idOf(7))
    const removedId = nodeId(tree.idOf(5))
    const untouchedId = nodeId(tree.idOf(3))

    expect(tree.remove(5)).toBe(true)

    // The successor is the same node it always was: same id, same value.
    expect(tree.idOf(7)).toBe(successorId)
    expect(tree.inOrder()).toEqual([3, 7, 8, 9])
    expect(tree.size).toBe(4)

    const after = labelsById(tree.toVizModel())
    expect(after.get(successorId)).toBe('7')
    expect(after.has(removedId)).toBe(false)
    expect(after.get(untouchedId)).toBe('3')
  })

  it('keeps ids across a leaf and a single-child deletion', () => {
    const tree = new BinarySearchTree([5, 3, 8, 9])
    const keep = [tree.idOf(5), tree.idOf(8), tree.idOf(9)]

    tree.remove(3) // leaf
    expect(tree.idOf(5)).toBe(keep[0])

    tree.remove(8) // one child
    expect(tree.idOf(9)).toBe(keep[2])
    expect(tree.inOrder()).toEqual([5, 9])
  })
})

describe('array', () => {
  it('carries ids with the elements through a swap', () => {
    const array = new ArrayStructure([10, 20, 30])
    const first = array.idAt(0)
    const last = array.idAt(2)

    array.swap(0, 2)

    // The nodes exchanged places; they were not relabelled in place. This is
    // what makes a sort read as elements moving.
    expect(array.values()).toEqual([30, 20, 10])
    expect(array.idAt(0)).toBe(last)
    expect(array.idAt(2)).toBe(first)
  })

  it('keeps the id when a cell is assigned a new value', () => {
    const array = new ArrayStructure([1, 2])
    const id = array.idAt(1)
    array.set(1, 99)
    expect(array.idAt(1)).toBe(id)
    expect(array.get(1)).toBe(99)
  })

  it('leaves neighbouring ids alone when splicing', () => {
    const array = new ArrayStructure([1, 2, 3])
    const third = array.idAt(2)
    array.insertAt(0, 0)
    expect(array.idAt(3)).toBe(third)
    array.removeAt(0)
    expect(array.idAt(2)).toBe(third)
  })
})

describe('linked list', () => {
  it('keeps every remaining id when a middle node is removed', () => {
    const list = new LinkedList(['a', 'b', 'c'])
    const first = list.idAt(0)
    const last = list.idAt(2)

    expect(list.removeAt(1)).toBe('b')

    expect(list.toArray()).toEqual(['a', 'c'])
    expect(list.idAt(0)).toBe(first)
    expect(list.idAt(1)).toBe(last)
  })

  it('keeps every id through a reversal', () => {
    const list = new LinkedList([1, 2, 3])
    const before = labelsById(list.toVizModel())

    list.reverse()

    expect(list.toArray()).toEqual([3, 2, 1])
    expect(labelsById(list.toVizModel())).toEqual(before)
  })
})

describe('determinism', () => {
  it('gives the same ids to the same sequence of operations', () => {
    // Layout purity (§6.4) needs this: the same model in has to mean the same
    // positions out, and a random or time-seeded id would break that before
    // layout even ran.
    const build = (): VizModel => {
      const tree = new BinarySearchTree([5, 3, 8])
      tree.insert(7)
      tree.remove(3)
      return tree.toVizModel()
    }
    expect(build()).toEqual(build())
  })

  it('does not reuse an id after the node holding it is removed', () => {
    const array = new ArrayStructure([1])
    const first = array.idAt(0)
    array.removeAt(0)
    array.push(2)
    expect(array.idAt(0)).not.toBe(first)
  })
})

describe('red-black tree', () => {
  it('keeps every id through the rotations a rebalance performs', () => {
    // The marquee case §6.3 was written for. Inserting into a right-leaning run
    // forces rotations, and none of them may recreate a node.
    const tree = new RedBlackTree([10, 20, 30])
    const before = labelsById(tree.toVizModel())

    tree.insert(40)
    tree.insert(50)

    const after = labelsById(tree.toVizModel())
    for (const [id, label] of before) {
      expect(after.get(id)).toBe(label)
    }
    expect(after.size).toBe(before.size + 2)
    expect(tree.inOrder()).toEqual([10, 20, 30, 40, 50])
  })

  it('rotates without recreating anything, and without disturbing the order', () => {
    const tree = new RedBlackTree([10, 5, 20, 15, 25])
    const before = labelsById(tree.toVizModel())
    const rootValue = tree.rootValue()
    if (rootValue === null) throw new Error('empty tree')

    expect(tree.rotateLeft(rootValue)).toBe(true)

    expect(labelsById(tree.toVizModel())).toEqual(before)
    expect(tree.inOrder()).toEqual([5, 10, 15, 20, 25])
  })

  it('serializes a colour on every node, since the colour is the mnemonic', () => {
    const model = new RedBlackTree([10, 20, 30, 40]).toVizModel()
    expect(model.nodes.every((node) => node.color === 'red' || node.color === 'black')).toBe(true)
    expect(model.nodes[0].color).toBe('black')
  })
})

describe('stack, queue and doubly linked list', () => {
  it('a stack keeps ids as it grows and shrinks', () => {
    const stack = new Stack([1, 2])
    const bottom = stack.idAt(0)
    stack.push(3)
    expect(stack.idAt(0)).toBe(bottom)
    stack.pop()
    expect(stack.idAt(0)).toBe(bottom)
    expect(stack.toArray()).toEqual([1, 2])
  })

  it('a queue keeps the ids of what is still waiting', () => {
    const queue = new Queue([1, 2, 3])
    const second = queue.idAt(1)
    expect(queue.dequeue()).toBe(1)
    // What was second is now at the front, and it is the same node.
    expect(queue.idAt(0)).toBe(second)
  })

  it('a doubly linked list keeps ids when a middle node is unlinked', () => {
    const list = new DoublyLinkedList(['a', 'b', 'c'])
    const first = list.idAt(0)
    const last = list.idAt(2)
    expect(list.removeAt(1)).toBe('b')
    expect(list.idAt(0)).toBe(first)
    expect(list.idAt(1)).toBe(last)
    expect(list.toArrayReversed()).toEqual(['c', 'a'])
  })
})
