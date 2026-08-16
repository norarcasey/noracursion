export type TokenKind =
  'keyword' | 'type' | 'string' | 'number' | 'comment' | 'punctuation' | 'plain'

export interface Token {
  readonly kind: TokenKind
  readonly text: string
}

/**
 * A deliberately small tokenizer for the code panel.
 *
 * It exists instead of a highlighting dependency because §5 caps the runtime
 * dependency list at the type-stripper and the parser, and a highlighter would
 * be a third — one whose whole job is cosmetic. It is a lexer, not a parser: it
 * can tell a string from a keyword but has no idea what any of it means, which
 * is all a colour needs.
 *
 * Output is a token list, never HTML. The editor renders each token as a
 * `<span>`, so user-typed code can never become markup — a highlighter that
 * builds an HTML string is one `dangerouslySetInnerHTML` away from executing
 * whatever the reader typed.
 */
const KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'yield',
  'async',
  'await',
  'interface',
  'type',
  'enum',
  'implements',
  'true',
  'false',
  'null',
  'undefined',
])

/** Names that read as types in the snippets, coloured apart from keywords. */
const TYPES = new Set([
  'number',
  'string',
  'boolean',
  'any',
  'unknown',
  'never',
  'Array',
  'Math',
  'console',
])

const PUNCTUATION = new Set([...'{}()[];,.:?<>=!+-*/%&|^~'])

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0
  let plain = ''

  const flush = (): void => {
    if (plain !== '') {
      tokens.push({ kind: 'plain', text: plain })
      plain = ''
    }
  }
  const push = (kind: TokenKind, text: string): void => {
    flush()
    tokens.push({ kind, text })
  }

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    // Comments run to end of line, or to the closing delimiter.
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index)
      const stop = end === -1 ? source.length : end
      push('comment', source.slice(index, stop))
      index = stop
      continue
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      push('comment', source.slice(index, stop))
      index = stop
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      const stop = endOfString(source, index, char)
      push('string', source.slice(index, stop))
      index = stop
      continue
    }

    if (isDigit(char)) {
      let stop = index
      while (
        stop < source.length &&
        (isDigit(source[stop]) || source[stop] === '.' || source[stop] === '_')
      ) {
        stop += 1
      }
      push('number', source.slice(index, stop))
      index = stop
      continue
    }

    if (isWordStart(char)) {
      let stop = index
      while (stop < source.length && isWordPart(source[stop])) stop += 1
      const word = source.slice(index, stop)
      if (KEYWORDS.has(word)) push('keyword', word)
      else if (TYPES.has(word)) push('type', word)
      else plain += word
      index = stop
      continue
    }

    if (PUNCTUATION.has(char)) {
      push('punctuation', char)
      index += 1
      continue
    }

    plain += char
    index += 1
  }

  flush()
  return tokens
}

/** Splits tokens into one array per source line, keeping line breaks aligned. */
export function tokenizeLines(source: string): Token[][] {
  const lines: Token[][] = [[]]
  for (const token of tokenize(source)) {
    const parts = token.text.split('\n')
    parts.forEach((part, offset) => {
      if (offset > 0) lines.push([])
      if (part !== '') lines[lines.length - 1].push({ kind: token.kind, text: part })
    })
  }
  return lines
}

function endOfString(source: string, start: number, quote: string): number {
  let index = start + 1
  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
      continue
    }
    if (source[index] === quote) return index + 1
    // An unterminated single-quoted string stops at the newline, so one typo
    // cannot paint the rest of the file as a string.
    if (source[index] === '\n' && quote !== '`') return index
    index += 1
  }
  return source.length
}

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9'
}

function isWordStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char)
}

function isWordPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char)
}
