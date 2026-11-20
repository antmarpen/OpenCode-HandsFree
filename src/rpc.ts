import { Rpc } from "@opencode/plugin/rpc"

const ProviderError = {
  type: "object",
  properties: { providerID: { type: "string" } },
  required: ["providerID"],
  additionalProperties: false,
}

/**
 * Server-side bridge so the main process can use a provider OpenCode already has:
 * its base URL and the credential of its active connection.
 */
export const VoiceCredentials = Rpc.define({
  id: "opencode-voice.credentials",
  methods: {
    credential: {
      input: {
        type: "object",
        properties: { providerID: { type: "string" } },
        required: ["providerID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          key: { type: "string" },
          baseURL: { type: "string" },
        },
        required: ["key", "baseURL"],
        additionalProperties: false,
      },
      errors: { missing: ProviderError },
    },
  },
  events: {},
})
