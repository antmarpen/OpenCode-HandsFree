import { ComposerPill, type ComposerPillView } from "@opencode/plugin/gui"
import type { Ctx } from "../context"
import { readFlags } from "../flags"
import type { VoiceStatus } from "../status"
import type { Conversation } from "./conversation"
import type { Dictation } from "./dictation"

/**
 * A stop button next to the microphone while a reply is being read. The microphone pill
 * already carries this glyph when it can, also in conversation mode, so this pill only
 * fills in when that one is hidden or busy with a recording.
 */
export function registerStopPill(
  ctx: Ctx,
  status: VoiceStatus,
  dictation: Dictation,
  conversation: Conversation,
  speaking: () => boolean,
  stop: () => void,
) {
  ctx.add(ComposerPill, {
    id: "stop-speaking",
    order: 91,
    show: (input): ComposerPillView | undefined => {
      if (!speaking()) return undefined
      if (conversation.running()) return undefined

      const integrated =
        !dictation.active() && status.inputReady() && readFlags(ctx, input.session).input
      if (integrated) return undefined

      return {
        icon: "stop",
        tone: "danger",
        label: "",
        title: ctx.t("command.stopSpeaking"),
        run: stop,
      }
    },
  })
}
