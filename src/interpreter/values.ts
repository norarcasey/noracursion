import type {
  ArrowFunctionExpression,
  FunctionDeclaration,
  FunctionExpression,
  Pattern,
} from 'acorn'
import type { VizEvent } from '../bridge/events'
import type { Env } from './scope'

/**
 * A value produced by interpreted code.
 *
 * Arrays are real JS arrays (so `Array.isArray` narrows them); everything else
 * non-primitive is tagged, because lint bans type assertions and a tag is the
 * only way to narrow an object union with a runtime check.
 */
export type Value =
  | null
  | undefined
  | boolean
  | number
  | string
  | Value[]
  | ValueObject
  | UserFunction
  | NativeFunction
  | NativeGeneratorFunction
  | ClassValue

/**
 * Index access for a host-provided handle.
 *
 * This is what lets the injected `arr` be written the way an array is actually
 * written — `arr[j] > arr[j + 1]`, `arr.length`, `arr[i] = v` — while the
 * elements themselves stay in `core/`, where their node ids live. Without it a
 * sorting snippet would read `arr.get(j) > arr.get(j + 1)`, which is not the
 * code anyone is trying to teach.
 */
export interface IndexedAccess {
  length(): number
  get(index: number): Value
  set(index: number, value: Value): void
}

/** An object literal, an instance of an interpreted class, or a host handle. */
export interface ValueObject {
  readonly type: 'object'
  /** Non-null when this object came from `new`. */
  readonly classRef: ClassValue | null
  readonly properties: Map<string, Value>
  /** Present only on host handles that behave like arrays. */
  readonly indexed?: IndexedAccess
}

export type FunctionNode = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression

/** A function declared in interpreted source. */
export interface UserFunction {
  readonly type: 'function'
  readonly name: string
  readonly node: FunctionNode
  readonly params: readonly Pattern[]
  readonly closure: Env
  /**
   * `this` for class methods, and for arrows the `this` captured where they
   * were written. `undefined` for plain functions — `this` outside a class
   * method is not in the v1 subset.
   */
  readonly thisValue: Value
}

export interface ClassValue {
  readonly type: 'class'
  readonly name: string
  readonly constructorFn: UserFunction | null
  readonly methods: Map<string, UserFunction>
}

/** What a native implementation is handed so it can report errors and call back. */
export interface NativeContext {
  /** Call an interpreted value; array higher-order methods need this. */
  callValue(callee: Value, args: Value[]): Generator<Step, Value, void>
  /** Raise a runtime error positioned at the current call site. */
  fail(message: string, hint: string): never
  emit(event: VizEvent): void
}

/** A builtin that cannot run interpreted code, so it needs no step budget. */
export interface NativeFunction {
  readonly type: 'native'
  readonly name: string
  readonly call: (args: readonly Value[], ctx: NativeContext) => Value
}

/** A builtin that calls back into user code (`map`, `sort`, …) and so yields. */
export interface NativeGeneratorFunction {
  readonly type: 'native-generator'
  readonly name: string
  readonly call: (args: readonly Value[], ctx: NativeContext) => Generator<Step, Value, void>
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/** Where in the program a step was taken. `nodeType` stays the real AST type. */
export type StepPhase =
  | 'statement'
  | 'loop-test'
  | 'function-entry'
  | 'function-exit'
  /**
   * One final step after the last statement. Events ride on the step *after*
   * the one that emitted them ("emitted since the previous step"), so without a
   * closing frame anything the last statement emitted would be dropped on the
   * floor. It also gives the host an unambiguous "the run is over" frame.
   */
  | 'program-exit'

/**
 * One observable point in the run. CLAUDE.md §3.2 types `scope` as
 * `Record<string, unknown>`; it is narrowed to `Snapshot` here, which is
 * assignable to `unknown` but tells the variables panel what it is holding.
 * `phase` is an addition — it is what makes a golden trace readable, and it
 * saves the host from parsing meaning out of a stringly-typed `nodeType`.
 */
export interface Step {
  readonly line: number
  readonly column: number
  readonly nodeType: string
  readonly phase: StepPhase
  readonly scope: Record<string, Snapshot>
  readonly callDepth: number
  /**
   * The functions currently on the stack, outermost first.
   *
   * `callDepth` alone gives a number; this gives the view. §3.2 calls the
   * call-stack panel "how you make recursion legible", and a panel that can
   * only say "depth 4" is not that.
   */
  readonly callStack: readonly string[]
  /** Events emitted since the previous step. */
  readonly events: readonly VizEvent[]
}

/** CLAUDE.md §2 names this `StepInfo` on `onStep`; same thing. */
export type StepInfo = Step

export interface RunSummary {
  readonly steps: number
  /** False when the run ended at an error rather than at the end of the program. */
  readonly completed: boolean
  readonly logs: readonly string[]
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

/**
 * An immutable rendering of a value, taken at the moment of capture.
 *
 * This exists because a "shallow snapshot" of live references is not a snapshot
 * at all: the variables panel would show every past step's `current` pointing at
 * whatever the node is *now*, and the loop diagnostic's `first` vs `latest`
 * comparison — the whole teaching payload — would always report "unchanged".
 */
export type Snapshot =
  | { readonly kind: 'primitive'; readonly value: string | number | boolean | null | undefined }
  | { readonly kind: 'array'; readonly items: readonly Snapshot[]; readonly truncated: boolean }
  | {
      readonly kind: 'object'
      readonly className: string | null
      readonly entries: ReadonlyArray<readonly [string, Snapshot]>
      readonly truncated: boolean
    }
  | { readonly kind: 'function'; readonly name: string }
  | { readonly kind: 'class'; readonly name: string }
  /** The value points back at something already on this capture path. */
  | { readonly kind: 'cyclic' }
  /** Capture stopped here to keep snapshots cheap. */
  | { readonly kind: 'elided' }

const MAX_DEPTH = 4
const MAX_ITEMS = 24

export function capture(value: Value, depth = 0, seen: Set<object> = new Set()): Snapshot {
  if (value === null || value === undefined) return { kind: 'primitive', value }
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return { kind: 'primitive', value }
  }
  if (seen.has(value)) return { kind: 'cyclic' }
  if (depth >= MAX_DEPTH) return { kind: 'elided' }

