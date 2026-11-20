import { createEffect, createSignal, For, on, onMount, Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { Ctx } from "../context"
import type { definition } from "../definition"

export interface SearchOption {
  readonly value: string
  readonly label: string
}

/**
 * Labels already seen for each row and value. The settings page remounts every time it
 * opens, and the trigger must show the friendly name before the list loads again.
 */
const knownLabels = new Map<string, string>()

const labelKey = (row: string, value: string) => `${row}\u0000${value}`

/**
 * A select-like trigger with a searchable dialog. The row never shows a text field:
 * clicking the trigger loads the options and opens the picker. Manual ids are only
 * offered inside the dialog when the provider returns no models at all.
 */
export function SearchSelect(props: {
  readonly label: string
  readonly value?: string
  readonly placeholder?: string
  readonly loadLabel: string
  readonly emptyLabel?: string
  load(): Promise<readonly SearchOption[]>
  /** When this changes, the cached list is dropped so the next open reloads it. */
  readonly resetKey?: string
  /**
   * Load the list on mount, so the trigger can show the saved label instead of its
   * raw id. Only for cheap local lists, such as audio devices.
   */
  readonly eager?: boolean
  onChange(value: string): void
}) {
  const ctx = usePlugin<typeof definition>()

  const [options, setOptions] = createSignal<SearchOption[]>([])
  const [loading, setLoading] = createSignal(false)
  const [loaded, setLoaded] = createSignal(false)
  let scope = 0

  const reset = () => {
    scope++
    setOptions([])
    setLoaded(false)
    setLoading(false)
  }

  createEffect(on(() => props.resetKey, reset, { defer: true }))

  onMount(() => {
    if (props.eager) void ensure()
  })

  const selected = () => {
    const value = props.value
    if (!value) return undefined

    const match = options().find((option) => option.value === value)
    return match?.label ?? knownLabels.get(labelKey(props.label, value)) ?? value
  }

  const ensure = async (force = false) => {
    if (loading()) return
    if (loaded() && !force) return

    const current = scope
    setLoading(true)
    try {
      const result = [...(await props.load())]
      if (current !== scope) return
      for (const option of result) knownLabels.set(labelKey(props.label, option.value), option.label)
      setOptions(result)
      setLoaded(true)
    } catch (error) {
      if (current !== scope) return
      const message = String(error)
      const stale = /does not exist|not found|no such method|unknown method/i.test(message)
      console.error("voice: could not load options", error)
      ctx.toast.show({
        title: ctx.t(stale ? "status.staleMain" : "status.listFailed"),
        description: stale ? undefined : message,
        variant: "error",
      })
    } finally {
      if (current === scope) setLoading(false)
    }
  }

  const open = () => {
    ctx.dialogs.open((dialog) => (
      <Picker
        label={props.label}
        loadLabel={props.loadLabel}
        emptyLabel={props.emptyLabel}
        options={options}
        loading={loading}
        value={props.value}
        onRefresh={() => void ensure(true)}
        onPick={(value) => {
          props.onChange(value)
          dialog.close()
        }}
        onClose={dialog.close}
      />
    ))
    void ensure()
  }

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={open}
      class="opencode-voice-trigger"
      style={triggerStyle()}
    >
      <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
        {selected() ?? props.placeholder ?? props.label}
      </span>
      <ctx.ui.Icon name="chevron-down" size="small" />
    </button>
  )
}

function Picker(props: {
  readonly label: string
  readonly loadLabel: string
  readonly emptyLabel?: string
  readonly options: () => readonly SearchOption[]
  readonly loading: () => boolean
  readonly value?: string
  onRefresh(): void
  onPick(value: string): void
  onClose(): void
}) {
  const ctx = usePlugin<typeof definition>()
  const [query, setQuery] = createSignal("")

  const filtered = () => {
    const term = query().trim().toLowerCase()
    if (!term) return props.options()
    return props.options().filter(
      (option) =>
        option.label.toLowerCase().includes(term) || option.value.toLowerCase().includes(term),
    )
  }

  const pickFirst = () => {
    const first = filtered()[0]
    if (first) props.onPick(first.value)
  }

  return (
    <ctx.ui.Dialog
      title={props.label}
      size="fit"
      footer={
        <ctx.ui.Button variant="neutral" onClick={props.onClose}>
          {ctx.t("settings.close")}
        </ctx.ui.Button>
      }
    >
      <div style={{ display: "flex", "flex-direction": "column", "min-height": 0, padding: "6px 2px 0" }}>
        <div style={{ display: "flex", gap: "6px", "align-items": "center", width: "100%" }}>
          <div style={{ flex: "1 1 auto", "min-width": 0 }}>
            <Show when={props.options().length > 0}>
              <ctx.ui.TextInput
                label={ctx.t("settings.search")}
                placeholder={ctx.t("settings.search")}
                value={query()}
                onInput={setQuery}
                onSubmit={pickFirst}
                autofocus
                class="opencode-voice-search"
              />
            </Show>
          </div>

          <ctx.ui.Tooltip value={props.loadLabel}>
            <ctx.ui.IconButton
              icon="refresh"
              label={props.loadLabel}
              size="small"
              variant="neutral"
              busy={props.loading()}
              onClick={props.onRefresh}
            />
          </ctx.ui.Tooltip>
        </div>

        <Show
          when={props.options().length > 0}
          fallback={
            <Show
              when={props.loading()}
              fallback={
                <div style={{ padding: "18px 0", opacity: 0.7 }}>
                  {props.emptyLabel ?? ctx.t("settings.noModels")}
                </div>
              }
            >
              <div style={{ padding: "20px 0", display: "flex", "justify-content": "center" }}>
                <ctx.ui.Loader size="small" />
              </div>
            </Show>
          }
        >
          <div
            role="listbox"
            style={{
              "max-height": "min(320px, 42vh)",
              "overflow-y": "auto",
              "margin-top": "10px",
              display: "flex",
              "flex-direction": "column",
              gap: "2px",
            }}
          >
          <Show
            when={filtered().length > 0}
            fallback={
              <span style={{ opacity: 0.6, padding: "6px 8px" }}>{ctx.t("settings.noMatches")}</span>
            }
          >
            <For each={filtered()}>
              {(option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === props.value}
                  onClick={() => props.onPick(option.value)}
                  style={optionStyle(ctx, option.value === props.value)}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                    }}
                  >
                    {option.label}
                  </span>
                  <Show when={option.value === props.value}>
                    <ctx.ui.Icon name="check" size="small" />
                  </Show>
                </button>
              )}
            </For>
          </Show>
        </div>
      </Show>
      </div>
    </ctx.ui.Dialog>
  )
}

function triggerStyle() {
  return {
    display: "inline-flex",
    "align-items": "center",
    gap: "4px",
    width: "auto",
    "max-width": "100%",
    "min-width": 0,
    padding: "2px 4px",
    border: "0",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    "text-align": "left",
  } as const
}

function optionStyle(ctx: Ctx, selected: boolean) {
  const dark = ctx.appearance.mode() === "dark"
  return {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "8px",
    width: "100%",
    padding: "7px 10px",
    background: selected
      ? dark
        ? "rgba(255, 255, 255, 0.08)"
        : "rgba(0, 0, 0, 0.06)"
      : "transparent",
    border: "0",
    "border-radius": "6px",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
    "text-align": "left",
  } as const
}
