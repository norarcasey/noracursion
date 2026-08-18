import { describe, expect, it } from 'vitest'
import { ArrayStructure } from './arrayStructure'
import { LinkedList } from './linkedList'
import { compare } from './model'
import { AvlTree } from './avlTree'
import { DoublyLinkedList } from './doublyLinkedList'
import { BinaryHeap } from './heap'
import { Queue } from './queue'
import { RedBlackTree } from './redBlackTree'
import { Stack } from './stack'
import { BinarySearchTree } from './tree'

/** Correctness of the M2 models, and the `VizModel` they serialize to (§3.1). */

describe('compare', () => {
  it('orders numbers numerically and strings lexicographically', () => {
    expect(compare(2, 10)).toBeLessThan(0)
    expect(compare('b', 'a')).toBeGreaterThan(0)
    expect(compare(5, 5)).toBe(0)
  })

  it('falls back to string order for a mixed comparison', () => {
    // Not meaningful, but total: without this both `<` and `>` would be false
    // and a search would silently walk the wrong branch.
    expect(compare(1, 'a')).toBeLessThan(0)
    expect(compare('a', 1)).toBeGreaterThan(0)
  })
})

describe('ArrayStructure', () => {
  it('supports the operations a sort or a search needs', () => {
    const array = new ArrayStructure([3, 1, 2])
    expect(array.length).toBe(3)
    expect(array.get(0)).toBe(3)
    expect(array.indexOf(2)).toBe(2)

    array.push(4)
    expect(array.values()).toEqual([3, 1, 2, 4])
    expect(array.pop()).toBe(4)

    array.unshift(0)
    expect(array.values()).toEqual([0, 3, 1, 2])
    expect(array.shift()).toBe(0)

    array.insertAt(1, 9)
    expect(array.values()).toEqual([3, 9, 1, 2])
    expect(array.removeAt(1)).toBe(9)
    expect(array.values()).toEqual([3, 1, 2])
  })

  it('rejects out-of-range writes rather than growing a hole', () => {
    const array = new ArrayStructure([1])
    expect(() => array.set(5, 0)).toThrow(RangeError)
    expect(() => array.insertAt(9, 0)).toThrow(RangeError)
    expect(() => array.swap(0, 4)).toThrow(RangeError)
    expect(array.removeAt(9)).toBeUndefined()
  })

  it('serializes to a row with index metadata and no edges', () => {
    const model = new ArrayStructure([7, 8]).toVizModel()
    expect(model.layoutHint).toBe('row')
    expect(model.edges).toEqual([])
    expect(model.nodes.map((node) => node.label)).toEqual(['7', '8'])
    expect(model.nodes.map((node) => node.meta?.index)).toEqual([0, 1])
  })
})

describe('LinkedList', () => {
  it('supports insertion, removal and search', () => {
    const list = new LinkedList([1, 2, 3])
    expect(list.toArray()).toEqual([1, 2, 3])
    expect(list.length).toBe(3)
    expect(list.indexOf(2)).toBe(1)
    expect(list.indexOf(99)).toBe(-1)

    list.unshift(0)
    list.push(4)
    list.insertAt(3, 99)
    expect(list.toArray()).toEqual([0, 1, 2, 99, 3, 4])

    expect(list.remove(99)).toBe(true)
    expect(list.remove(99)).toBe(false)
    expect(list.removeAt(0)).toBe(0)
    expect(list.toArray()).toEqual([1, 2, 3, 4])
    expect(list.length).toBe(4)
  })

  it('handles the empty and single-node cases', () => {
    const list = new LinkedList()
    expect(list.toArray()).toEqual([])
    expect(list.removeAt(0)).toBeUndefined()
    expect(list.toVizModel().nodes).toEqual([])

    list.push('only')
    expect(list.toVizModel().edges).toEqual([])
    expect(list.removeAt(0)).toBe('only')
    expect(list.length).toBe(0)
  })

  it('serializes to a chain of next edges', () => {
    const model = new LinkedList([1, 2, 3]).toVizModel()
    expect(model.layoutHint).toBe('chain')
    expect(model.nodes).toHaveLength(3)
    expect(model.edges).toHaveLength(2)
    expect(model.edges.every((edge) => edge.kind === 'next')).toBe(true)
    // Edges connect consecutive nodes, in order.
    expect(model.edges[0].from).toBe(model.nodes[0].id)
    expect(model.edges[0].to).toBe(model.nodes[1].id)
  })
})

