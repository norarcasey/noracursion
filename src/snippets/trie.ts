/**
 * Trie snippets.
 *
 * Nodes are addressed by the path to them — `trie.child('ca', 't')` is the node
 * spelling `cat` — because a trie holding "cat" and "car" has two nodes
 * labelled `a`, so a letter is not an address. The root is `''`.
 *
 * `markWord` is separate from `addChild` on purpose: the shape of the tree
 * cannot tell "car" from the "car" sitting inside "cart", so where a word ends
 * has to be recorded rather than inferred.
 */

export const TRIE_INSERT_ITER = `// Insert: follow the letters that already exist, add the ones that do not,
// and mark the end. Words that share a prefix share the nodes for it — which
// is the entire trick.
const word = 'cap'

let node = trie.root()
for (const letter of word) {
  const next = trie.child(node, letter)
  if (next === null) {
    node = trie.addChild(node, letter)
    mark(node, 'new')
  } else {
    node = next
    visit(node)
  }
}

trie.markWord(node)
log('added ' + word)
`

export const TRIE_INSERT_REC = `// The same descent, one letter per call.
const word = 'cap'

function add(node: string, at: number): string {
  if (at >= word.length) return node
  const letter = word[at]
  const next = trie.child(node, letter)
  if (next === null) {
    const created = trie.addChild(node, letter)
    mark(created, 'new')
    return add(created, at + 1)
  }
  visit(next)
  return add(next, at + 1)
}

const ending = add(trie.root(), 0)
trie.markWord(ending)
log('added ' + word)
`

export const TRIE_SEARCH_ITER = `// Search costs the length of the word, not the size of the dictionary.
// Running out of letters is not the same as finding a word: 'ca' is a path
// through this trie, but nobody ever marked it as one.
const word = 'cat'

let node = trie.root()
let found = true
for (const letter of word) {
  const next = trie.child(node, letter)
  if (next === null) {
    found = false
    break
  }
  node = next
  visit(node)
}

if (found && trie.isWord(node)) {
  mark(node, 'found')
  log('"' + word + '" is in the trie')
} else {
  log('"' + word + '" is not a word here')
}
`

export const TRIE_SEARCH_REC = `// The same walk, one letter per call.
const word = 'cat'

function find(node: string, at: number): string | null {
  if (at >= word.length) return node
  const next = trie.child(node, word[at])
  if (next === null) return null
  visit(next)
  return find(next, at + 1)
}

const ending = find(trie.root(), 0)
if (ending !== null && trie.isWord(ending)) {
  mark(ending, 'found')
  log('"' + word + '" is in the trie')
} else {
  log('"' + word + '" is not a word here')
}
`

export const TRIE_TRAVERSE_ITER = `// Every word in the trie, in alphabetical order — which comes free, because
// the letters leaving each node are already in order.
const stack = [trie.root()]

while (stack.length > 0) {
  const node = stack.pop()
  visit(node)
  if (trie.isWord(node)) log(node)

  const letters = trie.letters(node)
  // Pushed in reverse so the earliest letter comes off the stack first.
  for (let i = letters.length - 1; i >= 0; i--) {
    stack.push(trie.child(node, letters[i]))
  }
}
`

export const TRIE_TRAVERSE_REC = `// The same walk, using the call stack instead of one you carry.
function walk(node: string): void {
  visit(node)
  if (trie.isWord(node)) log(node)
  const letters = trie.letters(node)
  for (let i = 0; i < letters.length; i++) {
    walk(trie.child(node, letters[i]))
  }
}

walk(trie.root())
`
