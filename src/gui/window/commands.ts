import { Command, type Command as CommandItem } from "@opencode/plugin/gui"
import type { Ctx } from "../context"
import { readFlags, setVoice, toggleFlag } from "../flags"
import { SETTINGS_PAGE } from "../settings-route"
import type { VoiceStatus } from "../status"
import type { Dictation } from "./dictation"

/**
 * Commands and slash entries: /dictate, /voice on|off|input|output|settings,
 * /speak, /shush, plus Enter-to-dictate while the prompt is empty.
 */
export function registerCommands(
  ctx: Ctx,
  dictation: Dictation,
  status: VoiceStatus,
  stop: () => void,
) {
  // Dictation needs a chat, a configured engine, the chat's own switch on, and no
  // conversation mode: there the loop drives the microphone instead.
  const canDictate = () => {
    const session = ctx.sessions.current()
    if (!session) return false
    if (!status.inputReady()) return false
    const flags = readFlags(ctx, session)
    return flags.input && !flags.conversation
  }

  ctx.add(Command, (): CommandItem => ({
    id: "dictate",
    title: dictation.recording() ? ctx.t("command.stop") : ctx.t("command.dictate"),
    description: ctx.t("command.dictate.description"),
    keywords: "voice audio stt speech microphone dictado voz microfono",
    section: "prompt",
    bind: "mod+shift+space",
    slash: { name: "dictate" },
    enabled: canDictate(),
    run: () => void dictation.toggle(),
  }))

  ctx.add(Command, (): CommandItem => ({
    id: "voice",
    title: ctx.t("command.voice"),
    description: ctx.t("command.voice.description"),
    keywords: "voice config switches settings dictado voz ajustes",
    section: "session",
    slash: { name: "voice", arguments: true },
    enabled: !!ctx.sessions.current(),
    run: (input) => runVoice(ctx, input),
  }))

  ctx.add(Command, (): CommandItem => ({
    id: "read-aloud",
    title: ctx.t("command.output"),
    description: ctx.t("command.output.description"),
    keywords: "voice speak tts leer voz respuestas",
    section: "session",
    slash: { name: "speak" },
    enabled: !!ctx.sessions.current() && status.outputReady(),
    run: () => {
      const session = ctx.sessions.current()
      if (session) toggleFlag(ctx, session, "output")
    },
  }))

  ctx.add(Command, (): CommandItem => ({
    id: "stop-speaking",
    title: ctx.t("command.stopSpeaking"),
    keywords: "stop voice silence detener voz",
    section: "session",
    slash: { name: "shush" },
    run: () => stop(),
  }))

  ctx.add(Command, (): CommandItem => ({
    id: "dictate-when-empty",
    title: ctx.t("command.dictate"),
    hidden: true,
    bind: "enter",
    editable: true,
    enabled: canDictate(),
    run: () => {
      const composer = ctx.screen.current()?.composer
      if (!composer?.focused() || composer.text().trim()) return false
      void dictation.toggle()
    },
  }))
}

function runVoice(ctx: Ctx, input?: string) {
  const session = ctx.sessions.current()
  if (!session) return

  const action = (input ?? "").trim().toLowerCase()

  if (action === "settings") {
    ctx.layout.settings(SETTINGS_PAGE)
    return
  }

  if (action === "on" || action === "off") {
    setVoice(ctx, session, action === "on")
    return
  }

  if (action === "input" || action === "output") {
    toggleFlag(ctx, session, action)
    return
  }

  if (action === "") {
    const flags = readFlags(ctx, session)
    const state = (enabled: boolean) => (enabled ? ctx.t("pill.on") : ctx.t("pill.off"))
    ctx.toast.show({
      title: `${ctx.t("pill.input")}: ${state(flags.input)} · ${ctx.t("pill.output")}: ${state(flags.output)}`,
      description: ctx.t("command.voice.usage"),
    })
    return
  }

  ctx.toast.show({ title: ctx.t("command.voice.usage") })
}
