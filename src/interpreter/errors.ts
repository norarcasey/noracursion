/**
 * Every failure the interpreter can produce, as one error class carrying a
 * discriminated `detail`.
 *
 * CLAUDE.md §3.3 sketches this as a class hierarchy (`interface LoopBudgetError
 * extends NoracursionError`). One class with a `detail` union is used instead:
 * throwing requires a real `Error` subclass either way, a union narrows without
 * a chain of `instanceof` checks, and §9 prefers discriminated unions over
 * inheritance. Consumers write `if (error.detail.kind === 'loop-budget')` and
 * get the diagnostic fields typed.
 *
 * Every detail names a line, and every error carries a `hint` that suggests a
 * concrete next edit. "An error occurred" is a failure of this component's
 * entire premise (§3.3).
 */

/** A loop-test variable, sampled at the first iteration and at the overflow. */
export interface TestVariable {
  readonly name: string
  /** Rendered value the first time the loop test ran. */
  readonly first: string
  /** Rendered value when the budget was exhausted. */
  readonly latest: string
  readonly changed: boolean
}

export type ErrorDetail =
  /** The source is not valid TypeScript/JavaScript. */
  | { readonly kind: 'parse'; readonly line: number; readonly column: number }
  /** Valid syntax that the v1 subset does not run (§3.2). */
  | {
      readonly kind: 'unsupported-syntax'
      readonly construct: string
      readonly line: number
      readonly column: number
    }
  /** The program ran but did something impossible, e.g. called a number. */
  | { readonly kind: 'runtime'; readonly line: number; readonly column: number }
  /** A single loop exceeded `maxLoopIterations`. */
  | {
      readonly kind: 'loop-budget'
      readonly loopLine: number
      readonly loopSource: string
      readonly iterations: number
      readonly testVariables: readonly TestVariable[]
    }
  /** The whole run exceeded `stepBudget`. */
  | { readonly kind: 'step-budget'; readonly steps: number; readonly line: number }
  /** Recursion went deeper than `maxCallDepth` without reaching a base case. */
  | {
      readonly kind: 'recursion-depth'
      readonly functionName: string
      readonly line: number
      readonly depth: number
    }

export class NoracursionError extends Error {
  readonly detail: ErrorDetail
  /** A concrete next edit, rendered under the message in the teaching panel. */
  readonly hint: string

  constructor(message: string, detail: ErrorDetail, hint: string) {
    super(message)
    this.name = 'NoracursionError'
    this.detail = detail
    this.hint = hint
  }
}

/** Narrowing helper for hosts that catch broadly. */
export function isNoracursionError(value: unknown): value is NoracursionError {
  return value instanceof NoracursionError
}

export function parseError(message: string, line: number, column: number): NoracursionError {
  return new NoracursionError(
    message,
    { kind: 'parse', line, column },
    `Check line ${line} for a typo — an unclosed bracket or a missing operator is the usual cause.`,
  )
}

export function unsupported(construct: string, line: number, column: number): NoracursionError {
  return new NoracursionError(
    `Noracursion can't run ${construct} yet.`,
    { kind: 'unsupported-syntax', construct, line, column },
    `Line ${line} uses ${construct}, which is outside the subset this interpreter supports. Rewrite that line without it — the built-in snippets show the constructs that do run.`,
  )
}

export function runtimeError(
  message: string,
  line: number,
  column: number,
  hint: string,
): NoracursionError {
  return new NoracursionError(message, { kind: 'runtime', line, column }, hint)
}
