import type { VizModel } from '../core/model'
import { graph } from './graph'
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
      return graph(model)
  }
}

export { chain, row } from './row'
export { graph } from './graph'
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
