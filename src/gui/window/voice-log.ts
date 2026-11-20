import { onCleanup } from "solid-js"
import type { Conversation } from "./conversation"
import type { Dictation } from "./dictation"
import type { Speech } from "./speech"

/** How often the probe samples the microphone while a reply plays. */
const PROBE_MS = 200

/**
 * Temporary probe for the hands-free interruption: logs, for every reply, whether the
 * conversation was running and how loud the microphone got while it played. It exists to
 * tune the barge threshold with real numbers; remove it once that is settled.
 */
export function probePlayback(dictation: Dictation, speech: Speech, conversation: Conversation) {
  let playing = false
  let peak = 0

  const timer = setInterval(() => {
    const current = speech.speaking()
    if (current) peak = Math.max(peak, dictation.levels().at(-1) ?? 0)
    if (current === playing) return

    playing = current
    console.warn(current ? "voice: reply started" : "voice: reply ended", {
      running: conversation.running(),
      phase: conversation.phase(),
      recording: dictation.recording(),
      working: dictation.working(),
      peak: Number(peak.toFixed(2)),
    })
    if (current) peak = 0
  }, PROBE_MS)

  onCleanup(() => clearInterval(timer))
}