describe('BinarySearchTree', () => {
  it('inserts, searches and rejects duplicates', () => {
    const tree = new BinarySearchTree([5, 3, 8])
    expect(tree.size).toBe(3)
    expect(tree.has(3)).toBe(true)
    expect(tree.has(4)).toBe(false)
    expect(tree.insert(4)).toBe(true)
    expect(tree.insert(4)).toBe(false)
    expect(tree.size).toBe(4)
  })

  it('walks in all four orders', () => {
    const tree = new BinarySearchTree([5, 3, 8, 1, 4, 7, 9])
    expect(tree.inOrder()).toEqual([1, 3, 4, 5, 7, 8, 9])
    expect(tree.preOrder()).toEqual([5, 3, 1, 4, 8, 7, 9])
    expect(tree.postOrder()).toEqual([1, 4, 3, 7, 9, 8, 5])
    expect(tree.levelOrder()).toEqual([5, 3, 8, 1, 4, 7, 9])
  })

  it('removes leaves, single-child nodes and two-child nodes', () => {
    const tree = new BinarySearchTree([5, 3, 8, 1, 4, 7, 9])

    expect(tree.remove(1)).toBe(true) // leaf
    expect(tree.inOrder()).toEqual([3, 4, 5, 7, 8, 9])

    expect(tree.remove(3)).toBe(true) // one child
    expect(tree.inOrder()).toEqual([4, 5, 7, 8, 9])

    expect(tree.remove(5)).toBe(true) // two children, and the root
    expect(tree.inOrder()).toEqual([4, 7, 8, 9])

    expect(tree.remove(42)).toBe(false)
    expect(tree.size).toBe(4)
  })

  it('empties completely and can be refilled', () => {
    const tree = new BinarySearchTree([2, 1, 3])
    for (const value of [1, 2, 3]) expect(tree.remove(value)).toBe(true)
    expect(tree.size).toBe(0)
    expect(tree.inOrder()).toEqual([])
    expect(tree.toVizModel().nodes).toEqual([])

    tree.insert(1)
    expect(tree.inOrder()).toEqual([1])
  })

  it('measures height, including the fully left-leaning case', () => {
    expect(new BinarySearchTree().height()).toBe(0)
    expect(new BinarySearchTree([5, 3, 8]).height()).toBe(2)
    // Degenerate: this is the shape that a naive layout collapses on (§3.5).
    expect(new BinarySearchTree([5, 4, 3, 2, 1]).height()).toBe(5)
  })

  it('refuses to rotate where there is no pivot', () => {
    const tree = new BinarySearchTree([5])
    expect(tree.rotateLeft(5)).toBe(false)
    expect(tree.rotateRight(5)).toBe(false)
    expect(tree.rotateLeft(99)).toBe(false)
  })

  it('rotates right as the mirror of rotating left', () => {
    const tree = new BinarySearchTree([8, 5, 9, 3, 7])
    expect(tree.rotateRight(8)).toBe(true)
    expect(tree.inOrder()).toEqual([3, 5, 7, 8, 9])
    expect(tree.preOrder()).toEqual([5, 3, 8, 7, 9])
  })

  it('serializes to a tree of left and right child edges', () => {
    const model = new BinarySearchTree([5, 3, 8]).toVizModel()
    expect(model.layoutHint).toBe('tree')
    expect(model.nodes.map((node) => node.label)).toEqual(['5', '3', '8'])
    expect(model.nodes.map((node) => node.meta?.depth)).toEqual([0, 1, 1])
    expect(model.edges.map((edge) => edge.kind)).toEqual(['child-left', 'child-right'])
  })

  it('handles string values', () => {
    const tree = new BinarySearchTree(['m', 'c', 'x'])
    expect(tree.inOrder()).toEqual(['c', 'm', 'x'])
    expect(tree.has('c')).toBe(true)
  })
})

