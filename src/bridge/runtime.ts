import { ArrayStructure } from '../core/arrayStructure'
import { DoublyLinkedList } from '../core/doublyLinkedList'
import { LinkedList } from '../core/linkedList'
import type { Cell, NodeColor, VizModel } from '../core/model'
import { Queue } from '../core/queue'
import { RedBlackTree, type RedBlack } from '../core/redBlackTree'
import { Stack } from '../core/stack'
import { BinarySearchTree } from '../core/tree'
import type { NativeContext, NativeFunction, Value, ValueObject } from '../interpreter/values'
import { stringify, typeName } from '../interpreter/values'
import type { DrawableStructure } from '../types'

/**
 * The runtime injected into interpreted code (CLAUDE.md §3.4).
 *
 * Two kinds of thing go in: the live structure — `arr`, `list` or `tree`,
 * whichever the `structure` prop names — and the instrumentation helpers.
 * Mutating the structure is what makes the picture change; the helpers only
 * annotate. Code that never calls `visit()` still runs and still animates, it
 * is just less annotated.
 */
export interface Runtime {
  /** Injected into the interpreter's global scope. */
  readonly globals: ReadonlyMap<string, Value>
  /** The name the structure is bound to, for docs and error copy. */
  readonly handleName: string
  /** Serializes the structure as it stands right now. */
  toVizModel(): VizModel
  /**
   * Bumped by every mutation. Frames compare it to avoid re-serializing a
   * structure that a step did not touch, which is most steps.
   */
  version(): number
}

function native(name: string, call: NativeFunction['call']): NativeFunction {
  return { type: 'native', name, call }
}

function handle(
  properties: ReadonlyArray<readonly [string, Value]>,
  indexed?: ValueObject['indexed'],
): ValueObject {
  return { type: 'object', classRef: null, properties: new Map(properties), indexed }
}

// The coercions are standalone functions with explicit return types on purpose.
// TypeScript only narrows through a `never`-returning call like `ctx.fail(…)`
// inside a function that declares its own return type, and the native callbacks
// below are contextually typed arrows, which do not.

/** Interpreted values are wider than the values a structure can hold. */
function toCell(value: Value, ctx: NativeContext, where: string): Cell {
  if (typeof value === 'number' || typeof value === 'string') return value
  ctx.fail(
    `${where} needs a number or a string, but got ${typeName(value)}.`,
    'Structures here hold numbers or strings — not objects, arrays or functions.',
  )
}

function toIndex(value: Value, ctx: NativeContext, where: string): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  ctx.fail(
    `${where} needs a whole-number index, but got ${stringify(value)}.`,
    'Indexes are counted from 0.',
  )
}

function toColor(value: Value, ctx: NativeContext): NodeColor {
  if (typeof value === 'string') return value
  ctx.fail(`setColor needs a colour name, but got ${typeName(value)}.`, "Pass 'red' or 'black'.")
}

export function createRuntime(structure: DrawableStructure, data: readonly Cell[]): Runtime {
  switch (structure) {
    case 'array':
      return arrayRuntime(data)
    case 'linked-list':
      return listRuntime(data)
    case 'doubly-linked-list':
      return doublyLinkedRuntime(data)
    case 'stack':
      return stackRuntime(data)
    case 'queue':
      return queueRuntime(data)
    case 'binary-search-tree':
      return treeRuntime(data)
    case 'red-black-tree':
      return redBlackRuntime(data)
  }
}

// ---------------------------------------------------------------------------

