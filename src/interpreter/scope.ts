import { capture, type Snapshot, type Value } from './values'

export type BindingKind = 'let' | 'const' | 'var' | 'param' | 'this'

export interface Binding {
  readonly kind: BindingKind
  value: Value
}

/**
 * A lexical scope.
 *
 * Deliberately dumb: it resolves names and nothing else. Deciding that an
 * unresolved name is an error, or that assigning to a `const` is one, needs the
 * AST node to report a line — so those decisions live in the interpreter and
 * this class just answers questions.
 */
export class Env {
  private readonly bindings = new Map<string, Binding>()

  constructor(
    readonly parent: Env | null,
    /** `var` hoists to the nearest scope with this set. */
    readonly isFunctionScope: boolean,
    /** Builtins live in the global scope and are left out of snapshots. */
    readonly isGlobal: boolean = false,
  ) {}

  static global(): Env {
    return new Env(null, true, true)
  }

  child(isFunctionScope = false): Env {
    return new Env(this, isFunctionScope)
  }

  /** The nearest enclosing function scope — where `var` declarations land. */
  functionScope(): Env {
    for (const scope of chain(this)) {
      if (scope.isFunctionScope || scope.parent === null) return scope
    }
    return this
  }

  declare(name: string, kind: BindingKind, value: Value): void {
    const target = kind === 'var' ? this.functionScope() : this
    const existing = target.bindings.get(name)
    // Re-declaring a `var` in the same function scope is legal and keeps the
    // binding; every other kind overwrites, which matches the loop-body case
    // where each iteration re-runs the same `let`.
    if (kind === 'var' && existing !== undefined) {
      existing.value = value
      return
    }
    target.bindings.set(name, { kind, value })
  }

  lookup(name: string): Binding | undefined {
    for (const scope of chain(this)) {
      const binding = scope.bindings.get(name)
      if (binding !== undefined) return binding
    }
    return undefined
  }

  has(name: string): boolean {
    return this.lookup(name) !== undefined
  }

  /**
   * Every name visible from here, innermost first, excluding builtins. This is
   * what the variables panel renders and what golden traces assert on.
   */
  snapshot(): Record<string, Snapshot> {
    const result: Record<string, Snapshot> = {}
    for (const scope of chain(this)) {
      if (scope.isGlobal) break
      for (const [name, binding] of scope.bindings) {
        // Inner scopes win: only record a name the first time it is seen.
        if (!Object.prototype.hasOwnProperty.call(result, name)) {
          result[name] = capture(binding.value)
        }
      }
    }
    return result
  }
}

/**
 * Every scope from `start` outwards. A module-level generator rather than a
 * `let scope = this` walk inside each method, which lint rejects — aliasing
 * `this` is the kind of thing that quietly breaks when a method is later
 * turned into a callback.
 */
function* chain(start: Env): Generator<Env, void, void> {
  let scope: Env | null = start
  while (scope !== null) {
    yield scope
    scope = scope.parent
  }
}
