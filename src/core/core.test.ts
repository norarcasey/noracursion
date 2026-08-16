import { describe, expect, it } from 'vitest'
import { ArrayStructure } from './arrayStructure'
import { LinkedList } from './linkedList'
import { compare } from './model'
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
