import type { VizModel } from '../core/model'
import { chain, row } from './row'
import { tidyTree } from './tidyTree'
import type { Layout } from './types'

/**
 * Pick a layout from the model's own hint. Pure: the same model in always
 * produces the same positions out (§6.4).
 */
export function layoutModel(model: VizModel): Layout {
  switch (model.layoutHint) {
    case 'tree':
      return tidyTree(model)
    case 'chain':
      return chain(model)
    case 'row':
      return row(model)
    case 'graph':
      // v1 takes author-supplied coordinates for graphs (§3.5); until that
      // lands in M7, a graph falls back to a row so it is at least drawn
      // rather than silently empty.
      return row(model)
  }
}

export { chain, row } from './row'
export { tidyTree } from './tidyTree'
export { routeEdge, frame } from './geometry'
export {
  EMPTY_LAYOUT,
  LEVEL_HEIGHT,
  NODE_RADIUS,
  PADDING,
  SIBLING_SPACING,
  type Layout,
  type LayoutEdge,
  type LayoutNode,
} from './types'
