// Public API for embedding Noracursion.
export { Noracursion } from './components/Noracursion'
export type { NoracursionProps } from './components/Noracursion'

export type { Language, Operation, SortAlgorithm, Structure, TraversalOrder } from './types'

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
