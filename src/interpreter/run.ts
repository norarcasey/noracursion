import { NoracursionError } from './errors'
import { interpret, type RunOptions } from './interpret'
import { formatSnapshot, type RunSummary, type Step } from './values'

export interface RunResult {
  /**
   * Every step taken, in order, up to and including the last one before an
   * error.
   *
   * The trace is recorded eagerly rather than replayed on demand: CLAUDE.md
   * §3.2 suggests stepping backward by re-running from the start to step N-1,
   * which is O(n) per keypress and, at the default 10,000-step budget, means
   * re-executing the program to move the cursor one line. Holding the trace
   * makes step-back an index decrement. It costs memory bounded by
   * `stepBudget`, and the snapshots in it are immutable, which the replay
   * approach would also have needed.
   */
  readonly trace: readonly Step[]
  readonly summary: RunSummary
  /** Non-null when the run stopped early. The trace still holds what ran. */
  readonly error: NoracursionError | null
}

/**
 * Drive a program to completion and collect its trace.
 *
 * Interpreter errors are returned rather than thrown: the teaching panel needs
 * the error *and* the steps that led to it, and a caller that has to catch to
 * get one and destructure to get the other is easy to get wrong. Anything that
 * is not a `NoracursionError` is a bug in the interpreter and is rethrown.
 */
export function runToCompletion(source: string, options: RunOptions = {}): RunResult {
  const trace: Step[] = []
  const generator = interpret(source, options)

  try {
    let next = generator.next()
    while (!next.done) {
      trace.push(next.value)
      next = generator.next()
    }
    return { trace, summary: next.value, error: null }
  } catch (error) {
    if (error instanceof NoracursionError) {
      return {
        trace,
        summary: { steps: trace.length, completed: false, logs: collectLogs(trace) },
        error,
      }
    }
    throw error
  }
}

function collectLogs(trace: readonly Step[]): string[] {
  const logs: string[] = []
  for (const step of trace) {
    for (const event of step.events) {
      if (event.type === 'log') logs.push(event.text)
    }
  }
  return logs
}

/**
 * A trace rendered one line per step: `L3 statement VariableDeclaration | x=1`.
 *
 * Golden traces assert on this. A structural diff of 40 nested step objects is
 * unreadable when it fails, and an unreadable golden test gets updated blindly
 * instead of investigated — which would defeat the point of having the
 * strictest suite in the project (§6.1).
 */
export function formatTrace(trace: readonly Step[]): string[] {
  return trace.map((step) => {
    const scope = Object.entries(step.scope)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, snapshot]) => `${name}=${formatSnapshot(snapshot, 1)}`)
      .join(' ')
    const events = step.events.map((event) => event.type).join(',')
    return [
      `L${step.line}`,
      step.phase,
      step.nodeType,
      `d${step.callDepth}`,
      scope === '' ? '' : `| ${scope}`,
      events === '' ? '' : `<${events}>`,
    ]
      .filter((part) => part !== '')
      .join(' ')
  })
}
