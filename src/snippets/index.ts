import type { Language, Operation, SortAlgorithm, Structure, TraversalOrder } from '../types'
import {
  ARRAY_DELETE_ITER,
  ARRAY_DELETE_REC,
  ARRAY_INSERT_ITER,
  ARRAY_INSERT_REC,
  ARRAY_SEARCH_ITER,
  ARRAY_SEARCH_REC,
  ARRAY_TRAVERSE_ITER,
  ARRAY_TRAVERSE_REC,
} from './array'
import {
  LIST_DELETE_ITER,
  LIST_DELETE_REC,
  LIST_INSERT_ITER,
  LIST_INSERT_REC,
  LIST_SEARCH_ITER,
  LIST_SEARCH_REC,
  LIST_TRAVERSE_ITER,
  LIST_TRAVERSE_REC,
} from './linkedList'
import {
  SORT_BUBBLE_ITER,
  SORT_BUBBLE_REC,
  SORT_INSERTION_ITER,
  SORT_INSERTION_REC,
  SORT_MERGE_ITER,
  SORT_MERGE_REC,
  SORT_QUICK_ITER,
  SORT_QUICK_REC,
  SORT_SELECTION_ITER,
  SORT_SELECTION_REC,
} from './sorts'
import {
  TREE_INSERT_ITER,
  TREE_INSERT_REC,
  TREE_SEARCH_ITER,
  TREE_SEARCH_REC,
  TREE_TRAVERSE_IN_ITER,
  TREE_TRAVERSE_IN_REC,
  TREE_TRAVERSE_LEVEL_ITER,
  TREE_TRAVERSE_LEVEL_REC,
  TREE_TRAVERSE_POST_ITER,
  TREE_TRAVERSE_POST_REC,
  TREE_TRAVERSE_PRE_ITER,
  TREE_TRAVERSE_PRE_REC,
} from './tree'
import { RB_INSERT_ITER, RB_INSERT_REC, RB_SEARCH_ITER, RB_SEARCH_REC } from './redBlackTree'
import {
  DLIST_DELETE_ITER,
  DLIST_DELETE_REC,
  DLIST_INSERT_ITER,
  DLIST_INSERT_REC,
  DLIST_SEARCH_ITER,
  DLIST_SEARCH_REC,
  DLIST_TRAVERSE_ITER,
  DLIST_TRAVERSE_REC,
  QUEUE_DELETE_ITER,
  QUEUE_DELETE_REC,
  QUEUE_INSERT_ITER,
  QUEUE_INSERT_REC,
  QUEUE_TRAVERSE_ITER,
  QUEUE_TRAVERSE_REC,
  STACK_DELETE_ITER,
  STACK_DELETE_REC,
  STACK_INSERT_ITER,
  STACK_INSERT_REC,
  STACK_TRAVERSE_ITER,
  STACK_TRAVERSE_REC,
} from './sequences'

/** A recursive/iterative pair. Both must draw the same picture (§4). */
export interface SnippetPair {
  readonly rec: string
  readonly iter: string
}

export interface SnippetRequest {
  readonly structure: Structure
  readonly operation: Operation
  readonly language?: Language
  readonly recursion?: boolean
  readonly traversalOrder?: TraversalOrder
  readonly sortAlgorithm?: SortAlgorithm
}

/**
 * The snippet library, keyed as CLAUDE.md §4 describes — with one addition.
 *
 * §4's key is `structure:operation:language:rec|iter`, which cannot tell a
 * merge sort from a quicksort, or an in-order walk from a post-order one, even
 * though those are entirely different programs. The variant is appended when
 * the operation has one, so `array:sort:typescript:rec` becomes
 * `array:sort:typescript:rec:merge`.
 *
 * **This registry is the source of truth for which combinations exist.** §6.5
 * asks for unimplemented combinations to be absent from the type union rather
 * than silently broken; `Structure` and `Operation` are two independent unions
 * in §2, so their cross product cannot express that on its own. Everything that
 * works is listed here, `hasSnippet` answers the question at runtime, and the
 * component says so plainly when a combination has nothing behind it.
 */
