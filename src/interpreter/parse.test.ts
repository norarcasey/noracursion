import { describe, expect, it } from 'vitest'
import { NoracursionError } from './errors'
import { parse } from './parse'
import { runToCompletion } from './run'

/**
 * The type-stripping contract.
 *
 * Stripping is an internal detail that must not leak into the public API
 * (CLAUDE.md §3.2), but one property of it is load-bearing and therefore worth
 * pinning: line numbers survive. Every current-line highlight and every error
 * panel is built on that.
 */

const src = (text: string): string => text.replace(/^\n/, '')

describe('type stripping', () => {
  it('runs code that is annotated, generic, and interface-typed', () => {
    const result = runToCompletion(
      src(`
interface Counter {
  total: number
}
type Label = string

function tally<T>(items: T[]): number {
  let total: number = 0
  for (const item of items) {
    total = total + 1
  }
  return total
}

const label: Label = 'count'
const counter: Counter = { total: tally([1, 2, 3]) }
console.log(\`\${label}: \${counter.total}\`)
`),
    )
    expect(result.error).toBeNull()
    expect(result.summary.logs).toEqual(['count: 3'])
  })

  it('accepts `as` assertions in interpreted source', () => {
    // Lint bans `as` in this package's own code; snippets a learner types are
    // not bound by that, so the interpreter has to cope with it.
    const result = runToCompletion(src(`const n = 1 as number\nconsole.log(n)`))
    expect(result.error).toBeNull()
    expect(result.summary.logs).toEqual(['1'])
  })

  it('keeps the line count identical to the original source', () => {
    const source = src(`
interface Wide {
  a: number
  b: number
}

const value: Wide = { a: 1, b: 2 }
`)
    const parsed = parse(source)
    // The interface is blanked, not removed — line 6 is still line 6.
    expect(parsed.sourceLine(6)).toBe('const value: Wide = { a: 1, b: 2 }')
    expect(parsed.program.body).toHaveLength(1)
    expect(parsed.program.body[0].loc?.start.line).toBe(6)
  })

  it('reports a runtime error on the original line, past stripped types', () => {
    const result = runToCompletion(
      src(`
interface Node {
  value: number
}

const node: Node | null = null
console.log(node.value)
`),
    )
    expect(result.error).not.toBeNull()
    expect(result.error?.detail.kind).toBe('runtime')
    if (result.error?.detail.kind !== 'runtime') return
    expect(result.error.detail.line).toBe(6)
  })
})

describe('syntax errors', () => {
  it('reports a parse error with the line it is on', () => {
    const result = runToCompletion(src(`let a = 1\nlet b = (\n`))
    expect(result.error).toBeInstanceOf(NoracursionError)
    expect(result.error?.detail.kind).toBe('parse')
    if (result.error?.detail.kind !== 'parse') return
    expect(result.error.detail.line).toBeGreaterThanOrEqual(2)
    expect(result.error.hint).toContain('line')
  })

  it('drops acorn’s duplicated "(line:column)" suffix from the message', () => {
    const result = runToCompletion(src(`let = 1`))
    expect(result.error?.message ?? '').not.toMatch(/\(\d+:\d+\)$/)
  })

  it('produces no trace when the program never starts', () => {
    const result = runToCompletion(src(`function (`))
    expect(result.trace).toEqual([])
    expect(result.summary.completed).toBe(false)
  })
})

describe('empty programs', () => {
  it('runs a program with no statements', () => {
    const result = runToCompletion('')
    expect(result.error).toBeNull()
    expect(result.summary.completed).toBe(true)
    expect(result.trace).toHaveLength(1)
    expect(result.trace[0].phase).toBe('program-exit')
  })
})
