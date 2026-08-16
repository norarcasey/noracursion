import { describe, expect, it } from 'vitest'
import { NoracursionError } from './errors'
import { runToCompletion } from './run'
import type { RunOptions } from './interpret'

/**
 * Budget tests (CLAUDE.md §6.2).
 *
 * Each of these programs would run forever. The contract is that every one of
 * them terminates, throws the right kind of error, and arrives carrying enough
 * diagnostic detail to render a teaching panel — a line, the source of the
 * offending loop, and what the variables were doing.
 */

const src = (text: string): string => text.replace(/^\n/, '')

function failure(source: string, options: RunOptions = {}): NoracursionError {
  const result = runToCompletion(src(source), options)
  if (result.error === null) throw new Error('expected the run to fail, but it completed')
  return result.error
}

describe('runaway while loop', () => {
  const error = failure(
    `
let current = { value: 8, next: null }
while (current !== null) {
  console.log(current.value)
}
`,
    { maxLoopIterations: 1_000 },
  )

  it('stops instead of hanging, with a loop-budget error', () => {
    expect(error).toBeInstanceOf(NoracursionError)
    expect(error.detail.kind).toBe('loop-budget')
    expect(error.message).toBe('This loop ran 1000 times and never stopped.')
  })

  it('reports the line and quotes the loop', () => {
    if (error.detail.kind !== 'loop-budget') throw new Error('wrong detail kind')
    expect(error.detail.loopLine).toBe(2)
    expect(error.detail.loopSource).toBe('while (current !== null) {')
    expect(error.detail.iterations).toBe(1_000)
  })

  it('shows the test variable unchanged from the first iteration to the last', () => {
    if (error.detail.kind !== 'loop-budget') throw new Error('wrong detail kind')
    expect(error.detail.testVariables).toEqual([
      {
        name: 'current',
        first: '{ value: 8, next: null }',
        latest: '{ value: 8, next: null }',
        changed: false,
      },
    ])
  })

  it('suggests the edit that would actually advance the pointer', () => {
    // The body only ever reads `current.value`, so the suggestion has to come
    // from the shape of the value, not from what the body mentions.
    expect(error.hint).toContain('`current` started as { value: 8, next: null }')
    expect(error.hint).toContain('Try adding `current = current.next;`')
  })
})

describe('runaway for loop', () => {
  it('names the counter that is moving away from its bound', () => {
    const error = failure(
      `
for (let i = 0; i < 10; i = i - 1) {
  let unused = i
}
`,
      { maxLoopIterations: 50 },
    )
    expect(error.detail.kind).toBe('loop-budget')
    if (error.detail.kind !== 'loop-budget') return
    expect(error.detail.loopLine).toBe(1)
    expect(error.detail.testVariables[0].name).toBe('i')
    expect(error.detail.testVariables[0].changed).toBe(true)
    expect(error.hint).toContain('away from the value that would end the loop')
  })

  it('spots a `continue` that jumps over the update', () => {
    const error = failure(
      `
let i = 0
while (i < 10) {
  if (i < 5) continue
  i = i + 1
}
`,
      { maxLoopIterations: 40 },
    )
    expect(error.detail.kind).toBe('loop-budget')
    expect(error.hint).toContain('`continue`')
    expect(error.hint).toContain('Move the update above the `continue`')
  })
})

describe('unbounded recursion', () => {
  const error = failure(
    `
function walk(node: number): number {
  return walk(node + 1)
}
walk(0)
`,
    { maxCallDepth: 25 },
  )

  it('is a recursion-depth error, not a loop-budget one', () => {
    expect(error.detail.kind).toBe('recursion-depth')
    if (error.detail.kind !== 'recursion-depth') return
    expect(error.detail.functionName).toBe('walk')
    expect(error.detail.depth).toBe(25)
    expect(error.detail.line).toBe(2)
  })

  it('explains what a base case is, in terms of this function', () => {
    expect(error.message).toBe('`walk` called itself 25 times without stopping.')
    expect(error.hint).toContain('base case')
    // The suggested check names this function's own parameter, not a generic one.
    expect(error.hint).toContain('if (node === null) return')
  })
})

describe('step budget', () => {
  it('stops a program that is slow rather than infinite', () => {
    const error = failure(
      `
let total = 0
for (let i = 0; i < 100000; i = i + 1) {
  total = total + 1
}
`,
      { stepBudget: 100, maxLoopIterations: 1_000_000 },
    )
    expect(error.detail.kind).toBe('step-budget')
    if (error.detail.kind !== 'step-budget') return
    expect(error.detail.steps).toBe(100)
    expect(error.hint).toContain('stepBudget')
  })

  it('keeps the steps it did take, so the panel can show where it got to', () => {
    const result = runToCompletion(
      src(`
let i = 0
while (true) {
  i = i + 1
}
`),
      { stepBudget: 20 },
    )
    expect(result.error?.detail.kind).toBe('step-budget')
    expect(result.trace).toHaveLength(20)
    expect(result.summary.completed).toBe(false)
  })
})

describe('budget defaults', () => {
  it('uses the documented defaults when nothing is passed', () => {
    const error = failure(`
while (true) {
  let x = 1
}
`)
    // 1,000 loop iterations is reached before 10,000 steps here.
    expect(error.message).toBe('This loop ran 1000 times and never stopped.')
  })
})