function arrayRuntime(data: readonly Cell[]): Runtime {
  const array = new ArrayStructure(data)
  let version = 0

  /** Wraps a native so the frame builder knows the structure changed. */
  const mutating = (name: string, call: NativeFunction['call']): NativeFunction =>
    native(name, (args, ctx) => {
      const result = call(args, ctx)
      version += 1
      return result
    })

  const idAt = (index: number, ctx: NativeContext, where: string): string => {
    const id = array.idAt(index)
    if (id === undefined) {
      ctx.fail(
        `${where} refers to index ${index}, which is outside the array (length ${array.length}).`,
        'Indexes run from 0 to length - 1.',
      )
    }
    return id
  }

  // §3.4 lists `swap(i, j)` as a global; it is also the natural method on the
  // handle, so the same native is bound in both places.
  const swap = mutating('swap', (args, ctx) => {
    const i = toIndex(args[0], ctx, 'swap')
    const j = toIndex(args[1], ctx, 'swap')
    const a = idAt(i, ctx, 'swap')
    const b = idAt(j, ctx, 'swap')
    array.swap(i, j)
    ctx.emit({ type: 'swap', a, b, i, j })
    return undefined
  })

  const arr = handle(
    [
      ['get', native('get', (args, ctx) => array.get(toIndex(args[0], ctx, 'get')))],
      ['indexOf', native('indexOf', (args, ctx) => array.indexOf(toCell(args[0], ctx, 'indexOf')))],
      [
        'set',
        mutating(
          'set',
          (args, ctx) => void array.set(toIndex(args[0], ctx, 'set'), toCell(args[1], ctx, 'set')),
        ),
      ],
      ['push', mutating('push', (args, ctx) => array.push(toCell(args[0], ctx, 'push')))],
      ['pop', mutating('pop', () => array.pop())],
      [
        'insertAt',
        mutating(
          'insertAt',
          (args, ctx) =>
            void array.insertAt(
              toIndex(args[0], ctx, 'insertAt'),
              toCell(args[1], ctx, 'insertAt'),
            ),
        ),
      ],
      [
        'removeAt',
        mutating('removeAt', (args, ctx) => array.removeAt(toIndex(args[0], ctx, 'removeAt'))),
      ],
      ['swap', swap],
    ],
    {
      length: () => array.length,
      get: (index) => array.get(index),
      set: (index, value) => {
        if (typeof value !== 'number' && typeof value !== 'string') {
          throw new TypeError('An array cell holds a number or a string.')
        }
        // Assigning one past the end appends, which is what JS does and what a
        // learner writing `arr[arr.length] = x` expects.
        if (index === array.length) array.push(value)
        else array.set(index, value)
        version += 1
      },
    },
  )

  return {
    handleName: 'arr',
    globals: new Map<string, Value>([
      ['arr', arr],
      ['swap', swap],
      ...instrumentation((target, ctx, where) => idAt(toIndex(target, ctx, where), ctx, where)),
    ]),
    toVizModel: () => array.toVizModel(),
    version: () => version,
  }
}

function listRuntime(data: readonly Cell[]): Runtime {
  const list = new LinkedList(data)
  let version = 0

  const mutating = (name: string, call: NativeFunction['call']): NativeFunction =>
    native(name, (args, ctx) => {
      const result = call(args, ctx)
      version += 1
      return result
    })

  const idAt = (index: number, ctx: NativeContext, where: string): string => {
    const id = list.idAt(index)
    if (id === undefined) {
      ctx.fail(
        `${where} refers to index ${index}, which is outside the list (length ${list.length}).`,
        'Indexes run from 0 to length - 1.',
      )
    }
    return id
  }

  const listHandle = handle(
    [
      ['get', native('get', (args, ctx) => list.get(toIndex(args[0], ctx, 'get')))],
      ['indexOf', native('indexOf', (args, ctx) => list.indexOf(toCell(args[0], ctx, 'indexOf')))],
      ['toArray', native('toArray', () => list.toArray())],
      ['push', mutating('push', (args, ctx) => void list.push(toCell(args[0], ctx, 'push')))],
      [
        'unshift',
        mutating('unshift', (args, ctx) => void list.unshift(toCell(args[0], ctx, 'unshift'))),
      ],
      [
        'insertAt',
        mutating(
          'insertAt',
          (args, ctx) =>
            void list.insertAt(toIndex(args[0], ctx, 'insertAt'), toCell(args[1], ctx, 'insertAt')),
        ),
      ],
      [
        'removeAt',
        mutating('removeAt', (args, ctx) => list.removeAt(toIndex(args[0], ctx, 'removeAt'))),
      ],
      ['remove', mutating('remove', (args, ctx) => list.remove(toCell(args[0], ctx, 'remove')))],
      ['reverse', mutating('reverse', () => void list.reverse())],
    ],
    {
      length: () => list.length,
      get: (index) => list.get(index),
      set: () => {
        throw new TypeError('A linked list changes with insertAt / removeAt, not by index.')
      },
    },
  )

  return {
    handleName: 'list',
    globals: new Map<string, Value>([
      ['list', listHandle],
      ...instrumentation((target, ctx, where) => idAt(toIndex(target, ctx, where), ctx, where)),
    ]),
    toVizModel: () => list.toVizModel(),
    version: () => version,
  }
}

