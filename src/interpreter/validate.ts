import type { AnyNode, Program } from 'acorn'
import { walk } from './ast'
import { unsupported } from './errors'
import { positionOf } from './parse'

/**
 * Check a program against the v1 subset *before* running it.
 *
 * This is a whitelist, checked up front, and both of those matter:
 *
 * - Up front, because rejecting only what executes means an uncalled `async
 *   function` runs clean and the learner is told nothing. The rule in §3.2 is
 *   to reject with a clear message rather than fail weirdly, and staying quiet
 *   until the line happens to run is its own kind of weird.
 * - A whitelist, because a blocklist silently admits every node type the
 *   parser learns about next — which lands as a confusing interpreter crash
 *   instead of "Noracursion can't run this yet".
 */

const SUPPORTED_NODE_TYPES: ReadonlySet<string> = new Set([
  'Program',
  // statements
  'EmptyStatement',
  'BlockStatement',
  'ExpressionStatement',
  'VariableDeclaration',
  'VariableDeclarator',
  'FunctionDeclaration',
  'ClassDeclaration',
  'ClassBody',
  'MethodDefinition',
  'IfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'ForStatement',
  'ForOfStatement',
  'BreakStatement',
  'ContinueStatement',
  'ReturnStatement',
  // expressions
  'Literal',
  'Identifier',
  'ThisExpression',
  'TemplateLiteral',
  'TemplateElement',
  'ArrayExpression',
  'ObjectExpression',
  'Property',
  'MemberExpression',
  'UnaryExpression',
  'UpdateExpression',
  'BinaryExpression',
  'LogicalExpression',
  'ConditionalExpression',
  'AssignmentExpression',
  'CallExpression',
  'NewExpression',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'ClassExpression',
  // patterns
  'ArrayPattern',
  'ObjectPattern',
])

/** Friendly names for constructs the v1 subset rejects (CLAUDE.md §3.2). */
const UNSUPPORTED_NAMES: Readonly<Record<string, string>> = {
  AwaitExpression: '`await`',
  ForInStatement: '`for...in` loops',
  TryStatement: '`try` / `catch`',
  CatchClause: '`try` / `catch`',
  ThrowStatement: '`throw`',
  SwitchStatement: '`switch`',
  SwitchCase: '`switch`',
  YieldExpression: 'generator functions',
  SpreadElement: 'spread (`...`) in calls and literals',
  RestElement: 'rest parameters (`...args`)',
  AssignmentPattern: 'default parameter values',
  ChainExpression: 'optional chaining (`?.`)',
  TaggedTemplateExpression: 'tagged template literals',
  LabeledStatement: 'labeled statements',
  PropertyDefinition: 'class fields declared outside the constructor',
  StaticBlock: 'static class blocks',
  PrivateIdentifier: 'private class fields (`#name`)',
  ImportDeclaration: '`import`',
  ImportExpression: 'dynamic `import()`',
  ExportNamedDeclaration: '`export`',
  ExportDefaultDeclaration: '`export default`',
  ExportAllDeclaration: '`export`',
  WithStatement: '`with`',
  SequenceExpression: 'comma expressions',
  MetaProperty: '`new.target`',
  Super: '`super`',
  DebuggerStatement: '`debugger`',
}

export function friendlyName(type: string): string {
  return UNSUPPORTED_NAMES[type] ?? `\`${type}\``
}

/** Reject a node by its own type. Used by the interpreter as a backstop. */
export function rejectUnsupported(node: AnyNode): never {
  const { line, column } = positionOf(node)
  throw unsupported(friendlyName(node.type), line, column)
}

function rejectAs(node: AnyNode, construct: string): never {
  const { line, column } = positionOf(node)
  throw unsupported(construct, line, column)
}

export function validateSubset(program: Program): void {
  walk(program, (node) => {
    if (!SUPPORTED_NODE_TYPES.has(node.type)) rejectUnsupported(node)

    // `async` and `generator` are flags on an otherwise ordinary function node,
    // so the type whitelist alone would let them through.
    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression'
    ) {
      if (node.async) rejectAs(node, '`async` functions')
      if (node.type !== 'ArrowFunctionExpression' && node.generator) {
        rejectAs(node, 'generator functions')
      }
    }

    if (node.type === 'Literal') {
      if (node.value instanceof RegExp) rejectAs(node, 'regular expressions')
      if (typeof node.value === 'bigint') rejectAs(node, 'BigInt literals')
    }

    // `get x() {}` / `set x(v) {}` are MethodDefinitions with a different kind.
    if (node.type === 'MethodDefinition') {
      if (node.kind === 'get' || node.kind === 'set') rejectAs(node, 'getters and setters')
      if (node.static) rejectAs(node, 'static class methods')
    }

    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      if (node.superClass !== null && node.superClass !== undefined) {
        rejectAs(node, 'class inheritance (`extends`)')
      }
    }

    return true
  })
}
