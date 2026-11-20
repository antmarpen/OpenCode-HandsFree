import type { Ctx } from "./context"
import type { SecretState } from "./settings/secrets"

export interface VoiceStatus {
  /** Dictation has everything it needs: a whisper.cpp setup or a cloud key. */
  inputReady(): boolean
  /** Reading aloud can run: the system voice, or a cloud key. */
  outputReady(): boolean
}

/**
 * Pure derivation from the settings and the key presence. The local system voice is
 * assumed to exist; the local path only needs the whisper.cpp binary and model.
 */
export function createVoiceStatus(ctx: Ctx, secrets: SecretState): VoiceStatus {
  const settings = () => ctx.stores.settings.value

  const inputReady = () => {
    const current = settings()
    const transcribe = current.transcribe
    return current.inputEngine === "local"
      ? Boolean(transcribe.localBinary.trim() && transcribe.localModel.trim())
      : Boolean(
          transcribe.cloudModel.trim() &&
            (transcribe.provider || (transcribe.cloudURL.trim() && secrets.configured("transcribe"))),
        )
  }

  const outputReady = () => {
    const current = settings()
    if (current.outputEngine === "local") return current.speak.localEnabled

    const speak = current.speak
    return Boolean(
      speak.cloudModel.trim() &&
        (speak.provider || (speak.cloudURL.trim() && secrets.configured("speak"))),
    )
  }

  return { inputReady, outputReady }
}
