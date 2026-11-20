import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition"
import { useCloudProviders } from "./providers"

/** The host Select treats "" as no selection, so Manual needs a real value. */
const MANUAL = "__manual__"

/**
 * Picks one of the providers OpenCode already has configured. The provider's own URL
 * and credential are used at request time, so nothing has to be typed again.
 */
export function ProviderRow(props: {
  readonly id: string
  readonly value: string
  onChange(providerID: string, baseURL?: string): void
}) {
  const ctx = usePlugin<typeof definition>()
  const providers = useCloudProviders()

  const options = () => [
    { value: MANUAL, label: ctx.t("settings.provider.manual") },
    ...providers.map((item) => ({ value: item.id, label: item.name })),
  ]

  const pick = (value: string) => {
    const providerID = value === MANUAL ? "" : value
    const provider = providers.find((item) => item.id === providerID)
    props.onChange(providerID, provider?.baseURL)
  }

  return (
    <ctx.ui.SettingsRow
      id={props.id}
      title={ctx.t("settings.provider")}
      description={ctx.t("settings.provider.description")}
    >
      <ctx.ui.Select
        label={ctx.t("settings.provider")}
        value={props.value || MANUAL}
        options={options()}
        onChange={pick}
      />
    </ctx.ui.SettingsRow>
  )
}
