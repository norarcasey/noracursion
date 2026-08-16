import type { CSSProperties } from 'react'

/**
 * What the colours mean (§2's `showLegend`).
 *
 * Each entry names its non-chromatic encoding as well as its colour, for the
 * same reason the renderer draws one: a reader who cannot separate the fills
 * still has to be able to read the picture.
 */
const ENTRIES: ReadonlyArray<{ state: string; label: string; fill: string; note: string }> = [
  {
    state: 'visiting',
    label: 'Visiting',
    fill: 'var(--nrc-state-visiting, #ffd166)',
    note: 'the node the code is looking at now',
  },
  {
    state: 'compared',
    label: 'Compared',
    fill: 'var(--nrc-state-compared, #38e1ff)',
    note: 'the two values being tested against each other',
  },
  {
    state: 'swapped',
    label: 'Swapped',
    fill: 'var(--nrc-state-swapped, #b388ff)',
    note: 'the two that just traded places',
  },
]

export function Legend() {
  return (
    <section className="nrc__legend" style={legendStyle} aria-label="Legend">
      <dl style={listStyle}>
        {ENTRIES.map((entry) => (
          <div key={entry.state} style={rowStyle}>
            <dt style={swatchWrapStyle}>
              <span
                aria-hidden="true"
                className={`nrc__swatch nrc__swatch--${entry.state}`}
                style={{ ...swatchStyle, background: entry.fill }}
              />
              <span style={labelStyle}>{entry.label}</span>
            </dt>
            <dd style={noteStyle}>{entry.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const legendStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  background: 'var(--nrc-stage, #0b1020)',
  border: '1px solid var(--nrc-edge-stroke, #4a5a94)',
}

const listStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem 1.25rem',
  margin: 0,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.4rem',
  fontSize: '0.78rem',
}

const swatchWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  margin: 0,
  fontWeight: 600,
}

const swatchStyle: CSSProperties = {
  display: 'inline-block',
  width: '0.7rem',
  height: '0.7rem',
  borderRadius: '50%',
  border: '1px solid var(--nrc-node-stroke, #38e1ff)',
}

const labelStyle: CSSProperties = {
  color: 'var(--nrc-text, #e7ecff)',
}

const noteStyle: CSSProperties = {
  margin: 0,
  color: 'var(--nrc-muted, #9fb0e8)',
}
