import { onCleanup } from "solid-js"
import { Plugin } from "@opencode/plugin/gui"
import { Voice } from "./contract"
import type { definition } from "./definition"
import { getSecretState } from "./settings/secrets"
import { createVoiceStatus } from "./status"
import { registerCommands } from "./window/commands"
import { createConversation } from "./window/conversation"
import { createDelivery } from "./window/delivery"
import { createDictation } from "./window/dictation"
import { registerEscape } from "./window/escape"
import { registerHeaderControl } from "./window/header-control"
import { registerPill } from "./window/pill"
import { subscribeReplies } from "./window/replies"
import { registerSettingsPage } from "./window/settings-page"
import { getSpeech } from "./window/speech"
import { probePlayback } from "./window/voice-log"
import { registerStopPill } from "./window/stop-pill"

/**
 * Window setup: compose the voice modules and register their contributions.
 * All behavior lives in the modules under `window/`.
 */
export const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const secrets = getSecretState(ctx)
  const status = createVoiceStatus(ctx, secrets)

  const speech = getSpeech(ctx)
  const dictation = createDictation(ctx, createDelivery(ctx), speech.cancel)
  const conversation = createConversation(ctx, dictation, speech, status)

  const stop = () => {
    speech.cancel()
    void ctx.main(Voice).stop().catch(() => {})
  }

  subscribeReplies(ctx, speech.speak)
  probePlayback(dictation, speech, conversation)
  registerCommands(ctx, dictation, status, stop)
  registerEscape(dictation, conversation)
  registerPill(ctx, dictation, status, speech, stop, conversation)
  registerHeaderControl(ctx, status)
  registerStopPill(ctx, status, dictation, conversation, speech.speaking, stop)
  registerSettingsPage(ctx)

  onCleanup(() => {
    speech.cancel()
    dictation.cancel()
    void ctx.main(Voice).stop().catch(() => {})
  })
}
