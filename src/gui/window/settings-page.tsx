import { SettingsPage, Style } from "@opencode/plugin/gui"
import type { Ctx } from "../context"
import { SETTINGS_PAGE } from "../settings-route"
import { VoiceSettings } from "../settings"

/**
 * Styles for the parts the settings page builds itself: the search picker trigger, the
 * pill tabs and the experimental hint. They use the app's tokens so they follow the
 * theme, with a neutral fallback when a token is missing.
 */
const SETTINGS_STYLE = `
.opencode-voice-search, .opencode-voice-search input { width: 100%; box-sizing: border-box; }
.opencode-voice-trigger { background: transparent; border-radius: 4px; }
.opencode-voice-trigger:hover { background: rgba(128, 128, 128, 0.12); }
.opencode-voice-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px 8px;
  position: relative;
  margin-top: 4px;
}
.opencode-voice-tabs::before {
  content: "";
  position: absolute;
  inset-inline-start: -8px;
  inset-inline-end: 0;
  bottom: 0;
  height: 1px;
  background: var(--v2-border-border-base, rgba(128, 128, 128, 0.25));
}
.opencode-voice-tab {
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 0.5px solid transparent;
  background: transparent;
  color: var(--v2-text-text-muted, inherit);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.opencode-voice-tab:hover {
  background: var(--v2-background-bg-layer-03, rgba(128, 128, 128, 0.12));
  color: var(--v2-text-text-base, inherit);
}
.opencode-voice-tab[aria-selected="true"] {
  background: var(--v2-background-bg-layer-03, rgba(128, 128, 128, 0.12));
  border-color: var(--v2-border-border-muted, rgba(128, 128, 128, 0.35));
  color: var(--v2-text-text-base, inherit);
}
.opencode-voice-tab:focus-visible {
  outline: 2px solid var(--v2-border-border-focus, #4b8bf5);
  outline-offset: 1px;
}
.opencode-voice-hint {
  margin: 8px 2px 0;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--v2-text-text-muted, inherit);
}`

/** Settings > Voice: engines, endpoints, keys, defaults and a test button. */
export function registerSettingsPage(ctx: Ctx) {
  ctx.add(Style, SETTINGS_STYLE)

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
        {
          id: "voice-conversation-default",
          title: ctx.t("settings.section.conversation"),
          description: ctx.t("settings.conversation.default.description"),
          keywords: "conversation hands-free experimental conversacion manos libres",
        },
      ]
    },
    render: () => <VoiceSettings />,
  })
}
