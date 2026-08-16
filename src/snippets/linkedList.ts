/**
 * Linked list snippets.
 *
 * The list is injected as `list` and addressed by position: `list.length`,
 * `list.get(i)`, `list.insertAt(i, v)`, `list.removeAt(i)`. Positions rather
 * than values, because a list may hold the same value twice and a snippet has
 * to be able to say *which* node it means.
 */

export const LIST_SEARCH_ITER = `// Walk from the head until the value turns up. A list has no shortcuts —
// there is no way in except one node at a time.
const target = 6

let i = 0
while (i < list.length) {
  visit(i)
  if (list.get(i) === target) {
    mark(i, 'found')
    log('found ' + target + ' at position ' + i)
    break
  }
  i = i + 1
}
`

export const LIST_SEARCH_REC = `// The same walk, with the loop replaced by a call to itself.
const target = 6

function search(i: number): number {
  if (i >= list.length) return -1
  visit(i)
  if (list.get(i) === target) return i
  return search(i + 1)
}

const at = search(0)
if (at >= 0) {
  mark(at, 'found')
  log('found ' + target + ' at position ' + at)
}
`

export const LIST_TRAVERSE_ITER = `// Visit every node from head to tail.
for (let i = 0; i < list.length; i++) {
  visit(i)
  log(list.get(i))
}
`

export const LIST_TRAVERSE_REC = `// The same walk, expressed as recursion.
function walk(i: number): void {
  if (i >= list.length) return
  visit(i)
  log(list.get(i))
  walk(i + 1)
}

walk(0)
`

export const LIST_INSERT_ITER = `// Insert keeping the order: walk past everything smaller, then link it in.
const value = 7

let at = 0
while (at < list.length && list.get(at) < value) {
  visit(at)
  at = at + 1
}

list.insertAt(at, value)
mark(at, 'inserted')
log('inserted ' + value + ' at position ' + at)
`

export const LIST_INSERT_REC = `// The same insertion, finding the position by recursion.
const value = 7

function findSpot(i: number): number {
  if (i >= list.length) return i
  if (list.get(i) >= value) return i
  visit(i)
  return findSpot(i + 1)
}

const at = findSpot(0)
list.insertAt(at, value)
mark(at, 'inserted')
log('inserted ' + value + ' at position ' + at)
`

export const LIST_DELETE_ITER = `// Find the node, then unlink it. Its neighbours join up.
const target = 10

let i = 0
while (i < list.length) {
  visit(i)
  if (list.get(i) === target) {
    list.removeAt(i)
    log('removed ' + target + ' from position ' + i)
    break
  }
  i = i + 1
}
`

export const LIST_DELETE_REC = `// The same removal, searching by recursion.
const target = 10

function findAndRemove(i: number): void {
  if (i >= list.length) return
  visit(i)
  if (list.get(i) === target) {
    list.removeAt(i)
    log('removed ' + target + ' from position ' + i)
    return
  }
  findAndRemove(i + 1)
}

findAndRemove(0)
`
