import type { NodeColor } from '../core/model'

/**
 * Events are the only channel between interpreted code and the renderer
 * (CLAUDE.md §3.4).
 *
 * Every event names nodes by their stable id, never by index or value, because
 * the renderer keys everything on ids and an index goes stale the moment the
 * structure changes. `swap` carries the indices as well, purely so the log can
 * say "swapped 2 and 3" in the terms the code used.
 */
export type VizEvent =
  | { readonly type: 'log'; readonly text: string }
  | { readonly type: 'visit'; readonly nodeId: string }
  | { readonly type: 'compare'; readonly a: string; readonly b: string }
  | {
      readonly type: 'swap'
      readonly a: string
      readonly b: string
      readonly i: number
      readonly j: number
    }
  | { readonly type: 'set-color'; readonly nodeId: string; readonly color: NodeColor }
  /** A temporary badge such as `pivot` or `min`. `null` clears it. */
  | { readonly type: 'mark'; readonly nodeId: string; readonly label: string | null }
