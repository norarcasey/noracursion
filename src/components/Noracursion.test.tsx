import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Noracursion, type NoracursionProps } from './Noracursion'

const SORT = `
for (let i = 0; i < arr.length; i++) {
  for (let j = 0; j < arr.length - i - 1; j++) {
    compare(j, j + 1)
    if (arr[j] > arr[j + 1]) swap(j, j + 1)
  }
}
`.trimStart()

/** The code the editor currently holds. */
function editorValue(): string {
  const editor = screen.getByRole('textbox', { name: /editable source/i })
  if (!(editor instanceof HTMLTextAreaElement)) throw new Error('the editor is not a textarea')
  return editor.value
}

/** The labels currently drawn inside the node circles, left to right. */
function drawnValues(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.nrc__node')).map(
    (node) => node.querySelector('text')?.textContent ?? '',
  )
}

describe('<Noracursion />', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the title and blurb it is given', () => {
    render(
      <Noracursion
        structure="binary-search-tree"
        operation="insert"
        title="Inserting into a BST"
        blurb="A blurb from the consumer."
      />,
    )
    expect(screen.getByRole('heading', { name: 'Inserting into a BST' })).toBeInTheDocument()
    expect(screen.getByText('A blurb from the consumer.')).toBeInTheDocument()
  })

  it('omits the title heading when title is absent or null', () => {
    // Level 2 is the title; the inspector panels legitimately carry their own
    // level-3 headings.
    const { rerender } = render(<Noracursion structure="array" operation="sort" />)
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    rerender(<Noracursion structure="array" operation="sort" title={null} />)
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('picks a built-in snippet when no code is given', () => {
    render(<Noracursion structure="binary-search-tree" operation="search" />)
    expect(editorValue()).toContain('tree.left(current)')
  })

  it('switches to the iterative snippet when recursion is off', () => {
    const { rerender } = render(<Noracursion structure="binary-search-tree" operation="traverse" />)
    expect(editorValue()).toContain('function walk')

    rerender(<Noracursion structure="binary-search-tree" operation="traverse" recursion={false} />)
    // The prop's whole purpose: the same walk, holding the stack yourself.
    expect(editorValue()).toContain('const stack = []')
    expect(editorValue()).not.toContain('function walk')
  })

  it('requires your own code for a pairing it has no example for', () => {
    // `operation="balance"` on an array is now a compile error without `code`;
    // with it, the pairing is yours to define and the component runs it.
    const { container } = render(
      <Noracursion structure="array" operation="balance" code={`log(arr.length)`} />,
    )
    expect(screen.getByRole('textbox', { name: /editable source/i })).toBeInTheDocument()
    // No notice — the step counter is also role=status, so ask for the notice.
    expect(container.querySelector('.nrc__notice')).toBeNull()
  })

  it('says so plainly when the language has no snippet library yet', () => {
    render(<Noracursion structure="array" operation="sort" language="python" />)
    expect(screen.getByRole('status')).toHaveTextContent('Noracursion has no Python examples yet.')
  })

  it('captions the example with its structure and operation', () => {
    render(<Noracursion structure="linked-list" operation="search" />)
    expect(screen.getByText('linked-list · search')).toBeInTheDocument()
  })

  it('draws a node per value, with a stable id on each', () => {
    const { container } = render(
      <Noracursion structure="array" operation="sort" initialData={[3, 1, 2]} />,
    )
    const nodes = container.querySelectorAll('.nrc__node')
    expect(nodes).toHaveLength(3)
    expect(Array.from(nodes).map((node) => node.getAttribute('data-nrc-node-id'))).toEqual([
      'a1',
      'a2',
      'a3',
    ])
    expect(Array.from(container.querySelectorAll('.nrc__node text')).map((t) => t.textContent))
      // Values in the circles, indices captioned beneath (§3.5).
      .toEqual(['3', '0', '1', '1', '2', '2'])
  })

  it('draws a linked list as a chain with arrowheads', () => {
    const { container } = render(
      <Noracursion structure="linked-list" operation="traverse" initialData={['a', 'b', 'c']} />,
    )
    expect(container.querySelectorAll('.nrc__node')).toHaveLength(3)
    expect(container.querySelectorAll('.nrc__edge')).toHaveLength(2)
    expect(container.querySelectorAll('.nrc__arrowhead')).toHaveLength(2)
  })

  it('draws a binary search tree with child edges and no arrowheads', () => {
    const { container } = render(
      <Noracursion structure="binary-search-tree" operation="insert" initialData={[5, 3, 8]} />,
    )
    expect(container.querySelectorAll('.nrc__node')).toHaveLength(3)
    expect(container.querySelectorAll('.nrc__edge')).toHaveLength(2)
    expect(container.querySelectorAll('.nrc__arrowhead')).toHaveLength(0)
  })

  it('honours labelMode', () => {
    const { container, rerender } = render(
      <Noracursion structure="array" operation="sort" initialData={[7, 9]} labelMode="index" />,
    )
    expect(Array.from(container.querySelectorAll('.nrc__node text')).map((t) => t.textContent))
      // Indices in the circles, and no duplicate caption beneath.
      .toEqual(['0', '1'])

    rerender(
      <Noracursion structure="array" operation="sort" initialData={[7, 9]} labelMode="none" />,
    )
    expect(container.querySelectorAll('.nrc__node text')).toHaveLength(2)
    expect(Array.from(container.querySelectorAll('.nrc__index')).map((t) => t.textContent)).toEqual(
      ['0', '1'],
    )
  })

  it('positions nodes by transform, which is what animates them', () => {
    const { container } = render(
      <Noracursion structure="array" operation="sort" initialData={[1, 2]} />,
    )
    const first = container.querySelector('.nrc__node')
    expect(first?.getAttribute('style')).toContain('translate(')
    expect(first?.getAttribute('style')).toContain('transition: transform 600ms')
  })

  it('snaps instead of animating when the reader asks for reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    const { container } = render(
      <Noracursion structure="array" operation="sort" initialData={[1, 2]} />,
    )
    const first = container.querySelector('.nrc__node')
    expect(first?.getAttribute('style')).toContain('transition: none')
    // The picture is still drawn — only the movement is removed.
    expect(container.querySelectorAll('.nrc__node')).toHaveLength(2)
  })

  it('draws every structure in the union — there is no "not yet" left', () => {
    // Each entry is checked against the union on its own, which is what makes
    // the discriminated props usable in a list like this.
    const examples: readonly NoracursionProps[] = [
      { structure: 'array', operation: 'traverse' },
      { structure: 'linked-list', operation: 'traverse' },
      { structure: 'doubly-linked-list', operation: 'traverse' },
      { structure: 'stack', operation: 'traverse' },
      { structure: 'queue', operation: 'traverse' },
      { structure: 'binary-search-tree', operation: 'traverse' },
      { structure: 'red-black-tree', operation: 'traverse' },
      { structure: 'avl-tree', operation: 'traverse' },
      { structure: 'min-heap', operation: 'traverse' },
      { structure: 'max-heap', operation: 'traverse' },
      { structure: 'trie', operation: 'traverse' },
      { structure: 'graph', operation: 'traverse' },
    ]
    for (const example of examples) {
      const { unmount } = render(<Noracursion {...example} />)
      expect(screen.getByRole('img')).toBeInTheDocument()
      unmount()
    }
  })

  it('describes the picture for a screen reader', () => {
    render(<Noracursion structure="array" operation="sort" initialData={[4, 2]} />)
    expect(screen.getByRole('img', { name: 'array with 2 nodes: 4, 2.' })).toBeInTheDocument()
  })

  it('merges a consumer className and style onto the root', () => {
    const { container } = render(
      <Noracursion
        structure="array"
        operation="sort"
        className="mine"
        style={{ maxWidth: '400px' }}
      />,
    )
    const root = container.querySelector('.nrc')
    expect(root).toHaveClass('mine')
    expect(root).toHaveStyle({ maxWidth: '400px' })
    // The consumer override must not drop the load-bearing inline styles.
    expect(root).toHaveStyle({ display: 'flex' })
  })

  it('renders without touching the DOM at module scope (SSR-safe import)', async () => {
    const mod = await import('../index')
    expect(typeof mod.Noracursion).toBe('function')
  })
})

