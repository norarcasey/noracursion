import type { CSSProperties, ReactNode } from 'react'
import type { Operation, Structure } from '../types'

/**
 * M0 props.
 *
 * The full surface lives in CLAUDE.md §2; this interface carries only the props
 * M0 actually honours. A prop that is declared but ignored is worse than a prop
 * that is missing — the type would promise behaviour the component does not
 * have — so the rest arrive with the milestones that implement them.
 */
export interface NoracursionProps {
  /** Which data structure this example is about. */
  structure: Structure
  /** What the example does to it. */
  operation: Operation
  /** Heading above the visualization. Omit (or pass `null`) to hide it. */
  title?: ReactNode
  /** Consumer-supplied prose shown under the heading. */
  blurb?: ReactNode
  /** Extra class on the root element. */
  className?: string
  /** Extra inline styles on the root element. */
  style?: CSSProperties
}

/** Radius of a node circle, in user units. CLAUDE.md §3.5. */
const NODE_RADIUS = 18

/**
 * The three hardcoded nodes M0 draws. This is not a data structure — it is a
 * fixed picture whose only job is to prove the build, test, and render pipeline
 * end to end. `core/` supplies the real `VizModel` from M2, and `layout/`
 * computes real positions from M3; until then these coordinates are literals.
 *
 * Ids are already stable and already the React keys, because every later
 * animation depends on that and it is cheaper to start correct.
 */
const PLACEHOLDER_NODES = [
  { id: 'n1', label: '8', x: 56, y: 72 },
  { id: 'n2', label: '3', x: 150, y: 72 },
  { id: 'n3', label: '10', x: 244, y: 72 },
]

const PLACEHOLDER_EDGES = [
  { id: 'e1', from: 'n1', to: 'n2' },
  { id: 'e2', from: 'n2', to: 'n3' },
]

const VIEW_BOX = '0 0 300 144'

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

const stageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  borderRadius: '8px',
  background: 'var(--nrc-stage, #0b1020)',
}

const captionStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  fontVariant: 'small-caps',
  letterSpacing: '0.04em',
  color: 'var(--nrc-muted, #9fb0e8)',
}

const labelStyle: CSSProperties = {
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  fontSize: '14px',
  fontWeight: 600,
  fill: 'var(--nrc-node-label, #e7ecff)',
  // The label belongs to the circle, not to the reader's cursor.
  userSelect: 'none',
}

/**
 * Noracursion — a data structure animated from real, editable, steppable code.
 *
 * M0 renders the shell: an optional title, an optional blurb, a static SVG, and
 * a caption naming the example. There is no interpreter, no code panel, and no
 * transport yet; the point of this milestone is that `npm run build:lib`
 * produces a working, typed, tree-shakeable package.
 */
export function Noracursion({
  structure,
  operation,
  title,
  blurb,
  className,
  style,
}: NoracursionProps) {
  const caption = `${structure} · ${operation}`
  const nodeById = new Map(PLACEHOLDER_NODES.map((node) => [node.id, node]))

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

      <svg
        className="nrc__stage"
        style={stageStyle}
        viewBox={VIEW_BOX}
        role="img"
        aria-label={`Placeholder visualization for ${caption}`}
      >
        <g className="nrc__edges">
          {PLACEHOLDER_EDGES.map((edge) => {
            const from = nodeById.get(edge.from)
            const to = nodeById.get(edge.to)
            if (from === undefined || to === undefined) return null
            return (
              <line
                key={edge.id}
                className="nrc__edge"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--nrc-edge-stroke, #38e1ff)"
                strokeWidth={2}
              />
            )
          })}
        </g>

        <g className="nrc__nodes">
          {PLACEHOLDER_NODES.map((node) => (
            <g key={node.id} className="nrc__node" data-nrc-node-id={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS}
                fill="var(--nrc-node-fill, #1b2550)"
                stroke="var(--nrc-node-stroke, #38e1ff)"
                strokeWidth={2}
              />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                style={labelStyle}
              >
                {node.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <p className="nrc__caption" style={captionStyle}>
        {caption}
      </p>
    </div>
  )
}

export default Noracursion
