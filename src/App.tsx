import { Noracursion } from './components/Noracursion'
import './App.css'

const BUBBLE_SORT = `for (let i = 0; i < arr.length; i++) {
  for (let j = 0; j < arr.length - i - 1; j++) {
    compare(j, j + 1)
    if (arr[j] > arr[j + 1]) {
      swap(j, j + 1)
    }
  }
}
`

const BST_SEARCH = `let target = 6
for (const value of tree.inOrder()) {
  visit(value)
  if (value === target) {
    mark(value, 'found')
    log('found ' + value)
  }
}
`

const LIST_WALK = `for (let i = 0; i < list.length; i++) {
  visit(i)
  log(list.get(i))
}
`

const BROKEN_LOOP = `let i = 0
while (i < list.length) {
  visit(i)
}
`

export default function App() {
  return (
    <main className="demo">
      <header className="demo__intro">
        <h1 className="demo__title">Noracursion 🌀</h1>
        <p className="demo__lede">
          Data structures animated from real, editable, steppable code. The animation is not a
          script — it is whatever the code actually does.
        </p>
      </header>

      <div className="demo__examples">
        <Noracursion
          structure="array"
          operation="sort"
          title="Bubble sort"
          initialData={[5, 3, 8, 1, 9, 2]}
          code={BUBBLE_SORT}
          autoPlay
          speedMs={120}
          blurb="The cells carry their ids with them, so a swap reads as two of them trading places."
        />

        <Noracursion
          structure="binary-search-tree"
          operation="search"
          title="Walking a tree in order"
          initialData={[8, 3, 10, 1, 6, 14, 4, 7, 13]}
          code={BST_SEARCH}
          autoPlay
          speedMs={200}
          blurb="visit() leaves a trail along the edges it walked; mark() pins a badge on what it found."
        />

        <Noracursion
          structure="linked-list"
          operation="traverse"
          title="Walking a list"
          initialData={[4, 8, 15, 16]}
          code={LIST_WALK}
          autoPlay
          speedMs={220}
          showLegend
          blurb="Code that only reads still animates — the visit trail comes from the loop itself."
        />

        <Noracursion
          structure="linked-list"
          operation="traverse"
          title="A loop that never ends"
          initialData={[4, 8, 15]}
          code={BROKEN_LOOP}
          blurb="Edit line 3 to add `i = i + 1` and press play — the teaching panel is what you get instead of a hung tab."
        />
      </div>

      <p className="demo__credit">
        An embeddable React component. Drop <code>&lt;Noracursion /&gt;</code> anywhere.
      </p>
    </main>
  )
}
