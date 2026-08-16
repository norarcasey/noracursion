import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { VizEvent } from '../bridge'
import type { Cell, VizModel } from '../core/model'
import type { NoracursionError } from '../interpreter/errors'
import type { RunSummary, StepInfo } from '../interpreter/values'
import { layoutModel } from '../layout'
import {
  DRAWABLE_STRUCTURES,
  STRUCTURE_LABELS,
  type ColorMode,
  type DrawableStructure,
  type LabelMode,
  type Language,
  type Operation,
  type SortAlgorithm,
  type Structure,
  type TraversalOrder,
} from '../types'
import { getSnippet } from '../snippets'
import { Controls } from '../ui/Controls'
import { Editor } from '../ui/Editor'
import { Legend } from '../ui/Legend'
import { Panels } from '../ui/Panels'
import { TeachingPanel } from '../ui/TeachingPanel'
import { useEditableCode } from '../ui/useEditableCode'
import { useRun } from '../ui/useRun'
import { Stage } from '../viz'

/**
 * The props implemented so far.
 *
 * The full surface lives in CLAUDE.md §2; this interface carries only what the
 * component actually honours. A prop that is declared but ignored is worse than
 * one that is missing — the type would promise behaviour that is not there — so
 * the rest arrive with the milestones that implement them. The built-in snippet
 * library is M6, which is why `code` still has no default.
 */
export interface NoracursionProps {
  /* --- what to show --- */
  structure: Structure
  operation: Operation
  /** Values to build the structure from. Defaults to a small sample set. */
  initialData?: ReadonlyArray<number | string>
  /** Only meaningful for `traverse`. Default `'in-order'`. */
  traversalOrder?: TraversalOrder
  /** Only meaningful for `sort`. Default `'bubble'`. */
  sortAlgorithm?: SortAlgorithm

  /**
   * When false, the built-in snippet switches to an iterative implementation —
   * explicit stack, queue or pointer loops. Default `true`.
   *
   * Both variants do the same work in the same order, so the picture is
   * identical and only the shape of the code changes. That is the whole point
   * of the prop, and it is asserted for every snippet in the library.
   */
  recursion?: boolean

  /* --- code panel --- */
  /**
   * Overrides the built-in snippet. The live structure is injected as `arr`,
   * `list` or `tree`, alongside `visit`, `compare`, `swap`, `setColor`, `mark`
   * and `log`.
   */
  code?: string
  /** Default `'typescript'`. Anything else is shown but not executed (§4). */
  language?: Language
  /** Default `true`. */
  editable?: boolean
  /** Default `true`. */
  showCode?: boolean

  /* --- execution --- */
  autoPlay?: boolean
  /** Milliseconds per step, and the time a node takes to move. Default `600`. */
  speedMs?: number
  /** Total steps for the whole run. Default `10_000`. */
  stepBudget?: number
  /** Iterations allowed for any single loop. Default `1_000`. */
  maxLoopIterations?: number

  /* --- presentation --- */
  /** Default `'value'`. */
  labelMode?: LabelMode
  /** Default `'structure'`. */
  colorMode?: ColorMode
  /** Default `true`. */
  showControls?: boolean
  /** Default `false`. */
  showLegend?: boolean
  /** Default `true` when there is code to run. */
  showPanels?: boolean
  /** Heading above the visualization. Omit (or pass `null`) to hide it. */
  title?: ReactNode
  blurb?: ReactNode
  className?: string
  style?: CSSProperties

  /* --- escape hatches --- */
  onStep?: (step: StepInfo) => void
  onEvent?: (event: VizEvent) => void
  onComplete?: (summary: RunSummary) => void
  onRuntimeError?: (error: NoracursionError) => void
}

type TransportAction = 'toggle' | 'play' | 'forward' | 'back' | 'reset'

/**
 * Used when the consumer supplies no data, so the component draws something
 * meaningful out of the box. Chosen to make a legibly unbalanced binary search
 * tree while still reading sensibly as an array or a list.
 */
const DEFAULT_DATA: readonly Cell[] = [8, 3, 10, 1, 6, 14]
const EMPTY_DATA: readonly Cell[] = []

function isDrawable(structure: Structure): structure is DrawableStructure {
  const drawable: readonly string[] = DRAWABLE_STRUCTURES
  return drawable.includes(structure)
}

/**
 * Noracursion — a data structure animated from real, editable, steppable code.
 *
 * Edit the code and it re-runs: the program drives the live structure through
 * the injected runtime, and the picture is whatever the code actually did —
 * wrong answers included, which is the point.
 */
