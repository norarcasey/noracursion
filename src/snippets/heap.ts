/**
 * Heap snippets.
 *
 * The heap is injected as `heap` and behaves like the array it is: `heap[i]`,
 * `heap.length`, `swap(i, j)`. `append` and `removeLast` deliberately do *not*
 * restore the heap property — putting it back is the algorithm, and the
 * algorithm belongs in the snippet.
 *
 * Every relationship in a heap is arithmetic on the index: a node's parent is
 * at `(i - 1) / 2`, its children at `2i + 1` and `2i + 2`. The picture is drawn
 * from exactly those formulas, which is why it is a tree rather than a row.
 */

function insertSnippet(kind: 'min' | 'max', recursive: boolean): string {
  const wrong = kind === 'min' ? '<' : '>'
  const noun = kind === 'min' ? 'smallest' : 'largest'
  const header = `// Insert: put the value at the end, then walk it up while it is ${noun === 'smallest' ? 'smaller' : 'larger'}
// than its parent. The ${noun} value ends up at the root, and nothing else is
// promised — a heap is not a sorted array.
const value = 2

heap.append(value)
`
  if (!recursive) {
    return `${header}
let i = heap.length - 1
while (i > 0) {
  const parent = Math.floor((i - 1) / 2)
  compare(i, parent)
  if (heap[parent] ${wrong} heap[i]) break
  swap(i, parent)
  i = parent
}
`
  }
  return `${header}
function siftUp(i: number): void {
  if (i <= 0) return
  const parent = Math.floor((i - 1) / 2)
  compare(i, parent)
  if (heap[parent] ${wrong} heap[i]) return
  swap(i, parent)
  siftUp(parent)
}

siftUp(heap.length - 1)
`
}

function deleteSnippet(kind: 'min' | 'max', recursive: boolean): string {
  const better = kind === 'min' ? '<' : '>'
  const noun = kind === 'min' ? 'smallest' : 'largest'
  const header = `// Remove the root — the ${noun} value. Move the last cell into its place,
// then walk that value back down past whichever child should be above it.
visit(0)
swap(0, heap.length - 1)
log('removed ' + heap.removeLast())
`
  const body = `  const left = i * 2 + 1
  const right = i * 2 + 2
  let best = i

  if (left < heap.length) {
    compare(left, best)
    if (heap[left] ${better} heap[best]) best = left
  }
  if (right < heap.length) {
    compare(right, best)
    if (heap[right] ${better} heap[best]) best = right
  }
`
  if (!recursive) {
    return `${header}
let i = 0
while (i < heap.length) {
${body}
  if (best === i) break
  swap(i, best)
  i = best
}
`
  }
  return `${header}
function siftDown(i: number): void {
  if (i >= heap.length) return
${body}
  if (best === i) return
  swap(i, best)
  siftDown(best)
}

siftDown(0)
`
}

export const MIN_HEAP_INSERT_ITER = insertSnippet('min', false)
export const MIN_HEAP_INSERT_REC = insertSnippet('min', true)
export const MIN_HEAP_DELETE_ITER = deleteSnippet('min', false)
export const MIN_HEAP_DELETE_REC = deleteSnippet('min', true)

export const MAX_HEAP_INSERT_ITER = insertSnippet('max', false)
export const MAX_HEAP_INSERT_REC = insertSnippet('max', true)
export const MAX_HEAP_DELETE_ITER = deleteSnippet('max', false)
export const MAX_HEAP_DELETE_REC = deleteSnippet('max', true)

export const HEAP_TRAVERSE_ITER = `// A heap is stored as an array, so reading it in array order costs nothing —
// and shows that the order is not sorted. Only the root is guaranteed.
for (let i = 0; i < heap.length; i++) {
  visit(i)
  log(heap[i])
}
`

export const HEAP_TRAVERSE_REC = `// The same walk, expressed as recursion.
function walk(i: number): void {
  if (i >= heap.length) return
  visit(i)
  log(heap[i])
  walk(i + 1)
}

walk(0)
`