function treeRuntime(data: readonly Cell[]): Runtime {
  const tree = new BinarySearchTree(data)
  let version = 0

  const mutating = (name: string, call: NativeFunction['call']): NativeFunction =>
    native(name, (args, ctx) => {
      const result = call(args, ctx)
      version += 1
      return result
    })

  const idOf = (value: Value, ctx: NativeContext, where: string): string => {
    const id = tree.idOf(toCell(value, ctx, where))
    if (id === undefined) {
      ctx.fail(
        `${where} refers to ${stringify(value)}, which is not in the tree.`,
        'Only values the tree currently holds can be highlighted.',
      )
    }
    return id
  }

  const treeHandle = handle([
    // Link-level primitives, so a snippet can do the comparing and the linking
    // itself rather than hiding the algorithm behind `tree.insert(v)`.
    ['root', native('root', () => tree.rootValue())],
    ['left', native('left', (args, ctx) => tree.leftOf(toCell(args[0], ctx, 'left')))],
    ['right', native('right', (args, ctx) => tree.rightOf(toCell(args[0], ctx, 'right')))],
    [
      'setRoot',
      mutating('setRoot', (args, ctx) => void tree.setRoot(toCell(args[0], ctx, 'setRoot'))),
    ],
    [
      'attachLeft',
      mutating(
        'attachLeft',
        (args, ctx) =>
          void tree.attachLeft(
            toCell(args[0], ctx, 'attachLeft'),
            toCell(args[1], ctx, 'attachLeft'),
          ),
      ),
    ],
    [
      'attachRight',
      mutating(
        'attachRight',
        (args, ctx) =>
          void tree.attachRight(
            toCell(args[0], ctx, 'attachRight'),
            toCell(args[1], ctx, 'attachRight'),
          ),
      ),
    ],
    ['has', native('has', (args, ctx) => tree.has(toCell(args[0], ctx, 'has')))],
    ['size', native('size', () => tree.size)],
    ['height', native('height', () => tree.height())],
    ['inOrder', native('inOrder', () => tree.inOrder())],
    ['preOrder', native('preOrder', () => tree.preOrder())],
    ['postOrder', native('postOrder', () => tree.postOrder())],
    ['levelOrder', native('levelOrder', () => tree.levelOrder())],
    ['insert', mutating('insert', (args, ctx) => tree.insert(toCell(args[0], ctx, 'insert')))],
    ['remove', mutating('remove', (args, ctx) => tree.remove(toCell(args[0], ctx, 'remove')))],
    [
      'rotateLeft',
      mutating('rotateLeft', (args, ctx) => tree.rotateLeft(toCell(args[0], ctx, 'rotateLeft'))),
    ],
    [
      'rotateRight',
      mutating('rotateRight', (args, ctx) => tree.rotateRight(toCell(args[0], ctx, 'rotateRight'))),
    ],
  ])

  return {
    handleName: 'tree',
    globals: new Map<string, Value>([['tree', treeHandle], ...instrumentation(idOf)]),
    toVizModel: () => tree.toVizModel(),
    version: () => version,
  }
}

// ---------------------------------------------------------------------------

/** How a structure turns whatever the code passed into a node id. */
type Resolve = (target: Value, ctx: NativeContext, where: string) => string

/**
 * The annotation helpers, shared by every structure.
 *
 * They differ only in how a node is named: a row or a chain is addressed by
 * index, a tree by value. That is how each is naturally written — `visit(i)`
 * inside a loop over an array, `visit(value)` while walking down a tree — so
 * the difference is worth keeping rather than forcing one spelling on both.
 */
function instrumentation(
  resolve: Resolve,
  /**
   * Applies the colour to the structure itself.
   *
   * For most structures a colour is paint, and the overlay is the right place
   * for it. For a red-black tree the colour is part of the data — §2 says it
   * *is* the mnemonic — so the tree has to actually change, or its invariants
   * and its picture would drift apart while both looked fine.
   */
  applyColor?: (target: Value, color: NodeColor, ctx: NativeContext) => void,
): Array<readonly [string, Value]> {
  return [
    [
      'visit',
      native('visit', (args, ctx) => {
        ctx.emit({ type: 'visit', nodeId: resolve(args[0], ctx, 'visit') })
        return undefined
      }),
    ],
    [
      'compare',
      native('compare', (args, ctx) => {
        ctx.emit({
          type: 'compare',
          a: resolve(args[0], ctx, 'compare'),
          b: resolve(args[1], ctx, 'compare'),
        })
        return undefined
      }),
    ],
    [
      'setColor',
      native('setColor', (args, ctx) => {
        const color = toColor(args[1], ctx)
        const nodeId = resolve(args[0], ctx, 'setColor')
        if (applyColor !== undefined) applyColor(args[0], color, ctx)
        ctx.emit({ type: 'set-color', nodeId, color })
        return undefined
      }),
    ],
    [
      'mark',
      native('mark', (args, ctx) => {
        const label = args[1]
        ctx.emit({
          type: 'mark',
          nodeId: resolve(args[0], ctx, 'mark'),
          label: label === null || label === undefined ? null : stringify(label),
        })
        return undefined
      }),
    ],
  ]
}

