import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Noracursion } from './Noracursion'

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

  it('omits the heading when title is absent or null', () => {
    const { rerender } = render(<Noracursion structure="array" operation="sort" />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    rerender(<Noracursion structure="array" operation="sort" title={null} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
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

  it('says plainly when a structure has no model behind it yet', () => {
    render(<Noracursion structure="red-black-tree" operation="insert" />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Noracursion can’t draw a red-black tree yet.',
    )
    expect(screen.getByRole('status')).toHaveTextContent('array, linked list, binary search tree')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
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
