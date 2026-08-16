import { describe, expect, it } from 'vitest'
import type { RunOptions } from './interpret'
import { runToCompletion } from './run'

/**
 * Semantics of the supported subset (CLAUDE.md §3.2).
 *
 * Programs report through `console.log` so each case asserts on behaviour the
 * interpreter actually produces, not on interpreter internals.
 */

const src = (text: string): string => text.replace(/^\n/, '')

function logs(source: string, options: RunOptions = {}): string[] {
  const result = runToCompletion(src(source), options)
  if (result.error !== null) {
    throw new Error(`unexpected error: ${result.error.message}`)
  }
  return [...result.summary.logs]
}

function failure(source: string): { message: string; line: number; hint: string } {
  const result = runToCompletion(src(source))
  if (result.error === null) throw new Error('expected the run to fail, but it completed')
  const { detail } = result.error
  const line = 'line' in detail ? detail.line : 'loopLine' in detail ? detail.loopLine : -1
  return { message: result.error.message, line, hint: result.error.hint }
}

describe('declarations and assignment', () => {
  it('handles let, const, var and compound assignment', () => {
    expect(
      logs(`
let a = 1
const b = 2
var c = 3
a += 10
a -= 1
a *= 2
console.log(a, b, c)
`),
    ).toEqual(['20 2 3'])
  })

  it('handles prefix and postfix update', () => {
    expect(
      logs(`
let i = 0
console.log(i++)
console.log(i)
console.log(++i)
console.log(i--)
console.log(--i)
`),
    ).toEqual(['0', '1', '2', '2', '0'])
  })

  it('refuses to reassign a const, naming the line', () => {
    const error = failure(`
const total = 1
total = 2
`)
    expect(error.message).toBe('`total` is declared with `const`, so it cannot be reassigned.')
    expect(error.line).toBe(2)
    expect(error.hint).toContain('`let`')
  })

  it('reports an undefined variable with a suggestion', () => {
    const error = failure(`
let a = 1
console.log(b)
`)
    expect(error.message).toBe('`b` is not defined.')
    expect(error.line).toBe(2)
  })
})

describe('operators', () => {
  it('does arithmetic, comparison, logical and ternary', () => {
    expect(
      logs(`
console.log(7 / 2, 7 % 2, 2 ** 3)
console.log(1 < 2, 2 <= 2, 3 > 4, 'a' < 'b')
console.log(1 === 1, 1 !== 2, null == undefined)
console.log(true && 'yes', false || 'fallback', null ?? 'default')
console.log(1 > 2 ? 'x' : 'y')
`),
    ).toEqual(['3.5 1 8', 'true true false true', 'true true true', 'yes fallback default', 'y'])
  })

  it('joins strings with + and builds template literals', () => {
    expect(
      logs(`
const name = 'tree'
const size = 3
console.log('a ' + name)
console.log(\`the \${name} has \${size} nodes\`)
`),
    ).toEqual(['a tree', 'the tree has 3 nodes'])
  })

  it('refuses to compare things that are not comparable', () => {
    const error = failure(`
const node = { value: 1 }
if (node < 2) console.log('never')
`)
    expect(error.message).toContain('Cannot compare an object with a number')
    expect(error.hint).toContain('=== null')
  })
})

describe('control flow', () => {
  it('runs if/else, while, do...while, for and for...of', () => {
    expect(
      logs(`
let out = []
if (1 > 2) out.push('no')
else out.push('else')

let w = 0
while (w < 2) {
  out.push('while' + w)
  w = w + 1
}

let d = 0
do {
  out.push('do' + d)
  d = d + 1
} while (d < 1)

for (let i = 0; i < 2; i++) out.push('for' + i)
for (const item of ['a', 'b']) out.push(item)

console.log(out.join(','))
`),
    ).toEqual(['else,while0,while1,do0,for0,for1,a,b'])
  })

  it('honours break and continue', () => {
    expect(
      logs(`
let kept = []
for (let i = 0; i < 6; i++) {
  if (i === 4) break
  if (i % 2 === 1) continue
  kept.push(i)
}
console.log(kept.join(','))
`),
    ).toEqual(['0,2'])
  })

  it('iterates a string with for...of', () => {
    expect(logs(`for (const c of 'abc') console.log(c)`)).toEqual(['a', 'b', 'c'])
  })
})

describe('functions', () => {
  it('supports declarations, arrows, closures and recursion', () => {
    expect(
      logs(`
function double(n: number): number {
  return n * 2
}
const triple = (n: number): number => n * 3

function counter() {
  let count = 0
  return () => {
    count = count + 1
    return count
  }
}
const next = counter()
next()

function fib(n: number): number {
  if (n < 2) return n
  return fib(n - 1) + fib(n - 2)
}

console.log(double(4), triple(3), next(), fib(7))
`),
    ).toEqual(['8 9 2 13'])
  })

  it('returns undefined from a function with no return', () => {
    expect(
      logs(`
function nothing() {}
console.log(nothing())
`),
    ).toEqual(['undefined'])
  })

  it('reports calling something that is not a function', () => {
    const error = failure(`
const value = 5
value()
`)
    expect(error.message).toBe('`value` is not a function — it is a number.')
    expect(error.line).toBe(2)
  })
})

