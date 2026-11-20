import type { MainContext } from "@opencode/plugin/gui/main"
import type { VoiceSlot } from "../contract"
import { VoiceCredentials } from "../../rpc"
import type { Secrets } from "./secrets"

export interface ResolvedCredential {
  readonly key: string
  readonly baseURL?: string
}

export interface Credentials {
  /** The plugin's own key, or the URL and credential OpenCode has for the provider. */
  resolve(slot: VoiceSlot, providerID?: string): Promise<ResolvedCredential>
}

export function createCredentials(secrets: Secrets, client: MainContext["client"]): Credentials {
  return {
    async resolve(slot, providerID) {
      if (!providerID) return { key: secrets.read(slot) }

      const result = (await client.rpc(VoiceCredentials).credential({ providerID })) as {
        key?: string
        baseURL?: string
      }
      const baseURL = result.baseURL?.trim()
      // A provider credential only travels to the provider's own endpoint. Without a URL
      // the request would fall back to the window's field, which may be another host.
      if (!baseURL) {
        throw new Error("The selected provider has no base URL. Choose another provider or use Manual.")
      }
      return { key: result.key ?? "", baseURL }
    },
  }
}
