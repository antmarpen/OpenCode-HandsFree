import type { MountedSession } from "@opencode/plugin/gui"
import type { Ctx } from "../context"

export interface DeliverOptions {
  /** Send the text as a prompt even when auto-send is off (conversation mode). */
  readonly send?: boolean
}

/**
 * Hands a transcript to the chat it was recorded for: send it, insert it into the
 * composer, or copy it when the user moved to another chat meanwhile.
 */
export type Deliver = (
  session: MountedSession,
  text: string,
  options?: DeliverOptions,
) => Promise<void>

export function createDelivery(ctx: Ctx): Deliver {
  return async (session, text, options) => {
    const settings = ctx.stores.settings.value

    if (options?.send || settings.autoSend) {
      await session.server.client.session.prompt({ sessionID: session.id, text })
      return
    }

    const current = ctx.sessions.current()
    if (current && current.id === session.id && current.server.id === session.server.id) {
      const composer = ctx.screen.current()?.composer
      composer?.insert(text)
      composer?.focus()
      return
    }

    await ctx.system.copy(text)
    ctx.toast.show({ title: ctx.t("status.copied"), description: ctx.t("status.copied.description") })
  }
}
