import { createEffect, createSignal, onCleanup } from "solid-js"
import { ComposerPill, Style, type ComposerPillView } from "@opencode/plugin/gui"
import { waveMask } from "../audio/meter"
import type { Ctx } from "../context"
import { readFlags } from "../flags"
import type { VoiceStatus } from "../status"
import type { Conversation } from "./conversation"
import type { Dictation } from "./dictation"
import type { Speech } from "./speech"

/**
 * A zero-width space closes every title, so the CSS and the click zone below can find
 * only this plugin's capsule.
 */
const MARK = "\u200B"

/** Icon area, live wave and action glyph inside the capsule. */
const ICON_SIZE = 14
const ICON_GAP = 8
const SIDE = 10
const WAVE_WIDTH = 200
const WAVE_HEIGHT = 16
const ACTION_SIZE = 16
/** Clicks this close to the end of the capsule run the action instead of the toggle. */
const ACTION_ZONE = 32
const FRAME_MS = 110

const maskUrl = (body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none">${body}</svg>`,
  )}")`

const MASK_PROPS = `-webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;`

/** The microphone the app's catalog does not ship. */
const MIC_MASK = maskUrl(
  `<g stroke="#fff" stroke-width="1.3" stroke-linecap="round" fill="none">
    <path d="M8 1.6a2.3 2.3 0 0 0-2.3 2.3v4.2a2.3 2.3 0 0 0 4.6 0V3.9A2.3 2.3 0 0 0 8 1.6z"/>
    <path d="M12.6 7.4v.8a4.6 4.6 0 0 1-9.2 0v-.8"/>
    <path d="M8 12.9v2"/>
  </g>`,
)

/** Two speech bubbles: the armed conversation mode, waiting to be pressed. */
const CONVERSATION_MASK = maskUrl(
  `<g transform="scale(0.667)" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M3 4h12.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H9l-4 3v-3H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
    <path d="M18 8.2h2.2a1.8 1.8 0 0 1 1.8 1.8v3.8a1.8 1.8 0 0 1-1.8 1.8h-1v2.4l-2.9-2.4"/>
  </g>`,
)

/** Drops the turn in progress: the recording, the transcription or the conversation loop. */
const CANCEL_MASK = maskUrl(
  `<path d="M4.6 4.6 11.4 11.4M11.4 4.6 4.6 11.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`,
)

/** Stops the reply being read aloud. */
const STOP_MASK = maskUrl(`<rect x="4" y="4" width="8" height="8" rx="1.8" fill="#fff"/>`)

/** Bouncing bars for the icon while a transcription runs. */
function workingMask(step: number): string {
  const bars = [0.6, 1, 0.75, 0.95, 0.65, 0.85]
    .map((base, index) => {
      const pulse = 0.45 + 0.55 * Math.abs(Math.sin(step * 0.85 + index * 1.7))
      const half = Math.max(1.2, 5.4 * base * pulse)
      const x = (2.6 + index * 2.2).toFixed(1)
      return `<path d="M${x} ${(8 - half).toFixed(1)}V${(8 + half).toFixed(1)}"/>`
    })
    .join("")

  return maskUrl(`<g stroke="#fff" stroke-width="1.3" stroke-linecap="round">${bars}</g>`)
}

/** Pills that carry no label: other plugins' pills still need their icon squared up. */
const BASE_RULES = `
[data-slot=session-plugin-pill]:has(> span:empty):not([aria-label$="${MARK}"]) {
  width: 28px;
  height: 28px;
  padding-inline: 0;
  gap: 0;
  justify-content: center;
}`

function iconBox(left: string, transform: string): string {
  return `left: ${left};
  top: 50%;
  width: ${ICON_SIZE}px;
  height: ${ICON_SIZE}px;
  transform: ${transform};
  background-color: var(--icon-color, currentColor);
  -webkit-mask-image: var(--icon-mask);
  mask-image: var(--icon-mask);
  ${MASK_PROPS}`
}

/** A lone icon with no wave and no action: the plain pill. */
function compactRule(icon: string): string {
  return `[data-slot=session-plugin-pill][aria-label$="${MARK}"] {
  position: relative;
  width: 28px;
  height: 28px;
  padding: 0;
  gap: 0;
  justify-content: center;
  --icon-mask: ${icon};
}
[data-slot=session-plugin-pill][aria-label$="${MARK}"] > svg,
[data-slot=session-plugin-pill][aria-label$="${MARK}"] > span {
  display: none;
}
[data-slot=session-plugin-pill][aria-label$="${MARK}"]::after {
  content: "";
  position: absolute;
  ${iconBox("50%", "translate(-50%, -50%)")}
}`
}

/**
 * The capsule that carries the live wave, the icon and an action glyph. The host only
 * renders an icon and a text label, so the icon and the action are painted by CSS and
 * the label becomes the wave.
 */
