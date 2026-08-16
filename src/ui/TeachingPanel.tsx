import type { CSSProperties, ReactNode } from 'react'
import type { ErrorDetail, NoracursionError, TestVariable } from '../interpreter/errors'

/**
 * What the reader sees when their code goes wrong (§3.3).
 *
 * This is a teaching panel, not a stack trace. Every shape below names a line,
 * shows the code on it, and ends with a concrete next edit — because "an error
 * occurred" is a failure of this component's entire premise.
 */
export function TeachingPanel({ error }: { error: NoracursionError }) {
  return (
    <div className="nrc__teaching" role="alert" style={panelStyle}>
      <strong className="nrc__teaching-headline" style={headlineStyle}>
        {error.message}
      </strong>
      <Body detail={error.detail} />
      <p className="nrc__teaching-hint" style={hintStyle}>
        {error.hint}
      </p>
    </div>
  )
}

function Body({ detail }: { detail: ErrorDetail }) {
  switch (detail.kind) {
    case 'loop-budget':
      return (
        <>
          <SourceLine line={detail.loopLine} source={detail.loopSource} />
          <VariableTable variables={detail.testVariables} />
        </>
      )
    case 'recursion-depth':
      return (
        <p className="nrc__teaching-where" style={whereStyle}>
          {`It was called again from line ${detail.line}, ${detail.depth} calls deep, without ever returning.`}
        </p>
      )
    case 'step-budget':
      return (
        <p className="nrc__teaching-where" style={whereStyle}>
          {`It was still running at line ${detail.line} when it hit the step budget.`}
        </p>
      )
    case 'unsupported-syntax':
      return <SourceLine line={detail.line} source={null} label={`Line ${detail.line}`} />
    case 'parse':
    case 'runtime':
      return <SourceLine line={detail.line} source={null} label={`Line ${detail.line}`} />
  }
}

function SourceLine({
  line,
  source,
  label,
}: {
  line: number
  source: string | null
  label?: string
}) {
  return (
    <p className="nrc__teaching-where" style={whereStyle}>
      <span style={lineLabelStyle}>{label ?? `Line ${line}`}</span>
      {source !== null && (
        <>
          {': '}
          <code className="nrc__teaching-source" style={codeStyle}>
            {source}
          </code>
        </>
      )}
    </p>
  )
}

/**
 * The first-versus-latest table is the whole teaching payload of a runaway
 * loop: seeing that `current` never changed is what turns "it hung" into "I
 * forgot to advance the pointer".
 */
function VariableTable({ variables }: { variables: readonly TestVariable[] }) {
  if (variables.length === 0) return null
  return (
    <table className="nrc__teaching-vars" style={tableStyle}>
      <caption style={captionStyle}>Variables the loop condition reads</caption>
      <thead>
        <tr>
          <Th>Name</Th>
          <Th>First time round</Th>
          <Th>Now</Th>
        </tr>
      </thead>
      <tbody>
        {variables.map((variable) => (
          <tr key={variable.name} data-nrc-changed={variable.changed}>
            <Td>
              <code style={codeStyle}>{variable.name}</code>
            </Td>
            <Td>{variable.first}</Td>
            <Td>
              {variable.latest}
              {/* Not colour alone: the word carries the same meaning. */}
              <span style={variable.changed ? changedStyle : unchangedStyle}>
                {variable.changed ? ' (changed)' : ' (unchanged)'}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th scope="col" style={thStyle}>
      {children}
    </th>
  )
}

function Td({ children }: { children: ReactNode }) {
  return <td style={tdStyle}>{children}</td>
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.85rem 1rem',
  borderRadius: '8px',
  lineHeight: 1.55,
  background: 'var(--nrc-error-surface, #2a1416)',
  border: '1px solid var(--nrc-error-border, #c5372c)',
}

const headlineStyle: CSSProperties = {
  fontSize: '1rem',
}

const whereStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  color: 'var(--nrc-muted, #9fb0e8)',
}

const lineLabelStyle: CSSProperties = {
  fontWeight: 600,
}

const codeStyle: CSSProperties = {
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  fontSize: '0.85em',
  color: 'var(--nrc-text, #e7ecff)',
}

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
}

const tableStyle: CSSProperties = {
  borderCollapse: 'collapse',
  fontSize: '0.8rem',
  textAlign: 'left',
}

const captionStyle: CSSProperties = {
  captionSide: 'top',
  textAlign: 'left',
  paddingBottom: '0.25rem',
  fontSize: '0.7rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--nrc-muted, #9fb0e8)',
}

const thStyle: CSSProperties = {
  padding: '0.15rem 0.75rem 0.15rem 0',
  fontWeight: 600,
  color: 'var(--nrc-muted, #9fb0e8)',
}

const tdStyle: CSSProperties = {
  padding: '0.15rem 0.75rem 0.15rem 0',
  fontFamily: 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)',
  overflowWrap: 'anywhere',
}

const changedStyle: CSSProperties = {
  color: 'var(--nrc-muted, #9fb0e8)',
}

const unchangedStyle: CSSProperties = {
  color: 'var(--nrc-error-border, #c5372c)',
  fontWeight: 600,
}
