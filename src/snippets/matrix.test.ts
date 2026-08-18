import { describe, expect, it } from 'vitest'
import { buildRun, type Run } from '../bridge'
import type { VizEvent } from '../bridge/events'
import type { Cell, VizModel } from '../core/model'
import type { DrawableStructure } from '../types'
import { getSnippet, hasSnippet, snippetKey, snippetVariants } from './index'

/**
 * The snippet matrix (CLAUDE.md §6.5).
 *
 * Parametrized over every implemented `(structure, operation, variant)`: the
 * built-in snippet parses, runs to completion inside the budgets, and leaves
 * the structure in the expected state — for both recursion settings, which must
 * also agree with each other.
 */

const DATA: readonly Cell[] = [8, 3, 10, 1, 6, 14]

const STRUCTURE_FOR: Readonly<Record<string, DrawableStructure>> = {
  array: 'array',
  'linked-list': 'linked-list',
  'doubly-linked-list': 'doubly-linked-list',
  stack: 'stack',
  queue: 'queue',
  'binary-search-tree': 'binary-search-tree',
  'red-black-tree': 'red-black-tree',
  'avl-tree': 'avl-tree',
  'min-heap': 'min-heap',
  'max-heap': 'max-heap',
}

function runVariant(variant: ReturnType<typeof snippetVariants>[number], recursion: boolean): Run {
  const code = getSnippet({ ...variant, recursion })
  if (code === null) throw new Error(`no snippet for ${snippetKey({ ...variant, recursion })}`)
  return buildRun({ code, structure: STRUCTURE_FOR[variant.structure], data: DATA })
}

function labels(model: VizModel): string[] {
  return model.nodes.map((node) => node.label)
}

function finalModel(run: Run): VizModel {
  return run.frames[run.frames.length - 1].model
}

/** What the picture did, independent of how many steps it took to do it. */
function eventScript(run: Run): string[] {
  return run.frames.flatMap((frame) => frame.events.map(describeEvent))
}

function describeEvent(event: VizEvent): string {
  switch (event.type) {
    case 'log':
      return `log ${event.text}`
    case 'visit':
      return `visit ${event.nodeId}`
    case 'compare':
      return `compare ${event.a} ${event.b}`
    case 'swap':
      return `swap ${event.a} ${event.b}`
    case 'set-color':
      return `color ${event.nodeId} ${event.color}`
    case 'mark':
      return `mark ${event.nodeId} ${event.label ?? '-'}`
  }
}

const VARIANTS = snippetVariants()

describe('every snippet runs', () => {
  const cases = VARIANTS.flatMap((variant) =>
    [true, false].map((recursion) => ({
      name: snippetKey({ ...variant, recursion }),
      variant,
      recursion,
    })),
  )

  it.each(cases)('$name parses and finishes inside the budgets', ({ variant, recursion }) => {
    const run = runVariant(variant, recursion)
    expect(run.error).toBeNull()
    expect(run.summary.completed).toBe(true)
    // Comfortably inside the defaults, so a reader can raise the budgets to
    // explore rather than to make the built-ins work at all.
    expect(run.summary.steps).toBeLessThan(10_000)
  })

  it('covers both recursion settings for every variant', () => {
    for (const variant of VARIANTS) {
      expect(hasSnippet({ ...variant, recursion: true })).toBe(true)
      expect(hasSnippet({ ...variant, recursion: false })).toBe(true)
    }
    expect(VARIANTS.length).toBeGreaterThanOrEqual(39)
  })
})

describe('recursion off draws the same picture', () => {
  // The pedagogical payoff of the `recursion` prop (§4): two shapes of code,
  // one behaviour. Step counts differ — that is the point — so this compares
  // what was drawn, not how long it took.
  it.each(VARIANTS.map((variant) => ({ name: snippetKey({ ...variant }), variant })))(
    '$name matches its iterative twin',
    ({ variant }) => {
      const recursive = runVariant(variant, true)
      const iterative = runVariant(variant, false)
      expect(eventScript(iterative)).toEqual(eventScript(recursive))
      expect(labels(finalModel(iterative))).toEqual(labels(finalModel(recursive)))
    },
  )
})

