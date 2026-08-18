import { useCallback, useEffect, useRef, useState } from 'react'

/** How long typing has to pause before the edited code is run. */
const COMMIT_DELAY_MS = 500

export interface EditableCode {
  /** What the editor shows — updates on every keystroke. */
  readonly draft: string
  /** What actually runs. Trails the draft until typing settles. */
  readonly committed: string
  /** True when the draft has changes the run has not picked up yet. */
  readonly pending: boolean
  /**
   * Set when the `code` prop changed underneath edits the reader had made, so
   * the component can offer the choice instead of silently discarding them.
   */
  readonly incoming: string | null
  setDraft(next: string): void
  /** Run the draft now, without waiting for the debounce. */
  commitNow(): void
  /** Take the new `code` prop, dropping the reader's edits. */
  acceptIncoming(): void
  /** Keep the reader's edits and stop offering the incoming code. */
  dismissIncoming(): void
}

/**
 * Owns the code the reader is editing.
 *
 * Two problems this exists to solve:
 *
 * **Running mid-keystroke.** Re-running on every character means the teaching
 * panel flashes a syntax error on the way to every valid edit. The draft is
 * therefore committed once typing settles, and immediately when the reader
 * presses a transport control — so pressing play always runs what is on screen.
 *
 * **Losing edits.** §2 asks for a prompt before discarding typed-in code when a
 * prop changes the program. A component that renders its own modal dialog is a
 * hard thing to theme and an accessibility surface this library would then own,
 * so `incoming` lets the component offer a non-modal choice instead. Untouched
 * code is replaced silently, because there is nothing to lose.
 */
export function useEditableCode(code: string): EditableCode {
  const [draft, setDraftState] = useState(code)
  const [committed, setCommitted] = useState(code)
  const [incoming, setIncoming] = useState<string | null>(null)
  // Tracks the last `code` prop seen, so a re-render with the same prop is not
  // mistaken for the prop changing.
  const propRef = useRef(code)
  const editedRef = useRef(false)

  useEffect(() => {
    if (propRef.current === code) return
    propRef.current = code
    if (!editedRef.current) {
      setDraftState(code)
      setCommitted(code)
      setIncoming(null)
      return
    }
    setIncoming(code)
  }, [code])

  const setDraft = useCallback((next: string) => {
    editedRef.current = true
    setDraftState(next)
  }, [])

  useEffect(() => {
    if (draft === committed) return
    const timer = setTimeout(() => setCommitted(draft), COMMIT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draft, committed])

  const commitNow = useCallback(() => {
    setCommitted((current) => (current === draft ? current : draft))
  }, [draft])

  // Read `incoming` and then set three pieces of state, rather than setting
  // them from inside `setIncoming`'s updater. React 18 double-invokes updaters
  // under StrictMode, so a setter called from within one runs twice — the exact
  // shape the house style warns about, and harmless here only by luck.
  const acceptIncoming = useCallback(() => {
    if (incoming === null) return
    editedRef.current = false
    setDraftState(incoming)
    setCommitted(incoming)
    setIncoming(null)
  }, [incoming])

  const dismissIncoming = useCallback(() => setIncoming(null), [])

  return {
    draft,
    committed,
    pending: draft !== committed,
    incoming,
    setDraft,
    commitNow,
    acceptIncoming,
    dismissIncoming,
  }
}
