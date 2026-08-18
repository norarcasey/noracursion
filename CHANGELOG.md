# Changelog

All notable changes to this project are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **M1 — the interpreter.** TypeScript in, `Step`s out, with no `eval`,
  `new Function`, or `Worker` anywhere: the source is type-stripped with
  sucrase, parsed with acorn, and walked by generator functions that yield
  before every statement, at every loop test, and at every function entry and
  exit. Line-accurate stepping, a variables snapshot, and call depth come out of
  that walk directly.
- Whitelist validation of the supported subset, run **before** execution, so an
  uncalled `async function` is reported when the code is loaded rather than
  never. Rejections name the construct and the line.
- Teaching diagnostics for runaway code: `loop-budget` carries the loop's line
  and source text plus each test variable's first-vs-latest value, and infers
  the fix from the shape of the value (`current = current.next;`);
  `recursion-depth` names the function and writes a base case using its own
  parameter; `step-budget` stops a program that is merely slow.
- Golden trace, budget, subset-semantics and type-stripping test suites.
- **M2 — core models.** `ArrayStructure`, `LinkedList` and `BinarySearchTree`,
  each with an imperative API and each serializing to the normalized `VizModel`
  with stable node ids. BST deletion splices the in-order successor into place
  rather than copying its value down, and array swaps carry ids with the
  elements, so both read as motion rather than as relabelling. Rotation
  primitives are included so id stability can be tested now rather than
  discovered under a red-black tree in M7.
- **M3 — layout and the renderer.** Pure layout functions (`row`, `chain`, and a
  Reingold–Tilford `tidyTree` in Buchheim's linear-time form) and an SVG
  renderer whose nodes _and edges_ move by CSS transition keyed on stable ids.
  A node with one child gets a phantom sibling so it visibly leans to its own
  side. `prefers-reduced-motion` snaps to the final positions. `<Noracursion />`
  now draws the structure named by `structure` and `initialData`; a structure
  without a model yet says so instead of rendering a blank stage.
- **M4 — the bridge, and code that runs.** The live structure is injected into
  interpreted code as `arr`, `list` or `tree`, alongside `visit`, `compare`,
  `swap`, `setColor`, `mark` and `log`. Mutating the structure is what moves the
  picture; the helpers only annotate, so code that never calls `visit()` still
  animates. A run is recorded once as a filmstrip of frames, which makes
  stepping backward an index decrement. `<Noracursion />` takes `code`,
  `autoPlay`, `speedMs`, the budgets, and the `onStep` / `onEvent` /
  `onComplete` / `onRuntimeError` escape hatches; `useRun` is exported for
  headless use. `acorn` and `sucrase` are now external to the library build
  rather than bundled into it.
- **M5 — the whole panel.** An editable, line-numbered, syntax-highlighted code
  panel with a current-line bar driven by the interpreter; transport controls
  (play, pause, step, reset, speed) that are operable from the keyboard and axe
  clean; variables, call-stack and output panels read straight off the current
  step; and teaching panels that render a runaway loop as a lesson — the line,
  the code on it, a first-versus-latest table of the variables its condition
  reads, and a concrete next edit. Adds `language`, `editable`, `showCode`,
  `showControls`, `showLegend`, `showPanels` and `colorMode`. Editing the code
  re-runs it; a `code` prop that changes underneath your edits offers a choice
  instead of discarding them.
- **M6 — the snippet library.** 18 variants across the three structures, each in
  a recursive and an iterative form, selected automatically from `structure`,
  `operation`, `recursion`, `traversalOrder` and `sortAlgorithm`. Every pair is
  asserted to emit the same events in the same order and leave the structure in
  the same state, so turning `recursion` off changes the shape of the code and
  nothing else. Tree snippets work link by link — `tree.left(v)`,
  `tree.attachRight(p, v)` — so the comparison that decides where a value lands
  is in the code the reader can edit, not hidden behind `tree.insert(v)`.
- **M7 (part 1) — red-black trees, stacks, queues, doubly linked lists.** The
  red-black tree serializes literal red and black, and the renderer pairs each
  with a dashed stroke and an `R`/`B` glyph so the picture never depends on
  telling the colours apart. Its fixup — recolour, or rotate — is in the
  snippet, in both recursive and iterative form. Rotations move nodes and never
  rebuild them, which the id-stability suite now asserts on a real rebalance.
  Stack and queue mark their working ends; the doubly linked list draws its
  backward links in their own lane.
- **M7 (part 2) — heaps and AVL trees.** Binary heaps are stored as arrays and
  drawn as the tree their index arithmetic implies, with the indices captioned
  beneath so `(i - 1) / 2` and `2i + 1` stay visible. `append` and `removeLast`
  deliberately leave the heap property broken, because restoring it is the
  algorithm and the algorithm belongs in the snippet. AVL nodes wear their
  balance factor, and measure their heights rather than caching them. Both
  hold their invariants across 200 fixed-seed random trees.
- **M7 (part 3) — tries and graphs.** Every structure in `Structure` now draws,
  so there is no "can't do this yet" branch left. Trie nodes are addressed by
  the path to them, because a trie holding "cat" and "car" has two nodes
  labelled `a`; the letter rides on the edge, and a tick marks where a word
  ends. Graphs are author-positioned per §3.5, carry weights on their edges, and
  fall back to a deterministic ring when given plain values. `NodeSeed` — named
  but never defined in §2 — is now a real type. Dijkstra, BFS and DFS ship as
  snippets.
- **Typed `(structure, operation)` pairings.** `NoracursionProps` is now a
  discriminated union on `structure`, so `operation="balance"` on an array is a
  compile error rather than a runtime notice — the §6.5 requirement that two
  independent unions could not express. Usage is unchanged and still flat.
  Supplying your own `code` opens any pairing back up, because the registry has
  no business constraining a program it did not write. The union is derived
  from `BUILT_IN_OPERATIONS`, and a test asserts every pairing it allows has a
  snippet behind it, so the type and the library cannot drift apart.
  Red-black and AVL trees gained the four traversals along the way. (438 tests.)

- **M0 — bootstrap.** `<Noracursion />` renders the component shell: an optional
  title, an optional consumer blurb, a static SVG of three hardcoded nodes, and
  a caption naming the example's structure and operation. No interpreter, no
  code panel, no transport controls yet.
- Framework-free type unions (`Structure`, `Operation`, `TraversalOrder`,
  `SortAlgorithm`, `Language`) from CLAUDE.md §2.
- Vite library build emitting ESM **and** CJS with bundled type declarations,
  `react` / `react-dom` external as peer dependencies.
- ESLint + Prettier with no-type-assertion, no-non-null-assertion, and no-eval
  rules, and a CI workflow (lint, format, typecheck, test, build) on Node
  20.x / 22.x.
- Trusted Publishing release pipeline (GitHub Release → OIDC publish with
  provenance), idempotent so a release for an already-published version is a
  no-op instead of a failure.

Nothing is published to npm yet — the API is still moving. See CLAUDE.md §7 for
the milestone order.
