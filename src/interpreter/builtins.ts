import {
  isCallable,
  stringify,
  typeName,
  type NativeContext,
  type NativeFunction,
  type NativeGeneratorFunction,
  type Step,
  type Value,
  type ValueObject,
} from './values'

/**
 * The builtins the v1 subset promises (CLAUDE.md §3.2): `Math.*`,
 * `console.log`, and the listed `Array.prototype` methods.
 *
 * There are no prototypes here — prototypes are explicitly out of the subset —
 * so member access on an array returns a native already bound to that array.
 * Anything not on the list is `undefined`, and the interpreter turns that into
 * a message naming the method and the line.
 */

function native(name: string, call: NativeFunction['call']): NativeFunction {
  return { type: 'native', name, call }
}

function nativeGenerator(
  name: string,
  call: NativeGeneratorFunction['call'],
): NativeGeneratorFunction {
  return { type: 'native-generator', name, call }
}

function requireNumber(value: Value, ctx: NativeContext, where: string): number {
  if (typeof value !== 'number') {
    ctx.fail(
      `${where} needs a number, but got ${typeName(value)}.`,
      `Check the value passed to ${where} — it has to be a number.`,
    )
  }
  return value
}

function requireCallback(value: Value, ctx: NativeContext, where: string): Value {
  if (!isCallable(value)) {
    ctx.fail(
      `${where} needs a function, but got ${typeName(value)}.`,
      `Pass a function to ${where}, e.g. \`${where}((item) => item * 2)\`.`,
    )
  }
  return value
}

/** JS's default sort order: compare elements as strings. */
function defaultCompare(a: Value, b: Value): number {
  const left = stringify(a)
  const right = stringify(b)
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * Array methods. Returns `undefined` for an unknown name so the caller can
 * report it with a line number.
 */
export function arrayMember(target: Value[], name: string): Value | undefined {
  switch (name) {
    case 'length':
      return target.length

    case 'push':
      return native('push', (args) => {
        for (const arg of args) target.push(arg)
        return target.length
      })

    case 'pop':
      return native('pop', () => (target.length === 0 ? undefined : target.pop()))

    case 'shift':
      return native('shift', () => (target.length === 0 ? undefined : target.shift()))

    case 'unshift':
      return native('unshift', (args) => {
        target.unshift(...args)
        return target.length
      })

    case 'slice':
      return native('slice', (args, ctx) => {
        const start = args.length > 0 ? requireNumber(args[0], ctx, 'slice') : 0
        if (args.length > 1) return target.slice(start, requireNumber(args[1], ctx, 'slice'))
        return target.slice(start)
      })

    case 'concat':
      return native('concat', (args) => {
        const result = target.slice()
        for (const arg of args) {
          if (Array.isArray(arg)) result.push(...arg)
          else result.push(arg)
        }
        return result
      })

    case 'indexOf':
      return native('indexOf', (args) => target.indexOf(args.length > 0 ? args[0] : undefined))

    case 'includes':
      return native('includes', (args) => target.includes(args.length > 0 ? args[0] : undefined))

    case 'join':
      return native('join', (args) => {
        const separator = args.length > 0 && typeof args[0] === 'string' ? args[0] : ','
        return target.map(stringify).join(separator)
      })

    case 'reverse':
      return native('reverse', () => {
        target.reverse()
        return target
      })

    case 'forEach':
      return nativeGenerator('forEach', function* (args, ctx) {
        const callback = requireCallback(args[0], ctx, 'forEach')
        for (let index = 0; index < target.length; index += 1) {
          yield* ctx.callValue(callback, [target[index], index, target])
        }
        return undefined
      })

    case 'map':
      return nativeGenerator('map', function* (args, ctx) {
        const callback = requireCallback(args[0], ctx, 'map')
        const result: Value[] = []
        for (let index = 0; index < target.length; index += 1) {
          result.push(yield* ctx.callValue(callback, [target[index], index, target]))
        }
        return result
      })

    case 'filter':
      return nativeGenerator('filter', function* (args, ctx) {
        const callback = requireCallback(args[0], ctx, 'filter')
        const result: Value[] = []
        for (let index = 0; index < target.length; index += 1) {
          const keep = yield* ctx.callValue(callback, [target[index], index, target])
          if (truthyEnough(keep)) result.push(target[index])
        }
        return result
      })

    case 'reduce':
      return nativeGenerator('reduce', function* (args, ctx) {
        const callback = requireCallback(args[0], ctx, 'reduce')
        let index = 0
        let accumulator: Value
        if (args.length > 1) {
          accumulator = args[1]
        } else {
          if (target.length === 0) {
            ctx.fail(
              'reduce of an empty array with no starting value.',
              'Give reduce a starting value as its second argument, e.g. `reduce((a, b) => a + b, 0)`.',
            )
          }
          accumulator = target[0]
          index = 1
        }
        for (; index < target.length; index += 1) {
          accumulator = yield* ctx.callValue(callback, [accumulator, target[index], index, target])
        }
        return accumulator
      })

    case 'sort':
      // Insertion sort rather than delegating to Array.prototype.sort: the
      // comparator may be interpreted code, which has to be driven with
      // `yield*`, and a hand-rolled sort is deterministic across engines —
      // which the golden traces depend on.
      return nativeGenerator('sort', function* (args, ctx) {
        const comparator = args.length > 0 && args[0] !== undefined ? args[0] : null
        if (comparator !== null) requireCallback(comparator, ctx, 'sort')
        for (let i = 1; i < target.length; i += 1) {
          const current = target[i]
          let j = i - 1
          while (j >= 0) {
            const order =
              comparator === null
                ? defaultCompare(target[j], current)
                : requireNumber(yield* ctx.callValue(comparator, [target[j], current]), ctx, 'sort')
            if (order <= 0) break
            target[j + 1] = target[j]
            j -= 1
          }
          target[j + 1] = current
        }
        return target
      })

    default:
      return undefined
  }
}

/** Only `length` — string methods are not in the v1 subset. */
export function stringMember(target: string, name: string): Value | undefined {
  return name === 'length' ? target.length : undefined
}

/** Local truthiness, kept here so builtins do not import the interpreter. */
function truthyEnough(value: Value): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value)
  if (typeof value === 'string') return value.length > 0
  return true
}

