import {
  compare,
  edgeId,
  IdFactory,
  type Cell,
  type VizEdge,
  type VizModel,
  type VizNode,
} from './model'

interface TreeNode {
  readonly id: string
  value: Cell
  left: TreeNode | null
  right: TreeNode | null
}

interface Located {
  readonly node: TreeNode
  /** null when `node` is the root. */
  readonly parent: TreeNode | null
}

/**
 * An unbalanced binary search tree.
 *
 * Deleting a node with two children **splices the successor into its place**
 * rather than the more common trick of copying the successor's value down and
 * deleting the successor. Both leave a correct tree, but only one leaves a
 * correct animation: copying the value would show a number teleport up the
 * tree while an unrelated node vanishes, and would break the invariant that a
 * node's id and its value stay bound together for the node's whole life. With
 * a splice, the successor keeps its id and is seen to move.
 */
export class BinarySearchTree {
  private readonly ids = new IdFactory('t')
  private root: TreeNode | null = null
  private count = 0

  constructor(initial: readonly Cell[] = []) {
    for (const value of initial) this.insert(value)
  }

  get size(): number {
    return this.count
  }

  /** Returns false if the value is already present; this tree rejects duplicates. */
  insert(value: Cell): boolean {
    const created: TreeNode = { id: this.ids.create(), value, left: null, right: null }
    if (this.root === null) {
      this.root = created
      this.count = 1
      return true
    }
    let current = this.root
    for (;;) {
      const order = compare(value, current.value)
      if (order === 0) return false
      if (order < 0) {
        if (current.left === null) {
          current.left = created
          break
        }
        current = current.left
      } else {
        if (current.right === null) {
          current.right = created
          break
        }
        current = current.right
      }
    }
    this.count += 1
    return true
  }

  has(value: Cell): boolean {
    return this.locate(value) !== null
  }

  /** The stable id of the node holding `value`, for tests and for the bridge. */
  idOf(value: Cell): string | undefined {
    return this.locate(value)?.node.id
  }

  remove(value: Cell): boolean {
    const found = this.locate(value)
    if (found === null) return false
    const { node, parent } = found

    if (node.left !== null && node.right !== null) {
      // Two children: the in-order successor takes this node's place.
      let successorParent = node
      let successor = node.right
      while (successor.left !== null) {
        successorParent = successor
        successor = successor.left
      }
      if (successorParent !== node) {
        successorParent.left = successor.right
        successor.right = node.right
      }
      successor.left = node.left
      this.replaceChild(parent, node, successor)
    } else {
      this.replaceChild(parent, node, node.left ?? node.right)
    }

    this.count -= 1
    return true
  }

  /**
   * Rotations live here, not in `redBlackTree.ts`, even though nothing in this
   * milestone rebalances.
   *
   * §6.3 requires a test that ids survive a rotation, and a plain BST has no
   * other way to produce one. Finding out in M7 that a rotation churns ids
   * would mean discovering it underneath a red-black tree, where it is far
   * harder to see. The operation is a pure BST primitive either way — AVL and
   * red-black both build on exactly this.
   */
  rotateLeft(value: Cell): boolean {
    const found = this.locate(value)
    if (found === null) return false
    const { node, parent } = found
    const pivot = node.right
    if (pivot === null) return false
    node.right = pivot.left
    pivot.left = node
    this.replaceChild(parent, node, pivot)
    return true
  }

  rotateRight(value: Cell): boolean {
    const found = this.locate(value)
    if (found === null) return false
    const { node, parent } = found
    const pivot = node.left
    if (pivot === null) return false
    node.left = pivot.right
    pivot.right = node
    this.replaceChild(parent, node, pivot)
    return true
  }

