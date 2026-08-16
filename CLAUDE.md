# Noracursion

An npm package that teaches data structures by animating them from real, editable,
steppable code.

The name is a pun on the author's name (Nora) and `recursion`. The package's most
important prop turns recursion off. Lean into this in docs and error copy.

---

## 0. Before you write any code

**Stop and ask the author for the path to a reference package.** They maintain
several React libraries with tooling they already like. Do not scaffold a build
system, test runner, linter, or `tsup`/`rollup` config from scratch or from your
own defaults.

Once given the path:

1. Read that package's `package.json`, build config, tsconfig, lint config, and
   test setup.
2. Mirror them. Same bundler, same test runner, same lint rules, same release
   flow, same module layout conventions.
3. Only diverge where this package has a genuinely different need, and say so
   out loud when you do.

If the author does not have a reference handy, ask before choosing. Do not guess.

---

## 1. What this is

A single React component renders **exactly one** data structure example. It shows:

- a **visualization** (SVG: circles for nodes, lines for edges)
- a **code panel** (editable, syntax-highlighted, line-numbered)
- **transport controls** (play / pause / step forward / step back / reset / speed)
- an optional **blurb** supplied by the consumer

The animation is _driven by the code_. There is no separate animation script. When
the user edits the code and presses play, the visualization does whatever the
edited code actually does — including being wrong, which is the point.

---

## 2. Public API

The component's props are the entire configuration surface. No context providers
required, no global config, no imperative setup.

```ts
export type Structure =
  | 'array'
  | 'linked-list'
  | 'doubly-linked-list'
  | 'stack'
  | 'queue'
  | 'binary-search-tree'
  | 'red-black-tree'
  | 'avl-tree'
  | 'min-heap'
  | 'max-heap'
  | 'trie'
  | 'graph'

export type Operation =
  'insert' | 'delete' | 'search' | 'traverse' | 'sort' | 'balance' | 'shortest-path'

export type TraversalOrder = 'in-order' | 'pre-order' | 'post-order' | 'level-order'

export type SortAlgorithm = 'bubble' | 'insertion' | 'selection' | 'merge' | 'quick' | 'heap'

export type Language = 'typescript' | 'javascript' | 'python' | 'java' | 'go'

export interface NoracursionProps {
  /* --- what to show --- */
  structure: Structure
  operation: Operation
  initialData?: ReadonlyArray<number | string> | NodeSeed[]
  traversalOrder?: TraversalOrder // only meaningful for traverse
  sortAlgorithm?: SortAlgorithm // only meaningful for sort

  /**
   * When false, the built-in snippet switches to an iterative implementation
   * (explicit stack / queue / pointer loops). Default true.
   */
  recursion?: boolean

  /* --- code panel --- */
  language?: Language // default 'typescript'
  code?: string // overrides the built-in snippet
  editable?: boolean // default true
  showCode?: boolean // default true

  /* --- presentation --- */
  blurb?: React.ReactNode
  title?: React.ReactNode
  labelMode?: 'value' | 'index' | 'none' // default 'value'
  colorMode?: 'structure' | 'state' | 'none' // default 'structure'
  showLegend?: boolean
  showControls?: boolean
  className?: string
  style?: React.CSSProperties

  /* --- execution --- */
  autoPlay?: boolean // default false
  speedMs?: number // ms per step, default 600
  stepBudget?: number // total steps, default 10_000
  maxLoopIterations?: number // per-loop cap, default 1_000

  /* --- escape hatches --- */
  onStep?: (step: StepInfo) => void
  onEvent?: (event: VizEvent) => void
  onComplete?: (summary: RunSummary) => void
  onRuntimeError?: (error: NoracursionError) => void
}
```

Every prop that changes the _program_ (`structure`, `operation`, `recursion`,
`traversalOrder`, `sortAlgorithm`, `language`) reselects the built-in snippet —
**unless** the user has edited the code, in which case prompt before discarding
their edits. Never silently blow away typed-in code.

`colorMode`:

- `'structure'` — colors come from the data structure's own semantics. For
  `red-black-tree` this means literal red and black nodes. This is deliberate:
  the color _is_ the mnemonic. Do not theme it into maroon and charcoal.
- `'state'` — colors come from execution state (unvisited / visiting / compared /
  swapped / final).
