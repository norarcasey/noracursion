import type { Cell, VizModel } from '../core/model'
import type { NoracursionError } from '../interpreter/errors'
import { NoracursionError as RuntimeError } from '../interpreter/errors'
import { interpret, type RunOptions } from '../interpreter/interpret'
import type { RunSummary, Step } from '../interpreter/values'
import type { DrawableStructure } from '../types'
import type { VizEvent } from './events'
import { Overlay } from './overlay'
import { createRuntime } from './runtime'

/**
 * One frame of the filmstrip: what the structure looked like at a step.
 *
 * Frame 0 has no step — it is the structure before the program starts, which is
 * what `reset` returns to and what the component shows before anything runs.
 */
export interface Frame {
  readonly step: Step | null
  readonly model: VizModel
  /** Events delivered on this step, in order. */
  readonly events: readonly VizEvent[]
}

export interface BuildRunOptions extends RunOptions {
  readonly code: string
  readonly structure: DrawableStructure
  readonly data: readonly Cell[]
}

export interface Run {
  readonly frames: readonly Frame[]
  readonly summary: RunSummary
  /** Non-null when the program stopped early; the frames still hold what ran. */
  readonly error: NoracursionError | null
  /** What the live structure is bound to in the code: `arr`, `list` or `tree`. */
  readonly handleName: string
}

/**
 * Run a program to completion and record a frame per step.
 *
 * The whole run is recorded up front rather than played lazily, which is the
 * decision from M1 paying off twice: stepping backward is an index decrement
 * instead of a re-execution, and the transport controls in M5 become nothing
 * more than moving an index around.
 *
 * The structure is re-serialized only when a mutation actually happened —
 * tracked by the runtime's version counter — because most steps evaluate an
 * expression and change nothing.
 */
export function buildRun(options: BuildRunOptions): Run {
  const { code, structure, data, ...budgets } = options
  const runtime = createRuntime(structure, data)
  const overlay = new Overlay()

  let base = runtime.toVizModel()
  let seenVersion = runtime.version()

  const frames: Frame[] = [{ step: null, model: overlay.decorate(base), events: [] }]
  const generator = interpret(code, { ...budgets, globals: runtime.globals })

  try {
    let next = generator.next()
    while (!next.done) {
      const step = next.value
      for (const event of step.events) overlay.apply(event)

      const version = runtime.version()
      if (version !== seenVersion) {
        base = runtime.toVizModel()
        seenVersion = version
      }

      frames.push({ step, model: overlay.decorate(base), events: step.events })
      next = generator.next()
    }
    return { frames, summary: next.value, error: null, handleName: runtime.handleName }
  } catch (error) {
    if (error instanceof RuntimeError) {
      return {
        frames,
        summary: {
          steps: frames.length - 1,
          completed: false,
          logs: frames.flatMap((frame) =>
            frame.events.flatMap((event) => (event.type === 'log' ? [event.text] : [])),
          ),
        },
        error,
        handleName: runtime.handleName,
      }
    }
    throw error
  }
}