// ---------------------------------------------------------------------------
// M7 structures
// ---------------------------------------------------------------------------

/**
 * Standalone with an explicit return type, for the same reason as the
 * coercions above: `ctx.fail` only narrows inside a function that declares one.
 */
function requireId(
  id: string | undefined,
  index: number,
  length: number,
  noun: string,
  where: string,
  ctx: NativeContext,
): string {
  if (id !== undefined) return id
  ctx.fail(
    `${where} refers to index ${index}, which is outside the ${noun} (length ${length}).`,
    'Indexes run from 0 to length - 1.',
  )
}

/** Shared by every structure whose nodes are addressed by position. */
function positional(
  length: () => number,
  idAt: (index: number) => string | undefined,
  noun: string,
): Resolve {
  return (target, ctx, where) => {
    const index = toIndex(target, ctx, where)
    return requireId(idAt(index), index, length(), noun, where, ctx)
  }
}

function versioned(): {
  mutating: (n: string, c: NativeFunction['call']) => NativeFunction
  get: () => number
} {
  let version = 0
  return {
    mutating: (name, call) =>
      native(name, (args, ctx) => {
        const result = call(args, ctx)
        version += 1
        return result
      }),
    get: () => version,
  }
}

function doublyLinkedRuntime(data: readonly Cell[]): Runtime {
  const list = new DoublyLinkedList(data)
  const { mutating, get } = versioned()
  const resolve = positional(
    () => list.length,
    (i) => list.idAt(i),
    'list',
  )

  const handleValue = handle(
    [
      ['get', native('get', (args, ctx) => list.get(toIndex(args[0], ctx, 'get')))],
      ['indexOf', native('indexOf', (args, ctx) => list.indexOf(toCell(args[0], ctx, 'indexOf')))],
      ['toArray', native('toArray', () => list.toArray())],
      ['toArrayReversed', native('toArrayReversed', () => list.toArrayReversed())],
      ['push', mutating('push', (args, ctx) => void list.push(toCell(args[0], ctx, 'push')))],
      [
        'unshift',
        mutating('unshift', (args, ctx) => void list.unshift(toCell(args[0], ctx, 'unshift'))),
      ],
      [
        'insertAt',
        mutating(
          'insertAt',
          (args, ctx) =>
            void list.insertAt(toIndex(args[0], ctx, 'insertAt'), toCell(args[1], ctx, 'insertAt')),
        ),
      ],
      [
        'removeAt',
        mutating('removeAt', (args, ctx) => list.removeAt(toIndex(args[0], ctx, 'removeAt'))),
      ],
      ['remove', mutating('remove', (args, ctx) => list.remove(toCell(args[0], ctx, 'remove')))],
    ],
    {
      length: () => list.length,
      get: (index) => list.get(index),
      set: () => {
        throw new TypeError('A linked list changes with insertAt / removeAt, not by index.')
      },
    },
  )

  return {
    handleName: 'list',
    globals: new Map<string, Value>([['list', handleValue], ...instrumentation(resolve)]),
    toVizModel: () => list.toVizModel(),
    version: get,
  }
}

function stackRuntime(data: readonly Cell[]): Runtime {
  const stack = new Stack(data)
  const { mutating, get } = versioned()
  const resolve = positional(
    () => stack.size,
    (i) => stack.idAt(i),
    'stack',
  )

  const handleValue = handle(
    [
      ['size', native('size', () => stack.size)],
      ['isEmpty', native('isEmpty', () => stack.isEmpty())],
      ['peek', native('peek', () => stack.peek())],
      ['toArray', native('toArray', () => stack.toArray())],
      ['push', mutating('push', (args, ctx) => stack.push(toCell(args[0], ctx, 'push')))],
      ['pop', mutating('pop', () => stack.pop())],
    ],
    {
      length: () => stack.size,
      get: (index) => stack.toArray()[index],
      set: () => {
        throw new TypeError('A stack changes with push and pop, not by index.')
      },
    },
  )

  return {
    handleName: 'stack',
    globals: new Map<string, Value>([['stack', handleValue], ...instrumentation(resolve)]),
    toVizModel: () => stack.toVizModel(),
    version: get,
  }
}

