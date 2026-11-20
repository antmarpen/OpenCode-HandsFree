import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import { quotePowerShell } from "./powershell"
import type { Runner } from "./runner"
import { createTempFile, removeTempFile } from "./temp"

export interface LocalSpeech {
  readonly text: string
  readonly voice: string
  readonly rate: number
}

const WPM_BASE = 175
const WPM_PER_STEP = 12
const RATE_MIN = -10
const RATE_MAX = 10

const clampRate = (rate: number): number =>
  Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(rate)))

/** Words per minute for `say` and `espeak` from the -10..10 setting. */
export function wordsPerMinute(rate: number): number {
  return Math.round(WPM_BASE + clampRate(rate) * WPM_PER_STEP)
}

const voiceArgs = (voice: string): string[] => (voice ? ["-v", voice] : [])

/**
 * PowerShell script that synthesizes the text it reads from stdin into a WAV file.
 * Exported for testability.
 */
export function windowsSpeechScript(input: LocalSpeech, file: string): string {
  const selectVoice = input.voice ? `$s.SelectVoice('${quotePowerShell(input.voice)}'); ` : ""

  return [
    "Add-Type -AssemblyName System.Speech;",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
    selectVoice,
    `$s.Rate = ${clampRate(input.rate)};`,
    `$s.SetOutputToWaveFile('${quotePowerShell(file)}');`,
    "$text = [Console]::In.ReadToEnd();",
    "if ($text) { $s.Speak($text) };",
    "$s.Dispose();",
  ]
    .filter(Boolean)
    .join(" ")
}

/**
 * Synthesizes with the operating system voice into `file`. Returns false when the
 * command was stopped (barge-in) instead of finishing.
 */
function synthesize(input: LocalSpeech, runner: Runner, file: string): Promise<boolean> {
  if (process.platform === "win32") {
    return runner.run(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", windowsSpeechScript(input, file)],
      { stdin: input.text },
    )
  }

  const rate = String(wordsPerMinute(input.rate))

  if (process.platform === "darwin") {
    return runner.run("say", [
      ...voiceArgs(input.voice),
      "-r",
      rate,
      "-o",
      file,
      "--data-format=LEI16@22050",
      "--",
      input.text,
    ])
  }

  return runner.run("espeak-ng", [...voiceArgs(input.voice), "-s", rate, "-w", file, "--", input.text])
}

/**
 * Synthesizes with the operating system voice: SAPI on Windows, `say`, or `espeak-ng`.
 * Returns the encoded WAV so the window can play it through the chosen device.
 */
export async function speakLocal(input: LocalSpeech, runner: Runner): Promise<Uint8Array> {
  const file = await createTempFile(`speak-${randomUUID()}.wav`, new Uint8Array())

  try {
    const ran = await synthesize(input, runner, file)
    return ran ? new Uint8Array(await fs.readFile(file)) : new Uint8Array()
  } finally {
    await removeTempFile(file)
  }
}
