import { useId, useMemo, type CSSProperties } from 'react'
import type { Language } from '../types'
import { tokenizeLines, type TokenKind } from './highlight'

/**
 * The seam a CodeMirror or Monaco adapter would slot into (§3.6).
 *
 * v1 ships the textarea implementation below, because a library that drags in
 * an editor is a library nobody installs for one component. Anything wanting a
 * real editor implements this and swaps it in; nothing else has to change.
 */
export interface EditorAdapter {
  (props: EditorProps): React.ReactNode
}

export interface EditorProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly editable: boolean
  readonly language: Language
  /** Line the interpreter is on, 1-based. `null` when nothing is running. */
  readonly currentLine: number | null
  /** Labels the editor for screen readers. */
  readonly label: string
}

const LINE_HEIGHT = 21
const FONT = 'var(--nrc-mono, ui-monospace, Menlo, Monaco, Consolas, monospace)'
const FONT_SIZE = '13px'

const TOKEN_COLORS: Readonly<Record<TokenKind, string>> = {
  keyword: 'var(--nrc-code-keyword, #c792ea)',
  type: 'var(--nrc-code-type, #7fdbca)',
  string: 'var(--nrc-code-string, #ecc48d)',
  number: 'var(--nrc-code-number, #f78c6c)',
  comment: 'var(--nrc-code-comment, #6b7aa8)',
  punctuation: 'var(--nrc-code-punctuation, #9fb0e8)',
  plain: 'var(--nrc-code-plain, #d6deff)',
}

/**
 * A transparent `<textarea>` layered exactly over a highlighted `<pre>`.
 *
 * The reader types into the textarea — real caret, real selection, real
 * undo — while seeing the coloured copy underneath. The two only stay aligned
 * if every metric that affects glyph position is identical on both, which is
 * why the font, size, line height, padding and whitespace handling are set from
 * one place rather than in each element's own styles.
 */
export function Editor({ value, onChange, editable, language, currentLine, label }: EditorProps) {
  const id = useId()
  const lines = useMemo(() => tokenizeLines(value), [value])
  const gutterWidth = `${String(lines.length).length + 1}ch`

  return (
    <div className="nrc__editor" style={editorStyle}>
      <div
        className="nrc__gutter"
        style={{ ...gutterStyle, width: gutterWidth }}
        aria-hidden="true"
      >
        {lines.map((_, index) => (
          <div
            key={index}
            className={
              currentLine === index + 1
                ? 'nrc__line-number nrc__line-number--current'
                : 'nrc__line-number'
            }
            style={{
              ...lineStyle,
              color:
                currentLine === index + 1
                  ? 'var(--nrc-code-current, #ffd166)'
                  : 'var(--nrc-muted, #9fb0e8)',
            }}
          >
            {index + 1}
          </div>
        ))}
      </div>

      <div className="nrc__code" style={codeStyle}>
        {currentLine !== null && currentLine <= lines.length && (
          <div
            className="nrc__current-line"
            data-nrc-current-line={currentLine}
            style={{ ...currentLineStyle, top: `${(currentLine - 1) * LINE_HEIGHT}px` }}
            aria-hidden="true"
          />
        )}

        <pre className="nrc__highlight" style={layerStyle} aria-hidden="true">
          {lines.map((tokens, index) => (
            <div key={index} style={lineStyle}>
              {tokens.length === 0
                ? // A zero-width space keeps an empty line the same height as a
                  // full one, so the textarea never drifts out of alignment.
                  '​'
                : tokens.map((token, position) => (
                    <span key={position} style={{ color: TOKEN_COLORS[token.kind] }}>
                      {token.text}
                    </span>
                  ))}
            </div>
          ))}
        </pre>

        <textarea
          id={id}
          className="nrc__textarea"
          style={textareaStyle}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={!editable}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label={label}
          data-nrc-language={language}
        />
      </div>
    </div>
  )
}

const editorStyle: CSSProperties = {
  display: 'flex',
  overflow: 'auto',
  maxHeight: '22rem',
  borderRadius: '8px',
  background: 'var(--nrc-code-surface, #0b1020)',
  border: '1px solid var(--nrc-edge-stroke, #4a5a94)',
}

const gutterStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '0.75rem 0.5rem 0.75rem 0.75rem',
  textAlign: 'right',
  fontFamily: FONT,
  fontSize: FONT_SIZE,
  userSelect: 'none',
  background: 'var(--nrc-gutter, #0e1530)',
}

const codeStyle: CSSProperties = {
  position: 'relative',
  flex: '1 1 auto',
  minWidth: 0,
}

const lineStyle: CSSProperties = {
  height: `${LINE_HEIGHT}px`,
  lineHeight: `${LINE_HEIGHT}px`,
}

// Every metric that moves a glyph is repeated identically on the highlighted
// layer and the textarea. If these drift apart, the caret stops landing where
// the coloured text says it should.
const layerMetrics: CSSProperties = {
  margin: 0,
  padding: '0.75rem',
  fontFamily: FONT,
  fontSize: FONT_SIZE,
  lineHeight: `${LINE_HEIGHT}px`,
  letterSpacing: 'normal',
  tabSize: 2,
  whiteSpace: 'pre',
  overflowWrap: 'normal',
}

const layerStyle: CSSProperties = {
  ...layerMetrics,
  position: 'relative',
  pointerEvents: 'none',
}

const textareaStyle: CSSProperties = {
  ...layerMetrics,
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  border: 'none',
  outline: 'none',
  resize: 'none',
  overflow: 'hidden',
  background: 'transparent',
  // The glyphs come from the layer underneath; only the caret and the
  // selection highlight come from the textarea itself.
  color: 'transparent',
  caretColor: 'var(--nrc-code-caret, #38e1ff)',
}

const currentLineStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: `${LINE_HEIGHT}px`,
  marginTop: '0.75rem',
  background: 'var(--nrc-code-current-bg, rgba(255, 209, 102, 0.12))',
  borderLeft: '2px solid var(--nrc-code-current, #ffd166)',
  pointerEvents: 'none',
}
