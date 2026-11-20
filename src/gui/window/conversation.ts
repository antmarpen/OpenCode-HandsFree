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
 * While a reply is read, the microphone also hears it, so ask for a little more level
 * than a normal turn. Any longer window is felt as a lag before the reply stops.
 */
const BARGE_LEVEL = 0.26
const BARGE_MS = 80
/** The first moments of a reply are its own onset reaching the microphone. */
const BARGE_GUARD_MS = 250
/** Audio kept before the detected onset, so the first syllable keeps its attack. */
const BARGE_MARGIN_S = 0.35
/**
 * Shortest turn a barge may keep. Words like "dromedario" open with a soft consonant the
 * level only notices at the vowel, so the clip has to reach back into the syllable.
 */
const BARGE_MIN_S = 0.9

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
  let bargeSince = 0
  let suspended = false
  let wasPlaying = false
  /** When the reply being read started playing, so its own onset is not a barge. */
  let playSince = 0
  /** First moment of this playback where the microphone went over the voice level. */
  let voiceSince = 0
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

  const start = () => {
    if (!modeOn() || !ready() || running()) return

    // Pressing the pill is the user's turn: stop whatever was being read.
    speech.cancel()
    void ctx.main(Voice).stop().catch(() => {})

    runOwner = routed()?.key
    owner = undefined
    heard = false
    bargeSince = 0
    voiceSince = 0
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
    bargeSince = 0
    voiceSince = 0
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

    // A reply leaves its own audio in the pre-roll; drop it as soon as the audio ends.
    if (wasPlaying && !playing) {
      dictation.reset()
      voiceSince = 0
    }
    if (playing && !wasPlaying) {
      playSince = now
      voiceSince = 0
    }
    wasPlaying = playing

    const level = dictation.levels().at(-1) ?? 0

    if (level >= (playing ? BARGE_LEVEL : VOICE_LEVEL)) {
      if (playing) {
        // Ignore the beginning of the reply, where its own onset is the loudest.
        if (now - playSince >= BARGE_GUARD_MS) {
          if (!voiceSince) voiceSince = now
          if (!bargeSince) bargeSince = now
          if (now - bargeSince >= BARGE_MS) {
            // Talking over the reply cuts it and starts the turn at the syllable that
            // triggered the barge: the reply's own tail is dropped, the first word stays.
            speech.cancel()
            void ctx.main(Voice).stop().catch(() => {})
            dictation.trim(Math.max(BARGE_MIN_S, (now - voiceSince) / 1000 + BARGE_MARGIN_S))
            heard = true
            lastVoice = now
            bargeSince = 0
            playSince = 0
            voiceSince = 0
            // The utterance just started must not be dropped as leftover reply audio.
            wasPlaying = false
          }
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
