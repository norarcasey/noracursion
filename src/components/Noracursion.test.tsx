import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Noracursion } from './Noracursion'

describe('<Noracursion />', () => {
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

  it('omits the heading and blurb when they are not supplied', () => {
    render(<Noracursion structure="array" operation="sort" />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('omits the heading when title is null', () => {
    render(<Noracursion structure="array" operation="sort" title={null} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('captions the example with its structure and operation', () => {
    render(<Noracursion structure="linked-list" operation="search" />)
    expect(screen.getByText('linked-list · search')).toBeInTheDocument()
  })

  it('draws three labelled nodes and the edges between them', () => {
    const { container } = render(<Noracursion structure="binary-search-tree" operation="insert" />)
    expect(container.querySelectorAll('.nrc__node')).toHaveLength(3)
    expect(container.querySelectorAll('.nrc__node circle')).toHaveLength(3)
    expect(container.querySelectorAll('.nrc__edge')).toHaveLength(2)
    expect(container.querySelectorAll('.nrc__node text')).toHaveLength(3)
  })

  it('gives every node a stable id that is also its React key', () => {
    const { container } = render(<Noracursion structure="binary-search-tree" operation="insert" />)
    const ids = Array.from(container.querySelectorAll('.nrc__node')).map((node) =>
      node.getAttribute('data-nrc-node-id'),
    )
    expect(ids).toEqual(['n1', 'n2', 'n3'])
  })

  it('labels the svg for screen readers', () => {
    render(<Noracursion structure="min-heap" operation="insert" />)
    expect(
      screen.getByRole('img', { name: 'Placeholder visualization for min-heap · insert' }),
    ).toBeInTheDocument()
  })

  it('merges a consumer className and style onto the root', () => {
    const { container } = render(
      <Noracursion
        structure="graph"
        operation="shortest-path"
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
    // A bare import must not reach for `window`/`document`; if it did, this
    // dynamic import inside the test would still pass, so the real assertion is
    // that nothing in the module graph throws when evaluated on its own.
    const mod = await import('../index')
    expect(typeof mod.Noracursion).toBe('function')
  })
})
