import { createSignal } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import { Voice } from "../contract"
import type { Ctx } from "../context"
import type { definition } from "../definition"
import { chunk, plainText } from "../text"
import { createPlayer } from "./player"

export type Speak = (text: string, id: string) => Promise<void>

export interface Speech {
  readonly speak: Speak
  /** True while a reply is being synthesized or played, for the stop pill. */
  readonly speaking: () => boolean
  cancel(): void
}

/** Characters per spoken chunk: short enough to stop quickly, long enough to sound natural. */
const CHUNK_SIZE = 600

/**
 * Speaks text chunks one after another. The main process synthesizes each chunk and
 * the window plays it, so the chosen output device applies to both engines. Blocks
 * from different assistant messages are queued instead of talking over each other.
 */
export function createSpeech(ctx: Ctx): Speech {
  const [speaking, setSpeaking] = createSignal(false)
  const player = createPlayer()

  let generation = 0
  let queue: Promise<void> = Promise.resolve()
  let lastError = ""

  const perform = async (text: string, id: string, ticket: number) => {
    const clean = plainText(text)
    if (!clean) return

    setSpeaking(true)
    try {
      for (const [index, part] of chunk(clean, CHUNK_SIZE).entries()) {
        if (ticket !== generation) return

        const settings = ctx.stores.settings.value
        const spoken = await ctx.main(Voice).speak({
          text: part,
          id: `${id}:${index}`,
          engine: settings.outputEngine,
          providerID: settings.speak.provider || undefined,
          local: {
            voice: settings.speak.localVoice,
            rate: settings.speak.localRate,
          },
          cloud: {
            url: settings.speak.cloudURL,
            model: settings.speak.cloudModel,
            voice: settings.speak.cloudVoice,
            format: settings.speak.format,
          },
        })

        if (ticket !== generation) return
        if (!spoken.audio) return

        await player.play(spoken.audio, spoken.mime, settings.speak.outputDevice)
      }
    } catch (error) {
      if (ticket !== generation) return

      const failure = String(error)
      if (failure === lastError) return
      lastError = failure
      ctx.toast.show({ title: ctx.t("status.speakFailed"), description: failure, variant: "error" })
    } finally {
      if (ticket === generation) setSpeaking(false)
    }
  }

  const speak: Speak = (text, id) => {
    const ticket = generation
    const job = queue.then(() => (ticket === generation ? perform(text, id, ticket) : undefined))
    queue = job.catch(() => {})
    return job
  }

  const cancel = () => {
    generation++
    queue = Promise.resolve()
    lastError = ""
    player.stop()
    setSpeaking(false)
  }

  return { speak, speaking, cancel }
}

let shared: Speech | undefined

/** One speech queue per window, shared by replies, the stop pill and the test button. */
export function getSpeech(ctx: Ctx): Speech {
  shared ??= createSpeech(ctx)
  return shared
}

/** The same queue, read from a settings component. */
export function useSpeech(): Speech {
  return getSpeech(usePlugin<typeof definition>())
}
