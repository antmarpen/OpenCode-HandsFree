import { Plugin } from "@opencode/plugin/gui"
import { Voice } from "./contract"
import { createCredentials } from "./main/credentials"
import { errorMessage } from "./main/errors"
import { createModelLister } from "./main/models"
import { createRunner } from "./main/runner"
import { createSecrets } from "./main/secrets"
import { createSpeaker } from "./main/speech"
import { clearTempFiles } from "./main/temp"
import { createTranscriber } from "./main/transcribe"
import { listVoices } from "./main/voices"

/** Bump when the Ipc surface changes; it is logged so a stale main process is visible. */
const MAIN_VERSION = 6

/**
 * Main-process setup: compose the audio modules and expose them to every window
 * through the `Voice` Ipc. All behavior lives in the modules under `main/`.
 */
export const main: Plugin.MainSetup = (ctx) => {
  ctx.log.write("info", "voice: main ready", { version: MAIN_VERSION })

  const secrets = createSecrets(ctx, ctx.log)
  const credentials = createCredentials(secrets, ctx.client)
  const runner = createRunner()
  const transcribe = createTranscriber(credentials, ctx.log)
  const models = createModelLister(credentials)

  const speak = createSpeaker(credentials, runner, ctx.log)

  ctx.provide(Voice, {
    transcribe: (input, caller) => transcribe(input, caller.signal),
    speak: (input) => speak(input),
    models: async (input) => {
      try {
        return await models(input)
      } catch (error) {
        ctx.log.write("error", "voice: could not list models", {
          url: input.url,
          provider: input.providerID ?? "manual",
          error: errorMessage(error),
        })
        throw error
      }
    },
    voices: async () => {
      try {
        return await listVoices(ctx.log)
      } catch (error) {
        ctx.log.write("error", "voice: could not list voices", { error: errorMessage(error) })
        throw error
      }
    },
    stop: () => ({ stopped: runner.stop() }),
    hasSecret: ({ slot }) => secrets.has(slot),
    setSecret: ({ slot, value }) => {
      secrets.write(slot, value.trim())
      return secrets.has(slot)
    },
  })

  ctx.onCleanup(() => {
    runner.stop()
    void clearTempFiles()
  })
}
