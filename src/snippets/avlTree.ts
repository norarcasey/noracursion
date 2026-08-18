/**
 * AVL tree snippets.
 *
 * The balance factor — left height minus right height — is drawn on every node
 * that has one, so the rebalance can be watched rather than inferred. When it
 * leaves the range [-1, 1], the node rotates.
 *
 * `tree.height(null)` answers 0, so the snippet can ask about a missing child
 * without checking for it first.
 */

const DESCEND_AND_ATTACH = `// 1. Ordinary search-tree descent — an AVL tree is a search tree first.
const value = 4

if (tree.root() === null) {
  tree.setRoot(value)
} else {
  let current = tree.root()
  let placed = false
  while (!placed) {
    visit(current)
    if (value < current) {
      const next = tree.left(current)
      if (next === null) {
        tree.attachLeft(current, value)
        placed = true
      } else {
        current = next
      }
    } else {
      const next = tree.right(current)
      if (next === null) {
        tree.attachRight(current, value)
        placed = true
      } else {
        current = next
      }
    }
  }
}
`

const REBALANCE_BODY = `  const balance = tree.height(tree.left(node)) - tree.height(tree.right(node))

  if (balance > 1) {
    // Left-heavy. If the left child leans right it is a zig-zag: straighten it
    // into a line first, then rotate this node over it.
    const child = tree.left(node)
    if (tree.height(tree.left(child)) < tree.height(tree.right(child))) {
      mark(child, 'zig-zag')
      tree.rotateLeft(child)
      mark(child, null)
    }
    mark(node, 'rotate')
    tree.rotateRight(node)
    mark(node, null)
  } else if (balance < -1) {
    const child = tree.right(node)
    if (tree.height(tree.right(child)) < tree.height(tree.left(child))) {
      mark(child, 'zig-zag')
      tree.rotateRight(child)
      mark(child, null)
    }
    mark(node, 'rotate')
    tree.rotateLeft(node)
    mark(node, null)
  }
`

export const AVL_INSERT_ITER = `${DESCEND_AND_ATTACH}
// 2. Walk back up to the root, rotating wherever a node has tipped past one.
//    The parent has to be read before the rotation, because rotating changes it.
let node = tree.parent(value)

while (node !== null) {
  const parent = tree.parent(node)
  visit(node)
${REBALANCE_BODY}
  node = parent
}
mark(value, 'inserted')
`

export const AVL_INSERT_REC = `${DESCEND_AND_ATTACH}
// 2. The same walk back up, as a function that calls itself. Reading the
//    parent before rotating matters here too — recursion does not change that.
function rebalance(node: number | null): void {
  if (node === null) return
  const parent = tree.parent(node)
  visit(node)
${REBALANCE_BODY}
  rebalance(parent)
}

rebalance(tree.parent(value))
mark(value, 'inserted')
`

export const AVL_SEARCH_ITER = `// Searching an AVL tree is searching any search tree. Balancing is what
// keeps the path short; it changes nothing about how you walk it.
const target = 6

let current = tree.root()
while (current !== null) {
  visit(current)
  if (target === current) {
    mark(current, 'found')
    log('found ' + target)
    break
  }
  if (target < current) current = tree.left(current)
  else current = tree.right(current)
}
`

export const AVL_SEARCH_REC = `// The same descent, expressed as recursion.
const target = 6

function find(current: number | null): boolean {
  if (current === null) return false
  visit(current)
  if (target === current) return true
  if (target < current) return find(tree.left(current))
  return find(tree.right(current))
}

if (find(tree.root())) {
  mark(target, 'found')
  log('found ' + target)
}
`