describe('<Noracursion /> running code', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('draws the structure unchanged until the code is played', () => {
    const { container } = render(
      <Noracursion structure="array" operation="sort" initialData={[3, 1, 2]} code={SORT} />,
    )
    expect(drawnValues(container)).toEqual(['3', '1', '2'])
    expect(screen.getByText(/Step 0 of \d+/)).toBeInTheDocument()
  })

  it('animates to the sorted array when it plays', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[3, 1, 2]}
        code={SORT}
        autoPlay
        speedMs={1}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(drawnValues(container)).toEqual(['1', '2', '3'])
  })

  it('keeps a node id with its value as the cells move', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[2, 1]}
        code={`swap(0, 1)`}
        autoPlay
        speedMs={1}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const nodes = Array.from(container.querySelectorAll('.nrc__node'))
    // The element that was second is now first, and it is the same element —
    // which is what lets CSS transition it across rather than redraw it.
    expect(nodes.map((node) => node.getAttribute('data-nrc-node-id'))).toEqual(['a2', 'a1'])
    expect(drawnValues(container)).toEqual(['1', '2'])
  })

  it('paints compared nodes while it runs', () => {
    vi.useFakeTimers()
    const { container } = render(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[2, 1]}
        code={`compare(0, 1)`}
        autoPlay
        speedMs={1}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(container.querySelectorAll('[data-nrc-state="compared"]')).toHaveLength(2)
  })

  it('reports steps, events and completion to the consumer', () => {
    vi.useFakeTimers()
    const onStep = vi.fn()
    const onEvent = vi.fn()
    const onComplete = vi.fn()
    render(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[2, 1]}
        code={`swap(0, 1)\nlog('done')`}
        autoPlay
        speedMs={1}
        onStep={onStep}
        onEvent={onEvent}
        onComplete={onComplete}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(500)
    })
    // Every step is reported, not just the frame that survived the batch.
    // At speedMs=1 many timer ticks land inside one React render, and dropping
    // the ones in between would silently lose events.
    expect(onStep.mock.calls[0][0]).toMatchObject({ line: 1, phase: 'statement' })
    expect(onStep).toHaveBeenCalledTimes(onComplete.mock.calls[0][0].steps)
    expect(onEvent.mock.calls.map((call) => call[0].type)).toEqual(['swap', 'log'])
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete.mock.calls[0][0]).toMatchObject({ completed: true, logs: ['done'] })
  })

  it('surfaces a runaway loop instead of hanging', () => {
    const onRuntimeError = vi.fn()
    render(
      <Noracursion
        structure="array"
        operation="sort"
        initialData={[1, 2]}
        code={`let i = 0\nwhile (i < 10) { swap(0, 1) }`}
        maxLoopIterations={20}
        onRuntimeError={onRuntimeError}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('This loop ran 20 times and never stopped.')
    expect(alert).toHaveTextContent('`i` started as 0 and is still 0')
    expect(onRuntimeError).toHaveBeenCalledTimes(1)
    expect(onRuntimeError.mock.calls[0][0].detail.kind).toBe('loop-budget')
  })

  it('survives StrictMode double-invocation', () => {
    // The house-style regression guard: the transport is one pure reducer, so
    // React 18 running updaters twice cannot corrupt the frame index.
    vi.useFakeTimers()
    const { container } = render(
      <StrictMode>
        <Noracursion
          structure="array"
          operation="sort"
          initialData={[3, 1, 2]}
          code={SORT}
          autoPlay
          speedMs={1}
        />
      </StrictMode>,
    )
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(drawnValues(container)).toEqual(['1', '2', '3'])
  })
})

describe('<Noracursion /> accessibility of the description', () => {
  it('names the connections, not just the nodes', () => {
    // For a graph the edges *are* the structure; a list of labels describes
    // almost nothing.
    render(<Noracursion structure="graph" operation="traverse" />)
    const name = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(name).toContain('5 nodes')
    expect(name).toMatch(/\d+ connections/)
    expect(name).toContain('weights')
  })

  it('stops listing values before the description becomes an obstacle', () => {
    render(
      <Noracursion
        structure="array"
        operation="traverse"
        initialData={Array.from({ length: 120 }, (_, index) => index)}
      />,
    )
    const name = screen.getByRole('img').getAttribute('aria-label') ?? ''
    expect(name).toContain('120 nodes')
    expect(name).toContain('and 96 more')
    // Half a kilobyte of numbers read aloud is not a description.
    expect(name.length).toBeLessThan(200)
  })
})
