import { parse as acornParse, type Node, type Program } from 'acorn'
import { transform } from 'sucrase'
import { parseError, type NoracursionError } from './errors'

export interface Position {
  readonly line: number
  readonly column: number
}

export interface ParsedProgram {
  readonly program: Program
  /**
   * The line of *original* source at a 1-based line number.
   *
   * Diagnostics quote this rather than the stripped source. Sucrase preserves
   * line numbers exactly (an `interface` becomes a blank line) but not columns,
   * because removing `: number` shifts everything after it left. Lines are what
   * the current-line highlight and the error panels need; quoting the original
   * means a learner sees the code they actually wrote.
   */
  sourceLine(line: number): string
}

/**
 * Strip TypeScript types, then parse.
 *
 * The stripper is an internal detail and must not leak into the public API
 * (CLAUDE.md §3.2). Sucrase is the spec's default recommendation and is used
 * here for one reason worth stating: it preserves line numbers, which is the
 * property line-accurate stepping is built on.
 */
export function parse(source: string): ParsedProgram {
  const lines = source.split('\n')
  const sourceLine = (line: number): string => lines[line - 1] ?? ''

  let stripped: string
  try {
    stripped = transform(source, { transforms: ['typescript'], disableESTransforms: true }).code
  } catch (error) {
    const { line, column } = positionFromThrown(error)
    throw parseError(messageOf(error, 'That code has a syntax error.'), line, column)
  }

  let program: Program
  try {
    // Parsed as ES2022 rather than the ES2020 of CLAUDE.md §3.2, deliberately:
    // the extra syntax is still rejected, but by `validateSubset`, which names
    // the construct and the line. Parsing the narrower grammar would turn a
    // class field into "Unexpected token (2:8)", which is exactly the "failing
    // weirdly" that §3.2 is trying to avoid.
    program = acornParse(stripped, {
      ecmaVersion: 2022,
      sourceType: 'module',
      locations: true,
    })
  } catch (error) {
    const { line, column } = positionFromThrown(error)
    throw parseError(messageOf(error, 'That code has a syntax error.'), line, column)
  }

  return { program, sourceLine }
}

/** 1-based line/column for a node, defaulting sanely if `locations` was off. */
export function positionOf(node: Node): Position {
  const loc = node.loc
  if (loc === null || loc === undefined) return { line: 1, column: 1 }
  return { line: loc.start.line, column: loc.start.column + 1 }
}

/** Where a node *ends*, for frames that mark completion rather than arrival. */
export function endPositionOf(node: Node): Position {
  const loc = node.loc
  if (loc === null || loc === undefined) return { line: 1, column: 1 }
  return { line: loc.end.line, column: loc.end.column + 1 }
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    // Acorn appends "(3:11)" to its messages; the position is reported
    // separately and structurally, so drop the duplicate.
    return error.message.replace(/\s*\(\d+:\d+\)\s*$/, '')
  }
  return fallback
}

/**
 * Pull a position out of a thrown parse error without a type assertion: acorn
 * attaches `loc`, sucrase only puts `(line:column)` in the message.
 */
function positionFromThrown(error: unknown): Position {
  if (typeof error === 'object' && error !== null && 'loc' in error) {
    const loc = error.loc
    if (typeof loc === 'object' && loc !== null && 'line' in loc && 'column' in loc) {
      const { line, column } = loc
      if (typeof line === 'number' && typeof column === 'number') {
        return { line, column: column + 1 }
      }
    }
  }
  if (error instanceof Error) {
    const match = /\((\d+):(\d+)\)/.exec(error.message)
    if (match !== null) {
      const line = Number.parseInt(match[1], 10)
      const column = Number.parseInt(match[2], 10)
      return { line, column: column + 1 }
    }
  }
  return { line: 1, column: 1 }
}

export type { NoracursionError }