describe('arrays and objects', () => {
  it('supports literals, index access and member access', () => {
    expect(
      logs(`
const arr = [1, 2, 3]
const obj = { name: 'root', child: { name: 'leaf' } }
console.log(arr[0], arr[arr.length - 1])
console.log(obj.name, obj.child.name, obj['name'])
arr[1] = 20
obj.name = 'changed'
console.log(arr.join('-'), obj.name)
`),
    ).toEqual(['1 3', 'root leaf root', '1-20-3 changed'])
  })

  it('supports every array method in the subset', () => {
    expect(
      logs(`
const a = [3, 1, 2]
console.log(a.slice(1).join(','))
console.log(a.concat([4]).join(','))
console.log(a.indexOf(1), a.includes(9))
console.log(a.map((n) => n * 2).join(','))
console.log(a.filter((n) => n > 1).join(','))
console.log(a.reduce((sum, n) => sum + n, 0))
console.log(a.reduce((sum, n) => sum + n))
let seen = []
a.forEach((n) => seen.push(n))
console.log(seen.join(','))
console.log(a.sort((x, y) => x - y).join(','))
const stack = [1, 2]
stack.push(3)
console.log(stack.pop(), stack.shift())
stack.unshift(0)
console.log(stack.join(','), stack.reverse().join(','))
`),
    ).toEqual([
      '1,2',
      '3,1,2,4',
      '1 false',
      '6,2,4',
      '3,2',
      '6',
      '6',
      '3,1,2',
      '1,2,3',
      '3 1',
      '0,2 2,0',
    ])
  })

  it('sorts lexicographically with no comparator, like JS does', () => {
    expect(logs(`console.log([10, 9, 1].sort().join(','))`)).toEqual(['1,10,9'])
  })

  it('names an array method that does not exist', () => {
    const error = failure(`
const a = [1]
a.flatMap((n) => n)
`)
    expect(error.message).toBe('Arrays here do not have a `flatMap` method.')
    expect(error.hint).toContain('push, pop, shift')
  })

  it('gives the null-property error a teaching hint', () => {
    const error = failure(`
let node = null
console.log(node.value)
`)
    expect(error.message).toBe('Cannot read `value` of null.')
    expect(error.line).toBe(2)
    expect(error.hint).toContain('if (x === null) return')
  })
})

describe('classes', () => {
  it('supports a constructor, methods and this', () => {
    expect(
      logs(`
class Node {
  constructor(value: number) {
    this.value = value
    this.next = null
  }
  describe(): string {
    return 'Node(' + this.value + ')'
  }
  bump(): void {
    this.value = this.value + 1
  }
}

const a = new Node(1)
const b = new Node(2)
a.next = b
a.bump()
console.log(a.describe(), b.describe(), a.next.value)
`),
    ).toEqual(['Node(2) Node(2) 2'])
  })

  it('refuses `new` on something that is not a class', () => {
    const error = failure(`
function notAClass() {}
const x = new notAClass()
`)
    expect(error.message).toContain('`new` needs a class')
  })

  it('refuses `this` outside a method', () => {
    const error = failure(`console.log(this.value)`)
    expect(error.message).toBe('`this` is only available inside a class method.')
  })
})

describe('destructuring', () => {
  it('supports simple array and object patterns', () => {
    expect(
      logs(`
const [first, second] = [1, 2]
const { name, count } = { name: 'x', count: 7 }
console.log(first, second, name, count)
`),
    ).toEqual(['1 2 x 7'])
  })
})

describe('builtins', () => {
  it('supports the Math functions in the subset', () => {
    expect(
      logs(`
console.log(Math.floor(1.7), Math.ceil(1.2), Math.round(1.5))
console.log(Math.abs(-3), Math.min(2, 1, 3), Math.max(2, 1, 3))
console.log(Math.sqrt(9), Math.pow(2, 5), Math.trunc(-1.7), Math.sign(-4))
`),
    ).toEqual(['1 2 2', '3 1 3', '3 32 -1 -1'])
  })

  it('logs multiple arguments separated by a space', () => {
    expect(logs(`console.log('a', 1, true, null, [1, 2])`)).toEqual(['a 1 true null 1,2'])
  })
})

describe('unsupported syntax', () => {
  const cases: ReadonlyArray<readonly [string, string, number]> = [
    // Reported as `async` rather than `await`: the function node is reached
    // first, and naming the declaration is the more useful message anyway.
    ['async function f() { await 1 }', '`async` functions', 1],
    ['try { let a = 1 } catch (e) { let b = 2 }', '`try` / `catch`', 1],
    ['throw 1', '`throw`', 1],
    ['switch (1) { case 1: break }', '`switch`', 1],
    ['for (const k in { a: 1 }) console.log(k)', '`for...in` loops', 1],
    ['function* gen() { yield 1 }', 'generator functions', 1],
    ['const a = [1]\nconst b = [...a]', 'spread (`...`) in calls and literals', 2],
    ['function f(...args) {}\nf()', 'rest parameters (`...args`)', 1],
    ['function f(a = 1) {}\nf()', 'default parameter values', 1],
    ['const a = { b: 1 }\nconsole.log(a?.b)', 'optional chaining (`?.`)', 2],
    ['const r = /abc/\nconsole.log(r)', 'regular expressions', 1],
    // The binding has to be used: an unused import is elided by the TypeScript
    // transform before the parser ever sees it, which is correct TS behaviour.
    ['import { x } from "y"\nx()', '`import`', 1],
    ['class A { field = 1 }\nnew A()', 'class fields declared outside the constructor', 1],
  ]

  it.each(cases)('rejects %s with a named construct and a line', (source, construct, line) => {
    const result = runToCompletion(src(source))
    expect(result.error).not.toBeNull()
    if (result.error === null) return
    expect(result.error.detail.kind).toBe('unsupported-syntax')
    if (result.error.detail.kind !== 'unsupported-syntax') return
    expect(result.error.detail.construct).toBe(construct)
    expect(result.error.detail.line).toBe(line)
    expect(result.error.message).toBe(`Noracursion can't run ${construct} yet.`)
  })
})
