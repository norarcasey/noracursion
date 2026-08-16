import type { CSSProperties } from 'react'
import type { NodeColor } from '../core/model'
import type { Layout, LayoutEdge, LayoutNode } from '../layout'
import type { LabelMode } from '../types'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface StageProps {
  readonly layout: Layout
  /** Describes the picture for a screen reader; the SVG is one `img`. */
  readonly ariaLabel: string
  readonly labelMode?: LabelMode
  /** Draw an index caption beneath each node — arrays and heaps-as-arrays. */
  readonly showIndexLabels?: boolean
  /** Transition duration for movement, in milliseconds. */
  readonly speedMs?: number
  readonly className?: string
}

/** Kinds that point somewhere, and so get an arrowhead. */
const DIRECTED = new Set(['next', 'prev', 'parent'])

/**
 * Colours that carry meaning, each paired with a non-chromatic encoding.
 *
 * §2 requires this: in a red-black tree the colour *is* the mnemonic, so it
 * cannot be the only channel carrying it. A colourblind reader gets the same
 * information from the stroke pattern and the corner glyph, and neither
 * depends on being able to tell the fills apart.
 */
const SEMANTIC_COLORS: Readonly<Record<string, { fill: string; dash?: string; glyph: string }>> = {
  red: { fill: 'var(--nrc-node-red, #c5372c)', dash: '5 3', glyph: 'R' },
  black: { fill: 'var(--nrc-node-black, #14161f)', glyph: 'B' },
}

/**
 * The SVG renderer.
 *
 * Movement is a CSS transition on `transform`, keyed by stable node id (§3.5),
 * so React reuses the same element across renders and the browser interpolates
 * between positions — a rotation reads as motion instead of teleportation.
 *
 * Edges get the same treatment, which needs a trick: `x1`/`y1`/`x2`/`y2` are
 * not reliably animatable as CSS properties, so an edge is drawn as a unit line
 * carried by `translate(…) rotate(…) scale(length, 1)`. Transform lists of the
 * same shape interpolate component-wise, so the line slides, turns and stretches
 * on the same clock as the nodes it connects. `vector-effect` keeps the scale
 * off the stroke width.
 */
export function Stage({
  layout,
  ariaLabel,
  labelMode = 'value',
  showIndexLabels = false,
  speedMs = 600,
  className,
}: StageProps) {
  const reducedMotion = usePrefersReducedMotion()
  // Reduced motion snaps to the final position. The stepping controls stay
  // fully usable — the animation is the thing being removed, not the feature.
  const transition = reducedMotion ? 'none' : `transform ${speedMs}ms ease-in-out`

  return (
    <svg
      className={className === undefined ? 'nrc__stage' : `nrc__stage ${className}`}
      style={stageStyle}
      viewBox={layout.viewBox}
      role="img"
      aria-label={ariaLabel}
    >
      <g className="nrc__edges">
        {layout.edges.map((edge) => (
          <Edge key={edge.id} edge={edge} transition={transition} />
        ))}
      </g>
      <g className="nrc__nodes">
        {layout.nodes.map((node) => (
          <Node
            key={node.id}
            node={node}
            labelMode={labelMode}
            showIndexLabel={showIndexLabels}
            transition={transition}
          />
        ))}
      </g>
    </svg>
  )
}

function Edge({ edge, transition }: { edge: LayoutEdge; transition: string }) {
  const stroke =
    edge.state === 'traversing' || edge.state === 'active'
      ? 'var(--nrc-edge-active, #ffd166)'
      : 'var(--nrc-edge-stroke, #4a5a94)'

  return (
    <g className="nrc__edge" data-nrc-edge-id={edge.id} data-nrc-edge-kind={edge.kind}>
      <g
        style={{
          transition,
          transform: `translate(${edge.x1}px, ${edge.y1}px) rotate(${edge.angle}deg) scale(${edge.length}, 1)`,
        }}
      >
        <line
          x1={0}
          y1={0}
          x2={1}
          y2={0}
          stroke={stroke}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      {edge.kind !== undefined && DIRECTED.has(edge.kind) && (
        <g
          style={{
            transition,
            transform: `translate(${edge.x2}px, ${edge.y2}px) rotate(${edge.angle}deg)`,
          }}
        >
          <path className="nrc__arrowhead" d="M0,0 L-9,-4.5 L-9,4.5 Z" fill={stroke} />
        </g>
      )}
    </g>
  )
}

function Node({
  node,
  labelMode,
  showIndexLabel,
  transition,
}: {
  node: LayoutNode
  labelMode: LabelMode
  showIndexLabel: boolean
  transition: string
}) {
  const semantic = node.color === undefined ? undefined : SEMANTIC_COLORS[node.color]
  const index = readIndex(node)

  return (
    <g
      className="nrc__node"
      data-nrc-node-id={node.id}
      data-nrc-state={node.state}
      data-nrc-color={node.color}
      style={{ transition, transform: `translate(${node.x}px, ${node.y}px)` }}
    >
      <circle
        r={node.radius}
        fill={semantic === undefined ? fillFor(node.color) : semantic.fill}
        stroke="var(--nrc-node-stroke, #38e1ff)"
        strokeWidth={2}
        strokeDasharray={semantic?.dash}
      />
      {labelText(node, labelMode, index) !== null && (
        <text textAnchor="middle" dominantBaseline="central" style={labelStyle}>
          {labelText(node, labelMode, index)}
        </text>
      )}
      {semantic !== undefined && (
        // The colour's non-chromatic twin: readable whether or not the fills
        // can be told apart.
        <text
          className="nrc__glyph"
          x={node.radius - 1}
          y={-node.radius + 1}
          textAnchor="middle"
          dominantBaseline="central"
          style={glyphStyle}
        >
          {semantic.glyph}
        </text>
      )}
      {showIndexLabel && labelMode !== 'index' && index !== null && (
        <text
          className="nrc__index"
          y={node.radius + 14}
          textAnchor="middle"
          dominantBaseline="central"
          style={indexStyle}
        >
          {index}
        </text>
      )}
    </g>
  )
}

function labelText(node: LayoutNode, labelMode: LabelMode, index: number | null): string | null {
  if (labelMode === 'none') return null
  if (labelMode === 'index') return index === null ? '' : String(index)
  return node.label
}

function readIndex(node: LayoutNode): number | null {
  const value = node.meta?.index
  return typeof value === 'number' ? value : null
}

function fillFor(color: NodeColor | undefined): string {
  return color === undefined ? 'var(--nrc-node-fill, #1b2550)' : color
}

const stageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  borderRadius: '8px',
  background: 'var(--nrc-stage, #0b1020)',
}

const labelStyle: CSSProperties = {
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  fontSize: '14px',
  fontWeight: 600,
  fill: 'var(--nrc-node-label, #e7ecff)',
  userSelect: 'none',
}

const glyphStyle: CSSProperties = {
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  fontSize: '10px',
  fontWeight: 700,
  fill: 'var(--nrc-node-label, #e7ecff)',
  userSelect: 'none',
}

const indexStyle: CSSProperties = {
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  fontSize: '11px',
  fill: 'var(--nrc-muted, #9fb0e8)',
  userSelect: 'none',
}
