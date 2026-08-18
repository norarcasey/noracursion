import type { NoracursionProps } from './components/Noracursion'

/**
 * Compile-time tests for the props union (CLAUDE.md §6.5).
 *
 * `@ts-expect-error` is the assertion: if one of these combinations ever stops
 * being an error, `tsc` fails on the unused directive. Nothing here runs — the
 * typecheck *is* the test, which is the only way to test a type.
 *
 * The directives sit on the declaration rather than on `operation`, because
 * that is where the error lands: `CustomExample` is the last branch TypeScript
 * tries, so the message a consumer actually sees is "Property 'code' is
 * missing". Indirect, but it names the fix — either pick a pairing that exists,
 * or bring the program that makes this one mean something.
 */

/* --- pairings that exist ------------------------------------------------- */

export const sortingAnArray: NoracursionProps = { structure: 'array', operation: 'sort' }

export const sortingWithAnAlgorithm: NoracursionProps = {
  structure: 'array',
  operation: 'sort',
  sortAlgorithm: 'quick',
}

export const walkingATree: NoracursionProps = {
  structure: 'binary-search-tree',
  operation: 'traverse',
  traversalOrder: 'post-order',
}

export const repairingARedBlackTree: NoracursionProps = {
  structure: 'red-black-tree',
  operation: 'insert',
  recursion: false,
}

export const routingAGraph: NoracursionProps = { structure: 'graph', operation: 'shortest-path' }

export const siftingAHeap: NoracursionProps = { structure: 'min-heap', operation: 'delete' }

/* --- pairings that do not ------------------------------------------------ */

// @ts-expect-error - an array cannot be balanced, and no `code` was supplied
export const balancingAnArray: NoracursionProps = { structure: 'array', operation: 'balance' }

// @ts-expect-error - a stack has no shortest path
export const routingAStack: NoracursionProps = { structure: 'stack', operation: 'shortest-path' }

// @ts-expect-error - `sort` belongs to the array
export const sortingATree: NoracursionProps = {
  structure: 'binary-search-tree',
  operation: 'sort',
}

// @ts-expect-error - a trie is not sorted with an algorithm
export const sortingATrie: NoracursionProps = { structure: 'trie', operation: 'sort' }

export const inventingAStructure: NoracursionProps = {
  // Unknown structures are rejected outright — `code` does not rescue this one,
  // because there is nothing to build.
  // @ts-expect-error - there is no skip list
  structure: 'skip-list',
  operation: 'insert',
  code: 'log(1)',
}

/* --- your own code opens the pairing back up ----------------------------- */

export const balancingAnArrayYourWay: NoracursionProps = {
  structure: 'array',
  operation: 'balance',
  // The registry constrains what Noracursion provides, not what you write.
  code: 'log(arr.length)',
}

export const deletingFromAGraph: NoracursionProps = {
  structure: 'graph',
  operation: 'delete',
  code: 'log(graph.size())',
}
