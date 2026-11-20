import { Plugin } from "@opencode/plugin"

import { VoiceCredentials } from "./rpc"

/**
 * The server half resolves what OpenCode already knows about a provider: the base URL
 * from its settings and the credential of its active connection.
 */
export default Plugin.define({
  id: "opencode-voice",
  async setup(ctx) {
    await ctx.rpc.register(VoiceCredentials, {
      credential: async (input, call) => {
        const { providerID } = input as { providerID: string }

        const provider = (await ctx.provider.get({ providerID })).data
        if (!provider.integrationID) {
          return call.error("missing", "The provider has no integration", { providerID })
        }

        const connection = await ctx.integration.connection.active(provider.integrationID)
        if (!connection) {
          return call.error("missing", "No active OpenCode connection for this provider", { providerID })
        }

        const value = await ctx.integration.connection.resolve(connection)
        const key =
          value?.type === "key" ? value.key : value?.type === "oauth" ? value.access : ""

        if (!key) {
          return call.error("missing", "The provider has no usable credential", { providerID })
        }

        const baseURL =
          typeof provider.settings?.baseURL === "string" ? provider.settings.baseURL : ""

        return { key, baseURL }
      },
    })
  },
})