const PAIRS: Readonly<Record<string, SnippetPair>> = {
  'array:search': { iter: ARRAY_SEARCH_ITER, rec: ARRAY_SEARCH_REC },
  'array:traverse': { iter: ARRAY_TRAVERSE_ITER, rec: ARRAY_TRAVERSE_REC },
  'array:insert': { iter: ARRAY_INSERT_ITER, rec: ARRAY_INSERT_REC },
  'array:delete': { iter: ARRAY_DELETE_ITER, rec: ARRAY_DELETE_REC },

  'array:sort:bubble': { iter: SORT_BUBBLE_ITER, rec: SORT_BUBBLE_REC },
  'array:sort:selection': { iter: SORT_SELECTION_ITER, rec: SORT_SELECTION_REC },
  'array:sort:insertion': { iter: SORT_INSERTION_ITER, rec: SORT_INSERTION_REC },
  'array:sort:merge': { iter: SORT_MERGE_ITER, rec: SORT_MERGE_REC },
  'array:sort:quick': { iter: SORT_QUICK_ITER, rec: SORT_QUICK_REC },

  'linked-list:search': { iter: LIST_SEARCH_ITER, rec: LIST_SEARCH_REC },
  'linked-list:traverse': { iter: LIST_TRAVERSE_ITER, rec: LIST_TRAVERSE_REC },
  'linked-list:insert': { iter: LIST_INSERT_ITER, rec: LIST_INSERT_REC },
  'linked-list:delete': { iter: LIST_DELETE_ITER, rec: LIST_DELETE_REC },

  'binary-search-tree:insert': { iter: TREE_INSERT_ITER, rec: TREE_INSERT_REC },
  'binary-search-tree:search': { iter: TREE_SEARCH_ITER, rec: TREE_SEARCH_REC },
  'binary-search-tree:traverse:in-order': {
    iter: TREE_TRAVERSE_IN_ITER,
    rec: TREE_TRAVERSE_IN_REC,
  },
  'binary-search-tree:traverse:pre-order': {
    iter: TREE_TRAVERSE_PRE_ITER,
    rec: TREE_TRAVERSE_PRE_REC,
  },
  'binary-search-tree:traverse:post-order': {
    iter: TREE_TRAVERSE_POST_ITER,
    rec: TREE_TRAVERSE_POST_REC,
  },
  'binary-search-tree:traverse:level-order': {
    iter: TREE_TRAVERSE_LEVEL_ITER,
    rec: TREE_TRAVERSE_LEVEL_REC,
  },

  'red-black-tree:insert': { iter: RB_INSERT_ITER, rec: RB_INSERT_REC },
  'red-black-tree:search': { iter: RB_SEARCH_ITER, rec: RB_SEARCH_REC },

  'doubly-linked-list:search': { iter: DLIST_SEARCH_ITER, rec: DLIST_SEARCH_REC },
  'doubly-linked-list:traverse': { iter: DLIST_TRAVERSE_ITER, rec: DLIST_TRAVERSE_REC },
  'doubly-linked-list:insert': { iter: DLIST_INSERT_ITER, rec: DLIST_INSERT_REC },
  'doubly-linked-list:delete': { iter: DLIST_DELETE_ITER, rec: DLIST_DELETE_REC },

  'stack:insert': { iter: STACK_INSERT_ITER, rec: STACK_INSERT_REC },
  'stack:delete': { iter: STACK_DELETE_ITER, rec: STACK_DELETE_REC },
  'stack:traverse': { iter: STACK_TRAVERSE_ITER, rec: STACK_TRAVERSE_REC },

  'queue:insert': { iter: QUEUE_INSERT_ITER, rec: QUEUE_INSERT_REC },
  'queue:delete': { iter: QUEUE_DELETE_ITER, rec: QUEUE_DELETE_REC },
  'queue:traverse': { iter: QUEUE_TRAVERSE_ITER, rec: QUEUE_TRAVERSE_REC },
}

const DEFAULT_TRAVERSAL: TraversalOrder = 'in-order'
const DEFAULT_SORT: SortAlgorithm = 'bubble'

/** The variant suffix an operation needs, if any. */
function variantOf(request: SnippetRequest): string {
  if (request.operation === 'traverse' && request.structure === 'binary-search-tree') {
    return `:${request.traversalOrder ?? DEFAULT_TRAVERSAL}`
  }
  if (request.operation === 'sort') return `:${request.sortAlgorithm ?? DEFAULT_SORT}`
  return ''
}

