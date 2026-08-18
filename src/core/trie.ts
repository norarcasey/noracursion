import { edgeId, IdFactory, type Cell, type VizEdge, type VizModel, type VizNode } from './model'

interface TrieNode {
  readonly id: string
  /** The path from the root to here — also this node's address. */
  readonly prefix: string
  terminal: boolean
  readonly children: Map<string, TrieNode>
}

/** What the root is called, since its prefix is the empty string. */
export const TRIE_ROOT = ''

/**
 * A trie.
 *
 * Nodes are addressed by **prefix**, not by value: a trie holding "cat" and
 * "car" has two different nodes labelled `a`, so a value is not an address.
 * The path from the root is, and it reads the way the structure works —
 * `trie.child('ca', 't')` is `'cat'`.
 *
 * The letter lives on the edge as well as in the node, because the edge is
 * where it actually means something: a trie stores its keys in the shape of
 * the tree rather than in the nodes.
 */
export class Trie {
  private readonly ids = new IdFactory('t')
  private readonly root: TrieNode
  private readonly byPrefix = new Map<string, TrieNode>()

  constructor(initial: readonly Cell[] = []) {
    this.root = { id: this.ids.create(), prefix: TRIE_ROOT, terminal: false, children: new Map() }
    this.byPrefix.set(TRIE_ROOT, this.root)
    for (const word of initial) this.insert(String(word))
  }

  get size(): number {
    return this.byPrefix.size
  }

  /** How many complete words the trie holds. */
  get wordCount(): number {
    let total = 0
    for (const node of this.byPrefix.values()) if (node.terminal) total += 1
    return total
  }

  idOf(prefix: string): string | undefined {
    return this.byPrefix.get(prefix)?.id
  }

  /** The child reached by following `letter`, or null. */
  childOf(prefix: string, letter: string): string | null {
    const node = this.byPrefix.get(prefix)
    if (node === undefined) return null
    return node.children.has(letter) ? prefix + letter : null
  }

  /** Every letter leading out of a node, in insertion order. */
  lettersAt(prefix: string): string[] {
    return [...(this.byPrefix.get(prefix)?.children.keys() ?? [])]
  }

  isTerminal(prefix: string): boolean {
    return this.byPrefix.get(prefix)?.terminal ?? false
  }

  setTerminal(prefix: string, terminal: boolean): void {
    const node = this.byPrefix.get(prefix)
    if (node === undefined) throw new Error(`There is no node at "${prefix}".`)
    node.terminal = terminal
  }

  /** Adds one letter below a node. Returns the new node's prefix. */
  addChild(prefix: string, letter: string): string {
    if (letter.length !== 1) {
      throw new Error(`A trie edge carries one letter, not ${JSON.stringify(letter)}.`)
    }
    const parent = this.byPrefix.get(prefix)
    if (parent === undefined) throw new Error(`There is no node at "${prefix}".`)
    const child = prefix + letter
    if (parent.children.has(letter)) return child
    const created: TrieNode = {
      id: this.ids.create(),
      prefix: child,
      terminal: false,
      children: new Map(),
    }
    parent.children.set(letter, created)
    this.byPrefix.set(child, created)
    return child
  }

  /** The whole insertion, for building the initial trie. */
  insert(word: string): void {
    let prefix = TRIE_ROOT
    for (const letter of word) prefix = this.addChild(prefix, letter)
    if (word.length > 0) this.setTerminal(prefix, true)
  }

  has(word: string): boolean {
    return this.isTerminal(word) && this.byPrefix.has(word)
  }

  startsWith(prefix: string): boolean {
    return this.byPrefix.has(prefix)
  }

  words(): string[] {
    const found: string[] = []
    for (const [prefix, node] of this.byPrefix) if (node.terminal) found.push(prefix)
    return found.sort()
  }

  toVizModel(): VizModel {
    const nodes: VizNode[] = []
    const edges: VizEdge[] = []

    const visit = (node: TrieNode, depth: number): void => {
      const letter = node.prefix.slice(-1)
      nodes.push({
        id: node.id,
        // The root spells nothing; a dot keeps the circle from looking broken.
        label: node.prefix === TRIE_ROOT ? '·' : letter,
        meta: {
          depth,
          prefix: node.prefix,
          // A word ends here, which is otherwise invisible: the shape of the
          // tree cannot tell "car" from the "car" inside "cart".
          mark: node.terminal ? '✓' : undefined,
        },
      })
      for (const [edgeLetter, child] of node.children) {
        edges.push({
          id: edgeId(node.id, edgeLetter),
          from: node.id,
          to: child.id,
          label: edgeLetter,
        })
        visit(child, depth + 1)
      }
    }

    visit(this.root, 0)
    return { nodes, edges, layoutHint: 'tree' }
  }
}