- `'none'` — all nodes neutral.

Because red/black carries meaning, every color must also be encoded
non-chromatically: stroke pattern, node label, or a small glyph. Assume a
colorblind learner is the primary user, not an edge case.

---

## 3. Architecture

Strict layering. Each layer is independently testable and the lower three have no
React dependency at all.

```
src/
  core/          # pure data structure models. No React. No DOM.
    tree.ts  redBlackTree.ts  linkedList.ts  heap.ts  graph.ts  ...
    model.ts       # the normalized shape every structure serializes to
  interpreter/   # parse + step machine. No React. No DOM.
    parse.ts       # TS -> AST
    interpret.ts   # generator-based tree walker
    scope.ts
    errors.ts
  bridge/        # the API user code can call; turns calls into VizEvents
    runtime.ts
    events.ts
  layout/        # (model) => positions. Pure functions.
    tidyTree.ts  chain.ts  row.ts  radial.ts
  viz/           # SVG renderer
  ui/            # editor, controls, legend, blurb, error panels
  snippets/      # the built-in code library, keyed by variant
  index.ts
```

### 3.1 `core/` — the models

Each structure exposes a small imperative API (`insert`, `remove`, `find`, etc.)
and serializes to one normalized shape the renderer understands:

```ts
export interface VizModel {
  nodes: Array<{
    id: string // STABLE across mutations — animation depends on this
    label: string
    color?: 'red' | 'black' | string
    state?: 'idle' | 'visiting' | 'compared' | 'swapped' | 'found' | 'removed'
    meta?: Record<string, unknown>
  }>
  edges: Array<{
    id: string
    from: string
    to: string
    kind?: 'child-left' | 'child-right' | 'next' | 'prev' | 'parent' | 'weighted'
    label?: string
    state?: 'idle' | 'traversing' | 'active'
  }>
  layoutHint: 'tree' | 'chain' | 'row' | 'graph'
}
```

**Node ids must be stable.** A rotation in a red-black tree moves nodes; it does
not destroy and recreate them. If ids churn, every animation becomes a flicker.
Write a test that asserts id stability across an insert-triggered rotation.

### 3.2 `interpreter/` — the step machine

This is the load-bearing wall of the project. Get it right before touching pixels.

**Hard constraint: no `eval`, no `new Function`, no `Worker` blob eval.** The
package must run under a Content-Security-Policy that forbids `unsafe-eval`.

Pipeline:

1. **Strip TypeScript types.** Use a dependency-light synchronous transform
   (`sucrase` is the default recommendation; `typescript` as an optional peer is
   acceptable). If you find something smaller, propose it before switching. This
   is an internal detail and must not leak into the public API.
2. **Parse** the resulting ES2020 with `acorn`, retaining `loc` (line/column) on
   every node.
3. **Interpret** by walking the AST with generator functions:

```ts
function* evaluate(node: Node, env: Env): Generator<Step, Value, void>;
```

Yield a `Step` before each **statement**, and additionally at each loop test and
each function entry/exit:

```ts
export interface Step {
  line: number
  column: number
  nodeType: string
  scope: Record<string, unknown> // shallow snapshot, for the variables panel
  callDepth: number
  events: VizEvent[] // emitted since the previous step
}
```

The host drives the generator. This gives you, essentially for free:

- line-accurate stepping
- a variables inspector
- **step backward** (record the step trace; stepping back replays from the start
  to step N-1 rather than trying to invert mutations)
- a call-stack view, which is how you make recursion legible

Supported JS subset for v1 — keep it small and reject the rest with a clear
"Noracursion can't run this yet" message rather than failing weirdly:

- `let` / `const` / `var`, assignment, compound assignment, `++` / `--`
- arithmetic, comparison, logical, ternary, template literals
- `if` / `else`, `for`, `for...of`, `while`, `do...while`, `break`, `continue`
- function declarations, arrow functions, closures, recursion, `return`
- array and object literals, member access, index access
- `Array.prototype`: `push` `pop` `shift` `unshift` `length` `slice` `concat`
  `indexOf` `includes` `map` `filter` `forEach` `reduce` `sort`
- `Math.*`, `console.log`
- `class` with methods and a constructor (needed for idiomatic Node classes)

