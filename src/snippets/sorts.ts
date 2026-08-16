/**
 * Sorting snippets.
 *
 * Each pair does exactly the same comparisons and swaps in exactly the same
 * order — that is the point of the `recursion` prop, and it is asserted rather
 * than assumed.
 *
 * That constraint is what shapes the iterative merge and quick sorts. The
 * textbook iterative merge sort is bottom-up, and the textbook iterative
 * quicksort takes whatever order its stack happens to give — both would merge
 * and partition in a *different* order from the recursive version, and so draw
 * a different picture. §4 asks for the same picture, so these simulate the
 * recursion with an explicit stack instead. They are longer and fiddlier than
 * their recursive twins, which is itself worth seeing: that is the cost
 * recursion is paying for.
 */

export const SORT_BUBBLE_ITER = `// Bubble sort: sweep the array, swapping neighbours that are out of order.
// After each sweep the largest remaining value has bubbled to the end.
for (let end = arr.length - 1; end > 0; end--) {
  for (let i = 0; i < end; i++) {
    compare(i, i + 1)
    if (arr[i] > arr[i + 1]) swap(i, i + 1)
  }
}
`

export const SORT_BUBBLE_REC = `// The same sweeps, with the outer loop replaced by a call to itself.
function sweep(end: number): void {
  if (end <= 0) return
  for (let i = 0; i < end; i++) {
    compare(i, i + 1)
    if (arr[i] > arr[i + 1]) swap(i, i + 1)
  }
  sweep(end - 1)
}

sweep(arr.length - 1)
`

export const SORT_SELECTION_ITER = `// Selection sort: find the smallest of what is left, put it in place.
for (let start = 0; start < arr.length - 1; start++) {
  let min = start
  for (let i = start + 1; i < arr.length; i++) {
    compare(min, i)
    if (arr[i] < arr[min]) min = i
  }
  mark(min, 'min')
  if (min !== start) swap(start, min)
  mark(start, null)
}
`

export const SORT_SELECTION_REC = `// The same selection, with the outer loop replaced by a call to itself.
function place(start: number): void {
  if (start >= arr.length - 1) return
  let min = start
  for (let i = start + 1; i < arr.length; i++) {
    compare(min, i)
    if (arr[i] < arr[min]) min = i
  }
  mark(min, 'min')
  if (min !== start) swap(start, min)
  mark(start, null)
  place(start + 1)
}

place(0)
`

export const SORT_INSERTION_ITER = `// Insertion sort: take the next value and walk it back to where it belongs.
for (let i = 1; i < arr.length; i++) {
  let j = i
  while (j > 0) {
    compare(j - 1, j)
    if (arr[j - 1] <= arr[j]) break
    swap(j - 1, j)
    j = j - 1
  }
}
`

export const SORT_INSERTION_REC = `// The same insertions, with the outer loop replaced by a call to itself.
function insertAt(i: number): void {
  if (i >= arr.length) return
  let j = i
  while (j > 0) {
    compare(j - 1, j)
    if (arr[j - 1] <= arr[j]) break
    swap(j - 1, j)
    j = j - 1
  }
  insertAt(i + 1)
}

insertAt(1)
`

const MERGE_HELPER = `// Merge two sorted runs, [lo, mid) and [mid, hi), back into the array.
function merge(lo: number, mid: number, hi: number): void {
  const buffer = []
  let left = lo
  let right = mid

  while (left < mid && right < hi) {
    compare(left, right)
    if (arr[left] <= arr[right]) {
      buffer.push(arr[left])
      left = left + 1
    } else {
      buffer.push(arr[right])
      right = right + 1
    }
  }
  while (left < mid) {
    buffer.push(arr[left])
    left = left + 1
  }
  while (right < hi) {
    buffer.push(arr[right])
    right = right + 1
  }

  for (let i = 0; i < buffer.length; i++) {
    arr[lo + i] = buffer[i]
    visit(lo + i)
  }
}
`

export const SORT_MERGE_REC = `// Merge sort: split in half, sort each half, merge the two back together.
${MERGE_HELPER}
function mergeSort(lo: number, hi: number): void {
  if (hi - lo < 2) return
  const mid = Math.floor((lo + hi) / 2)
  mergeSort(lo, mid)
  mergeSort(mid, hi)
  merge(lo, mid, hi)
}

mergeSort(0, arr.length)
`

export const SORT_MERGE_ITER = `// The same merges, in the same order, driven by an explicit stack.
// Each task remembers how far through it is: 0 = sort the left half next,
// 1 = sort the right half next, 2 = both halves are done, so merge.
${MERGE_HELPER}
const stack = [[0, arr.length, 0]]

while (stack.length > 0) {
  const task = stack[stack.length - 1]
  const lo = task[0]
  const hi = task[1]

  if (hi - lo < 2) {
    stack.pop()
    continue
  }

  const mid = Math.floor((lo + hi) / 2)
  if (task[2] === 0) {
    task[2] = 1
    stack.push([lo, mid, 0])
  } else if (task[2] === 1) {
    task[2] = 2
    stack.push([mid, hi, 0])
  } else {
    stack.pop()
    merge(lo, mid, hi)
  }
}
`

const PARTITION_HELPER = `// Lomuto partition: everything smaller than the pivot moves to the left of it.
function partition(lo: number, hi: number): number {
  const pivot = arr[hi]
  mark(hi, 'pivot')
  let i = lo

  for (let j = lo; j < hi; j++) {
    compare(j, hi)
    if (arr[j] < pivot) {
      if (i !== j) swap(i, j)
      i = i + 1
    }
  }

  if (i !== hi) swap(i, hi)
  mark(i, null)
  return i
}
`

export const SORT_QUICK_REC = `// Quicksort: partition around a pivot, then sort each side.
${PARTITION_HELPER}
function quickSort(lo: number, hi: number): void {
  if (lo >= hi) return
  const p = partition(lo, hi)
  quickSort(lo, p - 1)
  quickSort(p + 1, hi)
}

quickSort(0, arr.length - 1)
`

export const SORT_QUICK_ITER = `// The same partitions, in the same order, driven by an explicit stack.
// The right side is pushed first so the left one comes off the stack first —
// which is exactly the order the recursive version takes them in.
${PARTITION_HELPER}
const stack = [[0, arr.length - 1]]

while (stack.length > 0) {
  const range = stack.pop()
  const lo = range[0]
  const hi = range[1]
  if (lo >= hi) continue

  const p = partition(lo, hi)
  stack.push([p + 1, hi])
  stack.push([lo, p - 1])
}
`