function makeObject(entries: ReadonlyArray<readonly [string, Value]>): ValueObject {
  return { type: 'object', classRef: null, properties: new Map(entries) }
}

function mathFn(name: string, fn: (n: number) => number): readonly [string, Value] {
  return [name, native(name, (args, ctx) => fn(requireNumber(args[0], ctx, `Math.${name}`)))]
}

/**
 * The global scope's contents. `emit` is threaded in so `console.log` can put a
 * `log` event on the step that runs it — events are the only channel between
 * interpreted code and the renderer (§3.4).
 */
export function createGlobals(onLog: (text: string) => void): Map<string, Value> {
  const math = makeObject([
    mathFn('abs', Math.abs),
    mathFn('floor', Math.floor),
    mathFn('ceil', Math.ceil),
    mathFn('round', Math.round),
    mathFn('trunc', Math.trunc),
    mathFn('sign', Math.sign),
    mathFn('sqrt', Math.sqrt),
    [
      'pow',
      native('pow', (args, ctx) =>
        Math.pow(requireNumber(args[0], ctx, 'Math.pow'), requireNumber(args[1], ctx, 'Math.pow')),
      ),
    ],
    [
      'min',
      native('min', (args, ctx) =>
        Math.min(...args.map((arg) => requireNumber(arg, ctx, 'Math.min'))),
      ),
    ],
    [
      'max',
      native('max', (args, ctx) =>
        Math.max(...args.map((arg) => requireNumber(arg, ctx, 'Math.max'))),
      ),
    ],
    ['random', native('random', () => Math.random())],
    ['PI', Math.PI],
    ['E', Math.E],
  ])

  const log = native('log', (args, ctx) => {
    const text = args.map(stringify).join(' ')
    onLog(text)
    ctx.emit({ type: 'log', text })
    return undefined
  })

  return new Map<string, Value>([
    ['Math', math],
    // Conversions and the numeric edge cases. `Infinity` in particular is what
    // "no route yet" looks like in a shortest-path algorithm, so a subset
    // without it cannot express one.
    ['Infinity', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
    ['String', native('String', (args) => (args.length === 0 ? '' : stringify(args[0])))],
    [
      'Number',
      native('Number', (args) => {
        const value = args[0]
        if (typeof value === 'number') return value
        if (typeof value === 'string') return Number(value)
        if (typeof value === 'boolean') return value ? 1 : 0
        return Number.NaN
      }),
    ],
    ['Boolean', native('Boolean', (args) => truthyEnough(args.length === 0 ? undefined : args[0]))],
    ['console', makeObject([['log', log]])],
    // §3.4 lists a bare `log(...)` in the injected runtime. It is the same
    // function as `console.log`, so both feed the one output pane rather than
    // two subtly different ones.
    ['log', log],
  ])
}

export type { Step }
