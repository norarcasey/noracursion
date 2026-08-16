/**
 * Array snippets.
 *
 * The live array is injected as `arr` and behaves like one: `arr[i]`,
 * `arr.length`, `arr[i] = v`. `swap(i, j)` moves the elements and their node
 * ids together, which is what makes a sort read as cells changing places.
 */

export const ARRAY_SEARCH_ITER = `// Linear search: look at each cell until the value turns up.
const target = 6

for (let i = 0; i < arr.length; i++) {
  visit(i)
  if (arr[i] === target) {
    mark(i, 'found')
    log('found ' + target + ' at index ' + i)
    break
  }
}
`

export const ARRAY_SEARCH_REC = `// The same search, with the loop replaced by a call to itself.
const target = 6

function search(i: number): number {
  if (i >= arr.length) return -1
  visit(i)
  if (arr[i] === target) return i
  return search(i + 1)
}

const at = search(0)
if (at >= 0) {
  mark(at, 'found')
  log('found ' + target + ' at index ' + at)
}
`

export const ARRAY_TRAVERSE_ITER = `// Visit every cell, left to right.
for (let i = 0; i < arr.length; i++) {
  visit(i)
  log(arr[i])
}
`

export const ARRAY_TRAVERSE_REC = `// The same walk, expressed as recursion.
function walk(i: number): void {
  if (i >= arr.length) return
  visit(i)
  log(arr[i])
  walk(i + 1)
}

walk(0)
`

export const ARRAY_INSERT_ITER = `// Insert into a sorted array: scan past everything smaller, then splice in.
const value = 7

let at = 0
while (at < arr.length && arr[at] < value) {
  visit(at)
  at = at + 1
}

arr.insertAt(at, value)
mark(at, 'inserted')
log('inserted ' + value + ' at index ' + at)
`

export const ARRAY_INSERT_REC = `// The same insertion, finding the position by recursion.
const value = 7

function findSpot(i: number): number {
  if (i >= arr.length) return i
  if (arr[i] >= value) return i
  visit(i)
  return findSpot(i + 1)
}

const at = findSpot(0)
arr.insertAt(at, value)
mark(at, 'inserted')
log('inserted ' + value + ' at index ' + at)
`

export const ARRAY_DELETE_ITER = `// Find the value, then remove that cell. Everything after it shifts left.
const target = 10

for (let i = 0; i < arr.length; i++) {
  visit(i)
  if (arr[i] === target) {
    arr.removeAt(i)
    log('removed ' + target + ' from index ' + i)
    break
  }
}
`

export const ARRAY_DELETE_REC = `// The same removal, searching by recursion.
const target = 10

function findAndRemove(i: number): void {
  if (i >= arr.length) return
  visit(i)
  if (arr[i] === target) {
    arr.removeAt(i)
    log('removed ' + target + ' from index ' + i)
    return
  }
  findAndRemove(i + 1)
}

findAndRemove(0)
`
