import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition"

export interface CloudProvider {
  readonly id: string
  readonly name: string
  readonly baseURL?: string
}

/**
 * Providers OpenCode can already use: they have an integration with at least one
 * connection, so the plugin can reuse both their base URL and their credential.
 */
export function useCloudProviders(): CloudProvider[] {
  const ctx = usePlugin<typeof definition>()
  const data = ctx.servers.get("sidecar")?.data
  if (!data) return []

  const integrations = data.location.integration.list() ?? []
  const connected = new Set(
    integrations.filter((item) => item.connections.length > 0).map((item) => item.id),
  )

  return (data.location.provider.list() ?? [])
    .filter((item) => !!item.integrationID && connected.has(item.integrationID))
    .flatMap((item) => {
      const baseURL = typeof item.settings?.baseURL === "string" ? item.settings.baseURL.trim() : ""
      // A provider without a URL cannot receive audio, and falling back to the URL field
      // would send its credential elsewhere; it is not offered.
      return baseURL ? [{ id: item.id as string, name: item.name, baseURL }] : []
    })
}

/**
 * Friendly names from OpenCode's model catalog. The lookup reads the provider on
 * every call so it follows the select without recreating the component.
 */
export function useModelNames(): (providerID: string, modelID: string) => string | undefined {
  const ctx = usePlugin<typeof definition>()
  return (providerID, modelID) => {
    const data = ctx.servers.get("sidecar")?.data
    const models = data?.location.model.list() ?? []
    return models.find((item) => item.providerID === providerID && item.modelID === modelID)?.name
  }
}
