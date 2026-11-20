import { endpoint } from "./urls"

export interface CloudSpeech {
  readonly text: string
  readonly url: string
  readonly model: string
  readonly voice: string
  readonly format: string
}

export interface CloudAudio {
  readonly bytes: Uint8Array
  readonly mime: string
}

const MIME: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  pcm: "audio/L16",
}

/** Requests speech from an OpenAI-compatible `/audio/speech` endpoint. */
export async function speakCloud(
  input: CloudSpeech,
  apiKey: string,
  signal?: AbortSignal,
): Promise<CloudAudio> {
  if (!input.url) throw new Error("The provider base URL is not configured")

  const format = (input.format || "wav").replace(/^\./, "")

  const response = await fetch(endpoint(input.url, "audio/speech"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model || "tts-1",
      input: input.text,
      voice: input.voice || "alloy",
      response_format: format,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) throw new Error("The provider returned no audio")

  const type = response.headers.get("content-type")?.split(";")[0]?.trim()

  // Some providers answer 200 with a JSON or text body; say so instead of failing to play it.
  if (type === "application/json" || type?.startsWith("text/")) {
    throw new Error(`The provider returned ${type}: ${new TextDecoder().decode(bytes).slice(0, 300)}`)
  }

  const mime = type?.startsWith("audio/") ? type : (MIME[format] ?? "audio/mpeg")

  return { bytes, mime }
}
