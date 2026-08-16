import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { buildRun, type Frame, type Run } from '../bridge'
import type { Cell } from '../core/model'
import type { NoracursionError } from '../interpreter/errors'
import type { RunSummary } from '../interpreter/values'
import type { DrawableStructure } from '../types'

export interface UseRunOptions {
  /** The program to run. `null` means "just draw the structure". */
  readonly code: string | null
  readonly structure: DrawableStructure
  readonly data: readonly Cell[]
  readonly autoPlay?: boolean
  /** Milliseconds between steps while playing. */
  readonly speedMs?: number
  readonly stepBudget?: number
  readonly maxLoopIterations?: number
  readonly maxCallDepth?: number
}

export interface RunController {
  readonly frames: readonly Frame[]
  readonly index: number
  readonly frame: Frame
  readonly summary: RunSummary
  readonly error: NoracursionError | null
  /** What the structure is bound to in the code: `arr`, `list` or `tree`. */
  readonly handleName: string
  readonly playing: boolean
  readonly atStart: boolean
  readonly atEnd: boolean
  play(): void
  pause(): void
  toggle(): void
  stepForward(): void
  stepBack(): void
  reset(): void
  seek(index: number): void
}

interface State {
  readonly index: number
  readonly playing: boolean
}

type Action =
  | { type: 'reset'; playing: boolean }
  | { type: 'play'; last: number }
  | { type: 'pause' }
  | { type: 'toggle'; last: number }
  | { type: 'seek'; index: number; last: number }
  | { type: 'advance'; by: number; last: number; stopAtEnd: boolean }

/**
 * The whole controller is one pure reducer.
 *
 * Playback is nothing more than moving an index across a pre-recorded
 * filmstrip, so every transition — tick, seek, reset — is a clamp on a single
 * number. Splitting it across several `useState` setters is the bug the house
 * style warns about: React 18's StrictMode double-invokes updaters, and a tick
 * that read one piece of state to compute another would corrupt itself.
 */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return { index: 0, playing: action.playing }
    case 'play':
      // Playing from the end restarts, which is what a play button that is
      // still lit at the end of a run should do.
      return state.index >= action.last ? { index: 0, playing: true } : { ...state, playing: true }
    case 'pause':
      return { ...state, playing: false }
    case 'toggle':
      return state.playing
        ? { ...state, playing: false }
        : reducer(state, { type: 'play', last: action.last })
    case 'seek':
      return { index: clamp(action.index, 0, action.last), playing: false }
    case 'advance': {
      const index = clamp(state.index + action.by, 0, action.last)
      const stop = action.stopAtEnd && index >= action.last
      return { index, playing: stop ? false : state.playing }
    }
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/**
 * Builds the run and exposes it as a transport.
 *
 * The run is recorded once, up front, and re-recorded only when the program or
 * the structure changes — never on a tick. That is what makes stepping backward
 * free and keeps a paused component doing no work at all.
 */
export function useRun(options: UseRunOptions): RunController {
  const {
    code,
    structure,
    data,
    autoPlay = false,
    speedMs = 600,
    stepBudget,
    maxLoopIterations,
    maxCallDepth,
  } = options

  const run: Run = useMemo(
    () =>
      buildRun({
        code: code ?? '',
        structure,
        data,
        stepBudget,
        maxLoopIterations,
        maxCallDepth,
      }),
    [code, structure, data, stepBudget, maxLoopIterations, maxCallDepth],
  )

  const last = run.frames.length - 1
  const [state, dispatch] = useReducer(reducer, { index: 0, playing: autoPlay })

  // A new program is a new filmstrip: rewind, and start playing again only if
  // the consumer asked for autoPlay.
  useEffect(() => {
    dispatch({ type: 'reset', playing: autoPlay && run.frames.length > 1 })
  }, [run, autoPlay])

  useEffect(() => {
    if (!state.playing || last <= 0) return
    const timer = setInterval(() => {
      dispatch({ type: 'advance', by: 1, last, stopAtEnd: true })
    }, speedMs)
    return () => clearInterval(timer)
  }, [state.playing, speedMs, last])

  const index = clamp(state.index, 0, Math.max(0, last))

  return {
    frames: run.frames,
    index,
    frame: run.frames[index],
    summary: run.summary,
    error: run.error,
    handleName: run.handleName,
    playing: state.playing,
    atStart: index === 0,
    atEnd: index >= last,
    play: useCallback(() => dispatch({ type: 'play', last }), [last]),
    pause: useCallback(() => dispatch({ type: 'pause' }), []),
    toggle: useCallback(() => dispatch({ type: 'toggle', last }), [last]),
    stepForward: useCallback(
      () => dispatch({ type: 'advance', by: 1, last, stopAtEnd: false }),
      [last],
    ),
    stepBack: useCallback(
      () => dispatch({ type: 'advance', by: -1, last, stopAtEnd: false }),
      [last],
    ),
    reset: useCallback(() => dispatch({ type: 'reset', playing: false }), []),
    seek: useCallback((target: number) => dispatch({ type: 'seek', index: target, last }), [last]),
  }
}
