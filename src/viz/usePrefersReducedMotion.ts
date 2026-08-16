import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether the reader has asked for reduced motion.
 *
 * Read through `useSyncExternalStore` rather than an effect so the very first
 * render already has the right answer — an effect-based read would animate one
 * frame before correcting itself, which is the frame that matters. Nothing
 * touches the DOM at module scope, and the server snapshot is `false`, so this
 * is safe to import under SSR (§5).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function supported(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

function subscribe(onChange: () => void): () => void {
  if (!supported()) return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  // Returns a boolean, not an object, so repeated calls compare equal and
  // cannot drive a re-render loop.
  return supported() ? window.matchMedia(QUERY).matches : false
}

function getServerSnapshot(): boolean {
  return false
}
