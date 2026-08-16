import { describe, expect, it } from 'vitest'
import { formatTrace, runToCompletion } from './run'

/**
 * Golden traces (CLAUDE.md §6.1).
 *
 * These are written out by hand rather than snapshotted, and they are meant to
 * be strict: if a change moves a line, adds a step, or alters what the
 * variables panel would show, one of these fails and the diff says exactly
 * which step changed. Read the expected trace before updating it.
 */

/** Fixtures lead with a newline for readability; drop it so line 1 is line 1. */
const src = (text: string): string => text.replace(/^\n/, '')

function trace(source: string): string[] {
  const result = runToCompletion(src(source))
  if (result.error !== null) {
    throw new Error(`unexpected error: ${result.error.message}`)
  }
  return formatTrace(result.trace)
}

describe('golden traces', () => {
  it('steps a counting loop, yielding at the test on every iteration', () => {
    expect(
      trace(`
let total = 0
for (let i = 0; i < 2; i = i + 1) {
  total = total + i
}
console.log(total)
`),
    ).toEqual([
      'L1 statement VariableDeclaration d0',
      'L2 statement ForStatement d0 | total=0',
      'L2 loop-test BinaryExpression d0 | i=0 total=0',
      'L3 statement ExpressionStatement d0 | i=0 total=0',
      'L2 loop-test BinaryExpression d0 | i=1 total=0',
      'L3 statement ExpressionStatement d0 | i=1 total=0',
      'L2 loop-test BinaryExpression d0 | i=2 total=1',
      'L5 statement ExpressionStatement d0 | total=1',
      'L5 program-exit Program d0 | total=1 <log>',
    ])
  })

  it('records call depth through recursion, which is how the call stack is drawn', () => {
    expect(
      trace(`
function fact(n: number): number {
  if (n <= 1) return 1
  return n * fact(n - 1)
}
console.log(fact(3))
`),
    ).toEqual([
      'L1 statement FunctionDeclaration d0 | fact=function fact',
      'L5 statement ExpressionStatement d0 | fact=function fact',
      'L1 function-entry FunctionDeclaration d1 | fact=function fact n=3',
      'L2 statement IfStatement d1 | fact=function fact n=3',
      'L3 statement ReturnStatement d1 | fact=function fact n=3',
      'L1 function-entry FunctionDeclaration d2 | fact=function fact n=2',
      'L2 statement IfStatement d2 | fact=function fact n=2',
      'L3 statement ReturnStatement d2 | fact=function fact n=2',
      'L1 function-entry FunctionDeclaration d3 | fact=function fact n=1',
      'L2 statement IfStatement d3 | fact=function fact n=1',
      'L2 statement ReturnStatement d3 | fact=function fact n=1',
      'L1 function-exit FunctionDeclaration d3 | fact=function fact n=1',
      'L1 function-exit FunctionDeclaration d2 | fact=function fact n=2',
      'L1 function-exit FunctionDeclaration d1 | fact=function fact n=3',
      'L5 program-exit Program d0 | fact=function fact <log>',
    ])
  })

  it('walks a linked list with a while loop', () => {
    expect(
      trace(`
const list = { value: 1, next: { value: 2, next: null } }
let current = list
while (current !== null) {
  current = current.next
}
`),
    ).toEqual([
      'L1 statement VariableDeclaration d0',
      'L2 statement VariableDeclaration d0 | list={ value: 1, next: {…} }',
      'L3 statement WhileStatement d0 | current={ value: 1, next: {…} } list={ value: 1, next: {…} }',
      'L3 loop-test BinaryExpression d0 | current={ value: 1, next: {…} } list={ value: 1, next: {…} }',
      'L4 statement ExpressionStatement d0 | current={ value: 1, next: {…} } list={ value: 1, next: {…} }',
      'L3 loop-test BinaryExpression d0 | current={ value: 2, next: null } list={ value: 1, next: {…} }',
      'L4 statement ExpressionStatement d0 | current={ value: 2, next: null } list={ value: 1, next: {…} }',
      'L3 loop-test BinaryExpression d0 | current=null list={ value: 1, next: {…} }',
      'L5 program-exit Program d0 | current=null list={ value: 1, next: {…} }',
    ])
  })

  it('reports the line of the original TypeScript, not of the stripped source', () => {
    // Sucrase blanks the interface but keeps the line count, so `total` is
    // still declared on line 5 as far as the learner is concerned.
    expect(
      trace(`
interface Counter {
  total: number
}

let total: number = 0
total = total + 1
`),
    ).toEqual([
      'L5 statement VariableDeclaration d0',
      'L6 statement ExpressionStatement d0 | total=0',
      'L6 program-exit Program d0 | total=1',
    ])
  })
})

describe('snapshot immutability', () => {
  it('captures values at the moment of the step, not by reference', () => {
    // Without this, every step in the panel would show the value the object
    // ended up with, and the loop diagnostic's first-vs-latest comparison would
    // always report "unchanged".
    const result = runToCompletion(
      src(`
const node = { value: 1 }
node.value = 2
node.value = 3
`),
    )
    expect(result.error).toBeNull()
    const values = result.trace
      .map((step) => step.scope.node)
      .filter((snapshot) => snapshot !== undefined)
      .map((snapshot) => (snapshot.kind === 'object' ? snapshot.entries[0][1] : null))
      .map((snapshot) =>
        snapshot !== null && snapshot.kind === 'primitive' ? snapshot.value : null,
      )
    expect(values).toEqual([1, 2, 3])
  })
})

describe('events', () => {
  it('delivers log events, including one emitted by the final statement', () => {
    const result = runToCompletion(
      src(`
console.log('first')
console.log('second')
`),
    )
    expect(result.error).toBeNull()
    expect(result.summary.logs).toEqual(['first', 'second'])
    // Events ride on the step after the one that emitted them, so the last
    // log can only arrive on the closing frame.
    const events = result.trace.flatMap((step) => step.events)
    expect(events).toEqual([
      { type: 'log', text: 'first' },
      { type: 'log', text: 'second' },
    ])
    expect(result.trace[result.trace.length - 1].phase).toBe('program-exit')
  })
})

describe('step-back support', () => {
  it('produces a trace that can be replayed by index rather than re-executed', () => {
    const result = runToCompletion(
      src(`
let i = 0
i = i + 1
i = i + 1
`),
    )
    expect(result.error).toBeNull()
    // Stepping back is reading trace[n - 1]; the snapshots make that correct
    // without inverting a single mutation.
    const seen = result.trace.map((step) =>
      step.scope.i !== undefined && step.scope.i.kind === 'primitive'
        ? step.scope.i.value
        : 'unset',
    )
    expect(seen).toEqual(['unset', 0, 1, 2])
  })
})
