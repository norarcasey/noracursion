import {
  compare,
  edgeId,
  IdFactory,
  type Cell,
  type VizEdge,
  type VizModel,
  type VizNode,
} from './model'

interface AvlNode {
  readonly id: string
  value: Cell
  left: AvlNode | null
  right: AvlNode | null
  parent: AvlNode | null
}

/**
 * An AVL tree.
 *
 * Heights are measured on demand rather than cached on the nodes. A real
 * implementation caches them, and should; here the cache would be a second
 * source of truth that interpreted code could silently desynchronise the
 * moment a snippet rotated without updating it. Measuring keeps the height a
 * fact about the shape, which is what the balance factor drawn on each node
 * has to be for the picture to be trustworthy. Teaching-sized trees make the
 * extra walk free.
 */
export class AvlTree {
  private readonly ids = new IdFactory('v')
  private root: AvlNode | null = null
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

  /** The height of the subtree rooted at a value; an empty subtree is 0. */
  heightOf(value: Cell | null): number {
    if (value === null) return 0
    return measure(this.find(value))
  }

  /** Left height minus right height. Outside [-1, 1] the node needs rotating. */
  balanceOf(value: Cell): number {
    const node = this.find(value)
    if (node === null) return 0
    return measure(node.left) - measure(node.right)
  }

  height(): number {
    return measure(this.root)
  }

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
    const walk = (node: AvlNode | null): void => {
      if (node === null) return
      walk(node.left)
      values.push(node.value)
      walk(node.right)
    }
    walk(this.root)
    return values
  }

  /** True when every node's balance factor is within one. */
  isBalanced(): boolean {
    const check = (node: AvlNode | null): boolean => {
      if (node === null) return true
      if (Math.abs(measure(node.left) - measure(node.right)) > 1) return false
      return check(node.left) && check(node.right)
    }
    return check(this.root)
  }

  /** Insert with the rebalance built in, for building the initial tree. */
  insert(value: Cell): boolean {
    if (this.root === null) {
      this.root = this.create(value)
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
        this.rebalanceFrom(created.parent)
        return true
      }
      current = next
    }
  }

  private rebalanceFrom(start: AvlNode | null): void {
    let node = start
    while (node !== null) {
      const parent = node.parent
      const balance = measure(node.left) - measure(node.right)

      if (balance > 1 && node.left !== null) {
        // Left-heavy. A right-leaning left child is a zig-zag; straighten it
        // first, then rotate the node itself.
        if (measure(node.left.left) < measure(node.left.right)) this.rotate(node.left, 'left')
        this.rotate(node, 'right')
      } else if (balance < -1 && node.right !== null) {
        if (measure(node.right.right) < measure(node.right.left)) this.rotate(node.right, 'right')
        this.rotate(node, 'left')
      }

      node = parent
    }
  }

  private create(value: Cell): AvlNode {
    return { id: this.ids.create(), value, left: null, right: null, parent: null }
  }

  private find(value: Cell): AvlNode | null {
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

  /** Pointer surgery only: the same nodes, and so the same ids, move. */
  private rotate(node: AvlNode, direction: 'left' | 'right'): void {
    const opposite = direction === 'left' ? 'right' : 'left'
    const pivot = node[opposite]
    if (pivot === null) return

    node[opposite] = pivot[direction]
    const moved = pivot[direction]
    if (moved !== null) moved.parent = node

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

    const visit = (node: AvlNode | null, depth: number): void => {
      if (node === null) return
      const balance = measure(node.left) - measure(node.right)
      nodes.push({
        id: node.id,
        label: String(node.value),
        // The balance factor is the thing an AVL tree is about, so it rides
        // along as a badge rather than needing a snippet to call `mark`.
        meta: { depth, balance, mark: balance === 0 ? undefined : formatBalance(balance) },
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

function measure(node: AvlNode | null | undefined): number {
  if (node === null || node === undefined) return 0
  return 1 + Math.max(measure(node.left), measure(node.right))
}

function valueOf(node: AvlNode | null | undefined): Cell | null {
  return node === null || node === undefined ? null : node.value
}

function formatBalance(balance: number): string {
  return balance > 0 ? `+${balance}` : String(balance)
}
