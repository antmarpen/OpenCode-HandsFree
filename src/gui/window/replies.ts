import { onCleanup } from "solid-js"
import { createKeyed } from "@opencode/plugin/gui"
import type { Ctx } from "../context"
import { readFlags } from "../flags"
import type { Speak } from "./speech"

/**
 * Speaks each completed assistant text block in the chats where reading is on.
 * Subagent sessions are skipped: their text belongs to the parent's answer.
 */
export function subscribeReplies(ctx: Ctx, speak: Speak) {
  createKeyed(
    () => ctx.servers.get("sidecar")?.data,
    (data) =>
      onCleanup(
        data.on("session.text.ended", (event) => {
          const { sessionID, assistantMessageID, ordinal, text } = event.data
          if (!text.trim()) return
          if (data.session.root(sessionID) !== sessionID) return

          const session = ctx.sessions
            .list()
            .find((item) => item.id === sessionID && item.server.id === "sidecar")
          if (!session || !readFlags(ctx, session).output) return

          void speak(text, `${sessionID}:${assistantMessageID}:${ordinal}`)
        }),
      ),
  )
}
