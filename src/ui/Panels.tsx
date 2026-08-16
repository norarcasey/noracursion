import type { CSSProperties } from 'react'
import { formatSnapshot, type Step } from '../interpreter/values'

/**
 * The inspector panels: variables, call stack and `log()` output (§3.6).
 *
 * All three read straight off the current `Step`, which is why the interpreter
 * carries a scope snapshot and a call stack on every one of them. Nothing here
 * computes anything — it renders what the step already knows.
 */

export function Panels({ step, logs }: { step: Step | null; logs: readonly string[] }) {
  return (
    <div className="nrc__panels" style={panelsStyle}>
      <Variables step={step} />
      <CallStack step={step} />
      <LogOutput logs={logs} />
    </div>
  )
}

function Variables({ step }: { step: Step | null }) {
  const entries =
    step === null ? [] : Object.entries(step.scope).sort(([a], [b]) => (a < b ? -1 : 1))

  return (
    <section className="nrc__panel nrc__panel--variables" style={panelStyle} aria-label="Variables">
      <h3 style={panelTitleStyle}>Variables</h3>
      {entries.length === 0 ? (
        <p style={emptyStyle}>None in scope.</p>
      ) : (
        <dl style={listStyle}>
          {entries.map(([name, snapshot]) => (
            <div key={name} style={rowStyle}>
              <dt style={nameStyle}>{name}</dt>
              <dd style={valueStyle}>{formatSnapshot(snapshot)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function CallStack({ step }: { step: Step | null }) {
  // Innermost first, which is how a stack is read and how recursion is
  // followed: the frame you are in sits at the top.
  const frames = step === null ? [] : [...step.callStack].reverse()

  return (
    <section className="nrc__panel nrc__panel--stack" style={panelStyle} aria-label="Call stack">
      <h3 style={panelTitleStyle}>Call stack</h3>
      {frames.length === 0 ? (
        <p style={emptyStyle}>Top level.</p>
      ) : (
        <ol style={listStyle}>
          {frames.map((name, index) => (
            <li key={`${name}-${index}`} style={frameStyle}>
              <span style={depthStyle}>{frames.length - index}</span>
              <span style={nameStyle}>{name}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function LogOutput({ logs }: { logs: readonly string[] }) {
  return (
    <section className="nrc__panel nrc__panel--log" style={panelStyle} aria-label="Log output">
      <h3 style={panelTitleStyle}>Output</h3>
      {logs.length === 0 ? (
        <p style={emptyStyle}>Nothing logged yet.</p>
      ) : (
        <ol style={listStyle} aria-live="polite">
          {logs.map((line, index) => (
            <li key={index} style={logLineStyle}>
              {line}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

const panelsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))',
  gap: '0.75rem',
}

const panelStyle: CSSProperties = {
  minWidth: 0,
  padding: '0.6rem 0.75rem',
  borderRadius: '8px',
  background: 'var(--nrc-stage, #0b1020)',
  border: '1px solid var(--nrc-edge-stroke, #4a5a94)',
}

const panelTitleStyle: CSSProperties = {
  margin: '0 0 0.4rem',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--nrc-muted, #9fb0e8)',
}

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  fontSize: '0.78rem',
  lineHeight: 1.6,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'baseline',
}

const frameStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'baseline',
}

const depthStyle: CSSProperties = {
  color: 'var(--nrc-muted, #9fb0e8)',
  fontVariantNumeric: 'tabular-nums',
}

const nameStyle: CSSProperties = {
  margin: 0,
  color: 'var(--nrc-code-type, #7fdbca)',
  whiteSpace: 'nowrap',
}

const valueStyle: CSSProperties = {
  margin: 0,
  minWidth: 0,
  overflowWrap: 'anywhere',
  color: 'var(--nrc-text, #e7ecff)',
}

const logLineStyle: CSSProperties = {
  overflowWrap: 'anywhere',
  color: 'var(--nrc-text, #e7ecff)',
}

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.78rem',
  color: 'var(--nrc-muted, #9fb0e8)',
}