export function Noracursion({
  structure,
  operation,
  initialData,
  traversalOrder,
  sortAlgorithm,
  recursion = true,
  code,
  language = 'typescript',
  editable = true,
  showCode = true,
  autoPlay = false,
  speedMs = 600,
  stepBudget,
  maxLoopIterations,
  labelMode = 'value',
  colorMode = 'structure',
  showControls = true,
  showLegend = false,
  showPanels,
  title,
  blurb,
  className,
  style,
  onStep,
  onEvent,
  onComplete,
  onRuntimeError,
}: NoracursionProps) {
  const provided = initialData ?? DEFAULT_DATA
  // Keyed on the contents, not the array's identity: `initialData={[1, 2]}` is
  // a fresh array on every render, and using it as a dependency directly would
  // rebuild the whole run each time the parent re-rendered.
  const dataKey = JSON.stringify(provided)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see dataKey above
  const data = useMemo<readonly Cell[]>(() => provided, [dataKey])

  const drawable = isDrawable(structure)

  // A prop that changes the program reselects the snippet (§2). `useEditableCode`
  // is what keeps that from throwing away edits: it offers the new source rather
  // than swapping it in underneath the reader.
  const builtIn = useMemo(
    () => getSnippet({ structure, operation, language, recursion, traversalOrder, sortAlgorithm }),
    [structure, operation, language, recursion, traversalOrder, sortAlgorithm],
  )
  const program = code ?? builtIn

  // Only TypeScript executes; the rest are shown for comparison (§4).
  const runnable = drawable && language === 'typescript' && program !== null

  const source = useEditableCode(program ?? '')
  const [speed, setSpeed] = useState(speedMs)
  useEffect(() => setSpeed(speedMs), [speedMs])

  const run = useRun({
    code: runnable ? source.committed : null,
    // A structure with no model yet still needs a stable hook call, so it runs
    // an empty program against an array that is never drawn.
    structure: drawable ? structure : 'array',
    data: drawable ? data : EMPTY_DATA,
    autoPlay: autoPlay && runnable,
    speedMs: speed,
    stepBudget,
    maxLoopIterations,
  })

  useReportedRun({ run, onStep, onEvent, onComplete, onRuntimeError })

  const model: VizModel = run.frame.model
  const layout = useMemo(() => layoutModel(model), [model])
  const logs = useMemo(
    () =>
      run.frames
        .slice(0, run.index + 1)
        .flatMap((frame) => frame.events.flatMap((e) => (e.type === 'log' ? [e.text] : []))),
    [run.frames, run.index],
  )

  // Transport controls act on what is on screen, so a press commits any edit
  // still waiting out its debounce. Committing rebuilds the filmstrip, which
  // resets to frame 0 — so the press is remembered and re-applied once the new
  // program is ready. Without that, the first play after an edit would load the
  // new code and then sit there, and the reader would have to press it twice.
  const perform = useCallback(
    (action: TransportAction) => {
      if (action === 'toggle') run.toggle()
      else if (action === 'play') run.play()
      else if (action === 'forward') run.stepForward()
      else if (action === 'back') run.stepBack()
      else run.reset()
    },
    [run],
  )

  const resume = useRef<TransportAction | null>(null)
  const press = useCallback(
    (action: TransportAction) => () => {
      if (source.pending) {
        source.commitNow()
        resume.current = action
        return
      }
      perform(action)
    },
    [source, perform],
  )

  useEffect(() => {
    const action = resume.current
    if (action === null) return
    resume.current = null
    perform(action)
    // Fires when the rebuilt filmstrip arrives, after useRun has rewound it.
  }, [run.frames, perform])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!runnable || !showControls) return
    // The editor owns its own keys; space in a textarea is a space.
    if (event.target instanceof HTMLTextAreaElement) return
    if (event.key === ' ' || event.key === 'k') {
      event.preventDefault()
      press('toggle')()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      press('forward')()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      press('back')()
    }
  }

  const panelsVisible = showPanels ?? runnable

  return (
    <div
      className={className === undefined ? 'nrc' : `nrc ${className}`}
      style={style === undefined ? rootStyle : { ...rootStyle, ...style }}
      data-nrc-structure={structure}
      data-nrc-operation={operation}
      onKeyDown={onKeyDown}
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

      {drawable && program === null && <NoExample structure={structure} operation={operation} />}

      {drawable ? (
        <Stage
          layout={layout}
          labelMode={labelMode}
          colorMode={colorMode}
          speedMs={speed}
          showIndexLabels={model.layoutHint === 'row'}
          ariaLabel={describe(structure, model)}
        />
      ) : (
        <NotYetDrawable structure={structure} />
      )}

      {showLegend && <Legend />}

      {showControls && runnable && (
        <Controls
          run={{
            ...run,
            toggle: press('toggle'),
            play: press('play'),
            stepForward: press('forward'),
            stepBack: press('back'),
            reset: press('reset'),
          }}
          speedMs={speed}
          onSpeedChange={setSpeed}
          runnable={runnable}
        />
      )}

      {run.error !== null && <TeachingPanel error={run.error} />}

      {showCode && program !== null && (
        <>
          {source.incoming !== null && (
            <IncomingCodeBanner onLoad={source.acceptIncoming} onKeep={source.dismissIncoming} />
          )}
          {language !== 'typescript' && <LanguageBadge language={language} />}
          <Editor
            value={source.draft}
            onChange={source.setDraft}
            editable={editable}
            language={language}
            currentLine={runnable && run.frame.step !== null ? run.frame.step.line : null}
            label={`${STRUCTURE_LABELS[structure]} ${operation} — editable source`}
          />
        </>
      )}

      {panelsVisible && <Panels step={run.frame.step} logs={logs} />}

      <p className="nrc__caption" style={captionStyle}>
        {`${structure} · ${operation}`}
      </p>
    </div>
  )
}

