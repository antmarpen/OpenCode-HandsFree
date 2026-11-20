import { Schema } from "effect"
import { Plugin, Store } from "@opencode/plugin/gui"
import { en } from "./i18n/en"
import { es } from "./i18n/es"

/**
 * `local` runs whisper.cpp and the OS speech synthesizer on this machine.
 * `cloud` calls any OpenAI-compatible `/audio/transcriptions` and `/audio/speech`.
 */
const Engine = Schema.Literals(["local", "cloud"])

export const Settings = Schema.Struct({
  inputEngine: Engine,
  outputEngine: Engine,
  /** Send the transcript straight to the agent instead of leaving it in the composer. */
  autoSend: Schema.Boolean,
  /** Defaults for sessions that never chose; per-chat switches live in the session store. */
  defaultInput: Schema.Boolean,
  defaultOutput: Schema.Boolean,
  transcribe: Schema.Struct({
    /** Empty means the system default input device. */
    inputDevice: Schema.String,
    localBinary: Schema.String,
    localModel: Schema.String,
    language: Schema.String,
    cloudURL: Schema.String,
    cloudModel: Schema.String,
    /** OpenCode integration id whose credential is reused; empty means the plugin's own key. */
    provider: Schema.String,
  }),
  speak: Schema.Struct({
    /** Local output must be enabled explicitly before the switch becomes usable. */
    localEnabled: Schema.Boolean,
    /** Empty means the system default output device. */
    outputDevice: Schema.String,
    localVoice: Schema.String,
    localRate: Schema.Number,
    cloudURL: Schema.String,
    cloudModel: Schema.String,
    cloudVoice: Schema.String,
    format: Schema.String,
    provider: Schema.String,
  }),
})

/** Per-chat switches. Undefined means "follow the settings default". */
export const SessionVoice = Schema.Struct({
  input: Schema.optional(Schema.Boolean),
  output: Schema.optional(Schema.Boolean),
})

export const definition = Plugin.define({
  stores: {
    settings: Store.global(Settings, {
      inputEngine: "local",
      outputEngine: "local",
      autoSend: false,
      defaultInput: false,
      defaultOutput: false,
      transcribe: {
        inputDevice: "",
        localBinary: "whisper-cli",
        localModel: "",
        language: "auto",
        cloudURL: "https://api.openai.com/v1",
        cloudModel: "",
        provider: "",
      },
      speak: {
        localEnabled: false,
        outputDevice: "",
        localVoice: "",
        localRate: 0,
        cloudURL: "https://api.openai.com/v1",
        cloudModel: "",
        cloudVoice: "alloy",
        format: "wav",
        provider: "",
      },
    }),
    voice: Store.session(SessionVoice, {}),
  },
  i18n: { en, es },
})
