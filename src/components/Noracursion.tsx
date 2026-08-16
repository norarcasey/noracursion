import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import type { VizEvent } from '../bridge'
import type { Cell, VizModel } from '../core/model'
import type { NoracursionError } from '../interpreter/errors'
import type { RunSummary, StepInfo } from '../interpreter/values'
import { layoutModel } from '../layout'
import {
  DRAWABLE_STRUCTURES,
  STRUCTURE_LABELS,
  type DrawableStructure,
  type LabelMode,
  type Operation,
  type Structure,
} from '../types'
import { useRun } from '../ui/useRun'
import { Stage } from '../viz'

/**
 * The props implemented so far.
 *
 * The full surface lives in CLAUDE.md §2; this interface carries only what the
 * component actually honours. A prop that is declared but ignored is worse than
 * one that is missing — the type would promise behaviour that is not there — so
 * the rest arrive with the milestones that implement them. The code panel and
 * the transport controls are M5; the built-in snippets are M6, which is why
 * `code` has no default yet.
 */
export interface NoracursionProps {
  /* --- what to show --- */
  /** Which data structure this example is about. */
  structure: Structure
  /** What the example does to it. */
  operation: Operation
  /** Values to build the structure from. Defaults to a small sample set. */
  initialData?: ReadonlyArray<number | string>

  /* --- execution --- */
  /**
   * TypeScript to run against the structure. Omit it and the component just
   * draws the structure. The live structure is injected as `arr`, `list` or
   * `tree`, alongside `visit`, `compare`, `swap`, `setColor`, `mark` and `log`.
   */
  code?: string
  autoPlay?: boolean
  /** Milliseconds per step, and the time a node takes to move. Default `600`. */
  speedMs?: number
  /** Total steps for the whole run. Default `10_000`. */
  stepBudget?: number
  /** Iterations allowed for any single loop. Default `1_000`. */
  maxLoopIterations?: number

  /* --- presentation --- */
  /** What each node shows inside its circle. Default `'value'`. */
  labelMode?: LabelMode
  /** Heading above the visualization. Omit (or pass `null`) to hide it. */
  title?: ReactNode
  /** Consumer-supplied prose shown under the heading. */
  blurb?: ReactNode
  className?: string
  style?: CSSProperties

  /* --- escape hatches --- */
  onStep?: (step: StepInfo) => void
  onEvent?: (event: VizEvent) => void
  onComplete?: (summary: RunSummary) => void
  onRuntimeError?: (error: NoracursionError) => void
}

/**
 * Used when the consumer supplies no data, so the component draws something
 * meaningful out of the box. Chosen to make a legibly unbalanced binary search
 * tree while still reading sensibly as an array or a list.
 */
const DEFAULT_DATA: readonly Cell[] = [8, 3, 10, 1, 6, 14]

function isDrawable(structure: Structure): structure is DrawableStructure {
  const drawable: readonly string[] = DRAWABLE_STRUCTURES
  return drawable.includes(structure)
}

/**
 * Noracursion — a data structure animated from real, editable, steppable code.
 *
 * Give it `code` and it runs: the program drives the live structure through the
 * injected runtime, and the picture is whatever the code actually did — wrong
 * answers included, which is the point.
 */
export function Noracursion({
  structure,
  operation,
  initialData,
  code,
  autoPlay = false,
  speedMs = 600,
  stepBudget,
  maxLoopIterations,
  labelMode = 'value',
  title,
  blurb,
  className,
  style,
  onStep,
  onEvent,
  onComplete,
  onRuntimeError,
}: NoracursionProps) {
  const caption = `${structure} · ${operation}`
  const provided = initialData ?? DEFAULT_DATA
  // Keyed on the contents, not the array's identity: `initialData={[1, 2]}` is
  // a fresh array on every render, and using it as a dependency directly would
  // rebuild the whole run each time the parent re-rendered.
  const dataKey = JSON.stringify(provided)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see dataKey above
  const data = useMemo<readonly Cell[]>(() => provided, [dataKey])

  const drawable = isDrawable(structure)

  const run = useRun({
    // A structure with no model yet still needs a stable hook call, so it runs
    // an empty program against an array that is never drawn.
    code: drawable ? (code ?? null) : null,
    structure: drawable ? structure : 'array',
    data: drawable ? data : EMPTY_DATA,
    autoPlay,
    speedMs,
    stepBudget,
    maxLoopIterations,
  })

  useReportedRun({ run, onStep, onEvent, onComplete, onRuntimeError })

  const model: VizModel = run.frame.model
  const layout = useMemo(() => layoutModel(model), [model])

  return (
    <div
      className={className === undefined ? 'nrc' : `nrc ${className}`}
      style={style === undefined ? rootStyle : { ...rootStyle, ...style }}
      data-nrc-structure={structure}
      data-nrc-operation={operation}
    >
      {title !== undefined && title !== null && (
        <h2 className="nrc__title" style={titleStyle}>
          {title}
        </h2>
      )}

      {blurb !== undefined && blurb !== null && (
        <div className="nrc__blurb" style={blurbStyle}>
          {blurb}
        </div>
      )}

      {drawable ? (
        <Stage
          layout={layout}
          labelMode={labelMode}
          speedMs={speedMs}
          showIndexLabels={model.layoutHint === 'row'}
          ariaLabel={describe(structure, model)}
        />
      ) : (
        <NotYetDrawable structure={structure} />
      )}

      {run.error !== null && <ErrorNotice error={run.error} />}

      <p className="nrc__caption" style={captionStyle}>
        {caption}
        {code !== undefined && drawable && (
          <span className="nrc__progress" style={progressStyle}>
            {` · step ${run.index} of ${run.frames.length - 1}`}
          </span>
        )}
      </p>
    </div>
  )
}

