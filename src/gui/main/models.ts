import type { VoiceSlot } from "../contract"
import type { Credentials } from "./credentials"
import { endpoint } from "./urls"

export interface ModelInfo {
  readonly id: string
  readonly name?: string
}

export interface ModelRequest {
  readonly slot: VoiceSlot
  readonly url: string
  readonly providerID?: string
}

export type ModelLister = (input: ModelRequest) => Promise<{ models: ModelInfo[] }>

interface PayloadModel {
  readonly id?: unknown
  readonly name?: unknown
  readonly display_name?: unknown
}

/** `/models` has no capabilities, so the obvious audio families are listed first. */
const PATTERNS: Record<VoiceSlot, RegExp> = {
  transcribe: /whisper|transcrib|speech-to-text|\bstt\b/i,
  speak: /tts|text-to-speech|\baudio\b|\bvoice\b|\bspeech\b/i,
}

/** Lists every model, with the likely audio models first, keeping friendly names. */
export function createModelLister(credentials: Credentials): ModelLister {
  return async (input) => {
    const resolved = await credentials.resolve(input.slot, input.providerID)
    if (!resolved.key) {
      throw new Error(
        "No credentials: select an OpenCode provider with an active connection, or save an API key.",
      )
    }

    const url = resolved.baseURL || input.url
    if (!url) throw new Error("The provider base URL is not configured")

    const response = await fetch(endpoint(url, "models"), {
      headers: { Authorization: `Bearer ${resolved.key}` },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`)
    }

    const payload = (await response.json()) as { data?: PayloadModel[] }
    const byID = new Map<string, ModelInfo>()

    for (const item of payload.data ?? []) {
      if (typeof item.id !== "string" || !item.id) continue
      const name =
        typeof item.name === "string"
          ? item.name
          : typeof item.display_name === "string"
            ? item.display_name
            : undefined
      byID.set(item.id, name ? { id: item.id, name } : { id: item.id })
    }

    const pattern = PATTERNS[input.slot]
    const likely = (model: ModelInfo) =>
      pattern.test(model.id) || (model.name ? pattern.test(model.name) : false)

    const models = [...byID.values()].sort((a, b) => {
      const rank = Number(likely(b)) - Number(likely(a))
      return rank !== 0 ? rank : a.id.localeCompare(b.id)
    })

    return { models }
  }
}
