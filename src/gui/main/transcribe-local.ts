import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import { promisify } from "node:util"
import { errorMessage } from "./errors"
import { createTempFile, removeTempFile } from "./temp"

export interface LocalTranscription {
  readonly binary: string
  readonly model: string
  readonly language: string
}

const TIMEOUT_MS = 180_000
const MAX_BUFFER = 8 * 1024 * 1024

/**
 * Runs whisper.cpp on a 16 kHz WAV and reads the text file it writes.
 * The binary must accept -m, -f, -l, -nt, -otxt and -of (whisper-cli and main.exe do).
 */
export async function transcribeLocal(
  audio: Uint8Array,
  input: LocalTranscription,
  signal?: AbortSignal,
): Promise<string> {
  if (!input.binary) throw new Error("The whisper.cpp binary is not configured")
  if (!input.model) throw new Error("The whisper.cpp model is not configured")

  const file = await createTempFile(`in-${randomUUID()}.wav`, audio)
  const base = file.slice(0, -".wav".length)
  const transcript = `${base}.txt`

  try {
    await promisify(execFile)(
      input.binary,
      [
        "-m",
        input.model,
        "-f",
        file,
        "-l",
        input.language || "auto",
        "-nt",
        "-otxt",
        "-of",
        base,
      ],
      { timeout: TIMEOUT_MS, windowsHide: true, maxBuffer: MAX_BUFFER, signal },
    )
    return (await fs.readFile(transcript, "utf8")).trim()
  } catch (error) {
    throw new Error(`whisper.cpp failed: ${errorMessage(error)}`)
  } finally {
    await removeTempFile(file)
    await removeTempFile(transcript)
  }
}
