import { capture } from "./capture"
import type { Log } from "./log"

const WINDOWS_SCRIPT = [
  "Add-Type -AssemblyName System.Speech;",
  "(New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() |",
  "ForEach-Object { $_.VoiceInfo.Name }",
].join(" ")

/**
 * Installed system voices for local output. On Linux the list is left empty: the
 * engine still works through `espeak-ng`, and the voice field accepts a name.
 */
export async function listVoices(log: Log): Promise<{ voices: string[] }> {
  try {
    if (process.platform === "win32") {
      const output = await capture("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        WINDOWS_SCRIPT,
      ])
      return { voices: unique(output.split(/\r?\n/)) }
    }

    if (process.platform === "darwin") {
      const output = await capture("say", ["-v", "?"])
      return { voices: unique(output.split(/\r?\n/).map((line) => line.split(/\s{2,}/)[0] ?? "")) }
    }

    return { voices: [] }
  } catch (error) {
    log.write("warn", "voice: could not list system voices", { error: String(error) })
    return { voices: [] }
  }
}

function unique(lines: readonly string[]): string[] {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
}
