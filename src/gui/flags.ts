import type { SessionRef } from "@opencode/plugin/gui"
import type { Ctx } from "./context"

export type VoiceFlag = "input" | "output" | "conversation"

export interface VoiceFlags {
  input: boolean
  output: boolean
  /** Hands-free loop: while on, it implies both directions. */
  conversation: boolean
}

const MESSAGES = {
  input: { on: "status.inputOn", off: "status.inputOff" },
  output: { on: "status.outputOn", off: "status.outputOff" },
  conversation: { on: "status.conversationOn", off: "status.conversationOff" },
} as const

/** Reads a session's switches, falling back to the settings defaults. */
export function readFlags(ctx: Ctx, session: SessionRef): VoiceFlags {
  const stored = ctx.stores.voice(session).value
  const settings = ctx.stores.settings.value
  const conversation = stored?.conversation ?? settings.conversation.default

  return {
    conversation,
    input: conversation || (stored?.input ?? settings.defaultInput),
    output: conversation || (stored?.output ?? settings.defaultOutput),
  }
}

/** Writes one switch for a session. Internal: every path announces its result. */
function writeFlag(ctx: Ctx, session: SessionRef, flag: VoiceFlag, value: boolean) {
  ctx.stores.voice(session).update((draft) => {
    draft[flag] = value
  })
}

/**
 * The single entry point for changing one switch: writes the value and announces it.
 * Turning either direction off leaves conversation mode, because the loop needs both.
 */
export function setFlag(ctx: Ctx, session: SessionRef, flag: VoiceFlag, value: boolean): boolean {
  writeFlag(ctx, session, flag, value)
  if (flag !== "conversation" && !value) writeFlag(ctx, session, "conversation", false)

  ctx.toast.show({ title: ctx.t(MESSAGES[flag][value ? "on" : "off"]) })
  return value
}

/** Flips one switch for a session. */
export function toggleFlag(ctx: Ctx, session: SessionRef, flag: VoiceFlag): boolean {
  return setFlag(ctx, session, flag, !readFlags(ctx, session)[flag])
}

/** Turns both directions on or off together, with a single message. */
export function setVoice(ctx: Ctx, session: SessionRef, enabled: boolean) {
  ctx.stores.voice(session).update((draft) => {
    draft.input = enabled
    draft.output = enabled
    draft.conversation = false
  })

  ctx.toast.show({ title: ctx.t(enabled ? "status.voiceOn" : "status.voiceOff") })
}