describe('RedBlackTree', () => {
  /** A fixed-seed generator, so a failure is reproducible rather than a rumour. */
  function makeRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    }
  }

  /** The four red-black properties, checked against the serialized picture. */
  function violation(tree: RedBlackTree): string | null {
    const model = tree.toVizModel()
    if (model.nodes.length === 0) return null
    if (model.nodes[0].color !== 'black') return 'the root is not black'
    if (tree.blackHeight() === null) return 'black heights differ between paths'
    const byId = new Map(model.nodes.map((node) => [node.id, node]))
    for (const edge of model.edges) {
      if (byId.get(edge.from)?.color === 'red' && byId.get(edge.to)?.color === 'red') {
        return `a red node has a red child (${byId.get(edge.from)?.label})`
      }
    }
    return null
  }

  it('holds every red-black property across 200 random trees', () => {
    const random = makeRandom(20260817)
    for (let trial = 0; trial < 200; trial += 1) {
      const size = 1 + Math.floor(random() * 40)
      const values = Array.from({ length: size }, () => Math.floor(random() * 100))
      const tree = new RedBlackTree(values)
      expect(violation(tree)).toBeNull()
      expect(tree.inOrder()).toEqual([...new Set(values)].sort((a, b) => a - b))
    }
  })

  it('stays shallow, which is the whole reason for the colours', () => {
    const values = Array.from({ length: 63 }, (_, index) => index)
    const balanced = new RedBlackTree(values)
    const degenerate = new BinarySearchTree(values)
    // Inserted in ascending order, a plain search tree becomes a linked list.
    expect(degenerate.height()).toBe(63)
    expect(balanced.height()).toBeLessThanOrEqual(2 * Math.log2(values.length + 1))
  })

  it('reads a missing child as black, the way the algorithm does', () => {
    const tree = new RedBlackTree([10])
    expect(tree.colorOf(10)).toBe('black')
    expect(tree.colorOf(999)).toBeNull()
    expect(tree.leftOf(10)).toBeNull()
    expect(tree.parentOf(10)).toBeNull()
  })

  it('refuses to build something impossible', () => {
    const tree = new RedBlackTree([10, 5])
    expect(() => tree.setRoot(1)).toThrow(/already has a root/)
    expect(() => tree.attachLeft(10, 3)).toThrow(/already has a left child/)
    expect(() => tree.attachRight(10, 5)).toThrow(/already in the tree/)
    expect(() => tree.attachRight(999, 1)).toThrow(/no node holding/)
  })
})

describe('Stack and Queue', () => {
  it('a stack is last in, first out', () => {
    const stack = new Stack([1, 2])
    stack.push(3)
    expect(stack.peek()).toBe(3)
    expect(stack.pop()).toBe(3)
    expect(stack.toArray()).toEqual([1, 2])
    expect(stack.size).toBe(2)
    expect(new Stack().isEmpty()).toBe(true)
    expect(new Stack().pop()).toBeUndefined()
  })

  it('a queue is first in, first out', () => {
    const queue = new Queue([1, 2])
    queue.enqueue(3)
    expect(queue.peek()).toBe(1)
    expect(queue.dequeue()).toBe(1)
    expect(queue.toArray()).toEqual([2, 3])
    expect(new Queue().isEmpty()).toBe(true)
    expect(new Queue().dequeue()).toBeUndefined()
  })

  it('marks the ends, which is the only thing distinguishing the pictures', () => {
    const stack = new Stack([1, 2, 3]).toVizModel()
    expect(stack.nodes.map((node) => node.meta?.role)).toEqual([undefined, undefined, 'top'])

    const queue = new Queue([1, 2, 3]).toVizModel()
    expect(queue.nodes.map((node) => node.meta?.role)).toEqual(['front', undefined, 'back'])
  })
})

describe('DoublyLinkedList', () => {
  it('walks in both directions', () => {
    const list = new DoublyLinkedList([1, 2, 3])
    expect(list.toArray()).toEqual([1, 2, 3])
    expect(list.toArrayReversed()).toEqual([3, 2, 1])
  })

  it('mends both links on every edit', () => {
    const list = new DoublyLinkedList([1, 3])
    list.insertAt(1, 2)
    expect(list.toArray()).toEqual([1, 2, 3])
    expect(list.toArrayReversed()).toEqual([3, 2, 1])

    list.removeAt(0)
    expect(list.toArray()).toEqual([2, 3])
    expect(list.toArrayReversed()).toEqual([3, 2])

    list.unshift(0)
    expect(list.toArrayReversed()).toEqual([3, 2, 0])
  })

  it('empties completely from either end', () => {
    const list = new DoublyLinkedList([1])
    expect(list.removeAt(0)).toBe(1)
    expect(list.length).toBe(0)
    expect(list.toArray()).toEqual([])
    expect(list.toArrayReversed()).toEqual([])
    expect(list.removeAt(0)).toBeUndefined()
  })

  it('serializes a forward and a backward edge for each adjacent pair', () => {
    const model = new DoublyLinkedList([1, 2, 3]).toVizModel()
    expect(model.edges.filter((edge) => edge.kind === 'next')).toHaveLength(2)
    expect(model.edges.filter((edge) => edge.kind === 'prev')).toHaveLength(2)
    expect(model.layoutHint).toBe('chain')
  })
})

