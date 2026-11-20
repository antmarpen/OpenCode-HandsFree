import type { SetupContext } from "@opencode/plugin/gui"
import type { definition } from "./definition"

/** The window setup context, typed with this plugin's declared stores. */
export type Ctx = SetupContext<typeof definition>
