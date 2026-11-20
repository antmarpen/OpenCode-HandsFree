import { Show, type JSX } from "solid-js"
import { usePlugin, Slot, type MountedSession } from "@opencode/plugin/gui"
import type { Ctx } from "../context"
import type { definition } from "../definition"
import { readFlags, toggleFlag } from "../flags"
import type { VoiceStatus } from "../status"
import { MicIcon, ReadAloudIcon } from "./icons"
import { VoiceMenu } from "./voice-menu"

const inlineControls = { display: "flex", gap: "2px", "align-items": "center" } as const

/**
 * Controls in the session title row. The gear is always present: it opens the switch
 * popover and the way into the settings page. The quick microphone and speaker toggles
 * only appear when their direction is configured, like the composer pill.
 */
export function registerHeaderControl(ctx: Ctx, status: VoiceStatus) {
  ctx.add(Slot, {
    at: "session.header",
    order: 10,
    render: (input) => <VoiceHeader session={input.session} status={status} />,
  })
}

function VoiceHeader(props: { readonly session: MountedSession; readonly status: VoiceStatus }) {
  const ctx = usePlugin<typeof definition>()
  const flags = () => readFlags(ctx, props.session)

  return (
    <div style={inlineControls}>
      <Show when={props.status.inputReady()}>
        <ToggleButton
          label={ctx.t("pill.input")}
          pressed={flags().input}
          onClick={() => toggleFlag(ctx, props.session, "input")}
        >
          <MicIcon />
        </ToggleButton>
      </Show>

      <Show when={props.status.outputReady()}>
        <ToggleButton
          label={ctx.t("pill.output")}
          pressed={flags().output}
          onClick={() => toggleFlag(ctx, props.session, "output")}
        >
          <ReadAloudIcon />
        </ToggleButton>
      </Show>

      <VoiceMenu session={props.session} status={props.status} />
    </div>
  )
}

/**
 * A toggle with the app's icon-button styling: the host lends its look through the
 * `data-component` attributes, and the SVG replaces the icon the catalog lacks.
 */
function ToggleButton(props: {
  readonly label: string
  readonly pressed: boolean
  readonly children: JSX.Element
  onClick(): void
}) {
  const ctx = usePlugin<typeof definition>()

  return (
    <ctx.ui.Tooltip value={props.label}>
      <button
        type="button"
        data-component="icon-button-v2"
        data-size="small"
        data-variant="ghost"
        data-state={props.pressed ? "pressed" : undefined}
        aria-label={props.label}
        aria-pressed={props.pressed}
        style={props.pressed ? { color: "var(--v2-text-text-accent)" } : undefined}
        onClick={() => props.onClick()}
      >
        {props.children}
      </button>
    </ctx.ui.Tooltip>
  )
}
