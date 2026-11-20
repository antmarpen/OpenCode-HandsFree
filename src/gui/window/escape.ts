import { onCleanup } from "solid-js"
import type { Dictation } from "./dictation"

/**
 * Escape cancels the dictation instead of interrupting the session, but only while
 * there is something to cancel. The listener runs in the capture phase on the window,
 * before the composer's own key handler, and stops the event from reaching it, so a
 * second Escape (once the dictation is gone) interrupts the session as usual.
 */
export function registerEscape(dictation: Dictation) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !dictation.active()) return

    event.preventDefault()
    event.stopImmediatePropagation()
    dictation.cancel()
  }

  window.addEventListener("keydown", onKeyDown, true)
  onCleanup(() => window.removeEventListener("keydown", onKeyDown, true))
}