Explicitly **not** in v1: `async`/`await`, generators, `try`/`catch`, regex
literals, destructuring beyond simple array/object patterns, spread in calls,
getters/setters, prototypes, `this` outside class methods. Reject with a message
naming the unsupported construct and its line number.

### 3.3 Runaway loop handling

Two budgets, both enforced by the host because the host owns the clock:

- `stepBudget` — total steps for the whole run (default 10,000)
- `maxLoopIterations` — iterations for any single loop node (default 1,000)

The tab can never hang: the interpreter yields on every step and cannot run away
between yields.

When a budget is exceeded, throw a `LoopBudgetError` carrying real diagnostics:

```ts
export interface LoopBudgetError extends NoracursionError {
  kind: 'loop-budget'
  loopLine: number
  loopSource: string
  iterations: number
  /** Variables read by the loop test, with value at iteration 1 vs. now. */
  testVariables: Array<{
    name: string
    first: unknown
    latest: unknown
    changed: boolean
  }>
}
```

The UI renders this as a **teaching panel**, not a stack trace. Target copy:

> **This loop ran 1,000 times and never stopped.**
> Line 7: `while (current !== null)`
> `current` started as `Node(8)` and is still `Node(8)`. A `while` loop only ends
> when its condition becomes false — something inside the loop has to change
> `current`. Try adding `current = current.next;` before the closing brace.

Detect the common shapes and tailor the hint:

- loop test variable never mutated in the body
- loop counter mutated in the wrong direction
- `continue` placed before the increment
- recursion with no base case → separate `RecursionDepthError`, capped at depth
  200, with a hint about what the base case should check

Every diagnostic must name a line and suggest a concrete next edit. "An error
occurred" is a failure of this component's entire premise.

### 3.4 `bridge/` — what user code can call

User code manipulates the structure through an injected runtime. Every call
emits a `VizEvent`; events are the **only** channel between code and renderer.

```ts
// injected into the interpreter's global scope
;tree | list | arr | graph // the live structure, per `structure` prop
visit(node) // paint as visiting, advance the traversal trail
compare(a, b) // paint two nodes as being compared
swap(i, j) // paint and animate a swap
setColor(node, 'red' | 'black')
mark(node, label) // attach a temporary badge, e.g. 'pivot', 'min'
log(...args) // to the output pane
```

These are pedagogical instrumentation, not required for correctness — code that
never calls `visit()` still runs and still animates, it's just less annotated.
Built-in snippets should use them liberally, since they double as an example of
how to annotate your own code.

### 3.5 `layout/` and `viz/`

Pure layout functions: `(model: VizModel) => { nodes: Positioned[]; edges: Routed[] }`.

- `tidyTree` — Reingold–Tilford. Non-overlapping subtrees, parents centered over
  children. Do not use a naive `x = index * width` layout; it collapses on
  unbalanced trees, which is exactly when the visualization matters most.
- `chain` — horizontal for linked lists, with next/prev arrowheads.
- `row` — arrays and heaps-as-arrays, with index labels beneath.
- `graph` — v1 accepts author-supplied coordinates; deterministic force layout
  can come later. Never ship a layout that jitters between renders.

Rendering: one `<svg>` with a `viewBox` that fits content plus padding. Node =
`<circle r={18}>` plus centered `<text>`. Movement animates via CSS transition on
`transform`, keyed by stable node id, so rotations and swaps read as motion
rather than teleportation. Respect `prefers-reduced-motion` by snapping to final
positions and leaving the stepping controls fully usable.

### 3.6 `ui/`

- **Editor**: a controlled `<textarea>` layered over a highlighted `<pre>`, with a
  line-number gutter and a current-line highlight bar driven by the interpreter.
  No Monaco, no CodeMirror in v1 — this is a library and the dependency cost is
  not worth it. Put it behind an `EditorAdapter` interface so a CodeMirror
  adapter can be added later without touching anything else.
- **Controls**: play, pause, step forward, step back, reset, speed slider.
  Keyboard: space = play/pause, arrows = step. Full ARIA labeling; the whole
  component must be operable without a mouse.
- **Panels**: variables, call stack, `log()` output, error/teaching panel.

---

## 4. Snippet library

`snippets/` maps a variant key to source:

```
`${structure}:${operation}:${language}:${recursion ? 'rec' : 'iter'}`
```

Requirements:

- Every snippet is the **simplest correct** version of that operation. Optimize
  for reading, not for cleverness or performance.
