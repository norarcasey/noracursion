/**
 * Graph snippets.
 *
 * The graph is injected as `graph`, addressed by label:
 * `graph.neighbors('A')`, `graph.weight('A', 'B')`. Positions come from the
 * data (§3.5), so nothing here moves — what changes is which nodes and edges
 * are lit.
 */

export const GRAPH_TRAVERSE_ITER = `// Breadth-first: a queue, so everything one step away is seen before
// anything two steps away.
const start = graph.nodes()[0]
const seen = [start]
const queue = [start]

while (queue.length > 0) {
  const node = queue.shift()
  visit(node)
  log(node)
  const neighbors = graph.neighbors(node)
  for (let i = 0; i < neighbors.length; i++) {
    if (!seen.includes(neighbors[i])) {
      seen.push(neighbors[i])
      queue.push(neighbors[i])
    }
  }
}
`

export const GRAPH_TRAVERSE_REC = `// The same order, draining the queue by recursion. Breadth-first needs a
// queue either way — recursion cannot supply one, because the call stack is
// a stack.
const seen = []

function drain(queue): void {
  if (queue.length === 0) return
  const node = queue.shift()
  visit(node)
  log(node)
  const neighbors = graph.neighbors(node)
  for (let i = 0; i < neighbors.length; i++) {
    if (!seen.includes(neighbors[i])) {
      seen.push(neighbors[i])
      queue.push(neighbors[i])
    }
  }
  drain(queue)
}

const start = graph.nodes()[0]
seen.push(start)
drain([start])
`

export const GRAPH_SEARCH_ITER = `// Depth-first: a stack, so it commits to one branch and follows it as far
// as it goes before trying anything else.
const target = 'E'
const start = graph.nodes()[0]
const seen = []
const stack = [start]

while (stack.length > 0) {
  const node = stack.pop()
  if (seen.includes(node)) continue
  seen.push(node)
  visit(node)

  if (node === target) {
    mark(node, 'found')
    log('reached ' + target)
    break
  }

  const neighbors = graph.neighbors(node)
  for (let i = neighbors.length - 1; i >= 0; i--) {
    if (!seen.includes(neighbors[i])) stack.push(neighbors[i])
  }
}
`

export const GRAPH_SEARCH_REC = `// The same depth-first order, using the call stack instead of one you carry.
const target = 'E'
const seen = []
let done = false

function explore(node: string): void {
  if (done || seen.includes(node)) return
  seen.push(node)
  visit(node)

  if (node === target) {
    mark(node, 'found')
    log('reached ' + target)
    done = true
    return
  }

  const neighbors = graph.neighbors(node)
  for (let i = 0; i < neighbors.length; i++) {
    explore(neighbors[i])
  }
}

explore(graph.nodes()[0])
`

const DIJKSTRA_SETUP = `// Dijkstra: always extend the cheapest route found so far. Because every
// weight is positive, the first time a node is settled its distance is final.
const source = 'A'
const nodes = graph.nodes()
const dist = []
const settled = []

for (let i = 0; i < nodes.length; i++) {
  dist.push(nodes[i] === source ? 0 : Infinity)
}

function indexOfNode(label: string): number {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i] === label) return i
  }
  return -1
}

// The cheapest unsettled node. A real implementation keeps a heap here; a
// linear scan is the same idea, slower, and much easier to watch.
function cheapest(): number {
  let best = -1
  for (let i = 0; i < nodes.length; i++) {
    if (settled.includes(nodes[i])) continue
    if (dist[i] === Infinity) continue
    if (best === -1 || dist[i] < dist[best]) best = i
  }
  return best
}

function relax(from: number): void {
  const node = nodes[from]
  const neighbors = graph.neighbors(node)
  for (let n = 0; n < neighbors.length; n++) {
    const to = indexOfNode(neighbors[n])
    const step = dist[from] + graph.weight(node, neighbors[n])
    if (step < dist[to]) {
      dist[to] = step
      mark(neighbors[n], String(step))
    }
  }
}
`

export const GRAPH_SHORTEST_ITER = `${DIJKSTRA_SETUP}
let next = cheapest()
while (next !== -1) {
  settled.push(nodes[next])
  visit(nodes[next])
  log(nodes[next] + ' = ' + dist[next])
  relax(next)
  next = cheapest()
}
`

export const GRAPH_SHORTEST_REC = `${DIJKSTRA_SETUP}
function settle(): void {
  const next = cheapest()
  if (next === -1) return
  settled.push(nodes[next])
  visit(nodes[next])
  log(nodes[next] + ' = ' + dist[next])
  relax(next)
  settle()
}

settle()
`
