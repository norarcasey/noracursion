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
  discovered under a red-black tree in M7. (100 tests.)

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
