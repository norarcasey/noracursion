import {
  compare,
  edgeId,
  IdFactory,
  type Cell,
  type VizEdge,
  type VizModel,
  type VizNode,
} from './model'

export type RedBlack = 'red' | 'black'

interface RBNode {
  readonly id: string
  value: Cell
  color: RedBlack
  left: RBNode | null
  right: RBNode | null
  parent: RBNode | null
}

/**
 * A red-black tree.
 *
 * The colours are literal — CLAUDE.md §2 is explicit that for this structure
 * the colour *is* the mnemonic, so they are serialized as `'red'` and
 * `'black'` and the renderer pairs each with a non-chromatic encoding rather
 * than theming them away.
 *
 * `insert` does the whole job, fixup included, and exists so `initialData` can
 * build a valid tree. Interpreted code does not use it: the snippets descend,
 * attach, recolour and rotate through the primitives below, because a fixup
 * hidden behind `insert(v)` would be a fixup nobody can watch or edit.
 *
 * Rotations move nodes; they never rebuild them. That is the invariant §3.1
 * calls out and §6.3 tests, and it is the reason a rebalance reads as motion.
 */
export class RedBlackTree {
  private readonly ids = new IdFactory('rb')
  private root: RBNode | null = null
  private count = 0

  constructor(initial: readonly Cell[] = []) {
    for (const value of initial) this.insert(value)
  }

  get size(): number {
    return this.count
  }

  has(value: Cell): boolean {
    return this.find(value) !== null
  }

  idOf(value: Cell): string | undefined {
    return this.find(value)?.id
  }

  // --- value-addressed primitives, mirroring BinarySearchTree ---------------

  rootValue(): Cell | null {
    return this.root === null ? null : this.root.value
  }

  leftOf(value: Cell): Cell | null {
    return valueOf(this.find(value)?.left)
  }

  rightOf(value: Cell): Cell | null {
    return valueOf(this.find(value)?.right)
  }

  parentOf(value: Cell): Cell | null {
    return valueOf(this.find(value)?.parent)
  }

  /** Null when the value is not in the tree; a missing child counts as black. */
  colorOf(value: Cell): RedBlack | null {
    const node = this.find(value)
    return node === null ? null : node.color
  }

  setColor(value: Cell, color: RedBlack): void {
    const node = this.find(value)
    if (node === null) throw new Error(`There is no node holding ${String(value)}.`)
    node.color = color
  }

  /** Plants the first node. New nodes arrive red, as the algorithm expects. */
  setRoot(value: Cell): void {
    if (this.root !== null) {
      throw new Error(`The tree already has a root (${String(this.root.value)}).`)
    }
    this.root = this.create(value)
    this.count = 1
  }

  attachLeft(parent: Cell, value: Cell): void {
    this.attach(parent, value, 'left')
  }

  attachRight(parent: Cell, value: Cell): void {
    this.attach(parent, value, 'right')
  }

  rotateLeft(value: Cell): boolean {
    const node = this.find(value)
    if (node === null || node.right === null) return false
    this.rotate(node, 'left')
    return true
  }

  rotateRight(value: Cell): boolean {
    const node = this.find(value)
    if (node === null || node.left === null) return false
    this.rotate(node, 'right')
    return true
  }

  inOrder(): Cell[] {
    const values: Cell[] = []
    const walk = (node: RBNode | null): void => {
      if (node === null) return
      walk(node.left)
      values.push(node.value)
      walk(node.right)
    }
    walk(this.root)
    return values
  }

  height(): number {
    const measure = (node: RBNode | null): number =>
      node === null ? 0 : 1 + Math.max(measure(node.left), measure(node.right))
    return measure(this.root)
  }

  /**
   * The number of black nodes on any root-to-leaf path, or null when the tree
   * violates the property. Tests assert on this; nothing else uses it.
   */
  blackHeight(): number | null {
    const measure = (node: RBNode | null): number | null => {
      if (node === null) return 1
      const left = measure(node.left)
      const right = measure(node.right)
      if (left === null || right === null || left !== right) return null
      return node.color === 'black' ? left + 1 : left
    }
    return measure(this.root)
  }

  // --- the whole operation, for building initial data ------------------------

