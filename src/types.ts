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

/**
 * A graph node, with the coordinates the author places it at.
 *
 * CLAUDE.md §2 lists `NodeSeed` in `initialData` but never defines it; this is
 * that definition. §3.5 makes v1 graphs author-positioned — a deterministic
 * force layout can come later — so `x` and `y` are required rather than
 * optional, because a graph whose positions are guessed is a graph that jitters
 * between renders, which §3.5 rules out.
 *
 * Edges name their target by label, which works because a graph's labels are
 * its identities.
 */
export interface NodeSeed {
  readonly label: number | string
  readonly x: number
  readonly y: number
  readonly edges?: ReadonlyArray<{ readonly to: number | string; readonly weight?: number }>
}

/** What `initialData` may hold: plain values, or positioned graph nodes. */
export type SeedData = ReadonlyArray<number | string> | readonly NodeSeed[]

export function isNodeSeed(value: number | string | NodeSeed): value is NodeSeed {
  return typeof value === 'object' && value !== null
}

/** What each node shows inside its circle. */
export type LabelMode = 'value' | 'index' | 'none'

/**
 * Where a node's colour comes from (CLAUDE.md §2).
 *
 * `structure` is the structure's own semantics — literal red and black for a
 * red-black tree, because there the colour *is* the mnemonic. `state` colours
 * by what the code is doing instead. `none` keeps every node neutral. In all
 * three, execution state is also drawn with a stroke treatment, so the picture
 * never depends on colour alone.
 */
export type ColorMode = 'structure' | 'state' | 'none'

/**
 * The operations each structure actually has, as a discriminated union on
 * `structure`.
 *
 * CLAUDE.md §6.5 asks for unimplemented combinations to be absent from the type
 * union rather than silently broken, and §2's two independent unions cannot say
 * that in their cross product — `array` × `shortest-path` and `stack` ×
 * `balance` are both spellable and neither means anything. This is where that
 * gets said.
 *
 * One branch per structure, deliberately: `structure` is the discriminant, and
 * two branches sharing a discriminant value turn a precise "operation must be
 * one of these" into a wall of union-mismatch noise. `sortAlgorithm` and
 * `traversalOrder` therefore stay optional on the base props, which is how §2
 * models them anyway — "only meaningful for sort".
 */
export const BUILT_IN_OPERATIONS = {
  array: ['search', 'insert', 'delete', 'traverse', 'sort'],
  'linked-list': ['search', 'insert', 'delete', 'traverse'],
  'doubly-linked-list': ['search', 'insert', 'delete', 'traverse'],
  stack: ['insert', 'delete', 'traverse'],
  queue: ['insert', 'delete', 'traverse'],
  'binary-search-tree': ['insert', 'search', 'traverse'],
  'red-black-tree': ['insert', 'search', 'traverse'],
  'avl-tree': ['insert', 'search', 'traverse'],
  'min-heap': ['insert', 'delete', 'traverse'],
  'max-heap': ['insert', 'delete', 'traverse'],
  trie: ['insert', 'search', 'traverse'],
  graph: ['traverse', 'search', 'shortest-path'],
} as const satisfies Record<Structure, readonly Operation[]>

/**
 * One branch per structure, derived from the table above rather than written
 * out a second time — a hand-maintained copy would drift from the registry the
 * first time either changed, and the drift would be invisible.
 *
 * One branch per structure matters for the error message: `structure` is the
 * discriminant, and two branches sharing a value turn a precise "operation must
 * be one of these" into a wall of union-mismatch noise. `sortAlgorithm` and
 * `traversalOrder` therefore stay optional on the base props, which is how §2
 * models them anyway — "only meaningful for sort".
 */
export type BuiltInExample = {
  [S in Structure]: { structure: S; operation: (typeof BUILT_IN_OPERATIONS)[S][number] }
}[Structure]

/**
 * Any pairing at all, once you bring your own program.
 *
 * The registry constrains what *Noracursion* provides; it has no business
 * constraining what you write. A consumer who wants to demonstrate deleting
 * from a graph is not wrong, they are just past the end of the built-ins — so
 * the type asks them for the one thing that makes it work, which is `code`.
 */
export type CustomExample = {
  structure: Structure
  operation: Operation
  code: string
}

/** The pairs `<Noracursion />` accepts: a built-in, or your own code. */
export type Example = BuiltInExample | CustomExample

/**
 * Every `Structure` now has a model behind it, so this is an alias rather than
 * a subset. It stays as a distinct name because `core/`, `bridge/` and the run
 * hook all talk about "a structure something can be built from", and that is
 * worth being able to say even when the answer is currently "all of them".
 */
export type DrawableStructure = Structure

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