/** The full key, for debugging and for cache identity. */
export function snippetKey(request: SnippetRequest): string {
  const language = request.language ?? 'typescript'
  const mode = request.recursion === false ? 'iter' : 'rec'
  return `${request.structure}:${request.operation}:${language}${variantOf(request)}:${mode}`
}

/**
 * The source for a variant, or `null` when there is none.
 *
 * Only TypeScript is stocked. §4 makes other languages display-only, and the
 * mechanism for that — the badge, and play being disabled — is already in the
 * code panel; what is missing is the translated text, which is a writing job
 * rather than a build one. Returning `null` keeps the component honest about
 * that instead of showing TypeScript under a Python heading.
 */
export function getSnippet(request: SnippetRequest): string | null {
  if ((request.language ?? 'typescript') !== 'typescript') return null
  const pair = PAIRS[`${request.structure}:${request.operation}${variantOf(request)}`]
  if (pair === undefined) return null
  return request.recursion === false ? pair.iter : pair.rec
}

export function hasSnippet(request: SnippetRequest): boolean {
  return getSnippet(request) !== null
}

/** Every implemented `(structure, operation, variant)`, for the matrix test. */
export function snippetVariants(): Array<{
  structure: Structure
  operation: Operation
  traversalOrder?: TraversalOrder
  sortAlgorithm?: SortAlgorithm
}> {
  return Object.keys(PAIRS).map((key) => {
    const parts = key.split(':')
    // `binary-search-tree` contains no colon; the structure is always the first
    // segment and the operation the second.
    const structure = asStructure(parts[0])
    const operation = asOperation(parts[1])
    const variant = parts[2]
    if (operation === 'sort') return { structure, operation, sortAlgorithm: asSort(variant) }
    if (variant !== undefined) {
      return { structure, operation, traversalOrder: asTraversal(variant) }
    }
    return { structure, operation }
  })
}

// The registry keys are written by hand above, so these narrow rather than
// assert: a typo in a key becomes a loud failure instead of a bad cast.
const STRUCTURES: readonly string[] = [
  'array',
  'linked-list',
  'doubly-linked-list',
  'stack',
  'queue',
  'binary-search-tree',
  'red-black-tree',
]
const OPERATIONS: readonly string[] = ['insert', 'delete', 'search', 'traverse', 'sort']
const TRAVERSALS: readonly string[] = ['in-order', 'pre-order', 'post-order', 'level-order']
const SORTS: readonly string[] = ['bubble', 'insertion', 'selection', 'merge', 'quick', 'heap']

function asStructure(value: string): Structure {
  if (!STRUCTURES.includes(value)) throw new Error(`Unknown structure in snippet key: ${value}`)
  if (value === 'linked-list') return 'linked-list'
  if (value === 'doubly-linked-list') return 'doubly-linked-list'
  if (value === 'stack') return 'stack'
  if (value === 'queue') return 'queue'
  if (value === 'binary-search-tree') return 'binary-search-tree'
  if (value === 'red-black-tree') return 'red-black-tree'
  return 'array'
}

function asOperation(value: string): Operation {
  if (!OPERATIONS.includes(value)) throw new Error(`Unknown operation in snippet key: ${value}`)
  if (value === 'insert') return 'insert'
  if (value === 'delete') return 'delete'
  if (value === 'search') return 'search'
  if (value === 'sort') return 'sort'
  return 'traverse'
}

function asTraversal(value: string): TraversalOrder {
  if (!TRAVERSALS.includes(value)) throw new Error(`Unknown traversal in snippet key: ${value}`)
  if (value === 'pre-order') return 'pre-order'
  if (value === 'post-order') return 'post-order'
  if (value === 'level-order') return 'level-order'
  return 'in-order'
}

function asSort(value: string | undefined): SortAlgorithm {
  if (value === undefined || !SORTS.includes(value)) {
    throw new Error(`Unknown sort algorithm in snippet key: ${String(value)}`)
  }
  if (value === 'insertion') return 'insertion'
  if (value === 'selection') return 'selection'
  if (value === 'merge') return 'merge'
  if (value === 'quick') return 'quick'
  if (value === 'heap') return 'heap'
  return 'bubble'
}
