/**
 * Red-black tree snippets.
 *
 * The fixup is in the snippet, not behind an `insert(v)` that quietly does it
 * for you. Watching a recolour and a rotation happen is the entire reason this
 * structure is worth drawing, and you cannot watch what the library did while
 * you were not looking.
 *
 * `tree.color(null)` answers `'black'`, because the leaves a red-black tree
 * reasons about are the ones it never stores.
 */

const DESCEND_AND_ATTACH = `// 1. Ordinary search-tree descent. The new node arrives red, which is what
//    keeps the black-height the same and leaves only one rule to repair.
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

export const RB_INSERT_ITER = `${DESCEND_AND_ATTACH}
// 2. Repair. The only rule a red node can break is "no red node has a red
//    parent", and there are exactly two ways out of it: recolour, or rotate.
let node = value

while (tree.parent(node) !== null && tree.color(tree.parent(node)) === 'red') {
  const parent = tree.parent(node)
  const grandparent = tree.parent(parent)
  if (grandparent === null) break

  const parentIsLeft = tree.left(grandparent) === parent
  const uncle = parentIsLeft ? tree.right(grandparent) : tree.left(grandparent)

  if (tree.color(uncle) === 'red') {
    // Red uncle: push the blackness down a level and carry on from the
    // grandparent. No shape changes — only colours.
    setColor(parent, 'black')
    setColor(uncle, 'black')
    setColor(grandparent, 'red')
    node = grandparent
  } else {
    // Black uncle: the tree is actually lopsided, so rotate. Straighten a
    // zig-zag into a line first, then rotate the grandparent over it.
    let pivot = node
    if (parentIsLeft && node === tree.right(parent)) {
      pivot = parent
      tree.rotateLeft(parent)
    } else if (!parentIsLeft && node === tree.left(parent)) {
      pivot = parent
      tree.rotateRight(parent)
    }

    const newParent = tree.parent(pivot)
    const newGrandparent = tree.parent(newParent)
    setColor(newParent, 'black')
    if (newGrandparent !== null) {
      setColor(newGrandparent, 'red')
      if (parentIsLeft) tree.rotateRight(newGrandparent)
      else tree.rotateLeft(newGrandparent)
    }
    node = pivot
  }
}

// 3. The root is always black. Recolouring may have turned it red on the way.
setColor(tree.root(), 'black')
mark(value, 'inserted')
`

export const RB_INSERT_REC = `${DESCEND_AND_ATTACH}
// 2. The same repair, as a function that calls itself instead of looping.
//    Each call fixes one violation and hands the next one up the tree.
function repair(node: number): void {
  const parent = tree.parent(node)
  if (parent === null || tree.color(parent) === 'black') return

  const grandparent = tree.parent(parent)
  if (grandparent === null) return

  const parentIsLeft = tree.left(grandparent) === parent
  const uncle = parentIsLeft ? tree.right(grandparent) : tree.left(grandparent)

  if (tree.color(uncle) === 'red') {
    setColor(parent, 'black')
    setColor(uncle, 'black')
    setColor(grandparent, 'red')
    repair(grandparent)
    return
  }

  let pivot = node
  if (parentIsLeft && node === tree.right(parent)) {
    pivot = parent
    tree.rotateLeft(parent)
  } else if (!parentIsLeft && node === tree.left(parent)) {
    pivot = parent
    tree.rotateRight(parent)
  }

  const newParent = tree.parent(pivot)
  const newGrandparent = tree.parent(newParent)
  setColor(newParent, 'black')
  if (newGrandparent !== null) {
    setColor(newGrandparent, 'red')
    if (parentIsLeft) tree.rotateRight(newGrandparent)
    else tree.rotateLeft(newGrandparent)
  }
  repair(pivot)
}

repair(value)

// 3. The root is always black. Recolouring may have turned it red on the way.
setColor(tree.root(), 'black')
mark(value, 'inserted')
`

export const RB_SEARCH_ITER = `// A red-black tree is searched exactly like any other search tree. The
// colours are bookkeeping for insertion; they change nothing here.
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

export const RB_SEARCH_REC = `// The same descent, expressed as recursion.
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
