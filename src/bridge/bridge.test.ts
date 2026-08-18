import { describe, expect, it } from 'vitest'
import type { Cell, VizModel } from '../core/model'
import type { DrawableStructure } from '../types'
import { buildRun, type Run } from './run'

/**
 * The bridge (CLAUDE.md §3.4): code runs, events flow, the structure animates.
 */

const src = (text: string): string => text.replace(/^\n/, '')

function run(structure: DrawableStructure, data: readonly Cell[], code: string): Run {
  return buildRun({ structure, data, code: src(code) })
}

function labels(model: VizModel): string[] {
  return model.nodes.map((node) => node.label)
}

function ids(model: VizModel): string[] {
  return model.nodes.map((node) => node.id)
}

function finalFrame(result: Run): VizModel {
  return result.frames[result.frames.length - 1].model
}

describe('the live structure', () => {
  it('sorts an array in place, carrying node ids with the values', () => {
    const result = run(
      'array',
      [5, 3, 8, 1],
      `
for (let i = 0; i < arr.length; i++) {
  for (let j = 0; j < arr.length - i - 1; j++) {
    compare(j, j + 1)
    if (arr[j] > arr[j + 1]) swap(j, j + 1)
  }
}
`,
    )
    expect(result.error).toBeNull()
    expect(labels(finalFrame(result))).toEqual(['1', '3', '5', '8'])
    // The ids travelled with the values, so the renderer draws cells moving
    // rather than four boxes changing their labels.
    expect(ids(finalFrame(result))).toEqual(['a4', 'a2', 'a1', 'a3'])
  })

  it('reads and writes an array by index, like real code', () => {
    const result = run(
      'array',
      [1, 2, 3],
      `
arr[0] = arr[2]
arr[2] = 9
log(arr.length + ':' + arr[0])
`,
    )
    expect(result.error).toBeNull()
    expect(result.summary.logs).toEqual(['3:3'])
    expect(labels(finalFrame(result))).toEqual(['3', '2', '9'])
  })

  it('keeps a cell id when only its value is assigned', () => {
    const result = run('array', [1, 2], `arr[0] = 99`)
    expect(ids(finalFrame(result))).toEqual(['a1', 'a2'])
    expect(labels(finalFrame(result))).toEqual(['99', '2'])
  })

  it('iterates the array handle with for...of', () => {
    const result = run('array', [4, 5, 6], `for (const v of arr) log(v)`)
    expect(result.error).toBeNull()
    expect(result.summary.logs).toEqual(['4', '5', '6'])
  })

  it('grows a tree and reports on it', () => {
    const result = run(
      'binary-search-tree',
      [8, 3, 10],
      `
tree.insert(6)
tree.insert(1)
tree.remove(10)
log(tree.inOrder().join(','))
log('size ' + tree.size())
`,
    )
    expect(result.error).toBeNull()
    expect(result.summary.logs).toEqual(['1,3,6,8', 'size 4'])
    expect(labels(finalFrame(result)).sort()).toEqual(['1', '3', '6', '8'])
  })

  it('edits a linked list', () => {
    const result = run(
      'linked-list',
      ['a', 'c'],
      `
list.insertAt(1, 'b')
list.push('d')
list.removeAt(0)
log(list.toArray().join('-'))
`,
    )
    expect(result.error).toBeNull()
    expect(result.summary.logs).toEqual(['b-c-d'])
    expect(labels(finalFrame(result))).toEqual(['b', 'c', 'd'])
  })

  it('animates code that never calls an instrumentation helper', () => {
    // §3.4: the helpers are pedagogical, not required. A program that only
    // mutates still has to produce a changing picture.
    const result = run('array', [3, 1], `swap(0, 1)`)
    const changed = result.frames.filter((frame) => labels(frame.model)[0] === '1')
    expect(changed.length).toBeGreaterThan(0)
    expect(labels(finalFrame(result))).toEqual(['1', '3'])
  })
})

describe('events and paint', () => {
  it('paints the compared pair, then moves the paint to the next pair', () => {
    const result = run('array', [1, 2, 3], `compare(0, 1)\ncompare(1, 2)`)
    const states = result.frames.map((frame) =>
      frame.model.nodes.map((node) => node.state ?? '-').join(''),
    )
    // First compare lights 0 and 1; the second moves it to 1 and 2.
    expect(states).toContain('comparedcompared-')
    expect(states[states.length - 1]).toBe('-comparedcompared')
  })

  it('leaves a traversal trail on the edges it walked', () => {
    const result = run(
      'binary-search-tree',
      [8, 3, 10, 1],
      `
visit(8)
visit(3)
visit(1)
`,
    )
    const model = finalFrame(result)
    const walked = model.edges.filter((edge) => edge.state !== undefined)
    expect(walked).toHaveLength(2)
    // The edge into the node being visited right now is the live one.
    expect(walked.map((edge) => edge.state).sort()).toEqual(['active', 'traversing'])
    expect(model.nodes.find((node) => node.label === '1')?.state).toBe('visiting')
    expect(model.nodes.find((node) => node.label === '8')?.state).toBeUndefined()
  })

  it('sets a colour that persists, and a mark that can be cleared', () => {
    const result = run(
      'binary-search-tree',
      [5, 3],
      `
setColor(5, 'red')
mark(3, 'pivot')
mark(3, null)
mark(5, 'root')
`,
    )
    const model = finalFrame(result)
    const five = model.nodes.find((node) => node.label === '5')
    const three = model.nodes.find((node) => node.label === '3')
    expect(five?.color).toBe('red')
    expect(five?.meta?.mark).toBe('root')
    expect(three?.meta?.mark).toBeUndefined()
  })

  it('delivers events on the frames, in order', () => {
    const result = run('array', [1, 2], `visit(0)\nswap(0, 1)\nlog('done')`)
    const events = result.frames.flatMap((frame) => frame.events)
    expect(events.map((event) => event.type)).toEqual(['visit', 'swap', 'log'])
  })
})

