import { Noracursion } from './components/Noracursion'
import './App.css'

export default function App() {
  return (
    <main className="demo">
      <header className="demo__intro">
        <h1 className="demo__title">Noracursion 🌀</h1>
        <p className="demo__lede">
          Data structures animated from real, editable, steppable code. Turn the{' '}
          <code>recursion</code> prop off and the same behaviour comes back as loops.
        </p>
      </header>

      <div className="demo__examples">
        <Noracursion
          structure="binary-search-tree"
          operation="insert"
          title="Binary search tree"
          initialData={[8, 3, 10, 1, 6, 14, 4, 7, 13]}
          blurb="Laid out with Reingold–Tilford, so subtrees never overlap and an only child still leans to its own side."
        />

        <Noracursion
          structure="linked-list"
          operation="traverse"
          title="Linked list"
          initialData={[4, 8, 15, 16]}
          blurb="A chain of nodes, each pointing at the next."
        />

        <Noracursion
          structure="array"
          operation="sort"
          title="Array"
          initialData={[5, 3, 8, 1, 9, 2]}
          blurb="Indices beneath, values inside. Ids follow the elements, so a swap will read as two cells trading places."
        />
      </div>

      <p className="demo__credit">
        An embeddable React component. Drop <code>&lt;Noracursion /&gt;</code> anywhere.
      </p>
    </main>
  )
}
