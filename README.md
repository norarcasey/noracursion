# Noracursion

Teach data structures by animating them from real, editable, steppable code.

The name is a pun on the author's name and `recursion`. The package's most
important prop turns recursion off — the same operation comes back as explicit
loops, and the learner sees two shapes of code with one behaviour.

> **Status: Milestone 0.** The build, test, and release pipeline is up and
> `<Noracursion />` renders its shell — a title, a blurb, and a static SVG. The
> interpreter that makes the animation actually run lands in M1. Not published
> to npm yet; the API is still moving, and the full README (embed snippet, props
> table, theming) comes once it stops. See [CLAUDE.md](CLAUDE.md) for the design
> and the milestone order.

## Develop

```bash
npm install
npm run dev      # demo site
npm run gate     # format → lint → typecheck → test  (fast inner loop)
npm run verify   # the full gate, plus both builds
```