describe('frames', () => {
  it('starts with the structure as it was before anything ran', () => {
    const result = run('array', [2, 1], `swap(0, 1)`)
    expect(result.frames[0].step).toBeNull()
    expect(labels(result.frames[0].model)).toEqual(['2', '1'])
  })

  it('records one frame per step, so stepping back is an index decrement', () => {
    const result = run('array', [1], `let a = 1\nlet b = 2`)
    expect(result.frames).toHaveLength(result.summary.steps + 1)
    // Every frame holds a complete model; nothing has to be replayed to show it.
    expect(result.frames.every((frame) => frame.model.nodes.length === 1)).toBe(true)
  })
})

describe('errors', () => {
  it('positions an out-of-range swap on the line that did it', () => {
    const result = run('array', [1, 2], `let x = 1\nswap(0, 9)`)
    expect(result.error).not.toBeNull()
    expect(result.error?.message).toContain('outside the array')
    expect(result.error?.detail.kind).toBe('runtime')
    if (result.error?.detail.kind !== 'runtime') return
    expect(result.error.detail.line).toBe(2)
  })

  it('turns a handle’s own error into a positioned one', () => {
    // The list handle throws a plain TypeError; it has to arrive with a line.
    const result = run('linked-list', [1, 2], `list[0] = 5`)
    expect(result.error?.detail.kind).toBe('runtime')
    expect(result.error?.message).toContain('insertAt / removeAt')
  })

  it('still catches a runaway loop that is driving the structure', () => {
    const result = buildRun({
      structure: 'array',
      data: [1, 2],
      code: `while (true) { swap(0, 1) }`,
      maxLoopIterations: 20,
    })
    expect(result.error?.detail.kind).toBe('loop-budget')
    // The frames up to the failure are still usable, so the panel can show
    // where it got to.
    expect(result.frames.length).toBeGreaterThan(1)
    expect(result.summary.completed).toBe(false)
  })

  it('leaves the injected handle out of the loop diagnostic', () => {
    // `while (i < list.length)` reads `list` too, but `list` is the runtime,
    // not the reader's variable — listing it would bury the one that matters
    // under a dump of its own methods.
    const result = buildRun({
      structure: 'linked-list',
      data: [1, 2, 3],
      code: src(`
let i = 0
while (i < list.length) {
  visit(i)
}
`),
      maxLoopIterations: 30,
    })
    expect(result.error?.detail.kind).toBe('loop-budget')
    if (result.error?.detail.kind !== 'loop-budget') return
    expect(result.error.detail.testVariables.map((v) => v.name)).toEqual(['i'])
    expect(result.error.detail.testVariables[0]).toMatchObject({
      first: '0',
      latest: '0',
      changed: false,
    })
  })

  it('names a value that is not in the tree', () => {
    const result = run('binary-search-tree', [5], `visit(42)`)
    expect(result.error?.message).toContain('not in the tree')
  })

  it('refuses to put a non-primitive into a structure', () => {
    const result = run('array', [1], `arr.push({ a: 1 })`)
    expect(result.error?.message).toContain('needs a number or a string')
  })
})

describe('frame memory', () => {
  it('hands out the same model for steps that changed nothing', () => {
    // A model per step is a fresh copy of every node, and most steps evaluate
    // an expression and paint nothing. Sharing costs nothing and is also what
    // lets the host skip re-running layout.
    const result = run('array', [3, 1, 2], `let a = 1\nlet b = 2\nlet c = 3`)
    const distinct = new Set(result.frames.map((frame) => frame.model))
    expect(result.frames.length).toBeGreaterThan(3)
    expect(distinct.size).toBe(1)
  })

  it('makes a new model as soon as something actually changes', () => {
    const result = run('array', [2, 1], `let a = 1\nswap(0, 1)\nlet b = 2`)
    expect(new Set(result.frames.map((frame) => frame.model)).size).toBeGreaterThan(1)
    expect(labels(finalFrame(result))).toEqual(['1', '2'])
  })

  it('makes a new model when only the paint changed', () => {
    const result = run('array', [1, 2], `visit(0)\nvisit(1)`)
    expect(new Set(result.frames.map((frame) => frame.model)).size).toBeGreaterThan(1)
  })
})
