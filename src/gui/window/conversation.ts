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
/** Voice needed before the reply is quietened, so a single noise does not dip it. */
const BARGE_DUCK_MS = 80
/** Silence after which the reply gets its volume back. */
const BARGE_RESTORE_MS = 700
/** A reply that ends while the user is still talking keeps the turn. */
const VOICE_HOLD_MS = 600
/** The first moments of a reply are its own onset reaching the microphone. */
const BARGE_GUARD_MS = 250
/**
 * Audio kept when the first sound of a turn is detected: it reaches back into the syllable
 * that woke the detector, without dragging in the reply that was playing.
 */
const BARGE_ONSET_S = 0.25

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
  /** When the reply being read started playing, so its own onset is not a voice. */
  let playSince = 0
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
    ducked = false
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
    ducked = false
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
      voiceMs = 0
      ducked = false
      speech.restore()
    }
    if (playing && !wasPlaying) {
      playSince = now
      voiceMs = 0
    }
    wasPlaying = playing

    const level = dictation.levels().at(-1) ?? 0
    // One detector for both cases: the same level starts a turn, whether a reply plays or
    // not. Only the first moments of a reply are skipped, where its own onset is loudest.
    const voiced = level >= VOICE_LEVEL && (!playing || now - playSince >= BARGE_GUARD_MS)

    if (voiced) {
      if (!heard) {
        heard = true
        // A reply leaves its own audio in the pre-roll: keep only the syllable that woke
        // the detector, so the turn does not drag the reply's voice along with it.
        if (playing) dictation.trim(BARGE_ONSET_S)
        else dictation.begin()
      }
      lastVoice = now
    }

    if (playing && voiced) {
      voiceMs += TICK_MS
      // Only a voice that lasts quiets the reply: a click or a cough is over by then, and
      // the reply stays audible instead of dipping at every noise.
      if (!ducked && voiceMs >= BARGE_DUCK_MS) {
        ducked = true
        speech.duck()
      }
    } else if (ducked && now - lastVoice > BARGE_RESTORE_MS) {
      // The voice stopped: the reply returns to its volume right away.
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
      playSince = 0
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