- TypeScript snippets must actually execute under the interpreter. Verified by
  test, not by eye.
- Recursive and iterative variants must produce the _same_ visualization for the
  same input. This is the pedagogical payoff of the `recursion` prop — the
  learner sees two shapes of code with one behavior.
- Non-TypeScript snippets are **display-only** in v1. The code panel disables
  play and shows a clear badge: "Python shown for comparison — execution is
  TypeScript-only for now." Never fake execution of a language you can't run.

---

## 5. Packaging

- Peer deps: `react` and `react-dom`, `>=18`. Support React 19.
- ESM + CJS, `"sideEffects": false`, full `.d.ts`.
- No CSS framework dependency. Ship one optional stylesheet plus CSS custom
  properties (`--nrc-node-fill`, `--nrc-edge-stroke`, …) for theming. Inline
  styles for anything structurally load-bearing so an unstyled import still works.
- Keep the runtime dependency list to the type-stripper and the parser. Justify
  anything else in the PR description.
- SSR-safe: no DOM access at module scope, no layout math during render that
  depends on `window`.

---

## 6. Testing

Use whatever the reference package uses. Required coverage:

1. **Interpreter golden traces** — fixture programs → asserted step-by-step
   traces (line, scope, events). This is the highest-value test suite; write it
   first and let it be strict.
2. **Budget tests** — a known-infinite `while`, a runaway `for`, and a base-case-less
   recursion each terminate, throw the right error type, and populate correct
   diagnostic fields.
3. **Node id stability** — ids survive rotations, rebalances, and deletions.
4. **Layout purity** — same model in, same positions out, no NaN, no overlaps on
   a degenerate (fully left-leaning) tree.
5. **Snippet matrix** — parametrized over every valid
   `(structure, operation, recursion)` combination: the built-in TypeScript
   snippet parses, runs to completion under budget, and leaves the structure in
   the expected final state. Any unimplemented combination must be absent from
   the type union, not silently broken.
6. **Component tests** — render, play to completion, assert final DOM; edit code
   to something broken, assert the teaching panel appears.
7. **Accessibility** — keyboard-only operation of all controls; axe clean.

---

## 7. Build order

Work in this order and **stop after each milestone** for review. Do not run ahead.

- **M0** — Bootstrap from the reference package. Empty component that renders a
  blurb and a static SVG of three hardcoded circles. Proves the pipeline.
- **M1** — `interpreter/` end to end for the supported subset, with the golden
  trace suite and both budget errors. **No UI.** Node-only tests.
- **M2** — `core/` models for `array`, `linked-list`, and `binary-search-tree`,
  serializing to `VizModel` with stable ids.
- **M3** — `layout/` (`row`, `chain`, `tidyTree`) plus the SVG renderer with
  animated transitions.
- **M4** — `bridge/` + wiring: code runs, events flow, structure animates.
- **M5** — Editor, transport controls, variables/call-stack/log panels, and the
  teaching panels for runaway loops and unbounded recursion.
- **M6** — Snippet library for the M2 structures, both recursion variants, plus
  the snippet matrix test.
- **M7** — Remaining structures, starting with `red-black-tree` (colors and
  rotations are the marquee demo). Then heap, AVL, trie, graph.

Docs and README come last, once the API has stopped moving.

---

## 8. Non-goals

- No server, no network calls, no telemetry.
- No `eval` / `new Function` anywhere, at any point, for any reason.
- No multi-structure rendering. One component render, one example. If a consumer
  wants three, they render three components.
- No user-facing "sandbox security" claims. Code runs in the reader's own browser
  under an interpreter that can only touch the injected runtime; say that plainly
  and don't oversell it.
- No general-purpose JS engine. Grow the supported subset only when a snippet
  actually needs it.

---

## 9. Working agreements

- TypeScript strict. No `any` in public types; internal `any` needs a comment
  explaining why.
- Prefer plain functions and discriminated unions over classes and inheritance,
  except in `core/` where an imperative structure API is the natural fit.
- When a decision has a real tradeoff (dependency choice, layout algorithm,
  interpreter subset boundary), state the options and your pick in the commit
  message rather than choosing silently.
- If a requirement in this file turns out to be wrong once you're in the code,
  say so and propose the change. Don't quietly route around it.
