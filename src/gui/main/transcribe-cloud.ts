import { endpoint } from "./urls"

export interface CloudTranscription {
  readonly url: string
  readonly model: string
  readonly language: string
}

/** Multipart request to an OpenAI-compatible `/audio/transcriptions` endpoint. */
export async function transcribeCloud(
  audio: Uint8Array,
  input: CloudTranscription,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!input.url) throw new Error("The provider base URL is not configured")

  const form = new FormData()
  form.append("file", new Blob([audio.slice()], { type: "audio/wav" }), "audio.wav")
  form.append("model", input.model || "whisper-1")
  if (input.language && input.language !== "auto") form.append("language", input.language)

  const response = await fetch(endpoint(input.url, "audio/transcriptions"), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
  }

  const result = (await response.json()) as { text?: string }
  return (result.text ?? "").trim()
}
