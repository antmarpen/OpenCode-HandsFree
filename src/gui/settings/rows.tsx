import { createSignal, Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition"

export interface EngineOption {
  readonly value: "local" | "cloud"
  readonly label: string
}

interface RowProps {
  readonly id: string
  readonly title: string
  readonly description?: string
}

const inlineControls = { display: "flex", gap: "8px", "align-items": "center" } as const

/** A labelled text field, either plain or masked for secrets. */
export function TextRow(
  props: RowProps & {
    readonly value: string
    readonly placeholder?: string
    readonly type?: "text" | "password" | "url"
    onChange(value: string): void
  },
) {
  const ctx = usePlugin<typeof definition>()
  return (
    <ctx.ui.SettingsRow id={props.id} title={props.title} description={props.description}>
      <ctx.ui.TextInput
        label={props.title}
        type={props.type}
        placeholder={props.placeholder}
        value={props.value}
        onInput={props.onChange}
      />
    </ctx.ui.SettingsRow>
  )
}

/**
 * A numeric field that keeps the raw text while the user types, so partial input such
 * as "0." or "-" is not rewritten, and reports only parseable values.
 */
export function NumberRow(
  props: RowProps & {
    readonly value: number
    readonly placeholder?: string
    onChange(value: number): void
  },
) {
  const ctx = usePlugin<typeof definition>()
  const [text, setText] = createSignal(String(props.value))

  return (
    <ctx.ui.SettingsRow id={props.id} title={props.title} description={props.description}>
      <ctx.ui.TextInput
        label={props.title}
        placeholder={props.placeholder}
        value={text()}
        onInput={(value) => {
          setText(value)
          const parsed = Number.parseFloat(value.replace(",", "."))
          if (Number.isFinite(parsed)) props.onChange(parsed)
        }}
      />
    </ctx.ui.SettingsRow>
  )
}

/** A labelled on/off switch. */
export function SwitchRow(
  props: RowProps & {
    readonly checked: boolean
    onChange(value: boolean): void
  },
) {
  const ctx = usePlugin<typeof definition>()
  return (
    <ctx.ui.SettingsRow id={props.id} title={props.title} description={props.description}>
      <ctx.ui.Switch
        label={props.title}
        hideLabel
        checked={props.checked}
        onChange={props.onChange}
      />
    </ctx.ui.SettingsRow>
  )
}

/** Local or cloud for one direction. */
export function EngineRow(
  props: RowProps & {
    readonly value: "local" | "cloud"
    readonly options: EngineOption[]
    onChange(value: "local" | "cloud"): void
  },
) {
  const ctx = usePlugin<typeof definition>()
  return (
    <ctx.ui.SettingsRow id={props.id} title={props.title} description={props.description}>
      <ctx.ui.Select
        label={props.title}
        value={props.value}
        options={props.options}
        onChange={props.onChange}
      />
    </ctx.ui.SettingsRow>
  )
}

/** A masked API key field with its configured state and save/remove actions. */
export function SecretRow(
  props: RowProps & {
    readonly configured: boolean
    readonly value: string
    onChange(value: string): void
    onSave(): void
    onRemove(): void
  },
) {
  const ctx = usePlugin<typeof definition>()
  const status = () =>
    props.configured ? ctx.t("settings.keySet") : ctx.t("settings.keyMissing")
  const description = () => (props.description ? `${props.description} · ` : "")

  return (
    <ctx.ui.SettingsRow
      id={props.id}
      title={props.title}
      description={
        <>
          {description()}
          {status()}
        </>
      }
    >
      <div style={{ ...inlineControls, width: "100%", "min-width": 0 }}>
        <div style={{ flex: "1 1 auto", "min-width": 0 }}>
          <ctx.ui.TextInput
            label={props.title}
            type="password"
            placeholder="sk-..."
            value={props.value}
            onInput={props.onChange}
          />
        </div>
        <ctx.ui.Tooltip value={ctx.t("settings.save")}>
          <ctx.ui.IconButton
            icon="check"
            label={ctx.t("settings.save")}
            size="small"
            variant="neutral"
            onClick={props.onSave}
          />
        </ctx.ui.Tooltip>
        <Show when={props.configured}>
          <ctx.ui.Tooltip value={ctx.t("settings.remove")}>
            <ctx.ui.IconButton
              icon="trash"
              label={ctx.t("settings.remove")}
              size="small"
              variant="ghost"
              onClick={props.onRemove}
            />
          </ctx.ui.Tooltip>
        </Show>
      </div>
    </ctx.ui.SettingsRow>
  )
}
