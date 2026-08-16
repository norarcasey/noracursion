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