function activeRule(icon: string, iconColor: string, wave: string, action: string): string {
  return `[data-slot=session-plugin-pill][aria-label$="${MARK}"] {
  position: relative;
  padding-inline: ${SIDE}px;
  gap: 0;
  --icon-mask: ${icon};
  --icon-color: ${iconColor};
}
[data-slot=session-plugin-pill][aria-label$="${MARK}"] > svg {
  display: none;
}
[data-slot=session-plugin-pill][aria-label$="${MARK}"] > span[data-composer-pill-icon] {
  display: none;
}
[data-slot=session-plugin-pill][aria-label$="${MARK}"] > span[dir="auto"] {
  width: ${wave ? WAVE_WIDTH : 0}px;
  height: ${WAVE_HEIGHT}px;
  margin-inline-start: ${ICON_SIZE + ICON_GAP}px;
  margin-inline-end: ${ACTION_SIZE + ICON_GAP}px;
  background-color: currentColor;
  -webkit-mask-image: ${wave || "none"};
  mask-image: ${wave || "none"};
  ${MASK_PROPS}
}
[data-slot=session-plugin-pill][aria-label$="${MARK}"]::after {
  content: "";
  position: absolute;
  ${iconBox(`${SIDE}px`, "translateY(-50%)")}
}
[data-slot=session-plugin-pill][aria-label$="${MARK}"]::before {
  content: "";
  position: absolute;
  right: ${SIDE}px;
  top: 50%;
  width: ${ACTION_SIZE}px;
  height: ${ACTION_SIZE}px;
  transform: translateY(-50%);
  background-color: var(--color-v2-state-fg-danger, currentColor);
  -webkit-mask-image: ${action};
  mask-image: ${action};
  ${MASK_PROPS}
}`
}

/**
 * A microphone next to the composer. It appears when dictation is usable, starts and
 * stops recording, shows the live wave and carries the cancel or stop glyph. In
 * conversation mode it wears the conversation glyph, starts the loop when pressed and
 * keeps the microphone open between turns; the cancel glyph stops the loop, not the mode.
 */
export function registerPill(
  ctx: Ctx,
  dictation: Dictation,
  status: VoiceStatus,
  speech: Speech,
  stop: () => void,
  conversation: Conversation,
) {
  const [frame, setFrame] = createSignal(0)

  createEffect(() => {
    if (!dictation.working()) return

    const timer = setInterval(() => setFrame((value) => value + 1), FRAME_MS)
    onCleanup(() => clearInterval(timer))
  })

  /**
   * True while a reply is read aloud and the capsule should offer the stop glyph: a
   * manual recording keeps its cancel glyph, but a conversation records in the background
   * (only a pre-roll) and must still let the user hush the voice.
   */
  const reading = () =>
    speech.speaking() &&
    !dictation.working() &&
    (!dictation.recording() || conversation.running())

  // Reruns with every captured level, so the mask follows the microphone.
  ctx.add(Style, () => {
    const recording = dictation.recording()
    const working = dictation.working()
    const running = conversation.running()
    const armed = conversation.armed()
    const hush = reading()

    if (!recording && !working && !running && !hush) {
      return `${BASE_RULES}\n${compactRule(armed ? CONVERSATION_MASK : MIC_MASK)}`
    }

    const levels = dictation.levels()
    // A conversation keeps the microphone open for minutes: only paint the wave when
    // there was voice in the last second, and never while the reply's own audio plays.
    const audible = levels.slice(-12).some((level) => level > 0.15)
    const wave = recording && (!running || (audible && !speech.speaking())) ? waveMask(levels) : ""
    // The conversation keeps its own glyph while the loop runs, so it never looks like
    // plain dictation; only a manual recording wears the microphone.
    const icon = working
      ? workingMask(frame())
      : armed || running
        ? CONVERSATION_MASK
        : MIC_MASK
    const iconColor = working
      ? "var(--color-v2-state-fg-warning, currentColor)"
      : "currentColor"
    const action = hush ? STOP_MASK : CANCEL_MASK

    return `${BASE_RULES}\n${activeRule(icon, iconColor, wave, action)}`
  })

  /** Whether the end of the capsule currently has something to do. */
  const hasAction = () => reading() || conversation.running() || dictation.active()

  const action = () => {
    if (reading()) stop()
    else if (conversation.running()) conversation.stop()
    else if (dictation.recording() || dictation.working()) dictation.cancel()
  }

  // The action glyph shares the capsule with the toggle, so it needs its own click zone:
  // capture runs before the button's handler and stops it for the glyph's end of the pill.
  const onClick = (event: MouseEvent) => {
    if (!hasAction()) return

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

  ctx.add(ComposerPill, {
    id: "voice",
    order: 90,
    show: (input): ComposerPillView | undefined => {
      if (!status.inputReady()) return undefined
      if (!readFlags(ctx, input.session).input) return undefined

      const recording = dictation.recording()
      const working = dictation.working()
      const talking = conversation.running() || conversation.armed()

      return {
        icon: "outline-audio",
        label: "",
        title: `${
          working
            ? ctx.t("pill.working")
            : recording
              ? ctx.t("pill.recording")
              : talking
                ? ctx.t("pill.conversation")
                : ctx.t("pill.dictate")
        }${MARK}`,
        run: () => {
          if (conversation.running()) conversation.stop()
          else if (conversation.armed()) conversation.start()
          else void dictation.toggle()
        },
      }
    },
  })
}
