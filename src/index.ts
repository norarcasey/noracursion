// Public API for embedding Noracursion.
export { Noracursion } from './components/Noracursion'
export type { NoracursionProps } from './components/Noracursion'

export type {
  DrawableStructure,
  LabelMode,
  Language,
  Operation,
  SortAlgorithm,
  Structure,
  TraversalOrder,
} from './types'

// The headless engine, for consumers who want the run without the picture.
export { useRun, type RunController, type UseRunOptions } from './ui/useRun'
export { buildRun, type BuildRunOptions, type Frame, type Run } from './bridge'
export type { VizEdge, VizModel, VizNode } from './core/model'

// The interpreter itself stays internal — CLAUDE.md §8 rules out shipping a
// general-purpose JS engine — but the types its callbacks hand back are part of
// the props surface (§2: `onStep`, `onEvent`, `onComplete`, `onRuntimeError`),
// so they are exported. Imported from their own modules rather than the
// interpreter barrel so a consumer who never runs code does not pull the step
// machine into their bundle.
export { NoracursionError, isNoracursionError } from './interpreter/errors'
export type { ErrorDetail, TestVariable } from './interpreter/errors'
export type { RunSummary, Snapshot, Step, StepInfo, StepPhase } from './interpreter/values'
export type { VizEvent } from './bridge/events'
