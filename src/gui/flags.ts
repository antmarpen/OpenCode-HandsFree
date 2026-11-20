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
 * Conversation needs both directions, so switching it on switches them on and remembers
 * what they were; switching it off puts them back, defaults included.
 */
function writeConversation(ctx: Ctx, session: SessionRef, value: boolean) {
  const store = ctx.stores.voice(session)

  if (!value) {
    store.update((draft) => {
      draft.conversation = false
      draft.input = draft.beforeInput
      draft.output = draft.beforeOutput
      draft.beforeInput = undefined
      draft.beforeOutput = undefined
    })
    return
  }

  const previous = store.value
  store.update((draft) => {
    draft.beforeInput = previous?.input
    draft.beforeOutput = previous?.output
    draft.conversation = true
    draft.input = true
    draft.output = true
  })
}

/**
 * The single entry point for changing one switch: writes the value and announces it.
 * While conversation mode is on it owns both directions, so their switches are locked.
 */
export function setFlag(ctx: Ctx, session: SessionRef, flag: VoiceFlag, value: boolean): boolean {
  if (flag === "conversation") {
    writeConversation(ctx, session, value)
    ctx.toast.show({ title: ctx.t(MESSAGES.conversation[value ? "on" : "off"]) })
    return value
  }

  if (readFlags(ctx, session).conversation) return false

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
    draft.conversation = false
    draft.beforeInput = undefined
    draft.beforeOutput = undefined
  })

  ctx.toast.show({ title: ctx.t(enabled ? "status.voiceOn" : "status.voiceOff") })
}
