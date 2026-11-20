/**
 * The app's icon catalog has no microphone, and its speech bubbles are the ones used
 * for messages. These two 14px glyphs give the chat header a pair the user can tell
 * apart without reading the tooltip.
 */

export function MicIcon() {
  return (
    <svg
      data-slot="icon-svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M18.5 10.5v1a6.5 6.5 0 0 1-13 0v-1" />
      <path d="M12 18.5v3" />
    </svg>
  )
}

/** A speech bubble with dots: the replies being spoken. */
export function ReadAloudIcon() {
  return (
    <svg
      data-slot="icon-svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H3a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
      <path d="M6.5 9.5h.01M9.5 9.5h.01M12.5 9.5h.01" />
    </svg>
  )
}

/** Two speech bubbles: the hands-free conversation loop. */
export function ConversationIcon() {
  return (
    <svg
      data-slot="icon-svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h12.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H9l-4 3v-3H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M18 8.2h2.2a1.8 1.8 0 0 1 1.8 1.8v3.8a1.8 1.8 0 0 1-1.8 1.8h-1v2.4l-2.9-2.4" />
    </svg>
  )
}
