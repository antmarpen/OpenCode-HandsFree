import { SettingsPage, Style } from "@opencode/plugin/gui"
import type { Ctx } from "../context"
import { SETTINGS_PAGE } from "../settings-route"
import { VoiceSettings } from "../settings"

/** Settings > Voice: engines, endpoints, keys, defaults and a test button. */
export function registerSettingsPage(ctx: Ctx) {
  ctx.add(
    Style,
    ".opencode-voice-search, .opencode-voice-search input { width: 100%; box-sizing: border-box; }\n" +
      ".opencode-voice-trigger { background: transparent; border-radius: 4px; }\n" +
      ".opencode-voice-trigger:hover { background: rgba(128, 128, 128, 0.12); }",
  )

  ctx.add(SettingsPage, {
    id: SETTINGS_PAGE,
    icon: "outline-audio",
    get title() {
      return ctx.t("settings.title")
    },
    get entries() {
      return [
        {
          id: "voice-engine-input",
          title: ctx.t("settings.engine"),
          description: ctx.t("settings.section.input"),
          keywords: "voice dictation whisper microphone dictado voz",
        },
        {
          id: "voice-engine-output",
          title: ctx.t("settings.voice"),
          description: ctx.t("settings.section.output"),
          keywords: "voice tts speech read aloud respuestas leer voz",
        },
      ]
    },
    render: () => <VoiceSettings />,
  })
}
