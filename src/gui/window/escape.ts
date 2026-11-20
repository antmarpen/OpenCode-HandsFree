import { onCleanup } from "solid-js"
import type { Conversation } from "./conversation"
import type { Dictation } from "./dictation"

/**
 * Escape cancels the dictation, or ends conversation mode, instead of interrupting the
 * session. The listener runs in the capture phase on the window, before the composer's
 * own key handler, and stops the event from reaching it, so a second Escape (once there
 * is nothing to cancel) interrupts the session as usual.
 */
export function registerEscape(dictation: Dictation, conversation: Conversation) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    if (!conversation.active() && !dictation.active()) return

    event.preventDefault()
    event.stopImmediatePropagation()

    if (conversation.active()) conversation.stop()
    else dictation.cancel()
  }

  window.addEventListener("keydown", onKeyDown, true)
  onCleanup(() => window.removeEventListener("keydown", onKeyDown, true))
}
