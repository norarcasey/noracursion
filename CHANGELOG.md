# Changelog

All notable changes to this project are documented here. The format is based
on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
