import { usePlugin } from "@opencode/plugin/gui"
import type { SearchOption } from "../components/search-select"
import { SearchSelect } from "../components/search-select"
import type { definition } from "../definition"

interface RowProps {
  readonly id: string
  readonly title: string
  readonly description?: string
}

/**
 * A settings row whose control is a select-like trigger. It never offers free text
 * in the row: the searchable picker handles the list and, only when it is empty,
 * offers a custom id.
 */
export function SuggestionRow(
  props: RowProps & {
    readonly value: string
    readonly placeholder?: string
    readonly loadLabel: string
    readonly emptyLabel?: string
    load(): Promise<readonly SearchOption[]>
    readonly resetKey?: string
    /** Cheap local lists load on mount so the saved label shows at once. */
    readonly eager?: boolean
    onChange(value: string): void
  },
) {
  const ctx = usePlugin<typeof definition>()

  return (
    <ctx.ui.SettingsRow id={props.id} title={props.title} description={props.description}>
      <SearchSelect
        label={props.title}
        value={props.value || undefined}
        placeholder={props.placeholder}
        loadLabel={props.loadLabel}
        emptyLabel={props.emptyLabel}
        load={props.load}
        resetKey={props.resetKey}
        eager={props.eager}
        onChange={props.onChange}
      />
    </ctx.ui.SettingsRow>
  )
}
