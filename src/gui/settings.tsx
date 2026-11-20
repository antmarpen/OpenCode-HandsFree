import { createSignal, Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { ConversationSection } from "./settings/conversation-section"
import { InputSection } from "./settings/input-section"
import { OutputSection } from "./settings/output-section"
import { useSecrets } from "./settings/secrets"
import { VoiceTabs, type VoiceTab } from "./settings/tabs"

/** Settings > Voice: input, output and experimental, split into tabs. */
export function VoiceSettings() {
  const ctx = usePlugin<typeof definition>()
  const secrets = useSecrets()
  const [tab, setTab] = createSignal<VoiceTab>("input")

  return (
    <ctx.ui.SettingsLayout title={ctx.t("settings.title")} description={ctx.t("settings.description")}>
      <VoiceTabs value={tab()} onChange={setTab} />
      <div
        role="tabpanel"
        id={`voice-panel-${tab()}`}
        aria-labelledby={`voice-tab-${tab()}`}
      >
        <Show when={tab() === "input"}>
          <InputSection secrets={secrets} />
        </Show>
        <Show when={tab() === "output"}>
          <OutputSection secrets={secrets} />
        </Show>
        <Show when={tab() === "experimental"}>
          <ConversationSection />
        </Show>
      </div>
    </ctx.ui.SettingsLayout>
  )
}