  const nested = new Set(seen)
  nested.add(value)

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((item) => capture(item, depth + 1, nested))
    return { kind: 'array', items, truncated: value.length > MAX_ITEMS }
  }
  if (value.type === 'function' || value.type === 'native' || value.type === 'native-generator') {
    return { kind: 'function', name: value.name }
  }
  if (value.type === 'class') return { kind: 'class', name: value.name }

  const entries: Array<readonly [string, Snapshot]> = []
  let truncated = false
  for (const [key, property] of value.properties) {
    if (entries.length >= MAX_ITEMS) {
      truncated = true
      break
    }
    entries.push([key, capture(property, depth + 1, nested)])
  }
  return {
    kind: 'object',
    className: value.classRef === null ? null : value.classRef.name,
    entries,
    truncated,
  }
}

/**
 * Render a snapshot for a teaching panel or a golden trace. `depth` controls how
 * far nested values are spelled out before collapsing to `…`.
 */
export function formatSnapshot(snapshot: Snapshot, depth = 2): string {
  switch (snapshot.kind) {
    case 'primitive':
      return typeof snapshot.value === 'string'
        ? JSON.stringify(snapshot.value)
        : String(snapshot.value)
    case 'function':
      return `function ${snapshot.name}`
    case 'class':
      return `class ${snapshot.name}`
    case 'cyclic':
      return '[circular]'
    case 'elided':
      return '…'
    case 'array': {
      if (depth <= 0) return snapshot.items.length === 0 ? '[]' : '[…]'
      const items = snapshot.items.map((item) => formatSnapshot(item, depth - 1))
      if (snapshot.truncated) items.push('…')
      return `[${items.join(', ')}]`
    }
    case 'object': {
      const name = snapshot.className === null ? '' : `${snapshot.className} `
      if (depth <= 0) return snapshot.entries.length === 0 ? `${name}{}` : `${name}{…}`
      const entries = snapshot.entries.map(
        ([key, entry]) => `${key}: ${formatSnapshot(entry, depth - 1)}`,
      )
      if (snapshot.truncated) entries.push('…')
      return entries.length === 0 ? `${name}{}` : `${name}{ ${entries.join(', ')} }`
    }
  }
}

/** Convenience for diagnostics: capture and render in one go. */
export function describe(value: Value): string {
  return formatSnapshot(capture(value))
}

// ---------------------------------------------------------------------------
// Value operations
// ---------------------------------------------------------------------------

export function isCallable(
  value: Value,
): value is UserFunction | NativeFunction | NativeGeneratorFunction {
  if (value === null || value === undefined || Array.isArray(value)) return false
  if (typeof value !== 'object') return false
  return value.type === 'function' || value.type === 'native' || value.type === 'native-generator'
}

export function isValueObject(value: Value): value is ValueObject {
  if (value === null || value === undefined || Array.isArray(value)) return false
  return typeof value === 'object' && value.type === 'object'
}

export function isClassValue(value: Value): value is ClassValue {
  if (value === null || value === undefined || Array.isArray(value)) return false
  return typeof value === 'object' && value.type === 'class'
}

export function truthy(value: Value): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value)
  if (typeof value === 'string') return value.length > 0
  return true
}

/** The name to use for a value in an error message: "a number", "an object". */
export function typeName(value: Value): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'an array'
  switch (typeof value) {
    case 'boolean':
      return 'a boolean'
    case 'number':
      return 'a number'
    case 'string':
      return 'a string'
  }
  switch (value.type) {
    case 'function':
    case 'native':
    case 'native-generator':
      return 'a function'
    case 'class':
      return 'a class'
    case 'object':
      return value.classRef === null ? 'an object' : `a ${value.classRef.name}`
  }
}

/** String conversion for template literals and `console.log`. */
export function stringify(value: Value): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(stringify).join(',')
  return formatSnapshot(capture(value))
}