  insert(value: Cell): boolean {
    if (this.root === null) {
      this.root = this.create(value)
      this.root.color = 'black'
      this.count = 1
      return true
    }

    let current = this.root
    for (;;) {
      const order = compare(value, current.value)
      if (order === 0) return false
      const side = order < 0 ? 'left' : 'right'
      const next = current[side]
      if (next === null) {
        const created = this.create(value)
        created.parent = current
        current[side] = created
        this.count += 1
        this.fixup(created)
        return true
      }
      current = next
    }
  }

  private fixup(start: RBNode): void {
    let node = start
    for (;;) {
      const parent = node.parent
      if (parent === null || parent.color === 'black') break
      const grandparent = parent.parent
      if (grandparent === null) break

      const parentIsLeft = grandparent.left === parent
      const uncle = parentIsLeft ? grandparent.right : grandparent.left

      if (uncle !== null && uncle.color === 'red') {
        parent.color = 'black'
        uncle.color = 'black'
        grandparent.color = 'red'
        node = grandparent
        continue
      }

      let pivot = node
      if (parentIsLeft && node === parent.right) {
        pivot = parent
        this.rotate(parent, 'left')
      } else if (!parentIsLeft && node === parent.left) {
        pivot = parent
        this.rotate(parent, 'right')
      }

      const newParent = pivot.parent
      if (newParent === null) break
      const newGrandparent = newParent.parent
      newParent.color = 'black'
      if (newGrandparent !== null) {
        newGrandparent.color = 'red'
        this.rotate(newGrandparent, parentIsLeft ? 'right' : 'left')
      }
      node = pivot
    }
    if (this.root !== null) this.root.color = 'black'
  }

  // --- internals -------------------------------------------------------------

  private create(value: Cell): RBNode {
    return { id: this.ids.create(), value, color: 'red', left: null, right: null, parent: null }
  }

  private find(value: Cell): RBNode | null {
    let current = this.root
    while (current !== null) {
      const order = compare(value, current.value)
      if (order === 0) return current
      current = order < 0 ? current.left : current.right
    }
    return null
  }

  private attach(parent: Cell, value: Cell, side: 'left' | 'right'): void {
    const node = this.find(parent)
    if (node === null) throw new Error(`There is no node holding ${String(parent)}.`)
    if (node[side] !== null) throw new Error(`${String(parent)} already has a ${side} child.`)
    if (this.find(value) !== null) throw new Error(`${String(value)} is already in the tree.`)
    const created = this.create(value)
    created.parent = node
    node[side] = created
    this.count += 1
  }

  /**
   * The rotation itself. Pointer surgery only — the same node objects, and so
   * the same ids, come out the other side in different places.
   */
  private rotate(node: RBNode, direction: 'left' | 'right'): void {
    const opposite = direction === 'left' ? 'right' : 'left'
    const pivot = node[opposite]
    if (pivot === null) return

    node[opposite] = pivot[direction]
    if (pivot[direction] !== null) {
      const moved = pivot[direction]
      if (moved !== null) moved.parent = node
    }

    pivot.parent = node.parent
    if (node.parent === null) this.root = pivot
    else if (node.parent.left === node) node.parent.left = pivot
    else node.parent.right = pivot

    pivot[direction] = node
    node.parent = pivot
  }

  toVizModel(): VizModel {
    const nodes: VizNode[] = []
    const edges: VizEdge[] = []

    const visit = (node: RBNode | null, depth: number): void => {
      if (node === null) return
      nodes.push({
        id: node.id,
        label: String(node.value),
        color: node.color,
        meta: { depth },
      })
      if (node.left !== null) {
        edges.push({
          id: edgeId(node.id, 'left'),
          from: node.id,
          to: node.left.id,
          kind: 'child-left',
        })
      }
      if (node.right !== null) {
        edges.push({
          id: edgeId(node.id, 'right'),
          from: node.id,
          to: node.right.id,
          kind: 'child-right',
        })
      }
      visit(node.left, depth + 1)
      visit(node.right, depth + 1)
    }

    visit(this.root, 0)
    return { nodes, edges, layoutHint: 'tree' }
  }
}

function valueOf(node: RBNode | null | undefined): Cell | null {
  return node === null || node === undefined ? null : node.value
}
