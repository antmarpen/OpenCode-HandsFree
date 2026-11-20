import { Schema } from "effect"
import { Ipc } from "@opencode/plugin/gui"

const Engine = Schema.Literals(["local", "cloud"])
const SecretSlot = Schema.Literals(["transcribe", "speak"])

export type VoiceSlot = "transcribe" | "speak"

/**
 * The bridge between the window and the Electron main process.
 *
 * The main process owns the audio work: it spawns whisper.cpp, calls the provider with the
 * API key from the OS keychain, and plays the synthesized voice. The window only sends text
 * and base64 WAV, so every window shares one player and one key store.
 */
export const Voice = Ipc.define({
  id: "opencode-voice.engine",
  methods: {
    transcribe: {
      input: Schema.Struct({
        /** Base64-encoded 16 kHz mono WAV. */
        audio: Schema.String,
        engine: Engine,
        language: Schema.String,
        /** Reuse this OpenCode provider's URL and credential instead of the plugin key. */
        providerID: Schema.optional(Schema.String),
        local: Schema.Struct({ binary: Schema.String, model: Schema.String }),
        cloud: Schema.Struct({ url: Schema.String, model: Schema.String }),
      }),
      output: Schema.Struct({ text: Schema.String }),
    },
    speak: {
      input: Schema.Struct({
        text: Schema.String,
        /** Dedupe key across windows, e.g. `<sessionID>:<messageID>:<ordinal>:<chunk>`. */
        id: Schema.String,
        engine: Engine,
        providerID: Schema.optional(Schema.String),
        local: Schema.Struct({ voice: Schema.String, rate: Schema.Number }),
        cloud: Schema.Struct({
          url: Schema.String,
          model: Schema.String,
          voice: Schema.String,
          format: Schema.String,
        }),
      }),
      output: Schema.Struct({
        /** Base64-encoded audio, empty when the text had nothing to say or was a duplicate. */
        audio: Schema.String,
        /** MIME type of `audio`, such as `audio/wav` or `audio/mpeg`. */
        mime: Schema.String,
      }),
    },
    models: {
      input: Schema.Struct({
        slot: SecretSlot,
        url: Schema.String,
        providerID: Schema.optional(Schema.String),
      }),
      output: Schema.Struct({
        models: Schema.Array(
          Schema.Struct({ id: Schema.String, name: Schema.optional(Schema.String) }),
        ),
      }),
    },
    voices: {
      output: Schema.Struct({ voices: Schema.Array(Schema.String) }),
    },
    stop: {
      output: Schema.Struct({ stopped: Schema.Boolean }),
    },
    hasSecret: {
      input: Schema.Struct({ slot: SecretSlot }),
      output: Schema.Boolean,
    },
    setSecret: {
      input: Schema.Struct({ slot: SecretSlot, value: Schema.String }),
      output: Schema.Boolean,
    },
  },
})
