import { createEffect, createSignal, onCleanup } from "solid-js"
import { ComposerPill, Style, type ComposerPillView } from "@opencode/plugin/gui"
import { waveMask } from "../audio/meter"
import type { Ctx } from "../context"
import { readFlags } from "../flags"
import type { VoiceStatus } from "../status"
import type { Dictation } from "./dictation"
import type { Speech } from "./speech"

/**
 * The two bar glyphs the app ships, alternated so the icon reads as a moving level
 * meter while the audio is being transcribed. The plugin API has no custom animated
 * icons, so this is the closest the host allows.
 */
const WORKING_ICONS = ["outline-wave-audio", "outline-audio"] as const
const FRAME_MS = 300

/**
 * A zero-width space closes the pill title while the capsule carries a painted wave or
 * action, so the CSS and the click zone below can find only this plugin's capsule.
 */
const MARK = "\u200B"

/** The live wave sits between the icon and the action glyph. */
const WAVE_WIDTH = 200
const WAVE_HEIGHT = 16
/** Cancel or stop glyph painted at the end of the capsule, and the room it needs. */
const ACTION_SIZE = 16
const ACTION_GAP = 8
/** Clicks this close to the end of the capsule run the action instead of the toggle. */
const ACTION_ZONE = 32

const maskUrl = (body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">${body}</svg>`,
  )}")`

/** Drops the dictation in progress: the recording or the transcription. */
const CANCEL_MASK = maskUrl(
  `<path d="M4.6 4.6 11.4 11.4M11.4 4.6 4.6 11.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
)

/** Stops the reply being read aloud. */
const STOP_MASK = maskUrl(`<rect x="4" y="4" width="8" height="8" rx="1.8" fill="#fff"/>`)

/**
 * The host sizes a composer pill for an icon plus a label: it keeps the label's gap
 * and padding even when the text is empty, which leaves a lone icon wide and off
 * centre. These square up pills that carry no label, and anchor the action glyph of the
 * pills this plugin paints.
 */
const BASE_RULES = `
[data-slot=session-plugin-pill]:has(> span:empty):not([aria-label$="${MARK}"]) {
  width: 28px;
  height: 28px;
  padding-inline: 0;
  gap: 0;
  justify-content: center;
}
[data-slot=session-plugin-pill][aria-label$="${MARK}"] {
  position: relative;
}`

/**
 * The host gives a composer pill nothing but an icon and a text label, so the wave and
 * the action glyph are painted by CSS inside that capsule: the label becomes the wave
 * and the button's own pseudo-element becomes the cancel or stop button.
 */
function paintedRule(wave: string, action: string): string {
  const label = wave
    ? `[data-slot=session-plugin-pill][aria-label$="${MARK}"] > span {
  width: ${WAVE_WIDTH}px;
  height: ${WAVE_HEIGHT}px;
  margin-inline-end: ${ACTION_SIZE + ACTION_GAP}px;
  background-color: currentColor;
  -webkit-mask-image: ${wave};
  mask-image: ${wave};
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}`
    : `[data-slot=session-plugin-pill][aria-label$="${MARK}"] > span {
  width: 0;
  margin-inline-end: ${ACTION_SIZE + ACTION_GAP}px;
}`

  const button = `[data-slot=session-plugin-pill][aria-label$="${MARK}"]::before {
  content: "";
  position: absolute;
  right: 10px;
  top: 50%;
  width: ${ACTION_SIZE}px;
  height: ${ACTION_SIZE}px;
  transform: translateY(-50%);
  background-color: var(--color-v2-state-fg-danger, currentColor);
  -webkit-mask-image: ${action};
  mask-image: ${action};
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}`

  return `${label}\n${button}`
}

/**
 * A compact microphone next to the composer. It only appears when dictation is usable
 * and enabled for the chat, and clicking it starts or stops recording. While recording,
 * the capsule grows to show the live wave and a cancel glyph; while a reply is being
 * read, the same capsule shows the stop glyph.
 */
export function registerPill(
  ctx: Ctx,
  dictation: Dictation,
  status: VoiceStatus,
  speech: Speech,
  stop: () => void,
) {
  // Reruns with every captured level, so the mask follows the microphone.
  ctx.add(Style, () => {
    const recording = dictation.recording()
    const working = dictation.working()
    const speaking = speech.speaking() && !recording && !working
    if (!recording && !working && !speaking) return BASE_RULES

    const wave = recording ? waveMask(dictation.levels()) : ""
    return `${BASE_RULES}\n${paintedRule(wave, speaking ? STOP_MASK : CANCEL_MASK)}`
  })

  const action = () => {
    if (dictation.recording() || dictation.working()) dictation.cancel()
    else if (speech.speaking()) stop()
  }

  // The action glyph shares the capsule with the toggle, so it needs its own click zone:
  // capture runs before the button's handler and stops it for the glyph's end of the pill.
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null
    const pill = target?.closest?.(`[data-slot=session-plugin-pill][aria-label$="${MARK}"]`)
    if (!pill) return
    if (event.clientX < pill.getBoundingClientRect().right - ACTION_ZONE) return

    event.preventDefault()
    event.stopPropagation()
    action()
  }

  document.addEventListener("click", onClick, true)
  onCleanup(() => document.removeEventListener("click", onClick, true))

  const [frame, setFrame] = createSignal(0)

  createEffect(() => {
    if (!dictation.working()) return

    const timer = setInterval(() => setFrame((value) => (value + 1) % WORKING_ICONS.length), FRAME_MS)
    onCleanup(() => clearInterval(timer))
  })

  ctx.add(ComposerPill, {
    id: "voice",
    order: 90,
    show: (input): ComposerPillView | undefined => {
      if (!status.inputReady()) return undefined
      if (!readFlags(ctx, input.session).input) return undefined

      const recording = dictation.recording()
      const working = dictation.working()
      const speaking = speech.speaking() && !recording && !working

      return {
        icon: working ? WORKING_ICONS[frame()] : "outline-audio",
        tone: recording ? "danger" : working ? "warning" : undefined,
        label: "",
        title: working
          ? `${ctx.t("pill.working")}${MARK}`
          : recording
            ? `${ctx.t("pill.recording")}${MARK}`
            : speaking
              ? `${ctx.t("pill.dictate")}${MARK}`
              : ctx.t("pill.dictate"),
        run: () => void dictation.toggle(),
      }
    },
  })
}
