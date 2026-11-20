import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition"
import { InputSection } from "./settings/input-section"
import { OutputSection } from "./settings/output-section"
import { useSecrets } from "./settings/secrets"

/** Settings > Voice: the two sections share the API key drafts. */
export function VoiceSettings() {
  const ctx = usePlugin<typeof definition>()
  const secrets = useSecrets()

  return (
    <ctx.ui.SettingsLayout title={ctx.t("settings.title")} description={ctx.t("settings.description")}>
      <InputSection secrets={secrets} />
      <OutputSection secrets={secrets} />
    </ctx.ui.SettingsLayout>
  )
}
