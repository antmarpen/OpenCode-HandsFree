import { createEffect, createSignal, on, onCleanup, onMount, Show, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { usePlugin, type MountedSession } from "@opencode/plugin/gui"
import type { definition } from "../definition"
import { readFlags, setFlag } from "../flags"
import { SETTINGS_PAGE } from "../settings-route"
import type { VoiceStatus } from "../status"
import { MicIcon, ReadAloudIcon } from "./icons"

const WIDTH = 280
const GAP = 6
const MARGIN = 8
const Z_INDEX = 1000

interface Position {
  readonly top: number
  readonly left: number
}

/**
 * Gear button with a plugin-owned popover. The host menu entries cannot hold a switch,
 * so this popover renders the app's own `Switch` and aligns it to the right of each row.
 */
export function VoiceMenu(props: { readonly session: MountedSession; readonly status: VoiceStatus }) {
  const ctx = usePlugin<typeof definition>()
  const [open, setOpen] = createSignal(false)
  const [position, setPosition] = createSignal<Position>({ top: 0, left: 0 })

  let trigger: HTMLSpanElement | undefined

  const toggleOpen = () => {
    if (open()) {
      setOpen(false)
      return
    }
    const rect = trigger?.getBoundingClientRect()
    if (rect) {
      setPosition({
        top: rect.bottom + GAP,
        left: Math.max(MARGIN, Math.min(rect.right - WIDTH, window.innerWidth - WIDTH - MARGIN)),
      })
    }
    setOpen(true)
  }

  createEffect(
    on(
      () => props.session.key,
      () => setOpen(false),
      { defer: true },
    ),
  )

  return (
    <>
      <span ref={(element) => (trigger = element)} style={{ display: "inline-flex" }}>
        <ctx.ui.Tooltip value={ctx.t("pill.settings")}>
          <ctx.ui.IconButton
            icon="outline-sliders"
            label={ctx.t("pill.settings")}
            size="small"
            variant="ghost"
            pressed={open()}
            onClick={toggleOpen}
          />
        </ctx.ui.Tooltip>
      </span>

      <Show when={open()}>
        <Portal>
          <VoicePopover
            position={position()}
            session={props.session}
            status={props.status}
            trigger={trigger}
            onClose={() => setOpen(false)}
          />
        </Portal>
      </Show>
    </>
  )
}

function VoicePopover(props: {
  readonly position: Position
  readonly session: MountedSession
  readonly status: VoiceStatus
  readonly trigger?: HTMLElement
  onClose(): void
}) {
  const ctx = usePlugin<typeof definition>()
  const flags = () => readFlags(ctx, props.session)

  let card: HTMLDivElement | undefined

  const palette = () =>
    ctx.appearance.mode() === "dark"
      ? {
          background: "#232323",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          shadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
        }
      : {
          background: "#ffffff",
          border: "1px solid rgba(0, 0, 0, 0.1)",
          shadow: "0 12px 32px rgba(0, 0, 0, 0.16)",
        }

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node | null
    if (!target) return
    if (card?.contains(target) || props.trigger?.contains(target)) return
    props.onClose()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return
    event.stopPropagation()
    props.onClose()
  }

  onMount(() => {
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("resize", props.onClose)
    card?.focus()
  })

  onCleanup(() => {
    document.removeEventListener("pointerdown", onPointerDown, true)
    document.removeEventListener("keydown", onKeyDown, true)
    window.removeEventListener("resize", props.onClose)
  })

  return (
    <div
      ref={(element) => (card = element)}
      role="dialog"
      aria-label={ctx.t("pill.title")}
      tabindex={-1}
      style={{
        position: "fixed",
        top: `${props.position.top}px`,
        left: `${props.position.left}px`,
        width: `${WIDTH}px`,
        padding: "8px",
        "border-radius": "10px",
        "box-sizing": "border-box",
        "z-index": `${Z_INDEX}`,
        outline: "none",
        color: "inherit",
        ...palette(),
      }}
    >
      <SwitchLine
        icon={<MicIcon />}
        label={ctx.t("pill.input")}
        checked={props.status.inputReady() ? flags().input : false}
        disabled={!props.status.inputReady()}
        onChange={(value) => setFlag(ctx, props.session, "input", value)}
      />
      <SwitchLine
        icon={<ReadAloudIcon />}
        label={ctx.t("pill.output")}
        checked={props.status.outputReady() ? flags().output : false}
        disabled={!props.status.outputReady()}
        onChange={(value) => setFlag(ctx, props.session, "output", value)}
      />
      <SwitchLine
        icon={<ctx.ui.Icon name="outline-rotate-clockwise" size="small" />}
        label={ctx.t("pill.conversation")}
        checked={flags().conversation}
        disabled={!props.status.inputReady() || !props.status.outputReady()}
        onChange={(value) => setFlag(ctx, props.session, "conversation", value)}
      />

      <Divider />

      <button
        type="button"
        onClick={() => {
          props.onClose()
          ctx.layout.settings(SETTINGS_PAGE)
        }}
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          width: "100%",
          padding: "6px 8px",
          background: "transparent",
          border: "0",
          "border-radius": "6px",
          color: "inherit",
          cursor: "pointer",
          font: "inherit",
          "text-align": "left",
        }}
      >
        <ctx.ui.Icon name="outline-sliders" size="small" />
        <span>{ctx.t("pill.settings")}</span>
      </button>
    </div>
  )
}

/** One labelled row with its switch pushed to the right edge. */
function SwitchLine(props: {
  readonly icon: JSX.Element
  readonly label: string
  readonly checked: boolean
  readonly disabled?: boolean
  onChange(value: boolean): void
}) {
  const ctx = usePlugin<typeof definition>()

  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        gap: "12px",
        padding: "6px 8px",
      }}
    >
      <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        {props.icon}
        <span>{props.label}</span>
      </span>
      <ctx.ui.Switch
        label={props.label}
        hideLabel
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
      />
    </div>
  )
}

function Divider() {
  return (
    <div
      style={{
        height: "1px",
        margin: "6px 4px",
        background: "rgba(128, 128, 128, 0.25)",
      }}
    />
  )
}
