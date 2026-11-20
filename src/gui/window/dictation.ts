import { createEffect, createSignal } from "solid-js"
import type { MountedSession, ToastHandle } from "@opencode/plugin/gui"
import { silentMeter } from "../audio/meter"
import { Voice } from "../contract"
import { readFlags } from "../flags"
import type { Ctx } from "../context"
import { startRecording, type RecordingHandle } from "../recorder"
import type { Deliver } from "./delivery"

export interface Dictation {
  readonly recording: () => boolean
  readonly working: () => boolean
  /** Recording or transcribing: there is something for the user to cancel. */
  readonly active: () => boolean
  /** Recent input levels, oldest first, from 0 to 1; all zero when idle. */
  readonly levels: () => readonly number[]
  toggle(): Promise<void>
  /** Starts recording but keeps only a pre-roll until `begin()` (conversation mode). */
  listen(): Promise<boolean>
  /** Keeps the pre-roll and starts accumulating the utterance. */
  begin(): void
  /** Drops what was captured, such as a reply being played, and holds the pre-roll. */
  reset(): void
  /** Keeps only the last moments of the buffer and starts accumulating from there. */
  trim(seconds: number): void
  cancel(): void
}

/** Recordings shorter than this are treated as accidental taps. */
const MIN_SECONDS = 0.4

export function createDictation(ctx: Ctx, deliver: Deliver, interrupt: () => void): Dictation {
  const [recording, setRecording] = createSignal(false)
  const [working, setWorking] = createSignal(false)
  const [levels, setLevels] = createSignal<readonly number[]>(silentMeter())

  let handle: RecordingHandle | undefined
  let target: MountedSession | undefined
  let toast: ToastHandle | undefined
  /** Aborts the transcription in flight, so Cancel and Escape drop its result. */
  let inFlight: AbortController | undefined
  /** A start is waiting for the microphone; guards the polling driver from starting twice. */
  let starting = false

  const notifyError = (title: string, description?: string) => {
    ctx.toast.show({ title, description, variant: "error" })
  }

  const start = async (hold: boolean, barge = true): Promise<boolean> => {
    if (handle) return false
    if (working()) return false
    // Another start is already waiting for the microphone; treat it as started.
    if (starting) return true

    const session = ctx.sessions.current()
    if (!session) return false

    // The per-chat switch is the gate: off means no dictation at all, from any path.
    if (!readFlags(ctx, session).input) {
      ctx.toast.show({ title: ctx.t("status.inputOff") })
      return false
    }

    const settings = ctx.stores.settings.value
    const localIncomplete =
      !settings.transcribe.localBinary.trim() || !settings.transcribe.localModel.trim()

    if (settings.inputEngine === "local" && localIncomplete) {
      notifyError(ctx.t("status.missingLocal"), ctx.t("status.missingLocal.description"))
      ctx.layout.settings(ctx.id)
      return false
    }

    starting = true

    try {
      if (barge) {
        interrupt()
        await ctx.main(Voice).stop().catch(() => {})
      }

      try {
        handle = await startRecording({
          deviceId: settings.transcribe.inputDevice || undefined,
          hold,
          onLevel: (level) => setLevels((previous) => [...previous.slice(1), level]),
        })
      } catch (error) {
        notifyError(ctx.t("status.micDenied"), String(error))
        return false
      }

      setLevels(silentMeter())
      target = session
      setRecording(true)
      // Conversation mode listens on its own for minutes; the persistent toast is noise there.
      if (!hold) {
        toast = ctx.toast.show({
          title: ctx.t("status.recording"),
          description: ctx.t("status.recordingDetail"),
          persistent: true,
        })
      }
      return true
    } finally {
      starting = false
    }
  }

  const stop = async () => {
    const current = handle
    if (!current) return

    const session = target
    handle = undefined
    setRecording(false)
    setLevels(silentMeter())
    toast?.dismiss()
    toast = undefined
    setWorking(true)
    const controller = new AbortController()
    inFlight = controller

    // In a conversation a cough or a noise is a turn that says nothing, not an error to
    // report: the loop keeps listening and the user never sees a warning per sneeze.
    const quiet = () => !!session && readFlags(ctx, session).conversation

    try {
      const take = await current.stop()
      if (controller.signal.aborted) return
      if (take.seconds < MIN_SECONDS) {
        if (!quiet()) ctx.toast.show({ title: ctx.t("status.noSpeech") })
        return
      }
      if (take.peak < 0.001) {
        if (!quiet()) {
          ctx.toast.show({
            title: ctx.t("status.noMicrophoneAudio"),
            description: ctx.t("status.noMicrophoneAudio.description"),
          })
        }
        return
      }

      const settings = ctx.stores.settings.value
      const result = await ctx.main(Voice).transcribe(
        {
          audio: take.audio,
          engine: settings.inputEngine,
          language: settings.transcribe.language,
          providerID: settings.transcribe.provider || undefined,
          local: {
            binary: settings.transcribe.localBinary.trim(),
            model: settings.transcribe.localModel.trim(),
          },
          cloud: {
            url: settings.transcribe.cloudURL,
            model: settings.transcribe.cloudModel,
          },
        },
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return

      const text = result.text.trim()
      if (!text) {
        if (!quiet()) ctx.toast.show({ title: ctx.t("status.noSpeech") })
        return
      }
      if (session) {
        // Sending must not hold the microphone: the prompt call can wait for the agent's
        // whole turn, and conversation mode has to listen again as soon as it is sent.
        void deliver(session, text, { send: readFlags(ctx, session).conversation }).catch((error) =>
          notifyError(ctx.t("status.sendFailed"), String(error)),
        )
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (quiet()) console.warn("voice: turn failed", String(error))
        else notifyError(ctx.t("status.transcribeFailed"), String(error))
      }
    } finally {
      if (inFlight === controller) inFlight = undefined
      setWorking(false)
    }
  }

  const cancel = () => {
    inFlight?.abort()
    inFlight = undefined
    handle?.cancel()
    handle = undefined
    toast?.dismiss()
    toast = undefined
    setRecording(false)
    setWorking(false)
    setLevels(silentMeter())
  }

  // Switching dictation off in the chat also stops what it already started.
  createEffect(() => {
    const session = target
    const active = recording() || working()
    if (!session || !active) return
    if (readFlags(ctx, session).input) return
    cancel()
  })

  return {
    recording,
    working,
    active: () => recording() || working(),
    levels,
    toggle: async () => {
      if (handle) await stop()
      else await start(false)
    },
    listen: () => (handle ? Promise.resolve(false) : start(true, false)),
    begin: () => handle?.begin(),
    reset: () => handle?.reset(),
    trim: (seconds) => handle?.trim(seconds),
    cancel,
  }
}
