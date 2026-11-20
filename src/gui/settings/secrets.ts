import { createSignal } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import { Voice, type VoiceSlot } from "../contract"
import type { Ctx } from "../context"
import type { definition } from "../definition"

const SLOTS: readonly VoiceSlot[] = ["transcribe", "speak"]

type Values = Record<VoiceSlot, string>
type Presence = Record<VoiceSlot, boolean>

const EMPTY_VALUES: Values = { transcribe: "", speak: "" }
const NO_SECRETS: Presence = { transcribe: false, speak: false }

/** Draft values and presence for the two API keys. */
export interface SecretState {
  value(slot: VoiceSlot): string
  configured(slot: VoiceSlot): boolean
  setValue(slot: VoiceSlot, value: string): void
  save(slot: VoiceSlot): void
  remove(slot: VoiceSlot): void
  refresh(): void
}

/**
 * One shared state per window: the settings page edits it and the header control
 * reads it to decide whether the plugin has a usable provider.
 */
export function createSecretState(ctx: Ctx): SecretState {
  const [values, setValues] = createSignal<Values>(EMPTY_VALUES)
  const [configured, setConfigured] = createSignal<Presence>(NO_SECRETS)

  const probe = async (slot: VoiceSlot) => {
    try {
      return await ctx.main(Voice).hasSecret({ slot })
    } catch {
      return false
    }
  }

  const refreshOne = async (slot: VoiceSlot) => {
    const present = await probe(slot)
    setConfigured((current) => ({ ...current, [slot]: present }))
  }

  const refresh = () => {
    for (const slot of SLOTS) void refreshOne(slot)
  }

  const setValue = (slot: VoiceSlot, value: string) =>
    setValues((current) => ({ ...current, [slot]: value }))

  const write = async (slot: VoiceSlot, value: string) => {
    try {
      await ctx.main(Voice).setSecret({ slot, value })
      await refreshOne(slot)
      setValue(slot, "")
      ctx.toast.show({ title: ctx.t("settings.saved"), variant: "success" })
    } catch (error) {
      ctx.toast.show({
        title: ctx.t("settings.saveFailed"),
        description: String(error),
        variant: "error",
      })
    }
  }

  void refresh()

  return {
    value: (slot) => values()[slot],
    configured: (slot) => configured()[slot],
    setValue,
    save: (slot) => void write(slot, values()[slot]),
    remove: (slot) => void write(slot, ""),
    refresh,
  }
}

let shared: SecretState | undefined

export function getSecretState(ctx: Ctx): SecretState {
  shared ??= createSecretState(ctx)
  return shared
}

/** The same shared state, read from a settings component. */
export function useSecrets(): SecretState {
  return getSecretState(usePlugin<typeof definition>())
}