describe('BinaryHeap', () => {
  it('keeps the smallest at the root, and only the root', () => {
    const heap = new BinaryHeap([8, 3, 10, 1, 6, 14], 'min')
    expect(heap.peek()).toBe(1)
    expect(heap.isValid()).toBe(true)
    // A heap is not a sorted array, and pretending otherwise is the usual
    // misunderstanding this picture exists to correct.
    expect(heap.values()).not.toEqual([1, 3, 6, 8, 10, 14])
  })

  it('keeps the largest at the root when it is a max-heap', () => {
    const heap = new BinaryHeap([8, 3, 10, 1, 6, 14], 'max')
    expect(heap.peek()).toBe(14)
    expect(heap.isValid()).toBe(true)
  })

  it('pops in order, which is what makes heapsort work', () => {
    const heap = new BinaryHeap([8, 3, 10, 1, 6, 14], 'min')
    const drained = []
    while (heap.size > 0) drained.push(heap.pop())
    expect(drained).toEqual([1, 3, 6, 8, 10, 14])
    expect(heap.pop()).toBeUndefined()
  })

  it('derives the tree from the indices rather than storing it', () => {
    const model = new BinaryHeap([5, 3, 8, 1], 'min').toVizModel()
    expect(model.layoutHint).toBe('tree')
    expect(model.indexLabels).toBe(true)
    expect(model.nodes.map((node) => node.meta?.index)).toEqual([0, 1, 2, 3])
    // Node 0 parents nodes 1 and 2; node 1 parents node 3.
    expect(model.edges).toHaveLength(3)
    expect(model.edges[0].from).toBe(model.nodes[0].id)
    expect(model.edges[0].to).toBe(model.nodes[1].id)
  })

  it('leaves the sift to the caller when appending or removing the last cell', () => {
    const heap = new BinaryHeap([1, 2, 3], 'min')
    heap.append(0)
    // Deliberately broken: restoring it is the algorithm, and the algorithm
    // belongs in the snippet.
    expect(heap.isValid()).toBe(false)
    expect(heap.removeLast()).toBe(0)
    expect(heap.isValid()).toBe(true)
  })
})

describe('AvlTree', () => {
  it('stays balanced where a plain search tree degenerates', () => {
    const values = [1, 2, 3, 4, 5, 6, 7]
    const avl = new AvlTree(values)
    expect(avl.isBalanced()).toBe(true)
    expect(avl.height()).toBe(3)
    expect(new BinarySearchTree(values).height()).toBe(7)
    expect(avl.inOrder()).toEqual(values)
  })

  it('stays balanced across 200 random trees', () => {
    let state = 20260817
    const random = (): number => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    }
    for (let trial = 0; trial < 200; trial += 1) {
      const size = 1 + Math.floor(random() * 40)
      const values = Array.from({ length: size }, () => Math.floor(random() * 100))
      const tree = new AvlTree(values)
      expect(tree.isBalanced()).toBe(true)
      expect(tree.inOrder()).toEqual([...new Set(values)].sort((a, b) => a - b))
    }
  })

  it('measures heights rather than caching them', () => {
    const tree = new AvlTree([10, 5, 20])
    expect(tree.heightOf(10)).toBe(2)
    expect(tree.heightOf(5)).toBe(1)
    // An absent subtree is height 0, so a snippet can ask without checking.
    expect(tree.heightOf(null)).toBe(0)
    expect(tree.balanceOf(10)).toBe(0)
  })

  it('draws the balance factor on any node that has one', () => {
    const tree = new AvlTree([10, 5, 20, 3])
    const model = tree.toVizModel()
    const root = model.nodes.find((node) => node.label === '10')
    expect(root?.meta?.balance).toBe(1)
    expect(root?.meta?.mark).toBe('+1')
    const leaf = model.nodes.find((node) => node.label === '3')
    expect(leaf?.meta?.mark).toBeUndefined()
  })
})
