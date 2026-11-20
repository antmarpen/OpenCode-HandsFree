import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

/**
 * Resolved lazily: this module is also evaluated in the window, where `os` and `path`
 * are inert placeholders and must not be called at module scope.
 */
const root = () => path.join(os.tmpdir(), "opencode-voice")

export async function createTempFile(name: string, data: Uint8Array | string): Promise<string> {
  await fs.mkdir(root(), { recursive: true })
  const file = path.join(root(), name)
  await fs.writeFile(file, data)
  return file
}

export async function removeTempFile(file: string): Promise<void> {
  await fs.rm(file, { force: true }).catch(() => {})
}

export async function clearTempFiles(): Promise<void> {
  await fs.rm(root(), { recursive: true, force: true }).catch(() => {})
}
