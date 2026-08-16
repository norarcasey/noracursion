/**
 * Framework-free public types.
 *
 * These are the unions from CLAUDE.md §2, declared up front so the API shape is
 * visible while the milestones fill it in. M0 implements none of the structures
 * or operations — the component renders a static placeholder — so the props
 * interface in `components/Noracursion.tsx` deliberately accepts only the
 * subset it actually honours. Props are added as the milestone that implements
 * them lands, never before.
 */

/** A data structure the component knows how to draw. */
export type Structure =
  | 'array'
  | 'linked-list'
  | 'doubly-linked-list'
  | 'stack'
  | 'queue'
  | 'binary-search-tree'
  | 'red-black-tree'
  | 'avl-tree'
  | 'min-heap'
  | 'max-heap'
  | 'trie'
  | 'graph'

/** What the animated program does to the structure. */
export type Operation =
  'insert' | 'delete' | 'search' | 'traverse' | 'sort' | 'balance' | 'shortest-path'

/** Visit order, meaningful only for `traverse`. */
export type TraversalOrder = 'in-order' | 'pre-order' | 'post-order' | 'level-order'

/** Algorithm choice, meaningful only for `sort`. */
export type SortAlgorithm = 'bubble' | 'insertion' | 'selection' | 'merge' | 'quick' | 'heap'

/**
 * Language the code panel displays. Only `typescript` executes; the rest are
 * display-only and say so on the panel (CLAUDE.md §4).
 */
export type Language = 'typescript' | 'javascript' | 'python' | 'java' | 'go'
