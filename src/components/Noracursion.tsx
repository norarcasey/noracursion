import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { ArrayStructure } from '../core/arrayStructure'
import { LinkedList } from '../core/linkedList'
import type { Cell, VizModel } from '../core/model'
import { BinarySearchTree } from '../core/tree'
import { layoutModel } from '../layout'
import {
  DRAWABLE_STRUCTURES,
  STRUCTURE_LABELS,
  type LabelMode,
  type Operation,
  type Structure,
} from '../types'
import { Stage } from '../viz'

/**
 * The props implemented so far.
 *
 * The full surface lives in CLAUDE.md §2; this interface carries only what the
 * component actually honours. A prop that is declared but ignored is worse than
 * one that is missing — the type would promise behaviour that is not there — so
 * the rest arrive with the milestones that implement them. The code panel,
 * transport controls and execution props land in M4 and M5.
 */
export interface NoracursionProps {
  /** Which data structure this example is about. */
  structure: Structure
  /** What the example does to it. */
  operation: Operation
  /** Values to build the structure from. Defaults to a small sample set. */
  initialData?: ReadonlyArray<number | string>
  /** What each node shows inside its circle. Default `'value'`. */
  labelMode?: LabelMode
  /** Milliseconds a node takes to move to a new position. Default `600`. */
  speedMs?: number
  /** Heading above the visualization. Omit (or pass `null`) to hide it. */
  title?: ReactNode
  /** Consumer-supplied prose shown under the heading. */
  blurb?: ReactNode
  /** Extra class on the root element. */
  className?: string
  /** Extra inline styles on the root element. */
  style?: CSSProperties
}

/**
 * Used when the consumer supplies no data, so the component draws something
 * meaningful out of the box. Chosen to make a legibly unbalanced binary search
 * tree while still reading sensibly as an array or a list.
 */
const DEFAULT_DATA: readonly Cell[] = [8, 3, 10, 1, 6, 14]

function buildModel(structure: Structure, data: readonly Cell[]): VizModel | null {
  switch (structure) {
    case 'array':
      return new ArrayStructure(data).toVizModel()
    case 'linked-list':
      return new LinkedList(data).toVizModel()
    case 'binary-search-tree':
      return new BinarySearchTree(data).toVizModel()
    default:
      return null
  }
}

/**
 * Noracursion — a data structure animated from real, editable, steppable code.
 *
 * Today it draws the structure: the model is built from `initialData`, laid out
 * by a pure layout function, and rendered as SVG whose nodes move by CSS
 * transition keyed on stable ids. The interpreter that makes it *step* is
 * already built and tested; wiring the two together is M4.
 */
export function Noracursion({
  structure,
  operation,
  initialData,
  labelMode = 'value',
  speedMs = 600,
  title,
  blurb,
  className,
  style,
}: NoracursionProps) {
  const caption = `${structure} · ${operation}`
  const data = initialData ?? DEFAULT_DATA

  const model = useMemo(() => buildModel(structure, data), [structure, data])
  const layout = useMemo(() => (model === null ? null : layoutModel(model)), [model])

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

      {model === null || layout === null ? (
        <NotYetDrawable structure={structure} />
      ) : (
        <Stage
          layout={layout}
          labelMode={labelMode}
          speedMs={speedMs}
          showIndexLabels={model.layoutHint === 'row'}
          ariaLabel={describe(structure, model)}
        />
      )}

      <p className="nrc__caption" style={captionStyle}>
        {caption}
      </p>
    </div>
  )
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

const noticeStyle: CSSProperties = {
  padding: '1rem',
  borderRadius: '8px',
  lineHeight: 1.5,
  background: 'var(--nrc-stage, #0b1020)',
  border: '1px solid var(--nrc-edge-stroke, #4a5a94)',
}

export default Noracursion
