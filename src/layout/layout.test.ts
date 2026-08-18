import { describe, expect, it } from 'vitest'
import { ArrayStructure } from '../core/arrayStructure'
import { Graph } from '../core/graph'
import { LinkedList } from '../core/linkedList'
import type { VizModel } from '../core/model'
import { BinarySearchTree } from '../core/tree'
import { layoutModel } from './index'
import { chain, row } from './row'
import { tidyTree } from './tidyTree'
import { NODE_RADIUS, PADDING, SIBLING_SPACING, type Layout } from './types'

/**
 * Layout purity (CLAUDE.md §6.4): same model in, same positions out, no NaN,
 * no overlaps on a degenerate tree.
 */

function everyNumberFinite(layout: Layout): boolean {
  const values = [
    layout.width,
    layout.height,
    ...layout.nodes.flatMap((node) => [node.x, node.y, node.radius]),
    ...layout.edges.flatMap((edge) => [
      edge.x1,
      edge.y1,
      edge.x2,
      edge.y2,
      edge.length,
      edge.angle,
    ]),
  ]
  return values.every((value) => Number.isFinite(value))
}

/** Any two node centres closer than one diameter would draw as overlapping circles. */
function overlappingPairs(layout: Layout): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      const a = layout.nodes[i]
      const b = layout.nodes[j]
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius) pairs.push([a.id, b.id])
    }
  }
  return pairs
}

describe('purity', () => {
  const models: ReadonlyArray<readonly [string, VizModel]> = [
    ['array', new ArrayStructure([5, 1, 4, 2]).toVizModel()],
    ['linked list', new LinkedList(['a', 'b', 'c']).toVizModel()],
    ['balanced tree', new BinarySearchTree([5, 3, 8, 1, 4, 7, 9]).toVizModel()],
    ['left-leaning tree', new BinarySearchTree([5, 4, 3, 2, 1]).toVizModel()],
    ['right-leaning tree', new BinarySearchTree([1, 2, 3, 4, 5]).toVizModel()],
    ['lopsided tree', new BinarySearchTree([10, 5, 15, 3, 4, 20]).toVizModel()],
  ]

  it.each(models)('lays out %s identically every time', (_name, model) => {
    expect(layoutModel(model)).toEqual(layoutModel(model))
  })

  it.each(models)('produces only finite numbers for %s', (_name, model) => {
    expect(everyNumberFinite(layoutModel(model))).toBe(true)
  })

  it.each(models)('never overlaps two nodes in %s', (_name, model) => {
    expect(overlappingPairs(layoutModel(model))).toEqual([])
  })

  it('handles an empty model', () => {
    const layout = layoutModel({ nodes: [], edges: [], layoutHint: 'tree' })
    expect(layout.nodes).toEqual([])
    expect(layout.viewBox).toBe('0 0 0 0')
  })

  it('drops an edge that names a node the model does not have', () => {
    // Emitting NaN coordinates here would silently poison the whole frame.
    const layout = tidyTree({
      nodes: [{ id: 'a', label: 'a' }],
      edges: [{ id: 'e', from: 'a', to: 'ghost', kind: 'child-left' }],
      layoutHint: 'tree',
    })
    expect(layout.edges).toEqual([])
    expect(layout.nodes).toHaveLength(1)
  })
})

describe('framing', () => {
  it('pads the content and starts it at the padding offset', () => {
    const layout = row(new ArrayStructure([1, 2]).toVizModel())
    const left = Math.min(...layout.nodes.map((node) => node.x - node.radius))
    const top = Math.min(...layout.nodes.map((node) => node.y - node.radius))
    expect(left).toBeCloseTo(PADDING)
    expect(top).toBeCloseTo(PADDING)
    expect(layout.viewBox).toBe(`0 0 ${layout.width} ${layout.height}`)
  })

  it('fits the viewBox around the content on every side', () => {
    const layout = tidyTree(new BinarySearchTree([5, 3, 8]).toVizModel())
    const right = Math.max(...layout.nodes.map((node) => node.x + node.radius))
    const bottom = Math.max(...layout.nodes.map((node) => node.y + node.radius))
    expect(layout.width).toBeCloseTo(right + PADDING)
    expect(layout.height).toBeCloseTo(bottom + PADDING)
  })
})

describe('row and chain', () => {
  it('places array cells left to right in model order', () => {
    const layout = row(new ArrayStructure([9, 8, 7]).toVizModel())
    expect(layout.nodes.map((node) => node.label)).toEqual(['9', '8', '7'])
    const xs = layout.nodes.map((node) => node.x)
    expect(xs[1]).toBeGreaterThan(xs[0])
    expect(xs[2]).toBeGreaterThan(xs[1])
    expect(layout.nodes.every((node) => node.y === layout.nodes[0].y)).toBe(true)
  })

  it('carries the index through for the labels drawn beneath', () => {
    const layout = row(new ArrayStructure([4, 5]).toVizModel())
    expect(layout.nodes.map((node) => node.meta?.index)).toEqual([0, 1])
  })

  it('leaves more room between chain nodes than between row cells', () => {
    const model = new LinkedList([1, 2]).toVizModel()
    const gap = (l: Layout): number => l.nodes[1].x - l.nodes[0].x
    expect(gap(chain(model))).toBeGreaterThan(gap(row(model)))
  })

  it('trims edges back to the rims so an arrowhead lands on the boundary', () => {
    const layout = chain(new LinkedList([1, 2]).toVizModel())
    const [first, second] = layout.nodes
    const edge = layout.edges[0]
    expect(edge.x1).toBeCloseTo(first.x + NODE_RADIUS)
    expect(edge.x2).toBeCloseTo(second.x - NODE_RADIUS)
    expect(edge.angle).toBeCloseTo(0)
    expect(edge.length).toBeCloseTo(edge.x2 - edge.x1)
  })
})