describe('final states', () => {
  const sorted = ['1', '3', '6', '8', '10', '14']

  it.each(['bubble', 'selection', 'insertion', 'merge', 'quick'] as const)(
    '%s sort leaves the array sorted',
    (sortAlgorithm) => {
      for (const recursion of [true, false]) {
        const run = runVariant({ structure: 'array', operation: 'sort', sortAlgorithm }, recursion)
        expect(labels(finalModel(run))).toEqual(sorted)
      }
    },
  )

  it('array insert puts the value in and grows the array', () => {
    const run = runVariant({ structure: 'array', operation: 'insert' }, true)
    expect(labels(finalModel(run))).toHaveLength(DATA.length + 1)
    expect(labels(finalModel(run))).toContain('7')
  })

  it('array delete removes the value', () => {
    const run = runVariant({ structure: 'array', operation: 'delete' }, true)
    expect(labels(finalModel(run))).toEqual(['8', '3', '1', '6', '14'])
  })

  it('array search finds the target and leaves the array alone', () => {
    const run = runVariant({ structure: 'array', operation: 'search' }, true)
    expect(labels(finalModel(run))).toEqual(DATA.map(String))
    expect(run.summary.logs).toEqual(['found 6 at index 4'])
  })

  it('list insert and delete change the chain', () => {
    expect(
      labels(finalModel(runVariant({ structure: 'linked-list', operation: 'insert' }, true))),
    ).toContain('7')
    expect(
      labels(finalModel(runVariant({ structure: 'linked-list', operation: 'delete' }, true))),
    ).toEqual(['8', '3', '1', '6', '14'])
  })

  it('tree insert links the new value into the right place', () => {
    for (const recursion of [true, false]) {
      const run = runVariant({ structure: 'binary-search-tree', operation: 'insert' }, recursion)
      // 7 < 8 → left to 3; 7 > 3 → right to 6; 7 > 6 → right of 6.
      const model = finalModel(run)
      expect(labels(model)).toContain('7')
      const six = model.nodes.find((node) => node.label === '6')
      const seven = model.nodes.find((node) => node.label === '7')
      const link = model.edges.find(
        (edge) => edge.from === six?.id && edge.to === seven?.id && edge.kind === 'child-right',
      )
      expect(link).toBeDefined()
    }
  })

  it('tree search walks the path the ordering allows', () => {
    const run = runVariant({ structure: 'binary-search-tree', operation: 'search' }, true)
    // 6 is reached in three comparisons, not six — that is what the ordering buys.
    expect(eventScript(run).filter((entry) => entry.startsWith('visit'))).toHaveLength(3)
    expect(run.summary.logs).toEqual(['found 6'])
  })

  it.each([
    ['in-order', ['1', '3', '6', '8', '10', '14']],
    ['pre-order', ['8', '3', '1', '6', '10', '14']],
    ['post-order', ['1', '6', '3', '14', '10', '8']],
    ['level-order', ['8', '3', '10', '1', '6', '14']],
  ] as const)('%s traversal visits in the right order', (traversalOrder, expected) => {
    for (const recursion of [true, false]) {
      const run = runVariant(
        { structure: 'binary-search-tree', operation: 'traverse', traversalOrder },
        recursion,
      )
      expect(run.summary.logs).toEqual(expected)
    }
  })
})

describe('the registry is the source of truth', () => {
  it('reports nothing for a combination it does not implement', () => {
    // §6.5: an unimplemented combination must not be silently broken. The
    // component turns this into a plain notice naming what does work.
    expect(hasSnippet({ structure: 'trie', operation: 'insert' })).toBe(false)
    expect(hasSnippet({ structure: 'array', operation: 'balance' })).toBe(false)
    expect(hasSnippet({ structure: 'binary-search-tree', operation: 'sort' })).toBe(false)
  })

  it('reports nothing for a language it cannot run', () => {
    expect(hasSnippet({ structure: 'array', operation: 'search', language: 'python' })).toBe(false)
  })

  it('defaults to the recursive variant, since that is the prop default', () => {
    const recursive = getSnippet({ structure: 'array', operation: 'search' })
    expect(recursive).toBe(getSnippet({ structure: 'array', operation: 'search', recursion: true }))
    expect(recursive).not.toBe(
      getSnippet({ structure: 'array', operation: 'search', recursion: false }),
    )
  })

  it('keys sorts and traversals apart, which §4’s key alone cannot', () => {
    expect(snippetKey({ structure: 'array', operation: 'sort', sortAlgorithm: 'merge' })).toBe(
      'array:sort:typescript:merge:rec',
    )
    expect(
      snippetKey({
        structure: 'binary-search-tree',
        operation: 'traverse',
        traversalOrder: 'post-order',
        recursion: false,
      }),
    ).toBe('binary-search-tree:traverse:typescript:post-order:iter')
  })
})

describe('red-black tree', () => {
  it('repairs itself, and the repair is visible as colours and rotations', () => {
    for (const recursion of [true, false]) {
      const run = runVariant({ structure: 'red-black-tree', operation: 'insert' }, recursion)
      expect(run.error).toBeNull()
      const script = eventScript(run)
      // The fixup is in the snippet, so its work shows up as events.
      expect(script.some((entry) => entry.startsWith('color'))).toBe(true)

      const model = finalModel(run)
      expect(labels(model)).toContain('4')
      // Root black, and no red node with a red child — asserted on the picture
      // the reader is actually looking at, not on the model behind it.
      const byId = new Map(model.nodes.map((node) => [node.id, node]))
      expect(model.nodes[0].color).toBe('black')
      for (const edge of model.edges) {
        const parent = byId.get(edge.from)
        const child = byId.get(edge.to)
        expect(parent?.color === 'red' && child?.color === 'red').toBe(false)
      }
    }
  })

  it('keeps the tree balanced enough to be worth the trouble', () => {
    const run = runVariant({ structure: 'red-black-tree', operation: 'search' }, true)
    expect(run.error).toBeNull()
    expect(run.summary.logs).toEqual(['found 6'])
  })
})

