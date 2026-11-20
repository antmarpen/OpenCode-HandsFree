import { errorForLog } from "./errors"
import type { Credentials } from "./credentials"
import type { Log } from "./log"
import type { Runner } from "./runner"
import { speakCloud } from "./speech-cloud"
import { speakLocal } from "./speech-local"
import { safeURL } from "./urls"

export interface SpeechRequest {
  readonly text: string
  /** Dedupe key shared by every window, e.g. `<sessionID>:<messageID>:<ordinal>:<chunk>`. */
  readonly id: string
  readonly engine: "local" | "cloud"
  readonly providerID?: string
  readonly local: { readonly voice: string; readonly rate: number }
  readonly cloud: {
    readonly url: string
    readonly model: string
    readonly voice: string
    readonly format: string
  }
}

/** Synthesized audio for one chunk, ready for a window to play. */
export interface Spoken {
  /** Base64-encoded audio; empty when there was nothing to say. */
  readonly audio: string
  readonly mime: string
}

export type Speaker = (input: SpeechRequest, signal?: AbortSignal) => Promise<Spoken>

const SILENT: Spoken = { audio: "", mime: "" }

/** How many event ids to remember for cross-window deduplication. */
const REMEMBERED = 400

/**
 * Synthesizes speech but does not play it: the window plays the bytes so the user can
 * choose the output device, which the main process cannot address.
 */
export function createSpeaker(credentials: Credentials, runner: Runner, log: Log): Speaker {
  const seen = new Set<string>()
  const order: string[] = []

  const remember = (id: string): boolean => {
    if (!id) return true
    if (seen.has(id)) return false

    seen.add(id)
    order.push(id)
    if (order.length > REMEMBERED) {
      const oldest = order.shift()
      if (oldest) seen.delete(oldest)
    }
    return true
  }

  return async (input, signal) => {
    if (!input.text.trim()) return SILENT
    if (!remember(input.id)) return SILENT

    try {
      if (input.engine === "local") {
        const bytes = await speakLocal(
          { text: input.text, voice: input.local.voice, rate: input.local.rate },
          runner,
        )
        return { audio: Buffer.from(bytes).toString("base64"), mime: "audio/wav" }
      }

      const resolved = await credentials.resolve("speak", input.providerID)
      if (!resolved.key) throw new Error("The selected provider has no usable credential")

      const url = resolved.baseURL || input.cloud.url
      log.write("info", "voice: speaking", { provider: input.providerID ?? "manual", url: safeURL(url) })

      const spoken = await speakCloud(
        {
          text: input.text,
          url,
          model: input.cloud.model,
          voice: input.cloud.voice,
          format: input.cloud.format,
        },
        resolved.key,
        signal,
      )

      return { audio: Buffer.from(spoken.bytes).toString("base64"), mime: spoken.mime }
    } catch (error) {
      log.write("error", "voice: speech failed", {
        engine: input.engine,
        provider: input.providerID ?? "manual",
        error: errorForLog(error),
      })
      throw error
    }
  }
}
