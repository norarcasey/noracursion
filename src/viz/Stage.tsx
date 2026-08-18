import type { CSSProperties } from 'react'
import type { NodeColor } from '../core/model'
import type { Layout, LayoutEdge, LayoutNode } from '../layout'
import type { ColorMode, LabelMode } from '../types'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface StageProps {
  readonly layout: Layout
  /** Describes the picture for a screen reader; the SVG is one `img`. */
  readonly ariaLabel: string
  readonly labelMode?: LabelMode
  readonly colorMode?: ColorMode
  /** Draw an index caption beneath each node — arrays and heaps-as-arrays. */
  readonly showIndexLabels?: boolean
  /** Transition duration for movement, in milliseconds. */
  readonly speedMs?: number
  readonly className?: string
}

/** Kinds that point somewhere, and so get an arrowhead. */
const DIRECTED = new Set(['next', 'prev', 'parent'])

/**
 * Execution state, each with a stroke treatment as well as a fill.
 *
 * The stroke is what a reader who cannot separate the fills goes by, so it is
 * not decoration: `visiting` is thick and solid, `compared` finely dashed,
 * `swapped` coarsely dashed. The stroke wins over a structural colour's dash
 * when a node has both, because state is the thing that is changing.
 */
const STATE_PAINT: Readonly<Record<string, { fill: string; strokeWidth: number; dash?: string }>> =
  {
    visiting: { fill: 'var(--nrc-state-visiting, #ffd166)', strokeWidth: 4 },
    compared: { fill: 'var(--nrc-state-compared, #38e1ff)', strokeWidth: 3, dash: '2 3' },
    swapped: { fill: 'var(--nrc-state-swapped, #b388ff)', strokeWidth: 3, dash: '6 3' },
    found: { fill: 'var(--nrc-state-found, #7bd88f)', strokeWidth: 4 },
    removed: { fill: 'var(--nrc-state-removed, #55607f)', strokeWidth: 2, dash: '1 4' },
  }

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
  colorMode = 'structure',
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
            colorMode={colorMode}
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
      {edge.label !== undefined && edge.length > 0 && (
        // Weights ride at the midpoint, upright: a rotated number is a number
        // nobody reads.
        <g
          style={{
            transition,
            transform: `translate(${(edge.x1 + edge.x2) / 2}px, ${(edge.y1 + edge.y2) / 2}px)`,
          }}
        >
          <text
            className="nrc__edge-label"
            textAnchor="middle"
            dominantBaseline="central"
            style={edgeLabelStyle}
          >
            {edge.label}
          </text>
        </g>
      )}
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
  colorMode,
  showIndexLabel,
  transition,
}: {
  node: LayoutNode
  labelMode: LabelMode
  colorMode: ColorMode
  showIndexLabel: boolean
  transition: string
}) {
  const semantic = node.color === undefined ? undefined : SEMANTIC_COLORS[node.color]
  const state = node.state === undefined ? undefined : STATE_PAINT[node.state]
  const index = readIndex(node)
  const mark = typeof node.meta?.mark === 'string' ? node.meta.mark : null

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
        fill={fillFor(colorMode, node.color, semantic, state)}
        stroke="var(--nrc-node-stroke, #38e1ff)"
        strokeWidth={state?.strokeWidth ?? 2}
        strokeDasharray={state?.dash ?? semantic?.dash}
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
      {mark !== null && (
        <text
          className="nrc__mark"
          y={-node.radius - 7}
          textAnchor="middle"
          dominantBaseline="central"
          style={markStyle}
        >
          {mark}
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

const NEUTRAL_FILL = 'var(--nrc-node-fill, #1b2550)'

/**
 * `colorMode` decides which of the two colour systems wins (§2).
 *
 * `structure` prefers the structure's own meaning — a red-black node stays red —
 * and falls back to execution state where the structure has nothing to say,
 * which is most of the time for arrays and lists. `state` ignores the
 * structural colour outright, and `none` keeps every fill neutral. The stroke
 * treatment for state is applied in all three, so a colourblind reader — and a
 * reader who chose `none` — can still see what the code is doing.
 */
function fillFor(
  colorMode: ColorMode,
  color: NodeColor | undefined,
  semantic: { fill: string } | undefined,
  state: { fill: string } | undefined,
): string {
  if (colorMode === 'none') return NEUTRAL_FILL
  if (colorMode === 'state') return state?.fill ?? NEUTRAL_FILL
  if (semantic !== undefined) return semantic.fill
  if (color !== undefined) return color
  return state?.fill ?? NEUTRAL_FILL
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

const markStyle: CSSProperties = {
  fontFamily: 'var(--nrc-font, system-ui, sans-serif)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  fill: 'var(--nrc-state-visiting, #ffd166)',
  userSelect: 'none',
}

const edgeLabelStyle: CSSProperties = {
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  fontSize: '10px',
  fontWeight: 600,
  fill: 'var(--nrc-muted, #9fb0e8)',
  paintOrder: 'stroke',
  stroke: 'var(--nrc-stage, #0b1020)',
  strokeWidth: 3,
  userSelect: 'none',
}

const indexStyle: CSSProperties = {
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  fontSize: '11px',
  fill: 'var(--nrc-muted, #9fb0e8)',
  userSelect: 'none',
}