/**
 * A drawable structure with no example for this operation. Distinct from
 * `NotYetDrawable`: the picture is fine, it is the program that is missing.
 */
function NoExample({ structure, operation }: { structure: Structure; operation: Operation }) {
  return (
    <div className="nrc__notice" role="status" style={noticeStyle}>
      <strong>
        {`Noracursion has no ${operation} example for the ${STRUCTURE_LABELS[structure]} yet.`}
      </strong>{' '}
      Pass your own <code>code</code> to run something against it.
    </div>
  )
}

/**
 * §2 asks for a prompt before discarding typed-in code. This is that prompt,
 * as a banner rather than a modal: a dialog rendered by a library is a hard
 * thing to theme and a focus-management surface this package would then own,
 * and the protection is the same either way — nothing is thrown away without
 * the reader saying so.
 */
function IncomingCodeBanner({ onLoad, onKeep }: { onLoad: () => void; onKeep: () => void }) {
  return (
    <div className="nrc__banner" role="status" style={bannerStyle}>
      <span>The example changed, but you have edits. Load the new code, or keep yours?</span>
      <span style={bannerActionsStyle}>
        <button type="button" style={bannerButtonStyle} onClick={onLoad}>
          Load new code
        </button>
        <button type="button" style={bannerButtonStyle} onClick={onKeep}>
          Keep mine
        </button>
      </span>
    </div>
  )
}

/** §4: never fake execution of a language that cannot be run. */
function LanguageBadge({ language }: { language: Language }) {
  const name = language.charAt(0).toUpperCase() + language.slice(1)
  return (
    <p className="nrc__language-badge" role="status" style={badgeStyle}>
      {`${name} shown for comparison — execution is TypeScript-only for now.`}
    </p>
  )
}

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
 * Derived from the list itself, so the copy cannot drift from what works.
 * Rendered as a plain comma list after a colon, which avoids having to
 * pluralize or article every structure name ("an array", "a red-black tree").
 */
function listDrawable(): string {
  return DRAWABLE_STRUCTURES.map((s) => STRUCTURE_LABELS[s]).join(', ')
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

const titleStyle: CSSProperties = { margin: 0, fontSize: '1.25rem', fontWeight: 700 }

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

const noticeStyle: CSSProperties = {
  padding: '1rem',
  borderRadius: '8px',
  lineHeight: 1.5,
  background: 'var(--nrc-stage, #0b1020)',
  border: '1px solid var(--nrc-edge-stroke, #4a5a94)',
}

const bannerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.6rem 0.85rem',
  borderRadius: '8px',
  fontSize: '0.85rem',
  background: 'var(--nrc-stage, #0b1020)',
  border: '1px solid var(--nrc-state-visiting, #ffd166)',
}

const bannerActionsStyle: CSSProperties = { display: 'flex', gap: '0.4rem', marginLeft: 'auto' }

const bannerButtonStyle: CSSProperties = {
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  border: '1px solid var(--nrc-edge-stroke, #4a5a94)',
  background: 'transparent',
  color: 'var(--nrc-text, #e7ecff)',
  cursor: 'pointer',
  fontSize: '0.8rem',
}

const badgeStyle: CSSProperties = {
  margin: 0,
  padding: '0.4rem 0.75rem',
  borderRadius: '8px',
  fontSize: '0.8rem',
  color: 'var(--nrc-muted, #9fb0e8)',
  background: 'var(--nrc-stage, #0b1020)',
  border: '1px dashed var(--nrc-edge-stroke, #4a5a94)',
}

export default Noracursion
