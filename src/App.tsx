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

      <Noracursion
        structure="binary-search-tree"
        operation="insert"
        title="Inserting into a BST"
        blurb="Milestone 0 — the shell only. The interpreter, code panel, and transport controls arrive in M1 through M5; these three circles are hardcoded and prove the build, test, and render pipeline."
      />

      <p className="demo__credit">
        An embeddable React component. Drop <code>&lt;Noracursion /&gt;</code> anywhere.
      </p>
    </main>
  )
}
