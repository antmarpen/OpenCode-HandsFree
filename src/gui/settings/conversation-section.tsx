import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition"
import { NumberRow, SwitchRow } from "./rows"

/** Experimental conversation settings: the hands-free loop and its timings. */
export function ConversationSection() {
  const ctx = usePlugin<typeof definition>()
  const settings = () => ctx.stores.settings.value

  return (
    <ctx.ui.SettingsSection
      title={ctx.t("settings.section.conversation")}
      footer={<p class="opencode-handsfree-hint">{ctx.t("settings.conversation.hint")}</p>}
    >
      <SwitchRow
        id="voice-conversation-default"
        title={ctx.t("settings.conversation.default")}
        description={ctx.t("settings.conversation.default.description")}
        checked={settings().conversation.default}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.conversation.default = value
          })
        }
      />
      <NumberRow
        id="voice-conversation-silence"
        title={ctx.t("settings.conversation.silence")}
        description={ctx.t("settings.conversation.silence.description")}
        value={settings().conversation.silenceMs}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.conversation.silenceMs = value
          })
        }
      />
      <SwitchRow
        id="voice-conversation-blur"
        title={ctx.t("settings.conversation.blur")}
        description={ctx.t("settings.conversation.blur.description")}
        checked={settings().conversation.suspendOnBlur}
        onChange={(value) =>
          ctx.stores.settings.update((draft) => {
            draft.conversation.suspendOnBlur = value
          })
        }
      />
    </ctx.ui.SettingsSection>
  )
}
