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
  'binary-search-tree': 'binary-search-tree',
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
    expect(VARIANTS.length).toBeGreaterThanOrEqual(18)
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
    expect(hasSnippet({ structure: 'red-black-tree', operation: 'insert' })).toBe(false)
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