  // --- link-level primitives -------------------------------------------------
  //
  // `insert` decides where a value goes; these let interpreted code decide
  // instead. That difference is the whole premise: a snippet that calls
  // `tree.insert(6)` is a black box, and flipping its `<` to a `>` would change
  // nothing on screen. With these, the snippet does the comparing and the
  // linking, so wrong code builds a visibly wrong tree.
  //
  // Nodes are addressed by value, which works because this tree rejects
  // duplicates, and keeps the whole runtime surface in `Cell`s rather than
  // handing interpreted code a node object to lose track of.

  /** The value at the root, or null when the tree is empty. */
  rootValue(): Cell | null {
    return this.root === null ? null : this.root.value
  }

  leftOf(value: Cell): Cell | null {
    const node = this.locate(value)?.node.left
    return node === null || node === undefined ? null : node.value
  }

  rightOf(value: Cell): Cell | null {
    const node = this.locate(value)?.node.right
    return node === null || node === undefined ? null : node.value
  }

  /** Plants the first node. Throws if the tree already has a root. */
  setRoot(value: Cell): void {
    if (this.root !== null) {
      throw new Error(`The tree already has a root (${String(this.root.value)}).`)
    }
    this.root = { id: this.ids.create(), value, left: null, right: null }
    this.count = 1
  }

  attachLeft(parent: Cell, value: Cell): void {
    this.attach(parent, value, 'left')
  }

  attachRight(parent: Cell, value: Cell): void {
    this.attach(parent, value, 'right')
  }

  private attach(parent: Cell, value: Cell, side: 'left' | 'right'): void {
    const found = this.locate(parent)
    if (found === null) throw new Error(`There is no node holding ${String(parent)}.`)
    if (found.node[side] !== null) {
      throw new Error(`${String(parent)} already has a ${side} child.`)
    }
    if (this.locate(value) !== null) {
      throw new Error(`${String(value)} is already in the tree.`)
    }
    found.node[side] = { id: this.ids.create(), value, left: null, right: null }
    this.count += 1
  }

  inOrder(): Cell[] {
    const values: Cell[] = []
    const visit = (node: TreeNode | null): void => {
      if (node === null) return
      visit(node.left)
      values.push(node.value)
      visit(node.right)
    }
    visit(this.root)
    return values
  }

  preOrder(): Cell[] {
    const values: Cell[] = []
    const visit = (node: TreeNode | null): void => {
      if (node === null) return
      values.push(node.value)
      visit(node.left)
      visit(node.right)
    }
    visit(this.root)
    return values
  }

  postOrder(): Cell[] {
    const values: Cell[] = []
    const visit = (node: TreeNode | null): void => {
      if (node === null) return
      visit(node.left)
      visit(node.right)
      values.push(node.value)
    }
    visit(this.root)
    return values
  }

  levelOrder(): Cell[] {
    const values: Cell[] = []
    const queue: TreeNode[] = this.root === null ? [] : [this.root]
    while (queue.length > 0) {
      const node = queue.shift()
      if (node === undefined) break
      values.push(node.value)
      if (node.left !== null) queue.push(node.left)
      if (node.right !== null) queue.push(node.right)
    }
    return values
  }

  height(): number {
    const measure = (node: TreeNode | null): number =>
      node === null ? 0 : 1 + Math.max(measure(node.left), measure(node.right))
    return measure(this.root)
  }

  private locate(value: Cell): Located | null {
    let parent: TreeNode | null = null
    let current = this.root
    while (current !== null) {
      const order = compare(value, current.value)
      if (order === 0) return { node: current, parent }
      parent = current
      current = order < 0 ? current.left : current.right
    }
    return null
  }

  private replaceChild(
    parent: TreeNode | null,
    oldChild: TreeNode,
    newChild: TreeNode | null,
  ): void {
    if (parent === null) {
      this.root = newChild
      return
    }
    if (parent.left === oldChild) parent.left = newChild
    else parent.right = newChild
  }

  toVizModel(): VizModel {
    const nodes: VizNode[] = []
    const edges: VizEdge[] = []

    const visit = (node: TreeNode | null, depth: number): void => {
      if (node === null) return
      nodes.push({ id: node.id, label: String(node.value), meta: { depth } })
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
