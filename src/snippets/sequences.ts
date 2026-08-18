/**
 * Stack, queue and doubly-linked-list snippets.
 *
 * Each one is written to show the thing that makes the structure different
 * from an array, rather than the things it shares with one. Reading a stack
 * costs you the stack; reading a queue means going all the way round; a doubly
 * linked list is the one that can walk home again.
 */

export const STACK_INSERT_ITER = `// Push lands on the top, which is the only end a stack has.
const values = [7, 2]

for (let i = 0; i < values.length; i++) {
  stack.push(values[i])
  visit(stack.size() - 1)
  log('pushed ' + values[i])
}
mark(stack.size() - 1, 'top')
`

export const STACK_INSERT_REC = `// The same pushes, expressed as recursion.
const values = [7, 2]

function pushAll(i: number): void {
  if (i >= values.length) return
  stack.push(values[i])
  visit(stack.size() - 1)
  log('pushed ' + values[i])
  pushAll(i + 1)
}

pushAll(0)
mark(stack.size() - 1, 'top')
`

export const STACK_DELETE_ITER = `// Pop takes the most recent thing first. Last in, first out.
for (let i = 0; i < 2; i++) {
  visit(stack.size() - 1)
  log('popped ' + stack.pop())
}
`

export const STACK_DELETE_REC = `// The same pops, expressed as recursion.
function popTimes(n: number): void {
  if (n <= 0) return
  visit(stack.size() - 1)
  log('popped ' + stack.pop())
  popTimes(n - 1)
}

popTimes(2)
`

export const STACK_TRAVERSE_ITER = `// A stack has no way to look inside itself: reading it means emptying it.
// Hold what comes off, then push it all back to leave things as they were.
const held = []

while (!stack.isEmpty()) {
  visit(stack.size() - 1)
  const value = stack.pop()
  log(value)
  held.push(value)
}

for (let i = held.length - 1; i >= 0; i--) {
  stack.push(held[i])
}
`

export const STACK_TRAVERSE_REC = `// The same drain and refill, expressed as recursion. Unwinding the calls is
// what puts everything back — the call stack mirrors the stack itself.
function drain(): void {
  if (stack.isEmpty()) return
  visit(stack.size() - 1)
  const value = stack.pop()
  log(value)
  drain()
  stack.push(value)
}

drain()
`

export const QUEUE_INSERT_ITER = `// New arrivals join at the back.
const values = [7, 2]

for (let i = 0; i < values.length; i++) {
  queue.enqueue(values[i])
  visit(queue.size() - 1)
  log('enqueued ' + values[i])
}
mark(queue.size() - 1, 'back')
`

export const QUEUE_INSERT_REC = `// The same arrivals, expressed as recursion.
const values = [7, 2]

function enqueueAll(i: number): void {
  if (i >= values.length) return
  queue.enqueue(values[i])
  visit(queue.size() - 1)
  log('enqueued ' + values[i])
  enqueueAll(i + 1)
}

enqueueAll(0)
mark(queue.size() - 1, 'back')
`

export const QUEUE_DELETE_ITER = `// Dequeue takes from the front. First in, first out — everything behind it
// shuffles forward.
for (let i = 0; i < 2; i++) {
  visit(0)
  log('dequeued ' + queue.dequeue())
}
`

export const QUEUE_DELETE_REC = `// The same departures, expressed as recursion.
function dequeueTimes(n: number): void {
  if (n <= 0) return
  visit(0)
  log('dequeued ' + queue.dequeue())
  dequeueTimes(n - 1)
}

dequeueTimes(2)
`

export const QUEUE_TRAVERSE_ITER = `// A queue can only be read from the front, so reading all of it means going
// right round: take from the front, put it back on the back.
const rounds = queue.size()

for (let i = 0; i < rounds; i++) {
  visit(0)
  const value = queue.dequeue()
  log(value)
  queue.enqueue(value)
}
`

export const QUEUE_TRAVERSE_REC = `// The same lap, expressed as recursion.
function rotate(n: number): void {
  if (n <= 0) return
  visit(0)
  const value = queue.dequeue()
  log(value)
  queue.enqueue(value)
  rotate(n - 1)
}

rotate(queue.size())
`

export const DLIST_TRAVERSE_ITER = `// Forwards, then home again. The backward links are what a singly linked
// list has to pay for with a second pass from the head.
for (let i = 0; i < list.length; i++) {
  visit(i)
  log(list.get(i))
}

for (let i = list.length - 1; i >= 0; i--) {
  visit(i)
  log(list.get(i))
}
`

export const DLIST_TRAVERSE_REC = `// The same there-and-back, expressed as recursion. Unwinding the calls walks
// the list backwards without ever touching a prev pointer — which is the trick
// a singly linked list uses to fake it.
function walk(i: number): void {
  if (i >= list.length) return
  visit(i)
  log(list.get(i))
  walk(i + 1)
  visit(i)
  log(list.get(i))
}

walk(0)
`

export const DLIST_SEARCH_ITER = `// Same linear scan as a singly linked list — the back pointers buy you
// nothing here, only on removal.
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

export const DLIST_SEARCH_REC = `// The same scan, expressed as recursion.
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

export const DLIST_INSERT_ITER = `// Two links to mend on the way in, not one: the new node's neighbours each
// have to point back at it.
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

export const DLIST_INSERT_REC = `// The same insertion, finding the position by recursion.
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

export const DLIST_DELETE_ITER = `// Removal is where the back pointers earn their keep: the node already knows
// both of its neighbours, so nothing has to be searched for again.
const target = 10

let i = 0
while (i < list.length) {
  visit(i)
  if (list.get(i) === target) {
    list.removeAt(i)
    log('removed ' + target)
    break
  }
  i = i + 1
}
`

export const DLIST_DELETE_REC = `// The same removal, searching by recursion.
const target = 10

function findAndRemove(i: number): void {
  if (i >= list.length) return
  visit(i)
  if (list.get(i) === target) {
    list.removeAt(i)
    log('removed ' + target)
    return
  }
  findAndRemove(i + 1)
}

findAndRemove(0)
`
