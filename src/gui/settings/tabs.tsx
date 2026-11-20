import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition"

export type VoiceTab = "input" | "output" | "experimental"

interface Tab {
  readonly id: VoiceTab
  readonly label: string
}

/**
 * Pill tabs at the top of the settings page, styled like the app's own sub-tabs so the
 * page does not grow into one long scroll.
 */
export function VoiceTabs(props: { readonly value: VoiceTab; onChange(tab: VoiceTab): void }) {
  const ctx = usePlugin<typeof definition>()

  const tabs: readonly Tab[] = [
    { id: "input", label: ctx.t("settings.tab.input") },
    { id: "output", label: ctx.t("settings.tab.output") },
    { id: "experimental", label: ctx.t("settings.tab.experimental") },
  ]

  return (
    <div class="opencode-voice-tabs" role="tablist" aria-label={ctx.t("settings.title")}>
      {tabs.map((tab) => (
        <button
          type="button"
          id={`voice-tab-${tab.id}`}
          role="tab"
          aria-selected={props.value === tab.id}
          aria-controls={`voice-panel-${tab.id}`}
          class="opencode-voice-tab"
          onClick={() => props.onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