const EMPTY_DATA: readonly Cell[] = []

/**
 * Forwards the run to the consumer's callbacks (§2).
 *
 * `onStep` and `onEvent` fire for **every frame crossed**, not just the one
 * that ends up on screen. At a fast `speedMs` several timer ticks land inside a
 * single React render, and reporting only the frame that survived would drop
 * the steps in between — which for `onEvent` would mean silently losing events,
 * the one channel §3.4 says everything travels on.
 *
 * Moving backwards reports nothing: stepping back is reviewing what already
 * happened, not making it happen again. Going forwards over that ground again
 * does re-report, because those steps genuinely run again.
 *
 * The refs keep an inline arrow prop from re-triggering everything each render.
 */
function useReportedRun({
  run,
  onStep,
  onEvent,
  onComplete,
  onRuntimeError,
}: {
  run: ReturnType<typeof useRun>
  onStep?: (step: StepInfo) => void
  onEvent?: (event: VizEvent) => void
  onComplete?: (summary: RunSummary) => void
  onRuntimeError?: (error: NoracursionError) => void
}): void {
  const handlers = useRef({ onStep, onEvent, onComplete, onRuntimeError })
  handlers.current = { onStep, onEvent, onComplete, onRuntimeError }

  const { frames, index, atEnd, summary, error } = run
  const reportedUpTo = useRef(0)

  useEffect(() => {
    // A new filmstrip starts the marker over.
    if (reportedUpTo.current > frames.length - 1) reportedUpTo.current = 0
    for (let cursor = reportedUpTo.current + 1; cursor <= index; cursor += 1) {
      const crossed = frames[cursor]
      if (crossed.step !== null) handlers.current.onStep?.(crossed.step)
      for (const event of crossed.events) handlers.current.onEvent?.(event)
    }
    reportedUpTo.current = index
  }, [frames, index])

  const completed = useRef(false)
  useEffect(() => {
    if (!atEnd) {
      completed.current = false
      return
    }
    if (completed.current) return
    completed.current = true
    handlers.current.onComplete?.(summary)
  }, [atEnd, summary])

  useEffect(() => {
    if (error !== null) handlers.current.onRuntimeError?.(error)
  }, [error])
}

/**
 * Says plainly what is missing, in the same voice as the interpreter's errors.
 * A blank stage would leave the reader guessing whether they had passed bad
 * data or hit a gap in the library.
 */
function NotYetDrawable({ structure }: { structure: Structure }) {
  return (
    <div className="nrc__notice" role="status" style={noticeStyle}>
      <strong>Noracursion can’t draw a {STRUCTURE_LABELS[structure]} yet.</strong>{' '}
      {`The structures it draws today are: ${listDrawable()}.`}
    </div>
  )
}

/**
 * The message and its suggested fix. M5 turns this into the full teaching panel
 * — the loop's source line, the variables that never changed — from the
 * structured detail the error already carries.
 */
function ErrorNotice({ error }: { error: NoracursionError }) {
  return (
    <div className="nrc__error" role="alert" style={errorStyle}>
      <strong className="nrc__error-message">{error.message}</strong>
      <span className="nrc__error-hint" style={hintStyle}>
        {error.hint}
      </span>
    </div>
  )
}

/**
 * Derived from the list itself, so the copy cannot drift from what works.
 * Rendered as a plain comma list after a colon, which avoids having to
 * pluralize or article every structure name ("an array", "a red-black tree").
 */
function listDrawable(): string {
  return DRAWABLE_STRUCTURES.map((structure) => STRUCTURE_LABELS[structure]).join(', ')
}

/** A description of the picture for readers who cannot see it. */
function describe(structure: Structure, model: VizModel): string {
  const name = STRUCTURE_LABELS[structure]
  if (model.nodes.length === 0) return `An empty ${name}.`
  const labels = model.nodes.map((node) => node.label).join(', ')
  return `${name} with ${model.nodes.length} nodes: ${labels}.`
}

// Structurally load-bearing styles are inline so an unstyled import still
// renders correctly (CLAUDE.md §5). Everything cosmetic reads a `--nrc-*`
// custom property first, so a consumer can theme the component without the
// optional stylesheet — which is why `sideEffects` can honestly stay `false`.
const rootStyle: CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  width: '100%',
  maxWidth: '720px',
  padding: '1rem',
  borderRadius: '12px',
  background: 'var(--nrc-surface, #0e1530)',
  color: 'var(--nrc-text, #e7ecff)',
  fontFamily: 'var(--nrc-font, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif)',
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
}

const blurbStyle: CSSProperties = {
  margin: 0,
  lineHeight: 1.5,
  color: 'var(--nrc-muted, #9fb0e8)',
}

const captionStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  fontVariant: 'small-caps',
  letterSpacing: '0.04em',
  color: 'var(--nrc-muted, #9fb0e8)',
}

const progressStyle: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
}

const noticeStyle: CSSProperties = {
  padding: '1rem',
  borderRadius: '8px',
  lineHeight: 1.5,
  background: 'var(--nrc-stage, #0b1020)',
  border: '1px solid var(--nrc-edge-stroke, #4a5a94)',
}

const errorStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  padding: '0.75rem 1rem',
  borderRadius: '8px',
  lineHeight: 1.5,
  background: 'var(--nrc-error-surface, #2a1416)',
  border: '1px solid var(--nrc-error-border, #c5372c)',
}

const hintStyle: CSSProperties = {
  color: 'var(--nrc-muted, #9fb0e8)',
}

export default Noracursion
