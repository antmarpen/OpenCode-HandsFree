import { createSignal, onCleanup } from "solid-js"
import { Voice } from "../contract"
import type { Ctx } from "../context"
import { readFlags, setFlag } from "../flags"
import type { VoiceStatus } from "../status"
import type { Dictation } from "./dictation"
import type { Speech } from "./speech"

export type ConversationPhase = "idle" | "listening" | "speaking" | "transcribing" | "suspended"

export interface Conversation {
  /** Conversation mode is on for the routed chat and everything it needs is configured. */
  readonly active: () => boolean
  readonly phase: () => ConversationPhase
  /** Ends the mode for the routed chat: switches off, microphone closed, reading cut. */
  stop(): void
}

/** How often the driver reads the microphone level. */
const TICK_MS = 80
/** Level that counts as voice while nothing is playing. */
const VOICE_LEVEL = 0.22
/** While a reply is read, the microphone also hears it: ask for more and for longer. */
const BARGE_LEVEL = 0.45
const BARGE_MS = 260

/**
 * Runs a hands-free conversation in the routed chat: listens, closes the turn after a
 * silence, sends it, keeps listening while the agent works and lets the user talk over
 * a reply. It owns the dictation recording only while the mode is on; the manual pill
 * keeps working when it is off.
 */
export function createConversation(
  ctx: Ctx,
  dictation: Dictation,
  speech: Speech,
  status: VoiceStatus,
): Conversation {
  const [phase, setPhase] = createSignal<ConversationPhase>("idle")

  /** Chat the current recording belongs to, when the driver started it. */
  let owner: string | undefined
  let heard = false
  let lastVoice = 0
  let bargeSince = 0
  let suspended = false
  let wasPlaying = false

  const routed = () => ctx.sessions.current()

  const active = () => {
    const session = routed()
    if (!session) return false
    if (!readFlags(ctx, session).conversation) return false
    return status.inputReady() && status.outputReady()
  }

  const silence = () => {
    const value = ctx.stores.settings.value.conversation.silenceMs
    return Math.max(400, Math.min(5000, value))
  }

  /** Earliest retry after a failed start, so a denied microphone is not retried in a loop. */
  let nextListenAt = 0

  const listen = () => {
    const session = routed()
    if (!session) return
    if (dictation.recording() || dictation.working()) return
    if (Date.now() < nextListenAt) return

    void dictation.listen().then((started) => {
      if (started) owner = session.key
      else nextListenAt = Date.now() + 3000
    })
  }

  const finishTurn = () => {
    const typed = ctx.screen.current()?.composer.text().trim()
    if (typed) {
      ctx.toast.show({ title: ctx.t("status.conversationBlocked") })
      stop()
      return
    }

    heard = false
    setPhase("transcribing")
    void dictation.toggle()
  }

  const stop = () => {
    const session = routed()
    if (session) setFlag(ctx, session, "conversation", false)

    owner = undefined
    heard = false
    dictation.cancel()
    speech.cancel()
    void ctx.main(Voice).stop().catch(() => {})
    setPhase("idle")
  }

  const tick = () => {
    const session = routed()

    if (!session || !readFlags(ctx, session).conversation) {
      if (owner && dictation.recording()) dictation.cancel()
      owner = undefined
      heard = false
      setPhase("idle")
      return
    }

    if (!active()) {
      setPhase("idle")
      return
    }

    if (suspended) {
      setPhase("suspended")
      return
    }

    if (dictation.working()) {
      setPhase("transcribing")
      return
    }

    if (!dictation.recording()) {
      listen()
      setPhase("listening")
      return
    }

    if (owner === undefined) {
      // A manual recording owns the microphone; the driver waits for it to end.
      setPhase("idle")
      return
    }

    if (owner !== session.key) {
      // The recording belongs to another chat: drop it and start over here.
      dictation.cancel()
      owner = undefined
      setPhase("listening")
      return
    }

    const now = Date.now()
    const playing = speech.speaking()

    // A reply leaves its own audio in the pre-roll; drop it as soon as the audio ends.
    if (wasPlaying && !playing) dictation.reset()
    wasPlaying = playing

    const level = dictation.levels().at(-1) ?? 0

    if (level >= (playing ? BARGE_LEVEL : VOICE_LEVEL)) {
      if (playing) {
        if (!bargeSince) bargeSince = now
        if (now - bargeSince >= BARGE_MS) {
          // Talking over the reply cuts it and starts the turn from this point.
          speech.cancel()
          void ctx.main(Voice).stop().catch(() => {})
          dictation.reset()
          dictation.begin()
          heard = true
          lastVoice = now
          bargeSince = 0
        }
      } else {
        if (!heard) dictation.begin()
        heard = true
        lastVoice = now
      }
    } else if (!playing) {
      bargeSince = 0
    }

    if (!playing && heard && now - lastVoice >= silence()) {
      finishTurn()
      return
    }

    setPhase(playing ? "speaking" : "listening")
  }

  const onBlur = () => {
    if (!active()) return
    if (!ctx.stores.settings.value.conversation.suspendOnBlur) return

    suspended = true
    owner = undefined
    heard = false
    dictation.cancel()
    setPhase("suspended")
  }

  const onFocus = () => {
    suspended = false
  }

  const timer = setInterval(tick, TICK_MS)
  window.addEventListener("blur", onBlur)
  window.addEventListener("focus", onFocus)

  onCleanup(() => {
    clearInterval(timer)
    window.removeEventListener("blur", onBlur)
    window.removeEventListener("focus", onFocus)
  })

  return { active, phase, stop }
}
