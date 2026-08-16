/**
 * Events are the only channel between interpreted code and the renderer
 * (CLAUDE.md §3.4). The runtime that lets user code *emit* most of these lands
 * in M4; M1 defines the shape and emits only `log`, because `console.log` is in
 * the supported subset and its output pane is part of the interpreter's
 * observable behaviour.
 */
export type VizEvent =
  | { readonly type: 'log'; readonly text: string }
  | { readonly type: 'visit'; readonly nodeId: string }
  | { readonly type: 'compare'; readonly a: string; readonly b: string }
  | { readonly type: 'swap'; readonly i: number; readonly j: number }
  | { readonly type: 'set-color'; readonly nodeId: string; readonly color: 'red' | 'black' }
  | { readonly type: 'mark'; readonly nodeId: string; readonly label: string }
