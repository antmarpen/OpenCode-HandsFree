import type { SessionRef } from "@opencode/plugin/gui"
import type { Ctx } from "./context"

export type VoiceFlag = "input" | "output"

export interface VoiceFlags {
  input: boolean
  output: boolean
}

const MESSAGES = {
  input: { on: "status.inputOn", off: "status.inputOff" },
  output: { on: "status.outputOn", off: "status.outputOff" },
} as const

/** Reads a session's switches, falling back to the settings defaults. */
export function readFlags(ctx: Ctx, session: SessionRef): VoiceFlags {
  const stored = ctx.stores.voice(session).value
  const settings = ctx.stores.settings.value
  return {
    input: stored?.input ?? settings.defaultInput,
    output: stored?.output ?? settings.defaultOutput,
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
 * Used by the header buttons, the popover switches and the commands.
 */
export function setFlag(ctx: Ctx, session: SessionRef, flag: VoiceFlag, value: boolean): boolean {
  writeFlag(ctx, session, flag, value)
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
  })

  ctx.toast.show({ title: ctx.t(enabled ? "status.voiceOn" : "status.voiceOff") })
}
