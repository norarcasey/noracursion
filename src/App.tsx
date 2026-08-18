import { useState } from 'react'
import { Noracursion } from './components/Noracursion'
import './App.css'

export default function App() {
  const [recursion, setRecursion] = useState(true)

  return (
    <main className="demo">
      <header className="demo__intro">
        <h1 className="demo__title">Noracursion 🌀</h1>
        <p className="demo__lede">
          Data structures animated from real, editable, steppable code. The animation is not a
          script — it is whatever the code actually does. Edit any of these and press play.
        </p>
        <label className="demo__toggle">
          <input
            type="checkbox"
            checked={recursion}
            onChange={(event) => setRecursion(event.target.checked)}
          />
          <span>
            <code>recursion={String(recursion)}</code> — the same work, a different shape of code
          </span>
        </label>
      </header>

      <div className="demo__examples">
        <Noracursion
          structure="binary-search-tree"
          operation="traverse"
          traversalOrder="in-order"
          recursion={recursion}
          title="Walking a tree in order"
          initialData={[8, 3, 10, 1, 6, 14]}
          autoPlay
          speedMs={260}
          showLegend
          blurb="Turn recursion off and the call stack becomes an array you push and pop yourself. Same visits, same order — 73 steps recursive, 65 iterative."
        />

        <Noracursion
          structure="binary-search-tree"
          operation="insert"
          recursion={recursion}
          title="Inserting into a search tree"
          initialData={[8, 3, 10, 1, 6, 14]}
          blurb="The comparison is in the snippet, not hidden behind an insert() call. Change < to > and watch 7 land in the wrong place."
        />

        <Noracursion
          structure="red-black-tree"
          operation="insert"
          recursion={recursion}
          title="Red-black tree: insert and repair"
          initialData={[10, 5, 15, 3, 7, 13, 20]}
          autoPlay
          speedMs={320}
          blurb="The colour is the mnemonic, so it is drawn literally — and paired with a dashed stroke and an R or B glyph, because a picture that depends on telling red from black is a picture some readers cannot read. The fixup is in the snippet: watch the recolouring, then the rotation."
        />

        <Noracursion
          structure="min-heap"
          operation="insert"
          recursion={recursion}
          title="Sifting up a min-heap"
          initialData={[8, 3, 10, 1, 6, 14]}
          autoPlay
          speedMs={280}
          blurb="Stored as an array, drawn as the tree its index arithmetic implies: a node's parent is at (i - 1) / 2. Only the root is promised — a heap is not a sorted array."
        />

        <Noracursion
          structure="avl-tree"
          operation="insert"
          recursion={recursion}
          title="AVL: rebalancing on the way back up"
          initialData={[8, 3, 10, 1, 6, 14]}
          autoPlay
          speedMs={300}
          blurb="Each node wears its balance factor. When one tips past ±1 it rotates — watch the badge appear, then the subtree swing."
        />

        <Noracursion
          structure="stack"
          operation="traverse"
          recursion={recursion}
          title="Reading a stack costs you the stack"
          initialData={[4, 8, 15, 16]}
          autoPlay
          speedMs={260}
          blurb="There is no way to look inside: you pop everything off and push it back. Turn recursion off and the holding array becomes explicit."
        />

        <Noracursion
          structure="doubly-linked-list"
          operation="traverse"
          recursion={recursion}
          title="There and back again"
          initialData={[4, 8, 15]}
          autoPlay
          speedMs={260}
          blurb="Two links per pair, drawn in their own lane. Recursion walks home for free by unwinding — which is exactly the trick a singly linked list uses to fake having prev pointers."
        />

        <Noracursion
          structure="array"
          operation="sort"
          sortAlgorithm="quick"
          recursion={recursion}
          title="Quicksort"
          initialData={[5, 3, 8, 1, 9, 2]}
          autoPlay
          speedMs={140}
          blurb="Partition around a pivot, then sort each side. The iterative twin keeps the same stack by hand, in the same order."
        />

        <Noracursion
          structure="linked-list"
          operation="search"
          recursion={recursion}
          title="Searching a list"
          initialData={[4, 8, 15, 6, 16]}
          autoPlay
          speedMs={260}
          blurb="A list has no shortcuts — there is no way in except one node at a time."
        />

        <Noracursion
          structure="graph"
          operation="shortest-path"
          recursion={recursion}
          title="Dijkstra: cheapest, not fewest"
          autoPlay
          speedMs={300}
          blurb="A→C→B costs 3, while the direct A→B edge costs 4 — so the two-hop route wins. Positions come from the data; §3.5 keeps v1 graphs author-placed so nothing jitters."
        />

        <Noracursion
          structure="trie"
          operation="insert"
          recursion={recursion}
          title="A trie shares its prefixes"
          autoPlay
          speedMs={300}
          blurb="Adding 'cap' reuses the c and the a already there and adds one node. The tick marks where a word ends — the shape alone cannot tell 'car' from the 'car' inside 'cart'."
        />

        <Noracursion
          structure="linked-list"
          operation="traverse"
          title="A loop that never ends"
          initialData={[4, 8, 15]}
          code={'let i = 0\nwhile (i < list.length) {\n  visit(i)\n}\n'}
          blurb="Add i = i + 1 on line 3 and press play. The teaching panel is what you get instead of a hung tab."
        />
      </div>

      <p className="demo__credit">
        An embeddable React component. Drop <code>&lt;Noracursion /&gt;</code> anywhere.
      </p>
    </main>
  )
}
