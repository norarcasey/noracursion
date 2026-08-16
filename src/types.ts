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

/** What each node shows inside its circle. */
export type LabelMode = 'value' | 'index' | 'none'

/**
 * The structures that have a model behind them today. Anything in `Structure`
 * but not here is drawn as a "can't do this yet" notice rather than a blank
 * stage — see the note in CLAUDE.md §6.5 about unimplemented combinations.
 */
export const DRAWABLE_STRUCTURES = ['array', 'linked-list', 'binary-search-tree'] as const

export type DrawableStructure = (typeof DRAWABLE_STRUCTURES)[number]

/**
 * How each structure is written in prose.
 *
 * The prop values are slugs, and a slug read aloud by a screen reader — or
 * dropped into a sentence — comes out as "red dash black dash tree". The
 * mapping is hand-written rather than derived because the right typography is
 * not mechanical: `red-black tree` keeps its hyphen, `AVL` is capitalised, and
 * `linked-list` loses its hyphen entirely.
 */
export const STRUCTURE_LABELS: Readonly<Record<Structure, string>> = {
  array: 'array',
  'linked-list': 'linked list',
  'doubly-linked-list': 'doubly linked list',
  stack: 'stack',
  queue: 'queue',
  'binary-search-tree': 'binary search tree',
  'red-black-tree': 'red-black tree',
  'avl-tree': 'AVL tree',
  'min-heap': 'min-heap',
  'max-heap': 'max-heap',
  trie: 'trie',
  graph: 'graph',
}
