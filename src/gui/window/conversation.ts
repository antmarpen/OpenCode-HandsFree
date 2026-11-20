import { createSignal, onCleanup } from "solid-js"
import { Voice } from "../contract"
import type { Ctx } from "../context"
import { readFlags } from "../flags"
import type { VoiceStatus } from "../status"
import type { Dictation } from "./dictation"
import type { Speech } from "./speech"

export type ConversationPhase = "idle" | "listening" | "speaking" | "transcribing" | "suspended"

export interface Conversation {
  /** The chat is in conversation mode: the pill shows the conversation icon and waits to be pressed. */
  readonly armed: () => boolean
  /** The loop is running: listening, thinking or speaking. */
  readonly running: () => boolean
  readonly phase: () => ConversationPhase
  /** Starts the loop for the routed chat. */
  start(): void
  /** Stops the loop and goes back to the armed state, without leaving the mode. */
  stop(): void
}

/** How often the driver reads the microphone level. */
const TICK_MS = 40
/** Level that counts as voice while nothing is playing. */
const VOICE_LEVEL = 0.22
/**
 * A reply is not interrupted by any sound: the voice has to add up to this much, and a
 * quiet spell longer than the threshold is what ends the sound instead of a syllable gap.
 */
const BARGE_MS = 600
const BARGE_QUIET_MS = 1500
/** Silence after which the reply gets its volume back. */
const BARGE_RESTORE_MS = 700
/** A reply that ends while the user is still talking keeps the turn. */
const VOICE_HOLD_MS = 600

/**
 * Runs a hands-free conversation in the routed chat: listens, closes the turn after a
 * silence, sends it, keeps listening while the agent works and lets the user talk over
 * a reply. Enabling the mode only arms it; the loop starts when the user presses the
 * composer pill, which is also how the mode stays out of the way until then.
 */
export function createConversation(
  ctx: Ctx,
  dictation: Dictation,
  speech: Speech,
  status: VoiceStatus,
): Conversation {
  const [phase, setPhase] = createSignal<ConversationPhase>("idle")
  const [running, setRunning] = createSignal(false)

  /** Chat the loop was started for; the recording itself is tracked separately. */
  let runOwner: string | undefined
  /** Chat the current recording belongs to, when the driver started it. */
  let owner: string | undefined
  let heard = false
  let lastVoice = 0
  let suspended = false
  let wasPlaying = false
  /** Voiced time accumulated during this playback, across the pauses between words. */
  let voiceMs = 0
  /** The reply is quietened while the user talks over it. */
  let ducked = false
  /** Earliest retry after a failed start, so a denied microphone is not retried in a loop. */
  let nextListenAt = 0

  const routed = () => ctx.sessions.current()
  const modeOn = () => {
    const session = routed()
    return !!session && readFlags(ctx, session).conversation
  }
  const ready = () => status.inputReady() && status.outputReady()

  const armed = () => modeOn() && ready() && !running()

  const silence = () => {
    const value = ctx.stores.settings.value.conversation.silenceMs
    return Math.max(400, Math.min(5000, value))
  }

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
    heard = false

    // Typed text belongs to the user: drop this turn and keep the loop alive, because a
    // stray word or a cough must never end the conversation.
    if (ctx.screen.current()?.composer.text().trim()) {
      ctx.toast.show({ title: ctx.t("status.conversationBlocked") })
      dictation.reset()
      return
    }

    setPhase("transcribing")
    void dictation.toggle()
  }

  const start = () => {
    if (!modeOn() || !ready() || running()) return

    // Pressing the pill is the user's turn: stop whatever was being read.
    speech.cancel()
    void ctx.main(Voice).stop().catch(() => {})

    runOwner = routed()?.key
    owner = undefined
    heard = false
    voiceMs = 0
    nextListenAt = 0
    setRunning(true)
    setPhase("listening")
  }

  const stop = () => {
    if (!running()) return

    setRunning(false)
    runOwner = undefined
    owner = undefined
    heard = false
    voiceMs = 0
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
      if (running()) setRunning(false)
      setPhase("idle")
      return
    }

    if (!running()) {
      if (owner && dictation.recording()) {
        dictation.cancel()
        owner = undefined
      }
      setPhase("idle")
      return
    }

    if (!ready()) {
      stop()
      return
    }

    if (runOwner !== session.key) {
      // The user moved to another chat: stop the loop and stay armed here.
      stop()
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

    const now = Date.now()
    const playing = speech.speaking()

    if (wasPlaying && !playing) {
      // The reply ended on its own: drop its echo, unless the user is in the middle of a
      // turn that started over it.
      if (!heard || now - lastVoice > VOICE_HOLD_MS) dictation.reset()
      if (ducked) {
        ducked = false
        speech.restore()
      }
      voiceMs = 0
    }
    if (playing && !wasPlaying) voiceMs = 0
    wasPlaying = playing

    const level = dictation.levels().at(-1) ?? 0
    // The same detector in both cases: the same level starts a turn, playing or not.
    const voiced = level >= VOICE_LEVEL

    if (voiced) {
      if (!heard) {
        heard = true
        dictation.begin()
      }
      lastVoice = now
    }

    if (playing && voiced) {
      voiceMs += TICK_MS
      // The reply quiets down at the first sound, so it never covers the first word; a
      // burst like a cough brings the volume back as soon as the sound stops.
      if (!ducked) {
        ducked = true
        speech.duck()
      }
    } else if (ducked && now - lastVoice > BARGE_RESTORE_MS) {
      ducked = false
      speech.restore()
    }

    if (!playing || now - lastVoice > BARGE_QUIET_MS) voiceMs = 0

    if (playing && voiceMs >= BARGE_MS) {
      // The voice has lasted over the reply: stop it here and keep recording the turn.
      speech.cancel()
      void ctx.main(Voice).stop().catch(() => {})
      ducked = false
      voiceMs = 0
      // The utterance just started must not be dropped as leftover reply audio.
      wasPlaying = false
    }

    if (!playing && heard && now - lastVoice >= silence()) {
      finishTurn()
      return
    }

    setPhase(playing ? "speaking" : "listening")
  }

  const onBlur = () => {
    if (!running() || !modeOn()) return
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

  return { armed, running, phase, start, stop }
}
