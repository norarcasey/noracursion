import type { AnyNode } from 'acorn'

export function isNode(value: unknown): value is AnyNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof Reflect.get(value, 'type') === 'string'
  )
}

/**
 * Generic pre-order walk over an acorn tree. Returning false from `visit`
 * prunes that subtree.
 *
 * Driven off `Object.keys` rather than a per-node-type child table: the table
 * would need updating every time the supported subset grows, and a missing
 * entry there fails silently — a validator that quietly skips a subtree is
 * worse than no validator.
 */
export function walk(root: AnyNode, visit: (node: AnyNode) => boolean): void {
  if (!visit(root)) return
  for (const key of Object.keys(root)) {
    if (key === 'loc') continue
    const child: unknown = Reflect.get(root, key)
    if (Array.isArray(child)) {
      for (const item of child) if (isNode(item)) walk(item, visit)
    } else if (isNode(child)) {
      walk(child, visit)
    }
  }
}