function queueRuntime(data: readonly Cell[]): Runtime {
  const queue = new Queue(data)
  const { mutating, get } = versioned()
  const resolve = positional(
    () => queue.size,
    (i) => queue.idAt(i),
    'queue',
  )

  const handleValue = handle(
    [
      ['size', native('size', () => queue.size)],
      ['isEmpty', native('isEmpty', () => queue.isEmpty())],
      ['peek', native('peek', () => queue.peek())],
      ['toArray', native('toArray', () => queue.toArray())],
      [
        'enqueue',
        mutating('enqueue', (args, ctx) => queue.enqueue(toCell(args[0], ctx, 'enqueue'))),
      ],
      ['dequeue', mutating('dequeue', () => queue.dequeue())],
    ],
    {
      length: () => queue.size,
      get: (index) => queue.toArray()[index],
      set: () => {
        throw new TypeError('A queue changes with enqueue and dequeue, not by index.')
      },
    },
  )

  return {
    handleName: 'queue',
    globals: new Map<string, Value>([['queue', handleValue], ...instrumentation(resolve)]),
    toVizModel: () => queue.toVizModel(),
    version: get,
  }
}

function toRedBlack(value: Value, ctx: NativeContext): RedBlack {
  if (value === 'red' || value === 'black') return value
  ctx.fail(
    `A red-black node is 'red' or 'black', not ${stringify(value)}.`,
    "Pass 'red' or 'black'.",
  )
}

function redBlackRuntime(data: readonly Cell[]): Runtime {
  const tree = new RedBlackTree(data)
  const { mutating, get } = versioned()

  const idOf = (value: Value, ctx: NativeContext, where: string): string => {
    const id = tree.idOf(toCell(value, ctx, where))
    if (id === undefined) {
      ctx.fail(
        `${where} refers to ${stringify(value)}, which is not in the tree.`,
        'Only values the tree currently holds can be highlighted.',
      )
    }
    return id
  }

  const handleValue = handle([
    ['root', native('root', () => tree.rootValue())],
    ['left', native('left', (args, ctx) => tree.leftOf(toCell(args[0], ctx, 'left')))],
    ['right', native('right', (args, ctx) => tree.rightOf(toCell(args[0], ctx, 'right')))],
    ['parent', native('parent', (args, ctx) => tree.parentOf(toCell(args[0], ctx, 'parent')))],
    // A missing child is black, which is what the algorithm assumes about the
    // leaves it never actually stores.
    [
      'color',
      native('color', (args, ctx) =>
        args[0] === null || args[0] === undefined
          ? 'black'
          : (tree.colorOf(toCell(args[0], ctx, 'color')) ?? 'black'),
      ),
    ],
    ['has', native('has', (args, ctx) => tree.has(toCell(args[0], ctx, 'has')))],
    ['size', native('size', () => tree.size)],
    ['height', native('height', () => tree.height())],
    ['inOrder', native('inOrder', () => tree.inOrder())],
    [
      'setRoot',
      mutating('setRoot', (args, ctx) => void tree.setRoot(toCell(args[0], ctx, 'setRoot'))),
    ],
    [
      'attachLeft',
      mutating(
        'attachLeft',
        (args, ctx) =>
          void tree.attachLeft(
            toCell(args[0], ctx, 'attachLeft'),
            toCell(args[1], ctx, 'attachLeft'),
          ),
      ),
    ],
    [
      'attachRight',
      mutating(
        'attachRight',
        (args, ctx) =>
          void tree.attachRight(
            toCell(args[0], ctx, 'attachRight'),
            toCell(args[1], ctx, 'attachRight'),
          ),
      ),
    ],
    [
      'rotateLeft',
      mutating('rotateLeft', (args, ctx) => tree.rotateLeft(toCell(args[0], ctx, 'rotateLeft'))),
    ],
    [
      'rotateRight',
      mutating('rotateRight', (args, ctx) => tree.rotateRight(toCell(args[0], ctx, 'rotateRight'))),
    ],
  ])

  return {
    handleName: 'tree',
    globals: new Map<string, Value>([
      ['tree', handleValue],
      ...instrumentation(idOf, (target, color, ctx) => {
        tree.setColor(toCell(target, ctx, 'setColor'), toRedBlack(color, ctx))
      }),
    ]),
    toVizModel: () => tree.toVizModel(),
    version: get,
  }
}
