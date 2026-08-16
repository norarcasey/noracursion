/**
 * Binary search tree snippets.
 *
 * The tree is injected as `tree` and worked on link by link: `tree.root()`,
 * `tree.left(v)`, `tree.right(v)`, `tree.attachLeft(parent, v)`. Nodes are
 * named by value, which works because the tree holds no duplicates.
 *
 * These are deliberately *not* built on a `tree.insert(v)` that does the work
 * for you. The comparison is in the snippet, so changing `<` to `>` builds a
 * visibly wrong tree — that is the whole premise, and it only holds if the
 * decision is in the code the reader can edit.
 */

export const TREE_INSERT_ITER = `// Walk down from the root, going left when the new value is smaller,
// right when it is larger, and link it on wherever the way runs out.
const value = 7

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

  mark(value, 'inserted')
}
`

export const TREE_INSERT_REC = `// The same descent, with the loop replaced by a call to itself. Each call
// asks one question — left or right? — and hands the rest to the next.
const value = 7

function insertBelow(current: number): void {
  visit(current)
  if (value < current) {
    const next = tree.left(current)
    if (next === null) tree.attachLeft(current, value)
    else insertBelow(next)
  } else {
    const next = tree.right(current)
    if (next === null) tree.attachRight(current, value)
    else insertBelow(next)
  }
}

if (tree.root() === null) {
  tree.setRoot(value)
} else {
  insertBelow(tree.root())
  mark(value, 'inserted')
}
`

export const TREE_SEARCH_ITER = `// Every comparison throws away half of what is left. That is what the
// ordering buys you.
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

export const TREE_SEARCH_REC = `// The same descent, expressed as recursion.
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

// --- traversals -------------------------------------------------------------
//
// Every iterative traversal here keeps its own stack or queue, because that is
// precisely what the recursive version was using the call stack for. Turning
// recursion off does not remove the stack; it just makes you hold it yourself.

export const TREE_TRAVERSE_IN_REC = `// In-order: left subtree, then the node, then the right subtree.
// On a search tree this comes out sorted.
function walk(node: number | null): void {
  if (node === null) return
  walk(tree.left(node))
  visit(node)
  log(node)
  walk(tree.right(node))
}

walk(tree.root())
`

export const TREE_TRAVERSE_IN_ITER = `// The same order, holding the stack yourself instead of using the call stack.
const stack = []
let current = tree.root()

while (current !== null || stack.length > 0) {
  while (current !== null) {
    stack.push(current)
    current = tree.left(current)
  }
  const node = stack.pop()
  visit(node)
  log(node)
  current = tree.right(node)
}
`

export const TREE_TRAVERSE_PRE_REC = `// Pre-order: the node first, then its left subtree, then its right.
function walk(node: number | null): void {
  if (node === null) return
  visit(node)
  log(node)
  walk(tree.left(node))
  walk(tree.right(node))
}

walk(tree.root())
`

export const TREE_TRAVERSE_PRE_ITER = `// The same order. The right child is pushed first so the left one comes
// off the stack first — the order the recursive version takes them in.
const stack = []
if (tree.root() !== null) stack.push(tree.root())

while (stack.length > 0) {
  const node = stack.pop()
  visit(node)
  log(node)
  const right = tree.right(node)
  const left = tree.left(node)
  if (right !== null) stack.push(right)
  if (left !== null) stack.push(left)
}
`

export const TREE_TRAVERSE_POST_REC = `// Post-order: both subtrees before the node itself. This is the order you
// need to delete a tree — no node goes before its children.
function walk(node: number | null): void {
  if (node === null) return
  walk(tree.left(node))
  walk(tree.right(node))
  visit(node)
  log(node)
}

walk(tree.root())
`

export const TREE_TRAVERSE_POST_ITER = `// The same order, holding the stack yourself. Each entry remembers whether
// its children have been dealt with yet.
const stack = []
if (tree.root() !== null) stack.push([tree.root(), 0])

while (stack.length > 0) {
  const entry = stack[stack.length - 1]
  const node = entry[0]

  if (entry[1] === 0) {
    entry[1] = 1
    const left = tree.left(node)
    if (left !== null) stack.push([left, 0])
  } else if (entry[1] === 1) {
    entry[1] = 2
    const right = tree.right(node)
    if (right !== null) stack.push([right, 0])
  } else {
    stack.pop()
    visit(node)
    log(node)
  }
}
`

export const TREE_TRAVERSE_LEVEL_ITER = `// Level-order: a queue, not a stack. Every node on one level comes out
// before any node on the next.
const queue = []
if (tree.root() !== null) queue.push(tree.root())

while (queue.length > 0) {
  const node = queue.shift()
  visit(node)
  log(node)
  const left = tree.left(node)
  const right = tree.right(node)
  if (left !== null) queue.push(left)
  if (right !== null) queue.push(right)
}
`

export const TREE_TRAVERSE_LEVEL_REC = `// The same queue, drained by recursion instead of a loop. The queue does
// not go away — level-order needs one either way.
function drain(queue): void {
  if (queue.length === 0) return
  const node = queue.shift()
  visit(node)
  log(node)
  const left = tree.left(node)
  const right = tree.right(node)
  if (left !== null) queue.push(left)
  if (right !== null) queue.push(right)
  drain(queue)
}

const queue = []
if (tree.root() !== null) queue.push(tree.root())
drain(queue)
`