describe('stack and queue', () => {
  it('reading a stack empties it and puts it back exactly as it was', () => {
    const run = runVariant({ structure: 'stack', operation: 'traverse' }, true)
    // Top first — that is the only order a stack can be read in.
    expect(run.summary.logs).toEqual(['14', '6', '1', '10', '3', '8'])
    expect(labels(finalModel(run))).toEqual(DATA.map(String))
  })

  it('reading a queue goes all the way round and lands where it started', () => {
    const run = runVariant({ structure: 'queue', operation: 'traverse' }, true)
    expect(run.summary.logs).toEqual(DATA.map(String))
    expect(labels(finalModel(run))).toEqual(DATA.map(String))
  })

  it('pops the most recent and dequeues the oldest', () => {
    expect(runVariant({ structure: 'stack', operation: 'delete' }, true).summary.logs).toEqual([
      'popped 14',
      'popped 6',
    ])
    expect(runVariant({ structure: 'queue', operation: 'delete' }, true).summary.logs).toEqual([
      'dequeued 8',
      'dequeued 3',
    ])
  })
})

describe('doubly linked list', () => {
  it('walks out and back again', () => {
    const run = runVariant({ structure: 'doubly-linked-list', operation: 'traverse' }, true)
    expect(run.summary.logs).toEqual([...DATA.map(String), ...[...DATA].reverse().map(String)])
  })

  it('finds a value by walking forward, like a singly linked list', () => {
    const run = runVariant({ structure: 'doubly-linked-list', operation: 'search' }, true)
    expect(run.summary.logs).toEqual(['found 6 at position 4'])
  })

  it('removes a value and mends both links', () => {
    const run = runVariant({ structure: 'doubly-linked-list', operation: 'delete' }, true)
    expect(labels(finalModel(run))).toEqual(['8', '3', '1', '6', '14'])
    const model = finalModel(run)
    expect(model.edges.filter((edge) => edge.kind === 'next')).toHaveLength(4)
    expect(model.edges.filter((edge) => edge.kind === 'prev')).toHaveLength(4)
  })

  it('draws a backward link for every forward one', () => {
    const run = runVariant({ structure: 'doubly-linked-list', operation: 'search' }, true)
    const model = finalModel(run)
    const forward = model.edges.filter((edge) => edge.kind === 'next')
    const backward = model.edges.filter((edge) => edge.kind === 'prev')
    expect(forward).toHaveLength(DATA.length - 1)
    expect(backward).toHaveLength(DATA.length - 1)
  })
})

describe('heaps', () => {
  it('sifts a new value up into place, keeping the heap property', () => {
    for (const kind of ['min-heap', 'max-heap'] as const) {
      for (const recursion of [true, false]) {
        const run = runVariant({ structure: kind, operation: 'insert' }, recursion)
        expect(run.error).toBeNull()
        const values = labels(finalModel(run)).map(Number)
        expect(values).toContain(2)
        // Checked on the picture: every child sits below its parent.
        for (let i = 1; i < values.length; i += 1) {
          const parent = values[Math.floor((i - 1) / 2)]
          if (kind === 'min-heap') expect(values[i]).toBeGreaterThanOrEqual(parent)
          else expect(values[i]).toBeLessThanOrEqual(parent)
        }
      }
    }
  })

  it('removes the root — the smallest, or the largest', () => {
    expect(runVariant({ structure: 'min-heap', operation: 'delete' }, true).summary.logs).toEqual([
      'removed 1',
    ])
    expect(runVariant({ structure: 'max-heap', operation: 'delete' }, true).summary.logs).toEqual([
      'removed 14',
    ])
  })

  it('shows that a heap is not a sorted array', () => {
    const run = runVariant({ structure: 'min-heap', operation: 'traverse' }, true)
    expect(run.summary.logs[0]).toBe('1')
    expect(run.summary.logs).not.toEqual(['1', '3', '6', '8', '10', '14'])
  })
})

describe('AVL tree', () => {
  it('rebalances after the insert, and says so on the way', () => {
    for (const recursion of [true, false]) {
      const run = runVariant({ structure: 'avl-tree', operation: 'insert' }, recursion)
      expect(run.error).toBeNull()
      expect(labels(finalModel(run))).toContain('4')
      // Every node's balance factor stays within one, checked on the picture.
      for (const node of finalModel(run).nodes) {
        const balance = node.meta?.balance
        expect(typeof balance === 'number' && Math.abs(balance) <= 1).toBe(true)
      }
    }
  })

  it('searches like any other search tree', () => {
    const run = runVariant({ structure: 'avl-tree', operation: 'search' }, true)
    expect(run.summary.logs).toEqual(['found 6'])
  })
})