describe('tidyTree', () => {
  it('centres a parent over its two children', () => {
    const tree = new BinarySearchTree([5, 3, 8])
    const layout = tidyTree(tree.toVizModel())
    const at = (label: string): number => {
      const node = layout.nodes.find((candidate) => candidate.label === label)
      if (node === undefined) throw new Error(`no node labelled ${label}`)
      return node.x
    }
    expect(at('5')).toBeCloseTo((at('3') + at('8')) / 2)
  })

  it('puts each level on its own row', () => {
    const layout = tidyTree(new BinarySearchTree([5, 3, 8, 1]).toVizModel())
    const depthOf = (label: string): number => {
      const node = layout.nodes.find((candidate) => candidate.label === label)
      if (node === undefined) throw new Error(`no node labelled ${label}`)
      return node.y
    }
    expect(depthOf('3')).toBeGreaterThan(depthOf('5'))
    expect(depthOf('1')).toBeGreaterThan(depthOf('3'))
  })

  it('leans an only child to the correct side instead of hanging it straight down', () => {
    // A plain tidy tree centres an only child under its parent, which draws a
    // vertical edge and hides whether the child is the smaller or the larger
    // one — the single most important fact about a BST.
    const left = tidyTree(new BinarySearchTree([5, 3]).toVizModel())
    const leftChild = left.nodes.find((node) => node.label === '3')
    const leftParent = left.nodes.find((node) => node.label === '5')
    expect(leftChild?.x ?? 0).toBeLessThan(leftParent?.x ?? 0)

    const right = tidyTree(new BinarySearchTree([5, 8]).toVizModel())
    const rightChild = right.nodes.find((node) => node.label === '8')
    const rightParent = right.nodes.find((node) => node.label === '5')
    expect(rightChild?.x ?? 0).toBeGreaterThan(rightParent?.x ?? 0)
  })

  it('does not collapse a fully left-leaning tree, which is the naive failure', () => {
    const layout = tidyTree(new BinarySearchTree([5, 4, 3, 2, 1]).toVizModel())
    const ordered = [...layout.nodes].sort((a, b) => a.y - b.y)
    expect(ordered.map((node) => node.label)).toEqual(['5', '4', '3', '2', '1'])
    // Every step down goes strictly left, so the chain slants instead of
    // stacking into a vertical line of overlapping circles.
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i].x).toBeLessThan(ordered[i - 1].x)
    }
    expect(overlappingPairs(layout)).toEqual([])
  })

  it('keeps sibling subtrees apart in a lopsided tree', () => {
    // The case a naive layout gets wrong: a deep left subtree and a shallow
    // right one must not have their contours interleave.
    const layout = tidyTree(new BinarySearchTree([10, 5, 15, 3, 7, 6, 8, 20]).toVizModel())
    expect(overlappingPairs(layout)).toEqual([])
    const byDepth = new Map<number, number[]>()
    for (const node of layout.nodes) {
      byDepth.set(node.y, [...(byDepth.get(node.y) ?? []), node.x])
    }
    for (const xs of byDepth.values()) {
      const sorted = [...xs].sort((a, b) => a - b)
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(SIBLING_SPACING - 0.001)
      }
    }
  })

  it('lays out a forest side by side rather than on top of itself', () => {
    const layout = tidyTree({
      nodes: [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
      ],
      edges: [],
      layoutHint: 'tree',
    })
    expect(layout.nodes[0].x).not.toBe(layout.nodes[1].x)
    expect(overlappingPairs(layout)).toEqual([])
  })

  it('terminates on a cyclic model instead of recursing forever', () => {
    const layout = tidyTree({
      nodes: [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'b', kind: 'child-left' },
        { id: 'e2', from: 'b', to: 'a', kind: 'child-left' },
      ],
      layoutHint: 'tree',
    })
    expect(layout.nodes.length).toBeGreaterThan(0)
    expect(everyNumberFinite(layout)).toBe(true)
  })
})

describe('graph layout', () => {
  const model = new Graph([
    { label: 'A', x: 0, y: 0, edges: [{ to: 'B', weight: 4 }] },
    { label: 'B', x: 120, y: 60 },
  ]).toVizModel()

  it('uses the coordinates the author supplied, framed', () => {
    const layout = layoutModel(model)
    // The offset between the two nodes is preserved exactly; only the frame moves.
    expect(layout.nodes[1].x - layout.nodes[0].x).toBeCloseTo(120)
    expect(layout.nodes[1].y - layout.nodes[0].y).toBeCloseTo(60)
    expect(everyNumberFinite(layout)).toBe(true)
  })

  it('computes nothing, so it cannot jitter', () => {
    expect(layoutModel(model)).toEqual(layoutModel(model))
  })

  it('carries the weight through for the renderer to draw', () => {
    expect(layoutModel(model).edges[0].label).toBe('4')
  })

  it('places a node with no coordinates visibly wrong rather than subtly wrong', () => {
    const layout = layoutModel({
      nodes: [{ id: 'a', label: 'a' }],
      edges: [],
      layoutHint: 'graph',
    })
    expect(everyNumberFinite(layout)).toBe(true)
    expect(layout.nodes).toHaveLength(1)
  })
})
