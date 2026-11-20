import { errorMessage } from "./errors"
import type { Credentials } from "./credentials"
import type { Log } from "./log"
import { transcribeCloud } from "./transcribe-cloud"
import { transcribeLocal } from "./transcribe-local"

export interface TranscriptionRequest {
  readonly audio: string
  readonly engine: "local" | "cloud"
  readonly language: string
  readonly providerID?: string
  readonly local: { readonly binary: string; readonly model: string }
  readonly cloud: { readonly url: string; readonly model: string }
}

export type Transcriber = (
  input: TranscriptionRequest,
  signal?: AbortSignal,
) => Promise<{ text: string }>

export function createTranscriber(credentials: Credentials, log: Log): Transcriber {
  return async (input, signal) => {
    const audio = new Uint8Array(Buffer.from(input.audio, "base64"))
    if (audio.byteLength === 0) throw new Error("The recording is empty")

    // 16 kHz mono 16-bit after the recorder's conversion, minus the WAV header.
    log.write("info", "voice: clip", { seconds: Math.max(0, (audio.byteLength - 44) / 32_000) })

    try {
      let text: string
      if (input.engine === "local") {
        text = await transcribeLocal(
          audio,
          {
            binary: input.local.binary,
            model: input.local.model,
            language: input.language,
          },
          signal,
        )
      } else {
        const resolved = await credentials.resolve("transcribe", input.providerID)
        if (!resolved.key) throw new Error("The selected provider has no usable credential")

        const url = resolved.baseURL || input.cloud.url
        log.write("info", "voice: transcribing", {
          provider: input.providerID ?? "manual",
          url,
        })

        text = await transcribeCloud(
          audio,
          {
            url,
            model: input.cloud.model,
            language: input.language,
          },
          resolved.key,
          signal,
        )
      }

      return { text }
    } catch (error) {
      if (!signal?.aborted) {
        log.write("error", "voice: transcription failed", {
          engine: input.engine,
          provider: input.providerID ?? "manual",
          error: errorMessage(error),
        })
      }
      throw error
    }
  }
}
